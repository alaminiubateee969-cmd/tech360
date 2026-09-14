# SECURITY — TECH360 Platform

## 1. Secrets handling

**Never committed** (enforced by `.gitignore` + CI secret scan):

- `.env` / `.env.local` / `.env.production` — the repo ships `.env.example` with **placeholder values only**
- SSH keys, private certificates
- payment credentials (`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, …)
- API tokens (WhatsApp, SMTP, SMS, social, n8n)
- database credentials

**CI gate** (`.github/workflows/deploy-production.yml`): every push is scanned for secret patterns (`sk_live_…`, `sk_test_…`, `whsec_…`, `BEGIN PRIVATE KEY`, `ghp_…`, AWS key ids) **before** anything is deployed; a hit fails the pipeline. An accidental `.env` in the tree also fails the pipeline.

**Production lives on the VPS** — `scripts/deploy-vps.sh` explicitly preserves the VPS `.env` across deployments (repo updates source only). GitHub Actions holds only the SSH deployment key, in the encrypted `production` environment.

**Rotation**: change a value in the VPS `.env` and restart; for the dev sandbox regenerate `SESSION_SECRET` / `OPS_SECRET` / `PORTAL_SECRET` / `NOTIFY_RELAY_TOKEN` (dev defaults exist for local runs only and are documented as must-change in `.env.example`).

## 2. Authentication & authorization

- Admin console: email + password (scrypt hash), **HttpOnly session cookie**, must-change-on-first-login for the seeded super admin.
- **RBAC roles**: SUPER_ADMIN, ADMIN, MANAGER, SALES, DEVELOPER, SUPPORT, MARKETING, CLIENT — enforced **server-side in every admin API route** (`guard()` in `src/lib/api-guard.ts`): session → role → rate limit → CSRF. Frontend route hiding is never the only barrier.
- **CSRF**: double-submit cookie (`t360_csrf` echoed in `x-csrf-token`) required on all mutating admin requests.
- Client portal: stateless **HMAC-signed token** (Client ID + email/WhatsApp match), HttpOnly cookie, 24h TTL, rate-limited login, generic errors (no field disclosure). Every portal route re-verifies the session + the Super Admin **portal switch**.
- Governance API (`/api/admin/settings`) is **SUPER_ADMIN-only**.

## 3. Payment security (details in PAYMENT.md)

- Gateway credentials **only in env vars** — the database stores just ON/OFF + mode flags.
- Server-side settlement only: a payment is PAID **only** via admin verification or the **signature-verified Stripe webhook** — never via a browser success URL.
- Webhook verification: HMAC-SHA256 (`Stripe-Signature` v1), 5-minute replay tolerance, idempotent duplicate handling, amount + currency cross-checked against the platform record; mismatches mark the payment FAILED and are audited.
- Duplicate/replay protection: unique `transactionId`; an open Stripe session is reused instead of stacking charges.

## 4. Input & upload hardening

- All request bodies pass `readJson` + `sanitizeText/sanitizeEmail/sanitizePhone` (length caps, strip control chars) — `src/lib/security.ts`.
- Rate limits on sensitive endpoints (login, contact, portal, admin APIs per-IP).
- File uploads: MIME allow-list, 5MB cap, sha256, deterministic content scan (executable/script/private-key signatures) with quarantine + honest scan status — `src/lib/files.ts`.
- Every HTML document the platform renders (invoices, SOWs, certificates) escapes all client-controlled values (`escapeHtml`).
- Official documents are `noindex,nofollow` + admin-session-gated.

## 5. Audit & observability

- `AuditLog` records every sensitive action (logins, journey steps, approvals, payment records/verification, governance switch flips, webhook rejections, handover confirmations) with actor + client reference + details.
- `ErrorLog` + `AutomationLog` feed the ops loop; failures are retried only through safe replay routines (everything else refuses honestly).
- Autonomous AI actions are approval-gated by risk level; the ops loop itself is authenticated with `OPS_SECRET` (401s otherwise).

## 6. Platform governance switches

Super Admin switches (feature flags + payment gateways) change **real backend behavior**: portal sessions refused, payment recording rejected, invoices refusing to render, agent runs denied, comms channels refusing to send, maintenance 503s on public data APIs. They are never frontend-only hides. Every flip is audited (`PLATFORM_GOVERNANCE_UPDATED`).

## 7. Reporting a vulnerability

Email security@bdtech360.com with details; we triage within 72 hours. Please do not test against production data.
