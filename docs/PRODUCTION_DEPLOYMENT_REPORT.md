# Production Deployment Report

**Status: NOT VERIFIED — do not call production complete.**
**Audit date:** 2026-10-03 · **GitHub `main`:** `9f11195809c30ff21b7f61779373b63bd15513f9`
**Working branch:** `arena/01a1006a-tech360` (current changes not yet committed/pushed at this checkpoint)

## Repository and CI evidence

- The app targets Node.js 22.x, npm, Next.js standalone output, Prisma 6.19.3, and MySQL. `npm run build` generates Prisma Client, applies committed pending migrations with forward-only `prisma migrate deploy`, builds Next.js, and copies `.next/static` and `public` into `.next/standalone`.
- PR #11 merged the Prisma engine EACCES repair into `main` at `9f11195809c30ff21b7f61779373b63bd15513f9`. GitHub Actions run [37078930321](https://github.com/alaminiubateee969-cmd/tech360/actions/runs/37078930321) passed all configured steps for that exact SHA, including disposable-MySQL migration/drift checks, the then-current EACCES regression guard, production build, standalone asset validation, and production-start HTTP smoke.
- The current working branch adds environment validation/tests, a safer idempotent bootstrap seed, a scoped glob API regression gate, expanded Prisma permission simulation, and documentation changes. It has not yet run in GitHub Actions; the green `main` run is not evidence for these edits.

## Local results and limits

- `npm run lint`, the five production-environment tests, MySQL schema-map check, Next config redirects/header check, workflow YAML/shell syntax, scoped glob API check, and full/production `npm audit` passed. Both dependency audits reported zero vulnerabilities.
- `npm test`: **101 passed, 1 failed** out of 102. The MySQL-backed workflow test stops at Prisma Client initialization because generation is blocked locally; `prisma generate --no-engine` also hit a TLS disconnect to `binaries.prisma.sh`. No disposable local MySQL is available.
- `npm run typecheck`: **BLOCKED LOCALLY** by missing generated Prisma exports (`Session`, `ChatConversation`, `ChatMessage`).
- `npm run build`: **BLOCKED before migrations or Next build** because TLS to `binaries.prisma.sh` disconnected while Prisma attempted to download the schema engine. No local production server was produced.
- Local `DATABASE_URL` is unset and there is no local MySQL/Docker service. Database verification and the disposable-MySQL seed-safety integration were not run locally. No production database command or seed was executed.

## Hostinger, database, and public domains

- The last supplied Hostinger log cloned `main` at `807c3a737c06e3034a0261ecb3e69abb41f4c1b0` (before PR #11), generated Prisma Client, then failed at `prisma migrate deploy` with schema-engine EACCES. No newer Hostinger build/runtime log for the fixed `main` SHA is available; whether Hostinger deployed/recovered is **NOT VERIFIED**.
- Hostinger app type, connected repository/branch/commit, Node selector, root, npm/build/start settings, managed start behavior, `PORT`, production environment variables, runtime logs, and deployed static assets are **NOT VERIFIED**.
- The exact production MySQL host, database name, credentials, version, schema/migration history, reachability, and recoverable backup are **NOT VERIFIED**. The code does not hard-code a presumed host or database name. An authorized operator must compare the exact hPanel MySQL details with `DATABASE_URL` before a deployment build can run migrations.
- Direct 2026-10-03 probes resolved the apex and `www` addresses, but HTTPS homepage/health/`www` requests failed with curl exit 35 / HTTP `000`; HTTP apex returned exit 52 / HTTP `000` (empty reply). No valid application response was received. TLS, canonical redirects, homepage, `/api/health`, portal login, protected APIs, and static-file behavior remain **NOT VERIFIED**.

## Required evidence before production-complete claim

1. Run and review CI for the current branch/PR; merge only through the reviewed PR process after required checks pass.
2. Obtain Hostinger logs proving the exact deployed SHA, successful build, `npm start`/startup preflight behavior, process/port binding, and healthy runtime. Hostinger preset behavior must not be assumed.
3. Have the authorized database owner verify the actual Hostinger MySQL target, existing migration baseline/schema, and a restorable backup before allowing `migrate deploy`.
4. From an external client, verify HTTPS homepage, `www` redirect with valid TLS, `/api/health` showing the expected package version and MySQL UP, portal-login validation, protected-route refusal, and a built `/_next/static/` asset.
5. Retain rollback/recovery and provider acceptance evidence. PayPal and SSLCommerz checkout remain explicitly unimplemented; no claim of provider delivery is made.
