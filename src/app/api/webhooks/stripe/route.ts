import { db } from '@/lib/db'
import { verifyPayment } from '@/lib/journey'
import { createNotification } from '@/lib/notify'
import { audit } from '@/lib/security'
import { evaluateStripePayment, verifyStripeSignature } from '@/lib/commerce-policy'

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

  const settlement = evaluateStripePayment({
    currentStatus: payment.status,
    expectedAmount: payment.amount,
    expectedCurrency: payment.currency,
    receivedMinor: amountTotal,
    receivedCurrency: currency,
  })

  // Duplicate-processing guard (idempotency for Stripe retries)
  if (settlement.action === 'DUPLICATE') {
    return Response.json({ received: true, duplicate: true, paymentId: payment.id })
  }

  // Amount + currency verification against the platform record
  if (settlement.action === 'REJECT_AMOUNT') {
    const expectedMinor = settlement.expectedMinor
    await db.payment
      .update({ where: { id: payment.id }, data: { status: 'FAILED', notes: `${payment.notes ?? ''}\nWebhook amount mismatch: expected ${expectedMinor}, received ${amountTotal} minor units — REJECTED.` } })
      .catch(() => null)
    await audit({ actor: 'system:stripe-webhook', action: 'PAYMENT_AMOUNT_MISMATCH', details: { paymentId: payment.id, expectedMinor, receivedMinor: amountTotal, sessionId } })
    return Response.json({ error: `Amount mismatch: expected ${expectedMinor}, received ${amountTotal}` }, { status: 400 })
  }
  if (settlement.action === 'REJECT_CURRENCY') {
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
