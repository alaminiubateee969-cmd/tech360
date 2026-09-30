# PAYMENT — Architecture & Gateway Governance

## 1. Principle: server-side truth only

```
Client → Invoice → Pay Now → Gateway → Payment → Webhook (signature-verified)
       → Server verification → Transaction PAID → Invoice PAID → Milestone PAID
       → Project status update → Receipt → Client notification
```

**A payment is NEVER marked successful because the browser reached a success URL.** Settlement happens exclusively through:

1. **Verified webhook** — Stripe `checkout.session.completed` with HMAC-SHA256 signature verification, or
2. **Admin verification** — a human confirms receipt of a platform-verified method (bank/bKash/Nagad/manual proof).

## 2. Gateway governance (Super Admin → Settings → Payment Gateways)

| Gateway | Settlement | Status today | Webhooks | Refunds |
|---|---|---|---|---|
| **Bank Transfer** | platform-verified proof | ACTIVE (credentials optional — instructions from env) | — | — |
| **bKash** | platform-verified proof (TrxID) | ACTIVE (merchant number from env when set) | — | — |
| **Nagad** | platform-verified proof (TrxID) | ACTIVE (merchant number from env when set) | — | — |
| **Manual / Other** | manual record + verification | ACTIVE | — | — |
| **Stripe** | gateway checkout | `CONFIGURATION_REQUIRED` until `STRIPE_SECRET_KEY` + `STRIPE_WEBHOOK_SECRET` are set | ✅ verified | supported by Stripe |
| **PayPal** | gateway checkout | `INTEGRATION_NOT_BUILT` — checkout integration not implemented; the switch is stored but the platform **never claims it can charge** | — | — |
| **SSLCommerz** | gateway checkout | `INTEGRATION_NOT_BUILT` (same honest rule) | — | — |

Per-gateway Super Admin controls: **ON/OFF** and **sandbox/production** mode (stored in the `Setting` table; credentials are never stored in the DB — only env var names are referenced and their live presence is computed per request).

**Enforcement is backend-wide:**

- disabled gateways are **rejected server-side** when recording a payment (`assertGatewayUsable`)
- invoice pay-notes quote **only enabled methods** (regenerated live from the governance engine)
- the Stripe checkout route refuses when Stripe is disabled/unconfigured
- the global **Payments** feature switch refuses all payment recording + checkout

## 3. Stripe integration (fully implemented, REST-based)

**Checkout** — `POST /api/payments/stripe/checkout` (portal session required):
creates a real Checkout Session via `api.stripe.com` (line item = the invoice amount, `client_reference_id` = `ClientID:InvoiceNumber`, metadata carries both), returns `{ url }`. A `PENDING` Payment row is created with `transactionId = session.id` (unique constraint). If a pending session already exists for the invoice it is **reused** (no stacked charges). Amount comes from the invoice — the client cannot choose it.

**Webhook** — `POST /api/webhooks/stripe` (the only settlement path):
1. reads the **raw body** + `Stripe-Signature` header
2. recomputes HMAC-SHA256 of `"{timestamp}.{rawBody}"` with `STRIPE_WEBHOOK_SECRET`, constant-time compare over all `v1` candidates
3. rejects timestamps older than 5 minutes (replay window)
4. acts only on `checkout.session.completed` with `payment_status = "paid"`
5. **duplicate guard**: an already-PAID payment returns 200 idempotent (Stripe retries)
6. **amount verification**: event `amount_total` (minor units) must equal the platform Payment record; mismatch ⇒ payment FAILED + audit `PAYMENT_AMOUNT_MISMATCH`
7. **currency verification**: same for currency
8. settlement runs the **one true verify pipeline** (`verifyPayment`): Payment PAID → project paid-amount + paymentStatus → invoices PAID/PARTIAL → first-payment project activation → confirmation communication → audit + ops notification

Without `STRIPE_WEBHOOK_SECRET` the endpoint **refuses to act** (503, audited) — an unverified webhook is never trusted.

## 4. Configuring Stripe (when you have the keys)

```
# Hostinger .env
STRIPE_SECRET_KEY=sk_live_...        # sk_test_... for sandbox
STRIPE_WEBHOOK_SECRET=whsec_...
```

Then: Super Admin → Settings → Payment Gateways → **Stripe ON**, mode `SANDBOX` (test) or `PRODUCTION`. The status chip flips from `CONFIGURATION REQUIRED` to `ACTIVE` immediately (computed from env presence).

Stripe dashboard → Developers → Webhooks → add endpoint `https://bdtech360.com/api/webhooks/stripe`, event `checkout.session.completed`, copy the signing secret into `STRIPE_WEBHOOK_SECRET`.

**Test the verification path** (sandbox): pay with card `4242 4242 4242 4242`; confirm the webhook settles the payment in the platform (`Payments` view → status PAID, audit `PAYMENT_VERIFIED` actor `system:stripe-webhook`). Send a tampered signature (modify the body) and confirm the platform rejects it with `WEBHOOK_REJECTED` in the audit log.

## 5. Milestones

Milestone payment splits are **configurable per project** (percentage, fixed amount, due date, name, description, payment requirement) — never hard-coded. The SOW preview document and invoices reflect the configured plan.

## 6. Honest status vocabulary

`ACTIVE` · `CONFIGURATION_REQUIRED` (enabled, credentials missing) · `INTEGRATION_NOT_BUILT` (switch stored, integration not implemented — never claimed as working) · `DISABLED` (rejected server-side) · `NOT_CONFIGURED` (channels). The platform never fakes a settled payment, a sent receipt, or a connected gateway.
