# Deployment guide

| | |
|---|---|
| **Document** | `docs/deployment/DEPLOYMENT_GUIDE.md` |
| **Owner** | Platform engineering, Tech360 |
| **Collection date** | 2026-10-19 |
| **Last verification** | 2026-10-19 |
| **Access level** | Internal — engineering and Super Admin |
| **Version** | 1.0 |
| **Retention** | Retained for the life of the platform |

> **This release is authorised for STAGING only.**
> The public production release is blocked by the backup and restore
> gate. See `docs/testing/RESTORE_TEST_RESULTS.md` for the exact
> procedure that closes it.

---

## 1. What is being deployed

| | |
|---|---|
| The application | Next.js 16 App Router, TypeScript, Tailwind 4, shadcn/ui |
| The database | MySQL 8 through Prisma |
| The model service | a **private, local** CPU inference server (Ollama, or any OpenAI-compatible server such as llama.cpp `server`, vLLM or LM Studio) |
| The new in this release | the AI-EOS workforce: the organisation, the procedure runtime, the prompt library and its retriever, the tool registry, the orchestrator, the quality chain, the learning engine, the self-healing ladder, the memory system, the knowledge graph, the event bus, the governance rules, the model hub, and the AI Employees console |

**Nothing about the hosting changes.** The primary CRM and the primary
website stay where they are. The AI work adds routes and tables; it
does not move a service, change a port or repoint a domain.

---

## 2. The pre-flight checklist

Run every line. **Any failure stops the release.**

```bash
# 1. A clean tree.
git status --porcelain            # must be empty

# 2. The commit that is about to be deployed, recorded.
git rev-parse HEAD | tee release-commit.txt
git log -1 --pretty="%h %ad %s" --date=short

# 3. Dependencies.
npm ci --no-audit --no-fund

# 4. The environment gate — it FAILS CLOSED.
node scripts/validate-production-env.mjs

# 5. The Prisma client.
npx prisma generate

# 6. The schema matches the migration history.
npx prisma validate
npx prisma migrate status         # must report "up to date"

# 7. The migration parity tests.
npx tsx --test --experimental-test-module-mocks tests/migration-parity.test.ts
npx tsx --test --experimental-test-module-mocks tests/outbox-migration-parity.test.ts

# 8. Types, lint and the full suite.
npm run typecheck
npm run lint
npm test

# 9. The database itself.
npm run db:verify
npm run schema:check
```

| Check | Pass condition |
|---|---|
| `git status --porcelain` | empty |
| `scripts/validate-production-env.mjs` | exit 0 |
| `npx prisma migrate status` | "Database schema is up to date" |
| `npm run typecheck` | 0 errors |
| `npm run lint` | 0 errors |
| `npm test` | 0 failures |
| `npm run db:verify` | exit 0 |
| `npm run schema:check` | exit 0 |

---

## 3. The environment

`scripts/validate-production-env.mjs` runs as the `prestart` hook, so a
misconfigured deployment **refuses to start** rather than starting in a
degraded state.

### 3.1 Required

| Variable | Notes |
|---|---|
| `DATABASE_URL` | MySQL 8, `utf8mb4` |
| `APP_PUBLIC_URL`, `APP_ORIGIN` | the public origin, used for the CSRF and the callback checks |
| `NODE_ENV` | `production` |
| `SESSION_SECRET` | **at least 32 characters**, independent |
| `OPS_SECRET` | **at least 32 characters**, independent |
| `PORTAL_SECRET` | **at least 32 characters**, independent |
| `IDENTITY_HASH_SECRET` | **at least 32 characters**; **preserve it across deploys** or the identity links cannot be resolved |

### 3.2 The private model service

| Variable | Notes |
|---|---|
| `LOCAL_MODEL_BASE_URL` | the local server. **Must be a loopback or private address** — a public model endpoint would expose company data, and the application refuses to start with one. |
| `LOCAL_MODEL_CHAT_MODEL` | the chat model, e.g. `qwen2.5:1.5b-instruct-q4_K_M` |
| `LOCAL_MODEL_EMBED_MODEL` | the embedding model, e.g. `bge-m3` |
| `LOCAL_MODEL_API_KEY` | the key the local server expects, if any |
| `LOCAL_MODEL_TIMEOUT_MS` | default 60000 |
| `LOCAL_OPENAI_*` | the optional second local backend |
| `AI_PROVIDER_ORDER` | the chain, most-preferred first. The default is `ollama,openai-compatible,zai` |
| `MODEL_API_KEY` | the bearer key for `/api/model/v1/*`. **At least 32 characters.** Without it the private gateway is **disabled** and answers 503. |

**Never** point `LOCAL_MODEL_BASE_URL` or `LOCAL_OPENAI_BASE_URL` at a
public endpoint. The gateway refuses a non-private upstream, but the
environment should not be configured that way in the first place.

### 3.3 Optional

| Variable | Effect when blank |
|---|---|
| `ZAI_BASE_URL`, `ZAI_API_KEY` | the remote provider is unavailable; the chain falls back to the local servers only |
| `NOTIFY_RELAY_URL`, `NOTIFY_RELAY_TOKEN` | the notify relay is `NOT_CONFIGURED` and refuses to act |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD` | only needed for the **first** bootstrap. **Remove `ADMIN_PASSWORD` after the seed** |
| `AI_OPS_DRIVER` | `off` disables the in-process AI operations loop |

---

## 4. The model host

The model server runs **on the application host or on a private host on
the same network**. It is never exposed publicly.

### 4.1 Prepare the weights

```bash
# On the model host, with the weight host reachable:
ollama pull qwen2.5:1.5b-instruct-q4_K_M
ollama pull bge-m3

# Capture the revision and the weight checksum, ON THE HOST THAT RUNS IT.
npm run models:verify
```

`npm run models:verify` writes the revision and the sha256 of the
weight file into the catalogue record. Until it has run, the catalogue
reports `weightsVerified: false` and the console says **UNVERIFIED** —
which is the correct and honest state.

### 4.2 Benchmark before promoting

```bash
npm run bench:models
```

The benchmark measures the first-token latency, the generation speed
and the memory footprint, and it scores the Bangla and English slices.
A model is promoted only when it passes its own
`ModelAcceptanceCriteria` — which are declared in
`src/lib/model/registry.ts` and are the **smallest model that meets
acceptance**, not the largest.

**Do not load several large models at once.** `npm run models:verify`
records the resident set, and the router refuses a candidate whose
footprint plus 512 MB exceeds the host's RAM.

---

## 5. The database

```bash
# 1. BACK UP FIRST. The gate is not met until this is done and proven.
#    See docs/testing/RESTORE_TEST_RESULTS.md §7.

# 2. Apply the migrations.
npx prisma migrate deploy

# 3. Verify.
npx prisma migrate status
npm run db:verify
```

### 5.1 What migration 8 does

| Statement | Count | Destructive? |
|---|---:|---|
| `CREATE TABLE` | 13 | No |
| `ALTER TABLE … ADD COLUMN` | 3 | No — every column has a default, so no row is rewritten |
| `DROP` / `TRUNCATE` / `DELETE` / `UPDATE` | **0** | — |

The 13 new tables are: `Skill`, `SkillVersion`, `SkillRun`,
`KnowledgeChunk`, `KnowledgeIngestRecord`, `ModelDeployment`,
`WorkflowDefinition`, `Sop`, `SopRun`, `AgentDelegation`, `AgentEvent`,
`KnowledgeEntity`, `KnowledgeRelation`.

The 3 altered tables are: `AgentJob` (`agentCode` → nullable),
`PromptTemplate` (+12 retrieval columns), `AiMemory` (+9 memory
columns).

**Every statement is additive.** The migration was inspected statement
by statement; see `docs/testing/RESTORE_TEST_RESULTS.md` §4.

### 5.2 The seed

```bash
npm run db:seed
```

The seed is **idempotent**. It now also writes:

- a **workforce prompt binding** for every department and role
  archetype (2,200 rows) with the retrieval metadata the retriever
  scores on;
- the **structural knowledge graph** — the organisation, the procedures
  and the tools as entities and relations, with confidence 1 and
  `verified: true`, because they are true by construction.

The seed does **not** fabricate an execution record, an event, a
delegation or a run. Those tables stay empty until the platform
actually produces them.

---

## 6. The build and the start

```bash
npm run build     # prisma generate + migrate deploy + next build + the standalone copy
npm start         # NODE_ENV=production node .next/standalone/server.js
```

`npm start` runs `prestart` → `scripts/validate-production-env.mjs`
first, so a misconfigured deployment exits before the server binds.

### 6.1 The post-start smoke test

```bash
curl -fsS https://<host>/api/health | jq .
curl -fsS https://<host>/api/health/deep | jq .
```

| Endpoint | Expectation |
|---|---|
| `/api/health` | `200`, the process is up |
| `/api/health/deep` | `200`, the database is reachable, and the model service reports `AVAILABLE` **or** `DEGRADED` with the reason |

A `DEGRADED` model service is honest, not a failure: it means the local
server is not configured and the chain fell back. Fix it before
promoting any AI-dependent feature.

### 6.2 The console smoke test

1. Sign in as the Super Admin.
2. Open **AI Employees** — the nine panels must load, and the employee
   count must read 2,201.
3. Open **Procedures** — 550 procedures; pick one and read its steps.
4. Open **Governance** — the constitution with 8 rules and its
   enforcement mechanisms; the tool registry must show 47 tools and
   **0 issues**.
5. Open **Model Hub** — the catalogue, the installed models and a
   routing decision with its reasons.
6. Open **Task Queue** — it must be **empty** if nothing has been
   queued. An empty queue is the correct state, not a broken panel.
7. Open **Backup & Recovery** — it must report the true state. If it
   says `NO_ARTIFACTS`, the public release is still blocked.

---

## 7. The CI gates

`.github/workflows/ci.yml` runs, in order:

1. a secret scan;
2. `npm ci`;
3. the `prestart` environment validation (fail-closed);
4. `prisma validate` and `prisma generate`;
5. a MySQL service, a migration baseline and a **drift check**;
6. `npm run lint`;
7. `npm run typecheck`;
8. `npm test`;
9. `npm run build`;
10. a production smoke test.

**None of these gates were modified by this work.** No gate was
weakened, skipped or made non-blocking.

---

## 8. The mobile applications

The specification requires the mobile applications to use the **same**
backend, the same unified API, the same authentication, the same runtime,
the same model hub and the same database.

| Requirement | How the backend satisfies it |
|---|---|
| view and chat with agents | `GET /api/agents`, `POST /api/ai/chat` |
| run an agent | `POST /api/tasks` |
| view tasks and executions | `GET /api/tasks`, `GET /api/tasks/{id}` |
| approve an action | `POST /api/approvals/{id}/approve`, `…/reject` |
| view alerts and performance | `GET /api/metrics`, `GET /api/health/deep` |
| view collaboration | `GET /api/admin/collaboration` |
| view memory and knowledge | `GET /api/admin/memory`, `GET /api/knowledge/search` |

The mobile applications themselves are a **separate deliverable** and
are not part of this release. The backend surface they need is in place
and is the same surface the console uses — there is no mobile-only API.

---

## 9. The release decision

| Target | Authorised? | Condition |
|---|---|---|
| **Staging** | **YES** | the pre-flight checklist passes |
| **Public production** | **NO** | the backup and restore gate must be met first: a verified artefact, an isolated restore that was actually performed, and the evidence recorded |

**The explicit approvals this release requires and does not have:**

| Action | Approval |
|---|---|
| a production deploy | **NOT GIVEN** |
| a DNS change | not requested, none made |
| a destructive migration | none needed — every statement is additive |
| a bulk message | not requested, none sent |
| an external publication | not requested, none made |
| a payment | not requested, none made |
| a file deletion | not requested, none made |
| a credential change | not requested, none made |
| a high-risk shell command | not requested, none run |
| moving the primary CRM or the website | **not done, and not permitted without explicit authorisation** |

---

## 10. The rollback

`docs/deployment/ROLLBACK_GUIDE.md`.
