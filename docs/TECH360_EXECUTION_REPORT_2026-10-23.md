# TECH360 LLC — Platform Hardening & Operating Model Execution Report

- **Date:** 2026-10-23 (UTC)
- **Entity:** TECH360 LLC (`https://bdtech360.com`, `info@bdtech360.com`, Missouri LLC `LC014737249`, EIN `98-1940053`, Official WhatsApp `+8801327100297`)
- **Repository & Branch:** `alaminiubateee969-cmd/tech360` · `arena/0a9758de-tech360` (base commit `8d3b48d`)
- **Stack Preserved:** Next.js 16 + React 19 + TypeScript + Prisma 6 (MySQL / Hostinger hPanel deployment architecture)

---

## A. Baseline Summary

Phase 1 baseline audit (`docs/TECH360_BASELINE_AUDIT_2026-10-23.md`) verified a substantial brownfield Next.js 16 + MySQL platform (69 baseline models, 108 API routes, 35 admin views, client portal SPA, HMAC-verified webhooks, and AI workforce scaffolding) alongside specific security, concurrency, RBAC, and commercial-lifecycle gaps:

1. **P0 Security & Runtime Defects Found in Baseline:**
   - **Stored XSS vector** in `/api/portal/documents/[id]` and `/api/admin/documents/[id]` when serving `inline=1` without a safe MIME allowlist or sandbox CSP.
   - **Runtime FK crash** on `POST /api/portal/login` OTP dispatch (`sendCommunication` received canonical `TECH-YYYY-NNNNNN` instead of relational `client.id`).
   - **Preview state replay / stage regression** in `/api/preview/[token]/action` and `/view` (approved/decided preview links could be replayed; viewing older links could regress `Client.pipelineStage`).
   - **Journey payment action bypass** in `/api/admin/journey` (`record_payment` / `verify_payment` lacked `SUPER_ADMIN`, `featureEnabled('payments')`, gateway-readiness, and cross-client ownership checks).
2. **Data Integrity & Concurrency Gaps Found in Baseline:**
   - `src/lib/ids.ts` derived `TECH-YYYY-NNNNNN`, `PRJ-YYYY-NNNN`, and `INV-YYYY-NNNN` from `count()`, risking race-condition collisions and post-deletion ID reuse.
   - `Invoice` modeled only a single `Float` amount with no line-item array, minor-unit integer columns, discount/tax breakdown, internal-vs-customer note separation, or immutable revision chain (`reissue` / `void`).
   - No `PaymentReceipt` (`RCT-YYYY-NNNN`) table or verified-only receipt renderer existed; no `RefundCase` (`RFD-YYYY-NNNN`) workflow existed to recalculate net project balance and revoke source-code handover after a refund.
   - RBAC supported only 4 coarse roles (`STAFF`, `MANAGER`, `ADMIN`, `SUPER_ADMIN`) without least-privilege domain capabilities (`FINANCE`, `PROJECT_MANAGER`, `DEVELOPER`, `SALES`, `SUPPORT`, or strictly read-only `AUDITOR`).
   - Duplicate CRM clients lacked a safe duplicate-detection + auditable merge workflow; Live Chat `convert-to-lead` was non-idempotent and omitted `ChatConversation.clientId` linkage; Scope of Work lacked a 21-section completeness validator and post-approval Change Request immutability.

---

## B. Implemented Enhancements & Security Hardening

All changes were implemented strictly additively in-place on the existing Next.js + MySQL stack without deleting or breaking existing routes, tables, or Hostinger scripts:

1. **P0 Security, Runtime Crash & Payment-Gate Fixes:**
   - **Stored XSS Eliminated (`src/lib/files.ts`, `/api/portal/documents/[id]`, `/api/admin/documents/[id]`):** Restricted inline rendering to `INLINE_SAFE_MIMES` (`application/pdf`, `image/png`, `image/jpeg`, `image/webp`, `text/plain`) with `Content-Security-Policy: sandbox; default-src 'none'; img-src 'self' data:; style-src 'unsafe-inline'; form-action 'none'; base-uri 'none'` and `X-Content-Type-Options: nosniff`; forced `application/octet-stream` + `attachment` otherwise; quarantined HTML containing `<script>` or inline event handlers; restricted quarantined admin downloads to `SUPER_ADMIN` (`423`).
   - **Portal OTP FK Fix (`/api/portal/login`):** Passed relational `client.id` to `sendCommunication(...)`.
   - **Preview Terminal Lock & Monotonic Stages (`src/lib/preview-policy.ts`, `/api/preview/[token]/action`, `/api/handover/[token]/confirm`):** Locked terminal preview states (`409 PREVIEW_ALREADY_DECIDED`), made pipeline stage updates forward-only (`forwardPipelineStage`), and standardized `AuditLog.clientId` to canonical `TECH-YYYY-NNNNNN`.
   - **Journey Payment Gate Hardening (`/api/admin/journey`):** Enforced `featureEnabled('payments')`, `assertGatewayUsable`, cross-client ownership checks, and `SUPER_ADMIN` authorization on `verify_payment`.

2. **Additive Backward-Compatible MySQL Schema Migration (`prisma/migrations/9_commerce_invoices_sequences/migration.sql` + `prisma/schema.prisma`):**
   - Added `SequenceCounter`, `PaymentReceipt`, and `RefundCase` tables; added `Client.mergedIntoId`, `ChatConversation.clientId`, and full minor-unit/billing/scope/revision/void columns on `Invoice` (72 models, 72 tables, 971 columns, 181 indexes, zero drift).

3. **Concurrency-Safe Monotonic Identifier Sequences (`src/lib/ids.ts`):**
   - Replaced `count()`-based ID generation with atomic `SequenceCounter` increments (`TECH-YYYY-NNNNNN`, `PRJ-YYYY-NNNN`, `INV-YYYY-NNNN`, `RCT-YYYY-NNNN`, `RFD-YYYY-NNNN`), historical high-water seeding (including `AuditLog` so deleted/merged IDs are never reused), and clean UTC year rollover.

4. **Least-Privilege 10-Role RBAC & Read-Only Auditor (`src/lib/{constants,access-policy,api-guard}.ts`, `/api/admin/team/**`, `/api/admin/compliance-audit`, `TeamView.tsx`, `AdminApp.tsx`):**
   - Expanded RBAC to 10 roles (`SUPER_ADMIN`, `ADMIN`, `FINANCE`, `PROJECT_MANAGER`, `MANAGER`, `AUDITOR`, `DEVELOPER`, `SALES`, `SUPPORT`, `STAFF`) across 21 domain capabilities.
   - Enforced `403 AUDITOR_READ_ONLY` on all mutating HTTP verbs in `guard()`, preserved `SUPER_ADMIN` exclusivity on `finance.payment.verify`, `finance.refund.decide`, `handover.release`, `team.manage`, and `settings.manage`, and kept all AI Workforce routes locked to `SUPER_ADMIN`.

5. **CRM Duplicate Detection, Auditable Merge & Idempotent Live Chat Conversion (`src/lib/crm-merge.ts`, `/api/admin/clients/[id]/merge`, `/api/admin/conversations/[id]`, `/api/chat/message`, `ClientDetailView.tsx`):**
   - Surfaced potential email/phone/WhatsApp/business-name duplicates without silent auto-merging; built atomic `executeClientMerge()` preserving both `TECH-YYYY-NNNNNN` IDs, re-parenting all child records (with `Lead` merge + `ScopeOfWork` version collision avoidance), and writing dual `AuditLog` + `AiMemory` lineage records.
   - Made Live Chat `convert-to-lead` idempotent via `ChatConversation.clientId` and mirrored chat transcripts into `Communication` (`channel: 'WEB'`) on the unified CRM timeline.

6. **21-Section Versioned Scope of Work & Change Requests (`src/lib/scope-validator.ts`, `/api/admin/scopes`, `src/lib/journey.ts`):**
   - Implemented 21-section SOW completeness validation (`validate21PointScope`), structured normalization (`normalizeTo21PointScope`), deterministic manual fallback in `submitScope()` when AI is unconfigured, immutability on `APPROVED`/`FINAL` scopes (`409 SCOPE_IMMUTABLE`), and versioned post-approval Change Requests requiring `reason`, `costImpact`, and `timelineImpact`.

7. **End-to-End Create Invoice, Honest Payment Readiness, Verified-Only Receipts & Refunds (`src/lib/{invoice-policy,invoice-document,receipts,features}.ts`, `/api/admin/{invoices,payments,refunds}/**`, `/api/portal/{me,invoices,payments}/**`, `/api/payments/stripe/checkout`, `PaymentsView.tsx`, `PortalView.tsx`):**
   - Server-side integer minor-unit arithmetic across 8 currencies (`USD, EUR, GBP, BDT, CAD, AUD, SGD, AED`), rejecting tampered client totals (`CLIENT_TOTAL_MISMATCH`), mixed currencies, unlabeled tax, and unexplained discounts.
   - Full invoice state machine (`DRAFT -> AWAITING_APPROVAL -> APPROVED -> ISSUED -> SENT -> VIEWED -> PARTIAL -> PAID`, plus `OVERDUE`, `VOID`, `CANCELLED`, `DISPUTED`, `REFUND_PENDING`, `PARTIALLY_REFUNDED`, `REFUNDED`), immutable post-approval/post-issuance history, and transactional `reissue` revisions (`revision + 1`, `supersedesInvoiceNumber`).
   - Print/PDF-ready HTML invoice & receipt renderer on official TECH360 LLC company letterhead with strict HTML escaping, `script-src 'none'` CSP, and strict exclusion of `internalNotes` from customer views.
   - Honest `Not Configured — Payment setup required` status on invoices, portal banners, and checkout buttons until real payment credentials/instructions are configured; partial-balance-aware Stripe checkout (`settlement.remainingMinor`).
   - Idempotent `RCT-YYYY-NNNN` receipt generation strictly for verified `PAID` payments (`verifiedAt` + `verifiedBy`).
   - `RFD-YYYY-NNNN` Refund/Cancellation/Dispute workflow where `SUPER_ADMIN` refund settlement recalculates net verified `Project.paidAmount` and automatically suspends released `HandoverRecord` rows back to `PREPARED` whenever full payment is no longer satisfied.

---

## C. Verification Matrix

| Check / Suite | Command Executed | Status | Evidence / Result |
| --- | --- | --- | --- |
| MySQL Schema Native Annotations | `npm run schema:check` | **PASS** | `✓ schema in sync — provider=mysql, 169 native type annotations` |
| Migration SQL ↔ Prisma Drift Gate | `npm run schema:drift` | **PASS** | `✓ no schema drift — 72 models, 72 tables, 971 columns, 181 indexes` |
| TypeScript Strict Typecheck | `npm run typecheck` | **PASS** | `tsc --noEmit` exited `0` with 0 errors across `src/` and `tests/` |
| ESLint Static Analysis | `npm run lint` | **PASS** | `eslint .` exited `0` with 0 errors / warnings |
| Retired Deployment Path Guard | `node tests/retired-deployment-paths.mjs` | **PASS** | Unsupported deploy/backup paths fail closed before side effects |
| New Operating Model Hardening Suite | `npx tsx --test tests/operating-model-hardening.test.ts` | **PASS** | 8 suites, 21/21 tests PASS (concurrency IDs, 10-role RBAC, Auditor read-only, CRM merge, 21-point SOW, preview lock, invoice math/CSP/XSS, verified receipts, refund handover suspension, document XSS quarantine) |
| Full Offline Unit & Contract Test Suite (41 test files) | `npx tsx --test --experimental-test-module-mocks $(ls tests/*.test.ts \| grep -v database-workflows.test.ts)` | **PASS** | 147 suites, **663/663 PASS**, 0 FAIL (includes `schema-ddl-parity`, `prisma-field-usage`, `migration-parity`, `ai-workforce-rbac`, `communication-pipeline`, `invoice-policy`, `business-policies`, `webhook-auth`) |
| Production Next.js Build | `npx next build --webpack` | **PASS** | Clean production build across all static & dynamic App Router pages and API endpoints |
| Live MySQL Transactional Integration Suite | `tests/database-workflows.test.ts` & `node tests/seed-safety.mjs` | **BLOCKED (Sandbox has no MySQL daemon / `DATABASE_URL`)** | Requires live MySQL 8 instance (`tech360_test`); executes automatically in GitHub Actions CI (`mysql:8.0` service container) and staging/production verification |
| Live External Provider Delivery (SMTP, Meta WhatsApp, Stripe Checkout/Webhook, OpenAI) | Live external API calls | **NOT TESTED (External credentials not present in sandbox)** | Unconfigured channels/gateways verified to fail closed and report `NOT_CONFIGURED` / `Not Configured — Payment setup required` without fabricating delivery or payment success |

---

## D. Production & Hostinger Deployment Status

- **Current Status:** **NOT YET DEPLOYED TO PRODUCTION** (all changes reside on repository branch `arena/0a9758de-tech360` and have been verified locally via build, lint, typecheck, schema parity, and 663 automated tests). No claim of live production deployment is made prior to executing the Hostinger release pipeline and live post-deploy health checks.
- **Hostinger Compatibility Preserved:** `server.js` (Passenger entrypoint), `package.json` scripts (`hostinger-build`, `db:deploy`, `db:verify`), `.github/workflows/ci-deploy.yml`, and forward-only MySQL migrations (`prisma/migrations/9_commerce_invoices_sequences/migration.sql`) remain 100% compatible with the existing Hostinger hPanel Node.js + MySQL setup.

---

## E. Genuine External Blockers (Owner Configuration Required for Live External Channels)

No code blockers remain. Before enabling live external customer communications or online card checkout in production, the owner must supply the corresponding Hostinger hPanel environment variables:

1. **Production MySQL (`DATABASE_URL`):** Required on Hostinger to apply `npx prisma migrate deploy` (`9_commerce_invoices_sequences`).
2. **Payment Collection Readiness:** Until `STRIPE_SECRET_KEY` + `STRIPE_WEBHOOK_SECRET` (or `BANK_TRANSFER_DETAILS` / `BKASH_MERCHANT_NUMBER` / `NAGAD_MERCHANT_NUMBER` / `MANUAL_PAYMENT_INSTRUCTIONS`) are configured and enabled by `SUPER_ADMIN`, the platform intentionally displays **`Not Configured — Payment setup required`** and disables live `Pay Now` checkout.
3. **Outbound Email / WhatsApp / AI Providers:** `SMTP_HOST`/`SMTP_USER`/`SMTP_PASS`, `WHATSAPP_ACCESS_TOKEN`/`WHATSAPP_PHONE_NUMBER_ID`/`WHATSAPP_APP_SECRET`, and `OPENAI_API_KEY` remain optional — when absent, manual SOW authoring, portal invoice viewing, and admin operations continue functioning via deterministic manual fallbacks.

---

## F. Next Execution & Safe Deployment / Rollback Runbook

1. **Pre-Deploy Backup on Hostinger:**
   - Export a full timestamped MySQL dump (`mysqldump --single-transaction --routines --triggers`) of the Hostinger production database before applying migration `9_commerce_invoices_sequences`.
2. **Controlled Release Steps:**
   - Merge `arena/0a9758de-tech360` after CI (`mysql:8.0` integration suite `tests/database-workflows.test.ts` + `tests/seed-safety.mjs`) passes green.
   - Run `npm ci --omit=dev`, `npx prisma migrate deploy`, `npm run db:verify`, `npm run build`, and restart the Passenger Node.js process on Hostinger.
   - Verify `GET https://bdtech360.com/api/health` and `GET https://bdtech360.com/api/health/deep` return HTTP `200`.
3. **Safe Rollback Plan:**
   - Because Migration `9_commerce_invoices_sequences` is **100% additive** (new tables `SequenceCounter`, `PaymentReceipt`, `RefundCase`, and nullable/defaulted columns on `Client`, `ChatConversation`, `Invoice`; zero dropped/renamed columns), rolling back the application code to base commit `8d3b48d` is binary-safe without destructive database rollback. If full DB restoration is ever required, restore the pre-deploy `mysqldump` snapshot.
