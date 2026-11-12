import { createHmac } from 'crypto'
import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { intakeLead } from '@/lib/journey'
import { sanitizeText, rateLimit, clientIp, logError, audit, constantTimeEquals } from '@/lib/security'
import { verifyWhatsAppHandshake } from '@/lib/whatsapp-webhook'
import { toE164 } from '@/lib/phone'
import { claimInboundWebhookEvent, finishInboundWebhookEvent, resolveVerifiedClientIdentity } from '@/lib/identity-resolver'
import type { VerifiedIdentityProof } from '@/lib/identity-policy'
import { readBoundedBody } from '@/lib/bounded-body'

export const dynamic = 'force-dynamic'

// WhatsApp Cloud API webhook verification (GET)
//
// The subscription handshake compares the shared verify token in constant
// time (see @/lib/whatsapp-webhook): `===` on a secret leaks its length and
// matching prefix through response timing. An unset WHATSAPP_VERIFY_TOKEN
// fails closed.
export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const result = verifyWhatsAppHandshake({
    mode: url.searchParams.get('hub.mode'),
    token: url.searchParams.get('hub.verify_token'),
    challenge: url.searchParams.get('hub.challenge'),
    expected: process.env.WHATSAPP_VERIFY_TOKEN,
  })
  if (!result.ok) return new Response('Forbidden', { status: 403 })
  return new Response(result.challenge, { status: 200 })
}

type WaMessage = {
  from?: string
  id?: string
  timestamp?: string
  text?: { body?: string }
  type?: string
}

// Inbound WhatsApp messages → CRM (linked to Client ID)
export async function POST(req: NextRequest) {
  const ip = clientIp(req)
  const rl = rateLimit(`wa-hook:${ip}`, 60, 60_000)
  if (!rl.ok) return Response.json({ ok: false, error: 'Rate limited' }, { status: 429 })

  // HMAC is calculated over the exact raw body; never trust unsigned data.
  const rawBody = await readBoundedBody(req, 1024 * 1024)
  if (rawBody === null) return Response.json({ ok: false, error: 'Payload too large' }, { status: 413 })
  const appSecret = process.env.WHATSAPP_APP_SECRET
  if (!appSecret) {
    await logError({ source: 'WEBHOOK', code: 'WA_APP_SECRET_MISSING', message: 'WhatsApp webhook rejected: WHATSAPP_APP_SECRET is not configured' }).catch(() => null)
    return Response.json({ ok: false, error: 'Webhook not configured' }, { status: 503 })
  }
  const expected = 'sha256=' + createHmac('sha256', appSecret).update(rawBody).digest('hex')
  if (!constantTimeEquals(req.headers.get('x-hub-signature-256'), expected)) {
    return Response.json({ ok: false, error: 'Invalid signature' }, { status: 401 })
  }

  let payload: unknown
  try { payload = JSON.parse(rawBody) } catch { return Response.json({ ok: false, error: 'Invalid JSON' }, { status: 400 }) }
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return Response.json({ ok: false, error: 'Invalid payload' }, { status: 400 })
  const entries = (payload as { entry?: unknown }).entry
  if (!Array.isArray(entries)) return Response.json({ ok: false, error: 'Invalid payload' }, { status: 400 })

  let failed = false
  for (const entry of entries) {
    if (!entry || typeof entry !== 'object' || !Array.isArray(entry.changes)) continue
    for (const change of entry.changes) {
      if (!change || typeof change !== 'object' || !change.value || typeof change.value !== 'object' || Array.isArray(change.value)) continue
      const value = change.value as Record<string, unknown>
      const messages: WaMessage[] = Array.isArray(value.messages) ? value.messages.filter((m): m is WaMessage => !!m && typeof m === 'object' && !Array.isArray(m)) : []
      const contacts: Array<{ profile?: { name?: string }; wa_id?: string }> = Array.isArray(value.contacts) ? value.contacts.filter((c) => !!c && typeof c === 'object' && !Array.isArray(c)) : []
      const statuses: Array<{ id?: string; status?: string }> = Array.isArray(value.statuses) ? value.statuses.filter((s) => !!s && typeof s === 'object' && !Array.isArray(s)) : []

      for (const st of statuses) {
        if (typeof st.id !== 'string' || !st.id) continue
        try {
          await db.communication.updateMany({ where: { providerMessageId: st.id }, data: { status: typeof st.status === 'string' ? st.status.toUpperCase() : 'SENT' } })
        } catch { failed = true }
      }

      for (const m of messages) {
        // Invalid records are poison messages, not retryable work. Provider IDs
        // are essential for a durable receipt; don't create records without one.
        if (typeof m.id !== 'string' || !m.id.trim() || m.id.length > 175 || typeof m.from !== 'string' || !toE164(m.from)) continue
        try {
          const claim = await claimInboundWebhookEvent({ provider: 'WHATSAPP', providerEventId: m.id, eventType: 'MESSAGE' })
          if (!claim.claimed || !claim.receiptId || !claim.claimToken) {
            // Do not acknowledge an in-flight or missing receipt as complete: a
            // crashed worker needs provider redelivery after its lease expires.
            const receipt = claim.receiptId ? await db.inboundWebhookReceipt.findUnique({ where: { id: claim.receiptId }, select: { status: true } }) : null
            if (receipt?.status !== 'PROCESSED') failed = true
            continue
          }
          try {
            const phone = toE164(m.from)!
            const prior = await db.communication.findFirst({ where: { providerMessageId: m.id, channel: 'WHATSAPP', direction: 'IN' }, select: { clientId: true } })
            if (prior) {
              // A crash after persistence may have occurred after an external
              // send. Never resend blindly: retain the message and flag review.
              await logError({ source: 'WEBHOOK', code: 'WA_REPLAY_REVIEW', message: 'Inbound WhatsApp message already stored; possible partial processing needs operator review. No reply was resent.', clientId: prior.clientId ?? undefined, workflow: 'WHATSAPP_IN' })
              if (!(await finishInboundWebhookEvent({ receiptId: claim.receiptId, claimToken: claim.claimToken, success: true, clientId: prior.clientId }))) failed = true
              continue
            }
            const contact = contacts.find((item) => item.wa_id === m.from)
            const name = sanitizeText(contact?.profile?.name ?? '', 200)
            const { redactSensitiveCrmData } = await import('@/lib/sensitive-redaction')
            const text = redactSensitiveCrmData(sanitizeText(m.text?.body ?? `[${m.type ?? 'media'} message]`, 4000)).text
            const proof: VerifiedIdentityProof = { type: 'PHONE', value: phone, verificationSource: 'WHATSAPP_SIGNATURE' }
            const existing = await resolveVerifiedClientIdentity(proof)
            let clientRowId: string
            if (existing) {
              await db.communication.create({ data: { clientId: existing.id, channel: 'WHATSAPP', direction: 'IN', sender: phone, body: text, providerMessageId: m.id, status: 'RECEIVED', messageType: m.type === 'text' ? 'TEXT' : 'MEDIA' } })
              clientRowId = existing.id
              if (existing.name === 'Unknown Contact' && name) await db.client.update({ where: { id: existing.id }, data: { name } })
              const { recordInbound } = await import('@/lib/conversation-state')
              await recordInbound(existing.id, existing.clientId, text, 'WHATSAPP').catch(() => null)
              await audit({ actor: 'webhook:WHATSAPP', action: 'INBOUND_MESSAGE', clientId: existing.clientId, ip })
              try {
                await handleWhatsAppReply({ client: existing, phone, text, providerMessageId: m.id })
              } catch {
                await logError({ source: 'WEBHOOK', code: 'WA_REPLY_FAILED', message: 'WhatsApp reply failed or has an uncertain outcome; review before sending again.', clientId: existing.clientId, workflow: 'WHATSAPP_REPLY' }).catch(() => null)
              }
            } else {
              const result = await intakeLead({ source: 'WHATSAPP', name: name || 'WhatsApp Contact', whatsapp: phone, message: `WhatsApp first message: ${text}`, providerMessageId: m.id, verifiedIdentities: [proof] })
              clientRowId = result.clientRowId
              await audit({ actor: 'webhook:WHATSAPP', action: 'NEW_LEAD_FROM_WHATSAPP', clientId: result.clientId, ip })
            }
            if (!(await finishInboundWebhookEvent({ receiptId: claim.receiptId, claimToken: claim.claimToken, success: true, clientId: clientRowId }))) failed = true
          } catch (error) {
            failed = true
            await finishInboundWebhookEvent({ receiptId: claim.receiptId, claimToken: claim.claimToken, success: false, errorCode: error instanceof Error ? error.name : 'PROCESSING_FAILED' }).catch(() => false)
          }
        } catch { failed = true }
      }
    }
  }
  if (failed) {
    await logError({ source: 'WEBHOOK', code: 'WA_HOOK_FAILED', message: 'One or more WhatsApp events could not be processed; provider redelivery is requested.', workflow: 'WHATSAPP_IN' }).catch(() => null)
    return Response.json({ ok: false, error: 'Some events could not be processed.' }, { status: 503 })
  }
  return Response.json({ ok: true })
}

// --- Orchestrated reply (uses same one-question-at-a-time engine as web chat) ---
async function handleWhatsAppReply(input: { client: { id: string; clientId: string; email: string | null; whatsapp: string | null; name: string; pipelineStage: string }; phone: string; text: string; providerMessageId: string }) {
  // Find or create a ChatConversation for this WhatsApp client so history is unified
  let convo = await db.chatConversation.findFirst({
    where: { anonId: `wa:${input.phone}`, status: 'OPEN' },
    orderBy: { createdAt: 'desc' },
  })
  if (!convo) {
    convo = await db.chatConversation.create({
      data: { anonId: `wa:${input.phone}`, visitorName: input.client.name, visitorPhone: input.phone, clientId: input.client.id, status: 'OPEN' },
    })
  }
  // Use chat orchestrator for contextual AI response (honest errors, one Q at a time)
  const { handleCustomerMessage } = await import('@/lib/chat-orchestrator')
  const result = await handleCustomerMessage({
    channel: 'WHATSAPP',
    conversationId: convo.id,
    clientRowId: input.client.id,
    clientId: input.client.clientId,
    visitorBody: input.text,
    visitorName: input.client.name,
    visitorEmail: input.client.email,
  })

  if (!result.ok) return // orchestrator persisted honest error as SYSTEM message; we do not re-send

  // Route outbound: if email is canonical for formal stage, send concise WhatsApp notification;
  // otherwise send full reply on WhatsApp (same channel as inbound)
  const isFormalStage = ['SCOPE_REVIEW', 'FINAL_SCOPE', 'CLIENT_APPROVAL', 'PAYMENT_PENDING', 'PROJECT_ACTIVE', 'DELIVERY', 'HANDOVER'].includes(input.client.pipelineStage)
  const emailCanonical = Boolean(input.client.email) && isFormalStage

  const { sendCommunication } = await import('@/lib/comms')
  const outboundBody = emailCanonical
    ? `Tech360 · Ref ${input.client.clientId}\nWe sent details to your email (${input.client.email}). Please check it and reply there when a detailed answer is needed.\n\n${result.reply.slice(0, 500)}`
    : result.reply.slice(0, 4000)
  const sendRes = await sendCommunication({
    clientId: input.client.id,
    channel: 'WHATSAPP',
    to: input.phone,
    body: outboundBody,
    agentCode: result.wasAiGenerated ? 'CHAT-AI' : 'CHAT-FALLBACK',
  })
  if (!sendRes.result.ok) {
    const { logError: le } = await import('@/lib/security')
    await le({
      source: 'WEBHOOK',
      code: `WA_SEND_${sendRes.result.status}`,
      message: `Outbound WhatsApp ${sendRes.result.status}: ${sendRes.result.error ?? 'unknown'}`,
      clientId: input.client.clientId,
    }).catch(() => null)
    return
  }

  const { recordOutbound } = await import('@/lib/conversation-state')
  await recordOutbound(input.client.id, input.client.clientId, outboundBody, 'WHATSAPP', input.client.pipelineStage, result.nextAction, result.nextActor, result.nextDueDate).catch(() => null)
}

