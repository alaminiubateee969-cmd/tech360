# Restore test results

| | |
|---|---|
| **Document** | `docs/testing/RESTORE_TEST_RESULTS.md` |
| **Owner** | Platform engineering, Tech360 |
| **Collection date** | 2026-10-19 |
| **Last verification** | 2026-10-19 |
| **Access level** | Internal — engineering and Super Admin |
| **Version** | 1.0 |
| **Retention** | Retained for the life of the platform |

> ## ⚠ RESULT: **THE GATE IS NOT MET**
>
> There is **no verified backup artefact** and **no proven isolated
> restore**. The platform is **ready for a staging release, not a
> public production release.** The reason is this document, not the
> code.

---

## 1. What the specification requires

> No public release until: a usable backup is verified, an isolated
> restore is tested, destructive migrations are inspected, the current
> deployed commit is recorded, a rollback plan is created, and the
> existing websites and ports are preserved.

| Gate | Status | Evidence |
|---|---|---|
| a usable backup is verified | **NOT MET** | `backupState.artifacts` is empty; `state === 'NO_ARTIFACTS'` |
| an isolated restore is tested | **NOT MET** | `restoreEvidence.proven === false` |
| destructive migrations are inspected | **MET** | §4 |
| the current deployed commit is recorded | **NOT OBTAINABLE HERE** | §5 |
| a rollback plan is created | **MET** | `docs/deployment/ROLLBACK_GUIDE.md` |
| the existing websites and ports are preserved | **MET** | §6 |

---

## 2. The measurement

The Backup & Recovery console page and `/api/admin/backup` report the
**true** state of the backup directory. They do not simulate a backup,
and they do not show a green tick.

```json
{
  "state": "NO_ARTIFACTS",
  "artifacts": [],
  "restoreEvidence": {
    "proven": false,
    "detail": "No isolated restore has been performed and recorded for this deployment."
  }
}
```

The reporting code is `src/app/api/admin/backup/route.ts` →
`adminBackupState()`. It reads the directory, it lists the artefacts it
finds, and it reports the restore evidence that was recorded. If there
is no artefact, it says `NO_ARTIFACTS`. If no restore has been proven,
`proven` is `false`.

**This is the honest implementation of the gate.** A panel that showed a
successful backup with no artefact behind it would be the exact
"fabricated operational data" the specification forbids.

---

## 3. Why the gate could not be closed in this environment

| Blocker | Detail | The way out |
|---|---|---|
| no database | the Prisma client cannot be generated here, and there is no MySQL instance | CI and the production host have both |
| no deployment target | no production host is reachable from this environment | the production host |
| no `mysqldump` artefact pipeline | the dump step needs a live database | the production host |

The gate is therefore **deferred to the production host**, and it is
listed as the **single blocking item** for a public release.

---

## 4. Destructive migration inspection — **MET**

Every statement in every migration was inspected for destructiveness.

| Migration | Statements | Destructive? |
|---|---|---|
| `0_init` | the base schema | **Yes** — this is the initial creation, applied to an empty database. It is never re-run against a populated database because `migrate deploy` records it as applied. |
| `1_ai_software_factory` | `CREATE TABLE`, `ALTER TABLE ... ADD COLUMN` | No |
| `2_ai_execution_resilience` | `CREATE TABLE`, `ALTER TABLE ... ADD COLUMN` | No |
| `3_outbox_retry_integrity` | `CREATE TABLE`, `ALTER TABLE ... ADD COLUMN` | No |
| `4_campaign_engagement_tracking` | `CREATE TABLE`, `ALTER TABLE ... ADD COLUMN` | No |
| `5_chat_last_sender` | `ALTER TABLE ... ADD COLUMN` | No |
| `6_agent_job_durable` | `ALTER TABLE ... ADD COLUMN` | No |
| `7_verified_identity_webhook_replay` | `ALTER TABLE ... ADD COLUMN`, `CREATE TABLE` | No |
| `8_private_ai_platform` | `CREATE TABLE` × 13, `ALTER TABLE ... ADD COLUMN` × 3 | No |

The rules applied:

| Rule | How it is met |
|---|---|
| no `DROP TABLE` | none |
| no `DROP COLUMN` | none |
| no `TRUNCATE` | none |
| no `DELETE` | none |
| no `UPDATE` that rewrites a row | none |
| every new column has a default | yes — so no existing row is rewritten and no table is locked for a backfill |
| every new table is `utf8mb4` | yes |
| every new table has an index on its foreign key and its query dimensions | yes |

The single change that touches an existing table with existing rows is
`AgentJob.agentCode` becoming **nullable**. It is safe: a `NULL`
reference satisfies the foreign key, and every existing `INFERENCE` job
already has an agent. **No row is changed.**

`tests/migration-parity.test.ts` (14 tests) and
`tests/outbox-migration-parity.test.ts` (13 tests) prove that the
schema and the migration history agree.

---

## 5. The deployed commit — **NOT OBTAINABLE HERE**

The record of the currently deployed commit is normally read from the
deployment target. No deployment target is reachable from this
environment, so the value is unknown.

**On the production host, record it with:**

```bash
git rev-parse HEAD                    # the commit that is deployed
git log -1 --pretty="%h %ad %s" --date=short
```

Store it with the release record, alongside the migration history
(`npx prisma migrate status`) and the artefact list. The rollback guide
depends on it.

---

## 6. The existing sites and ports — **MET**

| Item | Status |
|---|---|
| the primary CRM hosting | **unchanged** — not moved |
| the primary website hosting | **unchanged** — not moved |
| the existing application port | **unchanged** |
| the existing routes | **unchanged** — the AI work added routes; it did not move or renumber any |
| the existing database | **unchanged** — the AI tables are additive |

The specification forbids moving the primary CRM or the website to
another hosting provider without explicit authorisation. **No hosting
change was made.**

---

## 7. The procedure to close the gate

This is the exact sequence to run on the production host. It is the
release blocker.

### 7.1 Take the backup

```bash
# 1. A consistent logical dump.
mysqldump \
  --single-transaction \
  --routines \
  --triggers \
  --events \
  --set-gtid-purged=OFF \
  --default-character-set=utf8mb4 \
  "$DATABASE_URL" | gzip -9 > "backup-$(date -u +%Y%m%dT%H%M%SZ).sql.gz"

# 2. The checksum — the restore is verified against THIS.
sha256sum "backup-*.sql.gz" | tee "backup-*.sql.gz.sha256"

# 3. The schema and the migration state, for the record.
npx prisma migrate status | tee "backup-*.migrate-status.txt"
npx prisma migrate diff \
  --from-url "$DATABASE_URL" \
  --to-schema-datamodel prisma/schema.prisma \
  --script > "backup-*.schema-diff.sql" || true
```

### 7.2 Verify the artefact

```bash
gzip -t "backup-*.sql.gz"          # the archive is not corrupt
sha256sum -c "backup-*.sql.gz.sha256"
zcat "backup-*.sql.gz" | head -50  # it is a real dump
```

### 7.3 Restore into an **isolated** database

The restore must go to a **different database** on a **different
instance** (or at least a different database with no traffic). Never
restore over the live database.

```bash
# A separate, isolated database with no application traffic.
mysql -e "CREATE DATABASE tech360_restore_test CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
gunzip -c "backup-*.sql.gz" | mysql tech360_restore_test

# The restored schema must match the live one.
mysqldump --no-data --skip-comments "$DATABASE_URL" > live-schema.sql
mysqldump --no-data --skip-comments tech360_restore_test > restored-schema.sql
diff live-schema.sql restored-schema.sql   # must be empty
```

### 7.4 Prove the restored data is usable

```bash
# The row counts must match, per table.
for t in Client Lead Project AiAgent AiMemory AgentJob KnowledgeDocument; do
  live=$(mysql -N -B "$DATABASE_URL" -e "SELECT COUNT(*) FROM \`$t\`")
  rest=$(mysql -N -B tech360_restore_test   -e "SELECT COUNT(*) FROM \`$t\`")
  printf "%-20s live=%-8s restored=%-8s %s\n" "$t" "$live" "$rest" \
    "$([ "$live" = "$rest" ] && echo OK || echo MISMATCH)"
done

# The application must start against the restored database.
DATABASE_URL="mysql://…/tech360_restore_test" npm run db:migrate
DATABASE_URL="mysql://…/tech360_restore_test" npm run build
DATABASE_URL="mysql://…/tech360_restore_test" npm start &
curl -fsS http://127.0.0.1:3000/api/health
```

### 7.5 Record the evidence

The evidence is written to the deployment record and the Backup &
Recovery panel reads it:

```json
{
  "artifact": "backup-20261019T120000Z.sql.gz",
  "sha256": "<the checksum>",
  "sizeBytes": 123456789,
  "takenAt": "2026-10-19T12:00:00Z",
  "restoredAt": "2026-10-19T12:41:00Z",
  "restoredInto": "tech360_restore_test",
  "isolated": true,
  "schemaDiff": "empty",
  "rowCountsMatch": true,
  "healthCheckPassed": true,
  "proven": true
}
```

**Only after `proven: true` may the public release proceed.**

---

## 8. The restore cadence that should be adopted

| | |
|---|---|
| Frequency | daily, and before every migration |
| Retention | 7 daily, 4 weekly, 6 monthly |
| Off-site copy | yes — a second provider or an object store, encrypted |
| Restore test | monthly, into an isolated database, using §7 |
| Evidence | archived with the release record |
| Owner | the platform engineer on the release rotation |

A backup that is never restored is not a backup. The monthly restore
test is what makes this document's gate closable on a recurring basis
rather than a one-off.
