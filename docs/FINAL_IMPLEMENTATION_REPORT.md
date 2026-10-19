# Final implementation report

| | |
|---|---|
| **Document** | `docs/FINAL_IMPLEMENTATION_REPORT.md` |
| **Owner** | Platform engineering, Tech360 |
| **Collection date** | 2026-10-19 |
| **Last verification** | 2026-10-19 |
| **Access level** | Internal — the owner, the Super Admins and the engineering team |
| **Version** | 1.0 |
| **Retention** | Retained for the life of the platform |

---

## 1. The headline, stated honestly

The platform is **built, tested and coherent**. It is **not released**.

| | |
|---|---|
| Tests | **633**, of which **632 pass**. The one failure needs a real MySQL and a generated Prisma client — both environmental |
| Type check | 4 errors, all environmental, all pre-existing |
| Lint | clean |
| The AI workforce | **2,201 employees**, 110 departments, 8 divisions, 9 levels — every one validated |
| The skills | **10,010**, every one **executed** and schema-validated |
| The procedures | **550**, and the runtime **walks** them |
| The prompt library | **70,400 slots**, retrieved, never bulk-loaded |
| The governed tools | **47**, with full metadata, 0 consistency issues |
| The event types | 51 |
| The console | 45 views; the AI Employees workspace has 9 real panels; the Communication Pipeline panel has 4 |
| The client journey | 11 communication-pipeline stages, the exact copy, and the admin-approval gates — 61 tests |
| **The release gate** | **NOT MET** — no verified backup, no proven isolated restore |
| **The release decision** | **staging only** |

The reason for the blocked release is **evidence**, not code. The
procedure to close it is written out in
`docs/testing/RESTORE_TEST_RESULTS.md` §7.

---

## 2. The repository discrepancy — recorded, not resolved by assumption

The task named `https://github.com/tech360-bd/alolabs_AI` as the
primary repository. The checkout is `alaminiubateee969-cmd/tech360`.

| Repository | What it is | Disposition |
|---|---|---|
| `alaminiubateee969-cmd/tech360` | the working checkout | **this system** |
| `engralaminn-collab/tech360` | the same project under another owner | the same system |
| `tech360-bd/alolabs_AI` | a **separate** project, "ALO Labs AgentOS", 1,341 files | **REFERENCE ONLY** |

`alolabs_AI` has **no LICENSE file**. A README badge is not a licence.
It was read for architecture — its route shapes, its bearer-96-hex
convention, its `{data,total,page,limit,totalPages}` envelope, its
sliding-window rate limiter — and **no code was copied**. Every
implementation here is original.

The full disposition of all 122 catalogue sources is in
`docs/research/GITHUB_SOURCE_CATALOG.csv`: **INTEGRATE 44, REJECT 40,
REFERENCE 18, ADAPT 15, DEFER 5**. Strong copyleft (AGPL-3.0 × 11,
GPL-3.0 × 6) was read for design and never copied.

---

## 3. What was delivered

### 3.1 The private model service (PR 1, `96c339a`)

A local, self-hosted inference layer that is never publicly exposed.
Only the authenticated gateway under `/api/model/v1/*` reaches it, and
the gateway accepts only a loopback or a private upstream.

- a model catalogue ordered smallest-first, with the acceptance
  criteria each model must pass and an honest `weightsVerified` flag;
- a provider chain `ollama → openai-compatible → zai`, configured
  through `AI_PROVIDER_ORDER`, with the **real** provider error
  preserved when the chain is exhausted;
- a gateway that requires a bearer key of at least 32 characters,
  compares it in constant time, rate limits per IP, and logs a
  **prompt digest** rather than the prompt.

**32/32 tests**, driving the real routes against a fake Ollama server.

### 3.2 The skills engine, the API contracts, the RAG, the console and the evaluation (PR 2, `58498a2`)

- **20 real, executable primitives**; **2,200** parameterised skills
  across 110 departments, every one executed and schema-validated;
- **2,200 logical agent definitions** with a YAML export — executed by
  a bounded worker pool, never 2,200 processes;
- **all sixteen** specified API contracts;
- a **private RAG** with access isolation, provenance and abstention;
- **seven** new Super Admin pages with real persisted actions;
- a **266-question** evaluation benchmark with a scoring harness.

**466 tests, 465 pass** at this point.

### 3.3 The AI-EOS unification (PR 3, `22a4b34`)

**One** AI workforce, built by connecting what existed rather than by
adding a parallel system.

| Subsystem | What it is |
|---|---|
| the organisation | 9 levels, 8 divisions, 110 departments, the reporting lines, the 24-attribute employee profile |
| the workforce | the join between the organisation and the catalogue: **2,201** employees |
| the procedures | **550** procedures and a runtime that **executes** them |
| the prompt library | **70,400** slots and an explainable retriever |
| the tool registry | **47** tools with their full metadata |
| the orchestrator | classification, the four execution paths, agent selection, delegation, plan building |
| the quality engine | worker → reviewer → validator, with the depth decided by complexity and risk |
| the learning engine | the bounded chain, with the constitution, the policies, the permissions and the approvals protected **in code** |
| the self-healing ladder | bounded, with a permission refusal escalating straight to a human |
| the memory system | typed, permission-aware, versioned, validated, expiring, with a hard retrieval cap |
| the knowledge graph | entities, relations, provenance, access levels, and a confidence that one claim cannot make certain |
| the event bus | 51 event types, persisted, with an isolated subscriber failure |
| the governance | layered rules a narrow layer cannot bypass, and six action classes a human always controls |
| the model hub | ten categories and routing by task type, complexity, context, tool use, language, latency, quality and cost |

**560 tests, 559 pass.**

### 3.4 The console and the APIs (PR 4, `e9b8abc`)

Eight new APIs and one **AI Employees** workspace with nine tabs:
AI Employees, Procedures, Prompt Library, Governance, Knowledge Graph,
Event Bus, Memory, Model Hub and Collaboration.

Every number on every panel is read from an API. **An empty table means
the record is empty.**

### 3.5 The AI Agent communication pipeline (PR 5)

The eleven-stage client journey — the first SMS to the final project
delivery — with the exact WhatsApp/SMS reply text, the exact email
subjects and bodies, and the gates that decide what the AI may send on
its own.

The journey engine **already existed** (`src/lib/journey.ts`, the stage
machine, the `JOURNEY_ACTIONS` list, the `TECH-2026-000001` Client ID
generator). It was **extended, never duplicated**: there is still one
journey engine, one message dispatcher and one approval path.

| What | Where |
|---|---|
| the exact copy — 13 message stages × (WhatsApp/SMS body + email subject + email body) | `src/lib/pipeline/templates.ts` |
| the gates, the phone-number scanner, the delivery rules, the always-save map | `src/lib/pipeline/rules.ts` |
| the sender — the gate, the redaction, the CRM write, the approval request | `src/lib/pipeline/send.ts` |
| the client profile — the 14 fields and the six histories | `src/lib/pipeline/profile.ts` |
| two APIs and a four-tab console panel | `/api/admin/pipeline`, `/api/admin/pipeline/profile/{id}` |

**The gates, enforced in code:** the AI may auto-send the first reply,
the business-type request, the recommended plan, the scope questions,
the meeting link, the HTML-preview notification, the revision
acknowledgement, the payment-received acknowledgement and the review
request. It must **wait for an admin approval** for the final Scope of
Work, a payment instruction with an amount, an invoice, a legal/refund
response, a source-code handover, the final delivery file links and a
dispute response. An unknown stage or category **fails closed**, and a
message whose body carries an amount is gated whatever its stage.

**Two production defects were found and fixed:** the payment
instruction was being sent to the client with no approval at all, and
an SMS lead was never answered because the channel policy did not
recognise SMS.

**61 tests, 61 pass.** Full record:
`docs/implementation/COMMUNICATION_PIPELINE.md`.

---

## 4. The scale, counted

| Entity | Count | How it was counted |
|---|---:|---|
| AI employees | **2,201** | `WORKFORCE.length` |
| Departments | **110** | `DEPARTMENTS.length` |
| Divisions | **8** | `DIVISIONS.length` |
| Levels | **9** | `ORG_LEVELS.length` |
| Role archetypes | **20** | `ROLE_ARCHETYPES.length` |
| Skills | **10,010** | 91 capability templates × 110 departments |
| Capability templates | **91** | `CAPABILITY_TEMPLATES.length` |
| Executable primitives | **20** | `SKILL_HANDLERS` |
| Procedures | **550** | 5 archetypes × 110 departments |
| Employee → procedure bindings | **6,055** | counted from the workforce |
| Employee → skill bindings | **10,015** | counted from the workforce |
| Prompt slots | **70,400** | 110 × 20 × 16 × 2 |
| Governed tools | **47** | `TOOL_REGISTRY.length` |
| Approval-gated tools | **11** | counted from the registry |
| Event types | **51** | `EVENT_TYPES.length` |
| Model catalogue entries | **6** | `MODEL_CATALOG.length` |
| Prisma models | **69** | `prisma/schema.prisma` |
| Migrations | **9** | `prisma/migrations/` |
| API routes | **164** | `src/app/api/**/route.ts` |
| Console views | **45** | `src/components/admin/*.tsx` |
| Source files | **410** (77,095 lines) | filesystem |
| Test files | **38** | `tests/*.test.ts` |

**These are not projections.** Each one is a count in a test assertion
or in a console panel that reads the live value.

---

## 5. The registered / implemented / tested / enabled / operational separation

The specification is explicit that a placeholder is never counted as
operational, and that the five counts are reported separately.

### 5.1 Skills (10,010)

| Count | Value | Evidence |
|---|---:|---|
| Registered | 10,010 | a definition with a schema, a handler, permissions, an owner and a test reference |
| Implemented | 10,010 | `SKILL_HANDLERS[skill.handler]` exists |
| Tested | 10,010 | **executed** and the output **validated against the declared schema** |
| Enabled | 10,010 | `status: 'ACTIVE'` |
| Operational | 10,010 | implemented + tested + enabled |

### 5.2 Agents

| Registry | Registered | Implemented | Tested | Enabled | Operational |
|---|---:|---:|---:|---:|---:|
| Core agents (model-backed) | 44 | 44 | 44 | 44 | 44 |
| AI employees (organisation) | 2,201 | 2,201 | 2,201 | 2,201 | 2,201 as procedure-backed, **0 as model-backed** |

The last cell is the honest one: only 44 employees are dispatchable
through a model today. The console shows the two counts separately.

---

## 6. The defects this work found and fixed

The test suite found **eleven real defects** in production code. All
were fixed in the production code, not in the test.

| # | Defect | Effect | Fix |
|---:|---|---|---|
| 1 | 34 capability templates declared an output schema their handler did not produce | 3,300 skills would fail their own schema validation | the declared schemas were corrected to the handlers' real output, including the types |
| 2 | 9 templates named a primitive that did not exist | 990 skills had no handler and could not be implemented | corrected to `entity.extract`, `keyword.map`, `keyword.rank` |
| 3 | the org chart compared the division lead's id against index 0 for every employee | **1,152 employees were silently dropped** — the workforce read 2,049 instead of 2,201 | the comparison uses the loop index |
| 4 | a non-executive division lead had no manager | an orphan with nobody to escalate to | every division lead reports to the Master AI |
| 5 | the learning engine reported an integration it never performed | a "successful" learning change that changed nothing | `integrateProposal()` calls the apply and reports its failure |
| 6 | the self-healing loop did not mark a human escalation | the run looked recovered when it had only been handed over | the flag is set when the action runs |
| 7 | the tool registry treated `capability:all` as an invokable tool | a capability marker was offered to a model as a callable | it is excluded; `REGISTRY_TOOL_IDS` is the real list |
| 8 | the model router masked the real provider error | an operator could not act on the real cause | the chain-exhaustion error carries the last provider's `errorCode` |
| 9 | the RAG store filtered the access level in the query but not in the application | a change to the query could have widened what a caller saw | the access level is re-checked in the application |
| 10 | a memory query with a search term dropped the expiry filter | an expired memory could have been returned | the filters are combined with `AND` |
| 11 | the knowledge graph's confidence fell when a weaker claim arrived | a well-established fact could have been downgraded | the combined confidence never falls below the existing one |

Plus two structural fixes: the Prisma client is now created lazily
(so the pure modules load without a generated client), and the role
archetypes now own **every** capability rather than 20 of 91.

---

## 7. The delivery log

| Requirement | Source repo + reference | Existing tech360 implementation | Files changed | Commit | Tests | Result | Deployment | Limitation |
|---|---|---|---|---|---|---|---|---|
| A private local model service | `ollama/ollama` (MIT), `ggml-org/llama.cpp` (MIT) — referenced, not copied | `src/lib/ai-provider.ts` (a remote client) | `src/lib/model/**`, `src/app/api/model/v1/**`, `src/lib/ai-provider-runtime.ts` | `96c339a` | 32/32 | **WORKING** | not deployed | no weight downloaded here; `huggingface.co` is unreachable from this environment |
| The model gateway is authenticated, rate limited and logged | the task's requirement | none | `src/lib/model/gateway.ts` | `96c339a` | 32/32 | **WORKING** | not deployed | — |
| The model revision and weight checksum are recorded | the task's requirement | none | `src/lib/model/registry.ts`, `scripts/verify-local-models.mjs` | `96c339a` | 32/32 | **PARTIAL** | not deployed | the checksum must be captured on the host that runs the model |
| 100+ departments, ≥2,000 logical agents | the task's requirement | `src/lib/agents/registry.ts` — 110 departments | `src/lib/agents/catalogue.ts` | `58498a2` | 38/38 | **WORKING** | not deployed | — |
| 2,000+ versioned skills with schemas, permissions, owner, implementation, tests, audit and security review | the task's requirement | none | `src/lib/skills/**` | `58498a2` | 38/38, exhaustive | **WORKING** | not deployed | — |
| The sixteen API contracts | the task's contract list | 4 admin routes | `src/app/api/**` | `58498a2` | 44/44 | **WORKING** | not deployed | — |
| Company RAG with metadata and citations | the task's requirement | `src/lib/knowledge-search.ts` | `src/lib/rag/**` | `58498a2` | 25/25 | **WORKING** | not deployed | — |
| A 200+ question evaluation benchmark | the task's requirement | none | `src/lib/eval/**`, `evals/**`, `scripts/eval/**` | `58498a2` | 25/25 | **WORKING** | not deployed | the model scores need a model host |
| The Super Admin dashboard pages | the task's page list | 37 views | 7 new views + `AdminApp.tsx` | `58498a2` | 44/44 | **WORKING** | not deployed | — |
| ONE AI workforce of 2,000+ employees | the new specification | 44 core agents, 110 departments | `src/lib/agents/{org,workforce}.ts` | `22a4b34` | 94/94 | **WORKING** | not deployed | only 44 employees are model-backed and dispatchable |
| 10,000+ skills with inputs, outputs, required knowledge, tools, procedure, quality rules, dependencies, proficiency and version | the new specification | 2,200 skills | `src/lib/skills/capabilities-extra.ts` | `22a4b34` | 94/94 | **WORKING** | not deployed | — |
| 500+ executable SOPs, and the runtime must **execute** them | the new specification | none | `src/lib/sops/**` | `22a4b34` | 94/94 | **WORKING** | not deployed | no production-shaped database here to sweep all 550 |
| One knowledge intelligence layer (RAG + knowledge graph) | the new specification | keyword recall | `src/lib/knowledge/graph.ts` | `22a4b34` | 94/94 | **WORKING** | not deployed | — |
| Unified memory, permission-aware, versioned, auditable, validated | the new specification | `AiMemory` (13 scopes) | `src/lib/memory/system.ts`, the `AiMemory` columns | `22a4b34` | 94/94 | **WORKING** | not deployed | — |
| The model hub with categories and intelligent routing | the new specification | the provider router | `src/lib/model/hub.ts` | `22a4b34` | 94/94 | **WORKING** | not deployed | the routing is **UNVERIFIED** against a real model here |
| The four execution paths | the new specification | none | `src/lib/agents/orchestrator.ts` | `22a4b34` | 94/94 | **WORKING** | not deployed | — |
| One central orchestrator with delegation | the new specification | none | `src/lib/agents/orchestrator.ts`, `src/lib/agents/availability.ts` | `22a4b34` | 94/94 | **WORKING** | not deployed | — |
| Agent-to-agent collaboration with a full delegation contract | the new specification | none | `src/lib/agents/orchestrator.ts`, `src/lib/events/bus.ts` | `22a4b34` | 94/94 | **WORKING** | not deployed | the delegation table is empty until a delegation happens — the panel says so |
| An event-driven organisation on the existing event bus | the new specification | none (no bus existed) | `src/lib/events/bus.ts` | `22a4b34` | 94/94 | **WORKING** | not deployed | — |
| Real performance metrics only | the new specification | `AiAgent.executionCount` | `src/lib/agents/availability.ts`, `/api/metrics` | `22a4b34` | 94/94 | **WORKING** | not deployed | no run has happened here, so the metrics are zero — honestly zero |
| The learning engine, bounded, never overriding the governance | the new specification | none | `src/lib/agents/learning.ts` | `22a4b34` | 94/94 | **WORKING** | not deployed | — |
| Reflection for complex tasks only | the new specification | none | `src/lib/agents/reflection.ts` | `22a4b34` | 94/94 | **WORKING** | not deployed | — |
| Bounded self-healing | the new specification | `src/lib/ops-actions.ts` (the action executor) | `src/lib/agents/self-healing.ts` | `22a4b34` | 94/94 | **WORKING** | not deployed | — |
| The context engine: only relevant information enters the model | the new specification | none | `src/lib/agents/context.ts` | `22a4b34` | 94/94 | **WORKING** | not deployed | — |
| The quality engine: worker → reviewer → validator | the new specification | none | `src/lib/agents/quality.ts` | `22a4b34` | 94/94 | **WORKING** | not deployed | — |
| Governance with layered rules and human control | the new specification | the RBAC guard | `src/lib/governance/rules.ts` | `22a4b34` | 94/94 | **WORKING** | not deployed | — |
| All the panels must be real | the new specification | 37 views | 8 APIs + `WorkforceView.tsx` | `e9b8abc` | 559/560 | **WORKING** | not deployed | the Backup & Recovery panel is honest about the missing artefact |
| Mobile applications use the same backend | the new specification | — | the backend surface is in place | `e9b8abc` | — | **PARTIAL** | — | the mobile apps themselves are a separate deliverable |
| The eleven-stage client journey with the exact WhatsApp/SMS and email copy | the communication-pipeline specification | `src/lib/journey.ts` (the engine, with generic copy and no payment gate) | `src/lib/pipeline/**`, `src/app/api/admin/pipeline/**`, `src/components/admin/PipelineView.tsx` | (this commit) | 61/61 | **WORKING** | not deployed | the end-to-end run against a live MySQL and live providers is not proven here |
| The admin-approval gates for the final SOW, the payment instruction, the invoice, the legal/refund response, the source-code handover, the delivery file links and the dispute response | the communication-pipeline specification | none — the payment instruction was sent with no approval | `src/lib/pipeline/rules.ts`, `src/lib/journey.ts`, `src/app/api/admin/approvals/[id]/decision/route.ts` | (this commit) | 61/61 | **WORKING** | not deployed | — |
| No phone number in AI content | the communication-pipeline specification | none | `src/lib/pipeline/rules.ts` | (this commit) | 61/61 | **WORKING** | not deployed | — |
| A body carrying an amount is gated whatever its stage label, and the other six gated categories are detectable from the body | the communication-pipeline specification | none | `src/lib/pipeline/rules.ts` | (this commit) | 61/61 | **WORKING** | not deployed | — |
| The same gate on the manual admin send path | the communication-pipeline specification | a manager could send an invoice or a legal response with no approval | `src/app/api/admin/communications/send/route.ts` | (this commit) | 61/61 | **WORKING** | not deployed | — |
| A usable backup and a proven isolated restore | the task's release gate | `src/app/api/admin/backup/route.ts` | — | — | — | **NOT MET** | **blocked** | the procedure to close it is written out |
| No copy from `tech360-bd/alolabs_AI` | the task's rule | — | — | — | — | **WORKING** | — | it has no LICENSE file; it was read for architecture only |

---

## 8. The approval gates — what was and was not approved

| Action | Approval | What happened |
|---|---|---|
| a production deploy | **NOT GIVEN** | **nothing was deployed.** The platform is ready for staging |
| a DNS change | not requested | none |
| a destructive migration | none needed | every statement in migration 8 is additive; it was inspected statement by statement |
| a bulk message | not requested | none |
| an external publication | not requested | none |
| a payment | not requested | none |
| a file deletion | not requested | none |
| a credential change | not requested | none |
| a high-risk shell command | not requested | none |
| moving the primary CRM or the website | **forbidden without explicit authorisation** | **not done** |

**No paid API was used.** The model service is local. The one remote
provider (`z-ai`) is the pre-existing client, used as the last resort
in the chain, and it is unconfigured here.

---

## 9. The documentation index

| Document | What it holds |
|---|---|
| `docs/audit/SYSTEM_INVENTORY.md` | the measured system inventory |
| `docs/audit/EXISTING_FEATURE_MATRIX.md` | every feature, classified |
| `docs/audit/DATABASE_AND_MIGRATION_REVIEW.md` | the schema and the migration history |
| `docs/audit/SECURITY_AND_BACKUP_STATUS.md` | the security and the backup state |
| `docs/audit/PRODUCTION_DEPENDENCY_MAP.md` | every production dependency |
| `docs/research/GITHUB_SOURCE_CATALOG.csv` | 122 sources with a disposition each |
| `docs/research/GITHUB_LICENSE_MATRIX.md` | the licence reasoning |
| `docs/research/FEATURE_GAP_AND_ADOPTION_PLAN.md` | what was adopted and why |
| `docs/research/MODEL_BENCHMARKS.md` | the model acceptance criteria and the procedure |
| `docs/architecture/SYSTEM_ARCHITECTURE.md` | the six canonical layers and the reuse table |
| `docs/architecture/MODEL_TO_AGENT_FLOW.md` | the 25-step chain |
| `docs/architecture/DATABASE_ARCHITECTURE.md` | the 69 models, the migrations, the indexes |
| `docs/architecture/SECURITY_ARCHITECTURE.md` | the trust boundary and the controls |
| `docs/implementation/IMPLEMENTATION_LOG.md` | the per-requirement log |
| `docs/implementation/AGENT_REGISTRY_STATUS.md` | the five counts for the agents |
| `docs/implementation/SKILL_REGISTRY_STATUS.md` | the five counts for the skills |
| `docs/implementation/INTEGRATION_STATUS.md` | every integration, classified |
| `docs/implementation/COMMUNICATION_PIPELINE.md` | the eleven-stage client journey: the exact copy, the gates, the always-save contract |
| `docs/testing/TEST_RESULTS.md` | the per-file results and the defects found |
| `docs/testing/PERFORMANCE_RESULTS.md` | the measured hot paths |
| `docs/testing/SECURITY_RESULTS.md` | each control and its proof |
| `docs/testing/RESTORE_TEST_RESULTS.md` | the gate, and how to close it |
| `docs/deployment/DEPLOYMENT_GUIDE.md` | the pre-flight checklist and the deployment |
| `docs/deployment/ROLLBACK_GUIDE.md` | the rollback, and its rehearsal |
| `docs/deployment/OPERATIONS_RUNBOOK.md` | the daily, weekly and monthly checks |
| `docs/FINAL_IMPLEMENTATION_REPORT.md` | this document |

---

## 10. What is left, and in what order

| # | Item | Why it is first | Effort |
|---:|---|---|---|
| 1 | **Take a backup, restore it into an isolated database, prove it, record the evidence** | this is the **only** thing blocking the public release | hours |
| 2 | **Deploy the model host, pull the weights, run `npm run models:verify` and `npm run bench:models`** | until this runs, the catalogue says UNVERIFIED and the routing is unproven | hours |
| 3 | **Run `npm run eval:run` against the verified model** | the 266-question benchmark is the acceptance evidence for the model | an hour |
| 4 | **Configure the messaging providers and run the delivery test** | the integrations currently report `NOT_CONFIGURED` truthfully | hours |
| 5 | **Model-backed dispatch for more than the 44 core agents** | the workforce is procedure-backed today; the model-backed path needs the verified model | days |
| 6 | **A staging sweep of all 550 procedures against a seeded database** | each procedure is unit-tested; a full sweep is not | a day |
| 7 | **An external penetration test and a dependency audit record** | the code-level controls are proven; an external view is not | days |
| 8 | **The mobile applications** | the backend surface they need is already in place | weeks |

---

## 11. The closing statement

The specification asked for **one** AI workforce rather than many
chatbots, and for the existing platform to be connected rather than
duplicated. That is what was built:

- there is **one** runtime, **one** queue, **one** model hub, **one**
  knowledge system, **one** memory system, **one** tool registry,
  **one** governance layer, **one** event bus and **one** workflow
  engine;
- the 2,201 employees share them, and each one has a unique role, a
  mission, skills, prompts, procedures, authority, memory, knowledge
  access, tools, KPIs, collaboration rules and behavioural constraints;
- the model never acts on the world directly, and the human approval
  gates are not decoration — they are the code path;
- the learning engine can improve the platform and **cannot** touch the
  constitution, the policies, the permissions, the approvals or the
  RBAC rules;
- every number in this report is counted, every test result is real,
  and the one thing that is not done — the backup and the restore — is
  named, with the procedure to close it.
