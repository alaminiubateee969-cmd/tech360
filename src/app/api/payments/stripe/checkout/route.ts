import { db } from '@/lib/db'

// ============================================================
// STRIPE CHECKOUT (server-side, real REST integration)
//
// POST /api/payments/stripe/checkout  (portal session required)
//   body: { invoiceNumber: string }
// Creates a REAL Stripe Checkout Session via api.stripe.com and
// returns { url } for the client to pay. Settlement is completed
// ONLY by the verified webhook (POST /api/webhooks/stripe) —
// never by the browser reaching a success URL.
//
// Honest states:
//  - Payments feature OFF            → 503
//  - Stripe disabled by Super Admin  → 403
//  - STRIPE_SECRET_KEY missing       → 503 CONFIGURATION_REQUIRED
//  - Sandbox mode                    → uses test keys; session still real
// Replay/duplicate safety: one pending Payment record per invoice
// (PENDING, transactionId = checkout session id, unique).
// ============================================================

const STRIPE_API = 'https://api.stripe.com/v1/checkout/sessions'

function stripeSecret(): string | null {
  const key = process.env.STRIPE_SECRET_KEY?.trim()
  return key || null
}

export async function POST(req: Request) {
  // ---- Portal session (client identity) ----
  const cookieHeader = req.headers.get('cookie') ?? ''
  const portalCookie = cookieHeader.split(';').map((c) => c.trim()).find((c) => c.startsWith('t360_portal='))
  const token = portalCookie ? decodeURIComponent(portalCookie.slice('t360_portal='.length)) : null
  if (!token) return Response.json({ error: 'Portal session required.' }, { status: 401 })

  // verify signed token (HMAC, same lib the portal login uses)
  const { verifyPortalToken } = await import('@/lib/portal')
  const clientId = verifyPortalToken(token)
  if (!clientId) return Response.json({ error: 'Portal session expired. Sign in again.' }, { status: 401 })

  // ---- Feature + gateway governance (server-side enforcement) ----
  const { featureEnabled, getGateway } = await import('@/lib/features')
  if (!(await featureEnabled('payments'))) {
    return Response.json({ error: 'Payments are currently disabled by the platform administrator.' }, { status: 503 })
  }
  const stripe = await getGateway('STRIPE')
  if (!stripe?.enabled) {
    return Response.json({ error: 'Stripe is currently disabled as a payment method.' }, { status: 403 })
  }
  if (stripe.status === 'CONFIGURATION_REQUIRED') {
    return Response.json(
      { error: `Stripe is enabled but not configured (missing ${stripe.missingCredentials.join(', ')}). Status: CONFIGURATION REQUIRED.` },
      { status: 503 },
    )
  }

  // ---- Input ----
  let invoiceNumber = ''
  try {
    const body = (await req.json()) as { invoiceNumber?: string }
    invoiceNumber = String(body.invoiceNumber ?? '').trim()
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 })
  }
  if (!invoiceNumber) return Response.json({ error: 'invoiceNumber is required.' }, { status: 400 })

  const key = stripeSecret()
  if (!key) return Response.json({ error: 'Stripe is enabled but STRIPE_SECRET_KEY is not configured. Status: CONFIGURATION REQUIRED.' }, { status: 503 })

  // ---- Invoice (owned by this client, not already paid) ----
  const client = await db.client.findFirst({ where: { clientId, deletedAt: null } })
  if (!client) return Response.json({ error: 'Client not found.' }, { status: 404 })
  const invoice = await db.invoice.findFirst({ where: { number: invoiceNumber, clientId: client.id } })
  if (!invoice) return Response.json({ error: 'Invoice not found for this account.' }, { status: 404 })
  if (invoice.status === 'PAID' || invoice.status === 'CANCELLED') {
    return Response.json({ error: `Invoice ${invoice.number} is ${invoice.status}.` }, { status: 409 })
  }

  // ---- Duplicate session guard (replay prevention) ----
  const existingPending = await db.payment.findFirst({
    where: { invoiceId: invoice.id, method: 'STRIPE', status: 'PENDING' },
  })
  if (existingPending) {
    // idempotent: reuse the still-open session instead of stacking charges
    const res = await fetch(`${STRIPE_API}/${existingPending.transactionId}`, {
      headers: { Authorization: `Bearer ${key}` },
    })
    if (res.ok) {
      const session = (await res.json()) as { url?: string }
      if (session.url) return Response.json({ url: session.url, reused: true })
    }
  }

  // ---- Create the real Stripe Checkout Session ----
  const origin = process.env.APP_ORIGIN?.replace(/\/$/, '') ?? new URL(req.url).origin
  const form = new URLSearchParams()
  form.set('mode', 'payment')
  form.set('success_url', `${origin}/#/portal?payment=success&invoice=${encodeURIComponent(invoice.number)}`)
  form.set('cancel_url', `${origin}/#/portal?payment=cancelled&invoice=${encodeURIComponent(invoice.number)}`)
  form.set('client_reference_id', `${client.clientId}:${invoice.number}`)
  form.set('customer_email', client.email ?? '')
  form.set('line_items[0][quantity]', '1')
  form.set('line_items[0][price_data][currency]', invoice.currency.toLowerCase())
  form.set('line_items[0][price_data][unit_amount]', String(Math.round(invoice.amount * 100)))
  form.set('line_items[0][price_data][product_data][name]', `Tech360 invoice ${invoice.number}`)
  form.set('metadata[invoice_number]', invoice.number)
  form.set('metadata[client_id]', client.clientId)

  const res = await fetch(STRIPE_API, {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: form.toString(),
  })
  const session = (await res.json().catch(() => ({}))) as { id?: string; url?: string; error?: { message?: string } }
  if (!res.ok || !session.id || !session.url) {
    const message = session.error?.message ?? `Stripe API error (HTTP ${res.status})`
    return Response.json({ error: `Could not create Stripe checkout session: ${message}` }, { status: 502 })
  }

  // ---- Pending Payment record (settlement happens ONLY via webhook) ----
  await db.payment.create({
    data: {
      clientId: client.id,
      projectId: invoice.projectId,
      invoiceId: invoice.id,
      milestone: `Invoice ${invoice.number}`,
      amount: invoice.amount,
      currency: invoice.currency,
      method: 'STRIPE',
      transactionId: session.id,
      status: 'PENDING',
      notes: `Stripe Checkout Session ${session.id} (${stripe.mode}) — awaiting verified webhook`,
    },
  })

  return Response.json({ url: session.url, sessionId: session.id })
}
