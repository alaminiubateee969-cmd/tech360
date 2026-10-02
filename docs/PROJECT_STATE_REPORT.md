# TECH360 Project State

**Updated:** 2026-10-03
**Repository:** `alaminiubateee969-cmd/tech360`
**Latest fetched GitHub source:** `main` at `70f249c8711bb5fb6213df7e53d2444db87eeff1` (refreshed 2026-10-03 local)

**Working branch:** `arena/01a0fde7-tech360` (repair commit `78801e811df56d8ca84f5776717b73e9fa94f8cf` is pushed; not merged to `main` and not deployed)

## Application and database

- Application version source of truth: `package.json` = `0.2.1`; the health route now reads that value dynamically.
- Application runtime: Node.js 22.x (`>=22.0.0 <23`), npm, Next.js `16.3.8`, React 19, TypeScript 5.
- Prisma CLI/client: `6.19.3`; scoped `@prisma/config` override resolves `deepmerge-ts` to 8.0.2; datasource provider: MySQL; schema: 43 models; checked-in initial baseline: `prisma/migrations/0_init/migration.sql`. Prisma settings, schema path, and seed command are defined in `prisma.config.ts`.
- Next.js output: standalone server. `npm run build` generates Prisma Client, applies committed pending migrations with `prisma migrate deploy`, builds Next.js, and copies standalone static/public assets; `npm run start` launches the generated server. Production database/backup readiness is not verified.
- GitHub workflows validate against disposable MySQL 8.0. All Action references were updated to supported v7 releases using the Node 24 Action runtime; setup-node continues to install the application's Node 22 runtime.

## Checks from this working tree

- `npm ci --no-audit --no-fund`: **PASS** (861 packages installed; npm emitted deprecation notices for `intersection-observer`, Recharts 2, and ESLint 9).
- `npm ls --depth=0`: **PASS** (exit 0, no extraneous packages). Verified Prisma resolution: `prisma`/`@prisma/client` 6.19.3, `@prisma/config` 6.19.3, `deepmerge-ts` 8.0.2, `effect` 3.21.0, and direct `dotenv` 16.6.1.
- `npm run lint`: **PASS**.
- `node scripts/convert-schema-to-mysql.mjs --check`: **PASS** (86 native-type annotations in sync).
- `npx prisma --help`: **PASS**; loads `prisma.config.ts` without the previous deprecated `package.json#prisma` warning. Schema validation/generation/status cannot run locally because Prisma engine download TLS disconnects.
- `bash -n` for the changed deployment/archive/health scripts and `git diff --check`: **PASS**.
- `npm test`: **96 passed, 1 failed**. The one failure is `tests/database-workflows.test.ts`, which cannot create Prisma models because Prisma 6.19.3 Client generation failed at the local engine-download TLS step.
- `npm run typecheck`: **BLOCKED** by the ungenerated Prisma client (three missing model exports: `Session`, `ChatConversation`, and `ChatMessage`).
- `npm run db:verify`: **NOT VERIFIED**; local `DATABASE_URL` is unset, so it exits before connecting.
- `npm run build`: **BLOCKED** at `prisma generate` because TLS to `binaries.prisma.sh` disconnected before the schema engine download; Next.js production build did not start.
- Repair-branch CI run **37061731570** on commit `78801e811df56d8ca84f5776717b73e9fa94f8cf`: **PASS** — Prisma validation/generation, disposable MySQL migration/drift, lint, typecheck, tests, read-only DB verification, production build, standalone assets, and production-start HTTP smoke all passed. This is CI-only evidence, not Hostinger verification.
- `npm audit` and `npm audit --omit=dev`: **PASS** locally and in run 37061731570, with zero vulnerabilities after pinning Prisma/client 6.19.3 and scoping `deepmerge-ts` 8.0.2 to `@prisma/config`. The Actions log archive returned EOF; while the check has no annotations, the specific Node 20 warning status is **NOT VERIFIED**. See [`SECURITY.md`](../SECURITY.md).

## Fresh GitHub `main` result

The latest fetched `main` run, **37050663450** on `70f249c8711bb5fb6213df7e53d2444db87eeff1**, used Prisma 6.18.0: it passed npm install, Prisma validation/client generation, disposable MySQL readiness, migration deployment, zero-drift, and lint, then failed at Typecheck. The GitHub annotation identifies an incorrect five-level `package.json` import in `src/app/api/health/route.ts`; tests, `db:verify`, and build were skipped. Repair-branch run **37061731570** on `78801e811df56d8ca84f5776717b73e9fa94f8cf** passed every configured CI step, including the smoke test. That does not change the result for current `main` or verify production. The repair-run log download returned EOF and its check has no annotations; the specific Node 20 warning status remains **NOT VERIFIED**.

## Deployment evidence boundary

Hostinger hPanel app type/settings, Node 22 selector, npm/build configuration, Hostinger-managed standalone start, runtime `PORT` binding, environment variables, production MySQL connection, migration status, and backup/restore are **NOT VERIFIED**. Fresh 2026-10-03 DNS lookups resolved apex and `www`; HTTPS probes for the homepage, `/api/health`, and `www` failed with curl exit 35 / HTTP `000`, while HTTP apex returned exit 52 / HTTP `000` (empty reply). No application body or route status was obtained. Therefore TLS, domain routing, `/`, `/api/health`, portal login, protected admin routes, and static assets remain **NOT VERIFIED**.

The production target is a Hostinger **Node.js Web App** with framework preset `next`, repository root, Node 22.x, npm, build script `build` (`npm run build`), and `.next` output. Hostinger's documented Next.js preset starts its bundled standalone server and ignores a custom entry-file field; the repository's `npm run start` is used for CI/manual smoke, not assumed to be an hPanel command. Do not hard-code or guess a port; actual Hostinger runtime/port binding remains **NOT VERIFIED**. Composer/PHP publishing output and legacy Google Cloud templates are not evidence of the current application deployment.

## Security and artifact review

- Historical development-secret assignments in `worklog.md` were redacted without displaying their values; optional operations/notification services now fail closed or skip in production when configuration is absent.
- The source-archive builder defaults to ignored `archives/`, refuses paths under repository `public/`, and excludes `db/`, `upload/`, and root `.env*`.
- No tracked database file, upload directory, private-key file, source archive, or `public/downloads/` content was found. Hostinger filesystem/object storage and external copies were not inspected.

For the current deployment evidence matrix, see [`HOSTINGER_DEPLOYMENT_MATRIX.md`](./HOSTINGER_DEPLOYMENT_MATRIX.md). For the MySQL baseline safety procedure, see [`DATABASE_SCHEMA_AND_MIGRATION_GUIDE.md`](../DATABASE_SCHEMA_AND_MIGRATION_GUIDE.md).
