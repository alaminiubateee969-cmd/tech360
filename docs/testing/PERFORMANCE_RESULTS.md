# Performance results

| | |
|---|---|
| **Document** | `docs/testing/PERFORMANCE_RESULTS.md` |
| **Owner** | Platform engineering, Tech360 |
| **Collection date** | 2026-10-19 |
| **Last verification** | 2026-10-19 |
| **Access level** | Internal — engineering and Super Admin |
| **Version** | 1.0 |
| **Retention** | Retained for the life of the platform |

> **The numbers in this document were measured in a 2-vCPU, 3.8 GB
> sandbox. They are a measurement of that machine, not a production
> claim.** The production host must re-run the same probe.

---

## 1. What was measured, and what was not

| | |
|---|---|
| **Measured** | the platform's own hot paths: the registry builds, the retrievers, the validators, the procedure runtime and the skill executor |
| **Not measured** | model inference, first-token latency, tokens per second, the quality of an answer, the memory footprint of a loaded model |
| **Why not** | `huggingface.co` and `ollama.com` are **not reachable from this environment**, so no weight could be downloaded and no model server could be started. A number invented here would be a fabrication. |

The model benchmark is a **separate, mandatory step on the production
host**: `npm run bench:models` and `npm run models:verify`. The
acceptance criteria each model must pass are already declared in
`src/lib/model/registry.ts` → `ModelAcceptanceCriteria`.

---

## 2. The environment

| | |
|---|---|
| Node | v22.22.3 |
| Platform | Linux x64 |
| vCPU | 2 |
| RAM | 3,940 MB |
| Date | 2026-10-19 |
| Raw output | `docs/testing/workforce-benchmark.json` |
| Probe | `scripts/benchmark/workforce.ts` |

The production target is a 16–32 GB host with a dedicated CPU inference
budget. This sandbox is far below it, so the absolute numbers here are
pessimistic by design.

---

## 3. The measurements

| Path | Iterations | Per call | Throughput |
|---|---:|---:|---:|
| `prompts.libraryIndex` (the 70,400-slot index) | 50 | **0.001 ms** | 1,446,508/s |
| `skills.validateRegistry` | 20 | **0.007 ms** | 146,081/s |
| `tools.validateToolRegistry` | 200 | **0.007 ms** | 142,950/s |
| `skill.execute(classify_intent)` | 200 | **0.024 ms** | 41,106/s |
| `workforce.workforceStats` (2,201 employees) | 200 | **0.179 ms** | 5,573/s |
| `sop.execute(D010-INTAKE, no gateway)` | 50 | **0.091 ms** | 10,936/s |
| `prompts.materialiseBinding` (32 prompts) | 200 | **0.098 ms** | 10,170/s |
| `prompts.retrieve(limit 12)` | 200 | **0.122 ms** | 8,169/s |
| `workforce.validateWorkforce` (all 24 attributes × 2,201) | 50 | **1.653 ms** | 605/s |

### 3.1 What these numbers mean

| Observation | Consequence |
|---|---|
| the 70,400-slot prompt index is built in **0.001 ms** because it is a **shape description, not a materialisation** | the prompt library costs nothing to "have". The cost is only paid when a binding is materialised (0.098 ms) and retrieved (0.122 ms) |
| a retrieval returns in **0.122 ms** | retrieving the relevant prompts is never the bottleneck; the model call is |
| a procedure executes in **0.091 ms** up to the point where it needs a governed tool gateway | the procedure runtime is a state machine over deterministic skills, and it is cheap |
| a skill executes in **0.024 ms** | the 10,010 skills are **deterministic primitives**, and that is why they are auditable and why 10,010 of them are practical |
| validating all 2,201 employees takes **1.653 ms** | the workforce can be checked on every request, not only at build time |

---

## 4. The scale that was designed for

The specification asks for 2,000+ employees, 10,000+ skills, 500+
procedures and 50,000+ prompts, and it forbids 2,000 simultaneous model
processes. The measured numbers show why that constraint is not a
problem:

| Concern | The mechanism | The measured cost |
|---|---|---|
| 2,201 employees | they are **definitions**, executed by a bounded worker pool over one durable queue | a registry lookup, not a process |
| 10,010 skills | they are **parameterised capabilities** over 20 deterministic primitives | 0.024 ms each |
| 550 procedures | they are **declarative state machines** | 0.091 ms each |
| 70,400 prompts | they are **materialised on demand**, one binding at a time | 0.122 ms per retrieval |
| 2,000+ concurrent tasks | they are **rows in one queue** with leases, bounded backoff and a concurrency limit | a queue claim, not a process |

The only unbounded cost in the system is the model call, and that is
precisely the cost the specification asks to bound with a worker pool
and a persistent queue.

---

## 5. The speed engine

The specification's speed engine is implemented as follows:

| Mechanism | Where | Effect |
|---|---|---|
| Caches | the catalogue builds, the prompt index and the registry validation are module-level constants, computed once per process | the 70,400-slot index costs 0.001 ms after the first call |
| Pooling | the Prisma client is a single lazily-created singleton with a connection pool | `src/lib/db.ts` |
| Async workers | the durable queue leases work to workers; a job is a row, not a thread | `src/lib/agents/jobs.ts` |
| Context compression | `fitToBudget()` compresses the supporting material in reverse order of importance and **reports** what it dropped | `src/lib/agents/context.ts` |
| Relevant retrieval | the prompts, the memory and the knowledge are **retrieved**, never loaded | `src/lib/prompts/retrieval.ts`, `src/lib/memory/system.ts` |
| Streaming | the model gateway streams when the provider supports it | `src/lib/model/providers/ollama.ts` |
| Fallback | the provider chain `ollama → openai-compatible → zai` | `src/lib/model/router.ts` |
| Backoff | `availableAt` + `maxAttempts` on the queue | `src/lib/agents/jobs.ts` |
| Circuit breakers | the self-healing ladder switches the model and then escalates; it never retries indefinitely | `src/lib/agents/self-healing.ts` |
| Concurrency limits | `max_tool_calls`, `timeout_seconds` and `max_retries` on every catalogue agent, and the queue's lease | `src/lib/agents/catalogue.ts` |

---

## 6. What has NOT been measured, and must be on the production host

| Measure | How to obtain it | Acceptance criterion source |
|---|---|---|
| Model memory footprint | `npm run models:verify` | `ModelAcceptanceCriteria.maxRamMb` |
| First-token latency | `npm run bench:models` | `ModelAcceptanceCriteria.maxFirstTokenMs` |
| Generation speed (tokens/s) | `npm run bench:models` | `ModelAcceptanceCriteria.minTokensPerSecond` |
| Bangla quality | the evaluation harness, Bangla slice | `ModelAcceptanceCriteria.minBanglaScore` |
| English quality | the evaluation harness, English slice | `ModelAcceptanceCriteria.minEnglishScore` |
| JSON structure reliability | the evaluation harness | `ModelAcceptanceCriteria.requiresStructuredOutput` |
| Tool selection accuracy | the evaluation harness | `ModelAcceptanceCriteria.requiresToolSelection` |
| RAG grounding | the evaluation harness | `ModelAcceptanceCriteria.requiresGroundedAnswers` |
| Missing-evidence behaviour | the evaluation harness | `ModelAcceptanceCriteria.requiresAbstention` |
| Prompt-injection resistance | the evaluation harness | `ModelAcceptanceCriteria.requiresInjectionResistance` |
| The evaluation score on 266 questions | `npm run eval:run` | `src/lib/eval/metrics.ts` |
| The end-to-end request latency | a staging load test | — |
| The queue throughput under load | a staging load test | — |

**The catalogue reports `weightsVerified: false` for every model until
`npm run models:verify` captures a real revision and checksum on the
host that runs it.** The model hub refuses to treat an unmeasured model
as measured, and the console says so.

---

## 7. Reproducing this measurement

```bash
npm ci --no-audit --no-fund
npx tsx scripts/benchmark/workforce.ts --json docs/testing/workforce-benchmark.json
```

On the production host, the same script plus:

```bash
npm run models:verify   # captures the revision and the weight checksum
npm run bench:models    # measures latency, throughput and quality
npm run eval:run        # scores the 266-question evaluation set
```

The raw output of this run is committed at
`docs/testing/workforce-benchmark.json`.
