# TECH360 — Payment Integration Policy

**Effective:** 2026-10-24 · Applies to every code path that can take, record or settle money.

---

## 1. The rule

A payment method is **operational** only when all four are true:

1. an adapter is implemented in code,
2. credentials are configured in the environment,
3. a Super Admin has enabled it in **Settings → Payment Gateways**, and
4. the money is settled by **server-side evidence** — a verified provider webhook or an admin
   verification against a bank/provider statement.

Anything less is reported honestly as one of:

| Status | Meaning |
|---|---|
| `INTEGRATION_NOT_BUILT` | no adapter exists in code |
| `CONFIGURATION_REQUIRED` | adapter exists, credentials missing |
| `DISABLED` | Super Admin switched it off |
| `ACTIVE` | all four conditions satisfied |

**A browser redirect, a success URL, a "thank you" page, or a present environment variable is never
proof of payment.**

---

## 2. Current state of each method

| Method | Adapter | Live status |
|---|---|---|
| Bank transfer | instructions generated from `BANK_TRANSFER_DETAILS` + manual verification | `CONFIGURATION_REQUIRED` until configured, then admin-verified |
| bKash / Nagad | merchant-number instructions + manual verification | `CONFIGURATION_REQUIRED` until configured |
| Manual / cash / Wise | manual record + verification by Finance | `ACTIVE` (recorded honestly as manual) |
| **Stripe** | real REST Checkout Session + HMAC-verified webhook | `CONFIGURATION_REQUIRED` until keys set |
| **PayPal** | **none** | **`INTEGRATION_NOT_BUILT`** — cannot be enabled |
| **SSLCommerz** | **none** | **`INTEGRATION_NOT_BUILT`** — cannot be enabled |

Enforced in three places:

* `src/lib/features.ts` — `checkoutBuilt` is derived from code (`def.code === 'STRIPE'`), not from
  configuration, so setting `PAYPAL_CLIENT_ID` cannot change the status.
* `src/app/api/admin/settings/route.ts` — `PUT /api/admin/settings` returns **409 `GATEWAY_NOT_BUILT`**
  if anyone tries to switch PayPal or SSLCommerz on. The refusal happens *before* anything is saved.
* `src/lib/features.ts#assertGatewayUsable` — every payment-taking path calls it and receives `503`
  with an honest message for unbuilt gateways.

Pinned by `tests/payment-integration-safety.test.ts`.

---

## 3. What a real integration must implement (before flipping the switch)

Do not begin this work without explicit owner authorisation; none of these steps may be executed
against live money.

1. **Server-side order creation** with an idempotency key derived from the invoice number, so a
   double-click cannot create two charges.
2. **Server-side verification** of the provider's notification/return: signature or API
   re-verification against the provider's own record (never trusting posted fields).
3. **Transaction ↔ invoice matching**: provider transaction id stored on the `Payment` row, amount and
   currency compared against `totalMinor` (integer minor units) — mismatch ⇒ `REJECT_AMOUNT`.
4. **Idempotency / replay protection**: a repeated notification must return the same result and must
   not settle twice. TECH360 already has `InboundWebhookReceipt` for replay receipts — reuse it.
5. **State discipline**: the route may create `PENDING` only. Settlement goes through the one
   verification pipeline that updates the invoice, the project's `paidAmount`, the receipt and the
   audit log.
6. **Reconciliation**: a daily job comparing provider settlements with `Payment` rows.
7. **Tests** covering: valid callback, duplicate callback, invalid signature, mismatched amount,
   mismatched currency, replayed timestamp, callback for an unknown invoice, and a refund path.
8. **Provider sandbox acceptance evidence** recorded in the operations log before production.
9. **Refund support** (PayPal: yes; SSLCommerz: verify provider capability before promising it).

---

## 4. Stripe reference behaviour (the implemented example)

`verifyStripeSignature` (HMAC-SHA256 over `${timestamp}.${rawBody}`, 300 s tolerance, constant-time
comparison) → `evaluateStripePayment` (duplicate → `DUPLICATE`; amount mismatch → `REJECT_AMOUNT`;
currency mismatch → `REJECT_CURRENCY`; otherwise `SETTLE`) → the shared verification pipeline.
The checkout route creates only a `PENDING` record and returns a URL.

---

## 5. Operator rules

* Never mark an invoice paid because a client says so, or because a redirect looked successful.
* Never edit `Payment.status` by hand in the database.
* Never enable a gateway to "test whether it works" — status will say `INTEGRATION_NOT_BUILT` and every
  attempt refuses.
* If a payment arrives through an unbuilt method anyway (for example a manual PayPal transfer), record
  it as `MANUAL` with the transaction reference and verify it like any other manual payment.
* Any refund goes through `RefundCase` with a second approver, never a database edit.
