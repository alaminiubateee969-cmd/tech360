import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { sanitizeText, sanitizeEmail, rateLimit, clientIp, logError, audit } from '@/lib/security'
import { claimInboundWebhookEvent, finishInboundWebhookEvent } from '@/lib/identity-resolver'
import { verifyEmailWebhookAuth } from '@/lib/email-webhook-auth'

export const dynamic = 'force-dynamic'

// Inbound email webhook — generic provider shape + Postmark/SendGrid forwarding.
// Matches incoming replies to correct client and communication thread via:
// - normalized From email → Client.email → Client ID
// - In-Reply-To / References header against Communication.providerMessageId
// - Thread subject fallback
// Deduplicates provider events, validates webhook secret where supported,
// persists delivery/failure status honestly.
export async function POST(req: NextRequest) {
  const ip = clientIp(req)
  const rl = rateLimit(`email-hook:${ip}`, 120, 60_000)
  if (!rl.ok) return Response.json({ ok: true })

  const rawBody = await req.text()
  const auth = verifyEmailWebhookAuth({
    rawBody,
    secret: process.env.EMAIL_WEBHOOK_SECRET,
    signature: req.headers.get('x-tech360-signature') ?? req.headers.get('x-hub-signature-256'),
    sharedSecret: req.headers.get('x-email-webhook-secret'),
  })
  if (!auth.ok) {
    const status = auth.reason === 'NOT_CONFIGURED' ? 503 : 401
    return Response.json({ ok: false, error: status === 503 ? 'Email webhook authentication is not configured.' : 'Invalid webhook authentication.' }, { status })
  }

  let payload: Record<string, unknown>
  try {
    payload = JSON.parse(rawBody) as Record<string, unknown>
  } catch {
    return Response.json({ ok: false, error: 'Invalid JSON payload.' }, { status: 400 })
  }

  // Normalize inbound fields across providers
  const fromEmail = sanitizeEmail(
    (payload.from ?? payload.From ?? payload.sender ?? payload.envelopeFrom ?? (payload.headers as Record<string, unknown> | undefined)?.from ?? '') as string,
  )
  const fromName = sanitizeText((payload.fromName ?? payload.from_name ?? payload.senderName ?? '') as string, 200)
  const toEmail = sanitizeEmail((payload.to ?? payload.To ?? payload.recipient ?? payload.envelopeTo ?? '') as string) || null
  const subject = sanitizeText((payload.subject ?? payload.Subject ?? '') as string, 500)
  const textBody =
    sanitizeText((payload.text ?? payload.textBody ?? payload.body ?? payload.plainBody ?? payload.content ?? '') as string, 8000) ||
    sanitizeText((payload.html ?? payload.htmlBody ?? '') as string, 8000)
  const messageId = sanitizeText((payload.messageId ?? payload.message_id ?? payload.MessageID ?? payload.id ?? payload.inboundId ?? '') as string, 200)
  const inReplyTo = sanitizeText((payload.inReplyTo ?? payload.in_reply_to ?? (payload.headers as Record<string, unknown> | undefined)?.['in-reply-to'] ?? '') as string, 500)
  const references = sanitizeText((payload.references ?? payload.References ?? '') as string, 2000)

  if (!fromEmail || !textBody) {
    // Still acknowledge to provider
    return Response.json({ ok: true })
  }

  const eventId = messageId || `email:${fromEmail}:${Date.now()}:${subject.slice(0, 30)}`

  // Deduplicate
  let claim: { claimed: boolean; receiptId?: string | null; claimToken?: string | null }
  try {
    claim = await claimInboundWebhookEvent({ provider: 'EMAIL', providerEventId: eventId, eventType: 'MESSAGE' })
  } catch {
    return Response.json({ ok: true })
  }
  if (!claim.claimed || !claim.receiptId || !claim.claimToken) return Response.json({ ok: true })

  try {
    // Match to client via From email (normalized)
    // Primary: exact Client.email match (the customer replying)
    let clientRow = await db.client.findFirst({
      where: { email: fromEmail, deletedAt: null },
      orderBy: { updatedAt: 'desc' },
    })

    // Secondary: try In-Reply-To matching to thread
    if (!clientRow && inReplyTo) {
      const parent = await db.communication.findFirst({
        where: { providerMessageId: inReplyTo },
        select: { clientId: true },
      })
      if (parent?.clientId) {
        clientRow = await db.client.findUnique({ where: { id: parent.clientId } })
      }
    }

    // Tertiary: References header contains thread
    if (!clientRow && references) {
      const refIds = references.split(/\s+/).filter(Boolean)
      for (const ref of refIds) {
        const parent = await db.communication.findFirst({ where: { providerMessageId: ref }, select: { clientId: true } })
        if (parent?.clientId) {
          clientRow = await db.client.findUnique({ where: { id: parent.clientId } })
          if (clientRow) break
        }
      }
    }

    // Quaternary: subject contains Client ID pattern TECH-YYYY-NNNNNN
    if (!clientRow) {
      const techIdMatch = subject.match(/TECH-\d{4}-\d{4,6}/) ?? textBody.match(/TECH-\d{4}-\d{4,6}/)
      if (techIdMatch) {
        clientRow = await db.client.findUnique({ where: { clientId: techIdMatch[0] } }).catch(() => null)
        // Also try case where subject is "Re: Tech360 Inquiry Received - Client ID TECH-2026-000001"
        if (!clientRow) {
          const altMatch = (subject + ' ' + textBody).match(/Client ID\s+([A-Z]+-\d{4}-\d+)/i)
          if (altMatch) clientRow = await db.client.findUnique({ where: { clientId: altMatch[1].toUpperCase() } }).catch(() => null)
        }
      }
    }

    if (!clientRow) {
      // No matching client — log as orphan email, do not create spurious CRM entry
      await logError({
        source: 'WEBHOOK',
        code: 'EMAIL_UNMATCHED_CLIENT',
        message: `Inbound email from ${fromEmail} could not be matched to a Client ID (subject: ${subject.slice(0, 80)})`,
        workflow: 'EMAIL_IN',
      })
      await db.communication
        .create({
          data: {
            clientId: null,
            channel: 'EMAIL',
            direction: 'IN',
            sender: fromEmail,
            recipient: toEmail ?? 'info@bdtech360.com',
            subject,
            body: textBody.slice(0, 8000),
            providerMessageId: eventId,
            status: 'RECEIVED',
            metadata: JSON.stringify({ fromName, inReplyTo, orphan: true }),
          },
        })
        .catch(() => null)
      await finishInboundWebhookEvent({ receiptId: claim.receiptId, claimToken: claim.claimToken, success: true, clientId: null })
      return Response.json({ ok: true, matched: false })
    }

    // Matched — persist inbound against correct client + thread
    const duplicate = await db.communication.findFirst({ where: { providerMessageId: eventId }, select: { id: true } }).catch(() => null)
    if (!duplicate) {
      await db.communication.create({
        data: {
          clientId: clientRow.id,
          channel: 'EMAIL',
          direction: 'IN',
          sender: fromEmail,
          recipient: toEmail ?? 'info@bdtech360.com',
          subject,
          body: textBody.slice(0, 8000),
          providerMessageId: eventId,
          status: 'RECEIVED',
          metadata: JSON.stringify({ fromName, inReplyTo, references, threadMatched: Boolean(inReplyTo || references) }),
        },
      })
    }

    // Update comm state
    const { recordInbound } = await import('@/lib/conversation-state')
    await recordInbound(clientRow.id, clientRow.clientId, textBody, 'EMAIL').catch(() => null)

    // Apply email reply to discovery / lifecycle where relevant
    // - If discovery summary awaiting confirmation and reply is CONFIRMED → mark summaryConfirmed
    // - If reply contains new requirements, forward to orchestrator
    const lower = textBody.toLowerCase()
    let handledLifecycle = false
    if (lower.includes('i approve') || lower.includes('confirmed') || lower === 'approved') {
      // Could be SOW approval or discovery confirmation — let journey handle
      try {
        const { loadDiscoveryState, saveDiscoveryState } = await import('@/lib/discovery')
        const disc = await loadDiscoveryState(clientRow.id)
        if (disc.completed && !disc.summaryConfirmed) {
          disc.summaryConfirmed = true
          await saveDiscoveryState(clientRow.id, disc)
          // Trigger SOW draft via journey's submitScope if not already
          try {
            const { submitScope } = await import('@/lib/journey')
            // Build scope text from discovery answers
            const scopeText = Object.entries(disc.answers)
              .map(([k, v]) => `${k}: ${v}`)
              .join('\n\n')
            if (scopeText.length > 20) {
              await submitScope(clientRow.id, scopeText).catch(() => null)
            }
          } catch {}
          handledLifecycle = true
        }
      } catch {}
    }

    if (!handledLifecycle) {
      // Route through same orchestrator for contextual reply (one-question-at-a-time)
      try {
        let convo = await db.chatConversation.findFirst({
          where: { anonId: `email:${fromEmail}`, status: 'OPEN' },
          orderBy: { createdAt: 'desc' },
        })
        if (!convo) {
          convo = await db.chatConversation.create({
            data: { anonId: `email:${fromEmail}`, visitorName: fromName || clientRow.name, visitorEmail: fromEmail, clientId: clientRow.id, status: 'OPEN' },
          })
        }
        const { handleCustomerMessage } = await import('@/lib/chat-orchestrator')
        const result = await handleCustomerMessage({
          channel: 'EMAIL',
          conversationId: convo.id,
          clientRowId: clientRow.id,
          clientId: clientRow.clientId,
          visitorBody: textBody,
          visitorName: fromName || clientRow.name,
          visitorEmail: fromEmail,
        })
        if (result.ok) {
          // Send reply via email (canonical channel)
          const { sendCommunication } = await import('@/lib/comms')
          // Build email with next-step footer (Requirement E)
          const emailBody = `${result.reply}\n\n—\nClient ID: ${clientRow.clientId} | Stage: ${clientRow.pipelineStage}\nReply to this email to continue.`
          const res = await sendCommunication({
            clientId: clientRow.id,
            channel: 'EMAIL',
            to: fromEmail,
            subject: `Re: ${subject || 'Your enquiry with Tech360'} — ${clientRow.clientId}`,
            body: emailBody,
            agentCode: result.wasAiGenerated ? 'CHAT-AI' : 'CHAT-FALLBACK',
          })
          if (!res.result.ok) {
            await logError({ source: 'WEBHOOK', code: `EMAIL_SEND_${res.result.status}`, message: res.result.error ?? 'Email send failed', clientId: clientRow.clientId }).catch(() => null)
          }
          const { recordOutbound } = await import('@/lib/conversation-state')
          await recordOutbound(clientRow.id, clientRow.clientId, result.reply, 'EMAIL').catch(() => null)
        }
      } catch (replyError) {
        await logError({ source: 'WEBHOOK', code: 'EMAIL_REPLY_FAILED', message: replyError instanceof Error ? replyError.message : String(replyError), workflow: 'EMAIL_REPLY' }).catch(() => null)
      }
    }

    await audit({ actor: 'webhook:EMAIL', action: 'INBOUND_EMAIL', clientId: clientRow.clientId, ip })
    await finishInboundWebhookEvent({ receiptId: claim.receiptId, claimToken: claim.claimToken, success: true, clientId: clientRow.id })
    return Response.json({ ok: true, matched: true, clientId: clientRow.clientId })
  } catch (error) {
    await finishInboundWebhookEvent({
      receiptId: claim.receiptId,
      claimToken: claim.claimToken,
      success: false,
      errorCode: error instanceof Error ? error.name : 'PROCESSING_FAILED',
    }).catch(() => false)
    await logError({ source: 'WEBHOOK', code: 'EMAIL_HOOK_FAILED', message: error instanceof Error ? error.message : 'unknown', workflow: 'EMAIL_IN' })
    return Response.json({ ok: false }, { status: 200 })
  }
}
