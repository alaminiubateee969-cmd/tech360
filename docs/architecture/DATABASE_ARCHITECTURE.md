# Database architecture

| | |
|---|---|
| **Document** | `docs/architecture/DATABASE_ARCHITECTURE.md` |
| **Owner** | Platform engineering, Tech360 |
| **Collection date** | 2026-10-19 |
| **Last verification** | 2026-10-19 (`tests/migration-parity.test.ts`, 14/14 passing) |
| **Access level** | Internal — engineering and Super Admin |
| **Version** | 1.0 |
| **Retention** | Retained for the life of the platform |

---

## 1. Shape

| | |
|---|---|
| Engine | MySQL 8 (InnoDB), utf8mb4 / utf8mb4_unicode_ci throughout |
| Access | Prisma ORM, `src/lib/db.ts` |
| Models | **69** |
| Migrations | **9** — `0_init` … `8_private_ai_platform` |
| Migration style | hand-written SQL, not generated |
| Drift check | `tests/migration-parity.test.ts` — every model must have matching DDL |
| Environment check | `npm run db:verify`, `npm run schema:check` |

### 1.1 Why the migrations are hand-written

`prisma generate` downloads its engine binaries from `binaries.prisma.sh`.
That host is **not reachable from the build environment** used for this
work, so the client could not be generated locally and the migrations
could not be produced by `prisma migrate dev`.

The migrations are therefore written by hand in the same SQL dialect the
schema uses, and `tests/migration-parity.test.ts` proves the two agree:
for every model in `prisma/schema.prisma` there must be a `CREATE TABLE`
with the same columns and indexes in the migration history. That test
currently passes 14/14.

This is a real constraint with a real cost: **the schema and the
migrations can only be validated in CI**, where the client is generated
and a MySQL service is started.

---

## 2. The model groups

### 2.1 The pre-existing business core (unchanged)

`Client`, `Lead`, `Project`, `Task`, `Invoice`, `Payment`, `Service`,
`Document`, `Conversation`, `Message`, `Appointment`, `Campaign`,
`Subscription`, `User`, `Session`, `Setting`, `Notification`, `AuditLog`,
`ErrorLog`, `WebhookEvent`, `n8nWorkflow`, `blogPost`, `newsletter…`,
`LeadStage`, `Service`, and the rest of the CRM surface.

**None of these were modified** by the AI work. The AI workforce reads
and writes the same records; it did not get its own copy of the CRM.

### 2.2 The AI workforce substrate (pre-existing)

| Model | Role |
|---|---|
| `AiAgent` | an agent: code, name, department, purpose, system prompt, tools, permissions, status, quota, `executionCount`, `successCount`, `failureCount`, `parentCode`, `level` |
| `AiAgentExecution` | one run: input, output, status, tokens, duration, error, metadata |
| `AiMemory` | the memory table — extended in this work (§3.2) |
| `PromptTemplate` | the prompt table — extended in this work (§3.1) |
| `KnowledgeDocument`, `KnowledgeChunk` | the RAG corpus |
| `AgentJob` | the one durable queue |
| `ApprovalRequest` | the approval queue |

### 2.3 The private model service (migration 8)

| Model | Role |
|---|---|
| `Skill` | a skill definition: id, version, status, handler, schemas, permissions, owner, department |
| `SkillVersion` | the version history of a skill |
| `SkillRun` | one skill execution: input, output, status, duration, error |
| `KnowledgeChunk` | a vector-indexed chunk with its embedding stored as JSON text |
| `KnowledgeIngestRecord` | the ingest audit: source, checksum, chunk count, status |
| `ModelDeployment` | a local model deployment record: provider, model, revision, checksum, health |
| `WorkflowDefinition` | a persisted workflow diagram: nodes, edges, status, version |

`AgentJob.agentCode` was made **nullable** so that skill and workflow
work — which is not owned by an LLM agent — can use the **same** durable
queue. The foreign key is preserved: a `NULL` reference satisfies it, and
every existing `INFERENCE` job keeps its agent. **No row is rewritten.**

### 2.4 The AI-EOS substrate (migration 8, second half)

| Model | Key columns | Purpose |
|---|---|---|
| `Sop` | `key`, `departmentCode`, `category`, `level`, `version`, `status`, `owner`, `trigger`, `steps` (JSON), `decisionPoints` (JSON), `tools` (JSON), `inputs` (JSON), `validation` (JSON), `output`, `failurePath`, `escalation`, `requiresApproval` | the 550 procedures |
| `SopRun` | `sopKey`, `status`, `stepIndex`, `totalSteps`, `inputs` (JSON), `transcript` (JSON), `output`, `error`, `correlationId` | one execution of a procedure |
| `AgentDelegation` | `requestingAgent`, `targetAgent`, `kind`, `task`, `objective`, `context`, `priority`, `deadline`, `permissions`, `expectedOutput`, `status`, `result`, `correlationId` | the collaboration contract |
| `AgentEvent` | `type`, `source`, `payload` (JSON), `severity`, `correlationId` | the event bus record |
| `KnowledgeEntity` | `key` (unique), `name`, `type`, `description`, `accessLevel`, `confidence`, `properties` (JSON), `source`, `version`, `verified` | a graph node |
| `KnowledgeRelation` | `fromKey`, `toKey`, `type`, `weight`, `confidence`, `provenance`, `accessLevel`, `version` | a typed, sourced, weighted edge |

`KnowledgeEntity` and `KnowledgeRelation` are in a **cascade** pair: a
relation is removed with its entity, so the graph cannot hold an edge to a
node that does not exist. `fromKey`/`toKey` reference the entity's
`key`, not its `id`, so the edge survives a re-import of the node.

---

## 3. What changed in the existing AI tables

### 3.1 `PromptTemplate` — 12 retrieval columns

The prompt library is 70,400 slots, so the runtime must **retrieve**
rather than load. The retriever scores on these columns:

| Column | Type | Why |
|---|---|---|
| `stage` | `String` (default `TASK_EXECUTION`) | which of the 16 execution stages the prompt serves |
| `priority` | `Int` (default 5) | standing preference between otherwise equal candidates |
| `quality` | `Float` (default 0.5) | the measured quality of the prompt |
| `language` | `String` (default `en`) | `en` or `bn` |
| `version` | `String` (default `1.0.0`) | the prompt version |
| `role` | `String?` | the role archetype it serves |
| `departmentCode` | `String?` | the department it serves |
| `skillCode` | `String?` | the skill it binds to |
| `sopKey` | `String?` | the procedure it binds to |
| `tags` | `String?` (LongText) | the tags the retriever matches against the task terms |
| `status` | `String` (default `ACTIVE`) | `DRAFT` / `ACTIVE` / `RETIRED` |
| `usageCount`, `successCount` | `Int` | the measured usage |

The change is **additive with defaults**, so no existing prompt row is
rewritten.

### 3.2 `AiMemory` — 9 memory-system columns

| Column | Type | Why |
|---|---|---|
| `memoryType` | `String` (default `SEMANTIC`) | `WORKING` / `EPISODIC` / `SEMANTIC` / `PROCEDURAL` |
| `accessLevel` | `String` (default `INTERNAL`) | `PUBLIC` / `INTERNAL` / `CONFIDENTIAL` / `RESTRICTED` — who may read it |
| `departmentCode` | `String?` | the enterprise scope that owns it |
| `version` | `Int` (default 1) | the revision number, incremented on every write |
| `validated` | `Boolean` (default false) | whether a human has confirmed it |
| `source` | `String` (default `PLATFORM`) | `PLATFORM` / `AGENT` / `HUMAN` / `LEARNING_ENGINE` |
| `expiresAt` | `DateTime?` | when it stops being valid |
| `correlationId` | `String?` | the run that produced it |
| `tags` | `String?` (LongText) | the tags that make it retrievable |

New indexes: `(scope, memoryType)`, `(accessLevel)`, `(departmentCode)`.

### 3.3 `AgentJob` — one nullable column

`agentCode` became nullable. That is the **only** schema change that
touches an existing table with existing rows, and it is safe: a `NULL`
reference satisfies the foreign key, and every existing `INFERENCE` job
already has an agent.

---

## 4. Indexing strategy

| Query | Index |
|---|---|
| claim the next job | `(status, availableAt, createdAt)` |
| reclaim an expired lease | `(status, leaseUntil)` |
| the jobs of one agent | `(agentCode, createdAt)` |
| the jobs of one client | `(clientId, createdAt)` |
| the jobs of one project | `(projectId, createdAt)` |
| a job by its correlation id | `correlationId` (unique) |
| a job by its idempotency key | `idempotencyKey` (unique) |
| the memory of a scope and type | `(scope, memoryType)` |
| the memory a caller may read | `(accessLevel)` |
| the graph node by key | `key` (unique) |
| the graph edge | `(fromKey, toKey, type)` (unique) + `(toKey, type)` |
| the event history by type | `(type, createdAt)` |
| the event history by source | `(source, createdAt)` |
| the delegation history | `(requestingAgent, createdAt)` + `(targetAgent, createdAt)` |
| the procedure runs | `(sopKey, createdAt)` |

---

## 5. Data-safety rules

| Rule | Where it is enforced |
|---|---|
| No student or client record enters a shared global index without authorisation | the `accessLevel` on every memory and every knowledge entity; the access filter is applied in the query **and** in the application |
| Training and evaluation data are separate | `evals/tech360-eval-v1.json` is not ingested into the knowledge store |
| A record is written once its duplicate check has passed | `record.dedupe_key` skill, and the `crm.dedupe` tool |
| Every write carries a correlation id | the `correlationId` column on `AgentJob`, `AiAgentExecution`, `SopRun`, `AgentEvent`, `AgentDelegation`, `AiMemory` |
| Nothing is deleted destructively without a human | `ALWAYS_HUMAN_ACTIONS` → `IRREVERSIBLE_DELETION` |

---

## 6. Referential integrity

- `AiAgentExecution.agentCode → AiAgent.code`, **cascade delete**: an
  agent's history goes with the agent.
- `AgentJob.agentCode → AiAgent.code`, **restrict delete**: a job that
  references an agent blocks the agent's deletion, so the execution
  record cannot be orphaned.
- `KnowledgeRelation.fromKey/toKey → KnowledgeEntity.key`, **cascade
  delete**: an edge cannot outlive its node.
- `AiMemory.clientId → Client.id`, **cascade delete**: a client's memory
  goes with the client.
- `KnowledgeDocument` / `KnowledgeChunk` cascade with their document.

There are no orphaned records by construction, and the seed's workforce
bindings and structural graph are written with the same upsert
semantics, so the seed is idempotent.

---

## 7. The backup and restore gate

**This gate is not met.** The Backup & Recovery page reports
`NO_ARTIFACTS` and `restoreEvidence.proven === false`.

What exists: the `adminBackupState()` function in
`src/app/api/admin/backup/route.ts` reports the true state of the
backup directory, the artefact list and the restore evidence. What does
**not** exist: a verified backup artefact and an isolated restore that
was actually performed.

Until that is done, the platform is **ready for a staging release, not a
public production release**. See `docs/deployment/ROLLBACK_GUIDE.md` and
`docs/testing/RESTORE_TEST_RESULTS.md`.
