import { NextRequest } from 'next/server'
import { clientIp, rateLimit, logError } from '@/lib/security'
import { claimInboundWebhookEvent, finishInboundWebhookEvent } from '@/lib/identity-resolver'
import {
  classifyWebhookDelivery,
  verifyHostingerWebhookAuth,
  webhookBodyDedupKey,
} from '@/lib/mail/hostinger-inbound-policy'
import { syncHostingerInbox } from '@/lib/mail/hostinger-inbound'
import { HOSTINGER_MAIL_ENV } from '@/lib/mail/hostinger-config'
import { readBoundedBody } from '@/lib/bounded-body'

export const dynamic = 'force-dynamic'

// Hostinger Mail API webhook receiver.
//
// URL to register (after the secret is set in the environment):
//   https://bdtech360.com/api/webhooks/hostinger-mail
// Authentication: "Authorization: Bearer <HOSTINGER_MAIL_WEBHOOK_SECRET>".
// Unauthenticated or unconfigured requests are rejected before any body is parsed
// for business use. The response never echoes the payload or any secret.
//
// A delivery triggers a bounded, checkpointed inbox sync. Payload fields are not
// trusted to create customers. Identical redeliveries are deduplicated by the
// SHA-256 of the raw body in InboundWebhookReceipt.

const MAX_BODY_BYTES = 64 * 1024
const PROVIDER = 'HOSTMAIL'

function json(body: Record<string, unknown>, status = 200): Response {
  return Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } })
}

export async function POST(req: NextRequest) {
  const ip = clientIp(req)
  const rl = rateLimit(`hostinger-mail-hook:${ip}`, 120, 60_000)
  if (!rl.ok) return json({ ok: false, error: 'Too many requests.' }, 429)

  const secret = process.env[HOSTINGER_MAIL_ENV.webhookSecret] ?? null
  const auth = verifyHostingerWebhookAuth({ authorization: req.headers.get('authorization'), secret })
  if (!auth.ok) {
    if (auth.reason === 'NOT_CONFIGURED') return json({ ok: false, error: 'Hostinger Mail webhook is not configured.' }, 503)
    return json({ ok: false, error: 'Invalid webhook authentication.' }, 401)
  }

  const declaredLength = Number(req.headers.get('content-length') ?? 0)
  if (declaredLength > MAX_BODY_BYTES) return json({ ok: false, error: 'Payload too large.' }, 413)
  // Read at most MAX_BODY_BYTES. A chunked request with no Content-Length must not
  // be buffered in full before the size check.
  const rawBody = await readBoundedBody(req, MAX_BODY_BYTES)
  if (rawBody === null) return json({ ok: false, error: 'Payload too large.' }, 413)

  let payload: unknown
  try {
    payload = JSON.parse(rawBody)
  } catch {
    return json({ ok: false, error: 'Invalid JSON payload.' }, 400)
  }
  const decision = classifyWebhookDelivery(payload)
  if (decision.kind === 'INVALID') return json({ ok: false, error: decision.reason }, 400)

  let claim: Awaited<ReturnType<typeof claimInboundWebhookEvent>>
  try {
    claim = await claimInboundWebhookEvent({ provider: PROVIDER, providerEventId: webhookBodyDedupKey(rawBody), eventType: 'WEBHOOK' })
  } catch {
    return json({ ok: false, error: 'Delivery could not be recorded; Hostinger may retry.' }, 503)
  }
  if (!claim.claimed || !claim.receiptId || !claim.claimToken) {
    return json({ ok: true, duplicate: true })
  }

  if (decision.kind === 'IGNORE') {
    await finishInboundWebhookEvent({ receiptId: claim.receiptId, claimToken: claim.claimToken, success: true })
    return json({ ok: true, ignored: true, eventType: decision.eventType })
  }

  try {
    const summary = await syncHostingerInbox({ maxPages: 2, maxMessages: 25 })
    const success = summary.stopped !== 'ERROR' && summary.stopped !== 'NOT_CONFIGURED'
    await finishInboundWebhookEvent({
      receiptId: claim.receiptId,
      claimToken: claim.claimToken,
      success,
      errorCode: success ? undefined : 'SYNC_INCOMPLETE',
    })
    return json({ ok: true, sync: { stopped: summary.stopped, imported: summary.imported, duplicates: summary.duplicates } })
  } catch {
    await finishInboundWebhookEvent({ receiptId: claim.receiptId, claimToken: claim.claimToken, success: false, errorCode: 'SYNC_EXCEPTION' }).catch(() => false)
    await logError({ source: 'WEBHOOK', code: 'HOSTINGER_MAIL_SYNC_FAILED', message: 'Hostinger inbox sync failed after a webhook delivery; the checkpoint keeps the message for the next run.', workflow: 'HOSTINGER_MAIL_INBOUND' }).catch(() => null)
    // Acknowledge: the receipt records the failure and the next sync resumes from the checkpoint.
    return json({ ok: true, sync: { stopped: 'ERROR' } })
  }
}
