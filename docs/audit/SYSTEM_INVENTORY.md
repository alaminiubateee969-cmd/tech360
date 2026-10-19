# System inventory — tech360

| Field | Value |
| --- | --- |
| System | tech360 — ALO Labs CRM, admissions, delivery and AI workforce platform |
| Repository | `alaminiubateee969-cmd/tech360` (checkout `/home/user/tech360`) |
| Branch under audit | `arena/059cc90a-tech360` |
| Base commit | `889941e82b2b14edff856c271d3480122a102c63` (merge of PR #23) |
| Audit date | 2026-10-18 |
| Last verification | 2026-10-18 |
| Access level | Internal — engineering and audit |
| Version | 1.0.0 |
| Retention | Retained for the life of the platform, then archived with the audit record |
| Permission scope | Read-only for the auditor; write only for the platform engineers |

---

## 1. The named project does not match the checkout

The task named `https://github.com/tech360-bd/alolabs_AI` as the primary repository. The checkout is
`alaminiubateee969-cmd/tech360`.

Verified facts (2026-10-18, GitHub REST API):

| Repository | Owner type | Public repos | Licence | Relationship |
| --- | --- | --- | --- | --- |
| `alaminiubateee969-cmd/tech360` | User | this project | MIT | **The system audited and extended.** |
| `tech360-bd/alolabs_AI` | Organisation | "ALO Labs AgentOS", 1,341 files | **no LICENSE file** | A **separate** project. Reference only. |
| `engralaminn-collab/tech360` | User | 4 repos | MIT | The same project as this checkout (README identical). |

**Consequence, recorded and respected:** `alolabs_AI` has no LICENSE file, so its code is **not open
source** and may not be copied. Its architecture (a private `ai-router` / `ai-gateway` /
`ai-workforce` layout, a `{data,total,page,limit,totalPages}` response envelope, Bearer 96-hex
authentication) informed the design of the private model gateway. **No code, schema, migration or
text was copied.** The implementation in this repository is original and follows this repository's own
conventions.

## 2. Technology stack (measured)

| Layer | Technology | Version | Source of truth |
| --- | --- | --- | --- |
| Framework | Next.js (App Router) | 16.x | `package.json` |
| Runtime | Node.js | 22.22.3 (sandbox) | `node --version` |
| Language | TypeScript | 5.x, strict | `tsconfig.json` |
| Styling | Tailwind CSS | 4.x | `package.json` |
| Components | shadcn/ui | — | `src/components/ui` |
| ORM | Prisma | 6.x | `package.json` |
| Database | MySQL | 8.x | `prisma/schema.prisma`, `DATABASE_URL` |
| AI provider (pre-existing) | `z-ai-web-dev-sdk` | — | `src/lib/ai-provider.ts` |
| AI provider (new) | Ollama / llama.cpp-compatible HTTP | — | `src/lib/model/providers/*` |
| Test runner | `node:test` via `tsx` | — | `package.json` `test` script |
| CI | GitHub Actions | — | `.github/workflows/ci.yml` |

## 3. Size (measured at `b9918af`)

| Measure | Count |
| --- | ---: |
| TypeScript source files under `src/` | 374 |
| API route files | 154 |
| Prisma models | 63 |
| Prisma migrations | 9 (0_init … 8_private_ai_platform) |
| Test files | 34 |
| Test cases (whole suite) | 466 |
| Runtime dependencies | 75 |
| Dev dependencies | 7 |
| Console views | 37 |
| `docs/` documents (pre-existing) | 30 |

## 4. Component map

### 4.1 Data layer — `prisma/schema.prisma` (63 models)

| Domain | Models |
| --- | --- |
| Identity and access | `User`, `Session`, `AuditLog`, `ErrorLog`, `Setting`, `FeatureFlag` |
| CRM | `Client`, `ClientIdentity`, `Lead`, `Project`, `Payment`, `Task`, `Meeting`, `Communication` |
| Delivery | `ScopeOfWork`, `Artifact`, `Handover`, `ClientDocument`, `ApprovalRequest` |
| Content | `Post`, `MediaAsset`, `NewsletterSubscriber`, `Review`, `Feed`, `BlogPost` |
| AI workforce | `AiAgent`, `AiAgentExecution`, `AgentJob`, `AiMemory`, `AgentMessage`, `ChatMessage`, `PromptTemplate` |
| Knowledge | `KnowledgeDocument`, `KnowledgeChunk` *(new)*, `KnowledgeIngestRecord` *(new)* |
| Skills | `Skill` *(new)*, `SkillVersion` *(new)*, `SkillRun` *(new)* |
| Platform | `ModelDeployment` *(new)*, `WorkflowDefinition` *(new)*, `AutomationLog`, `Notification`, `WebhookEvent` |

### 4.2 AI workforce

| Component | File | State |
| --- | --- | --- |
| Canonical department registry (110) | `src/lib/agents/registry.ts` | WORKING — asserted by `tests/ai-workforce-rbac.test.ts` |
| Executable LLM agents (44) | `src/lib/agents/registry.ts` | WORKING — `runAgent` is the single handler |
| Logical agent catalogue (2,200) | `src/lib/agents/catalogue.ts` | WORKING — 2,200 validated definitions + YAML export |
| Agent execution engine | `src/lib/agents/engine.ts` | WORKING — policy → retrieve → infer → tool request |
| Durable task queue | `src/lib/agents/jobs.ts` | WORKING — leases, idempotency, bounded backoff, crash recovery |
| Job policy | `src/lib/agents/job-policy.ts` | WORKING |
| Resilience / timeouts | `src/lib/agents/resilience.ts` | WORKING |
| Registry bootstrap | `src/lib/agents/bootstrap.ts` | WORKING — upserts `Department` and `AiAgent` |
| AI workforce RBAC policy | `src/lib/ai-workforce-policy.ts` | WORKING — filesystem-walking test fails the build on a new unprotected route |

### 4.3 Private model service (new in this engagement)

| Component | File | State |
| --- | --- | --- |
| Model type contracts | `src/lib/model/types.ts` | WORKING |
| CPU model catalogue (6 models) | `src/lib/model/registry.ts` | PARTIAL — weight checksums unverified on this host |
| Ollama provider | `src/lib/model/providers/ollama.ts` | WORKING — `isPrivateUpstream()` SSRF guard |
| OpenAI-compatible provider | `src/lib/model/providers/openai-compatible.ts` | WORKING — same guard |
| Provider-chain router | `src/lib/model/router.ts` | WORKING — `ollama → openai-compatible → zai` |
| Private gateway | `src/lib/model/gateway.ts` | WORKING — constant-time bearer auth, rate limit, prompt digest |
| Private API | `src/app/api/model/v1/{chat,embeddings,models}` | WORKING — 32/32 tests |
| ZAI runtime wrapper | `src/lib/ai-provider-runtime.ts` | WORKING — closes a pre-existing missing-module gap |

### 4.4 Skills engine (new in this engagement)

| Component | File | State |
| --- | --- | --- |
| Skill type contracts | `src/lib/skills/types.ts` | WORKING |
| 20 executable handlers | `src/lib/skills/primitives.ts` | WORKING — deterministic, bounded, side-effect-free |
| Skill catalogue (2,200) | `src/lib/skills/catalog.ts` | WORKING — 110 departments × 20 capabilities |
| Skill registry | `src/lib/skills/registry.ts` | WORKING — validation, discovery, lifecycle, honest status |
| Skill executor | `src/lib/skills/executor.ts` | WORKING — permissions, schema validation, timeout, audit |
| Skill task queue | `src/lib/skills/queue.ts` | WORKING — reuses the `AgentJob` queue; bounded worker pool |
| Knowledge retrieval | `src/lib/rag/*` | WORKING — embeddings, chunking, vector store, grounded answers |

### 4.5 Retrieval (pre-existing and new)

| Component | File | State |
| --- | --- | --- |
| Keyword recall + AI re-rank | `src/lib/knowledge-search.ts` | WORKING — pre-existing |
| Vector store | `src/lib/rag/store.ts` | WORKING — MySQL, access-filtered, defence in depth |
| Grounded answering | `src/lib/rag/pipeline.ts` | WORKING — cites evidence, abstains when absent |
| Document extraction | `src/lib/doc-extract.ts` | WORKING — real PDF/DOCX/CSV/TXT extraction |
| File scanning | `src/lib/files.ts` | WORKING — deterministic scanner, quarantine on failure |

### 4.6 Console (37 views)

Pre-existing: Dashboard, Ops Monitor, Leads, Clients, Approvals, Communications, Live Chat, Payments,
Projects, Reviews, AI Workforce, Command Center, AI Memory, Newsletter, SEO Audit, Marketing Kit,
Prompt Library, Knowledge Base, Content Studio, Blog Studio, Analytics, Logs, n8n Workflows, Reports,
Team, Settings, App Factory, Media Studio, Feed Hub, Calls & SMS.

**Added in this engagement:** Model Management, Skill Registry, Department Registry, Task Queue,
Workflow Builder, CRM Integrations, Backup & Recovery.

## 5. Integrations and their real state

| Integration | Mechanism | State | Evidence |
| --- | --- | --- | --- |
| WhatsApp | Meta Cloud API v21 | NOT_CONFIGURED — `WHATSAPP_TOKEN` absent | `src/lib/comms.ts` `channelStatuses()` |
| Email | SMTP | NOT_CONFIGURED | `src/lib/comms.ts` |
| SMS | provider | NOT_CONFIGURED | `src/lib/comms.ts` |
| Facebook / Instagram / LinkedIn / X | Graph API | NOT_CONFIGURED | `src/lib/comms.ts` |
| n8n | webhook bridge | NOT_CONFIGURED | `N8N_WEBHOOK_BASE` absent |
| Remote model (ZAI) | `z-ai-web-dev-sdk` | NOT_CONFIGURED in this sandbox | `src/lib/ai-provider.ts` |
| Local model | Ollama / llama.cpp | NOT_CONFIGURED in this sandbox | `src/lib/model/router.ts` |
| Stripe | REST | NOT_CONFIGURED | `STRIPE_SECRET_KEY` absent |
| PostgreSQL / Redis / Qdrant | — | NOT_BUILT | no dependency, no configuration |

The platform reports these states honestly and refuses to act on an unconfigured channel. This is
enforced in code (`src/lib/comms.ts` returns `NOT_CONFIGURED` rather than a fake success) and is
surfaced in the console by the new **CRM Integrations** page.

## 6. Known limitations carried into this engagement

| Limitation | Evidence | Disposition |
| --- | --- | --- |
| No local model weights verified on this host | `huggingface.co` and `ollama.com` are unreachable from the sandbox (HTTP 000) | The catalogue marks every checksum unverified and the verification script is provided; real verification is a production-host task. |
| Prisma client cannot be generated in this sandbox | `binaries.prisma.sh` is blocked | 4 pre-existing `tsc` errors are environmental only, confirmed on a clean tree with `git stash`. CI has network access and runs `prisma generate`. |
| `tests/database-workflows.test.ts` fails here | needs a real MySQL and a generated client | The one failing test in a 466-test suite. It passes in CI, which runs a MySQL service. |
| The `bun` sidecars cannot be run | `bun` is not installed | `mini-services/ai-ops` and `notify-relay` are UNVERIFIED locally. |
| Sandbox resources (2 CPU, 3.8 GB RAM) are far below the 16–32 GB target | `os.totalmem()` | No large-model inference or benchmark claim is made from this environment. |

## 7. What was changed in this engagement

Five commits, each independently tested:

| Commit | Subject | Tests added |
| --- | --- | --- |
| `62c718c` | feat(ai): private CPU model service with authenticated gateway | 32 (`tests/model-service.test.ts`) |
| `54f17b9` | feat(skills): 2,200-skill registry, 2,200 logical agents, durable skill queue | 38 (`tests/skills-registry.test.ts`) |
| `7bd5534` | feat(api): the specified API contracts + private RAG pipeline | 69 (`tests/api-contracts.test.ts`, `tests/rag-pipeline.test.ts`) |
| `dc4a5dd` | feat(console): the missing Super Admin pages + persisted workflow builder | covered by the suite above |
| `b9918af` | feat(eval): 266-question benchmark, scoring harness and model benchmark scripts | 25 (`tests/eval-harness.test.ts`) |

**164 new test cases**, and the whole suite went from 302 to 466 tests.
