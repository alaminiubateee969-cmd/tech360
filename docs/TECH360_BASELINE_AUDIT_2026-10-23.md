# TECH360 LLC — Repository, Architecture & Production Baseline Audit

- **Audit Date:** 2026-10-23 (UTC)
- **Repository:** `alaminiubateee969-cmd/tech360`
- **Audited Branch / Baseline Commit:** `arena/0a9758de-tech360` (branched from `main` @ `8d3b48d1c2db1b8219c8f1fb8f26bcf5db8485af`)
- **Target Production Origin:** `https://bdtech360.com` (`TECH360 LLC`, `info@bdtech360.com`, WhatsApp `+8801327100297`)
- **Audit Scope:** Full static, architectural, security, schema, workflow, build, and automated-test audit prior to in-place enhancements. No production credentials or live Hostinger database connections are present in this sandbox; every claim below is explicitly categorized as **Verified**, **Suspected**, or **Not Yet Tested**.

---

## 1. Verified Repository & Runtime Architecture

| Layer | Verified Implementation | Evidence |
|---|---|---|
| **Runtime & Framework** | Node.js `>=22.0.0 <23` (`v22.22.3` verified locally), Next.js `16.3.8` (`^16.1.1` App Router + webpack production build), React `19.0.0`, TypeScript `5.x`. | `package.json`, `next.config.ts`, `server.js` |
| **Hosting Model** | Single Hostinger Node.js Web Application (`output: "standalone"` disabled on Linux production or served via `next start` / `server.js` behind Hostinger TLS proxy). No Docker, Redis, or external queue broker required. | `package.json`, `deployment/`, `scripts/validate-production-env.mjs` |
| **Database & ORM** | MySQL (`provider = "mysql"`) via Prisma `6.19.3` (`prisma/schema.prisma`, 69 models, 895 columns, 166 indexes, 10 incremental SQL migrations under `prisma/migrations/0_init` … `8_private_ai_platform`, 155 `@db.Text`/`@db.LongText`/`@db.LongBlob` native annotations tracked in `scripts/mysql-schema-map.json`). | `prisma/schema.prisma`, `scripts/check-schema-drift.mjs`, `scripts/convert-schema-to-mysql.mjs` |
| **Public Site & SPA Shell** | `src/app/page.tsx` + hash-routed and App Router views (`src/components/site/*`) covering Home, Services, Pricing, Portfolio, Process, Blog, Contact, Consultation, Support, FAQ, Legal policies (`LegalView.tsx`), Live Chat (`ChatWidget.tsx`), and Client Portal (`PortalView.tsx`). | `src/app/`, `src/components/site/` |
| **Super Admin Command Center** | `src/components/admin/AdminApp.tsx` (39 role-gated views across Overview, CRM, Finance & Delivery, Product Factory, Growth, Intelligence, and System) backed by ~160 App Router API handlers under `src/app/api/**`. | `src/components/admin/`, `src/app/api/` |
| **Authentication & Session Security** | Admin auth uses `scrypt` (`N=16384, r=8, p=1, 64B`), opaque DB-backed `Session` rows, `HttpOnly; SameSite=Lax; Secure` cookie (`t360_session`), optional TOTP 2FA, 5-attempt lockout, forced rotation (`mustChangePassword`), and double-submit CSRF (`t360_csrf` + `x-csrf-token`). Portal auth uses HMAC-SHA256 signed tokens (`t360_portal`) with Client ID + email/WhatsApp OTP verification. | `src/lib/auth.ts`, `src/lib/api-guard.ts`, `src/lib/portal.ts`, `src/app/api/portal/login/route.ts` |
| **AI Workforce & Autonomous Ops** | In-process DB-leased operations loop (`src/lib/ops-loop.ts` using `AiOpsLock`), durable `AgentJob` queue (`src/lib/agents/jobs.ts`), 8 seeded core agents (`SENTRY`, `STRATEGIST`, `ARCHITECT`, `ECHO`, `PULSE`, `FORGE`, `HERALD`, `SENTINEL`), untrusted-input prompt-injection screening, deterministic rules/gates (`src/lib/pipeline/rules.ts`), and global Super Admin kill-switches (`FeatureFlag` rows in `Setting`). | `src/lib/ops-loop.ts`, `src/lib/agents/`, `src/lib/pipeline/` |

---

## 2. Existing Working Functionality (Verified in Code & Tests)

- **Verified:** Public lead intake (`POST /api/contact`, `intakeLead()` in `src/lib/journey.ts`) sanitizes input, enforces sliding-window IP rate limits, creates/updates `Client` + `Lead` + `FormSubmission`, registers verified identity hashes when applicable, and logs `AuditLog` + `AutomationLog`.
- **Verified:** Multi-channel inbound webhooks (`/api/webhooks/whatsapp`, `/api/webhooks/email`, `/api/webhooks/inbound`) verify HMAC signatures (`WHATSAPP_APP_SECRET`, `EMAIL_WEBHOOK_SECRET`, `N8N_WEBHOOK_SECRET`), fail closed (`503`/`401`) when unconfigured or unsigned, deduplicate replays via `InboundWebhookReceipt`, and resolve senders only against verified `ClientIdentity` hashes (`src/lib/identity-resolver.ts`).
- **Verified:** Outbound communication outbox (`src/lib/comms.ts`, `src/lib/outbox-retry.ts`) checks channel configuration honestly (`NOT_CONFIGURED` / `DISABLED_BY_ADMIN`), applies exponential backoff bounded by `OUTBOX_MAX_ATTEMPTS`, and transitions permanent failures to `DEAD_LETTER`.
- **Verified:** Preview token rendering (`GET /api/preview/[token]`) strips scripts/handlers/iframes/forms/external actions from stored preview HTML and serves it inside an isolated CSP sandbox (`sandbox; default-src 'none'; style-src 'unsafe-inline'; img-src data: https:`).
- **Verified:** Source-code handover download (`GET /api/handover/[token]/download`) enforces `evaluateHandoverGate()` server-side (`status === 'RELEASED'` or `'DOWNLOADED'`, `paidAmount >= totalAmount`, `totalAmount > 0`, non-expired `expiryAt`, valid `packageToken`) and builds deterministic ZIP archives with SHA-256 integrity headers (`src/lib/handover-artifacts.ts`).
- **Verified:** Project closure (`closeProject()` in `src/lib/journey.ts`, `evaluateProjectClosure()` in `src/lib/lifecycle-policy.ts`) blocks closure until full verified payment, all tasks `DONE`, client delivery acceptance (`received && working`), and handover confirmation (`CONFIRMED`).
- **Verified:** Stripe webhook settlement (`POST /api/webhooks/stripe`) verifies `Stripe-Signature` HMAC-SHA256 within a 300-second replay window (`verifyStripeSignature()`), checks exact minor-unit amount and currency parity (`evaluateStripePayment()`), settles idempotently, and advances `Invoice` and `Project.paidAmount`.
- **Verified:** Team user administration (`/api/admin/team`, `/api/admin/team/[id]`, `TeamView.tsx`) supports user creation with cryptographic one-time passwords, forced password change on first login, session-revoking admin password resets, account disablement, and last-`SUPER_ADMIN` protection.

---

## 3. Partially Implemented or Placeholder Functionality (Verified)

1. **Client, Project & Invoice Sequence Generation (`src/lib/ids.ts`) — Verified Partial / Non-Compliant:**
   - Generates `TECH-YYYY-NNNNNN`, `PRJ-YYYY-NNNN`, and `INV-YYYY-NNNN` by calling `db.client.count()` / `db.project.count()` / `db.invoice.count()` followed by non-transactional `findUnique` probes and a random hex fallback (`TECH-2026-AB12CD`).
   - Violates requirements against counting rows, reusing IDs after deletion, race-condition safety under concurrent intake, and strict numeric sequence rollover across years.
2. **Invoice System (`Invoice` model, `/api/admin/invoices`, `PaymentsView.tsx`, `PortalView.tsx`) — Verified Partial:**
   - Supports only bare `amount` (`Float`), `currency`, `dueAt`, `notes`, and coarse statuses (`DRAFT`, `SENT`, `PARTIAL`, `PAID`, `OVERDUE`, `CANCELLED`).
   - Missing `GET /api/admin/invoices` list endpoint; missing itemized line items (qty, unit price, line total), integer minor-unit subtotal/discount/tax/total computation, billing snapshot fields, approved scope version linkage, separation of `internalNotes` vs `customerNotes`, approval/issue/send/view/void/reissue state machine, immutable issued revisions, and server-rendered printable/PDF-ready invoice view.
3. **Payment Gateway Readiness (`src/lib/features.ts`, `PortalView.tsx`) — Verified Misleading When Unconfigured:**
   - `MANUAL` gateway defaults to `status: 'ACTIVE'` with zero configuration, and `acceptedMethodsPhrase()` includes enabled gateways even when `status === 'CONFIGURATION_REQUIRED'` (e.g., `BANK_TRANSFER`, `BKASH`, `NAGAD` without account details).
   - `PortalView.tsx` renders an active `"Pay Now"` Stripe checkout button on every unpaid invoice (including `DRAFT`!) even when Stripe is disabled or `CONFIGURATION_REQUIRED`, instead of displaying `Not Configured` / `Payment setup required`.
4. **Role-Based Access Control (`src/lib/access-policy.ts`, `src/lib/constants.ts`) — Verified Coarse:**
   - Implements only 4 hierarchical roles (`SUPER_ADMIN`, `ADMIN`, `MANAGER`, `STAFF`). Missing `FINANCE`, `PROJECT_MANAGER`, `DEVELOPER`, `SALES`, `SUPPORT`, and read-only `AUDITOR` roles and domain-specific server capabilities.
5. **Scope of Work 21-Section Governance & Change Requests (`ScopeOfWork`, `src/lib/journey.ts`) — Verified Partial:**
   - `ScopeOfWork` versions exist (`@@unique([clientId, version])`), and `submitScope()` / `aiReviewScope()` / `finalizeScope()` work, but there is no server-side 21-section completeness validator and no structured post-approval Change Request API that computes scope/timeline/price deltas into a new version while keeping approved versions immutable.
6. **Live Chat to CRM Lead Conversion (`src/app/api/chat/**`) — Verified Disconnected:**
   - Public visitors can open `ChatConversation` and post `ChatMessage` rows, and `TrackingEvent` logs a `'lead'` signal, but there is no safe workflow or API for linking/converting a live-chat inquiry into a `Client` (`TECH-YYYY-NNNNNN`) + `Lead` record with preserved transcript history.

---

## 4. Missing Functionality Relative to Master Execution Prompt (Verified)

1. **CRM Duplicate Detection & Auditable Merge Workflow:** No API or service to detect duplicate `Client` records (by normalized email, phone, WhatsApp, or business name) or merge a duplicate into a canonical `TECH-YYYY-NNNNNN` record inside a database transaction while preserving secondary Client ID aliases, communications, projects, scopes, invoices, payments, and audit history.
2. **Official Verified-Only Payment Receipts (`RCT-YYYY-NNNN`):** No dedicated `PaymentReceipt` model or `/receipt` document endpoint enforcing that receipts can only be generated after server-verified `PAID` settlement (`verifiedAt` + `verifiedBy`).
3. **Structured Refund, Cancellation & Dispute Workflow (`RFD-YYYY-NNNN`):** `ApprovalRequest` has `'REFUND'` in an enum list, and `Payment.status` mentions `'REFUNDED'`, but there is no `RefundCase` persistence, no `/api/admin/refunds` API or UI workflow, no net-paid recalculation on partial/full refunds, and no automatic suspension/revocation of source-code handover eligibility when a refund or dispute invalidates full payment.
4. **Authorized Client Portal Invoice & Receipt Views:** Clients can see raw invoice rows in `GET /api/portal/me` (including leaked `DRAFT` rows and internal `notes`), but cannot open an official printable invoice (`/api/portal/invoices/[number]`) that marks `VIEWED` on open, nor download an official verified payment receipt (`/api/portal/payments/[id]/receipt`).

---

## 5. Production Risks & Critical Security Gaps

| ID | Severity | Status | Location | Finding |
|---|---|---|---|---|
| **SEC-01** | **CRITICAL** | **Verified** | `src/app/api/admin/journey/route.ts` (`VERIFY_PAYMENT`, `RECORD_PAYMENT`) | `POST /api/admin/journey` guards only `minRole: 'MANAGER'`, yet `VERIFY_PAYMENT` invokes `verifyPayment()` directly — bypassing `/api/admin/payments/verify`'s `SUPER_ADMIN` requirement, skipping `featureEnabled('payments')`, and failing to verify `payment.clientId === client.id` (cross-client payment verification & handover unlock!). `RECORD_PAYMENT` also skips `featureEnabled('payments')` and `assertGatewayUsable()`. |
| **SEC-02** | **HIGH** | **Verified** | `src/lib/files.ts`, `src/app/api/portal/documents/[id]/route.ts`, `src/app/api/admin/documents/[id]/route.ts` | **Stored XSS:** `DOC_MIME` allows `text/html` (`html`), `scanDocumentBytes()` skips `<script>` checks for `html`, and `?inline=1` serves any `text/*` MIME with `Content-Disposition: inline` and no `Content-Security-Policy: sandbox` on the primary origin — allowing uploaded HTML/JS to execute in an admin's or client's authenticated browser context. |
| **SEC-03** | **HIGH** | **Verified** | `src/app/api/portal/me/route.ts`, `src/app/api/payments/stripe/checkout/route.ts`, `src/app/api/admin/payments/route.ts` | **Draft Invoice Exposure & Unapproved Checkout:** `GET /api/portal/me` exposes internal `DRAFT` invoices and `Invoice.notes` to clients; `POST /api/payments/stripe/checkout` omits `portalGate()`, allows paying `DRAFT` invoices, and charges full `invoice.amount` instead of remaining balance on `PARTIAL` invoices; `POST /api/admin/payments` allows allocating payments to `DRAFT` invoices and checks `amount > invoice.amount` instead of `amount > remainingBalance`. |
| **SEC-04** | **MEDIUM-HIGH** | **Verified** | `src/app/api/preview/[token]/action/route.ts` | **Preview Replay & Pipeline Regression:** Terminal previews (`APPROVED` / `REVISION_REQUESTED`) accept unlimited repeat `POST`s, flipping approved previews back to revision-requested, creating duplicate `ApprovalRequest`/outbound messages, and overwriting `Client.pipelineStage` backward to `'CLIENT_APPROVAL'` even on active/delivered clients. |
| **SEC-05** | **MEDIUM** | **Verified** | `src/app/api/preview/[token]/action/route.ts`, `src/app/api/handover/[token]/confirm/route.ts` | Audit trail writes internal CUID (`preview.clientId` / `handover.project.clientId`) to `AuditLog.clientId` instead of canonical `TECH-YYYY-NNNNNN`, breaking client-scoped audit queries. |
| **SEC-06** | **LOW-MEDIUM** | **Suspected** | In-memory rate limiter (`src/lib/security.ts`) | Sliding-window rate limiter is per-Node.js-process memory; adequate for single-process Hostinger deployment, would not share counters across multi-instance horizontal scaling without shared storage. |

---

## 6. Broken Routes, APIs, Database Models, Forms, or Workflows

1. **Verified Runtime Crash (`500 Foreign Key Violation`) — `POST /api/portal/login` (`src/app/api/portal/login/route.ts:117`):**
   - Calls `sendCommunication({ clientId: client.clientId, ... })` passing business identifier `"TECH-YYYY-NNNNNN"` instead of primary key `client.id`. Because `Communication.clientId` has a MySQL foreign key referencing `Client(id)`, OTP login crashes whenever SMTP or WhatsApp is configured. (Existing `tests/portal-otp.test.ts` missed this because neither SMTP nor WhatsApp env vars were set during the test, causing `portalGate()` to fail closed before reaching `request_code` or `sendCommunication`.)
2. **Verified Missing Endpoint — `GET /api/admin/invoices`:**
   - `src/app/api/admin/invoices/route.ts` exports only `POST`, so invoices can only be inspected indirectly via `/api/admin/payments` (capped at 100 rows without line-item or lifecycle metadata).
3. **Verified Broken Portal Checkout UX — `PortalView.tsx`:**
   - Clicking `"Pay Now"` when Stripe is unconfigured triggers a `503` API error toast instead of disabling live payment collection and showing `Not Configured — Payment setup required`.

---

## 7. Data Integrity & Customer-Record Risks

- **Verified:** Count-based ID generation (`src/lib/ids.ts`) risks collision under concurrent requests and ID reuse if any row is deleted.
- **Verified:** Floating-point arithmetic (`Float`) on `Invoice.amount`, `Payment.amount`, and `Project.totalAmount`/`paidAmount` without integer minor-unit validation risks IEEE-754 rounding drift on multi-line-item invoices, discounts, taxes, and partial payments/refunds.
- **Verified:** Lack of CRM duplicate merge tooling forces admins either to keep fragmented histories across multiple `TECH-YYYY-NNNNNN` records or manually delete records (risking loss of linked communications/files).
- **Verified:** Refunded payments do not currently recalculate `Project.paidAmount` / `Project.paymentStatus` or suspend `HandoverRecord` release status, creating a post-refund source-code handover leak risk.

---

## 8. Baseline Build, Lint, Typecheck, Schema & Test Status

| Check | Command | Baseline Status | Notes |
|---|---|---|---|
| **Install** | `npm ci --ignore-scripts --no-audit --no-fund` | **Verified PASS** | 850 packages installed cleanly |
| **Prisma Client** | `npx prisma generate --no-engine` (offline env) | **Verified PASS** | `@prisma/client` `v6.19.3` generated |
| **Lint** | `npm run lint` | **Verified PASS** | 0 errors |
| **TypeScript** | `npm run typecheck` | **Verified PASS** | `tsc --noEmit` 0 errors |
| **MySQL Schema Map** | `npm run schema:check` | **Verified PASS** | `provider=mysql`, 155 native type annotations in sync |
| **Migration Drift** | `npm run schema:drift` | **Verified PASS** | 0 drift across 69 models, 69 tables, 895 columns, 166 indexes |
| **Unit & Static Tests** | `npm test` | **Verified 642/660 PASS** | 148/149 suites pass; only `tests/database-workflows.test.ts` (1 suite) **Not Yet Tested locally** due to no local MySQL daemon in sandbox (runs in GitHub Actions MySQL 8.0 CI) |
| **Production Build** | `npx next build --webpack` | **Verified PASS** | ~160 static & dynamic routes compiled cleanly (`npm run build` wrapper requires live `DATABASE_URL` for `prisma migrate deploy`) |
| **Live Production Host** | `https://bdtech360.com` runtime & DB | **Not Yet Tested** | Outbound sandbox network is restricted to GitHub/npm/PyPI; live Hostinger DB and runtime are not reachable from this sandbox |

---

## 9. Safe Deployment, Migration & Rollback Approach

1. **Additive-Only MySQL Migrations:**
   - Any schema evolution must be authored as an additive migration (`prisma/migrations/9_.../migration.sql`) using `CREATE TABLE` (InnoDB, `utf8mb4_unicode_ci`) and `ALTER TABLE ... ADD COLUMN` with safe defaults or nullable columns.
   - Never drop tables, drop columns, rename columns in place, or rewrite existing customer rows.
   - Every `@db.Text` / `@db.LongText` / `@db.LongBlob` column must be registered in `scripts/mysql-schema-map.json` without database-level literal defaults (MySQL errno 1101 / Prisma introspection parity), verified locally via `npm run schema:check`, `npm run schema:drift`, `tests/schema-ddl-parity.test.ts`, and `tests/prisma-field-usage.test.ts`, and verified against real MySQL 8.0 in `.github/workflows/ci.yml` (`prisma migrate deploy` + `prisma migrate diff --exit-code`).
2. **Pre-Deployment Backup Requirement (Production Hostinger):**
   - Take a full `mysqldump --single-transaction --routines --triggers` snapshot of the Hostinger MySQL database and verify row counts with `npm run db:verify` before running `npm run build` (`prisma migrate deploy && next build --webpack`).
3. **Rollback Strategy:**
   - Because all migrations are strictly additive and legacy columns (`Invoice.amount`, `Invoice.notes`, `User.role` values `MANAGER`/`STAFF`) remain populated and compatible, application code can be rolled back to the previous Git tag/commit immediately without breaking existing tables or losing newly recorded data. If a migration itself ever fails mid-deploy, restore from the pre-deploy MySQL backup before traffic cutover.

---

## 10. Prioritized Implementation Backlog & Acceptance Criteria

### Priority P0 — Security, Runtime Crash & Payment-Gate Integrity
1. **Fix `POST /api/admin/journey` RBAC & tenant/gateway bypasses (`SEC-01`)**
   - *Acceptance:* `VERIFY_PAYMENT` requires `SUPER_ADMIN`, checks `featureEnabled('payments')`, and verifies `payment.clientId === client.id`; `RECORD_PAYMENT` checks `featureEnabled('payments')` and `assertGatewayUsable()`. Covered by automated tests.
2. **Fix Stored XSS on document uploads & inline downloads (`SEC-02`)**
   - *Acceptance:* `text/html` and script-capable files are never served `Content-Disposition: inline`; inline responses are restricted to safe allowlisted types with `Content-Security-Policy: sandbox` and `X-Content-Type-Options: nosniff`; HTML uploads containing executable script/event-handler markup are quarantined. Covered by automated tests.
3. **Fix Portal OTP Login FK crash (`POST /api/portal/login`)**
   - *Acceptance:* `sendCommunication` receives `client.id` (CUID FK) while audit/messages retain `client.clientId` (`TECH-YYYY-NNNNNN`). Covered by automated test with mocked configured channel.
4. **Fix Preview terminal-state replay, stage regression & CUID audit logging (`SEC-04`, `SEC-05`)**
   - *Acceptance:* Repeat `POST /api/preview/[token]/action` on `APPROVED` or `REVISION_REQUESTED` previews returns `409`; `Client.pipelineStage` only advances forward; `AuditLog.clientId` records `TECH-YYYY-NNNNNN`. Covered by automated tests.
5. **Fix Gateway Readiness honesty & Draft invoice exposure (`SEC-03`)**
   - *Acceptance:* Unconfigured gateways report `NOT_CONFIGURED` / `Payment setup required`; `PortalView` disables live payment buttons when Stripe is not active; `/api/portal/me` and `/api/payments/stripe/checkout` block `DRAFT`/unissued invoices and enforce `portalGate()` + exact remaining minor-unit balance.

### Priority P1 — Core Identifiers, RBAC, Invoice Lifecycle, Receipts & Refunds
6. **Concurrency-safe, monotonic, per-year sequence generator (`SequenceCounter` + `src/lib/ids.ts`)**
   - *Acceptance:* Generates `TECH-YYYY-NNNNNN`, `PRJ-YYYY-NNNN`, `INV-YYYY-NNNN`, `RCT-YYYY-NNNN`, `RFD-YYYY-NNNN` without `count()`, never reuses deleted/archived IDs, guarantees uniqueness under concurrent callers, and rolls over cleanly per year while preserving prior years.
7. **Least-privilege RBAC expansion (`src/lib/access-policy.ts`, `/api/admin/team/**`, `TeamView.tsx`, `AdminApp.tsx`)**
   - *Acceptance:* Supports `SUPER_ADMIN`, `ADMIN`, `FINANCE`, `PROJECT_MANAGER`, `DEVELOPER`, `SALES`, `SUPPORT`, `AUDITOR` (plus legacy `MANAGER`, `STAFF`), enforces server-side capabilities, and blocks `AUDITOR` from all state-changing operations (`403`).
8. **End-to-End Create Invoice, Server-Side Printable Document, Delivery & Client Portal View**
   - *Acceptance:* Line items, integer minor-unit arithmetic, discount/tax/currency validation, full state machine (`DRAFT` → `AWAITING_APPROVAL` → `APPROVED` → `ISSUED` → `SENT` → `VIEWED` → `PARTIAL` → `PAID` / `OVERDUE` / `VOID` / `REFUND_PENDING` / `PARTIALLY_REFUNDED` / `REFUNDED` / `DISPUTED`), immutable issued invoices with revision/supersede support, separated `internalNotes` vs `customerNotes`, honest email send handling, and tenant-isolated portal invoice view.
9. **Official Verified-Only Payment Receipts (`PaymentReceipt`)**
   - *Acceptance:* Receipts (`RCT-YYYY-NNNN`) generate only for `PAID` payments with `verifiedAt` and `verifiedBy`; `PENDING`, `FAILED`, `REFUNDED`, and unverified records are rejected (`409`).
10. **Refund, Cancellation & Dispute Workflow (`RefundCase`)**
    - *Acceptance:* Tracks `REFUND`, `CANCELLATION`, and `DISPUTE` cases (`RFD-YYYY-NNNN`), requires `SUPER_ADMIN` approval for settlement, updates `Payment`/`Invoice`/`Project` net paid balances, and revokes/blocks source-code handover if net verified payment drops below `Project.totalAmount`.

### Priority P2 — CRM Duplicate Merge, Chat-to-CRM Lead Conversion & 21-Point Scope Governance
11. **CRM Duplicate Detection & Auditable Merge + Chat-to-CRM Inquiry Conversion**
    - *Acceptance:* Detects duplicate candidates, merges secondary into canonical `TECH-YYYY-NNNNNN` transactionally without losing communications/projects/invoices/files or secondary ID lookup, and converts live-chat conversations into `TECH-YYYY-NNNNNN` CRM leads with full transcript preservation.
12. **21-Section Scope Validator & Post-Approval Change Request Versioning**
    - *Acceptance:* Server-side validator checks all 21 required Scope of Work sections; post-approval change requests create a new incremented scope version with scope/timeline/price delta while keeping approved versions immutable.
