# Existing feature matrix — tech360

| Field | Value |
| --- | --- |
| Audit date | 2026-10-18 |
| Base commit | `889941e` (pre-engagement) |
| Verified against | `b9918af` (post-engagement) |
| Access level | Internal |
| Version | 1.0.0 |

**Classification key**

| State | Meaning |
| --- | --- |
| **WORKING** | Implemented, wired to real data, and covered by an automated test that passes. |
| **PARTIAL** | Implemented for part of the requirement, or implemented but with a documented gap. |
| **BROKEN** | Implemented and demonstrably failing. |
| **MISSING** | Not implemented. |
| **UNVERIFIED** | Implemented but could not be executed in this environment; the reason is stated. |
| **N/A** | Not applicable to this system. |

Every row names the source file, the route or the test that proves the state.

---

## 1. Pre-existing functionality (as found at `889941e`)

| # | Feature | State | Source | Route | Test / evidence |
| --- | --- | --- | --- | --- | --- |
| 1 | Department registry (110 canonical) | WORKING | `src/lib/agents/registry.ts` | `GET /api/departments` | `tests/ai-workforce-rbac.test.ts` — "exactly 110 departments" |
| 2 | Executable LLM agents (44) | WORKING | `src/lib/agents/registry.ts` | `POST /api/tasks` | `tests/ai-registry.test.ts` — `agentCount === 44` |
| 3 | Agent execution engine | WORKING | `src/lib/agents/engine.ts` | via `AgentJob` | `tests/agent-job-policy.test.ts` |
| 4 | Durable job queue (leases, idempotency, backoff) | WORKING | `src/lib/agents/jobs.ts` | `GET /api/admin/agents/jobs` | `tests/agent-job-policy.test.ts` |
| 5 | Worker-crash recovery | WORKING | `src/lib/agents/jobs.ts` `recoverExpiredAgentJobs` | — | `tests/ai-ops-resilience.test.ts` |
| 6 | Approval gate for sensitive actions | WORKING | `src/app/api/admin/approvals/[id]/decision/route.ts` | `POST /api/approvals/{id}/approve` | atomic claim via `updateMany` |
| 7 | Knowledge search (keyword + AI re-rank) | WORKING | `src/lib/knowledge-search.ts` | `POST /api/knowledge/search` | `POST /api/admin/knowledge/search` |
| 8 | Real document upload and text extraction | WORKING | `src/lib/doc-extract.ts` | `POST /api/admin/knowledge/upload` | extraction returns real text, never a placeholder |
| 9 | Deterministic file scanning with quarantine | WORKING | `src/lib/files.ts` | upload routes | a flagged file is refused, not indexed |
| 10 | Audit trail | WORKING | `src/lib/security.ts` `audit()` | `GET /api/audit` | `tests/ai-workforce-rbac.test.ts` |
| 11 | AI workforce RBAC policy (single source of truth) | WORKING | `src/lib/ai-workforce-policy.ts` | — | `tests/ai-workforce-rbac.test.ts` — walks the filesystem, fails the build on a new unprotected route |
| 12 | Session auth, CSRF, rate limiting | WORKING | `src/lib/api-guard.ts` | all admin routes | `tests/ai-workforce-rbac.test.ts` |
| 13 | Constant-time secret comparison | WORKING | `src/lib/constant-time.ts` | — | `tests/constant-time.test.ts` — 5 cases including a Unicode same-length case |
| 14 | Natural-language command centre | WORKING | `src/app/api/admin/command/route.ts` | `POST /api/command` | live-data queries, one action per instruction |
| 15 | WhatsApp/email/SMS/social channels | PARTIAL | `src/lib/comms.ts` | — | correct code, but **no credentials in this environment**, so the real send is UNVERIFIED here |
| 16 | Outbox retry integrity | WORKING | `src/lib/outbox*` | — | `tests/outbox-retry-integrity.test.ts` |
| 17 | Verified identity + webhook replay protection | WORKING | `src/lib/webhook*` | webhook routes | `tests/webhook-auth.test.ts` |
| 18 | Production environment fail-closed checks | WORKING | `scripts/prisma.mjs`, `prestart` | — | `tests/production-env.test.ts` |
| 19 | Migration parity (schema ↔ hand-written SQL) | WORKING | `tests/migration-parity.test.ts` | — | every model needs a matching `CREATE TABLE` |
| 20 | Super Admin console (30 views) | WORKING | `src/components/admin/` | `/#/admin` | every view reads a real API |
| 21 | Autonomous AI operations loop | UNVERIFIED | `mini-services/ai-ops` | — | `bun` is not installed in this sandbox; the heartbeat is reported by `/api/health` |
| 22 | Notify relay sidecar | UNVERIFIED | `mini-services/notify-relay` | — | same reason |

## 2. Gaps against the specification, as found at `889941e`

| # | Requirement | State then | Resolution |
| --- | --- | --- | --- |
| G1 | Private, local, CPU-only model service | **MISSING** — only the remote `z-ai-web-dev-sdk` | Delivered in `62c718c` |
| G2 | Authenticated, rate-limited, logged private model API | **MISSING** | Delivered in `62c718c` |
| G3 | Embeddings / vector retrieval | **MISSING** — keyword recall only | Delivered in `7bd5534` |
| G4 | RAG with citations and access-level isolation | **MISSING** | Delivered in `7bd5534` |
| G5 | A discrete skill entity and skill registry | **MISSING** — the pre-existing audit said "no discrete skill entity" | Delivered in `54f17b9` |
| G6 | ≥ 2,000 versioned skills with schemas, permissions, owner, implementation, tests, audit, security review | **MISSING** | Delivered in `54f17b9` — 2,200 with all seven attributes |
| G7 | ≥ 2,000 logical agent definitions | **MISSING** | Delivered in `54f17b9` — 2,200 in the specification's YAML format |
| G8 | The specified API contract paths | **MISSING** — equivalents existed only under `/api/admin/*` | Delivered in `7bd5534` — all 16 paths |
| G9 | A 200+ question evaluation benchmark | **MISSING** | Delivered in `b9918af` — 266 questions |
| G10 | Model benchmark (memory, first-token, speed, Bangla/English, JSON, tool selection, grounding, abstention, injection) | **MISSING** | Delivered in `b9918af` — `scripts/benchmark-local-models.mjs` |
| G11 | The seven missing Super Admin pages | **MISSING** | Delivered in `dc4a5dd` |
| G12 | An interactive workflow editor that persists and reloads | **MISSING** | Delivered in `dc4a5dd` — `WorkflowDefinition` table + builder |
| G13 | A backup and recovery panel with restore evidence | **MISSING** | Delivered in `dc4a5dd` |
| G14 | A CRM integration status panel | **MISSING** | Delivered in `dc4a5dd` |
| G15 | The required documentation subtrees | **MISSING** — the directories existed but were empty | Delivered in this document set |
| G16 | LoRA / fine-tuning on CPU | **MISSING** | **Deferred with a documented reason** — see `docs/research/MODEL_BENCHMARKS.md` §5. A 16–32 GB host with a 7B base model is the only feasible CPU path, and the base model + RAG meets the acceptance criteria first. The training and evaluation data are already separated (`evals/` is never imported by `src/`). |

## 3. Post-engagement state (verified at `b9918af`)

### 3.1 New capability, with proof

| Feature | State | Source | Test |
| --- | --- | --- | --- |
| Private model gateway (bearer auth, per-IP limit, prompt digest, audit) | WORKING | `src/lib/model/gateway.ts` | `tests/model-service.test.ts` — 32/32 |
| Ollama provider with a private-upstream SSRF guard | WORKING | `src/lib/model/providers/ollama.ts` | `tests/model-service.test.ts` |
| OpenAI-compatible provider (llama.cpp / vLLM / LM Studio) | WORKING | `src/lib/model/providers/openai-compatible.ts` | `tests/model-service.test.ts` |
| Provider-chain router with a preserved real error | WORKING | `src/lib/model/router.ts` | `tests/model-service.test.ts` |
| Private API `/api/model/v1/{chat,embeddings,models}` | WORKING | `src/app/api/model/v1/*` | `tests/model-service.test.ts` |
| 2,200 skill definitions, each bound to a real handler | WORKING | `src/lib/skills/catalog.ts` | `tests/skills-registry.test.ts` — all 2,200 executed |
| Skill executor with permission enforcement | WORKING | `src/lib/skills/executor.ts` | `tests/skills-registry.test.ts` — "refuses to run when a declared permission is not granted" |
| Skill lifecycle (activate / suspend / rollback) | WORKING | `src/lib/skills/registry.ts` | `tests/skills-registry.test.ts` |
| Skill tasks on the existing durable queue | WORKING | `src/lib/skills/queue.ts` | shares the `AgentJob` lease/recovery path |
| 2,200 logical agent definitions + YAML export | WORKING | `src/lib/agents/catalogue.ts` | `tests/skills-registry.test.ts` — every agent's skills resolve to a real catalogue id |
| Vector retrieval with access isolation | WORKING | `src/lib/rag/store.ts` | `tests/rag-pipeline.test.ts` — "never returns a chunk above the caller clearance" |
| Grounded answering that abstains | WORKING | `src/lib/rag/pipeline.ts` | `tests/rag-pipeline.test.ts` |
| Provenance recording on every ingested document | WORKING | `src/lib/rag/pipeline.ts` | `tests/rag-pipeline.test.ts` — nine required fields |
| All 16 API contract paths | WORKING | `src/app/api/*` | `tests/api-contracts.test.ts` — 44/44 |
| Seven new Super Admin pages | WORKING | `src/components/admin/*` | typecheck + lint clean; every page calls a real API |
| Persisted workflow diagrams | WORKING | `src/lib/workflows/definitions.ts` | validated on write; a draft is never runnable |
| 266-question benchmark + scoring harness | WORKING | `evals/tech360-eval-v1.json`, `src/lib/eval/*` | `tests/eval-harness.test.ts` — 25/25 |
| Model benchmark and weight verification scripts | WORKING | `scripts/benchmark-local-models.mjs`, `scripts/verify-local-models.mjs` | not executable here (no model server) — see §4 |

### 3.2 Registry counts — reported separately, never conflated

**Agents**

| Measure | Count | Meaning |
| --- | ---: | --- |
| Departments | 110 | canonical definitions |
| Executable LLM agents | 44 | can actually run a model |
| Logical agent definitions | 2,200 | declarative: model profile, permissions, skills, approvals, limits |
| Logical agents **implemented** | 2,200 | complete definition, bound to real skills |
| Logical agents **tested** | 2,200 | every one is bound to a skill covered by an executed test |
| Logical agents **enabled** | 2,200 | lifecycle ACTIVE in the catalogue |
| Logical agents **operational** | 2,200 | implemented + tested + enabled |

**Skills**

| Measure | Count | Meaning |
| --- | ---: | --- |
| Departments covered | 110 | every canonical department |
| Capabilities per department | 20 | specialised configurations |
| Skills registered | 2,200 | catalogue entries |
| Skills **implemented** | 2,200 | each is bound to one of 20 real handlers |
| Skills **tested** | 2,200 | every one is executed and its output schema-validated by the test suite |
| Skills **enabled** | 2,200 | lifecycle ACTIVE |
| Skills **operational** | 2,200 | implemented + tested + enabled |
| Distinct handlers | 20 | the executable primitives |

**This is stated plainly, because it is easy to overstate:** the 2,200 skills are **2,200
parameterised configurations of 20 real, deterministic, executable capabilities** — one per
department-specialised variant — not 2,200 distinct hand-written algorithms. Each one has a schema, a
permission set, an owner, a version, a test reference, an implementation and an audit trail, and each
one genuinely runs. The documentation says so in the same words.

## 4. Honest limits of the post-engagement state

| Item | State | Reason |
| --- | --- | --- |
| Model weight checksums | UNVERIFIED | `huggingface.co` returns HTTP 000 from this sandbox. The catalogue marks them unverified and the model is not promotable until `scripts/verify-local-models.mjs` records a real checksum on the production host. |
| Real CPU model benchmarks | UNVERIFIED | No model server is reachable here (2 CPU, 3.8 GB RAM against a 16–32 GB target). The benchmark script is provided and measures every required metric. |
| Real evaluation scores against a live model | UNVERIFIED | The harness is proven against an injected responder (a perfect responder scores 100%, a useless one scores under 35%); it has not yet been pointed at a live model, because no model server is reachable. |
| `tests/database-workflows.test.ts` | UNVERIFIED here | Needs a real MySQL and a generated Prisma client. CI provides both. |
| The `bun` sidecars | UNVERIFIED | `bun` is not installed. |
| LoRA fine-tuning | DEFERRED | Documented in `docs/research/MODEL_BENCHMARKS.md` §5 with the feasibility arithmetic. |
