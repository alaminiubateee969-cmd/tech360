import { createHmac } from 'crypto'
import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { intakeLead } from '@/lib/journey'
import { sanitizeText, rateLimit, clientIp, logError, audit, constantTimeEquals } from '@/lib/security'
import { toE164 } from '@/lib/phone'
import { claimInboundWebhookEvent, finishInboundWebhookEvent, resolveVerifiedClientIdentity } from '@/lib/identity-resolver'
import type { VerifiedIdentityProof } from '@/lib/identity-policy'
import { redactSensitiveCrmData } from '@/lib/sensitive-redaction'

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
  const bodyText = redactSensitiveCrmData(
    sanitizeText((payload.Body ?? payload.body ?? payload.content ?? payload.message ?? payload.text ?? '') as string, 4000),
  ).text
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
      // First contact from a phone number with no verified CRM identity.
      //
      // Root cause fixed here: this branch used to REFUSE to create a Client
      // until the sender texted an email address. An inbound SMS therefore
      // produced no CRM record and no Client ID, and the AI orchestrator was
      // never called — so a first-time SMS customer received (at best) a
      // static "share your email" template. If the outbound gateway was not
      // configured the lead was silently lost, which violates "do not lose
      // inbound messages".
      //
      // Now the handler creates (or reuses) a prospect keyed to the originating
      // number, issues a permanent Client ID, stores the inbound message in the
      // CRM timeline and answers on SMS through the same AI orchestrator used
      // by web chat. The number is stored as contact data only: it is NOT
      // written to ClientIdentity, because a provider signature proves the
      // sender, not ownership. Verified-identity merging is unchanged.
      const { recordInbound } = await import('@/lib/conversation-state')

      let linkedClient = await db.client.findFirst({
        where: {
          deletedAt: null,
          source: { in: ['SMS', 'WHATSAPP'] },
          OR: [{ phone }, { whatsapp: phone }],
        },
        orderBy: { createdAt: 'desc' },
        select: { id: true, clientId: true },
      }).catch(() => null)

      const priorConvo = await db.chatConversation.findFirst({
        where: { anonId: `sms:${phone}`, clientId: { not: null } },
        orderBy: { createdAt: 'desc' },
        select: { clientId: true },
      }).catch(() => null)
      if (!linkedClient && priorConvo?.clientId) {
        linkedClient = await db.client.findUnique({
          where: { id: priorConvo.clientId },
          select: { id: true, clientId: true, deletedAt: true },
        }).then((row) => (row && !row.deletedAt ? { id: row.id, clientId: row.clientId } : null)).catch(() => null)
      }

      if (!linkedClient) {
        const result = await intakeLead({
          source: 'SMS',
          name: 'SMS Contact',
          phone,
          preferredContact: 'SMS',
          message: `SMS first message: ${text}`,
          providerMessageId: eventId,
          suppressWelcome: true,
        })
        linkedClient = { id: result.clientRowId, clientId: result.clientId }
      }

      await db.chatConversation.updateMany({
        where: { anonId: `sms:${phone}`, clientId: null },
        data: { clientId: linkedClient.id },
      }).catch(() => null)

      await recordInbound(linkedClient.id, linkedClient.clientId, text, 'SMS').catch(() => null)
      await audit({ actor: 'webhook:SMS', action: 'NEW_LEAD_FROM_SMS', clientId: linkedClient.clientId, ip })

      const full = await db.client.findUnique({ where: { id: linkedClient.id } })
      if (full) {
        try {
          await handleSmsReply({ client: full, phone, text })
        } catch (replyError) {
          await logError({
            source: 'WEBHOOK',
            code: 'SMS_REPLY_FAILED',
            message: replyError instanceof Error ? replyError.message : String(replyError),
            clientId: linkedClient.clientId,
            workflow: 'SMS_REPLY',
          }).catch(() => null)
        }
      }
      await finishInboundWebhookEvent({
        receiptId: claim.receiptId,
        claimToken: claim.claimToken,
        success: true,
        clientId: linkedClient.id,
      })
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
