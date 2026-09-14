import { db } from '@/lib/db'
import { verifyPayment } from '@/lib/journey'
import { createNotification } from '@/lib/notify'
import { audit } from '@/lib/security'

export const dynamic = 'force-dynamic'

// ============================================================
// STRIPE WEBHOOK — the ONLY path that settles a Stripe payment.
//
// Security (all server-side, browser never trusted):
//  1. HMAC-SHA256 signature verification (Stripe-Signature v1:
//     signed payload = `${timestamp}.${rawBody}`) against
//     STRIPE_WEBHOOK_SECRET — invalid/missing → 400, no side effects.
//  2. Replay window: timestamps older than 5 minutes → 400.
//  3. Duplicate processing guard: payment already PAID → 200
//     idempotent no-op (Stripe retries webhooks).
//  4. Amount + currency verification against the pending Payment
//     record created at checkout — mismatch → flagged + 400.
//  5. Settlement ONLY on `checkout.session.completed`.
// The browser success URL is never evidence of payment.
// ============================================================

const TOLERANCE_SECONDS = 300

async function verifyStripeSignature(rawBody: string, header: string | null, secret: string): Promise<{ ok: true; timestamp: number } | { ok: false; error: string }> {
  if (!header) return { ok: false, error: 'Missing Stripe-Signature header' }
  const parts = header.split(',').reduce<Record<string, string[]>>((acc, part) => {
    const [k, v] = part.split('=', 2)
    if (k && v) (acc[k.trim()] ??= []).push(v.trim())
    return acc
  }, {})
  const timestamp = Number(parts.t?.[0])
  if (!timestamp || !Number.isFinite(timestamp)) return { ok: false, error: 'Invalid timestamp in signature' }
  const signatures = parts.v1 ?? []
  if (signatures.length === 0) return { ok: false, error: 'Missing v1 signature' }

  const age = Math.abs(Math.floor(Date.now() / 1000) - timestamp)
  if (age > TOLERANCE_SECONDS) return { ok: false, error: `Signature timestamp outside ${TOLERANCE_SECONDS}s tolerance (age ${age}s)` }

  const signedPayload = `${timestamp}.${rawBody}`
  const subtle = globalThis.crypto?.subtle ?? (await import('node:crypto')).webcrypto.subtle
  const key = await subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const mac = await subtle.sign('HMAC', key, new TextEncoder().encode(signedPayload))
  const expected = Array.from(new Uint8Array(mac))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')

  // constant-time-ish compare over candidates
  let match = false
  for (const sig of signatures) {
    if (sig.length === expected.length) {
      let diff = 0
      for (let i = 0; i < expected.length; i++) diff |= sig.charCodeAt(i) ^ expected.charCodeAt(i)
      if (diff === 0) match = true
    }
  }
  if (!match) return { ok: false, error: 'Signature verification failed' }
  return { ok: true, timestamp }
}

export async function POST(req: Request) {
  const rawBody = await req.text()
  const secret = process.env.STRIPE_WEBHOOK_SECRET?.trim()

  if (!secret) {
    // honest: no secret configured → we cannot verify anything, so we
    // refuse to act (never trust an unverified webhook)
    await audit({ actor: 'system:stripe-webhook', action: 'WEBHOOK_REJECTED', details: { reason: 'STRIPE_WEBHOOK_SECRET not configured — verification impossible' } }).catch(() => null)
    return Response.json({ error: 'Webhook secret not configured — refusing unverified event' }, { status: 503 })
  }

  const verified = await verifyStripeSignature(rawBody, req.headers.get('stripe-signature'), secret)
  if (!verified.ok) {
    await audit({ actor: 'system:stripe-webhook', action: 'WEBHOOK_REJECTED', details: { reason: verified.error } }).catch(() => null)
    return Response.json({ error: `Webhook verification failed: ${verified.error}` }, { status: 400 })
  }

  let event: { type?: string; data?: { object?: Record<string, unknown> } }
  try {
    event = JSON.parse(rawBody) as typeof event
  } catch {
    return Response.json({ error: 'Invalid JSON payload' }, { status: 400 })
  }

  if (event.type !== 'checkout.session.completed') {
    return Response.json({ received: true, ignored: event.type ?? 'unknown' })
  }

  const session = event.data?.object ?? {}
  const sessionId = String(session.id ?? '')
  const paymentStatus = String(session.payment_status ?? '')
  const amountTotal = Number(session.amount_total ?? 0) // minor units (cents)
  const currency = String(session.currency ?? '').toUpperCase()
  const metadata = (session.metadata ?? {}) as { invoice_number?: string; client_id?: string }

  if (!sessionId) return Response.json({ error: 'Session id missing' }, { status: 400 })
  if (paymentStatus !== 'paid') {
    return Response.json({ received: true, ignored: `payment_status=${paymentStatus}` })
  }

  // Find the pending payment created at checkout (session id = transactionId).
  const payment = await db.payment.findFirst({ where: { transactionId: sessionId, method: 'STRIPE' } })
  if (!payment) {
    await audit({ actor: 'system:stripe-webhook', action: 'WEBHOOK_REJECTED', details: { reason: `No matching checkout session ${sessionId}`, metadata } }).catch(() => null)
    return Response.json({ error: 'No matching checkout session' }, { status: 404 })
  }

  // Duplicate-processing guard (idempotency for Stripe retries)
  if (payment.status === 'PAID') {
    return Response.json({ received: true, duplicate: true, paymentId: payment.id })
  }

  // Amount + currency verification against the platform record
  const expectedMinor = Math.round(payment.amount * 100)
  if (amountTotal !== expectedMinor) {
    await db.payment
      .update({ where: { id: payment.id }, data: { status: 'FAILED', notes: `${payment.notes ?? ''}\nWebhook amount mismatch: expected ${expectedMinor}, received ${amountTotal} minor units — REJECTED.` } })
      .catch(() => null)
    await audit({ actor: 'system:stripe-webhook', action: 'PAYMENT_AMOUNT_MISMATCH', details: { paymentId: payment.id, expectedMinor, receivedMinor: amountTotal, sessionId } })
    return Response.json({ error: `Amount mismatch: expected ${expectedMinor}, received ${amountTotal}` }, { status: 400 })
  }
  if (currency && currency !== payment.currency.toUpperCase()) {
    await db.payment
      .update({ where: { id: payment.id }, data: { status: 'FAILED', notes: `${payment.notes ?? ''}\nWebhook currency mismatch: expected ${payment.currency}, received ${currency} — REJECTED.` } })
      .catch(() => null)
    await audit({ actor: 'system:stripe-webhook', action: 'PAYMENT_CURRENCY_MISMATCH', details: { paymentId: payment.id, expected: payment.currency, received: currency, sessionId } })
    return Response.json({ error: `Currency mismatch: expected ${payment.currency}, received ${currency}` }, { status: 400 })
  }

  // ---- Settlement: the one true verify pipeline (marks PAID,
  // activates the project on first payment, updates invoices,
  // issues confirmation + receipt trail, audits). ----
  try {
    await verifyPayment(payment.id, 'system:stripe-webhook')
  } catch (e) {
    const message = e instanceof Error ? e.message : 'UNKNOWN'
    await audit({ actor: 'system:stripe-webhook', action: 'WEBHOOK_SETTLEMENT_FAILED', details: { paymentId: payment.id, error: message } }).catch(() => null)
    return Response.json({ error: `Settlement failed: ${message}` }, { status: 500 })
  }

  await db.payment
    .update({
      where: { id: payment.id },
      data: { notes: `${payment.notes ?? ''}\nSettled by verified Stripe webhook at ${new Date().toISOString()} (signature OK, amount + currency verified).` },
    })
    .catch(() => null)

  await createNotification({
    type: 'PAYMENT',
    severity: 'INFO',
    title: 'Stripe payment settled',
    body: `Invoice ${metadata.invoice_number ?? payment.invoiceId ?? '—'} for ${metadata.client_id ?? payment.clientId} — ${payment.amount} ${payment.currency} settled by VERIFIED webhook (session ${sessionId}). Receipt path: verifyPayment pipeline.`,
    clientId: metadata.client_id,
  }).catch(() => null)

  return Response.json({ received: true, settled: true, paymentId: payment.id })
}
