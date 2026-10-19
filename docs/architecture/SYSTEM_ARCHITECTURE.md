# System architecture — the Tech360 AI Enterprise Operating System

| | |
|---|---|
| **Document** | `docs/architecture/SYSTEM_ARCHITECTURE.md` |
| **Owner** | Platform engineering, Tech360 |
| **Collection date** | 2026-10-19 |
| **Last verification** | 2026-10-19 (see *Verification method* below) |
| **Access level** | Internal — engineering and Super Admin |
| **Version** | 1.0 |
| **Retention** | Retained for the life of the platform; superseded versions archived in git history |

---

## 1. What this system is

One production-grade AI **workforce**, not many chatbots. 2,201 employees
across 110 departments and 8 divisions, sharing **one** runtime, **one**
orchestrator, **one** model hub, **one** knowledge system, **one** memory
system, **one** tool registry, **one** governance layer, **one** event bus
and **one** workflow engine.

The specification that drove this work asked for the opposite of what a
chatbot platform produces, so the architecture below is organised around
one rule:

> A model is a capability. An employee is a role with authority, memory,
> knowledge, tools and KPIs. The two are never conflated.

### 1.1 Verified shape of the platform

Every number below is **counted from the code**, not asserted. The
collection script is `scripts/research/` plus the module exports; the
counts are reproduced by `tests/ai-eos.test.ts`.

| Entity | Count | Source of truth |
|---|---:|---|
| AI employees | **2,201** | `src/lib/agents/workforce.ts` → `WORKFORCE` |
| Departments | **110** | `src/lib/agents/registry.ts` → `DEPARTMENTS` |
| Divisions | **8** | `src/lib/agents/org.ts` → `DIVISIONS` |
| Organisational levels | **9** | `src/lib/agents/org.ts` → `ORG_LEVELS` |
| Role archetypes | **20** | `src/lib/agents/catalogue.ts` → `ROLE_ARCHETYPES` |
| Skills | **10,010** | `src/lib/skills/catalog.ts` → `SKILL_CATALOG` |
| Capability templates | **91** | `src/lib/skills/catalog.ts` → `CAPABILITY_TEMPLATES` |
| Executable primitives | **20** | `src/lib/skills/primitives.ts` → `SKILL_HANDLERS` |
| Standard operating procedures | **550** | `src/lib/sops/library.ts` → `SOP_LIBRARY` |
| Prompt slots | **70,400** | `src/lib/prompts/library.ts` → `promptLibraryIndex()` |
| Governed tools | **47** | `src/lib/tools/registry.ts` → `TOOL_REGISTRY` |
| Event types | **51** | `src/lib/events/bus.ts` → `EVENT_TYPES` |
| Model catalogue entries | **6** | `src/lib/model/registry.ts` → `MODEL_CATALOG` |
| Prisma models | **69** | `prisma/schema.prisma` |
| Migrations | **9** (`0_init` … `8_private_ai_platform`) | `prisma/migrations/` |
| API routes | **162** | `src/app/api/**/route.ts` |
| Console views | **44** | `src/components/admin/*.tsx` |
| Source files under `src/` | **403** (74,430 lines) | filesystem |
| Test files | **35** | `tests/*.test.ts` |

---

## 2. The canonical layers

The specification defines six canonical layers. Each maps to exactly one
place in the codebase, and **no layer has a second implementation**.

```
┌──────────────────────────────────────────────────────────────────────────┐
│  GOVERNANCE                                                              │
│  constitution · layered rules (global→company→department→role→agent→task) │
│  RBAC + ABAC · tool/memory/data permissions · approvals · audit          │
│  src/lib/governance/rules.ts  src/lib/ai-workforce-policy.ts             │
│  src/lib/api-guard.ts  src/lib/security.ts                              │
└──────────────────────────────────────────────────────────────────────────┘
┌──────────────────────────────────────────────────────────────────────────┐
│  RUNTIME                                                                 │
│  agent runtime · orchestrator · context engine · quality chain           │
│  learning engine · reflection · self-healing · collaboration             │
│  src/lib/agents/{engine,jobs,orchestrator,context,quality,learning,…}.ts │
│  ONE durable queue: AgentJob                                             │
└──────────────────────────────────────────────────────────────────────────┘
┌──────────────────────────────────────────────────────────────────────────┐
│  MODEL HUB                                                               │
│  model catalogue · categories · intelligent routing · fallback            │
│  performance · cost · health                                            │
│  src/lib/model/{registry,router,hub}.ts  src/app/api/model/v1/*          │
└──────────────────────────────────────────────────────────────────────────┘
┌──────────────────────────────────────────────────────────────────────────┐
│  KNOWLEDGE SYSTEM                                                        │
│  RAG (chunking, embeddings, vector store, grounded answering)           │
│  + Knowledge Graph (entities, relations, provenance, access levels)      │
│  src/lib/rag/*  src/lib/knowledge/graph.ts  src/lib/knowledge-search.ts  │
└──────────────────────────────────────────────────────────────────────────┘
┌──────────────────────────────────────────────────────────────────────────┐
│  MEMORY SYSTEM                                                           │
│  working · episodic · semantic · procedural                              │
│  enterprise scopes · permission-aware · versioned · validated · expiring │
│  src/lib/memory/system.ts  (AiMemory table)                              │
└──────────────────────────────────────────────────────────────────────────┘
┌──────────────────────────────────────────────────────────────────────────┐
│  DATABASE — the source of truth for everything above                      │
│  Prisma → MySQL, 69 models, 9 migrations, utf8mb4 throughout              │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## 3. The one runtime

There is **one** agent runtime and **one** durable task queue. This is the
single most important architectural decision in the platform, because the
obvious way to serve 2,201 employees is to give each one a process — which
the specification forbids explicitly ("do not run 2,000 simultaneous model
processes").

| Concern | Implementation | Not a second implementation of |
|---|---|---|
| Agent execution | `src/lib/agents/engine.ts` → `runAgent()` | — |
| Durable queue | `src/lib/agents/jobs.ts` → `AgentJob` | — |
| Skill execution | `src/lib/skills/executor.ts` → `executeSkill()` | — |
| Orchestration steps | `src/lib/agents/orchestrator.ts` → `queueOrchestration()` | — |
| Scheduled work | `src/lib/ops-loop.ts` → `runOpsCycle()` | — |

**All four of those enqueue onto the same `AgentJob` table.** A skill run
is a job whose `taskType` is `SKILL`; an agent inference is a job whose
`taskType` is `INFERENCE`; an orchestration step is a job. The queue
provides:

- leases (`leaseUntil`) so a crashed worker does not strand a job;
- bounded exponential backoff (`availableAt`, `maxAttempts`);
- an idempotency key (`idempotencyKey`, unique) so a duplicate request
  returns the original job rather than running twice;
- a durable `checkpoint` so a retry resumes instead of restarting;
- an approval state machine (`approvalState`) that pauses the job.

### 3.1 The execution chain

The specification's chain, mapped to the code that implements it:

| # | Step | Implementation |
|---|---|---|
| 1 | Authentication | `src/lib/api-guard.ts` → `guard()` — session cookie, CSRF, role |
| 2 | Authorisation | `src/lib/ai-workforce-policy.ts` → `authorizeAgentTool()` |
| 3 | Agent resolution | `src/lib/agents/registry.ts`, `src/lib/agents/workforce.ts` |
| 4 | Identity | `EmployeeProfile` — the 24 attributes |
| 5 | Department context | `src/lib/agents/context.ts` → `departmentRules()` |
| 6 | Constitution | `src/lib/agents/registry.ts` → `CONSTITUTION` |
| 7 | Permissions | `src/lib/governance/rules.ts` → `evaluateGovernance()` |
| 8 | Task classification | `src/lib/agents/orchestrator.ts` → `classifyTask()` |
| 9 | Complexity | `classifyTask()` → `SIMPLE` / `STANDARD` / `COMPLEX` / `ENTERPRISE` |
| 10 | Skill selection | `src/lib/skills/registry.ts` → `discoverSkills()` |
| 11 | Prompt selection | `src/lib/prompts/retrieval.ts` → `retrievePrompts()` |
| 12 | SOP selection | `src/lib/sops/library.ts` → `sopsForDepartment()` |
| 13 | Memory retrieval | `src/lib/memory/system.ts` → `retrieveMemory()` |
| 14 | Knowledge retrieval | `src/lib/rag/pipeline.ts` → `searchGrounded()` |
| 15 | Knowledge graph | `src/lib/knowledge/graph.ts` → `neighbourhood()` |
| 16 | Tool selection | `src/lib/tools/registry.ts` → `availableTools()` |
| 17 | Model selection | `src/lib/model/hub.ts` → `routeToModel()` |
| 18 | Plan | `src/lib/agents/orchestrator.ts` → `buildOrchestrationPlan()` |
| 19 | Execute | `src/lib/agents/engine.ts` → `runAgent()` / `executeSkill()` / `executeSop()` |
| 20 | Observe | the transcript of the run |
| 21 | Validate | `src/lib/agents/quality.ts` → `runQualityChain()` |
| 22 | Reflect | `src/lib/agents/reflection.ts` → `shouldReflect()` |
| 23 | Result | the structured output |
| 24 | Memory update | `src/lib/memory/system.ts` → `writeMemory()` |
| 25 | Audit | `src/lib/security.ts` → `audit()` |

### 3.2 The four execution paths

`buildOrchestrationPlan()` produces one of four plans. **A simple task
never uses a complex path.**

| Path | When | Shape |
|---|---|---|
| `FAST` | a question, a lookup, a classification | one step, no plan |
| `STANDARD` | a single-department piece of work | one worker, one reviewer |
| `COMPLEX` | multi-step work with tools | planner → skills → tools → validator |
| `ENTERPRISE` | work that spans the organisation | fan-out research → synthesis → review → executive result |

---

## 4. Context assembly — "only relevant information enters the model"

`src/lib/agents/context.ts` assembles the context in a fixed order:

1. the global constitution (**never truncated**);
2. the company rules;
3. the department rules;
4. the identity, the role, the mission, the authority, the decision rights;
5. the behavioural constraints;
6. the task;
7. the **retrieved** prompts (never the whole library);
8. the **selected** SOP;
9. the **retrieved** memory (capped at `MEMORY_RETRIEVAL_CAP` = 25);
10. the **retrieved** knowledge passages;
11. the **authorised** tools;
12. the output requirements.

The budget is per path: `FAST` 4,000 characters, `STANDARD` 8,000,
`COMPLEX` 16,000, `ENTERPRISE` 32,000. When the context exceeds the
budget, `fitToBudget()` compresses the supporting material **in reverse
order of importance** (knowledge → memory → tools → procedure → prompts).
The constitution, the identity, the task and the behavioural constraints
are never compressed. Everything dropped or shortened is reported in
`context.dropped` — nothing disappears silently.

### 4.1 Prompt retrieval

The prompt library is **70,400 slots** (110 departments × 20 roles × 16
stages × 2 languages). It is never materialised as a table and never
loaded wholesale. `retrievePrompts()` materialises **one binding** — the
department and role — and then scores the 32 records by an explainable
rule set:

```
score =  30  department match
      +  25  role match
      +  20  skill binding          (when the task names a skill)
      +  15  SOP binding            (when the task names a procedure)
      +  18  stage required for this complexity
      -   8  stage not required for this complexity
      +  12  language match
      + priority × 0.5            (standing preference)
      + quality  × 10             (standing preference)
      + min(10, task-term hits × 3)
```

Every contribution produces a human-readable reason, and the reason list
is returned with the result. The limit is enforced twice: the retriever
caps its result set, and `MEMORY_RETRIEVAL_CAP` caps the memory.

---

## 5. Data architecture

See `DATABASE_ARCHITECTURE.md` for the model-by-model description.

The short version: MySQL through Prisma, 69 models, 9 migrations, every
table `utf8mb4` so Bangla and mixed-script content survives. Migrations
are **hand-written** SQL (`prisma/migrations/**/migration.sql`) rather
than generated, because the CI drift check compares the schema to the
migration history and a generated client cannot be produced in the build
container. `tests/migration-parity.test.ts` proves every model has
matching DDL — 14 tests, all passing.

### 5.1 The models the AI workforce added

| Model | Purpose |
|---|---|
| `Sop` | the procedure catalogue (550 rows) |
| `SopRun` | one execution of a procedure, with its transcript and outcome |
| `AgentDelegation` | the collaboration contract between two employees |
| `AgentEvent` | the event bus record |
| `KnowledgeEntity` | a node in the knowledge graph |
| `KnowledgeRelation` | a typed, weighted, sourced edge between two entities |
| `PromptTemplate` | extended with 12 retrieval columns (stage, priority, quality, language, version, role, departmentCode, skillCode, sopKey, tags, status, usageCount, successCount) |
| `AiMemory` | extended with 9 columns (memoryType, accessLevel, departmentCode, version, validated, source, expiresAt, correlationId, tags) |

---

## 6. Security architecture

See `SECURITY_ARCHITECTURE.md`. The summary:

- the model **never** runs shell, SQL, deployment, payment, WhatsApp or
  file-deletion directly; it emits a structured tool request that the
  governed tool gateway validates against the tool registry, the
  permission model and the approval queue;
- 11 of the 47 tools are approval-gated and **never** autonomous;
- 21 of the 47 tools touch customer data and are access-level tagged;
- 6 action classes always require a human: a financial transfer, a legal
  commitment, an irreversible deletion, a high-impact security action, a
  sensitive external communication and a major governance change;
- the learning engine **cannot** change the constitution, a policy, a
  permission, an approval or an RBAC rule — the refusal is enforced in
  code, not by convention.

---

## 7. What was reused, and what was added

The specification's instruction was *connect, extend, improve, unify* —
never *build a second system*. This is the honest inventory.

### 7.1 Reused unchanged

| Subsystem | Pre-existing implementation |
|---|---|
| Departments (110) | `src/lib/agents/registry.ts` |
| Core agents (44) with `level` and `parentCode` | `src/lib/agents/registry.ts` |
| Agent runtime | `src/lib/agents/engine.ts` |
| Durable queue | `src/lib/agents/jobs.ts` |
| Model router and provider chain | `src/lib/model/router.ts` |
| Memory table | `AiMemory` |
| Keyword recall and grounded answering | `src/lib/knowledge-search.ts` |
| Scheduler surrogate | `src/lib/ops-loop.ts` |
| RBAC, session, CSRF guard | `src/lib/api-guard.ts` |
| Approval queue | `AgentJob.approvalState` |
| Dashboard shell and 37 views | `src/components/admin/` |

### 7.2 Extended

| Subsystem | What changed |
|---|---|
| `AiMemory` | 9 columns for type, access level, scope, version, validation, source, expiry, correlation and tags |
| `PromptTemplate` | 12 retrieval columns |
| `AgentJob` | `agentCode` became nullable so non-LLM work uses the same queue |
| `src/lib/db.ts` | the Prisma client is now created lazily, so pure modules load without a generated client |
| `/api/admin/memory` | the original contract preserved; the typed view added |

### 7.3 Added (these did not exist)

| Subsystem | Module | Why it was needed |
|---|---|---|
| Organisation | `src/lib/agents/org.ts` | nine levels, eight divisions, the reporting lines, the 24-attribute profile |
| Workforce | `src/lib/agents/workforce.ts` | the join between the org chart and the catalogue |
| SOP library | `src/lib/sops/library.ts` | 550 executable procedures |
| SOP runtime | `src/lib/sops/executor.ts` | a runtime that **walks** a procedure |
| Prompt library | `src/lib/prompts/library.ts` | 70,400 specialised prompt slots |
| Prompt retrieval | `src/lib/prompts/retrieval.ts` | explainable retrieval, never a bulk load |
| Tool registry | `src/lib/tools/registry.ts` | full metadata for 47 tools |
| Orchestrator | `src/lib/agents/orchestrator.ts` | classification, selection, delegation, the four paths |
| Quality engine | `src/lib/agents/quality.ts` | worker → reviewer → validator |
| Learning engine | `src/lib/agents/learning.ts` | the bounded learning chain |
| Reflection | `src/lib/agents/reflection.ts` | for complex tasks only |
| Self-healing | `src/lib/agents/self-healing.ts` | the bounded repair ladder |
| Availability | `src/lib/agents/availability.ts` | derived, never declared |
| Context engine | `src/lib/agents/context.ts` | the budgeted context assembly |
| Event bus | `src/lib/events/bus.ts` | 51 event types, persisted |
| Knowledge graph | `src/lib/knowledge/graph.ts` | entities, relations, provenance |
| Memory system | `src/lib/memory/system.ts` | typed, permission-aware, versioned memory |
| Governance | `src/lib/governance/rules.ts` | layered rules and the human-controlled list |
| Model hub | `src/lib/model/hub.ts` | categories and intelligent routing |

---

## 8. Verification method

| Claim | How it is verified |
|---|---|
| 2,201 employees, all attributes present | `tests/ai-eos.test.ts` → `validateWorkforce()` returns zero issues |
| 10,010 skills, every one executable | `tests/skills-registry.test.ts` executes **every** skill and validates the output against the declared schema |
| 550 procedures, every step satisfiable | `tests/ai-eos.test.ts` walks the procedure and asserts the step inputs resolve |
| 70,400 prompt slots, retrieval is bounded | `tests/ai-eos.test.ts` asserts the retriever returns fewer than 100 records for a limit of 10 |
| 47 tools with full metadata | `tests/ai-eos.test.ts` → `validateToolRegistry()` |
| Every model has matching DDL | `tests/migration-parity.test.ts` — 14 tests |
| No parallel system | the reuse table in §7.1 names the single implementation of each concern |
| The model cannot run shell or SQL | there is no shell or SQL path reachable from a model output; the only side-effect path is the tool gateway, and `src/lib/tools/registry.ts` has no shell tool |

---

## 9. Known limitations

1. **The Prisma client cannot be generated in this sandbox** — the
   binary host (`binaries.prisma.sh`) is not reachable. Four
   `tsc --noEmit` errors remain and are environmental, not code defects.
   `tests/database-workflows.test.ts` fails for the same reason. CI
   generates the client and runs the full suite against a real MySQL.
2. **`huggingface.co` and `ollama.com` are unreachable from this
   environment**, so no weight was downloaded and no real CPU benchmark
   was run here. The catalogue reports `weightsVerified: false` for every
   model, and the model hub refuses to treat an unmeasured model as
   measured. The real benchmark must run on the production host with
   `npm run bench:models` and `npm run models:verify`.
3. **The backup and restore gate is not met.** The Backup & Recovery page
   reports `NO_ARTIFACTS` and `restoreEvidence.proven === false`. The
   platform is ready for a staging release, not a public one.
4. **2,201 employees are definitions, not processes.** They are executed
   by a bounded worker pool over one queue. A panel that showed 2,201
   "live" agents would be a lie; the console shows the registry and the
   real execution record separately.
