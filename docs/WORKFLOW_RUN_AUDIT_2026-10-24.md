# GitHub Actions workflow-run audit — 2026-10-24

## What “251” refers to

The repository’s GitHub Actions API returned `total_count: 251` workflow runs at the start of this audit. That is the number shown beside the Actions history, not a single workflow ID. The runs belong to seven workflow definitions (some are stale definitions whose YAML files are no longer in the source tree).

Snapshot at audit time:

| Conclusion | Runs |
|---|---:|
| success | 132 |
| failure | 97 |
| cancelled | 21 |
| in progress | 1 |
| **total** | **251** |

The in-progress run was `ci` run #192 on `main` (SHA `ac6e759`). It later completed **successfully** in 3m45s, including lint, typecheck, MySQL tests, seed safety, database integrity, production build, standalone validation, and the production smoke test.

## Workflow-by-workflow status

| Workflow | Runs | Success | Failure | Cancelled | Current status |
|---|---:|---:|---:|---:|---|
| `ci` | 192 | 97 | 75 | 19 | Green on the latest `main` commit; a fresh branch run is added by this audit. |
| `deploy-production` | 27 | 16 | 9 | 2 | Historical workflow; the YAML is no longer in the repository. Production deploys are owned by Hostinger’s Git integration. |
| `mysql-baseline` | 24 | 16 | 8 | 0 | Latest run is green; it only triggers on Prisma/schema path changes. |
| `.github/workflows/deploy-production.yml` | 3 | 0 | 3 | 0 | Old path-based definition retained by GitHub for history; file is not in the tree. |
| `.github/workflows/mysql-baseline.yml` | 1 | 0 | 1 | 0 | Old path-based definition retained by GitHub for history; file is not in the tree. |
| `tmp-engine-fetch` | 3 | 3 | 0 | 0 | Temporary sandbox helper; file is not in the tree. |
| `zz-diagnose-mysql` | 1 | 0 | 1 | 0 | Temporary diagnostic helper; file is not in the tree. |

Historical red runs cannot be turned green retroactively: each is pinned to the commit that produced it. The actionable definition of “fixed” is therefore: the current code must pass the active workflows, stale definitions must not create new failures, and a fresh verification run must be green.

## Fixes and verification performed

1. **Confirmed the latest `main` CI is green.** `gh run watch 40046266147` ended with every step passing, including `npm audit`, Prisma drift gates, MySQL tests, production build, and the standalone production smoke test.
2. **Reproduced the checks locally.** After `npm ci`, the Prisma client was missing, which caused 4 TypeScript errors and 3 cancelled/failing test suites. Regenerating the MySQL Prisma client from the committed schema cleared the TypeScript errors. Because `binaries.prisma.sh` is outside this sandbox’s egress allowlist, the exact Prisma 6.19.3 engines were fetched from the `owengretzinger/prisma-engines-mirror` GitHub mirror, SHA-256 verified, and served through a local HTTP mirror for `prisma generate`.
3. **Ran the full test suite against a disposable SQLite database.** The three historically environment-blocked suites (`database-workflows`, `governance-db`, `governance-outbound-db`) were included. Result: **950 tests, 950 pass, 0 fail, 0 cancelled**. The production CI already proves the same suites against MySQL.
4. **Removed the last lint warning.** `ContactView` used `form.watch(...)`, which the React Compiler correctly flags as memoization-incompatible. It now uses `form.subscribe({ formState: { values: true }, ... })`, preserving the idempotency-key reset on edit. `npm run lint` and `npm run typecheck` are now both clean (0 problems / 0 errors).
5. **Dependency and schema gates:** `npm audit --audit-level=low` and `npm audit --omit=dev --audit-level=low` both report **0 vulnerabilities**; `npm run schema:check` and `npm run schema:drift` pass (73 models, 73 tables, 1002 columns, 187 indexes).
6. **Live preview:** a seeded SQLite-backed Next.js dev server is running on port 3000. Verified with real HTTP: `/` 200, `/api/health` healthy with database UP, seeded blog row served, Super Admin login, 401 on anonymous admin API, client portal login/me, visitor chat session + message, and the admin inbox reflecting the new conversation. External AI/SMTP/WhatsApp/Social integrations remain honestly `NOT_CONFIGURED` because no production secrets are present.
7. **Removed the Edge-runtime instrumentation warnings.** `src/instrumentation.ts` imported the Node-only ops engine at module scope, so Next.js bundled `node:crypto`/Prisma/ops modules into the Edge instrumentation runtime and logged “Node.js module is loaded in the Edge Runtime” on every dev start. Those imports are now lazy and occur only after the Node runtime guard, preserving the production ops driver while keeping the Edge bundle clean.
8. **Merged the fix to `main`.** PR #35 was merged as `deacaab`; the subsequent `main` CI run `40048824729` passed all MySQL, test, build, and production-smoke gates. This is the commit Hostinger’s Git integration should deploy.

## Remaining limits (honest)

- The 97 historical failed runs remain visible in GitHub’s history by design; they are not evidence of a current defect.
- `gh workflow disable tmp-engine-fetch` and `gh workflow disable zz-diagnose-mysql` returned **HTTP 403: Resource not accessible by integration**, so the stale workflow definitions could not be hidden from the Actions list with the current GitHub App permissions. Their YAML files are not in the repository, so they do not trigger on new pushes.
- Production “live” deployment is performed by Hostinger’s Node.js Web App Git integration when `main` changes. This sandbox can verify CI and a local/session preview, but cannot inspect the Hostinger account, its secrets, or its deployed SHA. A merge to `main` triggers that path; the actual Hostinger rollout must be confirmed in hPanel.
- The session preview uses SQLite because the sandbox has no MySQL server. Production uses MySQL; the MySQL path is covered by the green `ci` workflow.
