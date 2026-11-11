# TECH360 — PHASE 0 READ-ONLY AUDIT REPORT

**Repository:** `alaminiubateee969-cmd/tech360`
**Branch:** `arena/2073fcff-tech360`
**Commit:** `9d0547b` — "Merge pull request #64 …"
**Audit date:** 2026-11-10
**Production domain:** `https://bdtech360.com`
**Mode:** Read-only audit. **No** code changes, no migration, no deployment, no
production change, no webhook activation.

---

## 0. SCOPE DISCIPLINE AND ONE NECESSARY DISCLOSURE

The prior directive (master production-readiness) produced a report and one
surgical security repair. This directive says **Phase 0 only — no code changes.**

**Disclosure:** the working tree already contained that earlier repair before
this audit began:

```
 M src/app/api/webhooks/whatsapp/route.ts      (WhatsApp GET handshake → constant-time)
?? src/lib/whatsapp-webhook.ts                 (new, pure verifier)
?? tests/whatsapp-handshake.test.ts            (7 tests)
?? docs/PRODUCTION_READINESS_VERIFICATION_2026-11-10.md
```

I did **not** revert it (that would discard working, tested code) and I made
**no new source changes** in this phase. Whether to keep it is a Gate 0
decision for the owner. It is not committed or pushed.

The one thing I did that resembles a change is a **test-environment** action,
disclosed in §4 because it alters the evidence materially: I installed
`@prisma/adapter-libsql` + `@libsql/client` with `npm i --no-save`, exactly as
the repository's own error message instructs. `git status` shows `package.json`
and `package-lock.json` **unchanged**. Nothing was added to the repo.

Per §19 I stop after this report.

---

## 1. EXECUTIVE SUMMARY

**Verdict: PROCEED WITH CONDITIONS (Gate 0 approval requested).**

The platform is far more implemented than this directive assumes. The 11-stage
workflow, canonical Client ID, approval chain, SOW versioning, HTML preview
gate, payment verification, QA/delivery gating and SUPER_ADMIN source handover
**all already exist and are covered by passing tests — including the real
database transactions**, which I was able to run for the first time with a
complete green result:

> **1,423 / 1,423 tests pass. 318 suites. 0 failures. 0 cancelled.**

That is the single most important finding and it **corrects the previous
audit**, which had to report the DB suites as BLOCKED. They are not blocked;
they were unrunnable only because an optional, undeclared test adapter was
missing. See §4.

What genuinely does **not** exist: `Milestone`, `Tenant`, `DiscoverySession`,
`DeliveryArtifact` and any QA/`QaRecord` model. Discovery data is smuggled into
a generic `AiMemory` blob rather than having a home. And "CONNECTED" status
displays are built on **environment-variable presence**, which this directive
(§12) explicitly forbids — a real, reproducible defect.

WhatsApp is correctly **NOT_CONNECTED** and the code already refuses to send
without credentials. It is not a dependency of WebChat or CRM.

**Nothing is verified against production.** The domain is unreachable from this
sandbox, there is no production database access, and no credential exists. Those
remain owner gates, not engineering gaps.

---

## 2. REPOSITORY VERIFICATION

| Check | Result |
|---|---|
| Repository | `alaminiubateee969-cmd/tech360` (public) — matches directive |
| Branch | `arena/2073fcff-tech360` |
| Commit | `9d0547b` |
| Working tree | 1 modified + 3 untracked (the disclosed prior repair) |
| Open pull requests | **0** |
| CI status on `main` | **PASS** — run `42768720254`, 35/35 steps, against **MySQL 8.0** |
| Latest merged change | PR #64 (`9d0547b`) |
| Node runtime | `>=22.0.0 <23`; local v22.22.3 |
| Next.js | declared `^16.1.1`, installed 16.4.3 |
| React | `^19.0.0` |
| Prisma | `6.19.3` / `@prisma/client` `6.19.3` |
| Stripe SDK | **not a dependency** — integration is hand-rolled REST |
| `main` branch protection | **`protected: false`** |
| Clone depth | shallow (1 commit) |

### Repo identity — still unresolved (carried forward, not re-litigated)

A **second public repository**, `engralaminn-collab/tech360`, still exists and
was last pushed 2026-11-09. This directive names only
`alaminiubateee969-cmd/tech360` as the repository, which narrows the question
but does not dispose of it: the stale public copy remains. Flagged as **D-1**
in §21.

---

## 3. EXISTING ARCHITECTURE

| Layer | Implementation | Evidence |
|---|---|---|
| Frontend | Next.js 16 App Router, React 19, Tailwind 4, shadcn/Radix | `src/app`, `components.json` |
| Public site | 65 statically generated routes + catch-all resolver | `getStaticPublicRoutePaths()` |
| Backend | 241 API route handlers | `find src/app/api -name route.ts` |
| Database | MySQL via Prisma, 97 models, 18 migrations | `prisma/schema.prisma` |
| CRM | `Client` + `ClientIdentity` + `Lead` + `crm-merge.ts` | see §5 |
| WebChat | Signed-cookie session, `ChatConversation`/`ChatMessage`, orchestrator | see §6 |
| AI Workforce | 44 executable core agents, 110 departments, 2,200 logical definitions | `src/lib/agents/registry.ts` |
| Auth/RBAC | 12 roles, layered `guard()`, CSRF, AUDITOR read-only | `src/lib/api-guard.ts` |
| Governance | `ApprovalRequest` with governed execution | `src/lib/governance/` |
| Comms | `comms.ts` real adapters, honest `NOT_CONFIGURED` states | `src/lib/comms.ts` |

---

## 4. TEST BASELINE — THE HEADLINE CORRECTION

### 4.1 Previous reported figure: 1,398 / 1,398, 311 suites

**Not reproducible.** I measured 1,397 tests / 317 suites at the base commit,
and 1,404 / 318 with the new handshake tests. The figure does not reconcile.
Reported here rather than silently matched.

### 4.2 What `npm test` gives in this sandbox

```
# tests 1404 · suites 318 · pass 1365 · fail 3 · cancelled 36
```

3 failures, all one root cause: `@prisma/client did not initialize yet` — the
Prisma engine binaries cannot be downloaded here (`binaries.prisma.sh`
unreachable). The three DB suites were **BLOCKED**, not failing.

### 4.3 What `npm run test:offline` gives — first run

```
# tests 1426 · suites 318 · pass 1327 · fail 44 · cancelled 55
```

`test:offline` gets further because it builds a SQLite schema via Prisma's
offline engine stubs. Its 44 failures carry **one explicit message**, repeated
50 times:

> `PREVIEW_SQLITE_URL is set but @prisma/adapter-libsql is not installed.
> Install it with npm i --no-save @prisma/adapter-libsql@6.19.3 @libsql/client@0.15.15`

The repository **already documents the exact fix**. So this is not a code
defect and not a flaky suite — it is an **undeclared optional test dependency**.

### 4.4 What `npm run test:offline` gives after following the repo's instruction

```
# tests 1423 · suites 318 · pass 1423 · fail 0 · cancelled 0 · skipped 0
```

**FULLY GREEN.** Every DB-backed suite that the previous audit reported as
BLOCKED now passes, including the money- and identity-critical ones:

| Suite | Result |
|---|---|
| `payment-gated project activation` | ok — refuses activation without verified payment; rejects another client's project |
| `database-backed tenant isolation` | ok — private file only when record **and** owning client match |
| `atomic CRM stage transitions` | ok — single concurrent claim of a stage |
| `verified client identity resolution` | ok |
| `durable webhook replay protection` | ok |
| `proposal versioning and approval persistence` | ok — draft preserved, immutable version rows |
| `failed payment verification has no activation side effect` | ok |
| `approved source handover end-to-end` | ok |
| `runtime governance (database): payment verification` | ok |
| `consequential outbound lifecycle / retry refusal` | ok |
| `AI workforce: client/tenant isolation` | ok |
| `handover payment and authorization gate` | ok — blocks before release; blocks until full verified payment; blocks expired links |

**Consequence:** the "1,398 tests" gate in §16 is superseded by a stronger,
verified baseline of **1,423**. Target should be updated to 1,423 at Gate 1.

**Honest caveat:** this ran against **SQLite built from the MySQL schema**, not
MySQL. It proves logic and transactions, *not* MySQL dialect compatibility. CI
covers MySQL separately and is green. Both exist; neither substitutes for the
other, and neither is production evidence.

### 4.5 Missing tests (real gaps)

- **No browser/E2E layer.** No Playwright. Widget loading, mobile layout, deep
  links and accessibility are **NOT TESTED** by execution.
- No live-provider test of any kind.
- `npm run typecheck` locally reports 57 errors, all `unknown`-typed Prisma
  results caused by the stub client. CI typecheck is green. Locally, typecheck
  has **not** validated Prisma query shapes.

---

## 5. CUSTOMER IDENTITY AUDIT

**Verdict: PASS (strong).** The directive's core rule — one customer, one
Client ID — is implemented, not aspirational.

| Requirement | Status | Evidence |
|---|---|---|
| `TECH-YYYY-NNNNNN` format | **PASS** | `src/lib/ids.ts:8`, `nextClientId()`; test `uses the TECH-YYYY-NNNNNN client ID format` |
| Search before create | **PASS** | `crm-merge.ts` duplicate detection |
| Duplicate detection | **PASS** | flags normalized email, WhatsApp/phone, business-name; ignores deleted/merged rows |
| Verified-only identity linking | **PASS** | `ClientIdentity` unique on `(identityType, normalizedHash)`; `verificationSource`, `verifiedAt` |
| No merge on similar names | **PASS** | rejects self-merge, already-merged source, inactive target, missing audit reason |
| Never link typed email to existing record | **PASS** | `chat-onboarding.ts` — typed email is **not** proof of ownership; conversation left unlinked for verified/manual resolution |
| Merge auditability | **PASS** | archive row keeps original `TECH-` id, `mergedIntoId` pointer, never deleted |
| Same Client ID across channels | **PASS** | `Client.source` spans WEBSITE/WHATSAPP/EMAIL/SMS/SOCIAL; all identities resolve to one `Client` |

### Gap: no `Tenant` model

There is **no `Tenant` model**. Isolation is enforced at the **client** level
(`clientId` scoping, `factory`/company models for the Software Factory product).
For a single-business CRM this is coherent and tested. If TECH360 ever becomes
multi-tenant SaaS, this becomes a P1 architectural gap. **Not required now.**

---

## 6. WEBCHAT AUDIT — PRIMARY CHANNEL

**Verdict: PASS (security), PASS (logic), NOT TESTED (browser).**

| Control | Status | Evidence |
|---|---|---|
| Signed session cookie | **PASS** | `t360_chat_session`, HMAC-SHA256 over `anonId.expiry` |
| `HttpOnly` | **PASS** | `chat-session.ts:76` |
| `SameSite=Strict` | **PASS** | same line |
| `Secure` in production | **PASS** | conditional on `NODE_ENV === 'production'` |
| Constant-time signature check | **PASS** | `constantTimeEquals` |
| Expiry enforced | **PASS** | `expiry <= now` → false |
| Minimum secret strength | **PASS** | refuses to issue unless `SESSION_SECRET` ≥ 32 bytes; **no dev fallback in production** |
| Rate limiting | **PASS** | `rateLimit` per-IP per-path |
| Message persistence | **PASS** | `ChatConversation` + `ChatMessage` |
| Idempotency | **PASS** | unique `clientRequestId` on both models; `P2002` handled |
| Consent evidence | **PASS** | `contactConsentAt`, `consentVersion`, `hasExplicitContactConsent` |
| PII redaction | **PASS** | `redactSensitiveCrmData` |
| Cross-conversation isolation | **PASS** | cookie bound to `anonId`; mismatched id rejected |
| AI reply fabrication guard | **PASS** | `screenAiReply` in `ai-reply-guard.ts` |

**One deviation from the original brief:** the cookie is scoped
`Path=/api/chat`, not site-wide. That is *tighter* than a broad cookie and is
correct.

**"Rolling" TTL note:** a fresh 30-day token is issued on each successful
session response, so expiry slides forward on activity. It is a sliding
re-issue, not a server-side session store. Functionally equivalent; worth
knowing neither side can revoke a live token before expiry. Low risk.

**Not tested:** widget rendering in a real browser, mobile viewport, deep
links. No E2E harness exists.

---

## 7. COMMUNICATION ORCHESTRATOR AUDIT

**Verdict: PASS with one real defect.**

`src/lib/chat-orchestrator.ts` → `handleCustomerMessage()` implements the
directive's required loop: load client + history + known requirements + stage →
answer the actual question → ask **at most one** follow-up → never re-ask known
fields → persist before advancing → summarize before SOW draft → on AI failure
**record the failure and do not invent a reply**.

It is wired to real registered agents, not fabricated ones — all four codes
used (`BIZ-004`, `SCP-006`, `PLN-005`, `COM-010`) **exist** in the 44-agent
registry, verified programmatically.

| Capability | Status |
|---|---|
| Receive / normalize inbound | **PASS** (per-channel routes → shared handlers) |
| Identify customer | **PASS** |
| Associate to Client ID | **PASS** |
| Detect intent / business type | **PASS** |
| Retrieve approved knowledge | **PASS** (`KnowledgeDocument`, RAG pipeline) |
| Approval check before send | **PASS** (`ApprovalRequest`, `SENSITIVE_COMMUNICATION`) |
| Save exact outgoing message | **PASS** |
| Delivery status + timestamps | **PASS** |
| Escalation | **PASS** |
| Prevent duplicate messages | **PASS** (idempotency keys, `InboundWebhookReceipt`) |
| Prevent contradictory replies | **PASS** (`ai-reply-guard`) |

### F-1 (P2): channel status is env-presence, not connectivity

`src/lib/comms.ts:44` `channelStatuses()` returns:

```ts
WHATSAPP: channelConfigured('WHATSAPP')   // Boolean(process.env.WHATSAPP_TOKEN && ...)
EMAIL:    channelConfigured('EMAIL')
...
```

and `/api/admin/omnichannel/status` maps that to `CONFIGURED`. This directive
(§12) is explicit: *"Never display a green Connected status based only on the
presence of an environment variable."* The four-state vocabulary
`NOT_CONFIGURED / CONFIGURED_NOT_VERIFIED / CONNECTED / CONNECTION_ERROR` does
not exist; there is a two-state approximation.

**Current risk: low**, because the UI label is `CONFIGURED` (not `CONNECTED`),
and the detail strings are honest ("credentials are present", "sends are
refused"). It is a vocabulary and semantics gap, not a false green light — but
it will become a false green the moment someone renames `CONFIGURED` →
`CONNECTED` in the UI. **Recommended fix (Gate 2, not now):** add a
`CONFIGURED_NOT_VERIFIED` state and derive `CONNECTED` only from a verified
probe.

### F-2 (P1): WhatsApp env-var naming drift — documented, not a bug

The directive names `WHATSAPP_ACCESS_TOKEN`. **The code reads
`WHATSAPP_TOKEN`**, consistently, across 10+ call sites, and `.env.example`
line 93 declares `WHATSAPP_TOKEN`. The earlier master report
(`docs/PRODUCTION_READINESS_MASTER_REPORT.md:64`) tells the operator to set
`WHATSAPP_ACCESS_TOKEN` — **following that document would configure nothing**,
and the platform would report `NOT_CONFIGURED` while the operator believed it
was configured.

This matters precisely because §9/§12 make WhatsApp a later, owner-gated
activation: the owner would set the "documented" name and the adapter would
stay dark. **No code change made** (Phase 0). Recommended: accept both names in
`channelConfigured`, or correct the docs at Gate 8. Canonical name should be
the one in `.env.example`.

---

## 8. AI WORKFORCE AUDIT

**Verdict: PASS (registry/structure), BLOCKED (execution).**

| Check | Result |
|---|---|
| 44 executable `CORE_AGENTS` | **PASS** — 44, unique, `validateAgentRegistry().valid === true` |
| 110 departments | **PASS** — unique |
| 2,200 logical catalogue definitions | **PASS** — `LOGICAL_AGENT_CATALOGUE.length === 2200` |
| Registry consistent | **PASS** — no duplicates, no invalid dept mappings, no invalid handlers |
| Every agent → real department | **PASS** — 0 orphans |
| Hierarchy integrity | **PASS** — 0 dangling `parentCode` |
| Department coverage | **36 of 110** departments contain an executable agent |
| Agent execution | **BLOCKED** — no provider credentials; 0 of 44 executed |

### Mapping the directive's 17 logical roles → existing agents

**No new agents are needed.** Verified by code existence:

| Directive role | Existing agent |
|---|---|
| Communication Orchestrator | `COM-010` |
| Customer Support | `CST-020` |
| Lead Qualification | `CRM-003` |
| Business Analysis | `BIZ-004` |
| Plan Recommendation | `PLN-005` |
| Scope Analysis / SOW Drafting | `SCP-006` (+ `SCP-007`, `SCP-008`) |
| Meeting Coordination | `MTG-015` |
| Preview Coordination | `PRP-009` |
| Payment Assistant | `PAY-016` |
| Project Manager | `PRJ-018` |
| Developer Coordination | `TSK-019` |
| QA | `QA-038` |
| Delivery Compliance | `DLV-029` / `HND-030` |
| Customer Success | `CST-020` / `VOX-043` |
| Security Agent | `SEC-025` |
| (governance) | `REV-032`, `ADM-033` |

**Honest statement:** "110 departments" does **not** mean 110 working
departments — 74 have no runnable agent. "2,200 logical agents" are
**definitions, not runners**; the codebase itself says so
(`availability.ts`: *"A workforce of 2,201 that is all 'AVAILABLE' is a lie"*)
and derives state from the durable queue rather than declaring it. That design
is correct and is implemented. **I did not mark any logical profile as a
running agent.**

---

## 9. SOW AND APPROVAL AUDIT

**Verdict: PASS.**

`ScopeOfWork` already has exactly the required shape: `version` (with
`@@unique([clientId, version])`), `status`
(`DRAFT | AI_REVIEWED | AWAITING_ADMIN_APPROVAL | APPROVED | FINAL | SUPERSEDED`),
`content` JSON, `reviewedBy`/`approvedBy`/`approvedAt`, and a `ScopeApproval`
join. Versioned drafts, immutability and change-request implications are
already **tested**:

- `keeps generated scope as a draft and preserves immutable version rows` — ok
- `records client approval history against a specific scope version` — ok
- `treats APPROVED and FINAL scopes as immutable and requires cost/timeline impact on Change Requests` — ok
- `allows only the exact final scope version approved by the same client` — ok
- `holds the final scope without approval` / `passes the final scope once approved` — ok

`ApprovalRequest` types include `FINAL_SCOPE_SEND`, `PAYMENT_INSTRUCTION`,
`REFUND`, `SOURCE_HANDOVER`, `CREDENTIAL_OP`, `DELETION`, `SOCIAL_PUBLISH`,
`LEGAL_COMM`, `SENSITIVE_COMM`, `AGENT_CREATE`, `PIPELINE_MESSAGE` — covering
every restricted action in §7. Approvals carry `status`
(`PENDING|APPROVED|REJECTED|EXECUTED|FAILED`), `risk`, `requestedBy`,
`decidedBy`, `executedAt`, `result`. Approval-required agents are **held** until
an authorized decision is persisted (tested).

---

## 10. HTML PREVIEW AUDIT

**Verdict: PASS.**

`Preview` + `PreviewEvent` models; `preview-policy.test.ts` covers the gate;
public access is tokenized (`/api/preview/[token]`) with a separate `view`
route that records access. Preview-before-payment ordering is asserted in
policy tests. Customer response options are modelled in the preview flow.

Not verified: actual generated HTML output for a real project (needs a paid,
approved project and an AI provider). **NOT TESTED, not claimed.**

---

## 11. PAYMENT AND FINANCE AUDIT

**Verdict: PASS (logic and DB transactions), BLOCKED (live provider).**

The directive's rule *"submitted proof does not mean paid"* is enforced in code
and **tested at the database level**:

| Rule | Status | Test |
|---|---|---|
| Screenshot is evidence only | **PASS** | `maps canonical Stage 8 labels and treats screenshots strictly as SUBMITTED evidence-only` |
| `SUBMITTED` never auto-becomes `PAID` | **PASS** | `prevents SUBMITTED payment proofs from ever auto-becoming PAID` |
| Direct operator bypass to `PAID` forbidden | **PASS** | `forbids direct operator bypass to PAID` |
| Unverified payment cannot activate project | **PASS** | `refuses to create or activate a project without a verified payment` |
| Failed verification leaves no side effect | **PASS** | `failed payment verification has no activation side effect` |
| Amount/currency mismatch rejected | **PASS** | `leaves project and payment pending when provider amount mismatches` |
| Receipts only for verified PAID | **PASS** | `issues official payment receipts strictly for verified PAID payments` |
| Duplicate settlement idempotent | **PASS** | `treats an already-paid record as an idempotent duplicate` |
| Stripe signature validated | **PASS** | `verifyStripeSignature` over raw body, constant-time |
| Governor approval required | **PASS** | `runtime governance (database): payment verification` |

**Live Stripe: BLOCKED.** No keys. Stripe is **not an SDK dependency** — the
integration is hand-rolled REST against `api.stripe.com`. That is acceptable but
means no SDK-managed retries/signature library. No charge, refund or webhook
was exercised. **Nothing is claimed live.**

---

## 12. PROJECT AND DELIVERY AUDIT

**Verdict: PASS, with one honest self-disclosure.**

Handover gating is genuinely layered. `HandoverRecord` carries
`paymentVerifiedAt`, `releasedBy`, `packageToken` (unique), expiry, and a
`PENDING_APPROVAL → PREPARED → RELEASED → DOWNLOADED → CONFIRMED → EXPIRED`
lifecycle. Tests confirm:

- `blocks source access before explicit release` — ok
- `blocks a released package until full verified payment` — ok
- `blocks expired links and allows fully paid released packages` — ok
- `approved source handover end-to-end` — ok
- `approved handover artifact manifest` — ok
- download re-verifies **SHA-256** and rejects if bytes/hash/scan state changed (`HANDOVER_ARTIFACT_CHANGED` → 409)

**Self-disclosed limitation (quoted from the code's own response):**

> `scanDisclosure: 'Files passed TECH360 deterministic structural and credential-pattern checks. External malware scanning is not configured.'`

So §10's "security checks passed" is satisfied by **pattern scanning only**, not
antivirus. The platform says so to the customer rather than overclaiming. That
is the right behaviour, and it must not be reported as full malware scanning.

### Gaps: `Milestone`, `DeliveryArtifact`, QA record

`Milestone`, `DeliveryArtifact` and any QA model are **absent**. Milestones are
modelled as `ProjectTask`; delivery evidence lives in `Delivery.checklist` and
`Delivery.evidence` **JSON blobs**, and QA evidence has no first-class table.

This is the directive's §10 concern in concrete form: QA/defect status ("no
unresolved critical defects") **cannot be queried** — it can only be read out of
a JSON column. This is a **P1** for Phase 7, not a Phase 0 action, and it
requires a migration plan.

---

## 13. WHATSAPP STATUS

```
Channel:            WhatsApp
Status:             NOT_CONNECTED
Configured:         false
Live Messaging:     Disabled
Webhook:            Inactive
```

**Verified how:** `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`,
`WHATSAPP_APP_SECRET`, `WHATSAPP_VERIFY_TOKEN` are all absent from the
environment, and `channelConfigured('WHATSAPP')` therefore returns `false`,
which makes `sendWhatsApp()` return `{ ok: false, status: 'NOT_CONFIGURED' }`
**without any network call**. `.env.example` ships all four **empty**.

- No live message was sent. No webhook was activated in production.
- WhatsApp is **not** a dependency of WebChat or CRM — separate route, separate
  adapter, refuses when unconfigured.
- The inbound adapter exists (HMAC-SHA256 over raw body, constant-time,
  replay-protected via `InboundWebhookReceipt`, identity-resolver with verified
  proofs). It is **built and unit-tested but never connected** — which is
  exactly "adapter-ready, not connected".
- `ChannelStatus` already honestly reports the four missing env names.

**Deviation from the directive's sketched interface:** there is no single
`CommunicationChannelAdapter` TS interface with `receiveMessage` /
`sendMessage` / `verifyWebhook` / `getConnectionStatus`. The equivalent exists as
concrete per-channel functions plus `channelStatuses()`. The *architecture* is
adapter-shaped; the *named interface* is not. Formalizing it is a Gate 2/3
refactor decision, not a blocker.

---

## 14. INTEGRATION STATUS MATRIX

States are what the code actually reports. **"Configured" means env vars
present — never verified by a live call.** No secret value is printed anywhere.

| Integration | Configured | Verified live | Actual state |
|---|---|---|---|
| WebChat | **Yes** (no external secret needed) | Logic yes / browser **no** | **ACTIVE** — primary channel |
| CRM | **Yes** | Yes (DB tests) | **ACTIVE** |
| AI Gateway | **No** | **No** | **NOT_CONFIGURED** — fail-closed 503 |
| Hostinger Mail | **No** | **No** | **NOT_CONFIGURED** |
| SMTP | **No** | **No** | **NOT_CONFIGURED** |
| n8n | **No** | **No** | **NOT_CONFIGURED** — W01–W26 present, none executed |
| Stripe | **No** | **No** | **NOT_CONFIGURED** |
| WhatsApp Cloud API | **No** | **No** | **NOT_CONFIGURED** — by design |
| SMS (httpSMS / generic) | **No** | **No** | **NOT_CONFIGURED** |
| Facebook / Instagram / LinkedIn / X | **No** | **No** | **NOT_CONFIGURED** |
| Customer Portal | **Yes** (code) | Logic yes / browser **no** | **ACTIVE** |
| Production domain | n/a | **No** | **NOT TESTED** — unreachable from sandbox |

`https://bdtech360.com` → `curl: (35) SSL_ERROR_SYSCALL`, HTTP `000`. This
sandbox has egress limited to GitHub/npm/PyPI. **I cannot distinguish "site is
down" from "sandbox is blocked", so I do not claim either.** It must be checked
from an authorized browser.

---

## 15. SECURITY FINDINGS

| ID | Severity | Finding | Status |
|---|---|---|---|
| S-1 | Low | WhatsApp GET handshake compared secret with `===` | **Fixed in prior turn** — pure verifier + 7 tests; awaiting Gate 0 decision to keep |
| S-2 | P2 | Channel status derives from env presence, not connectivity (§12 violation) | **Open** — F-1 |
| S-3 | P1 | WhatsApp env naming drift between code and operator docs | **Open** — F-2 |
| S-4 | Info | No malware scanning; pattern-based checks only, honestly disclosed | **Accepted risk** — owner decision |
| S-5 | Info | Chat token cannot be revoked before expiry (stateless) | **Accepted** — 30-day sliding |
| S-6 | — | `main` branch **unprotected**; repo **public** | **Open** — owner gate |

Verified-good, worth recording because they are easy to lose:

- **No** hardcoded secret fallbacks in `src/` (`process.env.X_SECRET || 'literal'` → 0 matches).
- Prisma `query` logging is **disabled in production** (`db.ts`), so bound parameters (PII, credentials) never reach logs.
- All webhook handlers validate signatures in **constant time** over the **raw** body: WhatsApp, social, SMS (Twilio HMAC), n8n, email, Hostinger Mail, Stripe.
- `guard()` fails closed: default `minRole` is `ADMIN`; AUDITOR is strictly read-only for **all** mutating methods; CSRF double-submit on mutations; forced password change honoured.
- CI secret scan over all tracked files + explicit `.env`-never-committed assertion.
- No secrets were read, printed, or committed during this audit.

---

## 16. DATABASE AND MIGRATION RISKS

| Risk | Assessment |
|---|---|
| Provider mismatch | Prisma `provider = "mysql"`; 18 migrations; CI proves 0 drift on MySQL 8.0 |
| Migration history immutable | Enforced by `check-migration-immutability.mjs` in CI + `migrations:check` |
| P3009 failed-migration lock | Known; recovery tooling exists (`prisma-migration-doctor.mjs`), documented in `HOSTINGER_SSH_RECOVERY.md` §5 |
| Renamed migration hazard | **Real, historical** — `13_post_review_grid` → `93_post_review_grid` broke prod because Prisma tracks by **name** |
| Missing models | `Milestone`, `Tenant`, `DiscoverySession`, `DeliveryArtifact`, QA — see §12 |
| Discovery persistence | **No `DiscoverySession`** — state stored in `AiMemory` blob + `Lead.requirements` |
| Prod schema/backup | **NOT TESTED** — no access |
| Restore drill | **Tooling exists and is well-safed** (target DB must start `tech360_drill_`, must differ from `DATABASE_URL`, prod connection read-only). **Never executed.** |

**No migration was run. No database was reset. Nothing touched production.**

---

## 17. PRODUCTION DEPLOYMENT RISKS

| Risk | Detail |
|---|---|
| Deployment mechanism | Hostinger Node.js Web App Git integration — **cannot be inspected or configured from this repo** |
| Preflight may be skipped | `npm start` → `prestart` validates config; docs explicitly warn hPanel may manage the server start and **bypass npm lifecycle**, so the fail-closed preflight could be skipped. **NOT VERIFIED** |
| Health endpoint | `/api/health` exists, reports provider, fails closed (503 when DB down) |
| Rollback | **No rehearsed rollback.** GitHub was used for the code; there is no evidence of a restore-from-previous-release procedure |
| Runtime | `>=22 <23`; CI validates on Node 22 |
| Backup | Scripts exist; **no evidence a production backup has been taken or restored** |

---

## 18. MISSING CAPABILITIES

| # | Missing | Impact | Phase |
|---|---|---|---|
| 1 | `Milestone` model | Milestones ride on `ProjectTask`; no milestone-level tracking/dates | 6 |
| 2 | QA / `QaRecord` model | QA + defect status unqueryable (JSON only) — blocks §10 gate | 7 |
| 3 | `DeliveryArtifact` model | Artifacts tracked via `FileRecord` + `relatedType` | 7 |
| 4 | `DiscoverySession` model | Discovery in `AiMemory`; no structured, auditable session | 3 |
| 5 | `Tenant` model | Client-level isolation only | 9 (only if SaaS) |
| 6 | 4-state connectivity vocabulary | §12 not satisfied | 2 |
| 7 | `CommunicationChannelAdapter` interface | Architecture adapter-shaped, interface unnamed | 2 |
| 8 | Browser E2E suite | No verification of widget/mobile/a11y | 2 |
| 9 | Malware scanning | Pattern checks only | 7 |
| 10 | Rehearsed rollback | Owner/infra | 7 (gate) |

**Explicitly NOT missing** (already present — do not rebuild): canonical Client
ID, `ClientIdentity`, CRM merge, approval chain, SOW versioning, preview
tokenization, payment verification gate, project activation gate, delivery
confirmation, handover authorization with SHA-256, audit logging, RBAC, WebChat
sessions.

---

## 19. PRIORITIZED GAP ANALYSIS

### P0 — Critical (blocks any go-live)
1. **`main` unprotected, repository public.** Anyone can push; source is public.
2. **Production never observed** — no DB access, no backup proven restorable, no health check.
3. **No rollback procedure** rehearsed.

*None of these are code defects. All are owner/infrastructure gates.*

### P1 — High
4. QA/delivery evidence has **no first-class model** → §10 gate cannot be enforced by query (§18 #2).
5. WhatsApp env naming drift — owner sets documented name, adapter stays dark (§7 F-2).
6. Discovery has no `DiscoverySession` — discovery is not independently auditable.
7. No browser E2E — the primary channel is unverified in a real browser.

### P2 — Medium
8. Connectivity vocabulary `CONFIGURED` vs §12's four states (§7 F-1).
9. `Milestone` model absent; milestone semantics thin.
10. `CommunicationChannelAdapter` interface unnamed.
11. Undeclared optional test dependency (`@prisma/adapter-libsql`) makes a
    green suite look red and costs hours of misdiagnosis (§4.3).

### P3 — Low
12. Malware scanning absent (honestly disclosed; owner risk acceptance).
13. Chat token not revocable before expiry.
14. `@prisma/client` stub degrades `tsc` to 57 noisy `unknown` errors locally.

---

## 20. RECOMMENDED IMPLEMENTATION PLAN

Sequenced to **reuse** what exists and to avoid touching the DB until an
approved, backward-compatible migration is designed.

| Phase | Scope | DB change? | Why now |
|---|---|---|---|
| **Gate 0** | Owner approves this report | no | — |
| **1** | Architecture/gap sign-off; fix the test baseline number (1,423) and declare the adapter as a dev dependency | **no schema change** — `package.json` devDependency only | Cheap; stops a false-red suite recurring |
| **2** | WebChat primary: add browser E2E; add 4-state connectivity; formalize `ChannelStatus`; correct WhatsApp env docs | no | Primary channel must be *proven* in a browser |
| **3** | CRM + AI workforce: structured `DiscoverySession` | **yes — 1 additive migration** | Discovery auditability |
| **4** | SOW/approval/preview: already largely built; harden + test only | no | Reuse, don't rebuild |
| **5** | Payment: already built; add Stripe sandbox rehearsal when keys exist | no | Blocked on credentials |
| **6** | Projects: add `Milestone` | **yes — additive** | Milestone tracking |
| **7** | QA + delivery: add `QaRecord`/`DeliveryArtifact`; rehearse rollback; decide malware scanning | **yes — additive** | Unblocks §10 gate |
| **8** | Customer success: confirm/close/review/referral — largely built | no | Reuse |
| **9** | WhatsApp activation | no | **Owner gate 8 only** |

Every migration must be additive, immutable-once-published, reviewed, and
applied through `prisma migrate deploy` with a **proven restorable backup** and
a completed restore drill.

---

## 21. REQUIRED OWNER DECISIONS

| # | Decision | Blocks |
|---|---|---|
| **D-1** | Confirm canonical repository; archive/delete `engralaminn-collab/tech360` | everything deployable |
| **D-2** | Should the commercial source remain **public**? (§1 item 10) | source exposure |
| **D-3** | Protect `main`: required review + required CI | merge safety |
| **D-4** | Approve this Phase 0 report (Gate 0) | all implementation |
| **D-5** | Provide staging target + production DB read-only inspection + a **restored** backup | Phases 5–9 |
| **D-6** | Approve the 1,423 test baseline and the additive-migration plan (Gate 1) | Phase 1 |
| **D-7** | Accept or reject pattern-scan-only delivery (no malware scanning) | §10 gate |
| **D-8** | Keep or revert the pending WhatsApp handshake repair | tree cleanliness |
| **D-9** | Confirm canonical WhatsApp env name (`WHATSAPP_TOKEN`) | Gate 8 |
| **D-10** | Provide provider credentials (AI, mail, Stripe, n8n) when ready | integration verification |

Silence is not permission. **No credentials were requested in chat, and none
were invented.**

---

## 22. ROLLBACK STRATEGY

**Current state:** there is **no rehearsed rollback**. What exists:

- Git history and a merge-based PR flow (every prior change is a revertable merge).
- `scripts/backup/mysql-backup.sh` and `scripts/backup/mysql-restore-drill.sh`
  — the drill is genuinely well-safed (target must start `tech360_drill_`, must
  differ from `DATABASE_URL`, prod opened read-only, `DROP DATABASE` refused
  unless the name satisfies rule 1). **Never executed.**
- `prisma-migration-doctor.mjs` for P3009 recovery (rewrites history only; runs no SQL).
- Migration immutability gate preventing silent edits to published migrations.

**Proposed rollback plan (requires owner approval before first implementation):**

1. Record commit `9d0547b` as the known-good baseline.
2. Work on a feature branch; never on `main`; no force-push.
3. **Before any migration:** take a backup **and** complete a restore drill into
   `tech360_drill_*`; record row counts.
4. Additive migrations only — new tables/columns; never drop or retype in the
   same release.
5. Application rollback = redeploy previous known-good SHA through Hostinger.
6. Database rollback = restore from the pre-migration backup (only after
   confirming the drill passed).
7. Smoke tests post-deploy: `/api/health`, homepage, portal login, WebChat session.
8. Define the "abort" signal before deploying, not after.

**Honest limitation:** steps 3–6 are *unrehearsed*. Until a drill is run against
a real backup, rollback is a plan, not a capability.

---

## 23. FINAL RECOMMENDATION

# PROCEED WITH CONDITIONS

**Why not SAFE TO PROCEED:** production has never been observed. No database
inspection, no proven-restorable backup, no rehearsed rollback, `main`
unprotected, repository public, domain unreachable, zero live integration
verified. §16's bar — *all critical customer journeys, security controls,
external integrations and production operations have verified evidence* — is not
met.

**Why not DO NOT PROCEED:** the engineering is not the problem. This audit
found the 11-stage workflow, canonical identity, approval chain, SOW versioning,
preview gate, payment gate, delivery gate and handover authorization already
implemented **and passing 1,423 of 1,423 tests including real database
transactions on tenant isolation, payment gating and scope versioning**. It
found no hardcoded secrets, no authentication bypass, and no fake success state.
Building a parallel system would be destructive waste.

**Conditions (all owner-gated, all cheap relative to the platform's value):**

1. **D-1…D-3** — resolve repo identity, visibility, and protect `main`.
2. **D-4/D-6** — approve this report and the 1,423 baseline at Gate 1.
3. **D-5** — supply staging + read-only prod DB access + one **restored** backup.
4. Declare `@prisma/adapter-libsql` as a dev dependency so a green suite stops
   reporting red (P2 #11).
5. Do **not** start Phases 2–9 until Gate 1.

**Stopping here as instructed.** No implementation, no migration, no
deployment, no production change. Awaiting Gate 0.
