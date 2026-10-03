# Deployment Readiness

**Status: PRODUCTION NOT VERIFIED**
**Updated:** 2026-10-03 · **GitHub `main`:** `9f11195809c30ff21b7f61779373b63bd15513f9` · **Working branch:** `arena/01a1006a-tech360`

## Repository configuration

- Node.js `>=22.0.0 <23`, npm, Next.js standalone output, Prisma/client 6.19.3, and MySQL.
- `npm run build`: Prisma generate → forward-only `prisma migrate deploy` → Next build → standalone static/public asset copy. No seed runs during build or restart.
- `npm start`: production preflight → `.next/standalone/server.js`. Whether Hostinger's selected Next.js preset invokes npm lifecycle scripts is **NOT VERIFIED**.
- Runtime preflight accepts only a credentialed MySQL URL with a database path, canonical HTTPS origins, and three distinct random secrets. It intentionally does not guess the Hostinger DB host/name. The exact MySQL endpoint must be verified in hPanel before triggering a build that runs migrations.
- CI uses disposable MySQL 8.0; it never targets production.

## Source and CI evidence

PR #11 merged the Prisma engine EACCES repair at `9f11195809c30ff21b7f61779373b63bd15513f9`. Exact main CI run [37078930321](https://github.com/alaminiubateee969-cmd/tech360/actions/runs/37078930321) passed every configured step, including secret scan, dependency audits, Prisma validate/generate, disposable-MySQL migration/drift, lint, typecheck, tests, read-only DB verification, EACCES reproduction/repair, production build, standalone assets, and production-start smoke.

The current branch adds production environment tests, non-destructive seed-safety coverage, an explicit scoped `tinyglobby` compatibility gate, expanded Prisma permission-loss simulation, and docs. These edits have **not yet run in GitHub Actions**; the main run is not a pass for this branch.

## Local verification

- `npm ci`, `npm run lint`, production env tests (5/5), schema/type-map check, Next config smoke (2 redirects/5 security headers), CI YAML/shell syntax, scoped glob API check, and full/production npm audits: **PASS**; audits reported zero vulnerabilities.
- `npm test`: **101 passed, 1 failed** of 102. The MySQL-backed workflow test stops because Prisma Client generation is blocked locally; `prisma generate --no-engine` also hit a TLS disconnect to `binaries.prisma.sh`. No disposable local MySQL is available.
- `npm run typecheck`: **BLOCKED LOCALLY** by three missing generated model exports.
- `npm run build`: **BLOCKED before migration or Next build** because TLS to `binaries.prisma.sh` disconnected during engine download.
- Local `DATABASE_URL` is unset; local MySQL-backed integration, database verifier, seed-safety integration, and production DB evidence are **NOT VERIFIED**.

## Production facts not verified

- Hostinger hPanel app type/settings, exact source SHA, build/runtime logs, `npm start`/prestart execution, port binding, and configured environment variables.
- Actual production MySQL host/database/user, reachability, version, existing migration/schema baseline, and restorable backup.
- Current DNS/TLS/app routing and live homepage, health, portal, protected route, and static-asset responses.

The last supplied Hostinger build log failed with Prisma schema-engine EACCES on SHA `807c3a737c06e3034a0261ecb3e69abb41f4c1b0`, before PR #11. No newer Hostinger build/runtime evidence is available. Direct 2026-10-03 public probes returned TLS errors or an empty HTTP reply, not an application response.

## Required before production-complete claim

1. Review and pass GitHub CI for the current PR/commit; do not use the main run as current-branch evidence.
2. Have an authorized operator verify exact Hostinger MySQL connection details, schema/migration state, and a restorable backup before `migrate deploy`.
3. Confirm Hostinger deployed the intended SHA and that runtime startup executes the production preflight; inspect the actual port and logs.
4. Verify from an external client: HTTPS home and `www` redirect, `/api/health` with MySQL UP and package version, portal-login validation, protected-route refusal, and a built static asset.
5. Keep third-party claims scoped: PayPal/SSLCommerz checkout are unimplemented; other provider success paths require actual acceptance tests.

A green CI run is not evidence of Hostinger deployment or production data integrity.
