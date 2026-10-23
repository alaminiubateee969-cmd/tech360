import { NextRequest } from 'next/server'
import { intakeLead } from '@/lib/journey'
import { db } from '@/lib/db'
import { sanitizeText, sanitizePhone, sanitizeEmail, rateLimit, clientIp, logError, audit, constantTimeEquals } from '@/lib/security'
import { claimInboundWebhookEvent, finishInboundWebhookEvent } from '@/lib/identity-resolver'
import { webhookBodyDedupKey } from '@/lib/mail/hostinger-inbound-policy'
import { readBoundedBody } from '@/lib/bounded-body'

export const dynamic = 'force-dynamic'

const MAX_BODY_BYTES = 64 * 1024
const PROVIDER = 'SOCIAL_HOOK'

// Inbound social messages (Facebook/Instagram/LinkedIn/X), posted by the n8n relay.
// Idempotency: each delivery is keyed by the provider message id when the relay
// supplies one (`messageId` or `providerMessageId`), otherwise by the SHA-256 of
// the raw body. A redelivery of the same message creates no second Client.
export async function POST(req: NextRequest) {
  const ip = clientIp(req)
  const rl = rateLimit(`social-hook:${ip}`, 60, 60_000)
  if (!rl.ok) return Response.json({ ok: true })

  // FAIL CLOSED — an unset secret previously allowed anonymous inbound social
  // events to create CRM records.
  const secret = process.env.SOCIAL_WEBHOOK_SECRET
  if (!secret) {
    return Response.json({ error: 'Webhook not configured' }, { status: 503 })
  }
  if (!constantTimeEquals(req.headers.get('x-webhook-secret'), secret)) {
    return Response.json({ error: 'Unauthorized webhook' }, { status: 401 })
  }

  const declaredLength = Number(req.headers.get('content-length') ?? 0)
  if (declaredLength > MAX_BODY_BYTES) return Response.json({ error: 'Payload too large' }, { status: 413 })
  const rawBody = await readBoundedBody(req, MAX_BODY_BYTES)
  if (rawBody === null) return Response.json({ error: 'Payload too large' }, { status: 413 })

  let raw: Record<string, unknown>
  try {
    const parsed: unknown = JSON.parse(rawBody)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return Response.json({ ok: true })
    raw = parsed as Record<string, unknown>
  } catch {
    return Response.json({ ok: true })
  }

  const channel = sanitizeText(raw.channel, 20).toUpperCase()
  if (!['FACEBOOK', 'INSTAGRAM', 'LINKEDIN', 'X'].includes(channel)) {
    return Response.json({ error: 'channel must be FACEBOOK|INSTAGRAM|LINKEDIN|X' }, { status: 400 })
  }
  const sender = sanitizeText(raw.sender, 200)
  const message = sanitizeText(raw.message, 4000)
  const email = sanitizeEmail(raw.email)
  const phone = sanitizePhone(raw.phone)

  const providerMessageId = sanitizeText(raw.messageId ?? raw.providerMessageId, 200)
  const providerEventId = `${channel}:${providerMessageId ? `msgid:${providerMessageId}` : webhookBodyDedupKey(rawBody)}`

  let claim: Awaited<ReturnType<typeof claimInboundWebhookEvent>>
  try {
    claim = await claimInboundWebhookEvent({ provider: PROVIDER, providerEventId, eventType: 'MESSAGE' })
  } catch {
    return Response.json({ ok: false, error: 'Delivery could not be recorded; the relay may retry.' }, { status: 503 })
  }
  if (!claim.claimed || !claim.receiptId || !claim.claimToken) {
    return Response.json({ ok: true, duplicate: true })
  }

  try {
    // A stored communication for this provider message means the intake already ran.
    const seen = await db.communication.findFirst({ where: { providerMessageId: providerEventId }, select: { id: true } })
    if (seen) {
      await finishInboundWebhookEvent({ receiptId: claim.receiptId, claimToken: claim.claimToken, success: true })
      return Response.json({ ok: true, duplicate: true })
    }

    // Social profile contact fields are provider-supplied claims, not a
    // verification proof. Do not match them against existing CRM records or
    // merge tenants automatically; a verified identity can be linked later by
    // an authorized admin with an audit reason.
    const result = await intakeLead({
      source: channel,
      name: sender || `${channel} Contact`,
      email: email || undefined,
      whatsapp: phone || undefined,
      message: `${channel} inbound message: ${message}`,
      providerMessageId: providerEventId,
    })
    await audit({ actor: `social:${channel}`, action: 'NEW_LEAD_FROM_SOCIAL', clientId: result.clientId, ip })
    await finishInboundWebhookEvent({ receiptId: claim.receiptId, claimToken: claim.claimToken, success: true, clientId: result.clientRowId })
    return Response.json({ ok: true })
  } catch (e) {
    await finishInboundWebhookEvent({ receiptId: claim.receiptId, claimToken: claim.claimToken, success: false, errorCode: 'SOCIAL_INTAKE_FAILED' }).catch(() => false)
    await logError({ source: 'WEBHOOK', code: 'SOCIAL_HOOK_FAILED', message: e instanceof Error ? e.message : 'unknown', workflow: 'SOCIAL_INBOX' })
    return Response.json({ ok: false }, { status: 200 })
  }
}
