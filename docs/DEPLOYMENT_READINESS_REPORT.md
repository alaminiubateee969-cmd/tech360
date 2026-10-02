# Deployment Readiness

**Status: PRODUCTION NOT VERIFIED**
**Updated:** 2026-10-03 · **Branch:** `arena/01a0fde7-tech360`

## Repository configuration verified

- Application source version is `package.json` `0.2.1`; `/api/health` reads it dynamically.
- Application uses Node.js 22.x, npm, Next.js standalone output, Prisma 6.19.3, `prisma.config.ts`, and MySQL.
- The checked-in baseline is `prisma/migrations/0_init/migration.sql`; CI is configured to apply it to a disposable MySQL 8.0 service, compare schema drift, run tests/build, verify standalone assets, and start the generated server on an ephemeral test port.
- All Action references in both workflow files use supported v7 releases; setup-node still installs Node 22 for the application.
- Local `npm ci`, `npm ls --depth=0`, ESLint, MySQL schema-map validation, shell syntax, `npx prisma --help`, `git diff --check`, and both full/production `npm audit` passed. The audit reports zero findings after Prisma/client 6.19.3 and the scoped `deepmerge-ts` 8.0.2 override.
- Local `npx prisma validate`, `npx prisma generate`, `npx prisma migrate status`, and `npm run build` cannot download the Prisma engine because TLS to `binaries.prisma.sh` disconnects. `npm test` is 96 passed / 1 failed, and `npm run typecheck` reports three missing Prisma model exports because generation did not complete. `npm run db:verify` exits before connecting because `DATABASE_URL` is unset.
- Next.js production build and standalone/start smoke have not run locally. Exact-commit GitHub CI must validate Prisma 6.19.3 config loading/client generation, disposable MySQL migration/drift, typecheck, tests, and build.

## Production items not verified

- Hostinger hPanel settings and current deployment logs are not accessible; Node.js Web App type, repository/branch/commit, Node 22 selector, root, npm selection, Next.js preset/`.next` output/build script, managed start behavior, port binding, and environment variables are **NOT VERIFIED**.
- The supplied Hostinger log cloned `main` at `70f249c8711bb5fb6213df7e53d2444db87eeff1` and then ran “Installing Composer dependencies” / “Publishing completed.” It proves that logged job used the wrong Composer-oriented path, not an npm install, Next.js build, Node process, MySQL connection, or domain attachment.
- Production MySQL identity/version, connectivity, schema/migration resolution, and recoverable backup are **NOT VERIFIED**. CI uses only a disposable MySQL service.
- Fresh 2026-10-03 DNS lookups resolved the apex and `www`; HTTPS homepage, `/api/health`, and `www` probes failed with curl exit 35 / HTTP `000`, while HTTP apex returned an empty reply (exit 52 / HTTP `000`). TLS, domain routing, and live route status are **NOT VERIFIED**.
- No production health, homepage, portal-login, protected admin, or built static-asset HTTP response was obtained.

## Required before any production-complete claim

1. Obtain authorized hPanel evidence for the connected Hostinger Node.js Web App, repository/`main` commit, Node 22.x, npm, root, Next.js `next` preset, `.next` output, `build` script, Hostinger-managed standalone start, and the actual runtime port binding (if supplied). `npm run start` is the repository's CI/manual smoke command, not an assumed hPanel field.
2. Inspect Hostinger's protected environment settings without copying credentials into Git/chat. Confirm production `DATABASE_URL` uses Hostinger MySQL.
3. Confirm MySQL server version/schema and a restorable backup. Compare the existing schema to the baseline before any migration; do not run `db:deploy` blindly or use destructive commands.
4. Push the repair branch normally; inspect the new GitHub run's jobs, step logs, and annotations for the Node 20 warning and validate the production-build/standalone/start smoke steps.
5. After Hostinger deployment, test HTTPS externally: apex homepage, valid `www` TLS plus redirect to apex, `/api/health` (dynamic package version + MySQL UP), portal-login validation, unauthenticated protected SEO refusal, and a real `/_next/static/` asset. Preserve Hostinger build/runtime logs.
6. Inspect exact-commit CI evidence for Prisma 6.19.3 config loading, client generation, disposable MySQL migration/drift, and the scoped `deepmerge-ts` 8.0.2 override before treating the dependency remediation as validated.

See [`HOSTINGER_DEPLOYMENT.md`](./HOSTINGER_DEPLOYMENT.md), [`HOSTINGER_DEPLOYMENT_MATRIX.md`](./HOSTINGER_DEPLOYMENT_MATRIX.md), and [`DATABASE_SCHEMA_AND_MIGRATION_GUIDE.md`](../DATABASE_SCHEMA_AND_MIGRATION_GUIDE.md).
