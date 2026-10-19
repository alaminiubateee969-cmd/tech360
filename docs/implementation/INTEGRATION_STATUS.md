# Integration status

| | |
|---|---|
| **Document** | `docs/implementation/INTEGRATION_STATUS.md` |
| **Owner** | Platform engineering, Tech360 |
| **Collection date** | 2026-10-19 |
| **Last verification** | 2026-10-19 |
| **Access level** | Internal — engineering and Super Admin |
| **Version** | 1.0 |
| **Retention** | Retained for the life of the platform |

Each integration is classified **WORKING / PARTIAL / BROKEN / MISSING /
UNVERIFIED / NOT APPLICABLE**, with the file, the route and the test
that prove it.

---

## 1. The rule the platform follows

An integration reports its **true** state. It never claims a success
it did not have. The three states are:

| State | Meaning |
|---|---|
| `CONFIGURED` | the credentials are present and the integration is enabled |
| `NOT_CONFIGURED` | the credentials are absent — the integration refuses to act |
| `DISABLED_BY_ADMIN` | an administrator turned it off |

`src/app/api/admin/integrations/route.ts` reports exactly this. The
Integrations console panel renders the state; there is no green tick
without a working integration.

---

## 2. Business workflows

### 2.1 WhatsApp → CRM

| Aspect | Status | Evidence |
|---|---|---|
| The transport | **NOT_CONFIGURED** | `src/lib/comms.ts` → the WhatsApp client; no credentials are present in this environment |
| The signature verification | **WORKING** | `src/lib/security.ts` → `constantTimeEquals()` is used for the webhook signature; `tests/webhook-auth.test.ts` — 20/20 |
| The phone normalisation | **WORKING** | the `phone.normalize` skill; `tests/skills-registry.test.ts` executes it and validates the E.164 output |
| The idempotent lead create/update | **WORKING** | the `crm.dedupe` tool and the `record.dedupe_key` skill; `tests/outbox-retry.test.ts` — 20/20, `tests/outbox-retry-integration.test.ts` — 12/12 |
| The CRM-authoritative student ID | **WORKING** | the lead is written against `Client.clientId`, which the CRM owns; `tests/business-policies.test.ts` — 17/17 |
| No duplicate IDs | **WORKING** | the deduplication key; `tests/skills-registry.test.ts` |
| No invented WhatsApp capability | **WORKING** | the integration reports `NOT_CONFIGURED` and refuses to act |
| An end-to-end delivery against a live provider | **UNVERIFIED** | no provider credentials are present here; this must be run on the production host |

### 2.2 Document processing

| Aspect | Status | Evidence |
|---|---|---|
| Type and size validation | **WORKING** | `src/app/api/admin/documents/**`; the `file.classify` and `file.scan` skills |
| The malware scan | **NOT_CONFIGURED** | the scanner reports its state; no scanner binary is present in this environment |
| Private object storage | **WORKING** | the documents are written to a private path, never a public one |
| Metadata, OCR/extract, classify | **WORKING** | the `document.classify` and `entity.extract` skills; `tests/skills-registry.test.ts` |
| The staff review step | **WORKING** | the document status machine in `src/app/api/admin/documents/[id]/status/route.ts` |
| The audit | **WORKING** | `audit()` on every document state change |
| The scoped, expiring link | **WORKING** | the link is scoped to the reviewer and expires |
| A live OCR provider | **UNVERIFIED** | no provider credentials are present here |

### 2.3 Marketing

| Aspect | Status | Evidence |
|---|---|---|
| Human review before publication | **WORKING** | `src/app/api/admin/content/review/route.ts` |
| Explicit authorisation before a public post | **WORKING** | `social.publish` is a **privileged, approval-gated** tool; `tests/ai-workforce-rbac.test.ts`; the `capability:all` wildcard deliberately does **not** cover it |
| The content generation path | **WORKING** | `src/app/api/admin/content/generate/route.ts` |
| A live social provider | **NOT_CONFIGURED** | the integration reports its state |

### 2.4 The AI software engineer

| Aspect | Status | Evidence |
|---|---|---|
| An isolated branch, tests, security checks, a PR and a review | **WORKING** | this work was done on `arena/059cc90a-tech360`; `.github/workflows/ci.yml` runs the secret scan, the type check, the lint, the tests, the build and a production smoke test |
| CI and branch protection are never bypassed | **WORKING** | no workflow was modified to skip a gate; the CI file is unchanged by this work |
| The agent path that opens a PR | **WORKING** | `src/app/api/admin/factory/apps/[id]/export/route.ts` and the `review.request` tool; `tests/factory-blueprint.test.ts` — 20/20 |

---

## 3. The platform integrations

| Integration | State here | Notes |
|---|---|---|
| MySQL | **CONFIGURED in CI, not here** | the Prisma client cannot be generated in this environment; the four `tsc` errors and the one failing test are both consequences of that |
| Ollama (local inference) | **NOT_CONFIGURED** | `ollama.com` is unreachable from this environment; the private model service is tested against a **fake Ollama server** in `tests/model-service.test.ts` |
| An OpenAI-compatible local server | **NOT_CONFIGURED** | the provider is implemented and tested; no server is running here |
| The remote `z-ai` provider | **NOT_CONFIGURED** | the pre-existing client is used as the last-resort provider; no key is present here |
| The private model gateway | **WORKING** | `src/lib/model/gateway.ts`; 32/32 tests |
| The n8n workflow registry | **WORKING** | `n8nWorkflow` model, seeded; `tests/n8n-lead-enrichment.test.ts` |
| The outbox retry | **WORKING** | `tests/outbox-retry.test.ts` — 20/20, `tests/outbox-retry-integration.test.ts` — 12/12 |
| The webhook replay guard | **WORKING** | `tests/webhook-auth.test.ts` — 20/20 |
| The identity resolver | **WORKING** | `tests/identity-resolver.test.ts` — 3/3 |
| The telephony provider | **NOT_CONFIGURED** | the policy and the normalisation are tested (`tests/telephony.test.ts` — 16/16); the provider is not |
| The OTP portal | **WORKING** | `tests/portal-otp.test.ts` — 6/6 |
| Redis / Qdrant | **NOT APPLICABLE** | the platform uses MySQL and the in-process vector store; no Redis or Qdrant service is deployed, so none is exposed |

---

## 4. The internal subsystems

| Subsystem | Status | Evidence |
|---|---|---|
| The agent runtime | **WORKING** | `src/lib/agents/engine.ts`; `tests/ai-registry.test.ts`, `tests/ai-health.test.ts` |
| The durable queue | **WORKING** | `src/lib/agents/jobs.ts`; `tests/agent-job-policy.test.ts` — 3/3, `tests/ai-ops-resilience.test.ts` — 4/4 |
| The scheduler | **WORKING** | `src/lib/ops-loop.ts`; `tests/ai-ops-resilience.test.ts` |
| The model router | **WORKING** | `src/lib/model/router.ts`; `tests/model-service.test.ts` — 32/32 |
| The model hub (routing) | **WORKING** | `src/lib/model/hub.ts`; `tests/ai-eos.test.ts` |
| The RAG pipeline | **WORKING** | `src/lib/rag/*`; `tests/rag-pipeline.test.ts` — 25/25 |
| The knowledge graph | **WORKING** | `src/lib/knowledge/graph.ts`; `tests/ai-eos.test.ts` |
| The memory system | **WORKING** | `src/lib/memory/system.ts`; `tests/ai-eos.test.ts` |
| The event bus | **WORKING** | `src/lib/events/bus.ts`; `tests/ai-eos.test.ts` |
| The orchestrator | **WORKING** | `src/lib/agents/orchestrator.ts`; `tests/ai-eos.test.ts` |
| The quality engine | **WORKING** | `src/lib/agents/quality.ts`; `tests/ai-eos.test.ts` |
| The learning engine | **WORKING** | `src/lib/agents/learning.ts`; `tests/ai-eos.test.ts` |
| The self-healing ladder | **WORKING** | `src/lib/agents/self-healing.ts`; `tests/ai-eos.test.ts` |
| The governance rules | **WORKING** | `src/lib/governance/rules.ts`; `tests/ai-eos.test.ts` |
| The SOP runtime | **WORKING** | `src/lib/sops/executor.ts`; `tests/ai-eos.test.ts` |
| The prompt retrieval | **WORKING** | `src/lib/prompts/retrieval.ts`; `tests/ai-eos.test.ts` |
| The tool registry | **WORKING** | `src/lib/tools/registry.ts`; `tests/ai-eos.test.ts` |
| The evaluation harness | **WORKING** | `src/lib/eval/*`; `tests/eval-harness.test.ts` — 25/25 |
| The backup and restore | **NOT MET** | `docs/testing/RESTORE_TEST_RESULTS.md` |

---

## 5. The sixteen specified API contracts

| Contract | Route | Status | Test |
|---|---|---|---|
| `POST /api/ai/chat` | `src/app/api/ai/chat/route.ts` | **WORKING** | `tests/api-contracts.test.ts` |
| `POST /api/command` | `src/app/api/command/route.ts` | **WORKING** | `tests/api-contracts.test.ts` |
| `GET /api/models` | `src/app/api/models/route.ts` | **WORKING** | `tests/api-contracts.test.ts` |
| `GET /api/agents` | `src/app/api/agents/route.ts` | **WORKING** | `tests/api-contracts.test.ts` |
| `GET /api/skills` | `src/app/api/skills/route.ts` | **WORKING** | `tests/api-contracts.test.ts` |
| `GET /api/departments` | `src/app/api/departments/route.ts` | **WORKING** | `tests/api-contracts.test.ts` |
| `POST /api/tasks` | `src/app/api/tasks/route.ts` | **WORKING** | `tests/api-contracts.test.ts` |
| `GET /api/tasks/{id}` | `src/app/api/tasks/[id]/route.ts` | **WORKING** | `tests/api-contracts.test.ts` |
| `POST /api/approvals/{id}/approve` | `src/app/api/approvals/[id]/approve/route.ts` | **WORKING** | `tests/api-contracts.test.ts` |
| `POST /api/approvals/{id}/reject` | `src/app/api/approvals/[id]/reject/route.ts` | **WORKING** | `tests/api-contracts.test.ts` |
| `POST /api/knowledge/ingest` | `src/app/api/knowledge/ingest/route.ts` | **WORKING** | `tests/api-contracts.test.ts` |
| `POST /api/knowledge/search` | `src/app/api/knowledge/search/route.ts` | **WORKING** | `tests/api-contracts.test.ts` |
| `GET /api/health` | `src/app/api/health/route.ts` (pre-existing) | **WORKING** | `tests/api-contracts.test.ts` |
| `GET /api/health/deep` | `src/app/api/health/deep/route.ts` | **WORKING** | `tests/api-contracts.test.ts` |
| `GET /api/audit` | `src/app/api/audit/route.ts` | **WORKING** | `tests/api-contracts.test.ts` |
| `GET /api/metrics` | `src/app/api/metrics/route.ts` | **WORKING** | `tests/api-contracts.test.ts` |

The four contracts that already had an admin implementation
(`/api/models`, `/api/agents`, `/api/knowledge/*`, `/api/audit`) delegate
to it, so there is **one** implementation per behaviour.

---

## 6. The console

| Panel | Status | Backing API |
|---|---|---|
| Command Center | **WORKING** | `src/app/api/admin/command/route.ts` |
| Model Management | **WORKING** | `src/app/api/models/route.ts`, `src/app/api/admin/model-hub/route.ts` |
| Department / Agent / Skill Registry | **WORKING** | `/api/departments`, `/api/agents`, `/api/skills`, `/api/admin/workforce` |
| Task Queue | **WORKING** | `/api/tasks` |
| Workflow Builder | **WORKING** | `/api/admin/workflows` |
| Approvals | **WORKING** | `/api/admin/approvals` |
| Knowledge | **WORKING** | `/api/admin/knowledge`, `/api/admin/knowledge-graph` |
| CRM Integrations | **WORKING** | `/api/admin/integrations` |
| Marketing | **WORKING** | `/api/admin/marketing`, `/api/admin/content` |
| Media | **WORKING** | `/api/admin/media`; `tests/media-studio.test.ts` — 20/20 |
| Server Health | **WORKING** | `/api/health`, `/api/health/deep` |
| Audit | **WORKING** | `/api/audit` |
| Backup & Recovery | **PARTIAL** | the state is reported truthfully; **no artefact and no proven restore** |
| AI Employees (new) | **WORKING** | nine APIs, one workspace |
| Settings | **WORKING** | `src/app/api/admin/settings` |

---

## 7. The integrations that were NOT taken

From the 122-source catalogue:

| Disposition | Count | Meaning |
|---|---:|---|
| INTEGRATE | 44 | the design was adopted and written in tech360's own idiom |
| REJECT | 40 | the licence or the architecture does not permit it |
| REFERENCE | 18 | read for the design; **no code copied** |
| ADAPT | 15 | a different licence, adapted with the obligations satisfied |
| DEFER | 5 | a good idea that does not fit the current scope |

The strongest copyleft sources (AGPL-3.0 × 11, GPL-3.0 × 6) were read
for design and **not** copied. `tech360-bd/alolabs_AI` was read for
architecture and **not** copied, because it has no LICENSE file.

Full detail: `docs/research/GITHUB_SOURCE_CATALOG.csv` and
`docs/research/GITHUB_LICENSE_MATRIX.md`.
