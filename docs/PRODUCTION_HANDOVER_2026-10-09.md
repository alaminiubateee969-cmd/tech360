# TECH360 — Production Handover & Repair Report

**Date:** 2026-10-09
**Repository:** `alaminiubateee969-cmd/tech360`
**Session branch:** `arena/3b287e56-tech360` (branched from `main` @ `b0b6776`)
**Scope of this report:** Phase 1 audit + one verified Phase 2 repair. Everything below is
either the output of a command run in this session or a file/line reference you can open.
Nothing is marked COMPLETE on the strength of a UI screen, a seed record or an untested route.

---

## 1. Verification environment — what could and could not be run here

| Capability | Available | Evidence |
|---|---|---|
| Node.js 22 | YES | `node -v` → `v22.22.3` |
| npm install | YES | `npm ci` → `added 848 packages in 35s` |
| Lint / typecheck / unit tests | YES | see §3 |
| `prisma generate` | **NO** | `Error: request to https://binaries.prisma.sh/all_commits/c2990dca.../debian-openssl-3.0.x/schema-engine.gz.sha256 failed` — `binaries.prisma.sh` is outside this sandbox's network allowlist |
| MySQL server | **NO** | `command -v mysql mysqld mariadbd docker` → none present |
| Production build (`npm run build`) | **NO** | blocked at step 1 (`prisma generate`), before `migrate deploy` and `next build` |
| Hostinger hPanel / live domain | **NO** | no credentials in this session; bdtech360.com not reachable from this network |

**Consequence, stated plainly:** no claim in this report about *production runtime* behaviour
is verified. Claims about *source code* behaviour are verified by executed tests. This is the
same blocker recorded previously as `B-005`; it is an environment limit, not a code defect —
GitHub CI has full network and does download the engine.

Because `prisma generate` cannot run, `@prisma/client` has no generated types, so `tsc` cannot
check code that imports named model types, and `db.*` calls degrade to untyped access. To avoid
shipping the changed database code unverified, the repair in §4 is covered by an **integration
test that executes the real function** with a recording Prisma stub (§5).

---

## 2. Phase 1 audit — verified facts about the existing system

### 2.1 AI workforce registry: the 44 / 110 claim is TRUE

The registry ships its own validator. It was **executed**, not read:

```
$ npx tsx -e "import { validateAgentRegistry } from './src/lib/agents/registry'; ..."
version: 44-agents.110-departments.v1
{
  "valid": true, "agentCount": 44, "departmentCount": 110,
  "duplicateAgentCodes": [], "duplicateDepartmentCodes": [],
  "invalidDepartmentMappings": [], "invalidHandlers": [], "incompleteAgents": []
}
distinct depts with agents: 36
depts with no agent: 74
agents requiringApproval: 7
distinct tool count: 48
```

**Verified:** 44 core agents, 110 departments, no duplicate codes, no invalid
agent→department mappings, every agent complete. Existing agent IDs and department
assignments are preserved — nothing was renumbered.

**New finding (not previously recorded):** **74 of 110 departments have no agent assigned.**
The "110 departments" figure is real as an organisational structure, but only 36 departments
are staffed by an executable agent. Any dashboard that presents 110 as "AI departments at
work" would overstate coverage by ~3×. This is a reporting-honesty risk, not a crash.

### 2.2 What already exists and is real

- **52 Prisma models** (`prisma/schema.prisma`, 1095 lines after this change), 4 migrations, MySQL provider.
- **121 API route handlers** under `src/app/api`.
- **Honest provider layer:** `src/lib/ai-provider.ts` implements a real HTTP client against
  `ZAI_BASE_URL` + `ZAI_API_KEY`. It returns `NOT_CONFIGURED` / `MISCONFIGURED` states and
  throws typed `PROVIDER_NOT_CONFIGURED` / `PROVIDER_ERROR` / `PROVIDER_TIMEOUT` /
  `INVALID_PROVIDER_RESPONSE` errors. **No fabricated completions exist.**
  Note: the brief asks for a `PROVIDER_UNAVAILABLE` label; the codebase's equivalent is
  `PROVIDER_NOT_CONFIGURED` (same behaviour, different name). No fake success was found.
- **Real execution gating** in `src/lib/agents/engine.ts`: agent-not-found, department-mapping
  mismatch, inactive agent, tool-not-permitted, cross-client access, and daily quota all fail
  closed with `status: 'FAILED'` before any provider call.
- **Outbox pattern** in `src/lib/comms.ts`: every send writes a `Communication` row (`QUEUED`),
  then updates it to `SENT` / `FAILED` / `NOT_CONFIGURED` / `DISABLED_BY_ADMIN`.
- **Staff auth** (`/api/auth/*`): scrypt password hashing with constant-time compare,
  DB-backed sessions with expiry, TOTP 2FA, CSRF double-submit.
- **RBAC** is real and layered: `hasRole`/`isSuperAdmin` (`src/lib/access-policy.ts`, 14 lines),
  enforced by `guard()` in `src/lib/api-guard.ts` (session + role + CSRF), ranked by
  `ROLE_RANK` (`src/lib/constants.ts:94`). `tests/ai-workforce-rbac.test.ts` (part of the
  passing suite) asserts every protected workforce route is SUPER_ADMIN-only.
  **Verified gap:** `ROLE_RANK` contains exactly four roles —
  `{ SUPER_ADMIN: 4, ADMIN: 3, MANAGER: 2, STAFF: 1 }`. **There is no `CUSTOMER` role.**
  Customers live entirely outside the `User`/role system, on the portal OTP path.
- **Customer portal auth** (`/api/portal/login`): Client ID + OTP over a configured channel,
  HMAC-signed stateless token, rate-limited, audit-logged, single-use challenge nonces.

---

## 3. Baseline test results (before any change)

```
npm run lint        → PASS (0 findings)
npm run typecheck   → 3 errors, all "Module '@prisma/client' has no exported member"
                      (Session, ChatConversation, ChatMessage) — missing generated client
npm test            → tests 197 · pass 196 · fail 1
                      the sole failure: tests/database-workflows.test.ts
                      "@prisma/client did not initialize yet. Please run prisma generate"
npm run schema:check→ PASS — provider=mysql, 86 native type annotations
```

---

## 4. REPAIR DELIVERED — outbox retry integrity (Phase 2)

### 4.1 The defect, with evidence

`src/lib/ops-loop.ts` selected failed outbound messages and re-dispatched them:

```ts
// BEFORE — src/lib/ops-loop.ts (opsScan)
db.communication.findMany({ where: { status: 'FAILED', direction: 'OUT',
  createdAt: { gte: new Date(now - 7*24*3600*1000) } }, ... })

// BEFORE — src/lib/ops-actions.ts, case 'RETRY_COMM'
const { result } = await sendCommunication({ clientId: comm.clientId, channel: comm.channel, ... })
```

`sendCommunication()` **creates a new `Communication` row** (`src/lib/comms.ts:177`,
`db.communication.create`). Three consequences, all confirmed by reading those two paths:

1. The original row stayed `FAILED` forever and matched the scan window again every cycle —
   **unbounded retries** for up to 7 days.
2. Each retry inserted a new row, which itself became a `FAILED` row eligible for retry —
   **the outbox grew instead of draining**.
3. There was no attempt counter and no backoff, so a bad recipient or rejected credential was
   hammered as hard as a transient 503. The only `attempts` column in the whole schema was on
   `AutomationLog` (`prisma/schema.prisma:739`); `Communication` had none.

The in-code comment claimed `// 3) FAILED COMM RETRY — safe re-attempt with backoff`.
**There was no backoff.** That comment has been corrected to describe what now actually happens.

This violates the brief's §6 ("secure retry, idempotency") and T08.

### 4.2 Changes made

| File | Change |
|---|---|
| `src/lib/outbox-retry.ts` | **NEW.** Pure policy module (no DB, no I/O): failure classification, exponential backoff, `decideRetry`, `scheduleAfterFailure`, `DEAD_LETTER`, `OUTBOX_MAX_ATTEMPTS = 5` |
| `prisma/schema.prisma` | `Communication` gains `attempts Int @default(0)`, `lastAttemptAt DateTime?`, `nextRetryAt DateTime?`, and `@@index([status, nextRetryAt])` |
| `prisma/migrations/3_outbox_retry_integrity/migration.sql` | **NEW.** Additive-only `ALTER TABLE` — no `DROP`, `TRUNCATE`, `DELETE` or `UPDATE` |
| `src/lib/comms.ts` | Extracted `dispatchChannel()` (send with no DB write) and `channelSwitchAllows()`; added `retryCommunicationOutbox()`. A first-send failure now records a backoff deadline |
| `src/lib/ops-actions.ts` | `RETRY_COMM` now calls `retryCommunicationOutbox()` instead of `sendCommunication()` |
| `src/lib/ops-loop.ts` | `opsScan` filters on `attempts < 5` and `nextRetryAt <= now`, and selects the new columns |
| `tests/outbox-retry.test.ts` | **NEW.** 22 pure policy tests |
| `tests/outbox-migration-parity.test.ts` | **NEW.** 13 migration/schema parity + non-destructive guards |
| `tests/outbox-retry-integration.test.ts` | **NEW.** 12 integration tests executing the real function |
| `package.json` | `test` script gains `--experimental-test-module-mocks` (required by the integration test) |

### 4.3 How the fix behaves

- A retry **updates the original row** — it never inserts a duplicate.
- The attempt is claimed with a conditional `updateMany({ where: { id, attempts } })`; if that
  affects 0 rows another dispatcher won the race and the send is **skipped**, so two concurrent
  triggers cannot double-send one message.
- Permanent failures (invalid recipient, `400/401/403/404/422`, rejected credentials, suspended
  account) go straight to `DEAD_LETTER` **without** a re-dispatch, and raise a notification.
- Transient failures (`408/429/5xx`, timeouts, `ECONNREFUSED`, `ENOTFOUND`) back off
  60s → 8m → 64m → 8.5h → 12h (±10% jitter) and terminate at 5 attempts.
- `NOT_CONFIGURED` and `DISABLED_BY_ADMIN` are **never** auto-retried — they are operator
  states, and retrying them cannot succeed.
- Nothing invents a `SENT` status: a retry is a genuine re-dispatch through the same adapter.

### 4.4 Test evidence for the repair

The integration test mocks only `@prisma/client` and drives the **real**
`retryCommunicationOutbox()`. Notable assertions that executed and passed:

| Test | Result |
|---|---|
| never inserts a duplicate row on retry (the original defect) | PASS |
| updates the SAME row and clears the retry deadline on success | PASS |
| backs off and reschedules the same row when the retry fails again | PASS |
| dead-letters a permanent failure without re-dispatching | PASS |
| dead-letters once the attempt budget is spent | PASS |
| honours the backoff window instead of hammering the provider | PASS |
| lets an operator force a retry past the backoff window | PASS |
| prevents a duplicate send when another dispatcher claims the attempt first | PASS |
| refuses to send when the Super Admin has switched the channel off | PASS |
| refuses to retry inbound messages | PASS |
| reports a missing record honestly instead of inventing a send | PASS |
| reschedules rather than dead-lettering on a provider 5xx | PASS |

The last test is the one that exposed a genuine subtlety: `src/lib/features.ts` caches flags
for 15s at module scope, and the instance reached through the `@/` alias keeps its own cache.
The test expires it with a mocked clock rather than changing production code.

---

## 5. Verification results AFTER the change

```
npm run lint         → PASS (0 findings)
npm run typecheck    → 3 errors — the SAME 3 pre-existing generated-Prisma-type errors,
                       no new errors introduced
npm run schema:check → PASS — provider=mysql, 86 native type annotations
npm test             → tests 242 · pass 241 · fail 1
```

Baseline was 197 tests / 196 pass. Now **242 tests / 241 pass**. The 45 added tests all pass.
The single failure is unchanged and pre-existing:

```
not ok 7 - tests/database-workflows.test.ts
  Error: @prisma/client did not initialize yet. Please run "prisma generate"
```

`.github/workflows/ci.yml:273` runs `npm test`, so CI picks up the new flag automatically.

**Migration safety:** `prisma migrate deploy` could not be run here (no engine, no MySQL).
Instead, `tests/outbox-migration-parity.test.ts` statically proves the hand-written SQL matches
`schema.prisma` (column names, MySQL types, nullability, defaults, index names), that every
`@@index` on `Communication` has a migration creating it, and that the file contains no
destructive statement. CI still performs the authoritative `prisma migrate diff --exit-code`
drift check against a disposable MySQL 8.0.

**Status of the repair: PASS in source and test. NOT VERIFIED against a real MySQL instance.**

---

## 6. Journey T01–T20 — honest status

Statuses below come from reading/executing the named files, not from documentation claims.

| ID | Scenario | Status | Evidence |
|---|---|---|---|
| T01 | New customer registers, gets confirmation | **FAIL — feature absent** | No registration route exists: `find src/app/api -type d \| grep -iE "regist\|reset\|forgot\|verify\|recover"` → no matches. `/api/portal/login` requires an **existing** `Client` row |
| T02 | Web chat gets a real contextual reply | **FAIL** | `POST /api/chat/message` stores the visitor message and returns it; no agent is invoked. `grep -rn "sender: 'AGENT'" src/` → **zero hits** |
| T03 | Conversation saved and visible in CRM | **PARTIAL** | Persistence PASSES (`ChatConversation`/`ChatMessage`). CRM sync FAILS: the route writes only a `TrackingEvent` named `lead`, never a CRM `Lead`/`Client` |
| T04 | Returning customer's history retrieved | **PARTIAL** | `latestConversationFor()` in `src/lib/chat.ts` keys on `anonId` only; not linked to a CRM customer record |
| T05 | AI creates a CRM task, assigns an agent | **NOT VERIFIED** | Requires DB + configured provider |
| T06 | Agent executes and persists a result | **NOT VERIFIED (source looks correct)** | `src/lib/agents/engine.ts` writes `AiAgentExecution` with real gating; cannot run without DB + provider |
| T07 | Follow-up queued and sent via email | **NOT VERIFIED** | `sendCommunication` writes `QUEUED` then dispatches via nodemailer; no SMTP available here |
| T08 | Delivery status and failure retries recorded | **PASS (source + tests) / NOT VERIFIED in prod** | This is the §4 repair; 12 integration tests execute the real path |
| T09 | Project creation succeeds | **NOT VERIFIED** | DB required |
| T10 | Planner creates trackable work items | **NOT VERIFIED** | DB + provider required |
| T11 | Approved tool creates a real downloadable artifact | **NOT VERIFIED** | `FileRecord` stores real bytes (`content Bytes? @db.LongBlob`); `scripts/build-source-archive.sh` exists. No artifact produced in this session |
| T12 | Project reaches review and customer approval | **NOT VERIFIED** | DB required |
| T13 | Final deliverable via authorized link/API | **NOT VERIFIED** | `/api/handover/[token]/download` exists; untested here |
| T14 | Handover event persisted | **NOT VERIFIED** | `HandoverRecord` model + `/api/handover/[token]/confirm` exist; untested here |
| T15 | Super Admin sees the same records everywhere | **NOT VERIFIED** | DB required |
| T16 | Unauthorized users cannot read others' records | **PARTIAL** | RBAC is layered: `src/lib/access-policy.ts` (14 lines — `hasRole`/`isSuperAdmin`/`canDecideApproval`) + `src/lib/api-guard.ts` `guard()` (session + role + CSRF) + `ROLE_RANK` in `src/lib/constants.ts:94`. `tests/ai-workforce-rbac.test.ts` passes and asserts every protected workforce route is SUPER_ADMIN-only and that CLIENT/STAFF/MANAGER/ADMIN are denied. Cross-client denial also exists in `engine.ts:170`. **Not verified:** HTTP-level tests for ordinary CRM/project routes against a live database |
| T17 | Timeout/provider failure gives truthful diagnostics | **PASS** | `tests/ai-ops-resilience.test.ts` passes: `withTimeout` rejects with `RunTimeoutError`; `isTransientRunError` distinguishes 429/503/timeout from validation errors |
| T18 | Hostinger serves the expected GitHub revision | **BLOCKED** | No hPanel access, no network path to the domain |
| T19 | Channel disconnection produces visible alerts | **PASS (source)** | `channelStatuses()` reports per-channel booleans; sends return `NOT_CONFIGURED` with an explicit error and are recorded, never faked |
| T20 | Complete journey registration → handover | **FAIL** | Blocked at step 1 (T01) |

---

## 7. Remaining blockers, in priority order

1. **No customer self-registration (T01, T20 — the journey cannot start).**
   The portal is passwordless by design (`Client` has no `passwordHash` column — confirmed by
   reading the model), a `Client` row must already exist, and `ROLE_RANK` has no `CUSTOMER`
   role at all. Adding registration therefore means a decision, not just code: keep passwordless
   OTP and let visitors self-create a `Client` pending email verification, or introduce a
   `CUSTOMER` role with password auth. **This needs your approval before I change the
   authentication model** — either option touches every existing authorization check.

2. **Web chat never answers (T02, §5 of the brief).**
   `src/lib/chat.ts` states this is deliberate — "no bots, no fake auto-replies — the widget
   honestly tells visitors a human will reply." The brief requires the opposite: answer in the
   originating chat. Wiring `runAgent()` into `POST /api/chat/message` is a small change, but I
   did **not** make it, because I cannot verify it here (no DB, no AI provider) and an
   unverified chatbot answering real customers is exactly the failure mode the brief forbids.
   Say the word and I will implement it with the provider-failure path returning an honest
   error rather than a plausible-sounding reply.

3. **Chat does not create CRM leads (T03).** No qualification rules or duplicate checks exist
   on the chat→lead path; only a `TrackingEvent` is written.

4. **74 of 110 departments have no agent.** Decide whether to staff them or stop presenting 110
   as an AI-workforce metric.

5. **Production remains NOT VERIFIED.** Hostinger deployment, MySQL schema identity, migration
   history, HTTPS, `/api/health` and a real AI/email round-trip all still require hPanel access
   and provider credentials that this session does not have. Carried forward from `B-001`…`B-006`.

6. **`prisma generate` is blocked in this sandbox**, so no local build or DB-backed test could
   run. CI (full network) is the only place the 3 typecheck errors and
   `database-workflows.test.ts` can be cleared.

---

## 8. What was deliberately NOT done

- No rebuild, no deletion of existing features, agents, migrations or models.
- No duplicate agents, services, tables or deployment pipelines.
- No second VPS/SSH deployment path added; Hostinger remains the sole production deployer.
- No paid SaaS or commercial API introduced.
- No secrets committed. `.env.example` untouched.
- No production database command was run; no customer data was touched.
- No feature was declared COMPLETE on the basis of a UI screen, a seed record or an untested route.
