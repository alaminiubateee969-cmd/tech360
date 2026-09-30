export const STRIPE_SIGNATURE_TOLERANCE_SECONDS = 300

export type HandoverGateInput = {
  status: string
  totalAmount: number
  paidAmount: number
  expiryAt?: Date | null
  now?: Date
}

export type GateDecision = { allowed: true } | { allowed: false; code: 'NOT_RELEASED' | 'PAYMENT_INCOMPLETE' | 'EXPIRED' }

/** Pure policy used by source-package delivery and its regression tests. */
export function evaluateHandoverGate(input: HandoverGateInput): GateDecision {
  if (!['RELEASED', 'DOWNLOADED', 'CONFIRMED'].includes(input.status)) {
    return { allowed: false, code: 'NOT_RELEASED' }
  }
  if (input.totalAmount > 0 && input.paidAmount < input.totalAmount) {
    return { allowed: false, code: 'PAYMENT_INCOMPLETE' }
  }
  if (input.expiryAt && input.expiryAt < (input.now ?? new Date())) {
    return { allowed: false, code: 'EXPIRED' }
  }
  return { allowed: true }
}

export type StripePaymentMatchInput = {
  currentStatus: string
  expectedAmount: number
  expectedCurrency: string
  receivedMinor: number
  receivedCurrency: string
}

export type StripePaymentDecision =
  | { action: 'DUPLICATE' }
  | { action: 'REJECT_AMOUNT'; expectedMinor: number }
  | { action: 'REJECT_CURRENCY' }
  | { action: 'SETTLE' }

/** Pure settlement decision. It never treats a browser redirect as payment evidence. */
export function evaluateStripePayment(input: StripePaymentMatchInput): StripePaymentDecision {
  if (input.currentStatus === 'PAID') return { action: 'DUPLICATE' }
  const expectedMinor = Math.round(input.expectedAmount * 100)
  if (input.receivedMinor !== expectedMinor) return { action: 'REJECT_AMOUNT', expectedMinor }
  if (input.receivedCurrency && input.receivedCurrency.toUpperCase() !== input.expectedCurrency.toUpperCase()) {
    return { action: 'REJECT_CURRENCY' }
  }
  return { action: 'SETTLE' }
}

export async function verifyStripeSignature(
  rawBody: string,
  header: string | null,
  secret: string,
  nowSeconds = Math.floor(Date.now() / 1000),
): Promise<{ ok: true; timestamp: number } | { ok: false; error: string }> {
  if (!header) return { ok: false, error: 'Missing Stripe-Signature header' }
  const parts = header.split(',').reduce<Record<string, string[]>>((acc, part) => {
    const [key, value] = part.split('=', 2)
    if (key && value) (acc[key.trim()] ??= []).push(value.trim())
    return acc
  }, {})
  const timestamp = Number(parts.t?.[0])
  if (!timestamp || !Number.isFinite(timestamp)) return { ok: false, error: 'Invalid timestamp in signature' }
  const signatures = parts.v1 ?? []
  if (signatures.length === 0) return { ok: false, error: 'Missing v1 signature' }

  const age = Math.abs(nowSeconds - timestamp)
  if (age > STRIPE_SIGNATURE_TOLERANCE_SECONDS) {
    return { ok: false, error: `Signature timestamp outside ${STRIPE_SIGNATURE_TOLERANCE_SECONDS}s tolerance (age ${age}s)` }
  }

  const subtle = globalThis.crypto?.subtle ?? (await import('node:crypto')).webcrypto.subtle
  const key = await subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const mac = await subtle.sign('HMAC', key, new TextEncoder().encode(`${timestamp}.${rawBody}`))
  const expected = Buffer.from(mac).toString('hex')

  // Compare every same-length candidate without returning early.
  let match = false
  for (const signature of signatures) {
    if (signature.length !== expected.length) continue
    let difference = 0
    for (let index = 0; index < expected.length; index++) {
      difference |= signature.charCodeAt(index) ^ expected.charCodeAt(index)
    }
    if (difference === 0) match = true
  }
  return match ? { ok: true, timestamp } : { ok: false, error: 'Signature verification failed' }
}
