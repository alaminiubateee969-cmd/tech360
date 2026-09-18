# Task ID: 12-c — portal-payments-engineer

## Task
Portal Invoices card (round-12 audit fix: /api/portal/me returned invoices but PortalView never rendered them) + "Pay Now" wired to the real Stripe checkout API with honest disabled/not-configured states.

## Scope honored
Touched ONLY src/components/site/PortalView.tsx (extend-only, +121 lines, imports + Receipt, X). API and all other files untouched (parallel agents own them).

## Contract verified before coding
- POST /api/payments/stripe/checkout: 503 payments-off / 403 stripe-disabled / 503 CONFIGURATION_REQUIRED (missing credential names) / 200 {url}. Portal session via HttpOnly cookie (same-origin fetch).
- /api/portal/me invoices payload {number, amount, currency, status, notes} — matches the existing (previously unused) PortalView type exactly. NO mismatch found.
- DB truth: TECH-2026-000001 has INV-2026-0005 PAID $1,250 + 4 DRAFT invoices; payments flag ON, Stripe gateway disabled → live honest path = 403.

## What was built
InvoicesCard placed after Payments / before Communications (DOM order verified live). Receipt icon, table styled identically to the Payments table (thead border #E2E8F0 verified via computed styles on both), columns Invoice (mono) / Amount (fmtMoney) / Status (invoice-specific tone map: PAID emerald #18B83A default, SENT+PARTIAL secondary, OVERDUE destructive, DRAFT/CANCELLED outline) / Action. Pay Now (navy #063B8F, CreditCard, sm) on DRAFT|SENT|PARTIAL|OVERDUE with spinner+disabled while in flight; PAID → check + muted "Paid"; CANCELLED → "—". 200 → window.location.href = url. Errors → inline amber notice inside the card (role=alert, X dismiss, clears on next attempt) with the API's honest text + "You can also pay by bank transfer — contact us and we'll send details." ("contact us" → mailto: policy.supportContact). Footnote + honest EmptyLine per spec.

## Verification (all live)
- tsc --noEmit: zero errors (src); eslint PortalView.tsx: zero problems.
- Browser (agent-browser session t12c, closed after): login with TECH-2026-000001/testclient@example.com; 5 invoices render; Pay Now on the 4 DRAFT ones; PAID row has zero buttons; click → EXACT honest error: "Stripe is currently disabled as a payment method." (dev.log POST /api/payments/stripe/checkout 403) + fallback line; X dismisses; in-flight state proven with a clearly-labeled "(delayed test)" slowed fetch ("Opening…", spinner, disabled, all buttons disabled) then restored by reload; 390px: scrollWidth=clientWidth=390, no overflow; zero console/page errors.

## Honest caveats
1) The 200→Stripe redirect could not run end-to-end (Stripe disabled + no STRIPE_SECRET_KEY in sandbox) — verified to the API boundary only. 2) All 4 unpaid demo invoices are DRAFT status today. 3) dev.log tail has a pre-existing AI-Ops 429 (model-provider rate limit) — unrelated.

Screenshots: .zscripts/task12c-invoices-{card,mobile,desktop}.png. Full record: worklog.md Task ID 12-c.
