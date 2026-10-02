# MySQL Database Schema and Migration Guide

**Updated:** 2026-10-03
**Production status:** the repository schema and CI validation target MySQL; the Hostinger production database connection, schema, backup, and migration state are **NOT VERIFIED**.

## Verified repository state

- Prisma CLI and `@prisma/client`: `6.19.3` in `package.json`, `package-lock.json`, and `bun.lock`; `@prisma/config`'s `deepmerge-ts` is overridden to 8.0.2. Prisma CLI validate/generate has not passed locally because the engine CDN TLS connection failed; validate the current config and override in exact-commit CI.
- Datasource: MySQL, configured through `DATABASE_URL` in `prisma/schema.prisma`.
- Schema: 43 Prisma models.
- Baseline: `prisma/migrations/0_init/migration.sql`.
- CI workflows provision disposable MySQL 8.0, apply the checked-in migration using `prisma migrate deploy`, check schema drift, and run `npm run db:verify`. The latest verified `main` run (37050663450) exercised baseline migration/drift with Prisma 6.18.0 but failed later at Typecheck; it does not verify this repair's 6.19.3 update. A fresh exact-commit run is required. These checks are CI evidence only, not verification of Hostinger's production database.
- `db/*.db` and `db/*.sqlite*` are ignored local/legacy artifacts. No checked-in SQLite database is the production source of truth.

The MySQL provider, baseline, and workflow definitions are repository evidence. A GitHub run must pass before a particular commit's CI gates can be reported as verified. Production host/version, credentials, existing tables, row counts, backup/restore, and migration history remain **NOT VERIFIED** until an authorized operator inspects Hostinger.

## Read-only verifier

`npm run db:verify` checks that `DATABASE_URL` uses the schema's provider, connects, reports the MySQL version and foreign-key count, verifies model tables/InnoDB, and counts rows without changing data or issuing DDL. It never prints `DATABASE_URL`, credentials, or row contents. It still performs database reads; run it against production only with explicit authorization and an approved load window.

If `DATABASE_URL` is absent, the command exits with an error. CI sets it to its disposable MySQL service. Do not substitute a production connection merely to make a local check pass.

## Baseline safety — important for an existing database

`0_init` describes the schema from an empty database. A populated database may already contain those tables while lacking Prisma's migration history. **Do not run `npm run db:deploy` against an unidentified or populated production database.** Prisma could attempt to create the baseline tables and fail partway through.

Before any production migration action:

1. Confirm the Hostinger app, database identity, database server version, current application commit, and current schema with an authorized operator; keep credentials in Hostinger's protected settings.
2. Take a Hostinger-supported backup and verify that it can be restored to an isolated database. Record the backup identifier, timestamp, and application commit without copying credentials into Git or chat.
3. Restore to an isolated MySQL instance. Run `npm run db:verify` against that copy and compare the actual schema to `prisma/schema.prisma` using Prisma's migration diff tooling.
4. Review `prisma/migrations/0_init/migration.sql` and the diff. If the existing schema exactly matches the baseline, have the database owner approve marking `0_init` as applied using Prisma's supported `migrate resolve --applied` procedure on the isolated copy first. Do not use baseline resolution to conceal schema differences.
5. Verify `prisma migrate status`, run `npm run db:deploy` against the isolated copy, test application behavior, and verify the backup/restore and rollback plan.
6. Only after written approval, a fresh production backup, and a reviewed no-surprise plan may the same baseline-resolution and deployment procedure be performed against production. Capture post-migration health and integrity evidence.

No production connection, backup, baseline resolution, migration, or rollback was performed in this audit.

## Development and CI commands

- `npm run db:generate` — generate the Prisma client.
- `npm run db:migrate` — development-only `prisma migrate dev`; never use it on production.
- `npm run db:deploy` — applies pending migrations; use only after following the baseline-safety procedure above.
- `npm run db:verify` — read-only provider/table/integrity verification; requires an explicitly configured `DATABASE_URL`.
- `npm run db:seed` — inserts development seed data; do not run against production without a separately reviewed, idempotent production seeding plan.

Never use `prisma migrate reset`, `prisma db push --accept-data-loss`, or destructive schema commands against production. Do not switch the production provider to SQLite.

## Recovery

Use Hostinger's supported backup/restore process and the normal Git revert procedure. Do not replace a database with seed/demo data or delete database, upload, archive, or application assets as a deployment shortcut. See [`DEPLOYMENT.md`](./DEPLOYMENT.md) and [`docs/HOSTINGER_DEPLOYMENT.md`](./docs/HOSTINGER_DEPLOYMENT.md).
