# TECH360 final project check — 2026-11-15 UTC

## Verdict

**Local checks pass; production go-live is not certified.** A working development
preview is available in Arena with disposable SQLite/demo data. It is not the
Hostinger production deployment, and it deliberately has no external provider
credentials or active autonomous AI driver.

Audited baseline: `main` at `63fb0ce90cccf7a258f4ac721b7a239fbdb157df` (PR #76).
Fix branch: `arena/aeeb4b3e-tech360`. Results below cover that baseline plus the
changes accompanying this report. Consult the resulting PR's checks for the
exact tested revision and merge status; this report does not predeclare a merge.

## Merge/file reconciliation

- At audit start, GitHub listed **76 PRs: 74 merged, 2 closed unmerged, 0 open**.
- PR #43's history is in `main` through PR #44. Its 95 conflicting source versions
  remain preserved under `legacy/integration/2026-10-28/`, not activated over the
  maintained application. Do not replace the production MySQL schema with those
  historical SQLite/prototype files.
- PR #9 is closed, not merged. Its proposed VPS/GitHub deployment files belong to
  the retired deployment architecture. Current `main` uses Hostinger's native
  Node.js Web App Git integration; restoring that old workflow would be unsafe.
- After fetching the initially shallow Git history, `npm run check:recovery`
  passed: **174 historical failed/cancelled runs accounted for and all 95 incoming
  files hash-intact**. The initial shallow-history failure was an environment
  limitation, not missing project files.
- Baseline exact-SHA CI passed:
  https://github.com/alaminiubateee969-cmd/tech360/actions/runs/43689638582
  Its job includes real disposable MySQL migrations, seed safety, integrity,
  isolation tests, production build and standalone HTTP smoke. It is not proof
  of production MySQL or a Hostinger release.

## Repairs in this change

1. **AI verification command repaired.** Its database double lacked interactive
   transactions and `groupBy`, so it crashed against the current agent engine
   and operations API. The sequential double now commits/rolls back and groups
   actual rows, with self-checks. Updated obsolete error/Node-runtime assertions
   and documented the current multi-provider adapter inventory. Static keyword
   scanning is explicitly a narrow heuristic, not proof of all AI behavior.
2. **AI checker now runs in the standard test suite/CI.** The regression invokes
   the real command in an isolated process and checks its report, all 44 agents,
   absence of failures, and honest `CODE_VERIFIED` evidence boundaries. Inherited
   preview/provider settings are cleared so they cannot bypass test doubles.
3. **Deployment revision visibility.** `/api/health` now includes
   `release.commit` and `release.sourceState`. Next embeds Git identity at build
   time; the standalone runtime does not need `.git`. Source archives may supply
   a full 40-hex `TECH360_BUILD_SHA` at build time; malformed/arbitrary values are
   never published. Missing identity is `unknown`, never a made-up SHA. Metadata
   is traceability, not a signed attestation. CI compares the served SHA to HEAD.
4. **Embedded development preview.** Development omits `X-Frame-Options` so Arena
   can embed it. Non-development builds retain `SAMEORIGIN` protection. Existing
   development-origin allowlists include `*.e2b.app`.

## Verification results

| Check | Result / boundary |
|---|---|
| Clean npm install on Node 22.22.3 | PASS |
| Full and production-only npm audits | PASS, 0 vulnerabilities |
| Full updated suite | PASS, **1,694 tests**, 0 failures/skips; disposable SQLite locally |
| AI verification | PASS, **66 checks**, 44 executable agents, 110 departments, 396 per-agent checks; mocked DB/provider, not live inference |
| ESLint | PASS |
| TypeScript | PASS, including the production build's typecheck |
| Next optimized webpack build + standalone asset copy | PASS locally; does not execute production migrations |
| Production `npm run build` with real MySQL | Baseline CI PASS; fresh fix-revision CI required before merge |
| Migration immutability/order | PASS, 19 published migrations unchanged |
| Schema/type map and DDL parity | PASS, 101 models/tables, 1,382 columns, 279 indexes |
| Referenced industry/service assets | PASS, no missing referenced files |
| Merge-conflict marker check | PASS |
| Historical recovery/file preservation | PASS |
| Factory HTTP acceptance against running preview | PASS, **49/49**, including 11 persisted runtime acceptance checks |
| Public HTTP smoke | PASS: home, Factory portal, robots, sitemap, llms, health, features, public pipeline; sampled JS/CSS 200 |
| Anonymous protected APIs | PASS: admin operations and Factory overview return 401 |
| Unconfigured gateway readiness | PASS fail-closed behavior: 503, not incorrectly marked ready |

The first parallel development HTTP run was interrupted by Next's memory-threshold
restart (not an application assertion failure). Restarting the preview with a
3 GiB Node heap and running acceptance sequentially completed successfully.
No production data was queried or changed. HTTP checks are not a full visual,
accessibility, every-button, load, or device-browser sign-off.

## Production go-live steps still required

The sandbox cannot reach the production domain or Hostinger control plane under
its outbound-network policy. No production credentials are available here, and
no production deployment was triggered or verified by these local checks.

1. After green exact-revision MySQL CI and merge, deploy the resulting `main` SHA
   through the existing Hostinger Node.js Web App integration. Use Node 22,
   `npm run build`, `.next` output and `npm start`; see `HOSTINGER_DEPLOYMENT.md`.
2. Preserve a current backup and rollback target before deployment. Retain build,
   forward-only migration and runtime logs; never run reset/db-push on production.
3. From an authorized external client, inspect
   `https://bdtech360.com/api/health`. Require HTTP 200 and the expected full
   `release.commit`; investigate `unknown` or `dirty` source state. Verify canonical
   HTTPS/redirects and public/static routes as well.
4. Verify production schema/migration inventory, controlled CRUD/transactions,
   a real backup/isolated restore drill, and admin password/TOTP/role boundaries.
5. Configure and test the selected real AI provider. If the shared gateway is
   required, its `/api/ai-gateway/ready` must return 200, not merely `/health`.
   Test email/payment/WhatsApp and other enabled providers separately. Configured
   keys are not evidence of successful messages, payments, or model responses.
6. Complete monitoring/alert delivery, browser acceptance and owner release
   approval. Remaining acceptance blockers are in `../KNOWN_ISSUES_AND_BLOCKERS.md`.

PayPal and SSLCommerz remain explicitly `INTEGRATION_NOT_BUILT`; this audit does
not pretend to implement those providers. Do not commit or paste real secrets.
