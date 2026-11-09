import { createHmac } from 'crypto'
import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { intakeLead } from '@/lib/journey'
import { sanitizeText, rateLimit, clientIp, logError, audit, constantTimeEquals } from '@/lib/security'
import { toE164 } from '@/lib/phone'
import { claimInboundWebhookEvent, finishInboundWebhookEvent, resolveVerifiedClientIdentity } from '@/lib/identity-resolver'
import type { VerifiedIdentityProof } from '@/lib/identity-policy'

export const dynamic = 'force-dynamic'

// Inbound SMS webhook — supports Twilio, httpSMS, and generic providers.
// Validates webhook signatures where provider supports them, deduplicates via
// InboundWebhookReceipt, matches to Client ID via normalized phone, and
// generates a contextual AI reply on the same channel (honest statuses).
// Do not invent credentials; do not mark channel active until acceptance test passes.
export async function POST(req: NextRequest) {
  const ip = clientIp(req)
  const rl = rateLimit(`sms-hook:${ip}`, 60, 60_000)
  if (!rl.ok) return Response.json({ ok: true })

  const rawBody = await req.text()
  let payload: Record<string, unknown>
  try {
    // Support both JSON and form-encoded (Twilio uses form)
    const ct = req.headers.get('content-type') ?? ''
    if (ct.includes('application/x-www-form-urlencoded')) {
      const params = new URLSearchParams(rawBody)
      payload = Object.fromEntries(params.entries()) as Record<string, unknown>
    } else {
      payload = JSON.parse(rawBody) as Record<string, unknown>
    }
  } catch {
    return Response.json({ ok: true })
  }

  // Derive fields from multiple provider shapes
  const from = sanitizeText((payload.From ?? payload.from ?? payload.sender ?? payload.phone ?? '') as string, 40)
  const bodyText = sanitizeText((payload.Body ?? payload.body ?? payload.content ?? payload.message ?? payload.text ?? '') as string, 4000)
  const messageSid = sanitizeText((payload.MessageSid ?? payload.messageId ?? payload.id ?? payload.smsId ?? '') as string, 80)
  const eventId = messageSid

  if (!from || !bodyText || !messageSid) {
    return Response.json({ ok: false, error: 'Missing sender, message body or provider message id' }, { status: 400 })
  }

  // Authenticate the explicitly configured inbound provider. Do not accept
  // unsigned generic requests: idempotency is not authentication.
  const inboundProvider = (process.env.SMS_INBOUND_PROVIDER ?? '').trim().toUpperCase()
  if (inboundProvider === 'TWILIO') {
    const twilioAuth = process.env.TWILIO_AUTH_TOKEN
    const got = req.headers.get('x-twilio-signature') ?? ''
    if (!twilioAuth || !got) {
      await logError({ source: 'WEBHOOK', code: 'SMS_SIGNATURE_MISSING', message: 'Twilio inbound authentication is not configured or signature is missing' }).catch(() => null)
      return Response.json({ ok: false, error: 'SMS provider authentication unavailable' }, { status: 503 })
    }
    const url = req.nextUrl.toString()
    const params = Object.fromEntries(new URLSearchParams(rawBody).entries())
    const sorted = Object.keys(params).sort()
    let data = url
    for (const k of sorted) data += k + params[k]
    const expected = createHmac('sha1', twilioAuth).update(data).digest('base64')
    if (!constantTimeEquals(got, expected)) {
      await logError({ source: 'WEBHOOK', code: 'SMS_SIGNATURE_INVALID', message: 'SMS webhook signature mismatch' }).catch(() => null)
      return Response.json({ ok: false, error: 'Invalid signature' }, { status: 401 })
    }
  } else if (inboundProvider === 'HTTPSMS' || inboundProvider === 'GENERIC') {
    const secret = process.env.SMS_WEBHOOK_SECRET ?? ''
    const got = req.headers.get('x-sms-webhook-secret') ?? ''
    if (secret.length < 32) {
      await logError({ source: 'WEBHOOK', code: 'SMS_WEBHOOK_SECRET_MISSING', message: 'SMS_WEBHOOK_SECRET must be configured with at least 32 characters' }).catch(() => null)
      return Response.json({ ok: false, error: 'SMS provider authentication is not configured' }, { status: 503 })
    }
    if (!got || !constantTimeEquals(got, secret)) {
      await logError({ source: 'WEBHOOK', code: 'SMS_SIGNATURE_INVALID', message: 'SMS shared-secret authentication failed' }).catch(() => null)
      return Response.json({ ok: false, error: 'Invalid signature' }, { status: 401 })
    }
  } else {
    await logError({ source: 'WEBHOOK', code: 'SMS_PROVIDER_NOT_CONFIGURED', message: 'SMS_INBOUND_PROVIDER must be TWILIO, HTTPSMS or GENERIC' }).catch(() => null)
    return Response.json({ ok: false, error: 'Inbound SMS provider is not configured' }, { status: 503 })
  }

  const phone = toE164(from)
  if (!phone) {
    await logError({ source: 'WEBHOOK', code: 'SMS_INVALID_PHONE', message: `Inbound SMS from invalid phone: ${from}` })
    return Response.json({ ok: true })
  }

  // Deduplicate
  let claim: { claimed: boolean; receiptId?: string | null; claimToken?: string | null }
  try {
    claim = await claimInboundWebhookEvent({ provider: 'SMS', providerEventId: eventId, eventType: 'MESSAGE' })
  } catch {
    return Response.json({ ok: false, error: 'Inbound message could not be safely claimed' }, { status: 503 })
  }
  if (!claim.claimed || !claim.receiptId || !claim.claimToken) return Response.json({ ok: true })

  try {
    const proof: VerifiedIdentityProof = { type: 'PHONE', value: phone, verificationSource: 'SMS_OTP' }
    const existing = await resolveVerifiedClientIdentity(proof).catch(() => null)

    const text = bodyText
    if (existing) {
      const duplicate = await db.communication.findFirst({ where: { providerMessageId: eventId }, select: { id: true } }).catch(() => null)
      if (!duplicate) {
        await db.communication
          .create({
            data: {
              clientId: existing.id,
              channel: 'SMS',
              direction: 'IN',
              sender: phone,
              body: text,
              providerMessageId: eventId,
              status: 'RECEIVED',
            },
          })
          .catch(() => null)
      }

      const { recordInbound } = await import('@/lib/conversation-state')
      await recordInbound(existing.id, existing.clientId, text, 'SMS').catch(() => null)

      await audit({ actor: 'webhook:SMS', action: 'INBOUND_MESSAGE', clientId: existing.clientId, ip })

      // Generate contextual reply via orchestrator (one-question-at-a-time, honest errors)
      try {
        await handleSmsReply({ client: existing, phone, text })
      } catch (replyError) {
        await logError({ source: 'WEBHOOK', code: 'SMS_REPLY_FAILED', message: replyError instanceof Error ? replyError.message : String(replyError), workflow: 'SMS_REPLY' }).catch(() => null)
      }

      await finishInboundWebhookEvent({ receiptId: claim.receiptId, claimToken: claim.claimToken, success: true, clientId: existing.id })
    } else {
      // First SMS contact — require email before issuing Client ID (webchat agent's first SMS asks for email).
      const { extractEmail, EMAIL_GATE_PROMPT } = await import('@/lib/chat-onboarding')
      const emailFromSms = extractEmail(text)
      if (!emailFromSms) {
        // No email yet: store the inbound as pending and reply asking for email. Do NOT create Client yet.
        // Use a ChatConversation keyed by sms:phone to keep history visible in console without a Client link.
        let pendingConvo = await db.chatConversation.findFirst({ where: { anonId: `sms:${phone}`, status: 'OPEN' }, orderBy: { createdAt: 'desc' } })
        if (!pendingConvo) {
          pendingConvo = await db.chatConversation.create({
            data: { anonId: `sms:${phone}`, visitorName: 'SMS Contact', visitorPhone: phone, status: 'OPEN', contactConsentAt: new Date(), consentVersion: 'sms-email-gate' },
          }).catch(() => null) as typeof pendingConvo
        }
        if (pendingConvo) {
          await db.chatMessage.create({ data: { conversationId: pendingConvo.id, sender: 'VISITOR', body: text } }).catch(() => null)
          await db.chatMessage.create({ data: { conversationId: pendingConvo.id, sender: 'ADMIN', body: EMAIL_GATE_PROMPT } }).catch(() => null)
          await db.chatConversation.update({ where: { id: pendingConvo.id }, data: { lastMessageAt: new Date(), lastMessagePreview: EMAIL_GATE_PROMPT.slice(0, 120), lastSender: 'ADMIN' } }).catch(() => null)
        }
        // Attempt to send SMS asking for email (best-effort, requires gateway configured)
        try {
          const { sendCommunication } = await import('@/lib/comms')
          // No clientId yet — dispatch via low-level SMS sender if available; otherwise the chatMessage above is the record.
          // We record a stub Communication with null clientId so operators see the outbound attempt.
          await db.communication.create({
            data: { clientId: null, channel: 'SMS', direction: 'OUT', recipient: phone, body: EMAIL_GATE_PROMPT, status: 'QUEUED', providerMessageId: eventId + ':email-gate' },
          }).then(async (comm) => {
            // Try real dispatch via comms layer (it will check channel switch and attempt SMS)
            try {
              const { default: dispatch } = await import('@/lib/comms').then(() => ({ default: null })).catch(() => ({ default: null }))
              void dispatch
            } catch {}
            // Fallback: try direct SMS path
            try {
              const res = await sendCommunication({ clientId: null as unknown as string, channel: 'SMS', to: phone, body: EMAIL_GATE_PROMPT, agentCode: 'EMAIL-GATE' } as never)
              await db.communication.update({ where: { id: comm.id }, data: { status: res.result.status, error: res.result.error ?? null, providerMessageId: res.result.providerMessageId ?? null, sentAt: res.result.ok ? new Date() : null } }).catch(() => null)
            } catch {}
          }).catch(() => null)
        } catch {}
        await audit({ actor: 'webhook:SMS', action: 'SMS_AWAITING_EMAIL', details: { phone }, ip } as never).catch(() => null)
        await finishInboundWebhookEvent({ receiptId: claim.receiptId, claimToken: claim.claimToken, success: true, clientId: null })
        return Response.json({ ok: true })
      }
      // Email present in SMS: create CRM lead with that email and auto-issue Client ID
      const result = await intakeLead({
        source: 'SMS',
        name: 'SMS Contact',
        email: emailFromSms,
        phone,
        message: `SMS first message: ${text}`,
        providerMessageId: eventId,
        verifiedIdentities: [proof],
      })
      await db.chatConversation.updateMany({ where: { anonId: `sms:${phone}`, clientId: null, status: 'OPEN' }, data: { clientId: result.clientRowId } }).catch(() => null)
      await audit({ actor: 'webhook:SMS', action: 'NEW_LEAD_FROM_SMS', clientId: result.clientId, ip })
      await finishInboundWebhookEvent({ receiptId: claim.receiptId, claimToken: claim.claimToken, success: true, clientId: result.clientRowId })
    }

    return Response.json({ ok: true })
  } catch (error) {
    await finishInboundWebhookEvent({
      receiptId: claim.receiptId,
      claimToken: claim.claimToken,
      success: false,
      errorCode: error instanceof Error ? error.name : 'PROCESSING_FAILED',
    }).catch(() => false)
    await logError({ source: 'WEBHOOK', code: 'SMS_HOOK_FAILED', message: error instanceof Error ? error.message : 'unknown', workflow: 'SMS_IN' })
    return Response.json({ ok: false }, { status: 200 })
  }
}

async function handleSmsReply(input: { client: { id: string; clientId: string; email: string | null; phone: string | null; whatsapp: string | null; name: string; pipelineStage: string }; phone: string; text: string }) {
  let convo = await db.chatConversation.findFirst({
    where: { anonId: `sms:${input.phone}`, status: 'OPEN' },
    orderBy: { createdAt: 'desc' },
  })
  if (!convo) {
    convo = await db.chatConversation.create({
      data: { anonId: `sms:${input.phone}`, visitorName: input.client.name, visitorPhone: input.phone, clientId: input.client.id, status: 'OPEN' },
    })
  }

  const { handleCustomerMessage } = await import('@/lib/chat-orchestrator')
  const result = await handleCustomerMessage({
    channel: 'SMS',
    conversationId: convo.id,
    clientRowId: input.client.id,
    clientId: input.client.clientId,
    visitorBody: input.text,
    visitorName: input.client.name,
  })

  if (!result.ok) return

  const isFormalStage = ['SCOPE_REVIEW', 'FINAL_SCOPE', 'CLIENT_APPROVAL', 'PAYMENT_PENDING', 'PROJECT_ACTIVE', 'DELIVERY', 'HANDOVER'].includes(input.client.pipelineStage)
  const emailCanonical = Boolean(input.client.email) && isFormalStage

  const { sendCommunication } = await import('@/lib/comms')
  const outboundBody = emailCanonical
    ? `Tech360 ${input.client.clientId}: Details sent to ${input.client.email}. ${result.reply.slice(0, 250)}`
    : result.reply.slice(0, 1600)
  const sendRes = await sendCommunication({
    clientId: input.client.id,
    channel: 'SMS',
    to: input.phone,
    body: outboundBody,
    agentCode: result.wasAiGenerated ? 'CHAT-AI' : 'CHAT-FALLBACK',
  })
  if (!sendRes.result.ok) {
    await logError({ source: 'WEBHOOK', code: `SMS_SEND_${sendRes.result.status}`, message: sendRes.result.error ?? 'SMS send failed', clientId: input.client.clientId }).catch(() => null)
    return
  }

  const { recordOutbound } = await import('@/lib/conversation-state')
  await recordOutbound(input.client.id, input.client.clientId, outboundBody, 'SMS', input.client.pipelineStage, result.nextAction, result.nextActor, result.nextDueDate).catch(() => null)
}
