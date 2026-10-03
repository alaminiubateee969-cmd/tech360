# Test and QA Report

- **Audit date:** 2026-10-03
- **GitHub `main`:** `9f11195809c30ff21b7f61779373b63bd15513f9`
- **Working branch:** `arena/01a1006a-tech360` (source changes are still uncommitted at this checkpoint)
- **Production status:** **NOT VERIFIED**

## GitHub evidence

GitHub reports main CI run [37078930321](https://github.com/alaminiubateee969-cmd/tech360/actions/runs/37078930321) as **PASS** on exact SHA `9f11195809c30ff21b7f61779373b63bd15513f9`. The job API reports every configured functional step succeeded, including dependency audits, Prisma validation/generation, disposable-MySQL baseline migration and drift checks, lint, typecheck, tests, read-only DB verification, the EACCES regression simulation/repair, production build, standalone asset checks, and production-start HTTP smoke. This validates the `main` tree and disposable CI MySQL only.

The current working branch expands the EACCES permission-loss simulation, adds a `tinyglobby` compatibility gate, production environment tests, the disposable-MySQL non-destructive seed regression, and a check that retired deployment/backup paths fail closed. Those branch-specific workflow changes have **not yet run in GitHub Actions**. The prior main run is not a CI result for this working tree.

## Local checks in this sandbox

| Check | Result | Notes |
|---|---|---|
| `npm ci --no-audit --no-fund` | **PASS** | Completed earlier on Node 22; lockfile resolves Prisma/client 6.19.3 and the scoped `@next/eslint-plugin-next` → `tinyglobby@0.2.17` alias. |
| `npm run lint` | **PASS** | ESLint completed with no findings on the current working tree. |
| `npx tsx --test tests/production-env.test.ts` | **PASS — 5/5** | Verifies blank-value `.env.example`, a credentialed MySQL URL, rejection of non-MySQL/missing-database URLs, canonical origins, strong distinct secrets, and no secret/URL echo. |
| `npm run schema:check` | **PASS** | MySQL schema/type map matches; 86 native type annotations. |
| Next config runtime check | **PASS** | Two canonical redirects and five security headers returned from `next.config.ts`. |
| CI workflow static check | **PASS** | Workflow YAML parsed; `bash -n` passed for 24 `run` blocks. This is not a GitHub Actions execution. |
| Production-start preflight | **PASS locally** | `npm start` with required variables removed stops in `prestart` before trying to launch the absent standalone server; output contains variable names only. The CI gate is pending. |
| Retired deployment-path guard | **PASS locally** | Retired Hostinger/Cloud Run deploy and backup scripts return nonzero with retirement notices; Docker/Cloud Build artifacts are guarded. The CI gate is pending. |
| Scoped glob compatibility | **PASS locally** | Resolved the plugin's scoped `fast-glob` alias and successfully called `globSync('src', { onlyDirectories: true })`; the new CI regression step remains pending. |
| `npm audit --audit-level=low` | **PASS — 0 vulnerabilities** | Full dependency tree; local CI-parity threshold fails on any severity. |
| `npm audit --omit=dev --audit-level=low` | **PASS — 0 vulnerabilities** | Production dependency tree; local CI-parity threshold fails on any severity. |
| `npm test` | **101 passed, 1 failed** | 102 tests total. The sole failure is the MySQL-backed `tests/database-workflows.test.ts`: it stops at Prisma Client initialization because this sandbox has no generated client. `prisma generate --no-engine` also failed downloading the schema engine (TLS disconnect to `binaries.prisma.sh`); no disposable local MySQL is available. This is not a passing full suite. |
| `npm run typecheck` | **BLOCKED LOCALLY** | Only the generated Prisma exports `Session`, `ChatConversation`, and `ChatMessage` are missing. The earlier test `RegExp` typing error is fixed. |
| `npm run build` | **BLOCKED BEFORE MIGRATION/NEXT BUILD** | Prisma generation could not download the schema engine from `binaries.prisma.sh` because the sandbox TLS connection disconnected. The migration and Next build did not run. |
| `npm run db:verify` / seed-safety integration | **NOT RUN** | `DATABASE_URL` is unset and no local MySQL/Docker service is available. The seed-safety test is guarded to disposable loopback CI databases. |
| Static path check | **PASS, limited scope** | Five source-referenced public paths checked; no dangling paths found. Production output/static serving still requires CI or a deployed server. |
| `git diff --check` | **PASS** | No whitespace errors at this checkpoint. |

No production database command or production seed was run. The local build failed before `prisma migrate deploy`; no production data was touched.

## Branch and repository evidence

- Current `origin/main` and the branch base both resolve to `9f11195809c30ff21b7f61779373b63bd15513f9`.
- PR #11 merged the prior Prisma engine EACCES fix at that SHA; its exact main CI run is successful.
- The current branch adds source/workflow/documentation changes but is not yet pushed and has no branch CI result at this checkpoint.
- GitHub's branch endpoint reports `protected: false`; ruleset/branch-protection API access was denied, so required reviews and checks on `main` are **NOT VERIFIED**.

## Production and feature limits

- Hostinger hPanel settings, deployment of SHA `9f11195809c30ff21b7f61779373b63bd15513f9`, runtime command, port, environment variables, database endpoint, migration state, and backup/restore are **NOT VERIFIED**. The last supplied Hostinger EACCES log predates PR #11.
- Direct 2026-10-03 probes resolved the apex/`www` hosts but received TLS failures (curl exit 35 / HTTP `000`) and an empty HTTP reply (exit 52 / HTTP `000`); no valid application response was obtained.
- The production preflight validates MySQL URL structure, canonical origins, and distinct secrets; it deliberately does **not** invent a Hostinger hostname or database name. An authorized operator must verify the exact `DATABASE_URL` against hPanel before a deployment build applies migrations.
- PayPal and SSLCommerz checkout adapters remain explicitly `INTEGRATION_NOT_BUILT` and disabled by default. External provider acceptance, SMTP/SMS/social/AI services, browser/mobile/accessibility, and live SEO/performance remain **NOT VERIFIED**.
- No production or user data was mutated during these checks.
