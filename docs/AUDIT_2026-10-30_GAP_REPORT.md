# Tech360 — Repository Audit and Gap Report

**Date:** 2026-10-30
**Branch:** `arena/35a29cec-tech360` (branched from `main` @ `3c10b6c`)
**Method:** read-only static inspection of this checkout, plus local
`npm ci`, `eslint`, `tsc --noEmit` and the full `tsx --test` suite.
**Scope:** the entire repository — schema, API surface, auth/RBAC, CRM, Client ID
system, agent workforce, WhatsApp/email automation, payments, deployment.

> **Evidence boundary.** Every count below was produced by a command in this
> checkout, not copied from earlier project documents. Statements marked
> **NOT VERIFIED** mean no evidence exists in this session (typically: a live
> host, provider credentials, or a generated Prisma client). Prior documents
> quoted 43 models / ~110 routes; the tree now contains **75 models and 201
> route handlers**, so the older figures are stale.

---

## 1. Verified inventory

| Area | Measured | Command basis |
|---|---|---|
| Prisma models | **75** | `grep -c '^model ' prisma/schema.prisma` |
| Committed migrations | **14** | `ls prisma/migrations` |
| API route handlers | **201** (`route.ts` under `src/app/api`) | `find src/app/api -name route.ts \| wc -l` |
| Source files (`.ts`/`.tsx`) | **506** | `find src -name '*.ts*'` |
| Admin views | 40 React modules under `src/components/admin` | directory listing |
| Registered AI agents | **43** unique codes (`CEO-001` … ) | parse of `src/lib/agents/registry.ts` |
| Pipeline stages | 20 | `PIPELINE_STAGES` in `src/lib/constants.ts` |
| Unit/integration tests | **978 tests / 102 files** at baseline | `tsx --test tests/**/*.test.ts` |

**Baseline health (before this branch's changes):**

| Gate | Result |
|---|---|
| `npm ci --no-audit --no-fund` | PASS |
| `npx eslint .` | PASS (0 errors, 0 warnings) |
| `npx tsc --noEmit` | PASS — but see caveat below |
| `npx tsx --test tests/**/*.test.ts` | **941 pass / 10 fail** (pre-existing) |
| `npm run build` | **BLOCKED locally** — `prisma generate` cannot reach `binaries.prisma.sh` in this sandbox |

**Typecheck caveat (important):** `node_modules/.prisma/client` in this sandbox
is the placeholder stub that ships with `@prisma/client` (`PrismaClient: any`).
`tsc` therefore passes without validating any Prisma query shape. The public
project documents record this as blocker **B-005**. Type safety for Prisma calls
is **NOT VERIFIED** locally; CI against a real generated client is the only
valid evidence.

**Pre-existing test failures (not caused by this branch, reproduced on a clean
stash):** `communication-pipeline` (2 copy assertions), `governance-db`,
`governance-outbound-db`, `database-workflows`, `inbound-sync`,
`hostinger-mail-client-boundary` — the latter four require a generated Prisma
client or a live MySQL instance. The two `communication-pipeline` failures assert
welcome-email copy that the current templates no longer contain; they are a real
copy/template drift finding, tracked as **G-07** below.

---

## 2. Requirement disposition

Legend: **DONE** = implemented and evidenced in source · **PARTIAL** = partially
implemented or unverified · **MISSING** = not present · **N/A** = not applicable
to this stack.

### 2.1 Work examples

| Requirement | Status | Evidence / gap |
|---|---|---|
| Display premium examples with images | **MISSING → DONE (this branch)** | Only 8 text-only "illustrative scenarios" existed (`CASE_STUDIES`), no imagery, and the 12 requested systems were absent. Added 12 system showcases with generated self-hosted visuals. |
| eCommerce, Education CRM, School ERP, Clinic System, Real Estate CRM, Agency Portal, AI Automation, WhatsApp Sales Funnel, Social Automation, Lead Management, Client Portal, Custom Dashboard | **MISSING → DONE** | `src/data/work-examples.ts` + `src/components/site/WorkExamples.tsx`, wired into `WorkView`. |
| Imagery hosting | **RISK → IMPROVED** | `src/data/images.json` referenced an external CDN (`z-cdn.chatglm.cn`). New gallery uses local files under `public/images/work/`. The older CDN dependency remains for other pages — see **G-04**. |

### 2.2 Contact system

| Requirement | Status | Evidence |
|---|---|---|
| Save into CRM | DONE | `POST /api/contact` → `intakeLead()` creates `Client` + `Lead` + `Communication`. |
| Generate Lead ID | **MISSING (concept mismatch)** | Leads are keyed by `Client.clientId`; no separate `LEAD-…` identifier exists. The Client ID doubles as the lead reference. No change made — introducing a second identifier would fragment the record. |
| Generate Client ID | DONE | `src/lib/ids.ts` — monotonic `SequenceCounter`, `TECH-YYYY-NNNNNN`, concurrency-safe, never reuses deleted/merged IDs. |
| Send email | DONE (config-gated) | Pipeline `FIRST_MESSAGE` stage; provider acceptance **NOT VERIFIED**. |
| Send WhatsApp | DONE (config-gated) | Same pipeline; Meta Cloud API webhook + templates present. **NOT VERIFIED** live. |
| Create CRM task | **MISSING → DONE** | `persistLeadFollowUp()` reuses the existing human-task mechanism (`ProjectTask` when a project exists, `Notification` before that). |
| Create follow-up schedule | **MISSING → DONE** | `planFirstFollowUp()` + schedule persisted in `Lead.tracking.followUp` (no migration). |
| Track source | PARTIAL → DONE | Previously only `ref` + hash path. Now source/medium/campaign/term/content, click IDs, referrer host, landing path. |
| Store UTM parameters | **MISSING → DONE** | `extractAttribution()` allowlist + first-touch capture in `attribution-client.ts`. |
| Store IP | DONE | `FormSubmission.ip`, `AuditLog`. |
| Store device | **MISSING → DONE** | `parseUserAgent()` → DESKTOP/MOBILE/TABLET/BOT. |
| Store browser | **MISSING → DONE** | `parseUserAgent()` → browser + OS. |
| Store location | **MISSING → DONE (coarse)** | Country/region/city from trusted edge headers only; **no geo-IP API call**, no coordinates. Absent headers store `null`, never a guess. |

### 2.3 Client ID system

| Requirement | Status |
|---|---|
| `TECH-2026-000001` format | DONE |
| Auto-generated | DONE |
| Never duplicated | DONE — atomic increment + unique constraint + concurrency test |

### 2.4 Super Admin CRM and roles

| Requirement | Status |
|---|---|
| Private console, login required | DONE — `/#/admin`, session cookie, CSRF, `guard()` on every admin route |
| Role-based access control | DONE — `ROLE_RANK` + `ROLE_CAPABILITIES` (21 capabilities) + per-view min role |
| SUPER_ADMIN, ADMIN, SALES, PROJECT_MANAGER, DEVELOPER, FINANCE, SUPPORT | DONE |
| MANAGER, AUDITOR, STAFF (extra) | DONE |
| **MARKETING, DESIGNER** | **MISSING → DONE (this branch)** — added at staff rank with restricted capability sets |
| **CLIENT** | **NOT IN STAFF ROLES — by design** | Clients authenticate through the separate portal (`/#/portal`, OTP session, `PORTAL_SECRET`). Adding a `CLIENT` value to the staff `ROLES` array would let the team API mint console users whose access depends on rank rather than on the portal's ownership checks. Documented as **G-02** rather than implemented unilaterally. |

### 2.5 AI Command Center and agents

| Requirement | Status |
|---|---|
| Command center, chat, task/agent queues, logs, knowledge base, memory, workflow monitor, activity timeline, cost tracking | DONE (source) — `/#/admin` → Command Center, `AiMemory`, `KnowledgeDocument`, `AgentJob`, `AgentEvent`, `AutomationLog` |
| 20 named agents (CEO, Sales, Communication, WhatsApp, Email, Lead, Business Type, Scope, Proposal, Meeting, Payment, Delivery, Evidence, Content, Design, Video, Knowledge, Memory, Error Monitor, Admin Approval) | **DONE and exceeded** — 43 registered agents cover every requested function plus finance, QA, DevOps, security and research. The requested list is a subset; no agent is missing. |
| Super Admin only | DONE — `AI_WORKFORCE_MIN_ROLE = 'SUPER_ADMIN'` |
| Live inference | **NOT VERIFIED / config-gated** — fails closed without `ZAI_*` or `OPENROUTER_API_KEY` (**G-05**) |

### 2.6 Full automation flow (25-step journey)

**DONE in source** for the pipeline stages that drive these steps: lead received →
saved → Client ID → business detection → requirement collection → AI scope draft →
admin approval gate → proposal → WhatsApp/email delivery → meeting → HTML preview →
client approval → invoice → payment tracking → project → tasks → development → QA →
delivery → handover → password-change confirmation → review request → referral
request → closure. Evidence: `PIPELINE_STAGES` (20 states), `src/lib/journey.ts`,
`ScopeApproval`, `Preview`, `Delivery`, `HandoverRecord`, approval gates in
`src/lib/governance/enforce.ts`.

**Honest limit:** the *sequence logic* is implemented; **provider delivery is not
certified**. No WhatsApp/email/SMS provider has been exercised in this session
(**G-01**), so "first message to final delivery" is verified as code paths, not as
a live end-to-end run.

### 2.7 WhatsApp

| Requirement | Status |
|---|---|
| Meta Cloud API ready | DONE (source) — `src/app/api/webhooks/whatsapp`, signature + replay protection (`InboundWebhookReceipt`) |
| Templates | DONE — `/api/admin/whatsapp/templates` |
| Chat logs / message history / media | DONE — `Communication`, `ChatMessage`, media handling in `src/lib/media` |
| Inbox / reply | DONE — `whatsapp/inbox`, `whatsapp/reply` |
| Broadcast | **PARTIAL** — no dedicated broadcast route; bulk sending is covered by campaigns/newsletter, not by a WhatsApp broadcast module. Tracked **G-03**. |
| Follow-up automation | DONE for chat (`conversation-state.ts`) + **added** for new leads (follow-up schedule) |

### 2.8 Email

| Requirement | Status |
|---|---|
| SMTP | DONE — `src/lib/mail`, `nodemailer` |
| Templates | DONE — `PromptTemplate`, `src/lib/pipeline/templates.ts` |
| Delivery status | DONE — provider result persisted in `EmailLog`-equivalent records / `Communication.status` |
| Open tracking | **PARTIAL** — newsletter open/click routes exist (`/api/newsletter/track/open`, `/click`); per-transactional-email open tracking is not implemented. |
| Follow-up sequences | PARTIAL — sequence logic exists for campaigns; lead-level sequence **added** via the follow-up schedule |

### 2.9 Database

All requested tables exist under different names (Prisma models), verified in
`schema.prisma`: `User`, `Session`, (`Role`/`Permission` are **not** tables —
RBAC is code-level capability maps), `Client`, `Lead`, `Project`, `ProjectTask`,
`Payment`, `Invoice`, `ScopeOfWork` + `ScopeApproval`, `ApprovalRequest`,
`Communication` (whatsapp_logs/email_logs unified by `channel`), `AiAgentExecution`
+ `AgentEvent` (ai_logs/agent_logs), `KnowledgeDocument`, `AiMemory`,
`FileRecord` (documents), `AuditLog`, `Notification`, `AutomationLog`, `Setting`.

**Structural note:** `roles` and `permissions` are *not* database tables. Role
values are constrained by `ROLES` in code and capabilities by
`ROLE_CAPABILITIES`. This is a deliberate design (no runtime role editing) and is
recorded here so the requirement is not mistaken for a missing table.

### 2.10 Security

| Control | Status |
|---|---|
| PDO / prepared statements | **N/A** — no PHP. Equivalent: Prisma parameterised queries. |
| CSRF | DONE — `t360_csrf` cookie + `assertCsrf` on mutations |
| XSS protection | DONE — sanitised inputs, React escaping, `escapeHtml` in documents |
| Rate limiting | DONE — `rateLimit()` per IP+bucket, used by `guard()` and `/api/contact` |
| Session security | DONE — HttpOnly cookie, 12 h TTL, must-change-password gate, login lockout |
| Audit logging | DONE — `AuditLog` + `audit()` on privileged/public actions |
| File validation | DONE — `src/lib/files.ts`, classification + scan status |
| HTTPS enforcement | DONE — redirect on `X-Forwarded-Proto: http`, HSTS, canonical origin redirect |
| Security headers | DONE — `next.config.ts` (nosniff, frame options, referrer policy, permissions policy, HSTS) |
| Password hashing | DONE — scrypt (`hashPassword`), constant-time compare |
| Upload protection | DONE — classification + auth-gated download routes |

### 2.11 Installer and cPanel

| Requirement | Status |
|---|---|
| `install.php` + PHP wizards | **N/A / not implemented** — the runtime is Node.js. A PHP file cannot run migrations or create the admin. Replaced by `scripts/install.mjs`. |
| Database setup wizard | **DONE (this branch)** — `npm run install:app` runs `migrate deploy` with preflight validation |
| Admin creation wizard | **DONE** — idempotent seed, env-driven, refuses weak passwords |
| System configuration wizard | **DONE** — required env + secret-strength validation, no values printed |
| SMTP / WhatsApp / AI configuration | **DONE (reporting)** — configuration state reported per integration; explicitly *not* an "active" claim |
| cPanel deployment guide | **MISSING → DONE** — `docs/CPANEL_DEPLOYMENT.md` |
| "No code edits required" | **DONE** — the installer is environment-driven |

---

## 3. Prioritised gap report

### P0 — correctness / production risk (act before any deploy)

| ID | Gap | Impact | Status in this branch |
|---|---|---|---|
| G-01 | No provider has been exercised (SMTP, WhatsApp, SMS, AI). Every "live" claim is config-gated. | Cannot certify automation end-to-end. | **Open** — requires credentials + acceptance tests. |
| G-05 | Prisma client generation blocked in this sandbox; `tsc` passes against the `any` stub. | Prisma query errors are not caught locally. | **Open** — CI with a real client is the gate. |
| G-06 | `npm run build` cannot run here (engine download TLS). | No local build evidence. | **Open** — must run on CI/host. |

### P1 — material functional gaps

| ID | Gap | Action taken |
|---|---|---|
| G-07 | `communication-pipeline` welcome-email assertions fail: template copy drifted from the documented policy text. | **Open** — flagged; fixing copy needs an owner decision on final wording. |
| G-04 | `src/data/images.json` still points at an external image CDN for 21 sections. | **Open** — the new work gallery is self-hosted; migrating the rest is a follow-up. |
| G-08 | No separate Lead ID (see 2.2). | **Documented**, not implemented — deliberate. |

### P2 — requested-but-scoped-out

| ID | Gap | Rationale |
|---|---|---|
| G-02 | `CLIENT` absent from staff `ROLES` | Portal handles client auth; adding it to the console role list is a security decision, not a code detail. |
| G-03 | No dedicated WhatsApp broadcast module | Bulk sending exists via campaigns; a broadcast UI needs Meta template-category rules and opt-out handling before it is safe to ship. |
| G-09 | Per-transactional-email open tracking | Newsletter tracking exists; extending it to transactional mail affects privacy posture and needs a policy decision. |

### P3 — improvement backlog

- Persist attribution on the **chat** intake path too (currently website form only).
- Surface "follow-up overdue" as a dashboard counter (data now exists in `Lead.tracking`).
- Add a role-matrix page generated from `ROLE_CAPABILITIES` so docs cannot drift.
- Replace remaining external CDN images with self-hosted assets.

---

## 4. Changes made on this branch

### 4.1 New files

| File | Purpose |
|---|---|
| `src/data/work-examples.ts` | 12 system showcases, typed, with honesty contract + `outOfScope` per entry |
| `src/components/site/WorkExamples.tsx` | Premium gallery: filters, asymmetric grid, accessible detail dialog, visible honesty notice |
| `src/lib/intake-context.ts` | Pure attribution/device/location extraction (allowlist, bounded, header-only geo) |
| `src/lib/lead-followup-policy.ts` | Pure follow-up scheduling policy |
| `src/lib/lead-followup.ts` | Persistence: `Lead.tracking.followUp` + CRM task |
| `src/lib/attribution-client.ts` | First-touch UTM capture (sessionStorage, allowlist) |
| `public/images/work/*.jpg` | 12 generated concept visuals, self-hosted |
| `scripts/install.mjs` | Four-phase installer/preflight (`install:check`, `install:app`) |
| `docs/CPANEL_DEPLOYMENT.md` | cPanel deployment guide with honest host requirements |
| `tests/intake-context.test.ts`, `tests/lead-followup-policy.test.ts`, `tests/role-expansion.test.ts`, `tests/work-examples.test.ts` | 37 new assertions over the new behaviour |

### 4.2 Modified files

| File | Change |
|---|---|
| `src/app/api/contact/route.ts` | Captures intake context; stores attribution/device/location on the submission and the lead; schedules the first follow-up and creates the CRM task; records the outcome in the audit log |
| `src/components/site/ContactView.tsx` | Sends first-touch UTM payload instead of raw hash |
| `src/components/site/WorkView.tsx` | Renders the gallery above the existing illustrative scenarios; visible section heading; both sections retained |
| `src/components/admin/ClientDetailView.tsx` | New attribution / device / location / follow-up panel inside "Lead Intake" (shows "Not captured" rather than hiding gaps) |
| `src/lib/admin-client.ts` | `LeadRecord` gains `tracking` and `sourceDetails` |
| `src/lib/constants.ts` | `ROLES` += `MARKETING`, `DESIGNER`; `ROLE_RANK` entries |
| `src/lib/access-policy.ts` | Capability sets for `MARKETING` and `DESIGNER` |
| `src/lib/journey.ts` | `createHumanTask` exported so there is one task implementation (no behaviour change) |
| `package.json` | `install:check`, `install:app` scripts |
| `tests/operating-model-hardening.test.ts` | Role list extended; title de-hardcoded |

### 4.3 Explicitly not changed

- No Prisma schema change and **no migration** — attribution and follow-up reuse
  existing JSON columns, so a production `migrate deploy` has nothing new to apply.
- No existing page, route, model, agent, template or test assertion was removed.
- No DreamFrame content, frames, image/video generation or 3D creator was added.
- No provider was marked active; no credential was invented or stored.

---

## 5. Verification evidence

| Check | Result |
|---|---|
| `npx eslint .` | **PASS** (0 errors, 0 warnings) |
| `npx tsc --noEmit` | **PASS** (with the Prisma-stub caveat in §1) |
| `npx tsx --test tests/**/*.test.ts` | 1015 tests, 977 pass, 10 pre-existing failures (same set as baseline) |
| Baseline comparison | 978 tests / 941 pass / 10 fail → the 10 failures are unchanged in identity |
| `node scripts/install.mjs --check` | Exits 1 with a correct, non-secret failure list on an unconfigured tree; exits 0 with a fully configured dummy environment |
| `npm run build` | **NOT RUN** — sandbox cannot download Prisma engines (G-06) |

The new gallery and panel are covered by unit tests and lint/typecheck; **visual
browser verification was not performed in this session** and is listed as an open
item rather than claimed.

---

## 6. What remains before a production claim

1. Run `npm run build` + `npm run start:check` on a host with npm registry and
   Prisma engine access; attach the log.
2. Configure SMTP, WhatsApp and AI in the host environment, then run one real
   send per channel and record the provider response.
3. Apply the installer on the target host (`npm run install:app`) and capture
   `/api/health`.
4. Decide G-02 (CLIENT role) and G-03 (WhatsApp broadcast) with the owner.
5. Fix G-07 (welcome-email copy drift) with the approved final wording.
