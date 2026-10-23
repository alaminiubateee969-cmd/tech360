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
  const eventId = messageSid || `sms:${from}:${Date.now()}:${bodyText.slice(0, 20)}`

  if (!from || !bodyText) {
    // Still 200 to provider — we just cannot process
    return Response.json({ ok: true })
  }

  // Twilio signature validation (if configured)
  const twilioAuth = process.env.TWILIO_AUTH_TOKEN
  if (twilioAuth && req.headers.get('x-twilio-signature')) {
    const url = req.nextUrl.toString()
    const params = Object.fromEntries(new URLSearchParams(rawBody).entries())
    // Twilio computes HMAC-SHA1 over url + sorted params
    const sorted = Object.keys(params).sort()
    let data = url
    for (const k of sorted) data += k + params[k]
    const expected = createHmac('sha1', twilioAuth).update(data).digest('base64')
    const got = req.headers.get('x-twilio-signature') ?? ''
    if (!constantTimeEquals(got, expected)) {
      await logError({ source: 'WEBHOOK', code: 'SMS_SIGNATURE_INVALID', message: 'SMS webhook signature mismatch' })
      return Response.json({ ok: false, error: 'Invalid signature' }, { status: 401 })
    }
  }

  // httpSMS signature (optional, if provider supports)
  // Generic providers without signature proceed but remain idempotency-safe via claim

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
    return Response.json({ ok: true })
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
      // First SMS contact — create CRM lead
      const result = await intakeLead({
        source: 'SMS',
        name: 'SMS Contact',
        phone,
        message: `SMS first message: ${text}`,
        providerMessageId: eventId,
        verifiedIdentities: [proof],
      })
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

  if (emailCanonical) {
    const { sendCommunication } = await import('@/lib/comms')
    await sendCommunication({
      clientId: input.client.id,
      channel: 'SMS',
      to: input.phone,
      body: `Tech360 ${input.client.clientId}: Details sent to ${input.client.email}. ${result.reply.slice(0, 250)}`,
      agentCode: 'CHAT-AI',
    })
  } else {
    const { sendCommunication } = await import('@/lib/comms')
    const res = await sendCommunication({
      clientId: input.client.id,
      channel: 'SMS',
      to: input.phone,
      body: result.reply.slice(0, 1600),
      agentCode: result.wasAiGenerated ? 'CHAT-AI' : 'CHAT-FALLBACK',
    })
    if (!res.result.ok) {
      await logError({ source: 'WEBHOOK', code: `SMS_SEND_${res.result.status}`, message: res.result.error ?? 'SMS send failed', clientId: input.client.clientId }).catch(() => null)
    }
  }

  const { recordOutbound } = await import('@/lib/conversation-state')
  await recordOutbound(input.client.id, input.client.clientId, result.reply, 'SMS').catch(() => null)
}
