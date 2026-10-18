# Production dependency map — tech360

| Field | Value |
| --- | --- |
| Reviewed | 2026-10-18 |
| Access level | Internal |
| Version | 1.0.0 |

---

## 1. Runtime dependency graph

```
                         ┌──────────────────────────────┐
   Browser (admin)  ──▶  │  Next.js 16 App Router        │
                         │  src/app/api/**               │
                         └───────────────┬──────────────┘
                                         │
                    ┌────────────────────┼─────────────────────┐
                    ▼                    ▼                     ▼
         ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐
         │ api-guard.ts     │  │ model/gateway.ts  │  │ skills/executor  │
         │ session + CSRF   │  │ bearer + rate    │  │ permission +     │
         │ + RBAC           │  │ limit + digest   │  │ schema + timeout │
         └────────┬─────────┘  └────────┬─────────┘  └────────┬─────────┘
                  │                     │                     │
                  ▼                     ▼                     ▼
         ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐
         │ MySQL (Prisma)   │  │ model/router.ts  │  │ AgentJob queue   │
         │ 63 models        │  │ ollama → openai  │  │ leases + retry   │
         │ 9 migrations     │  │ -compatible → zai│  │ + recovery       │
         └──────────────────┘  └────────┬─────────┘  └──────────────────┘
                                          │
                    ┌─────────────────────┼─────────────────────┐
                    ▼                     ▼                     ▼
         ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐
         │ Ollama           │  │ llama.cpp /      │  │ z-ai-web-dev-sdk │
         │ 127.0.0.1 only   │  │ vLLM / LM Studio │  │ (remote, LAST    │
         │ NOT public      │  │ private upstream │  │  resort only)    │
         └──────────────────┘  └──────────────────┘  └──────────────────┘
```

**Every arrow is a real import or a real HTTP call in this repository.** There is no diagram-only
component.

## 2. Component dependency table

| Component | Depends on | Must not depend on | Enforcement |
| --- | --- | --- | --- |
| `src/lib/model/gateway.ts` | `src/lib/constant-time.ts`, `src/lib/security.ts` | `@/lib/db` (no database read on the hot path), any provider SDK | `tests/model-service.test.ts` |
| `src/lib/model/router.ts` | the Ollama provider, the OpenAI-compatible provider, `src/lib/ai-provider-runtime.ts` | — | `tests/model-service.test.ts` |
| `src/lib/model/providers/ollama.ts` | `src/lib/model/types.ts`, `node:fetch` | a public upstream | `isPrivateUpstream()` |
| `src/lib/skills/executor.ts` | `src/lib/skills/primitives.ts`, `src/lib/skills/registry.ts` | a database on the pure path (the Prisma import is lazy) | `tests/skills-registry.test.ts` |
| `src/lib/skills/queue.ts` | `src/lib/agents/jobs.ts` (the ONE queue) | a second queue | shares the `AgentJob` lease/recovery path |
| `src/lib/rag/store.ts` | `@/lib/db` | the model router on the read path | `tests/rag-pipeline.test.ts` |
| `src/lib/rag/pipeline.ts` | the router, the store, the chunker | — | `tests/rag-pipeline.test.ts` |
| `src/lib/agents/engine.ts` | the router, the policy, the knowledge search | a direct shell or SQL capability | `tests/agent-job-policy.test.ts` |
| `src/lib/agents/jobs.ts` | `@/lib/db`, `src/lib/agents/engine.ts` | — | `tests/agent-job-policy.test.ts`, `tests/ai-ops-resilience.test.ts` |
| `src/lib/ai-workforce-policy.ts` | nothing (pure policy) | the database | `tests/ai-workforce-rbac.test.ts` |
| `src/lib/api-guard.ts` | `@/lib/db`, `src/lib/security.ts` | — | `tests/ai-workforce-rbac.test.ts` |
| `src/lib/eval/*` | nothing but the dataset contract | **the application** — the benchmark must never leak into the product | `tests/eval-harness.test.ts` walks `src/` for an import of the benchmark |

## 3. External services and their exposure

| Service | Default binding | Public exposure | Credentials | Notes |
| --- | --- | --- | --- | --- |
| MySQL | `DATABASE_URL` | **Never public** | `DATABASE_URL` | Least-privilege service account recommended in the runbook. |
| Ollama | `127.0.0.1:11434` | **Never public** | none by default; optional `LOCAL_MODEL_API_KEY` | The provider refuses a non-private upstream. |
| llama.cpp / vLLM / LM Studio server | `127.0.0.1` | **Never public** | optional `LOCAL_OPENAI_API_KEY` | Same guard. |
| The model gateway (`/api/model/v1/*`) | the app's own port | Behind the app's auth | `MODEL_API_KEY` (≥32 chars) | Fail-closed. |
| ZAI (remote model) | outbound HTTPS | outbound only | `ZAI_API_KEY` | Last resort only. |
| n8n | `N8N_WEBHOOK_BASE` | outbound only | — | Not configured in this environment. |
| WhatsApp / Meta Graph | outbound HTTPS | outbound only | `WHATSAPP_TOKEN` | Not configured. |
| SMTP | outbound | outbound only | `SMTP_*` | Not configured. |
| Stripe | outbound HTTPS | outbound only | `STRIPE_SECRET_KEY` | Not configured. |
| `mini-services/ai-ops` (:3031) | local | **Never public** | — | `bun` sidecar; not verifiable here. |
| `mini-services/notify-relay` (:3032) | local | **Never public** | — | `bun` sidecar; not verifiable here. |
| Redis / Qdrant / PostgreSQL | — | — | — | **NOT BUILT.** No dependency, no configuration, no service. |

**No service was newly exposed to the public internet in this engagement.** The private model service
is an addition on the existing host and refuses any upstream that is not a private address.

## 4. The dependency that matters most

`src/lib/agents/jobs.ts` is the **single** durable task store. It is depended on by:

- the agent runtime (`processAgentJobBatch` → `runAgent`),
- the skill runtime (`src/lib/skills/queue.ts` → `processSkillTaskBatch`),
- the console (the Task Queue page),
- the public API (`/api/tasks`, `/api/tasks/{id}`),
- the recovery loop (`recoverExpiredAgentJobs`).

**Adding a second queue would have meant a second lease implementation, a second retry policy and a
second crash-recovery path** — three more places for a task to be lost. The design deliberately
widened one column (`AgentJob.agentCode` → nullable) instead.

## 5. Dependency risks

| # | Risk | Likelihood | Impact | Mitigation | State |
| --- | --- | --- | --- | --- | --- |
| R1 | The Prisma client cannot be generated in a network-restricted environment | Observed | The build fails locally | CI has network access and runs `prisma generate`; the schema is validated statically by `tests/migration-parity.test.ts` | Mitigated |
| R2 | The sandbox cannot reach `huggingface.co` or `ollama.com` | Observed | No real weight verification or CPU benchmark | The catalogue marks the weights unverified and refuses to promote them; the verification and benchmark scripts are provided for the production host | Mitigated, not closed — see `docs/audit/SECURITY_AND_BACKUP_STATUS.md` §7 |
| R3 | The vector store is a linear scan | Low today | Latency as the corpus grows | The storage adapter is the only thing that changes; the seam is documented in `docs/architecture/DATABASE_ARCHITECTURE.md` §6 | Accepted |
| R4 | A single MySQL instance is a single point of failure | Medium | Total outage | The backup and restore gap is the open item; see O1 | **OPEN** |
| R5 | The `bun` sidecars are unverified | Medium | The autonomous loop may not run in production | `bun` is not installed in the audit environment | **OPEN** — O5 |
| R6 | The remote model provider is the last resort but is the only provider that works in a restricted network | Low | Degraded capability | The router preserves the real provider error so the operator can see the true cause | Mitigated |
| R7 | Two `minorservices` could drift from the main app's contract | Low | A broken sidecar | Both read the same database and settings; no shared code | Accepted |

## 6. What was added to the dependency tree

| Added | Version | Why | Licence | Risk |
| --- | --- | --- | --- | --- |
| `zod` | already present | — | MIT | — |
| **No new runtime dependency was added in this engagement.** | | | | |

The private model service, the skills engine, the RAG pipeline, the evaluation harness and the new
console pages are all written against the existing dependency set. The model service speaks the
**Ollama HTTP API** and the **OpenAI-compatible `/v1` API** over `node:fetch`, so it adds no SDK, no
native module and no build step.

**This matters for the private-hosting requirement:** a CPU-only model host needs no GPU runtime, no
Python environment and no container beyond the existing Node application.
