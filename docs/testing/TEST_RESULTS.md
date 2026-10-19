# Test results

| | |
|---|---|
| **Document** | `docs/testing/TEST_RESULTS.md` |
| **Owner** | Platform engineering, Tech360 |
| **Collection date** | 2026-10-19 |
| **Last verification** | 2026-10-19 |
| **Access level** | Internal — engineering and Super Admin |
| **Version** | 1.0 |
| **Retention** | Retained for the life of the platform |

---

## 1. The run

| | |
|---|---|
| Command | `npm test` → `tsx --test --experimental-test-module-mocks tests/**/*.test.ts` |
| Node | v22.22.3 |
| Platform | Linux x64, 2 vCPU, 3.8 GB RAM |
| Test files | **37** |
| Tests | **629** |
| Passed | **628** |
| Failed | **1** |
| Skipped / todo | 0 |

**The single failure is environmental, not a code defect.**
`tests/database-workflows.test.ts` requires a generated Prisma client
and a reachable MySQL. The Prisma engine binaries are downloaded from
`binaries.prisma.sh`, which is **not reachable from this environment**,
so the client could not be generated. The failure message is:

```
Error: @prisma/client did not initialize yet. Please run "prisma generate"
```

CI generates the client and starts a MySQL service, so this suite runs
there. Every other suite passes.

---

## 2. Per-file results

| File | Tests | Pass | Fail |
|---|---:|---:|---:|
| `agent-job-policy.test.ts` | 3 | 3 | 0 |
| `ai-eos.test.ts` | 94 | 94 | 0 |
| `ai-health.test.ts` | 1 | 1 | 0 |
| `ai-ops-resilience.test.ts` | 4 | 4 | 0 |
| `ai-provider.test.ts` | 4 | 4 | 0 |
| `ai-registry.test.ts` | 1 | 1 | 0 |
| `ai-workforce-rbac.test.ts` | 51 | 51 | 0 |
| `api-contracts.test.ts` | 44 | 44 | 0 |
| `business-policies.test.ts` | 17 | 17 | 0 |
| `chat-triage.test.ts` | 6 | 6 | 0 |
| `client-comms-inbox.test.ts` | 2 | 2 | 0 |
| `communication-pipeline.test.ts` | 61 | 61 | 0 |
| `schema-ddl-parity.test.ts` | 8 | 8 | 0 |
| `contact-policy.test.ts` | 2 | 2 | 0 |
| `database-workflows.test.ts` | 1 | 0 | **1** (environmental) |
| `eval-harness.test.ts` | 25 | 25 | 0 |
| `factory-blueprint.test.ts` | 20 | 20 | 0 |
| `feeds-parse.test.ts` | 13 | 13 | 0 |
| `handover-artifacts.test.ts` | 3 | 3 | 0 |
| `identity-resolver.test.ts` | 3 | 3 | 0 |
| `media-studio.test.ts` | 20 | 20 | 0 |
| `migration-parity.test.ts` | 14 | 14 | 0 |
| `model-service.test.ts` | 32 | 32 | 0 |
| `n8n-lead-enrichment.test.ts` | 3 | 3 | 0 |
| `outbox-migration-parity.test.ts` | 13 | 13 | 0 |
| `outbox-retry-integration.test.ts` | 12 | 12 | 0 |
| `outbox-retry.test.ts` | 20 | 20 | 0 |
| `portal-otp.test.ts` | 6 | 6 | 0 |
| `preview-policy.test.ts` | 2 | 2 | 0 |
| `production-env.test.ts` | 7 | 7 | 0 |
| `rag-pipeline.test.ts` | 25 | 25 | 0 |
| `reference-parity.test.ts` | 27 | 27 | 0 |
| `seo-audit.test.ts` | 7 | 7 | 0 |
| `site-stats.test.ts` | 4 | 4 | 0 |
| `skills-registry.test.ts` | 38 | 38 | 0 |
| `telephony.test.ts` | 16 | 16 | 0 |
| `webhook-auth.test.ts` | 20 | 20 | 0 |
| **Total** | **629** | **628** | **1** |

---

## 3. The tests that matter most

### 3.1 `skills-registry.test.ts` — the exhaustive skill execution (38 tests)

This is the evidence behind the "tested" count. It does not sample: it
executes **every one of the 10,010 skills** against its real handler
with a schema-valid input and validates the output against the
**declared** output schema. A single mismatch fails the suite.

```
skill execution failures:
  (none)
```

The suite also asserts the registry's own consistency
(`validateSkillRegistry()` → `checked === 10010`, zero `ERROR` issues)
and the lifecycle transitions.

**This suite found four real defects** during the work, all of which
were fixed in production code, not in the test:

| Defect | Fix |
|---|---|
| 34 capability templates declared an output schema their handler did not produce (`$.sentences is required`, `$.band is required`, `$.type is required`, `$.passed is required`, `$.score is required`, `$.value is required`, `$.entities is required`, `$.terms is required`, `$.mapped is required`) | the declared schemas were corrected to the handlers' real output, and the types were corrected too (`complexity` is a number, `numeric` is a boolean) |
| 9 templates named a primitive that did not exist (`text.extract`, `text.map`, `text.rank`) | corrected to `entity.extract`, `keyword.map`, `keyword.rank` |
| `validateLogicalAgentCatalogue()` matched a skill's capability by its last two underscore-separated segments, so a three-word capability slug was reported as unknown | the suffix is now matched against the known capability list |
| the role archetypes did not cover every capability | the 91 capabilities are dealt out round-robin across the 20 archetypes, so every capability is owned by at least one role |

### 3.2 `communication-pipeline.test.ts` — the client journey (61 tests)

The suite for the AI Agent communication pipeline. It proves the
**exact** copy, the **gates**, the **no phone number** rule and the
**always save** contract without a database, because the pipeline
templates and rules are pure modules by design.

| Group | Tests | What it proves |
|---|---:|---|
| the exact client copy | 15 | every stage's WhatsApp/SMS body, email subject and email body match the specified wording — the Client ID is in the first reply, the six intake questions are in order, the eight scope questions are in order, the approval phrase and the password-change confirmation phrase are present, every stage has both a WhatsApp body and an email subject |
| the email HTML renderer | 5 | a client name can never inject markup, a markdown link becomes an anchor, a `javascript:` URL stays plain text, bold and lists render, the paragraph structure is preserved |
| the message gates | 7 | the auto-send list, the admin-approval list, the eight named approval categories, an unknown stage fails closed, a body with an amount is gated whatever its stage, and the amount detector does not fire on a Client ID |
| no phone number in AI content | 6 | a local, an international and a masked number are found; a Client ID, a URL, an email, a date, an amount, an invoice number, a numbered list and `24/7` are **not**; the redaction keeps the Client ID; the screening reports what it removed; the assertion throws; a file link in public content is refused |
| the delivery rules | 4 | source code is refused before payment, refused without an admin approval, allowed with both; the two policy names are the specified ones |
| the CRM save contract | 3 | the seven required fields, the action → records map for 19 journey actions, and the payment / delivery / review histories |
| identifiers and channels | 5 | the `TECH-YYYY-NNNNNN` format, SMS as a reply channel, a `Phone` **preference** still returns `null`, and the website consent must be the exact boolean `true` |
| channel selection | 4 | the channels a client may receive, the requested-channel filter, the empty case, and the agent that owns each channel |
| the stated policy, item by item | 7 | each of the nine auto-send items auto-sends on its real copy; each of the seven approval items is gated; a body carrying an amount gates **every** stage; eight real policy statements from the auto-send copy still auto-send; the gate explains itself; the categories are detected |

**This suite found two real defects** during the work, both fixed in
production code:

| Defect | Fix |
|---|---|
| the payment instruction was sent straight to the client with **no admin approval** — the "payment instruction with amount" gate did not exist | `requestPayment()` now raises a `PAYMENT_INSTRUCTION` approval and sends nothing; the approval execution path sends it for real |
| an SMS lead was never answered — `selectWelcomeChannel()` recognised only WhatsApp and email, so the pipeline's SMS entry point was dead | SMS is now a first-class reply channel, while a `Phone` preference still returns `null` (a call is a human's job) |

### 3.3 `ai-eos.test.ts` — the workforce (94 tests)

The new suite for the AI-EOS work. It covers:

| Area | What it proves |
|---|---|
| Organisation | 9 levels, 8 divisions, 110 departments, every employee has a manager, every employee has all 24 attributes, the Master AI is the pre-existing `CEO-001` |
| Skills | 10,010 skills, a unique id each, a registered handler each |
| Procedures | 550 procedures, every one with a trigger, steps, validation, a failure path and an escalation; every step references a skill that exists; the executor refuses a missing input, refuses an unknown procedure, refuses a tool step with no gateway, and **stops at an approval step without self-approving** |
| Prompts | 16 stages, 70,400 slots, a specialised prompt per stage and language, a bounded retriever, a reason for every score, a missing variable stays visible |
| Tool registry | 47 tools with full metadata, every privileged tool risky and approval-gated, an ungranted tool refused, an approval-gated tool never offered as autonomous |
| Orchestrator | the four paths, a fan-out for `ENTERPRISE`, a synthesis and a review step, an approval-requiring action is never `FAST`, an unmeasured agent does not out-score a measured one |
| Quality chain | the depth rules, a good work passes, a bad work fails, the chain stops at the first failing stage, an empty criterion set scores 0 |
| Learning | the protected targets, the 3-observation threshold, an unapproved proposal is refused, a **protected target is refused even when approved**, an unmeasured effect is not a validation |
| Self-healing | the classification, a permission refusal escalates straight to a human, a transient failure recovers, the ladder is bounded |
| Reflection | a simple successful task is not reflected on, a failure is, a complex task is |
| Governance | a financial transfer is always a human, a sensitive external communication is always a human, a narrower rule cannot re-permit a forbidden action, a narrower rule may add a requirement |
| Knowledge graph | two 0.5 claims do not become certainty, a weak claim does not lower an established one |
| Memory | a write with no key or content is rejected, an unknown type is rejected, the sensitive scope is `RESTRICTED`, a validated memory out-scores an unvalidated one, the retrieval is capped |
| Model hub | the ten categories, an unverified model is not promoted, an unmeasured value is reported as unmeasured, an installed model is preferred |
| Availability | `BUSY`, `ESCALATED`, `QUEUED`, `ERROR` and `AVAILABLE` are each derived, not declared |
| Context | the constitution, the identity and the task are never compressed, a compression is reported, the terms are meaningful, every path has a budget |

**This suite found five real defects**, all fixed in production code:

| Defect | Fix |
|---|---|
| the org chart compared the division lead's id against index 0 for **every** employee, so 8 departments ended up with one employee each — 1,152 employees were silently dropped | the comparison now uses the loop index |
| a non-executive division lead had `managerEmployeeId: null`, i.e. an orphan with nobody to escalate to | every division lead reports to the Master AI |
| `integrateProposal()` never called the `apply` function — the learning engine reported an integration it had not performed | the apply is called and its failure is reported |
| the self-healing loop did not set `escalatedToHuman` when the `ESCALATE_HUMAN` action ran inside the plan | the flag is set on that action |
| the tool registry treated `capability:all` as an invokable tool | it is a capability marker and is excluded; `REGISTRY_TOOL_IDS` is the real tool list |

### 3.4 `api-contracts.test.ts` — the sixteen specified contracts (44 tests)

Every path from the specification's contract list is exercised through
the **real** route handlers: `/api/ai/chat`, `/api/command`,
`/api/models`, `/api/agents`, `/api/skills`, `/api/departments`,
`/api/tasks`, `/api/tasks/{id}`, `/api/approvals/{id}/approve`,
`/api/approvals/{id}/reject`, `/api/knowledge/ingest`,
`/api/knowledge/search`, `/api/health`, `/api/health/deep`,
`/api/audit`, `/api/metrics`.

The suite asserts the response shape, the status code and the
machine-readable error code of each failure mode.

### 3.5 `model-service.test.ts` — the private model service (32 tests)

A **fake Ollama server** drives the **real** gateway routes, so the
gateway, the rate limiter, the constant-time key check, the provider
chain, the fallback and the error propagation are all exercised end to
end.

This suite found two real defects during the work, both fixed in
production code:

| Defect | Fix |
|---|---|
| the router masked the real provider failure behind a generic "no provider" error | the chain-exhaustion error now carries the **last** provider's real `errorCode` |
| the gateway accepted a short key | the key must be at least 32 characters, and it is compared in constant time |

### 3.6 `rag-pipeline.test.ts` — the private RAG (25 tests)

Covers chunking, the lexical and neural embedders, the vector store, the
ingest path, retrieval, provenance and the grounded answer — including
the abstention case and the **access re-check in the application** that
was found and fixed during the work.

### 3.7 `eval-harness.test.ts` — the benchmark (25 tests)

The harness scores the 266-question evaluation set and separates the
English and Bangla slices. The question set itself is
`evals/tech360-eval-v1.json`.

### 3.8 `migration-parity.test.ts` and `outbox-migration-parity.test.ts` (27 tests)

Every model in `prisma/schema.prisma` must have matching hand-written
DDL in the migration history, and the outbox tables must match their
own migration. This is what makes it safe to hand-write the migrations
instead of generating them.

---

## 4. Type checking and linting

| Check | Command | Result |
|---|---|---|
| Type check | `./node_modules/.bin/tsc --noEmit` | **4 errors, all environmental** |
| Lint | `npx eslint .` | **clean** |

The four type errors:

```
src/app/api/admin/newsletter/route.ts(86,18): error TS2347: Untyped function calls may not accept type arguments.
src/lib/auth.ts(3,15): error TS2305: Module '"@prisma/client"' has no exported member 'Session'.
src/lib/chat.ts(2,15): error TS2305: Module '"@prisma/client"' has no exported member 'ChatConversation'.
src/lib/chat.ts(2,33): error TS2305: Module '"@prisma/client"' has no exported member 'ChatMessage'.
```

All four are consequences of the Prisma client not being generated in
this environment: without the generated types, `PrismaClient` is
untyped and the model types do not exist. **They are pre-existing, not
introduced by this work**, and CI — which generates the client — is
clean.

---

## 5. What is NOT covered

| Gap | Why | What would close it |
|---|---|---|
| the live database workflows | no MySQL and no generated client here | CI runs this suite with a MySQL service |
| a real CPU model benchmark | `huggingface.co` and `ollama.com` are unreachable from this environment | run `npm run bench:models` and `npm run models:verify` on the production host |
| the live WhatsApp / email / SMS providers | no credentials, and the specification forbids acting without them | configure the provider on the production host and run the delivery test |
| an end-to-end run of a 550-procedure fleet | the procedures are unit-tested individually; a full sweep needs a seeded production-shaped database | run the sweep against a staging database |
| a penetration test | not performed | commission one |
| a dependency audit | not recorded here | `npm audit --production` in CI |

---

## 6. Reproducing this run

```bash
npm ci --no-audit --no-fund          # 850 packages, ~29s
npx tsx --test --experimental-test-module-mocks "tests/**/*.test.ts"
```

For a single suite:

```bash
npx tsx --test --experimental-test-module-mocks tests/ai-eos.test.ts
```

To reproduce the database suite you need a generated client and a
MySQL, which is what CI does:

```bash
npx prisma generate
DATABASE_URL="mysql://…" npm test
```
