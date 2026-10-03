# Database Migration Status

See the root [`DATABASE_SCHEMA_AND_MIGRATION_GUIDE.md`](../DATABASE_SCHEMA_AND_MIGRATION_GUIDE.md) for the detailed, safety-reviewed procedures.

## Current source snapshot

The earlier SQLite-era state recorded in previous project notes is historical and is not the current production architecture. At the currently fetched GitHub `main` snapshot `9f11195809c30ff21b7f61779373b63bd15513f9` (2026-10-03), PR #11 has merged the Prisma EACCES repair and CI run 37078930321 passed the MySQL migration/drift checks. Current uncommitted branch changes still require their own CI run:

- Prisma datasource provider: **MySQL** (`prisma/schema.prisma`);
- checked-in Prisma migration baseline: `prisma/migrations/0_init/migration.sql`;
- GitHub Actions creates a disposable MySQL service, applies migrations, checks schema drift, and runs a read-only database verifier;
- CI database evidence does **not** prove the Hostinger production database is reachable, matches the baseline, or has a verified backup.

The production MySQL host, schema state, backup/restore evidence, and migration status were not available in this audit. Do not run `npm run db:deploy` until an authorized operator has inspected the target schema and verified a recoverable backup. Never run a reset, force-reset, or data-loss push against production.
