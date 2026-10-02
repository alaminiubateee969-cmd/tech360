# TECH360 — SQLite → MySQL migration plan

Status: **MySQL schema and baseline are checked in; production migration NOT VERIFIED / NOT applied by this audit.**
Last updated: 2026-10-03

Validation evidence below is historical unless explicitly identified as current. The working tree now pins Prisma 6.19.3 and a scoped `deepmerge-ts` 8.0.2 override; local Prisma CLI engine downloads failed during TLS setup, and exact-commit CI has not run. The latest verified `main` run used Prisma 6.18.0 and failed at Typecheck.

---

## 1. Current state

| | |
|---|---|
| Prisma provider (before) | `sqlite` |
| Prisma provider (after) | `mysql` |
| Models | 43 |
| Enums | 0 (all enumerations are `String` + comment) |
| Raw SQL in application code | 1 statement — `SELECT 1` in `src/app/api/health/route.ts` (portable) |
| Production database | MySQL is the repository target; Hostinger database identity, host, server version, and connection are **NOT VERIFIED** |
| Production database size | **NOT VERIFIED** in this audit; the production database was not accessed |
| Production app status | **NOT VERIFIED**. Fresh 2026-10-03 apex/`www` DNS resolution succeeded; HTTPS homepage, health, and `www` probes failed TLS (curl exit 35 / HTTP `000`), while HTTP apex returned an empty reply (exit 52 / HTTP `000`). No application response was obtained. |

A Prisma client generated for SQLite cannot talk to MySQL: the query engine
emits a different SQL dialect and different type coercions. This was the root
blocker and is what this plan resolves.

---

## 2. Target state

```prisma
datasource db {
  provider = "mysql"
  url      = env("DATABASE_URL")
}
```

`DATABASE_URL` is supplied only by the server's `.env` / CI service config.
It is never committed, never printed, and never logged.

---

## 3. Incompatibilities found, and how each is handled

### 3.1 `String` silently becomes `VARCHAR(191)` — **data-loss class**

This is the single most dangerous difference. SQLite `TEXT` is unbounded;
Prisma's MySQL default for `String` is `VARCHAR(191)`. Any longer value is
**rejected** under `STRICT_TRANS_TABLES` or **silently truncated** without it.

Affected: 86 columns, including full HTML previews, markdown reports,
LLM prompts and responses, extracted document text, and every JSON-in-string
column.

Handling: `scripts/mysql-schema-map.json` declares an explicit native type
for each such column, applied by `scripts/convert-schema-to-mysql.mjs`.

| Bucket | MySQL type | Count | Used for |
|---|---|---|---|
| `LongText` | `LONGTEXT` (4 GiB) | 21 | HTML previews, article/report bodies, LLM input/output, workflow payloads, extracted text |
| `Text` | `TEXT` (64 KiB) | 64 | notes, descriptions, metadata, small JSON blobs, user agents, stack traces |
| `LongBlob` | `LONGBLOB` | 1 | `FileRecord.content` (document bytes) |

Columns that are `@id`, `@unique`, or referenced by `@@index` / `@@unique`
deliberately **stay** `VARCHAR(191)` so they remain indexable inside InnoDB's
key-length limit. Verified: no mapped long-text column participates in an index.

### 3.2 MySQL forbids literal `DEFAULT` on `TEXT`/`BLOB`/`JSON` — **breaking**

`ERROR 1101 (42000): BLOB, TEXT, GEOMETRY or JSON column '…' can't have a default value`

12 columns carry `@default("{}")` / `@default("[]")` and also need a text type.
Prisma emits these as literal defaults, which MySQL rejects. Since MySQL 8.0.13
the same value is legal written as an *expression*, which is also the form
Prisma introspects back.

Affected columns: `ScopeOfWork.content`, `Delivery.checklist`, `AiAgent.tools`,
`AiAgent.permissions`, `PromptTemplate.variables`, `Campaign.metrics`,
`Campaign.lessons`, `ContentAsset.content`, `ContentAsset.metrics`,
`ApprovalRequest.payload`, `AutomationLog.steps`, `N8nWorkflow.definition`.

**First attempt — expression defaults (rejected on evidence).** Since MySQL
8.0.13 the same value is legal written as an expression, so the converter
initially emitted `@default(dbgenerated("(_utf8mb4'{}')"))`. CI run
[36725454493](https://github.com/alaminiubateee969-cmd/tech360/actions/runs/36725454493)
proved this **applies correctly** — MySQL stored
`Delivery.checklist :: text :: default=[_utf8mb4'{}']` — but also proved it is
unusable: Prisma cannot read expression defaults back during introspection
([prisma/prisma#2600](https://github.com/prisma/prisma/issues/2600)), so
`migrate diff` re-emits the identical `ALTER TABLE … MODIFY … DEFAULT (…)`
forever. The schema would be permanently drifted and no migration could ever
be proven correct.

**Adopted — no database-level default.** The default is dropped from the
column and supplied at the call sites that previously relied on it. The stored
value is byte-for-byte identical, there is zero drift, and it works on MySQL
5.7, MySQL 8.x and MariaDB alike — so it does not depend on the production
engine version, which is still unverified.

Eight call sites relied on the database default and now pass it explicitly:

| Site | Field |
|---|---|
| `src/lib/journey.ts` ×3 | `Delivery.checklist = '{}'` |
| `src/app/api/webhooks/n8n/route.ts` | `AutomationLog.steps = '[]'` |
| `src/app/api/admin/approvals/[id]/decision/route.ts` | `AutomationLog.steps = '[]'` |
| `src/app/api/admin/content/generate/route.ts` | `ContentAsset.metrics = '{}'` |
| `prisma/seed.ts` | `N8nWorkflow.definition = '{}'` |
| `tests/database-workflows.test.ts` | `ScopeOfWork.content = '{}'` |

All other create/upsert sites already supplied the value; this was verified
field-by-field, and the MySQL CI typecheck enforces it from here on.

### 3.3 Other differences reviewed

| Area | SQLite | MySQL | Action |
|---|---|---|---|
| `Boolean` | `INTEGER` 0/1 | `TINYINT(1)` | handled by Prisma; 11 fields, no code change |
| `DateTime` | ISO-8601 text | `DATETIME(3)` | handled by Prisma; 109 fields. Values are timezone-normalised by the client — verify server `time_zone` after cutover |
| `Int` / `Float` | dynamic typing | `INT` / `DOUBLE` | 30 + 4 fields, no change |
| `Bytes` | `BLOB` | `LONGBLOB` | annotated explicitly |
| `BigInt` / `Decimal` / `Json` | — | — | not used (0 fields) |
| `@default(cuid())` | client-side | client-side | portable |
| `@default(now())` | `CURRENT_TIMESTAMP` | `CURRENT_TIMESTAMP(3)` | portable |
| `@updatedAt` | client-side | client-side | portable |
| autoincrement | not used (all ids are `cuid()`) | — | no `AUTO_INCREMENT` anywhere |
| Foreign keys | advisory unless pragma on | enforced by InnoDB | **stricter** — `db:verify` asserts every table is InnoDB |
| `@relation(references: [code])` | allowed | needs a unique index | `AiAgent.code` is `@unique` ✓ |
| Unique on nullable (`Payment.transactionId`) | multiple NULLs ok | multiple NULLs ok | equivalent |
| Composite indexes | unbounded | ≤ 3072 bytes | worst case here is 2 × `VARCHAR(191)` utf8mb4 = 1528 bytes ✓ |
| Case sensitivity | `BINARY` by default | `utf8mb4_*_ci` by default | **behaviour change**: string comparison and unique checks become case-insensitive. Affects `User.email`, `Client.clientId`, `Setting.key`, `Project.code`, etc. For email this is usually desirable; it is called out so it is a decision, not an accident |
| Raw SQL | `SELECT 1` | `SELECT 1` | portable, no change |

---

## 4. Migration strategy

The current production database size, existing tables, and Prisma migration
history are **NOT VERIFIED**. Do not assume that it is new, empty, or safe to
baseline. The checked-in `0_init` migration describes an empty schema.

1. **Generate/review** the baseline from the MySQL schema, never from a hand-written guess:
   `prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script`
   → `prisma/migrations/0_init/migration.sql`
2. **Assert** the baseline contains no `DROP TABLE` / `DROP DATABASE` / `TRUNCATE`.
3. **Prove** it against disposable MySQL 8 with `prisma migrate deploy` and a zero-drift `prisma migrate diff`. GitHub Actions uses only this disposable database.
4. **Before any production build that runs migrations**, an authorized operator must verify the Hostinger database identity, current schema/history, `DATABASE_URL` configuration, and a restorable backup. No production migration was run in this audit.
5. Restore the backup to an isolated MySQL instance. Compare the restored schema to the baseline and test the reviewed migration/resolution procedure there first.
6. Only after a recorded review and explicit approval may the production procedure be run. Stop if the schema or migration history differs from the reviewed expectation.

The disposable checks are configured in `.github/workflows/mysql-baseline.yml`
and `.github/workflows/ci.yml`. Neither workflow touches production. Repair
commit `78801e811df56d8ca84f5776717b73e9fa94f8cf` passed exact-commit CI run
37061731570, and MySQL baseline run 37061731386 also passed. The prior `main`
run used the earlier Prisma 6.18.0 dependency tree and failed at Typecheck.

### If the production database already contains tables

The `0_init` baseline assumes an empty schema. If an isolated restore shows
existing tables, do **not** run `migrate deploy` against production. On the
isolated restore, compare the actual schema to `prisma/schema.prisma` using
`prisma migrate diff --from-url "$RESTORED_DATABASE_URL" --to-schema-datamodel
prisma/schema.prisma --script`. Review every DDL difference. If and only if the
restored schema exactly matches the baseline, have the database owner approve
and test `prisma migrate resolve --applied 0_init` on that isolated copy first.
Never use `db push` or `migrate reset` against production.

---

## 5. Data preservation strategy

- Production is **never** the CI or test database. CI uses a throwaway MySQL service.
- Before a production migration, the database owner must verify Hostinger's available backup procedure, create a backup, and test restoration to an isolated instance. The Hostinger backup interface/procedure and any backup are **NOT VERIFIED** in this audit.
- GitHub Actions applies migrations only to disposable MySQL; it does not back up production. There is no supported SSH/VM deployment script or automatic backup/abort mechanism in the Hostinger path.
- Production migrations use forward-only `prisma migrate deploy` after the baseline has been reconciled and the backup/recovery plan has been approved. Never use `prisma db push`, `prisma migrate reset`, or destructive schema commands against production.

---

## 6. Recovery / rollback strategy

| Failure | Safe response |
|---|---|
| Hostinger build or runtime failure | Inspect the exact deployment commit and Hostinger logs. Use only Hostinger's verified redeploy/rollback capability or a reviewed Git revert to restore a known-good application commit; no automatic code rollback is implemented by this repository. |
| Migration failure | Stop further deployment. Do not assume the platform restored data or that the previous app can use the current schema. Preserve logs and follow the pre-reviewed recovery plan. |
| Data corruption suspected | Escalate to the database owner. Restore a verified backup only with explicit approval after confirming the recovery point and impact. |

Database rollback is deliberately **not** automatic. Restoring a live MySQL
backup can discard rows written after it was taken. Hostinger rollback,
backup/restore capabilities, and a tested recovery procedure are all **NOT
VERIFIED** in this audit; record and test them before production changes.

---

## 7. Validation checklist

| # | Check | Where | Evidence |
|---|---|---|---|
| 1 | Schema parses and validates as MySQL | Repair CI run 37061731570; Prisma 6.19.3 | ✅ exact repair-commit CI passed; local engine download remains blocked |
| 2 | Converter is deterministic and idempotent | `convert-schema-to-mysql.mjs --check` | ✅ local |
| 3 | No text column keeps a `DEFAULT` | grep gate | ✅ 0 remaining |
| 4 | Provider and `DATABASE_URL` scheme agree | Repair CI run 37061731570 | ✅ exact repair-commit CI passed |
| 5 | Baseline generated from the schema | run [36726223683](https://github.com/alaminiubateee969-cmd/tech360/actions/runs/36726223683) | ✅ 43 tables, 995 lines |
| 6 | Baseline is non-destructive | same run | ✅ 0 `DROP`/`TRUNCATE` |
| 7 | Baseline applies to a clean MySQL 8 | Repair CI run 37061731570, `prisma migrate deploy` | ✅ exact repair-commit CI passed against disposable MySQL 8.0 |
| 8 | Zero drift after apply | Repair CI run 37061731570, `migrate diff --exit-code` | ✅ exact repair-commit CI passed |
| 9 | Prisma client generates for MySQL | Repair CI run 37061731570 | ✅ exact repair-commit CI passed |
| 10 | Read-only integrity check on MySQL | Repair CI run 37061731570, `db:verify` | ✅ exact repair-commit CI passed; production DB remains unverified |
| 11 | Lint / typecheck / tests / build on MySQL | Repair CI run 37061731570 | ✅ all configured steps passed, including build, standalone assets, and production-start smoke |
| 12 | Production backup/restore procedure verified | Authorized Hostinger operator / hPanel | ⛔ **NOT VERIFIED** — no production DB or hPanel evidence |
| 13 | Isolated restore of the production dump | — | ⛔ blocked — no DB credentials |
| 14 | Migration tested against the restored copy | — | ⛔ blocked — no DB credentials |

### Applied type distribution (from the generated baseline)

| MySQL type | Columns |
|---|---|
| `VARCHAR(191)` | 287 (ids, codes, statuses, indexed columns) |
| `DATETIME(3)` | 109 |
| `TEXT` | 65 |
| `INTEGER` | 30 |
| `LONGTEXT` | 21 |
| `BOOLEAN` (`TINYINT(1)`) | 11 |
| `DOUBLE` | 4 |
| `LONGBLOB` | 1 |

Spot-check of the columns that a naive `provider = "mysql"` flip would have
silently capped at 191 characters:

```
`html`           LONGTEXT NOT NULL   -- full HTML client previews
`systemPrompt`   LONGTEXT NOT NULL   -- AI agent system prompts
`extractedText`  LONGTEXT NULL       -- full extracted document text
`payload`        LONGTEXT NOT NULL   -- approval payloads
`steps`          LONGTEXT NOT NULL   -- automation step logs
`definition`     LONGTEXT NOT NULL   -- n8n workflow JSON
`stack`          LONGTEXT NULL       -- error stack traces
`content`        LONGBLOB NULL       -- stored document bytes
```

Rows 1–11 are verified for repair commit `78801e811df56d8ca84f5776717b73e9fa94f8cf` by exact CI run 37061731570, using disposable MySQL only; they do not certify production. Items 12–14 require authorized production access, backup evidence, and isolated restore testing, none of which was available in this audit.

---

## 8. Validation/access limits

- Local Prisma CLI validation, generation, migration, and build checks remain blocked when the engine download from `binaries.prisma.sh` terminates during TLS setup. The exact repair-commit CI run 37061731570 passed these stages on disposable MySQL; the latest `main` run predates the Prisma 6.19.3 change and failed at Typecheck.
- Local `DATABASE_URL` is not configured, so no database connection was tested from this checkout. No production connection string was requested, copied, or used.
- Hostinger hPanel settings, production MySQL credentials/schema/history, backups, and runtime logs were not available. The production backup procedure and any restore capability therefore remain **NOT VERIFIED**.
- No production migration, database write, deployment, or rollback was performed as part of this audit.
