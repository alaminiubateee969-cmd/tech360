# TECH360 Project State

**Updated:** 2026-10-03
**Repository:** `alaminiubateee969-cmd/tech360`
**Current GitHub `main`:** `9f11195809c30ff21b7f61779373b63bd15513f9`
**Working branch:** `arena/01a1006a-tech360` (based on the same `main` SHA; changes are not yet committed/pushed at this checkpoint)

## Application and deployment contract

- Application version: `0.2.1`; `/api/health` imports it from `package.json`.
- Runtime: Node.js `>=22.0.0 <23`, npm, Next.js standalone output, Prisma/client `6.19.3`, MySQL datasource.
- `npm run build` generates Prisma Client, applies committed pending migrations with `prisma migrate deploy`, builds Next.js, and copies static/public assets into standalone output. It does not seed the database.
- Required start command: `npm start`; npm runs `prestart` production configuration validation before starting `.next/standalone/server.js`. Whether Hostinger's selected Next.js preset invokes npm lifecycle scripts is **NOT VERIFIED** and must be confirmed in hPanel/runtime logs.
- `DATABASE_URL` must be a credentialed MySQL URL with a database name. No Hostinger host, port, or database name is assumed in source; the exact production endpoint remains **NOT VERIFIED** and must be checked against hPanel before deployment migrations.
- Legacy Google Cloud Run deploy/backup scripts, Cloud Build config, and Dockerfile were retired to prevent a second deployment path, placeholder-secret creation, and misleading backup success; local guard test passes.
- Initial admin seeding is a separate explicit operation. The seed requires a valid production `ADMIN_EMAIL` and strong `ADMIN_PASSWORD`; upserts preserve existing records. The new disposable-MySQL seed-safety test is pending branch CI.

## GitHub/source evidence

- PR #11 merged the Prisma EACCES fix to `main` at `9f11195809c30ff21b7f61779373b63bd15513f9`.
- GitHub Actions run **37078930321** passed all configured steps on that exact SHA, including MySQL migration/drift tests, lint, typecheck, tests, read-only database verification, EACCES reproduction/repair, build, standalone asset validation, and production-start smoke. This is CI evidence against disposable MySQL, not a Hostinger deployment.
- Current branch-specific changes have not yet run in GitHub Actions. The branch adds production environment tests, seed-safety coverage, a scoped `tinyglobby` API regression gate, stricter Prisma artifact permission repair, expanded EACCES simulation, and deployment documentation.
- GitHub reports `main` `protected: false`; ruleset/branch-protection API access was denied. Required review and status-check protections are **NOT VERIFIED**.

## Local checks at this checkpoint

- `npm ci --no-audit --no-fund`: **PASS** earlier on Node 22.
- `npm run lint`: **PASS**.
- Production environment tests: **5/5 PASS**.
- `npm run schema:check`: **PASS** (86 MySQL native type annotations in sync).
- Next config smoke: **PASS** (two canonical redirects and five security headers).
- CI YAML parse and shell syntax: **PASS** for all 24 current `run` blocks.
- Scoped plugin glob API smoke: **PASS** locally; updated CI gate pending.
- Full and production dependency audits: **PASS**, zero vulnerabilities.
- `npm test`: **101 passed / 1 failed** of 102; the MySQL-backed workflow test stops because the local Prisma Client is ungenerated. `prisma generate --no-engine` also failed on TLS to `binaries.prisma.sh`; no disposable local MySQL is available.
- `npm run typecheck`: **BLOCKED LOCALLY** by missing generated Prisma exports `Session`, `ChatConversation`, and `ChatMessage`.
- `npm run build`: **BLOCKED before migrate/build** because sandbox TLS disconnected during Prisma engine download. No local server was generated.
- `DATABASE_URL` is unset; `db:verify`, MySQL-backed seed-safety integration, production schema/history, and backup/restore were not verified locally.

## Production evidence boundary

- The last supplied Hostinger EACCES build log is from SHA `807c3a737c06e3034a0261ecb3e69abb41f4c1b0`, before the fix merged at `9f11195`; no newer Hostinger build/runtime log is available.
- Hostinger settings, deployment SHA, startup command/preflight execution, runtime port, environment values, production MySQL state, migration history, and backup are **NOT VERIFIED**.
- Direct 2026-10-03 probes resolved the apex/`www` domains but HTTPS requests failed with curl exit 35 / HTTP `000`; HTTP apex returned exit 52 / HTTP `000` (empty reply). No application HTTP response was obtained.
- PayPal and SSLCommerz checkout are honestly marked `INTEGRATION_NOT_BUILT` and disabled by default; other third-party provider acceptance is not certified.
- No production database or user data was mutated during this audit.

For current Hostinger requirements and remaining production gates, see [`HOSTINGER_DEPLOYMENT.md`](./HOSTINGER_DEPLOYMENT.md), [`HOSTINGER_DEPLOYMENT_MATRIX.md`](./HOSTINGER_DEPLOYMENT_MATRIX.md), and [`PRODUCTION_DEPLOYMENT_REPORT.md`](./PRODUCTION_DEPLOYMENT_REPORT.md).
