# TECH360 — SQLite → MySQL migration plan

Status: **migration prepared, NOT applied to production.**
Last updated: 2026-09-30

---

## 1. Current state

| | |
|---|---|
| Prisma provider (before) | `sqlite` |
| Prisma provider (after) | `mysql` |
| Models | 43 |
| Enums | 0 (all enumerations are `String` + comment) |
| Raw SQL in application code | 1 statement — `SELECT 1` in `src/app/api/health/route.ts` (portable) |
| Production database | `u394009794_bdtech360` (MySQL, Hostinger) |
| Production database size | ~1 MB, created 2026-09-30 |
| Production app status | **not serving** — `https://bdtech360.com/` returns `403`, `/api/health` returns the Hostinger static 404 page |

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

The production database is **new and effectively empty** (~1 MB, created the
same day). It has no trustworthy Prisma migration history. Therefore:

1. **Generate** a baseline from the MySQL schema, never from a hand-written guess:
   `prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script`
   → `prisma/migrations/0_init/migration.sql`
2. **Assert** the baseline contains no `DROP TABLE` / `DROP DATABASE` / `TRUNCATE`.
3. **Apply** it to a disposable MySQL 8 service with `prisma migrate deploy`
   — the same command production runs.
4. **Prove zero drift**: `prisma migrate diff --from-url <ci db> --to-schema-datamodel` must be empty.
5. **Run** the full suite (generate, lint, typecheck, tests, integrity, build) on MySQL.
6. Only then consider production.

This is automated in `.github/workflows/mysql-baseline.yml` and enforced on
every push by the `ci` job in `.github/workflows/deploy-production.yml`.

### If the production database already contains tables

The 0_init baseline assumes an empty schema. If preflight shows existing
tables, do **not** apply it. Instead baseline against reality:

```
prisma migrate diff --from-url "$DATABASE_URL" --to-schema-datamodel prisma/schema.prisma --script
```

review the resulting DDL by hand, and register the already-present state with
`prisma migrate resolve --applied 0_init`. Never `db push`, never `migrate reset`.

---

## 5. Data preservation strategy

- The production database is **never** the CI or test database. CI uses a
  throwaway `tech360_ci`.
- `scripts/deploy-hostinger.sh` takes an engine-aware backup **before** any schema
  change: `mysqldump --single-transaction --quick --routines --triggers --events`.
- The dump is verified three ways: file exists, file is non-empty, and the
  `Dump completed` trailer is present. A zero exit code alone is not accepted.
- If no verified backup is produced, the deploy **aborts before migrating**.
- `prisma db push` and `prisma migrate reset` are removed from `package.json`
  and explicitly refused by the deploy script.

---

## 6. Rollback strategy

| Failure | Action |
|---|---|
| Build / health check fails | automatic: code reverts to `last-good-commit.txt`, app restarts on the same port |
| Migration fails | deploy aborts **before** restart; previous release keeps serving |
| Data corruption suspected | **manual, operator-approved only** — restore the verified pre-deploy dump |

Database rollback is deliberately **not** automatic. Overwriting a live MySQL
database discards every row written after the dump was taken, so it is itself a
destructive act. The deploy script prints the verified dump path and the exact
restore command, and stops.

---

## 7. Validation checklist

| # | Check | Where | Evidence |
|---|---|---|---|
| 1 | Schema parses and validates as MySQL | `prisma-schema-wasm` 6.18.0 (engine `34b5a69`), offline | ✅ local |
| 2 | Converter is deterministic and idempotent | `convert-schema-to-mysql.mjs --check` | ✅ local |
| 3 | No text column keeps a `DEFAULT` | grep gate | ✅ 0 remaining |
| 4 | Provider and `DATABASE_URL` scheme agree | CI gate + deploy-script gate | ✅ implemented |
| 5 | Baseline generated from the schema | run [36726223683](https://github.com/alaminiubateee969-cmd/tech360/actions/runs/36726223683) | ✅ 43 tables, 995 lines |
| 6 | Baseline is non-destructive | same run | ✅ 0 `DROP`/`TRUNCATE` |
| 7 | Baseline applies to a clean MySQL 8 | same run, `prisma migrate deploy` | ✅ |
| 8 | Zero drift after apply | same run, `migrate diff --exit-code` | ✅ |
| 9 | Prisma client generates for MySQL | same run | ✅ |
| 10 | Read-only integrity check on MySQL | same run, `db:verify` | ✅ |
| 11 | Lint / typecheck / tests / build on MySQL | `deploy-production.yml` → `ci` | ⏳ this push |
| 12 | Production backup verified | deploy script | ⛔ blocked — no DB credentials |
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

Items 1–4 were verified locally, 5–10 are proven by CI run 36726223683, and
11 runs on every push. Items 12–14 require credentials and network access that
are not available in this environment.

---

## 8. Why 12–14 could not be executed

The build environment reaches only `registry.npmjs.org` and the GitHub API.
Everything else is intercepted by a transparent proxy that accepts the TCP
connection and immediately closes it — verified by control tests against
`203.0.113.77` (TEST-NET-3, unroutable) and port 1, both of which also
"connected".

Consequences:

- `ssh -p 65002 …@189.49.97.102` → `kex_exchange_identification: Connection closed by remote host` (no banner)
- `https://bdtech360.com` → TLS killed mid-handshake
- `binaries.prisma.sh` unreachable → the native Prisma engine cannot be downloaded locally
- Debian package mirrors unreachable → no local MySQL server can be installed

GitHub Actions has none of these limits, which is why the MySQL work is
executed there and the evidence is collected from the run logs.
