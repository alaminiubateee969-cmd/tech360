# TECH360 ENTERPRISE COMPANY OPERATING SYSTEM — OPERATIONAL HANDBOOK

**Document ID**: `HBK-TECH360-2026-V1`  
**Repository**: `https://github.com/alaminiubateee969-cmd/tech360`  
**Stack**: Next.js 16.2 (App Router) · React 19 · TypeScript 5.9 · Prisma 6.19 · MySQL 8.0 · n8n (26 Workflows)  
**Classification**: `INTERNAL — OPERATIONS & SUPER ADMIN`

---

## 1. System Overview

TECH360 Enterprise Company Operating System ("Company-in-a-Box") unifies public digital properties, omnichannel lead intake, a 20-stage CRM pipeline, an authenticated Customer Portal, an Official Document & Letterhead Engine, a Private Application & Project Factory, and a governed internal automation engine into a single Next.js + Prisma + MySQL platform.

Core non-negotiable operating invariants:
1. **Permanent Monotonic Client ID (`TECH-YYYY-NNNNNN`)**: Allocated atomically via `SequenceCounter` on first consented contact; never derived from row counts and never reused.
2. **Written Scope of Work & Interactive HTML Preview Before Production**: Every project progresses through written Scope of Work approval and tokenized HTML preview (`/api/preview/[token]`) before engineering build or final settlement.
3. **Evidence-Only Client Payment Submissions**: Client payment proofs (`POST /api/portal/payments/submit`) always record `status = "SUBMITTED"` (`evidenceOnly = true`). Only human Finance/Super Admin reconciliation (`POST /api/admin/payments/verify`) or a cryptographically verified Stripe webhook (`POST /api/webhooks/stripe`) can transition a payment to `PAID`.
4. **Full Cleared Payment + Human Approval Before Source-Code Handover**: Source-code release (`handover.release`) requires both `sourcePaymentEvidence().cleared === true` (verified `PAID` payments net of refunds equal to project total) AND an explicit `SUPER_ADMIN` approval (`SOURCE_CODE_RELEASE`).
5. **Exact Sent Email & Document Archiving**: Every consequential outbound email requires bound `SUPER_ADMIN` approval (`comm:<sha256>`), verifies recipient authorization (`isAuthorizedEmailDestination`), and archives the exact sent body, subject, SHA-256 document snapshot, and attachments to the CRM (`FileRecord` + `Communication`) and Customer Portal Document Library.

---

## 2. Architecture Diagram

```text
┌───────────────────────────────────────────────────────────────────────────────────┐
│                         PUBLIC & CUSTOMER SURFACES (HTTPS)                        │
│  • Public Website (/, /services/*, /industries/*, /work/*, /platform, /contact)   │
│  • Customer Portal (/portal -> OTP / Token Auth -> t360_portal HttpOnly Cookie)   │
│  • Tokenized HTML Preview (/api/preview/[token]) & Handover (/api/handover/[tok]) │
└─────────────────────────────────────────┬─────────────────────────────────────────┘
                                          │
                                          ▼
┌───────────────────────────────────────────────────────────────────────────────────┐
│                  NEXT.JS 16 APPLICATION & GOVERNANCE LAYER (PORT 3000)            │
│  • API Guard (src/lib/api-guard.ts): Session + Role RBAC + Double-Submit CSRF     │
│  • 6-Layer Governance Engine (GLOBAL -> COMPANY -> DEPT -> ROLE -> AGENT -> TASK) │
│  • Outbound Content Screen & Approval Binding (src/lib/governance/outbound.ts)    │
│  • Official Document Renderer (17 Document Kinds + Locked-Down CSP)               │
│  • Private Application Factory (8 Shared Modules + 15 Certified Templates)        │
└───────────────┬───────────────────────────────────┬───────────────────────────────┘
                │                                   │
                ▼                                   ▼
┌───────────────────────────────────────┐ ┌─────────────────────────────────────────┐
│     PERSISTENCE LAYER (PRISMA ORM)    │ │   EXTERNAL INTEGRATIONS (SERVER-ONLY)   │
│  • Production: MySQL 8.0 (101 Models) │ │  • Hostinger Mail API / SMTP Relay      │
│  • Offline Preview: SQLite (.preview) │ │  • Meta WhatsApp Cloud API (HMAC-SHA256)│
│  • Immutable AuditLog & ErrorLog      │ │  • Stripe Checkout & Webhook (HMAC)     │
│  • SequenceCounter (Monotonic IDs)    │ │  • n8n Bridge (26 Inactive Workflows)   │
│  • FileRecord (SHA-256 + Malware Scan)│ │  • Model Providers (OpenAI/Gemini/Groq) │
└───────────────────────────────────────┘ └─────────────────────────────────────────┘
```

---

## 3. Application Module Directory

| Surface / Console | Route / View | Primary Source Module | Access Level |
|---|---|---|---|
| **Public Website** | `/`, `/[...path]` (`64` crawlable routes) | `src/components/site/*`, `src/app/[...path]/page.tsx` | Public |
| **Customer Portal** | `/portal`, `/api/portal/*` | `src/components/site/PortalView.tsx`, `src/app/api/portal/*` | Authenticated Client (`t360_portal`) |
| **Admin Hash Console** | `/#admin` (`dashboard`, `leads`, `projects`, `finance`, `documents`, `approvals`, `agents`, `models`, `settings`) | `src/components/admin/*`, `src/lib/admin-view-policy.ts` | Staff / Role-Gated (`t360_session`) |
| **Executive Command Center** | `/admin/command-center` | `src/app/admin/command-center/page.tsx` | `ADMIN` / `SUPER_ADMIN` |
| **Private Application Factory** | `/admin/factory-control`, `/factory/apps/[slug]` | `src/lib/factory/control/*`, `src/app/api/factory/*` | `SUPER_ADMIN` only |
| **Official Document Engine** | `/api/admin/documents/generate` | `src/lib/official-document.ts`, `src/lib/document-storage.ts` | `ADMIN` / `SUPER_ADMIN` |

---

## 4. Role and Permission Guide

Enforced by `src/lib/access-policy.ts` and `src/lib/admin-view-policy.ts`:

| Role | Rank / Scope | Permitted Operations | Explicitly Restricted From |
|---|---|---|---|
| **`SUPER_ADMIN`** | Full Enterprise Authority | All admin modules, Approval Queue decisions, Payment Verification, Source-Code Release, DCC Certification, Workforce/Agent creation, Private Factory Control, Branding/Seal replacement, Kill Switch. | None (still bound by 2-person/explicit approval on consequential outbound & `ALWAYS_HUMAN_ACTIONS`). |
| **`ADMIN`** | Operational Management | CRM, Projects, Scopes, Official Document generation, Communications, Command Center, Agent viewing/running. | Private Factory Control (`/admin/factory-control`), Governance rule mutation, Branding/Seal replacement. |
| **`FINANCE`** | Financial Operations | Invoices (`/api/admin/invoices`), Payments (`/api/admin/payments`), Receipts, Refunds (`/api/admin/refunds`), Finance documents. | Workforce/Agents, Factory, Source-Code Release, System Settings. |
| **`PROJECT_MANAGER` / `MANAGER`** | Delivery & CRM | Clients, Leads, Scopes, Projects, Tasks, Client Documents (`/api/admin/documents`), Manual Message requests. | Approving consequential outbound messages, Payment Verification, Factory Control. |
| **`DEVELOPER` / `QA` / `DESIGNER`** | Engineering & Quality | Assigned Project Tasks, Preview generation, QA reports. | Finance, Workforce governance, Factory Control, Client PII export. |
| **`MARKETING`** | Content & Campaigns | Blog, Marketing Posts (`/api/admin/marketing`), Newsletter drafts, SEO audits. | Finance, Factory Control, Workforce/DCC, Client payment records. |
| **`SUPPORT` / `STAFF`** | Customer Triage | CRM Lead/Client lookup, Conversation inbox, Support ticket handling. | Consequential approvals, Payment verification, Factory, Settings. |
| **`AUDITOR`** | Read-Only Compliance | Audit logs (`/api/admin/logs/audit`), Compliance reports. | All mutating operations. |
| **`CLIENT`** | Tenant-Isolated Portal | Own profile, own project/tasks, own Final Scope, own HTML preview, own invoices/payments, own authorized documents. | Any other client's records, internal `DRAFT` documents, admin APIs. |

---

## 5. Super Admin Operating Procedures

1. **Reviewing Pending Approvals (`/#admin` → Approvals / `GET /api/admin/approvals`)**:
   - Inspect the exact `payload`, `resourceKey` (`comm:<sha256>`), `risk` level (`HIGH` / `CRITICAL`), and requesting operator.
   - Approve (`POST /api/approvals/[id]/approve` or `/api/admin/approvals/[id]/decision`) or reject with a mandatory note.
2. **Certifying a Department (DCC)**:
   - Run `GET /api/admin/dcc?departmentCode=D012` to inspect the 9 evidence-based metrics.
   - Run `POST /api/admin/dcc` with `{"departmentCode": "D012"}` only when all 9 metrics meet threshold (`SOP >= 95%`, `Knowledge >= 95%`, `Skill >= 95%`, `Test >= 95%`, `KPI >= 90%`, `Security = 100%`, `Audit = 100%`, `Self-Recovery >= 90%`, `Escalation <= 10%`).
3. **Emergency Pause / Kill Switch**:
   - Pause any individual agent via `PATCH /api/admin/agents/[code]` (`{"action": "pause", "reason": "..."}`) or activate the global/department kill switch.

---

## 6. CRM Lead and Client Lifecycle (20 Stages)

Every client progresses through the canonical 20-stage pipeline (`PIPELINE_STAGES` in `src/lib/constants.ts`):
1. `NEW` → 2. `BUSINESS_TYPE_DETECTED` → 3. `PLAN_RECOMMENDED` → 4. `SCOPE_COLLECTION` → 5. `SCOPE_RECEIVED` → 6. `AI_SCOPE_REVIEW` → 7. `FINAL_SCOPE_READY` → 8. `ADMIN_APPROVAL_PENDING` → 9. `FINAL_SCOPE_SENT` → 10. `CLIENT_APPROVED` → 11. `MEETING_SCHEDULED` → 12. `HTML_PREVIEW_READY` → 13. `PREVIEW_APPROVED` → 14. `PAYMENT_REQUESTED` → 15. `PAYMENT_VERIFIED` → 16. `PROJECT_ACTIVE` → 17. `DEVELOPMENT` → 18. `QA_TESTING` → 19. `DELIVERY_READY` → 20. `COMPLETED`.

- **Manual & CSV Import (`POST /api/admin/clients`)**:
  - Allocates monotonic `TECH-YYYY-NNNNNN` via `nextClientId()`.
  - Prevents duplicates on `email` / `phone` / `whatsapp` both in-flight (`HTTP 409 DUPLICATE_IN_FLIGHT`) and against persisted records (`HTTP 409 DUPLICATE_CLIENT`).
  - Bulk stage updates (`action: "bulk_update"`) are restricted to ungated early stages (`NEW` through `SCOPE_RECEIVED`); gated stages require their respective approval/payment artifacts.

---

## 7. Email Communication Procedures

- **Outbound Dispatch (`POST /api/admin/communications/send`)**:
  1. Verifies recipient authorization (`isAuthorizedEmailDestination`): recipient must be `client.email` or an active `AUTHORIZED` destination in `authorized_email_destinations_index`. Unapproved thread addresses are blocked (`HTTP 403 UNAPPROVED_EMAIL_DESTINATION`).
  2. Screens content via `classifyOutbound(body, subject)`: any message carrying a monetary amount, payment instruction, invoice, contract/scope commitment, refund, or handover link requires an approved `communication.send` record bound to `comm:${outboundContentHash({ channel, to, subject, body })}`.
  3. Sends through Hostinger Mail API (`src/lib/mail/hostinger-mail.ts`) or SMTP (`nodemailer`) when configured; records `NOT_CONFIGURED` honestly when credentials are absent.
  4. Archives the exact sent email body, subject, SHA-256 document snapshot (`FileRecord` `ADMIN_SHARE`), recipient, CC/BCC, sender, approval ID, and provider status via `recordSentEmailDocumentArchive()`.

---

## 8. Document Generation and Approval

- **17 Official Document Kinds (`POST /api/admin/documents/generate`)**:
  - `BUSINESS_PROPOSAL`, `SOW`, `QUOTATION`, `PAYMENT_INSTRUCTION`, `SERVICE_AGREEMENT`, `CONTRACT`, `MEETING_MINUTES`, `CHANGE_REQUEST`, `SCOPE_APPROVAL`, `PROGRESS_REPORT`, `QA_REPORT`, `COMPLETION_REPORT`, `DELIVERY_HANDOVER`, `CUSTOMER_ACCEPTANCE`, `WARRANTY_SUPPORT`, `OFFICIAL_LETTER`, `CERTIFICATE`.
- Rendered on the official TECH360 letterhead (`src/lib/official-document.ts`) with locked-down CSP (`script-src 'none'`) and `X-TECH360-Document-Sha256` header.
- Passing `?register=1` registers the versioned metadata in `recordGeneratedDocument()`; duplicate `reference + version` returns `HTTP 409`.

---

## 9. Customer Portal Operation

- **Authentication (`/portal` → `POST /api/portal/login`)**:
  - Two-step verification: `Client ID` (`TECH-YYYY-NNNNNN`) + matching email/phone → 6-digit OTP verification → issues signed `t360_portal` HttpOnly cookie.
  - New customers without a Client ID can self-register on `/portal` ("Register" tab), which creates a consented CRM Lead + `TECH-YYYY-NNNNNN` Client ID.
- **Self-Service Capabilities (`GET/PATCH/POST /api/portal/me`)**:
  - View 20-stage progress, project tasks, Final Scope of Work, interactive HTML preview link, invoices, payment history, and account activity timeline.
  - Submit Scope of Work approval or revision feedback (`action: "scope_feedback"`).
  - Submit support tickets (`action: "support_ticket"`).
  - Submit payment proof (`POST /api/portal/payments/submit` → always stored as `SUBMITTED` evidence only).

---

## 10. Document Sharing and Recipient Management

- **Customer Portal Document Library (`/api/portal/documents` & `/api/portal/documents/[id]`)**:
  - Customers can upload project briefs/assets (`POST /api/portal/documents` — validated against `DOC_EXT_LIST`, `DOC_MAX_BYTES`, SHA-256, and `scanDocumentBytes`).
  - `QUARANTINED` uploads are blocked from download (`HTTP 403`) until an admin releases them via `POST /api/admin/documents/[id]/status` (`{"action": "RELEASE"}`).
  - Customers can view and download their own `CLEAN` uploads and team-shared `ADMIN_SHARE` documents (including archived sent email documents), plus view approved `officialDocuments` metadata.
  - Internal `DRAFT` and `REJECTED` documents are strictly hidden from customers (`canReadDocument()`).

---

## 11. Project Template Library

Managed under `src/lib/factory/control/catalog.ts` (`SUPER_ADMIN` only):
- **8 Shared Functional Modules (`MODULE_SEEDS`)**:
  1. `identity` (Identity & Access)
  2. `contacts` (Contacts & CRM)
  3. `workflow` (Workflow & Approvals)
  4. `documents` (Documents & Files)
  5. `audit` (Audit & Compliance)
  6. `notifications` (Notifications & Alerts)
  7. `reporting` (Reporting & KPIs)
  8. `integration_hub` (Integration Hub)
- **15 Certified Application Templates (`TEMPLATE_SEEDS`)**:
  1. `company-in-a-box` (Company-in-a-Box)
  2. `crm` (CRM & Lead Management)
  3. `support` (Support & Helpdesk)
  4. `projects` (Project & Task Management)
  5. `school-website` (School & Academy Website)
  6. `fitness-platform` (Fitness & Training Platform)
  7. `doctor-consult` (Doctor Consultation & Appointments)
  8. `travel-agency` (Travel & Tourism Agency)
  9. `real-estate` (Real Estate & Property Listings)
  10. `ecommerce-store` (Commerce & Retail Storefront)
  11. `manufacturing-erp` (Manufacturing ERP)
  12. `analytics-reports` (Analytics & Report Studio)
  13. `elearning-app` (E-Learning & Course Platform)
  14. `it-services` (IT Services & Corporate Website)
  15. `outdoor-gear` (Outdoor & Adventure Commerce)

---

## 12. Industry Coverage Management

- **Public Industry Solutions Catalog (`src/data/industry-solutions.ts`)**: `20` industry verticals (`healthcare`, `education`, `ecommerce`, `real-estate`, `finance`, `logistics`, `hospitality`, `manufacturing`, `legal`, `automotive`, `retail`, `construction`, `agriculture`, `energy`, `media`, `nonprofit`, `telecom`, `government`, `fitness`, `travel`).
- **Truthful Certified Demo Coverage**:
  - `15` certified functional application templates exist in `TEMPLATE_SEEDS` (`src/lib/factory/control/catalog.ts`) and `12` produced system showcases exist in `src/data/work-examples.ts`.
  - Per the 5-certified-projects-per-industry target (`20 industries × 5 = 100` certified projects), current certified template coverage is **`15 / 100` (`PARTIAL`)**. Never count static screenshots or unbuilt variants as certified projects.

---

## 13. Project Assembly Procedures

1. Bootstrap the catalog (`POST /api/factory/bootstrap` as `SUPER_ADMIN`).
2. Create or select a tenant company (`POST /api/factory/companies`).
3. Provision an application from an approved template (`POST /api/factory/applications` with `companyId`, `templateCode`, `name`, `slug`).
4. Verify health, module pins, and tenant isolation (`GET /api/factory/runtime/[slug]`).
5. Export the deterministic deployment bundle (`GET /api/admin/factory/apps/[id]/export`).

---

## 14. Project Review and HTML Preview

- Generate a tokenized HTML preview (`generatePreview(clientId)` or `POST /api/admin/pipeline` → `HTML_PREVIEW`).
- Preview is served at `/api/preview/[token]` with strict token verification and expiry checking.
- Customer reviews the live preview and submits `APPROVE` or `REQUEST_CHANGES` at `POST /api/preview/[token]/action`.

---

## 15. Revision Management

- When a customer submits `REQUEST_CHANGES` on `/api/preview/[token]/action` or `scope_feedback` (`decision: "REVISION_REQUESTED"`) on `/api/portal/me`:
  - The revision notes are persisted in `PreviewFeedback` / `Communication` and audited (`PREVIEW_CHANGE_REQUESTED` / `CLIENT_SCOPE_FEEDBACK`).
  - A new version (`version + 1`) of the Scope of Work or HTML Preview is generated; prior approvals are invalidated when content changes.

---

## 16. Payment Verification

1. Customer submits payment proof (`POST /api/portal/payments/submit`) with `transactionId` and/or `proofFileId`.
   - Duplicate `transactionId` values are rejected with `HTTP 409 DUPLICATE_TRANSACTION_ID`.
   - Record is saved with `status = "SUBMITTED"` (`evidenceOnly = true`).
2. Finance / Super Admin reconciles the bank/gateway settlement and calls `POST /api/admin/payments/verify` (or `/api/admin/payments/[id]/status`).
3. Only upon verified reconciliation does `status` become `PAID` with `verifiedAt`, `verifiedBy`, and generated `PaymentReceipt` (`RCT-YYYY-NNNN`).

---

## 17. Final Delivery and Source-Code Handover

1. Prepare handover (`prepareHandover(clientId, projectId)`): verifies `sourcePaymentEvidence()` (`cleared === true` — full project total paid in matching currency net of settled refunds) and creates a `SOURCE_CODE_RELEASE` approval request.
2. `SUPER_ADMIN` approves the `SOURCE_CODE_RELEASE` request.
3. Customer downloads the package via `/api/handover/[token]/download` (scanned by `parseHandoverManifest` to block any internal `.env` or secret files) and confirms delivery at `/api/handover/[token]/confirm`.

---

## 18. Internal Automation & Workforce Governance (Internal Technical Reference Only)

- **Strictly Internal**: Public and customer-facing interfaces use neutral operational terms (`TECH360 Operations`, `Automated Workflow`, `Quality Verification`, `Document Preparation`).
- **Internal Architecture**:
  - `110` Departments (`D001`..`D110`)
  - `2,201` Source-Defined AI Employee Profiles (`src/lib/agents/workforce.ts`)
  - `44` Persisted Canonical Agents (`db.aiAgent`) + `2,201` Logical Agent Catalogue entries (`src/lib/agents/catalogue.ts`)
  - `10,010` Skills (`src/lib/skills/catalog.ts`), `70,400` Prompt Slots (`src/lib/prompts/library.ts`), `550` SOPs (`src/lib/sops/library.ts`), `550` Constitutional & Layered Governance Rules (`src/lib/governance/rules.ts`).
  - Dynamic child Loop Agents (`AGT-[A-F0-9]{8}`) are gated by 9-metric DCC certification (`HTTP 403` when uncertified) and bounded to `max 3 children per parent` and `max depth 2`.

---

## 19. n8n Workflow Management

- All **26 workflow definitions** (`n8n/W01_LEAD_INTAKE.json` .. `n8n/W26_LEAD_ENRICHMENT.json`) ship with `"active": false`.
- Every workflow authenticates inbound webhooks with `TECH360_INBOUND_WEBHOOK_SECRET` and calls `={{ $env.TECH360_API_BASE }}/api/webhooks/n8n` using `x-n8n-secret: <N8N_WEBHOOK_SECRET>`.
- Keep workflows inactive in n8n until `N8N_WEBHOOK_SECRET` is configured and verified in staging.

---

## 20. External Integrations

| Integration | Adapter Module | Required Env Keys | Default / Fallback Behavior |
|---|---|---|---|
| **Hostinger Mail API / SMTP** | `src/lib/mail/hostinger-mail.ts`, `src/lib/comms.ts` | `HOSTINGER_MAIL_ENABLED`, `HOSTINGER_MAIL_API_TOKEN` or `SMTP_HOST`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` | Returns `NOT_CONFIGURED` honestly; queues in outbox where applicable. |
| **Meta WhatsApp Cloud API** | `src/lib/comms.ts`, `src/app/api/webhooks/whatsapp/route.ts` | `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_VERIFY_TOKEN`, `WHATSAPP_APP_SECRET` | Verifies `x-hub-signature-256` HMAC-SHA256; deduplicates via `InboundWebhookReceipt`. |
| **Stripe Payments** | `src/lib/commerce-policy.ts`, `src/app/api/webhooks/stripe/route.ts` | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | Verifies `stripe-signature` HMAC-SHA256 with 300s replay window; PayPal/SSLCommerz remain `INTEGRATION_NOT_BUILT`. |
| **External Model Providers** | `src/lib/agents/model-provider.ts`, `src/lib/agents/provider-selection.ts` | `OPENAI_API_KEY`, `GEMINI_API_KEY`, `GROQ_API_KEY`, `OPENROUTER_API_KEY`, `AI_GATEWAY_BASE_URL`, `ZAI_API_KEY` | Priority selectable via `AI_PROVIDER`; returns `PROVIDER_NOT_CONFIGURED` when unset. |

---

## 21. Environment Configuration

Use placeholders only — never commit real secrets to Git:

```bash
# A. Required for Core Application
NODE_ENV=production
NEXT_PUBLIC_APP_URL=https://bdtech360.com
DATABASE_URL=<CONFIGURE_IN_SECURE_ENVIRONMENT>
SESSION_SECRET=<CONFIGURE_IN_SECURE_ENVIRONMENT>
PORTAL_SECRET=<CONFIGURE_IN_SECURE_ENVIRONMENT>
CSRF_SECRET=<CONFIGURE_IN_SECURE_ENVIRONMENT>

# B. Required for Production Operations & Cron/Ops Endpoints
OPS_SECRET=<CONFIGURE_IN_SECURE_ENVIRONMENT>
CRON_SECRET=<CONFIGURE_IN_SECURE_ENVIRONMENT>
BACKUP_ENCRYPTION_KEY=<CONFIGURE_IN_SECURE_ENVIRONMENT>

# C. Required for External Communication & Payments
HOSTINGER_MAIL_ENABLED=true
HOSTINGER_MAIL_API_TOKEN=<CONFIGURE_IN_SECURE_ENVIRONMENT>
SMTP_HOST=<CONFIGURE_IN_SECURE_ENVIRONMENT>
SMTP_PORT=587
SMTP_USER=<CONFIGURE_IN_SECURE_ENVIRONMENT>
SMTP_PASS=<CONFIGURE_IN_SECURE_ENVIRONMENT>
SMTP_FROM=info@bdtech360.com
EMAIL_WEBHOOK_SECRET=<CONFIGURE_IN_SECURE_ENVIRONMENT>
WHATSAPP_TOKEN=<CONFIGURE_IN_SECURE_ENVIRONMENT>
WHATSAPP_PHONE_NUMBER_ID=<CONFIGURE_IN_SECURE_ENVIRONMENT>
WHATSAPP_VERIFY_TOKEN=<CONFIGURE_IN_SECURE_ENVIRONMENT>
WHATSAPP_APP_SECRET=<CONFIGURE_IN_SECURE_ENVIRONMENT>
STRIPE_SECRET_KEY=<CONFIGURE_IN_SECURE_ENVIRONMENT>
STRIPE_WEBHOOK_SECRET=<CONFIGURE_IN_SECURE_ENVIRONMENT>
N8N_WEBHOOK_SECRET=<CONFIGURE_IN_SECURE_ENVIRONMENT>

# D. Optional Model / Automation Providers
AI_PROVIDER=openai
OPENAI_API_KEY=<CONFIGURE_IN_SECURE_ENVIRONMENT>
GEMINI_API_KEY=<CONFIGURE_IN_SECURE_ENVIRONMENT>
GROQ_API_KEY=<CONFIGURE_IN_SECURE_ENVIRONMENT>
OPENROUTER_API_KEY=<CONFIGURE_IN_SECURE_ENVIRONMENT>
AI_GATEWAY_BASE_URL=<CONFIGURE_IN_SECURE_ENVIRONMENT>
AGENTOS_GATEWAY_TOKEN=<CONFIGURE_IN_SECURE_ENVIRONMENT>
ZAI_BASE_URL=<CONFIGURE_IN_SECURE_ENVIRONMENT>
ZAI_API_KEY=<CONFIGURE_IN_SECURE_ENVIRONMENT>
```

---

## 22. Deployment and Release Management

```bash
# 1. Validate production environment variables (fails closed on missing required secrets)
npm run env:validate:strict

# 2. Verify Prisma MySQL schema & migration immutability
npm run schema:check
npm run migrations:check

# 3. Generate Prisma client and deploy pending migrations to MySQL 8.0
npx prisma generate
npx prisma migrate deploy

# 4. Run lint, typecheck, and production build
npm run lint
npm run typecheck
npm run build

# 5. Start production server
npm run start
```

---

## 23. Database Maintenance

- Check migration alignment: `node scripts/migration-doctor.mjs`
- Reconcile failed migrations safely without data loss: `node scripts/reconcile-migrations.mjs`
- Verify schema parity between MySQL (`prisma/schema.prisma`) and SQLite preview: `npm run schema:check`

---

## 24. Backup and Restore

```bash
# Create a timestamped, SHA-256 verified logical MySQL backup:
bash scripts/backup-db.sh

# Verify backup integrity and restore into an isolated staging database:
bash scripts/restore-db.sh <path-to-backup.sql.gz>
```

---

## 25. Security Incident Response

1. **Suspected Credential Leak**: Rotate `SESSION_SECRET`, `PORTAL_SECRET`, and affected provider keys in GCP Secret Manager; revoke active sessions by truncating `Session` rows (`DELETE FROM Session;`).
2. **Quarantined Upload Alert**: Inspect flagged `FileRecord` in `/#admin` → Documents (`GET /api/admin/documents?clientId=...`) and reject (`POST /api/admin/documents/[id]/status` with `{"action": "REJECT"}`) to purge bytes while retaining the audit verdict.
3. **Runaway Automation**: Trigger `PATCH /api/admin/agents/[code]` (`{"action": "pause"}`) or set `AI_PROVIDER=none`.

---

## 26. Error Monitoring and Troubleshooting

- **Health Endpoints**:
  - `GET /api/health` — Liveness probe (`200 OK`).
  - `GET /api/health/deep` — Deep readiness probe (database connectivity, migration state, provider config).
- **Error Log Console**: `/#admin` → Logs (`GET /api/admin/logs/errors`), resolved via `POST /api/admin/logs/errors/[id]/resolve`.

---

## 27. Common Operational Problems

| Symptom | Root Cause | Resolution |
|---|---|---|
| `HTTP 403 DCC_CERTIFICATION_REQUIRED` on Agent Creation | Target department lacks a fresh (<30d) passing 9-metric DCC assessment. | Populate department SOP/Skill/Knowledge/KPI evidence and run `POST /api/admin/dcc`. |
| `HTTP 409 ADMIN_APPROVAL_REQUIRED` on Outbound Email | Email contains consequential financial/legal/handover content without a bound Super Admin approval. | Approve the generated request in `/#admin` → Approvals, then re-send with `approvalId`. |
| `HTTP 403 UNAPPROVED_EMAIL_DESTINATION` | Recipient email is neither `client.email` nor an active `AUTHORIZED` destination for that client. | Authorize the destination via `recordEmailDestination()` with documented consent evidence. |
| `HTTP 429 RATE_LIMITED` | Caller exceeded per-IP rate limit window. | Wait for the rate-limit window to reset (`Retry-After`). |

---

## 28. Recovery and Rollback Procedures

```bash
# 1. Verify historical recovery integrity (174 historical runs + 95 files)
npm run check:recovery

# 2. Application code rollback to previous known-good commit
git revert <commit-sha>
# Or roll back Cloud Run revision to previous traffic-serving revision:
gcloud run services update-traffic tech360-web --to-revisions=<PREVIOUS_REVISION>=100 --region=us-central1
```

---

## 29. Manual Setup Requirements Summary

Before production cutover, TECH360 human operators must complete:
1. Provision production MySQL 8.0 (`DATABASE_URL`) and run `npx prisma migrate deploy`.
2. Configure `SESSION_SECRET`, `PORTAL_SECRET`, `CSRF_SECRET`, `OPS_SECRET`, and `N8N_WEBHOOK_SECRET` in GCP Secret Manager.
3. Configure Hostinger Mail API (`HOSTINGER_MAIL_API_TOKEN`) or SMTP (`SMTP_HOST`, `SMTP_USER`, `SMTP_PASS`) and verify SPF/DKIM/DMARC DNS records for `bdtech360.com`.
4. Configure Stripe (`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`) and Meta WhatsApp Cloud API (`WHATSAPP_TOKEN`, `WHATSAPP_APP_SECRET`) if live checkout/WhatsApp is desired.
5. Configure at least one external model provider key (`OPENAI_API_KEY`, `GEMINI_API_KEY`, or `GROQ_API_KEY`) if live model inference is desired.

---

## 30. Acceptance and Release Checklist

- [x] `npm run lint` passes (`0` errors)
- [x] `npm run typecheck` passes (`0` errors)
- [x] `npm run schema:check` passes (`provider = "mysql"`, `243` native annotations)
- [x] `npm run migrations:check` passes (`19` immutable migrations)
- [x] `npm run check:recovery` & `npm run check:conflicts` & `npm run check:assets` pass
- [x] `npm run verify:ai` passes (`66 / 66` checks, `396 / 396` per-agent checks)
- [x] `npm run test:offline` passes (`392` suites / `1,727` tests, `0` failures)
- [ ] Live Production MySQL (`DATABASE_URL`) migration & smoke test executed by Super Admin (`BLOCKED` until production credentials are attached)
- [ ] Live external provider keys configured and verified in production (`NOT_CONFIGURED` in offline sandbox)
