# SECURITY — TECH360 Platform

## 1. Secrets handling

**Do not commit** (enforced by `.gitignore` + CI pattern scan):

- `.env` / `.env.local` / `.env.production` — the repo ships `.env.example` with placeholder values only
- SSH keys, private certificates
- payment credentials (`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, …)
- API tokens (WhatsApp, SMTP, SMS, social, n8n)
- database credentials

The tracked-file review for this deployment audit found no `.env`, private-key file, database/upload/source archive, or matching high-risk secret pattern. Pattern scans are not proof that every possible credential format is absent; rotate any value that may have been exposed.

**CI gate** (`.github/workflows/ci.yml`): every push and pull request is scanned for secret patterns (`sk_live_…`, `sk_test_…`, `whsec_…`, `BEGIN PRIVATE KEY`, `ghp_…`, AWS key ids) before CI validation; a hit fails the pipeline. An accidental `.env` in the tree also fails the pipeline.

**Intended production target: Hostinger Node.js Web App.** The actual hPanel app type, runtime, environment values, process state, HTTPS, and Git connection are **NOT VERIFIED** in this audit. If configured, secrets belong in Hostinger's protected Node.js Web App Environment Variables panel; GitHub Actions validates source and does not hold or use an SSH deployment key.

**Rotation**: replace values in the protected Hostinger environment settings and redeploy/restart as Hostinger requires. Optional local relay/operations helpers contain development-only fallbacks; they now fail closed or skip in production when required configuration is absent. Never use development fallback values as production secrets.

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

## 7. Dependency audit (2026-10-03)

- Targeted security update pins `prisma` and `@prisma/client` to 6.19.3, and scopes an npm override of `deepmerge-ts` to `@prisma/config` at `^8.0.2`. The npm and Bun lockfiles resolve `deepmerge-ts` 8.0.2 and `effect` 3.21.0; Prisma 6.19.3 retains the project's Prisma 6 API and MySQL provider.
- Prisma CLI settings and seed configuration now live in root `prisma.config.ts`; `dotenv/config` is a direct dependency so local `.env` loading is explicit. This removes the deprecated `package.json#prisma` setting. `npx prisma --help` loads the config without a warning; repair CI run 37061731570 also passed engine-dependent Prisma validation/generation and MySQL migration checks.
- After the dependency change, both `npm audit` and `npm audit --omit=dev` exit 0 and report **zero vulnerabilities at every severity**. `npm ci` and `npm ls --depth=0` also pass on Node 22.22.3 / npm 10.9.8. Do not use `npm audit fix --force`; this remediation was an explicit compatible-version update plus a scoped transitive override.
- Local Prisma CLI engine downloads from `binaries.prisma.sh` still fail during TLS setup, blocking local validate/generate, migration status, DB verification, and build. Exact repair CI run 37061731570 passed Prisma validation/generation, disposable MySQL migrations/drift, tests, DB verification, and production build. Those disposable-database checks do not validate the production database.
- Targeted updates also moved `sharp` to 0.35.5 and locked the vulnerable transitive `js-yaml` and `prismjs` paths to patched 4.3.2 and 1.30.0 versions, respectively.

## 8. Reporting a vulnerability

Email security@bdtech360.com with details; we triage within 72 hours. Please do not test against production data.
