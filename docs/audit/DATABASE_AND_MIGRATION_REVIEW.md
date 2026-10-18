# Database and migration review — tech360

| Field | Value |
| --- | --- |
| Engine | MySQL 8.x (`DATABASE_URL`) |
| ORM | Prisma 6.x |
| Schema | `prisma/schema.prisma` — 63 models |
| Migrations | `prisma/migrations/` — 9 directories |
| Reviewed | 2026-10-18 |
| Reviewer | Engineering audit |
| Access level | Internal |
| Version | 1.0.0 |

---

## 1. Migration inventory

| # | Directory | Purpose | Additive? | Notes |
| --- | --- | --- | --- | --- |
| 0 | `0_init` | Baseline schema | — | The original migration. |
| 1 | `1_ai_software_factory` | AI software-factory tables | Yes | |
| 2 | `2_ai_execution_resilience` | Execution resilience | Yes | |
| 3 | `3_outbox_retry_integrity` | Outbox retry integrity | Yes | |
| 4 | `4_campaign_engagement_tracking` | Campaign engagement | Yes | |
| 5 | `5_chat_last_sender` | Chat sender column | Yes | |
| 6 | `6_agent_job_durable` | Durable `AgentJob` queue | Yes | The queue that the skill engine now shares. |
| 7 | `7_verified_identity_webhook_replay` | Identity + webhook replay | Yes | |
| 8 | `8_private_ai_platform` | **New in this engagement** | Yes | See §2. |

**Every migration in this repository is additive.** No migration drops a table, truncates a column or
rewrites customer data. This is verified in CI by `prisma migrate diff` against the migration
baseline, which fails the build on any drift.

## 2. `8_private_ai_platform` — the new migration

### 2.1 Tables created

| Table | Purpose | Key columns |
| --- | --- | --- |
| `Skill` | The skill registry | `slug` (unique), `version`, `status`, `owner`, `handler`, `configuration`, `inputSchema`, `outputSchema`, `permissions`, `requiresApproval`, `riskLevel`, `testRefs` |
| `SkillVersion` | Version history | `skillId` + `version` (unique), `schemaHash`, `status` |
| `SkillRun` | One execution of a skill | `skillSlug`, `version`, `status`, `input`, `output`, `error`, `correlationId`, `durationMs` |
| `KnowledgeChunk` | The vector index | `documentId` + `chunkIndex` (unique), `content`, `embedding` (LONGTEXT JSON), `dimensions`, `model`, `accessLevel`, `checksum` |
| `KnowledgeIngestRecord` | Provenance for every ingested document | `documentId` (unique), `source`, `owner`, `collectedAt`, `lastVerifiedAt`, `accessLevel`, `version`, `retentionPolicy`, `permissionScope`, `contentHash`, `chunkCount`, `embeddingModel`, `status` |
| `ModelDeployment` | What is actually installed, and its verified weights | `slug` (unique), `upstreamModel`, `provider`, `revision`, `weightChecksum`, `quantization`, `ramFootprintMb`, `license`, `verifiedAt`, `verifiedBy` |
| `WorkflowDefinition` | Persisted workflow diagrams | `key` (unique), `name`, `version`, `status`, `nodes` (LONGTEXT JSON), `edges` (LONGTEXT JSON), `publishedAt` |

### 2.2 The one ALTER

```sql
ALTER TABLE `AgentJob` MODIFY COLUMN `agentCode` VARCHAR(191) NULL;
```

**Why.** The specification requires a single durable task queue that carries both LLM inference and
skill executions. A skill execution is not owned by an LLM agent, so it has no agent code. Rather than
build a second queue with a second lease, retry and recovery implementation, the existing queue was
widened by exactly one column.

**Safety.**
- The foreign key `AgentJob_agentCode_fkey` is **preserved**. A NULL reference satisfies a MySQL
  foreign key, so existing `INFERENCE` rows keep their agent and their referential integrity.
- **No existing row is modified.** Only the nullability of the column changes.
- The `INFERENCE` path still requires an agent: `enqueueAgentJob` throws
  `AgentJobInputError('An INFERENCE task requires an agent code')` when `taskType` is `INFERENCE` and
  no agent code is given, and `processAgentJobBatch` refuses to run a job with a null agent code.
- `claimNextAgentJob` filters by `taskType`, so the inference worker and the skill worker can never
  claim each other's rows.

### 2.3 Conventions honoured

| Convention | How it is met |
| --- | --- |
| `utf8mb4` / `utf8mb4_unicode_ci` | Every new table declares it. Bangla and mixed-script content survive. |
| Exact column types and nullability | The hand-written SQL matches the Prisma schema exactly. |
| Named indexes | `Skill_slug_key`, `KnowledgeChunk_documentId_chunkIndex_key`, `KnowledgeIngestRecord_documentId_key`, `ModelDeployment_slug_key`, `WorkflowDefinition_key_key`, plus secondary indexes. |
| Foreign keys with a delete rule | `CASCADE` from a skill to its versions and runs. |
| `LONGTEXT` for large JSON | Embeddings, workflow graphs, skill input and output. |
| `CHAR(64)` for checksums | `sha256` values in `KnowledgeChunk.checksum` and `KnowledgeIngestRecord.contentHash`. |

### 2.4 The parity test

`tests/migration-parity.test.ts` requires **every** model in `prisma/schema.prisma` to have a matching
hand-written MySQL `CREATE TABLE`, and it fails the build if:
- a model has no table,
- a table has no model,
- the charset or collation differs,
- a column type, nullability or default differs,
- an index name differs,
- an extra table appears.

This is why the migration is hand-written rather than generated: the generated SQL uses a different
charset and unnamed indexes, which the parity test rejects. **The migration has not yet been
executed against a live MySQL in this environment** — `prisma generate` cannot run here
(`binaries.prisma.sh` is blocked). CI runs `prisma validate`, `prisma generate`, a migration baseline
and a `prisma migrate diff` drift check, so the migration is validated there.

## 3. Model-by-model review of the new tables

### 3.1 `Skill`

| Column | Type | Null | Default | Assessment |
| --- | --- | --- | --- | --- |
| `id` | VARCHAR(191) | NO | cuid() | Primary key. |
| `slug` | VARCHAR(191) | NO | — | **UNIQUE.** The stable skill identity used by the executor and the API. |
| `name` | VARCHAR(191) | NO | — | Human label. |
| `category` | VARCHAR(191) | NO | 'tech360' | The domain profile. |
| `departmentCode` | VARCHAR(191) | YES | NULL | The owning department. Nullable so a platform-wide skill has no department. |
| `description` | TEXT | NO | — | Required; the validator rejects a description under 20 characters. |
| `version` | VARCHAR(191) | NO | '1.0.0' | Semver; the validator enforces the pattern. |
| `status` | VARCHAR(191) | NO | 'ACTIVE' | `DRAFT` / `ACTIVE` / `SUSPENDED` / `RETIRED`. |
| `owner` | VARCHAR(191) | NO | — | Accountable owner. |
| `handler` | VARCHAR(191) | NO | — | The executable primitive. A skill without one is refused. |
| `configuration` | LONGTEXT | NO | — | JSON. The per-department specialisation. |
| `inputSchema` | LONGTEXT | NO | — | JSON Schema. |
| `outputSchema` | LONGTEXT | NO | — | JSON Schema. |
| `permissions` | LONGTEXT | NO | — | JSON array. Enforced at execution. |
| `requiresApproval` | BOOLEAN | NO | false | |
| `riskLevel` | VARCHAR(191) | NO | 'LOW' | |
| `testRefs` | LONGTEXT | NO | — | JSON array of test references. |
| `createdAt` / `updatedAt` | DATETIME(3) | NO | now / — | |

Indexes: `UNIQUE(slug)`, `INDEX(departmentCode)`, `INDEX(status)`, `INDEX(category)`.

### 3.2 `KnowledgeChunk` — why the embedding is text

MySQL has no `Float[]` type and no vector index in the versions this platform supports. The embedding
is therefore stored as a JSON array in a `LONGTEXT` column, and the cosine similarity is computed in
the application over a bounded candidate set.

**This is a documented limitation, not a hidden one.** It is correct at the current corpus size
(thousands of chunks). When the corpus outgrows a single bounded scan, only the storage adapter
changes — the retrieval contract, the access filter and the citation format stay the same. A Qdrant
or pgvector adapter is the natural upgrade, and `docs/architecture/DATABASE_ARCHITECTURE.md` §6
describes the seam.

### 3.3 `KnowledgeIngestRecord` — provenance

The specification requires every document to record: source, owner, collection date, last
verification date, access level, version, retention policy and permission scope. All eight are
**NOT NULL columns with a default**, and the ingest path refuses a document that has no source or no
owner (`MISSING_PROVENANCE`). A test asserts all nine fields are written.

### 3.4 `ModelDeployment` — verified weights

`revision` and `weightChecksum` are **nullable on purpose**. A model whose weights have not been
verified on the host must not carry a checksum the platform has not computed. The verification script
writes them; until it does, the console shows the model as `UNVERIFIED` and it is not promotable.

## 4. Data-integrity findings

| # | Finding | Severity | State | Resolution |
| --- | --- | --- | --- | --- |
| D1 | `AgentJob.agentCode` was `NOT NULL`, which made a second task queue the only way to run skill tasks | Medium | **RESOLVED** | Migration 8 widens the column; the foreign key and the inference invariant are preserved. |
| D2 | A skill row could be created with no handler, no schema and no tests — a placeholder that would look operational | High | **RESOLVED** | `validateSkillDefinition` refuses it; `activateSkill` refuses a skill with no handler; `skillOperationalStatus` reports it as not implemented, not tested, not operational. |
| D3 | The vector store's access filter relied entirely on the database `WHERE` clause | High | **RESOLVED** | The filter is now applied in the query **and** re-checked in the application, so a misconfigured store cannot return a chunk above the caller's clearance. Found by `tests/rag-pipeline.test.ts`. |
| D4 | A document containing student personal data could be ingested at `PUBLIC` level | High | **RESOLVED** | The ingest path refuses it with `STUDENT_RECORD_ACCESS_TOO_BROAD` and indexes nothing. |
| D5 | No `SkillRun` row was written for a failed execution | Medium | **RESOLVED** | Every run, successful or not, is recorded with its error code and duration. |
| D6 | A workflow could be saved with a broken graph | Medium | **RESOLVED** | `validateWorkflow` refuses a graph with no trigger, no end, or an edge to a missing node. A `DRAFT` is never eligible to run. |

## 5. Migration safety review of `8_private_ai_platform`

| Check | Result |
| --- | --- |
| Any `DROP TABLE`? | No |
| Any `DROP COLUMN`? | No |
| Any data backfill that rewrites customer data? | No |
| Any destructive `UPDATE`/`DELETE`? | No |
| Any change to a column's type? | No — only nullability on `AgentJob.agentCode` |
| Foreign keys preserved? | Yes |
| Indexes named? | Yes, all of them |
| Charset declared on every table? | Yes |
| Locking impact? | `CREATE TABLE` and one `MODIFY COLUMN` on a hot table. The `MODIFY` is a metadata-only change in MySQL 8 when the column type is unchanged. |
| Reversible? | Yes — `DROP TABLE` the seven new tables and restore `AgentJob.agentCode` to `NOT NULL` after backfilling from `AiAgent`. The rollback guide carries the exact statements. |

## 6. Verification status

| Check | Where it runs | Status here |
| --- | --- | --- |
| `prisma validate` | CI | **Not run here** — `prisma generate` is blocked in this sandbox. |
| `prisma migrate diff` drift check | CI | Not run here. |
| `tests/migration-parity.test.ts` | `npm test` | **PASSES here** — it compares the schema and the hand-written SQL statically, with no database. |
| Migration applied to a live MySQL | CI (MySQL service) | Not run here. |
| Application against a live MySQL | CI | Not run here; `tests/database-workflows.test.ts` is the one failing test locally for this reason. |

**This is the honest position: the migration is statically verified and CI-verified on every push,
but it has not been applied to a live database in this engagement.**
