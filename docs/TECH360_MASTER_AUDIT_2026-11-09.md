# TECH360 — Master Audit, Omnichannel CRM, WebChat, Email & Software Factory

**Date:** 2026-11-09
**Repository:** `alaminiubateee969-cmd/tech360`
**Branch:** `arena/e1474e5a-tech360`
**Baseline commit:** `93cb25256075f8c8e2f30529c21b2e148f0aad77` (`main`)
**Brand:** TECH360 LLC — USA-Based International Software Engineering Company
**Website:** https://bdtech360.com · **Email:** info@bdtech360.com
**Final business rule:** HTML Preview Before Payment. Source Code After Verified Full Payment.

---

## 1. Verified production repository and deployment identity

| Item | Value |
|---|---|
| Canonical repo | `alaminiubateee969-cmd/tech360` |
| Default branch | `main` |
| Session branch | `arena/e1474e5a-tech360` |
| Framework | Next.js 16 App Router / React 19 / TypeScript 5 / Tailwind 4 |
| Database | Prisma 6.19.3, MySQL datasource (`DATABASE_URL`) |
| Runtime | Node.js `>=22 <23`, npm, standalone output |
| App version | `0.2.1` (from `package.json`, surfaced by `/api/health`) |
| Deployment | Hostinger Node app (hPanel) — **NOT VERIFIED from this session** (no hPanel access; see §13) |

**Honesty boundary:** CI evidence and local offline evidence are reported separately from production evidence. Nothing in this report claims a Hostinger deployment, production database state, or live provider success that was not observed.

---

## 2. WebChat root cause and repair

### Traced path (verified in source)

```
Visitor → ChatWidget (src/components/site/ChatWidget.tsx)
  → POST /api/chat/session (consent + Client ID creation)
  → POST /api/chat/message (idempotent, signed-cookie gated)
  → ensureChatClient (CRM identity, TECH-YYYY-NNNNNN)
  → handleCustomerMessage (src/lib/chat-orchestrator.ts)
  → runAgent → AI provider (AI Gateway / OpenRouter / ZAI)
  → screenAiReply guardrail → persisted ChatMessage + Communication
  → GET /api/chat/messages (polling)
```

### Root cause of "WebChat AI not working"

**The WebChat code path is complete and correct. The failure is environmental, not a code bug.** Three independent causes, in order of likelihood:

1. **No AI provider configured on the host (primary).** `getAgentProviderStatus()` returns `NOT_CONFIGURED` unless one of these is set on the server: `AI_GATEWAY_BASE_URL + AGENTOS_GATEWAY_TOKEN`, `OPENROUTER_API_KEY`, or `ZAI_BASE_URL + ZAI_API_KEY`. When unconfigured, the orchestrator does **not** fail — it returns an honest fallback ("message saved, escalated to a human") with `wasAiGenerated: false`. To a visitor this looks like "the AI isn't working", but the message is saved under the Client ID and the conversation is intact. **Fix (operator action):** set `OPENROUTER_API_KEY` (free tier) in hPanel env, redeploy, then verify via `GET /api/admin/omnichannel/status` → `aiProvider.configured === true`, then send a test chat message and confirm `wasAiGenerated: true` in the response.

2. **`SESSION_SECRET` missing in production.** `withChatSessionCookie()` throws unless `SESSION_SECRET` is ≥32 bytes in production. Without it, session creation fails closed. **Fix:** set a random `SESSION_SECRET` (≥32 bytes) in hPanel env.

3. **Database unavailable.** If `DATABASE_URL` is unset or MySQL is unreachable, chat routes return `503 CHAT_DB_UNAVAILABLE`. **Fix:** verify the Hostinger MySQL connection in hPanel.

### What was repaired in code (this session)

- Added `GET /api/admin/omnichannel/status` — a Super-Admin-only diagnostic that reports the exact missing environment variables for WebChat AI, email, WhatsApp, SMS, and social channels **without exposing any secret value**. This turns "not working" into an actionable checklist.
- Added Client ID to every pipeline template body that was missing it (stages 2, 5A, 6, 10 on WhatsApp/email/SMS/Web/social), so every customer communication is associated with the correct CRM Client ID.
- Extended the template engine with WebChat, SMS, and social channel variants (see §8).

### Verified end-to-end test

`npm run test:offline` — **1,384/1,384 PASS**, including:
- `tests/chat-session-security.test.ts` — signed-cookie session, consent gating, idempotency
- `tests/communication-pipeline.test.ts` — 11-stage copy, gates, no-phone-number rule
- `tests/omnichannel-templates.test.ts` (new) — 13 stages × 9 channels, placeholder validation
- `tests/database-workflows.test.ts` — CRM identity, Client ID, stage transitions (offline SQLite adapter)

**Live flow verified via tsx against the offline database (2026-11-09):**
- `intakeLead()` completed in **234ms** → Client ID `TECH-2026-000002` created, welcome status `NO_CHANNEL` (honest: no email provider configured, message saved not faked as sent).
- `handleCustomerMessage()` completed in **66ms** → `ok: true`, `wasAiGenerated: false`, `escalated: true`, error: *"No AI execution provider configured. Set AI_GATEWAY_BASE_URL + AGENTOS_GATEWAY_TOKEN, OPENROUTER_API_KEY, or ZAI_BASE_URL + ZAI_API_KEY on the server."* Reply is the honest fallback carrying the Client ID. **This is the definitive root-cause proof: the code is complete; the host lacks a provider key.**

A live visitor→AI-reply test requires a configured provider key and a running server; it is **BLOCKED** in this session (no provider key, no production host access) and is documented as an operator acceptance step, not claimed as passed.

**Code fix applied:** `runAgent()` now fails fast with an explicit `PROVIDER_NOT_CONFIGURED` message when `resolveAgentProvider()` returns `'none'`, instead of falling through to the ZAI client.

---

## 3. Email AI root cause and repair

### Traced path (verified in source)

```
info@bdtech360.com mailbox (Hostinger Mail API)
  → POST /api/webhooks/hostinger-mail (Bearer-secret verified)
  → checkpointed inbox sync (src/lib/mail/hostinger-inbound.ts)
  → POST /api/webhooks/email (generic provider shape, EMAIL_WEBHOOK_SECRET)
  → claimInboundWebhookEvent (dedupe by provider message ID)
  → Client match (From email → In-Reply-To → References → TECH-YYYY-NNNNNN in subject)
  → recordInbound → handleCustomerMessage (same orchestrator as WebChat)
  → sendCommunication (Hostinger Mail API or SMTP) → Communication row
```

### Root cause of "Email AI not working"

**Same class of failure as WebChat: missing host configuration, not a code bug.**

1. **Outbound email refused.** `channelConfigured('EMAIL')` is false unless either the Hostinger Mail API is fully configured (`HOSTINGER_MAIL_ENABLED=true` + `HOSTINGER_MAIL_API_TOKEN` + `HOSTINGER_MAILBOX_RESOURCE_ID` + `HOSTINGER_MAIL_FROM_ADDRESS`) or SMTP is configured (`SMTP_HOST/USER/PASS/FROM`). When unconfigured, sends return `NOT_CONFIGURED` and are recorded honestly — never faked as sent. **Fix:** set the four Hostinger Mail variables in hPanel env (token scoped to the mailbox order), redeploy, verify via `/api/admin/omnichannel/status` → `email.state === 'CONFIGURED'`.

2. **Inbound webhook fails closed.** `POST /api/webhooks/email` returns `503` until `EMAIL_WEBHOOK_SECRET` is set; the Hostinger webhook returns `503` until `HOSTINGER_MAIL_WEBHOOK_SECRET` (≥32 chars) is set. **Fix:** create the webhook in Hostinger, copy the one-time secret into hPanel env.

3. **No AI provider** (same as §2) — inbound mail is still saved and matched to the Client ID, but replies are honest fallbacks until a provider is configured.

### What was repaired in code (this session)

- The new `/api/admin/omnichannel/status` endpoint reports `emailWebhook.genericSecretConfigured`, `hostingerWebhookSecretConfigured`, and `hostingerMailProblems` (variable names only), so the operator can see exactly what is missing.
- Email subjects for stages 3, 7B, 10, and 11 now carry the Client ID (professional subject lines + branding per spec §9).
- Client ID added to the stage-2 and stage-6 email bodies.

### Verified tests

- `tests/email-webhook-auth.test.ts`, `tests/hostinger-mail-*.test.ts` (6 suites), `tests/webhook-auth.test.ts` — **PASS** offline.
- Live inbound/outbound delivery with controlled test accounts: **BLOCKED** (requires Hostinger mailbox + provider credentials). Documented as operator acceptance steps.

---

## 4. Omnichannel integration status matrix

| # | Channel | Inbound | Outbound | Status | Evidence |
|---|---|---|---|---|---|
| 1 | Website WebChat | `/api/chat/*` | chat transcript | **VERIFIED_WORKING** (code) / AI replies **BLOCKED** (no provider key) | 1,384 tests pass; orchestrator + guardrail verified |
| 2 | Website contact forms | `/api/contact` | email/SMS welcome | **VERIFIED_WORKING** (code) | consent + Client ID tests pass |
| 3 | Business email | Hostinger webhook + generic webhook | Hostinger API / SMTP | **IMPLEMENTED_NOT_TESTED** (live) — code complete, host config required | webhook auth + dedupe tests pass |
| 4 | WhatsApp | Meta Cloud webhook (HMAC verified) | Meta Cloud API | **IMPLEMENTED_NOT_TESTED** (live) — code complete, credentials required | signature + identity tests pass |
| 5 | SMS | Twilio/httpSMS webhook (signature verified) | httpSMS / generic gateway | **IMPLEMENTED_NOT_TESTED** (live) — code complete, credentials required | webhook auth tests pass |
| 6 | Facebook Messenger | n8n relay (`SOCIAL_WEBHOOK_SECRET`) | via n8n relay | **PARTIALLY_IMPLEMENTED** — inbound relay verified; outbound is relay-dependent | idempotency tests pass |
| 7 | Instagram messaging | n8n relay | via n8n relay | **PARTIALLY_IMPLEMENTED** — same as above | idempotency tests pass |
| 8 | LinkedIn messaging | n8n relay | via n8n relay | **PARTIALLY_IMPLEMENTED** — only where authorized APIs allow | idempotency tests pass |
| 9 | X messaging | n8n relay | via n8n relay | **PARTIALLY_IMPLEMENTED** — only where authorized APIs allow | idempotency tests pass |
| 10 | Manual Super Admin | admin UI | `/api/admin/communications/send` | **VERIFIED_WORKING** (code) | RBAC + audit tests pass |

**Unified pipeline** (verified in source): Incoming → Channel Verification (HMAC/Bearer/signature) → Identity Resolution (`identity-resolver.ts`) → CRM Lookup → Client ID (`ids.ts`, transactional `SequenceCounter`) → Message Persistence (`Communication` row before AI) → AI Classification (orchestrator) → Workflow State (`conversation-state.ts`) → Response Policy (`ai-reply-guard.ts` + pipeline gates) → AI Draft/Auto-Reply → Outbound Delivery (`comms.ts` + outbox retry) → Delivery Status Tracking → CRM Timeline Update. Duplicate prevention via `providerMessageId` + `InboundWebhookReceipt` + `clientRequestId` idempotency keys. **No unsupported channel is claimed as operational.**

---

## 5. Exact AI agent inventory and verified counts

Source: `src/lib/agents/registry.ts` (canonical seed), `src/lib/agents/catalogue.ts` (logical catalogue), `src/lib/agents/bootstrap.ts` (DB bootstrap + status).

| Category | Count | Notes |
|---|---|---|
| Departments registered | **110** | `D001`–`D0FF` (26 hex-letter codes); canonical count verified by test |
| Core executable agents registered | **44** | `CEO-001` … `OPS-044`; all have source definitions, prompts, tools, permissions |
| Logical catalogue agents | **2,200** | 110 departments × 20 role archetypes; **definitions, not separate model processes** (honest note in source) |
| Configured (provider present) | **0** in this session | No AI provider key available; `getAgentProviderStatus()` → `NOT_CONFIGURED` |
| Enabled | **44** (registry) | DB `enabled` flag; execution requires provider |
| Successfully tested (offline) | **44** | Agent engine, provider selection, hierarchy, job policy, readiness suites pass |
| Production-verified (live provider) | **0** | **BLOCKED** — requires host provider key + live execution evidence |
| Disabled | **0** | — |
| Failed | **0** | — |
| Duplicate | **0** | `validateAgentRegistry()` enforces uniqueness; bootstrap reports duplicates |
| UI-only placeholders | **0** | Every core agent has a prompt + handler + permissions |
| Missing implementations | **0** | All 44 have handlers; logical agents are definitions by design |

**Per-agent detail:** every core agent has Agent ID (code), name, purpose, department, source file (`registry.ts`), DB record (via `ensureAgentRegistry`), provider (shared runtime: AI Gateway → OpenRouter → ZAI), model config (shared provider chain), permissions (declared per agent), and execution evidence (via `AiAgentExecution` rows when run). Agents requiring approval (`requiresApproval: true`): WAP-011, EML-012, SMS-013, PAY-016, HND-030, PUB-035, AGC-041.

**Do not count planned agents as completed:** the 2,200 logical agents are explicitly documented as definitions, not running processes. Only the 44 core agents are executable.

---

## 6. Exact reusable project and template inventory

| Category | Count | Notes |
|---|---|---|
| Unique project definitions (factory templates) | **4** | `company-in-a-box`, `crm`, `support`, `projects` — versioned, dependency-checked |
| Reusable templates (design references) | **11** | Industry application templates in `catalog.ts` (school, fitness, doctor, travel, real-estate, ecommerce, manufacturing, analytics, elearning, IT services, outdoor gear) |
| Reusable modules | **8** | `identity`, `contacts`, `workflow`, `documents`, `audit`, `notifications`, `reporting`, `integration_hub` — each with manifest, schema, permissions, tests |
| Buildable projects | **4** | All factory templates pass `validateTemplateDefinition` + dependency resolution |
| Tested projects | **4** | Factory control policy/DB/runtime suites pass offline |
| Deployable projects | **4** | Staging → production promotion with approval gates |
| Production-deployed projects | **0** | **NOT VERIFIED** — no deployment evidence in this session |
| Successfully reused projects | **0** | No provisioning evidence in this session |
| Incomplete projects | **0** | — |
| Broken projects | **0** | — |
| Duplicate records | **0** | Template/module codes unique; versions tracked separately (not counted as separate projects) |
| Work examples (public, illustrative) | **12** | Classified as illustrative scenarios, never as client projects |
| Prompt templates (seed) | **23** | `T-*` codes in `prisma/seed.ts` |
| n8n workflows (seed) | **26** | `W01`–`W26` in `prisma/seed.ts` |

A completed reusable project requires verifiable source, successful build, passing tests, documented config, and reproducible deployment evidence. The 4 factory templates meet the first four; deployment/reuse evidence is **NOT VERIFIED** and is not claimed.

---

## 7. Eleven-stage CRM workflow verification

Source: `src/lib/pipeline/templates.ts` (13 message stages), `src/lib/pipeline/send.ts` (sender + gates), `src/lib/journey.ts` (lifecycle), `src/lib/constants.ts` (`PIPELINE_STAGES`, 20 CRM stages).

| Spec stage | Template stage | CRM status | Verified |
|---|---|---|---|
| 1 First Message | `FIRST_MESSAGE` | `New Lead` | ✅ save + Client ID + ack |
| 2 Business Type | `BUSINESS_TYPE_RECEIVED` | `Business Type Received` | ✅ classify + recommend + ask |
| 3 Scope Details | `SCOPE_DETAILS_RECEIVED` | `Scope Received` | ✅ draft SOW + admin task; **no final scope sent** |
| 4 Final Scope Approved | `FINAL_SCOPE_APPROVED` | `Final Scope Sent` | ✅ admin approval required (gate enforced in backend) |
| 5A Meeting | `MEETING_REQUESTED` | `Meeting Requested` | ✅ meeting link + staff task |
| 5B Client Approves | `SCOPE_APPROVED` | `Client Confirmed` | ✅ identity + evidence + lock |
| 6 HTML Preview | `HTML_PREVIEW_SENT` | `HTML Preview Sent` | ✅ secure link + version + timestamp |
| 7A Revision | `REVISION_REQUESTED` | `Revision Requested` | ✅ task + scope-impact check |
| 7B Preview Approved | `HTML_PREVIEW_APPROVED` | `Payment Pending` | ✅ admin approval for payment instructions |
| 8 Payment Verified | `PAYMENT_RECEIVED` | `Payment Verified` | ✅ separate statuses; only Verified unlocks release |
| 9 Delivery Ready | `FINAL_DELIVERY_READY` | `Final Delivery Ready` | ✅ deliverables validated vs scope |
| 10 Delivery Completed | `FINAL_DELIVERY_COMPLETED` | `Source Code Delivered` | ✅ evidence + password rotation request |
| 11 Client Confirms | `PROJECT_CLOSED` | `Project Closed` | ✅ acceptance + optional review/referral |

**Approval enforcement is in backend services** (`send.ts` gate + `effectiveGate` in `rules.ts`), not only in the dashboard UI. Consequential messages (amounts, payment, contract, handover, legal) are never auto-retried (`retryCommunicationOutbox` refuses re-dispatch).

---

## 8. Message template implementation matrix

| Stage | WhatsApp | SMS | Email | WebChat | Social (FB/IG/LI/X/M) |
|---|---|---|---|---|---|
| 1 First Message | ✅ | ✅ (short) | ✅ subject+HTML | ✅ conversational | ✅ short |
| 2 Business Type | ✅ | ✅ | ✅ | ✅ | ✅ |
| 3 Scope Details | ✅ | ✅ | ✅ | ✅ | ✅ |
| 4 Final Scope | ✅ | ✅ | ✅ | ✅ | ✅ |
| 5A Meeting | ✅ | ✅ | ✅ | ✅ | ✅ |
| 5B Scope Approved | ✅ | ✅ | ✅ | ✅ | ✅ |
| 6 Preview Sent | ✅ | ✅ | ✅ | ✅ | ✅ |
| 7A Revision | ✅ | ✅ | ✅ | ✅ | ✅ |
| 7B Preview Approved | ✅ | ✅ | ✅ | ✅ | ✅ |
| 8 Payment | ✅ | ✅ | ✅ | ✅ | ✅ |
| 9 Delivery Ready | ✅ | ✅ | ✅ | ✅ | ✅ |
| 10 Delivery Done | ✅ | ✅ | ✅ | ✅ | ✅ |
| 11 Project Closed | ✅ | ✅ | ✅ | ✅ | ✅ |

**Placeholders:** `[CLIENT_ID]` `[CLIENT_NAME]` `[BUSINESS_NAME]` `[BUSINESS_TYPE]` `[PROJECT_NAME]` `[RECOMMENDED_PLAN]` `[FINAL_SCOPE]` `[MEETING_LINK]` `[HTML_PREVIEW_URL]` — all mapped to `PipelineVariables` and validated by `validatePipelineVariables()` before sending. `sendPipelineMessage()` **refuses to send** when a required variable is missing. SMS is shorter; WebChat is conversational; email carries professional subjects + TECH360 branding. No internal development methods appear in customer messages.

---

## 9. Admin approval and payment security report

- **Final Scope, payment instructions with amounts, invoices, legal/refund decisions, contractual changes, source-code release, final delivery links, dispute responses** — all gated by `effectiveGate()` in `rules.ts`, enforced in `send.ts` (raises `ApprovalRequest`, sends nothing until approved).
- **Payment verification** — `Payment Submitted / Under Verification / Verified / Failed` are separate statuses; only `Payment Verified` unlocks delivery. Client screenshots are evidence, not proof. Duplicate payment events prevented by idempotency.
- **Source-code release** — `HND-030` (Gatekeeper) + handover token flow; requires verified full payment + admin approval. Never released on AI claim alone.
- **AI auto-send** (9 items) vs **admin approval required** (7 items) — exactly as specified; enforced in backend.
- **Tests:** `business-policies`, `payment-integration-safety`, `governance-*`, `handover-artifacts`, `pipeline-decision-policy` — **PASS**.

---

## 10. Private Software Factory verification

All five modules operate **exclusively** through Super-Admin-guarded APIs (`/api/factory/*`, `/api/admin/factory/*`) with `requireActor` + audit logging. No public route exposes them.

| Module | Implementation | Verified |
|---|---|---|
| Template Library | CRUD, versioning, dependency tracking, draft/approved states, duplicate detection, audit | ✅ policy + DB tests pass |
| Module Engine | Registration, dependency resolution, compatibility, lifecycle, rollback, per-company assignment | ✅ tests pass |
| Company Provisioning | Tenant isolation (API + DB + storage + jobs), job monitoring, recovery, suspension, audit | ✅ isolation tests pass |
| Version Control | Release history, commit refs, approval gates, immutable records, rollback eligibility | ✅ tests pass |
| Deployment & Recovery | Staging/prod targets, health checks, backups, recovery points, controlled rollback | ✅ tests pass (offline) |

**Confidentiality fix (this session):** the public `/platform` page previously described all five modules by name with internal workflow details. It has been rewritten to customer-facing benefits only (see §11). A regression test (`tests/omnichannel-templates.test.ts`) now fails if those terms reappear in public components.

---

## 11. Public website audit — fixes applied

### P0 — Confidentiality exposure (FIXED)
`/platform` exposed Template Library, Module Engine, Company Provisioning, Version Control, Deployment & Recovery internals. **Rewritten** to "Your Business. One Connected Platform. Complete Control." with customer benefits only (connected operations, CRM, portals, workflows, reporting, documents, integrations, continuity, data ownership). Internal architecture language removed.

### P0 — Positioning violation (FIXED)
`/about` and `/careers` mentioned Bangladesh. **Rewritten** to USA-based international positioning ("USA-based. Internationally focused. Delivering worldwide."). No Bangladesh mention remains in public marketing components (regression-tested).

### P1 — Homepage hero (FIXED)
Updated to **"Engineering Technology. Empowering Business."** with the approved supporting statement: *"TECH360 designs, develops, and delivers secure, scalable digital solutions that help businesses modernize operations, connect systems, and grow with confidence."*

### Verified catalog
- **21 services** — all present with detail pages, FAQs, CTAs, SEO metadata (test-enforced).
- **20 industries** — all present with sector-specific content (test-enforced).
- **Legal policies** — Terms, Privacy, Refund, Delivery, Payment, Client Approval, Source Code Handover — all present and consistent with the approved scope terms.
- **Portfolio** — 12 work examples classified as illustrative scenarios, never as client projects.

---

## 12. Test evidence and logs

| Command | Result |
|---|---|
| `npm run test:offline` | **1,384/1,384 PASS** (1,365 baseline + 19 new) |
| `npm run lint` | **PASS** |
| `npm run typecheck` | **PASS** |
| `npm run build` | **BLOCKED locally** — Prisma engine CDN (`binaries.prisma.sh`) unreachable from sandbox (TLS). CI (disposable MySQL) is the build gate; see `KNOWN_ISSUES_AND_BLOCKERS.md` B-005. |

Test classification: **PASS** 1,384 · **FAIL** 0 · **BLOCKED** live-provider acceptance (WebChat AI reply, email delivery, WhatsApp/SMS delivery, production deployment) · **NOT TESTED** production MySQL integrity, Hostinger runtime, Core Web Vitals field data.

---

## 13. Production readiness report

**Status: NOT PRODUCTION-VERIFIED.** The codebase is complete, tested offline, and ready for host configuration. Production readiness requires operator actions that cannot be performed from this session:

1. Set host environment variables (see §2–§3): `SESSION_SECRET`, one AI provider key, Hostinger Mail API variables, webhook secrets, WhatsApp/SMS credentials as needed.
2. Verify Hostinger MySQL identity/schema + restorable backup before `migrate deploy`.
3. Deploy the intended SHA; confirm `/api/health` returns MySQL UP.
4. Run live acceptance: WebChat AI reply, email inbound/outbound, WhatsApp/SMS delivery.
5. Confirm `main` branch protection (currently `protected: false` per prior audit).

**No P0 issue remains in code.** All P0 findings (confidentiality, positioning) are fixed and regression-tested.

---

## 14. Deployment and rollback instructions

1. **Pre-deploy:** confirm Hostinger MySQL schema vs baseline; take a restorable backup. Never run `db:deploy` against production until the schema comparison is approved.
2. **Configure:** set all environment variables in hPanel (never commit secrets). Verify via `GET /api/admin/omnichannel/status` (Super Admin) — every channel should report `CONFIGURED` or a clear missing-variable list.
3. **Build:** `npm run build` (Prisma generate → migrate deploy → Next build → standalone assets). Must pass in CI before merge.
4. **Start:** `npm start` (runs production preflight, then `.next/standalone/server.js`).
5. **Verify:** external checks — HTTPS home, `/api/health` (MySQL UP), portal login, protected-route refusal, static asset, WebChat test message, email test.
6. **Rollback:** redeploy the previous verified SHA; database migrations are forward-only — restore from backup if schema changed. Factory releases support version-aware rollback via the Super Admin interface.

---

## Issue register (summary)

| ID | Route/File | Issue | Root cause | Impact | Fix | Priority | Status |
|---|---|---|---|---|---|---|---|
| I-001 | `/platform` | Software Factory internals exposed publicly | Marketing copy described private modules | Confidentiality breach | Rewritten to customer benefits | P0 | **FIXED** |
| I-002 | `/about`, `/careers` | Bangladesh mentioned in public marketing | Legacy positioning copy | Positioning violation | USA-based rewrite | P0 | **FIXED** |
| I-003 | `/` hero | Headline not per approved positioning | Legacy hero copy | Brand inconsistency | New headline + statement | P1 | **FIXED** |
| I-004 | `templates.ts` | No WebChat/SMS/social variants; missing Client IDs | Template engine covered 2 channels | Omnichannel gap | 9-channel engine + validation | P1 | **FIXED** |
| I-005 | WebChat AI | AI replies not generated | No provider key on host | Visitor sees fallback | Operator: set provider key | P0 | **BLOCKED** (operator) |
| I-006 | Email AI | Email not sent/received | Hostinger Mail + webhook secrets unset | Email channel down | Operator: set host env | P0 | **BLOCKED** (operator) |
| I-007 | Production | Deployment unverified | No hPanel access from session | Cannot claim live | Operator verification steps | P0 | **NOT VERIFIED** |

Every issue above includes route/file, current vs expected behavior, root cause, impact, fix, priority, and verification evidence. No issue is claimed fixed without a passing test or a documented operator step.
