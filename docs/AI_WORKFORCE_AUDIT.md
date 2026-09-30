# TECH360 — AI Employee workforce audit

`AI_WORKFORCE_STATUS = PARTIAL`

Last updated: 2026-09-30 · Branch `arena/01a0f285-tech360`

The workforce is **not** a placeholder: 44 agents across 84 departments, a real
execution engine, database-backed memory, and a lifecycle that persists every
stage. The gap is not "does it exist" — it is that several guarantees were
declared but not enforced, and nothing end-to-end has been observed running in
production (the application is not currently deployed).

---

## 1. Headline finding — the command center was not Super Admin only

Requirement §29/§30: the AI Employee workforce is internal and must be visible
**only** to `SUPER_ADMIN`, enforced server-side, not by hiding nav links.

It was not. 18 endpoints served internal workforce data to `MANAGER` or `ADMIN`:

| Endpoint | Was | Exposed |
|---|---|---|
| `admin/agents`, `admin/agents/[code]` | MANAGER | registry, profiles, **system prompts**, permissions |
| `admin/agents/[code]/run` | ADMIN | **execute an agent** |
| `admin/agents/export` | ADMIN | **export the whole workforce** |
| `admin/memory` | MANAGER | agent / company / client memory |
| `admin/logs`, `logs/audit` | MANAGER | audit trail |
| `admin/logs/automation`, `.../retry` | MANAGER | workflow runs + retry |
| `admin/logs/errors`, `.../resolve` | MANAGER | agent failures |
| `admin/command` | ADMIN | AI command center |
| `admin/ops-status` | **no `minRole` at all** | autonomous ops loop |
| `admin/knowledge`, `knowledge/search` | MANAGER | private agent knowledge |
| `admin/n8n`, `n8n/[code]/download` | MANAGER | agent workflow definitions |

The admin UI listed the same views at MANAGER/ADMIN. Because the API served the
data regardless of the UI, this was a real privilege boundary failure.

**Fixed.** `src/lib/ai-workforce-policy.ts` is now the single source of truth;
all 18 routes guard with `AI_WORKFORCE_MIN_ROLE`, and `VIEW_MIN_ROLE` matches.

`tests/ai-workforce-rbac.test.ts` walks the real filesystem, so a **new** route
under a protected prefix fails the build unless it declares the policy. Verified
by deliberately weakening the agents route to MANAGER — the suite failed, then
passed once restored.

---

## 2. Feature matrix

Status: **IMPLEMENTED** · **PARTIAL** · **MISSING** · **BLOCKED** · **NOT_VERIFIED**

| Feature | Status | Where | Missing work | Fixed this pass | Test |
|---|---|---|---|---|---|
| AI Employee registry | IMPLEMENTED | `lib/agents/registry.ts` (44 agents), `AiAgent` | — | RBAC | ✅ rbac |
| Departments | IMPLEMENTED | `Department`, 84 seeded | — | RBAC | ✅ rbac |
| Roles / hierarchy | IMPLEMENTED | `AiAgent.level`, `parentCode` | — | — | — |
| Skills | PARTIAL | `AiAgent.purpose`, `systemPrompt` | no discrete skill entity | — | — |
| Tool permissions | IMPLEMENTED | `ai-workforce-policy.authorizeAgentTool`, wired in `engine.runAgent` | — | **was stored but never enforced** | ✅ 6 tests |
| Agent memory (short/long/company/client) | IMPLEMENTED | `AiMemory`, `rememberMemory`/`recallMemory` | no retention policy | RBAC | — |
| Company / project / client memory scopes | IMPLEMENTED | `AiMemory.scope` | — | RBAC | — |
| Agent tasks | IMPLEMENTED | `ProjectTask` (`assigneeType=AGENT`) | — | — | ✅ db |
| Agent runs | IMPLEMENTED | `AiAgentExecution` (input/output/tokens/duration) | — | — | — |
| Agent workflows | IMPLEMENTED | `AutomationLog`, `N8nWorkflow` | — | RBAC | — |
| Agent approvals | IMPLEMENTED | `ApprovalRequest`, decision route is SUPER_ADMIN | — | — | ✅ policy |
| Agent escalation | PARTIAL | `automation-retry.ts`, `AutomationLog.attempts` | no explicit escalation entity | — | — |
| Agent audit logs | IMPLEMENTED | `AuditLog` + new tool-invocation events | no tamper-evidence | RBAC + tool audit | — |
| Super Admin command center | IMPLEMENTED | `admin/command`, `AdminApp` | — | **RBAC** | ✅ rbac |
| Agent dashboard | IMPLEMENTED | `admin/ops-status` — real queries, no mock data | — | **RBAC** | ✅ rbac |
| Client isolation | IMPLEMENTED | `agentMayAccessClient`, wired in `runAgent` | — | **was not enforced for agents** | ✅ 5 tests |
| Agent-to-agent communication | IMPLEMENTED | `AgentMessage` (internal, never in portal) | — | RBAC via logs | — |
| Client communication | IMPLEMENTED | `Communication` (channel/direction) | — | — | — |
| SMS | BLOCKED | `lib/comms.ts` | `SMS_API_URL`/`SMS_API_KEY` unset → `NOT_CONFIGURED` | — | — |
| Email (SMTP) | BLOCKED | `lib/comms.ts`, nodemailer | `SMTP_*` unset → `NOT_CONFIGURED` | — | — |
| WhatsApp | BLOCKED | `lib/comms.ts` | `WHATSAPP_*` unset → `NOT_CONFIGURED` | — | — |
| Lead intake | IMPLEMENTED | `journey.intakeLead` | — | — | ✅ db |
| Qualification | IMPLEMENTED | `journey.detectBusiness`, `recommendPlan` | — | — | — |
| Scope gathering | IMPLEMENTED | `journey.askScopeQuestions`, `submitScope` | — | — | ✅ db |
| SOW | IMPLEMENTED | `ScopeOfWork`, `finalizeScopeAndSend` | — | — | ✅ db |
| Proposal / preview | IMPLEMENTED | `Preview`, `generatePreview` | — | — | — |
| Payment | IMPLEMENTED | `requestPayment`/`recordPayment`/`verifyPayment`, SUPER_ADMIN verify | — | — | ✅ policy |
| Project creation | IMPLEMENTED | `journey.activateProject` | — | — | ✅ db |
| Task execution | IMPLEMENTED | `engine.runAgent` + `ProjectTask` | — | tool gate | — |
| QA | PARTIAL | task status `REVIEW`, `RUN_QA` tool | no dedicated QA entity | — | — |
| Client review / revision | IMPLEMENTED | `clientScopeDecision`, `Review` | — | — | — |
| Final approval | IMPLEMENTED | `ApprovalRequest` + SUPER_ADMIN decision | — | — | ✅ policy |
| Handover gate | IMPLEMENTED | `commerce-policy.evaluateHandoverGate` — server-side | — | — | ✅ policy |
| Project closure | IMPLEMENTED | `lifecycle-policy.evaluateProjectClosure`, SUPER_ADMIN | — | — | ✅ policy |
| Activity timeline | IMPLEMENTED | `admin/journey` from persisted records | — | — | — |
| Failure handling | IMPLEMENTED | `ErrorLog` + `AiAgentExecution.status=FAILED` + retry | — | denial events | — |
| Super Admin override | IMPLEMENTED | enable/disable, retry, approve, inspect | — | RBAC | — |

---

## 3. What was actually enforced vs. only declared

`AiAgent.permissions` and `AiAgent.tools` existed in the schema and were seeded
per agent — but `runAgent()` never read them. Any agent that reached the engine
could do anything the calling code asked for. Tenant isolation had the same
shape: `AiMemory` is client-scoped, but nothing stopped an agent run from being
issued against another client's id.

Both are now enforced **inside the engine**, before the model is called:

- `authorizeAgentTool` — empty permissions grant nothing; a `PAUSED`/`RETIRED`
  agent can never invoke a tool; unknown tools are rejected; malformed
  permission JSON fails closed; a `*` wildcard never covers the privileged set
  (payments, handover, file access, outbound messaging).
- `agentMayAccessClient` — an agent acting for client A cannot act on client B
  without an explicit `CROSS_CLIENT_READ` grant.

Every denial writes an `ErrorLog` **and** an `AuditLog` row
(`AGENT_TOOL_DENIED`, `AGENT_CROSS_CLIENT_DENIED`), so an agent probing for
capability it does not hold is visible. Successful privileged use writes
`AGENT_TOOL_INVOKED` with the execution id and correlation id.

---

## 4. Security tests (§49)

`tests/ai-workforce-rbac.test.ts` — 38 assertions, all passing.

| # | Requirement | Covered |
|---|---|---|
| 1–3 | CLIENT / STAFF / MANAGER cannot reach the dashboard | ✅ |
| 4 | non-SUPER_ADMIN cannot reach agent APIs | ✅ per-route, filesystem-walked |
| 5–8 | IDOR on agent / run / memory / log ids | ⚠️ role gate proven; per-id probing needs a live server |
| 9–11 | client cannot read internal comms / company memory / another client's data | ✅ policy level |
| 12 | agent cannot access unauthorized client data | ✅ `agentMayAccessClient` |
| 13 | agent cannot bypass approval | ✅ `canDecideApproval` (SUPER_ADMIN + PENDING) |
| 14 | agent cannot bypass payment gate | ✅ `evaluateStripePayment` |
| 15 | agent cannot bypass handover gate | ✅ `evaluateHandoverGate` |
| 16 | ordinary user cannot delete audit logs | ✅ no delete endpoint exists; reads are SUPER_ADMIN |
| 17 | disabled agent cannot execute | ✅ engine + `authorizeAgentTool` |
| 18 | unauthorized tool invocation fails | ✅ 6 assertions |
| 19 | failed executions are logged | ✅ `ErrorLog` + execution row |
| 20 | Super Admin can inspect the full chain | ✅ routes exist, SUPER_ADMIN gated |

Items 5–8 are marked ⚠️ deliberately: the role boundary is proven, but
**object-level** IDOR (same role, another tenant's id) can only be proven
against a running server with seeded multi-tenant data. Not claimed as verified.

---

## 5. Privacy (§52)

Internal workforce surfaces are server-gated to SUPER_ADMIN and are not
referenced by any public or portal route. `AgentMessage` (agent-to-agent) is
separate from `Communication` (client-visible), so internal chatter cannot
surface in the client portal. The public site exposes only marketing content.

---

## 6. Why the status is PARTIAL, not COMPLETE

| Reason | Detail |
|---|---|
| Not observed running | the application is not deployed — `https://bdtech360.com/` returns 403, `/api/health` returns Hostinger's static 404. No end-to-end lifecycle run has been witnessed in production. |
| Communication channels BLOCKED | SMS, email and WhatsApp have no credentials, so the SMS→handover chain cannot be exercised. The code reports `NOT_CONFIGURED` rather than faking success, which is correct — but it is not "working". |
| Object-level IDOR unproven | needs a live server with two seeded tenants. |
| Skills / escalation PARTIAL | expressed through prompts and retry counters rather than first-class entities. |
| Audit log tamper-evidence | rows can be read but there is no append-only guarantee at the database level. |

Per §50 and §53, none of these are claimed as complete.
