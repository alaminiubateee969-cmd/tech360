# Database Schema and Migration Guide

## Current verified state

- Engine: SQLite through Prisma 6.
- Schema: `prisma/schema.prisma` — 43 models.
- Checked-in data file: `db/custom.db`.
- Migration directory: **not present**. Therefore this repository does not yet have an evidence-backed migration history that may safely be applied to an existing production database.
- Read-only verification: `npm run db:verify` (or `python3 scripts/verify-database.py`). It checks SQLite integrity, foreign keys, and exact Prisma-model/SQLite-table coverage without changing data.

On 2026-09-30 the checked-in database reported integrity `ok`, zero foreign-key violations, 43 Prisma models, 43 SQLite tables, no missing model tables, and no unexpected tables.

## Safe baseline strategy

A baseline must be created in an authorized environment where the exact pinned Prisma engines are available. It must not be improvised against production.

1. Stop writes or take a transaction-consistent copy of the production database.
2. Record the application commit and SHA-256 checksum of the backup.
3. Restore the backup to an isolated path; never point validation commands at production.
4. Run `python3 scripts/verify-database.py` against the restored copy using `TECH360_VERIFY_DB=/path/to/copy.db`.
5. Generate a baseline SQL migration from the current schema in a temporary migration workspace.
6. Review the SQL. A baseline for the already-existing schema must not be executed against the populated database.
7. Mark the reviewed baseline as already applied using Prisma's supported migration-resolution command in the isolated copy first.
8. Run `prisma migrate status`, then test a no-op `prisma migrate deploy` against the copy.
9. Start the application against the copy and run business/security tests.
10. Only after review and explicit production authorization: back up production again, resolve the same baseline as applied, run status/deploy, application health checks, and retain rollback evidence.

## Disposable validation database

CI creates `db/validate.db`, runs `prisma db push --skip-generate`, builds, and discards the runner. This is acceptable for build validation because it contains no production data. It is **not** the production migration procedure.

## Prohibited production actions

- `prisma migrate reset`
- `prisma db push --accept-data-loss`
- deleting migration history
- replacing `db/custom.db` with a seeded/demo database
- generating or applying a baseline without a recoverable backup
- applying schema changes while required CI gates are failing

## Recovery

The VPS deployment script backs up the database before deployment and restores it in its error trap. Recovery must still be tested on the actual target before the first schema-changing deployment. See `DEPLOYMENT.md` and `scripts/deploy-vps.sh`.
