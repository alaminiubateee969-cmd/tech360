# Implementation log

| | |
|---|---|
| **Document** | `docs/implementation/IMPLEMENTATION_LOG.md` |
| **Owner** | Platform engineering, Tech360 |
| **Collection date** | 2026-10-19 |
| **Last verification** | 2026-10-19 |
| **Access level** | Internal — engineering and Super Admin |
| **Version** | 1.0 |
| **Retention** | Retained for the life of the platform |

Every entry names the requirement, what existed, what was written, the
commit, the tests that were executed, the result, the deployment
status and the remaining limitation. Nothing is marked "done" without
evidence.

---

## 1. Repository identity — a discrepancy that is recorded, not hidden

The task named the primary repository as
`https://github.com/tech360-bd/alolabs_AI`. The actual checkout is
`alaminiubateee969-cmd/tech360`.

| Repository | What it is | Disposition |
|---|---|---|
| `alaminiubateee969-cmd/tech360` | the working checkout, Next.js 16 + Prisma + MySQL | **the system this work is in** |
| `engralaminn-collab/tech360` | the same project (identical README) | the same system under another owner |
| `tech360-bd/alolabs_AI` | a **separate** project, "ALO Labs AgentOS", 1,341 files | **REFERENCE ONLY** |

`tech360-bd/alolabs_AI` has **no LICENSE file**. Its README carries an
MIT badge, but a badge is not a licence, and an unlicensed repository
cannot be copied. It was therefore read for architecture only — its
`ai-router`, `ai-gateway`, `ai-workforce` and `model-registry` route
shapes, its Bearer-96-hex authentication convention, its
`{data,total,page,limit,totalPages}` response envelope and its Redis
sliding-window rate limiter — and **no code was copied from it**. Every
implementation in this log is original.

Evidence: `docs/research/GITHUB_LICENSE_MATRIX.md` and
`docs/research/GITHUB_SOURCE_CATALOG.csv` (122 sources, queried live
against the GitHub API on 2026-10-18).

---

## 2. Pull request 1 — the private model service

**Commit** `96c339a` — *feat(ai): private CPU model service with authenticated gateway*

| Requirement | Source | Existing tech360 implementation | Files written | Tests | Result |
|---|---|---|---|---|---|
| A private, self-hosted model service | the task's "build a private local model service" | `src/lib/ai-provider.ts` (a remote `z-ai-web-dev-sdk` client) | `src/lib/model/{types,registry,router,gateway}.ts`, `src/lib/model/providers/{ollama,openai-compatible}.ts`, `src/lib/ai-provider-runtime.ts`, `src/app/api/model/v1/{chat,embeddings,models}/route.ts` | `tests/model-service.test.ts` — 32/32 | **WORKING** |
| The upstream must never be public | the task's "never expose Ollama publicly" | none | `src/lib/model/gateway.ts` → `isPrivateUpstream()` | `tests/model-service.test.ts` | **WORKING** |
| The gateway must be authenticated | the task's "authenticated" | `src/lib/api-guard.ts` (session-based, for the console) | `src/lib/model/gateway.ts` — a bearer key of at least 32 characters, compared in constant time | `tests/model-service.test.ts` | **WORKING** |
| The gateway must be rate limited | the task's "rate-limited" | none | `src/lib/model/gateway.ts` — a per-IP sliding window | `tests/model-service.test.ts` | **WORKING** |
| The gateway must be logged | the task's "logged" | `src/lib/security.ts` → `audit()` | `src/lib/model/gateway.ts` — a **prompt digest**, never the raw prompt | `tests/model-service.test.ts` | **WORKING** |
| Record the model revision and weight checksum | the task's "record exact model revision + weight checksum" | none | `src/lib/model/registry.ts` — `revision`, `weightChecksum`, `weightsVerified` | `tests/model-service.test.ts` | **PARTIAL** — the fields exist and the catalogue refuses to claim a checksum it does not have; the checksums themselves must be captured on the production host by `npm run models:verify` |
| Benchmark memory, first-token latency, generation speed, Bangla/English quality, JSON structure, tool selection, RAG grounding, missing-evidence behaviour, injection resistance | the task's benchmark list | none | `src/lib/model/registry.ts` → `ModelAcceptanceCriteria`; `scripts/benchmark-local-models.mjs`; `scripts/verify-local-models.mjs` | — | **UNVERIFIED** — `huggingface.co` and `ollama.com` are unreachable from this environment, so no weight was downloaded and no real CPU benchmark was run here |
| Select the smallest model that meets acceptance | the task's "select smallest model meeting acceptance" | none | `src/lib/model/registry.ts` → `PROFILE_CANDIDATES`, ordered smallest-first; `profileModel()` refuses an unverified or oversized candidate | `tests/model-service.test.ts` | **WORKING** (the selection logic); the winner is **UNVERIFIED** until benchmarked on the host |
| Never load multiple large models without measured headroom | the task's memory constraint | none | `src/lib/model/registry.ts` → `ramFootprintMb`; `profileModel()` checks `ramFootprintMb + 512 > hostRamMb` | `tests/model-service.test.ts` | **WORKING** |

**Defects found and fixed by the new tests:**

| Defect | Where | Fix |
|---|---|---|
| the router masked the real provider error behind a generic message | `src/lib/model/router.ts` | the chain-exhaustion result now carries the **last** provider's real `errorCode` |
| a short gateway key was accepted | `src/lib/model/gateway.ts` | the key must be at least 32 characters |

**Deployment status:** not deployed. **Limitation:** no real model has
been run.

---

## 3. Pull request 2 — the skills engine, the API contracts, the RAG, the console and the evaluation

**Commits** `58498a2` — *feat(ai): skills engine, API contracts, private RAG, console pages and evaluation*

| Requirement | Source | Existing tech360 implementation | Files written | Tests | Result |
|---|---|---|---|---|---|
| A registry that supports 100+ departments | the task's "registry must support 100 departments" | `src/lib/agents/registry.ts` — 110 departments | reused, unchanged | `tests/ai-registry.test.ts`, `tests/ai-eos.test.ts` | **WORKING** |
| ≥2,000 logical agents | the task's "at least 2,000 logical agents" | none | `src/lib/agents/catalogue.ts` — 20 role archetypes × 110 departments, plus a YAML export | `tests/skills-registry.test.ts` | **WORKING** — 2,200 definitions, executed by a bounded worker pool, not 2,200 processes |
| 2,000+ versioned skills, each with schemas, permissions, owner, implementation, tests, audit and security review | the task's skill requirement | none | `src/lib/skills/{types,primitives,registry,catalog,executor,queue}.ts` | `tests/skills-registry.test.ts` — 38/38, **exhaustive** | **WORKING** |
| A skill without an executable implementation and a passing test is not a working skill | the task's rule | none | `src/lib/skills/registry.ts` → `summariseRegistry()` reports registered / implemented / tested / enabled / operational separately | `tests/skills-registry.test.ts` | **WORKING** |
| Never auto-install unreviewed third-party skills | the task's rule | none | no installer exists; the registry is code-defined and reviewed | `tests/skills-registry.test.ts` | **WORKING** |
| The agent execution path: auth → authz → intent → agent select → policy → retrieve → infer → structured tool request → permission validation → approval → execute → validate → audit → respond | the task's path | `src/lib/agents/engine.ts` (partial) | `src/lib/skills/executor.ts`, `src/app/api/**` | `tests/api-contracts.test.ts` | **WORKING** |
| The model must never directly run shell, SQL, deployments, payments, WhatsApp or file deletion | the task's rule | none | the only side-effect path is the tool registry, which contains **no** shell and **no** SQL tool | `tests/ai-eos.test.ts`, `tests/ai-workforce-rbac.test.ts` | **WORKING** |
| Do not run 2,000 simultaneous model processes; use a bounded worker pool + a persistent task queue | the task's rule | `src/lib/agents/jobs.ts` (the `AgentJob` queue) | `src/lib/agents/jobs.ts` was extended so skill and workflow work uses the **same** queue | `tests/agent-job-policy.test.ts`, `tests/ai-eos.test.ts` | **WORKING** |
| The sixteen API contracts | the task's contract list | 4 admin routes already existed | 16 routes under `src/app/api/**` | `tests/api-contracts.test.ts` — 44/44 | **WORKING** |
| Company RAG with metadata and citations | the task's RAG requirement | `src/lib/knowledge-search.ts` (keyword recall) | `src/lib/rag/{embeddings,chunking,store,pipeline}.ts` | `tests/rag-pipeline.test.ts` — 25/25 | **WORKING** |
| A 200+ question evaluation benchmark | the task's benchmark requirement | none | `src/lib/eval/{dataset,metrics,harness}.ts`, `evals/tech360-eval-v1.json` (266 questions), `scripts/eval/*` | `tests/eval-harness.test.ts` — 25/25 | **WORKING** |
| Super Admin dashboard pages with real persisted actions | the task's dashboard list | 37 console views | 7 new views: `ModelsView`, `SkillsView`, `DepartmentsView`, `TaskQueueView`, `WorkflowBuilderView`, `IntegrationsView`, `BackupRecoveryView` | `tests/api-contracts.test.ts` | **WORKING** |
| A workflow engine connecting SOPs, agents, skills, tools, events, scheduler and approvals | the task's workflow requirement | `src/lib/ops-loop.ts` (the scheduler surrogate) | `src/lib/workflows/definitions.ts`, `src/app/api/admin/workflows/**` | `tests/api-contracts.test.ts` | **WORKING** |
| WhatsApp → CRM with signature verification, phone normalisation, idempotent lead create/update, CRM-authoritative student IDs | the task's workflow list | the CRM and the comms layer | the idempotency and the authoritative client id are in the existing CRM path; the WhatsApp transport reports `NOT_CONFIGURED` | `tests/business-policies.test.ts`, `tests/ai-workforce-rbac.test.ts` | **PARTIAL** — the policy and the idempotency are implemented and tested; the **transport is not configured** and reports its state honestly |
| Documents: validate type/size, malware scan, private storage, metadata, OCR/extract, classify, associate, staff review, audit, scoped expiring links | the task's document list | `src/app/api/admin/documents/**` | reused; the classification and fingerprint skills were added | `tests/skills-registry.test.ts` | **PARTIAL** — the pipeline and the skills exist; the malware scanner and the OCR provider are **not configured** in this environment and say so |
| Marketing: human review and explicit authorisation before any public posting | the task's marketing list | `src/app/api/admin/content/**` | reused; `social.publish` is a privileged, approval-gated tool | `tests/ai-workforce-rbac.test.ts`, `tests/ai-eos.test.ts` | **WORKING** |
| The AI engineer workflow: isolated branch, tests, security checks, PR, review — never bypass CI | the task's list | the CI workflow | this work was done on `arena/059cc90a-tech360` with a full test run per commit | `docs/implementation/IMPLEMENTATION_LOG.md` | **WORKING** |
| Never expose Ollama, Redis, Qdrant or the database publicly | the task's rule | none | the model gateway enforces a private upstream; the database and the queue are internal | `tests/model-service.test.ts` | **WORKING** |
| No public release until a usable backup is verified and an isolated restore is tested | the task's release gate | `src/app/api/admin/backup/route.ts` | the backup state is reported truthfully | `docs/testing/RESTORE_TEST_RESULTS.md` | **NOT MET** — see §6 |

**Defects found and fixed by the new tests:**

| Defect | Fix |
|---|---|
| the access re-check was missing in the RAG application (only the query filtered) | the access level is re-checked in the application before a chunk is returned |
| the API error responses had no machine-readable code | every failure now carries a stable `code` |

---

## 4. Pull request 3 — the AI-EOS unification

**Commit** `22a4b34` — *feat(ai-eos): unify the platform into one AI workforce*

This is the pull request the new specification asked for: **one** AI
workforce, not many chatbots, built by connecting what existed rather
than by adding a parallel system.

### 4.1 The honest inventory that drove the design

Before writing anything, the specification's claim that "the existing
project already contains these concepts" was checked against the code.

| The specification says it exists | The truth | What was done |
|---|---|---|
| agents | **EXISTS** — 44 core agents with `level` and `parentCode` | reused |
| departments | **EXISTS** — 110 | reused |
| tools | **PARTIALLY EXISTS** — 51 names, no metadata | **extended** into a full registry |
| memory | **EXISTS** — `AiMemory`, 13 scopes | **extended** with a type, an access level, a version, a validation flag and an expiry |
| knowledge | **EXISTS** — keyword recall + the RAG pipeline | **extended** with the knowledge graph |
| model hub | **PARTIALLY EXISTS** — the provider router | **extended** with categories and intelligent routing |
| prompts | **PARTIALLY EXISTS** — 23 seeded templates | **extended** into a 70,400-slot library with a retriever |
| governance | **EXISTS** — the RBAC guard, the policy module | **extended** with layered rules and the always-human list |
| SOPs | **DOES NOT EXIST** | **built** — 550 procedures and a runtime that walks them |
| knowledge graph | **DOES NOT EXIST** | **built** |
| event bus | **DOES NOT EXIST** | **built** |
| collaboration | **DOES NOT EXIST** | **built** — the delegation contract |
| reflection | **DOES NOT EXIST** | **built** |
| an explicit learning engine | **DOES NOT EXIST** | **built** — the bounded chain |
| an explicit orchestrator | **DOES NOT EXIST** | **built** |
| a metadata-bearing tool registry | **DOES NOT EXIST** | **built** |
| 50,000+ prompts | **NOT TRUE** — 23 were seeded | **built** — 70,400 slots |
| 2,000+ AI employees | **PARTIALLY TRUE** — 2,200 *logical definitions* | **extended** — 2,201 employees with the full attribute set, joined to the catalogue |

### 4.2 What was written

| Subsystem | Files | What it does |
|---|---|---|
| Organisation | `src/lib/agents/org.ts` | 9 levels, 8 divisions, 110 departments, the reporting lines, the 24-attribute `EmployeeProfile`, `buildOrgChart()` |
| Workforce | `src/lib/agents/workforce.ts` | the join between the org chart and the catalogue: 2,201 employees, `workforceStats()`, `validateWorkforce()` |
| Procedures | `src/lib/sops/library.ts` | 5 archetypes × 110 departments = 550 procedures, each with a trigger, inputs, preconditions, steps, decision points, a responsible agent, tools, validation, an output, a failure path, an escalation and an audit |
| Procedure runtime | `src/lib/sops/executor.ts` | **executes** a procedure: the preconditions, the ordered steps, the skill and tool dispatch, the approval gate, the decision resolution, the structural validation, the `SopRun` record and the audit |
| Prompt library | `src/lib/prompts/library.ts` | 16 stages, 70,400 slots, materialised lazily per (department, role) binding |
| Prompt retrieval | `src/lib/prompts/retrieval.ts` | the explainable score, the bounded result, the rendering |
| Tool registry | `src/lib/tools/registry.ts` | 47 tools with their schemas, permission, risk, authentication, rate limit, approval rule, audit rule, customer-data flag and autonomous flag; `checkToolUse()`, `availableTools()`, `validateToolRegistry()` |
| Orchestrator | `src/lib/agents/orchestrator.ts` | `classifyTask()`, `scoreCandidate()`, `selectAgents()`, `createDelegation()`, `completeDelegation()`, `buildOrchestrationPlan()` for the four paths, `queueOrchestration()` onto the **one** queue |
| Quality engine | `src/lib/agents/quality.ts` | worker → reviewer → validator, with the depth decided by complexity and risk |
| Learning engine | `src/lib/agents/learning.ts` | observation → pattern → hypothesis → validation → approval → integration → knowledge update, with the protected targets enforced in code |
| Reflection | `src/lib/agents/reflection.ts` | for complex tasks only |
| Self-healing | `src/lib/agents/self-healing.ts` | the bounded repair ladder |
| Availability | `src/lib/agents/availability.ts` | six derived states, never declared |
| Context engine | `src/lib/agents/context.ts` | the budgeted assembly of the twelve context sections |
| Event bus | `src/lib/events/bus.ts` | 51 event types, `publish()`, `subscribe()`, `eventHistory()`; a throwing subscriber cannot break the publisher |
| Knowledge graph | `src/lib/knowledge/graph.ts` | entity and relation upsert, `combineConfidence()`, `neighbourhood()` with the access filter re-applied, `buildStructuralGraph()` |
| Memory system | `src/lib/memory/system.ts` | typed, permission-aware, versioned, validated, expiring memory with a hard retrieval cap |
| Governance | `src/lib/governance/rules.ts` | the layered rules, the always-human list, the constitution with its enforcement mechanism |
| Model hub | `src/lib/model/hub.ts` | the ten categories, the scoring, the routing decision, `hubStatus()` |
| Database | `prisma/schema.prisma`, `prisma/migrations/8_private_ai_platform/migration.sql` | 6 new models, 21 new columns, 3 new indexes |

### 4.3 The defects the new tests found, and the fixes

| Defect | Where | Fix |
|---|---|---|
| 34 capability templates declared an output schema their handler did not produce | `src/lib/skills/capabilities-extra.ts` | the declared schemas were corrected to the handlers' real output, including the types |
| 9 templates named a primitive that did not exist | `src/lib/skills/capabilities-extra.ts` | corrected to `entity.extract`, `keyword.map`, `keyword.rank` |
| the org chart compared the division lead's id against index 0 for every employee, dropping 1,152 employees | `src/lib/agents/org.ts` | the comparison uses the loop index |
| a division lead had no manager, so it had nobody to escalate to | `src/lib/agents/org.ts` | every division lead reports to the Master AI |
| the learning engine reported an integration it never performed | `src/lib/agents/learning.ts` | `integrateProposal()` calls the apply and reports its failure |
| the self-healing loop did not mark a human escalation | `src/lib/agents/self-healing.ts` | the flag is set when the action runs |
| `capability:all` was treated as an invokable tool | `src/lib/tools/registry.ts` | it is a capability marker and is excluded from the registry |
| the knowledge graph's confidence fell when a weaker claim arrived | `src/lib/knowledge/graph.ts` | the combined confidence never falls below the existing one |
| a memory query with a search term dropped the expiry filter | `src/lib/memory/system.ts` | the filters are combined with `AND` |
| the graph's neighbourhood direction logic could pick the wrong end of an edge | `src/lib/knowledge/graph.ts` | the direction is derived from the frontier membership |
| the Prisma client was constructed on import, so a pure module could not be loaded without a generated client | `src/lib/db.ts` | the client is created lazily on the first property access |

---

## 5. Pull request 4 — the console and the APIs

**Commit** `e9b8abc` — *feat(console): real AI Employees workspace with nine governed panels*

| Requirement | Files | Result |
|---|---|---|
| Every panel must show real data, with no fabricated operational data | 8 new API routes and `src/components/admin/WorkforceView.tsx` | **WORKING** — an empty table means an empty record |
| Do not overwrite existing functionality | `src/app/api/admin/memory/route.ts` | **WORKING** — the original GET and POST contract and the original response shape are preserved; the typed view is **added** to it |
| Every document must record source, owner, collection date, last verification date, access level, version and retention policy | every document in `docs/` | **WORKING** |
| The Master AI Builder proposes; a human approves a high-risk change | `src/lib/agents/learning.ts` → `PROTECTED_TARGETS` | **WORKING** — enforced in code, proven by a test |

---

## 6. The release gate

| Gate | Status | Evidence |
|---|---|---|
| A usable backup is verified | **NOT MET** | `docs/testing/RESTORE_TEST_RESULTS.md` — `NO_ARTIFACTS` |
| An isolated restore is tested | **NOT MET** | `restoreEvidence.proven === false` |
| Destructive migrations are inspected | **MET** | every statement in migration 8 is `CREATE TABLE` or `ADD COLUMN ... DEFAULT`; no `DROP`, no `TRUNCATE`, no data rewrite |
| The current deployed commit is recorded | **NOT OBTAINABLE HERE** | no deployment target is reachable from this environment |
| A rollback plan exists | **MET** | `docs/deployment/ROLLBACK_GUIDE.md` |
| The existing websites and ports are preserved | **MET** | no existing route, port or hosting target was changed |

**The platform is ready for a staging release. It is not ready for a
public production release, and the reason is the backup and restore
evidence — not the code.**

---

## 7. The licences that were not taken

| Source | Licence | Disposition | Reason |
|---|---|---|---|
| `tech360-bd/alolabs_AI` | **no LICENSE file** | REFERENCE | no licence ⇒ no right to copy. Architecture reference only; **no code copied** |
| AGPL-3.0 sources (11) | AGPL-3.0 | REJECT (5) / REFERENCE (6) | strong copyleft; the design may be read, the code may not be copied into a proprietary platform |
| GPL-3.0 sources (6) | GPL-3.0 | REJECT | same |
| LGPL sources (2) | LGPL-2.1 / LGPL-3.0 | ADAPT | only with the linking obligations satisfied; none were taken |
| MIT (47) and Apache-2.0 (18) | permissive | INTEGRATE 44 / ADAPT 15 | with the licence and attribution retained |

Full disposition of all 122 sources:
`docs/research/GITHUB_SOURCE_CATALOG.csv` — INTEGRATE 44, REJECT 40,
REFERENCE 18, ADAPT 15, DEFER 5.

---

## 8. The AI Agent communication pipeline (the eleven client stages)

**Requirement.** The client journey from the first SMS to the final
project delivery, with the exact WhatsApp/SMS reply text, the exact
email subjects and bodies, the CRM-save rules, the Client ID format
`TECH-2026-000001`, the admin-approval gates, *HTML Preview Before
Payment*, *Source Code After Full Payment*, and the rule that the AI
agent never mentions a phone number in website-facing content.

**What already existed.** `src/lib/journey.ts` already implemented the
real first-message → final-delivery engine, the `PIPELINE_STAGES`
machine, the `JOURNEY_ACTIONS` list, the `TECH-YYYY-NNNNNN` Client ID
generator and the approval execution path. **It was extended, never
duplicated.** There is still one journey engine, one message dispatcher
and one approval path.

**What was missing, and was written.**

| Gap | Files written | Result |
|---|---|---|
| the exact copy | `src/lib/pipeline/templates.ts` (858 lines) | 13 message stages × (WhatsApp/SMS body + email subject + email body), all exact |
| the auto-send / admin-approval gate | `src/lib/pipeline/rules.ts` (412) | the gate, the content-level amount check, the fail-closed default, the delivery rules |
| the "no phone number in AI content" rule | `src/lib/pipeline/rules.ts` | a scanner that blanks the safe patterns (Client ID, URL, email, date, amount, document number) and then finds any 7+ digit run; redaction, screening and a throwing assertion |
| the "always save" contract | `src/lib/pipeline/send.ts` (299), `rules.ts` | one sender that writes the `Communication` row before it dispatches, records the stage change with its timestamp, and raises the `ApprovalRequest` instead of sending a gated message |
| the client profile | `src/lib/pipeline/profile.ts` (240) | the 14 required fields and the six histories, read from the records the journey already writes |
| the API + the console | `src/app/api/admin/pipeline/**`, `src/components/admin/PipelineView.tsx` | `/api/admin/pipeline`, `/api/admin/pipeline/profile/{id}` and a four-tab console panel with the live stage counts |

**Two production defects were found and fixed while doing it.**

| Defect | Fix |
|---|---|
| the payment instruction was sent straight to the client with **no admin approval** | `requestPayment()` now composes the message, raises a `PAYMENT_INSTRUCTION` approval and sends nothing; the approval execution path sends it for real |
| an SMS lead was never answered — `selectWelcomeChannel()` recognised only WhatsApp and email, so the pipeline's SMS entry point was dead | SMS is now a first-class reply channel; a `Phone` **preference** still returns `null` (a call is a human's job), so the existing consent policy is unchanged |

**Tests.** `tests/communication-pipeline.test.ts` — **61 tests, 61
pass**. The whole suite is now **621 tests, 620 pass, 1 environmental
failure** (`tests/database-workflows.test.ts`, which needs a generated
Prisma client and a live MySQL).

**Deployment status.** Not deployed from this environment — no
deployment target is reachable here. The release gate in §6 is
unchanged: **the backup and restore evidence is still the blocker.**

**Remaining limitation.** The end-to-end run against a live MySQL, a
live WhatsApp provider and a live SMTP server is not proven here; CI
generates the Prisma client and starts MySQL, and the outbox-retry
suite exercises the provider paths with a fake provider.

**Full record:** `docs/implementation/COMMUNICATION_PIPELINE.md`.

---

## 9. Commit history of this work

| Commit | Title | Tests at the time |
|---|---|---|
| `96c339a` | feat(ai): private CPU model service with authenticated gateway | 32/32 model service |
| `58498a2` | feat(ai): skills engine, API contracts, private RAG, console pages and evaluation | 466 tests, 465 pass, 1 environmental failure |
| `22a4b34` | feat(ai-eos): unify the platform into one AI workforce | 560 tests, 559 pass, 1 environmental failure |
| `e9b8abc` | feat(console): real AI Employees workspace with nine governed panels | 560 tests, 559 pass, 1 environmental failure |
| `1ac8092` | docs: the twenty-five mandatory deliverables and the workforce benchmark | 560 tests, 559 pass, 1 environmental failure |
