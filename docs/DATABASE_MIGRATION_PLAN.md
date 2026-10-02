# Database Migration Status

See the root [`DATABASE_SCHEMA_AND_MIGRATION_GUIDE.md`](../DATABASE_SCHEMA_AND_MIGRATION_GUIDE.md) for the detailed, safety-reviewed procedures.

## Current source snapshot

The earlier SQLite-era state recorded in previous project notes is historical and is not the current production architecture. At the freshly fetched GitHub `main` snapshot `70f249c8711bb5fb6213df7e53d2444db87eeff1` (refreshed 2026-10-03 local):

- Prisma datasource provider: **MySQL** (`prisma/schema.prisma`);
- checked-in Prisma migration baseline: `prisma/migrations/0_init/migration.sql`;
- GitHub Actions creates a disposable MySQL service, applies migrations, checks schema drift, and runs a read-only database verifier;
- CI database evidence does **not** prove the Hostinger production database is reachable, matches the baseline, or has a verified backup.

The production MySQL host, schema state, backup/restore evidence, and migration status were not available in this audit. Do not run `npm run db:deploy` until an authorized operator has inspected the target schema and verified a recoverable backup. Never run a reset, force-reset, or data-loss push against production.
