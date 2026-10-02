# Known Issues and Blockers

**Updated:** 2026-10-03
**Branch:** `arena/01a0fde7-tech360`

## Production/deployment blockers

| ID | Status | Impact | Evidence / blocker | Required next action |
|---|---|---|---|---|
| B-001 | NOT VERIFIED | Cannot claim a Hostinger Node.js deployment | The supplied log cloned `main` at `70f249c8711bb5fb6213df7e53d2444db87eeff1` and then ran Composer; it establishes the wrong flow for that logged job, not a Node.js deployment. Hostinger hPanel settings are unavailable. Official Next.js settings specify Node.js Web App preset `next`, Node 22, npm, build script `build`, output `.next`, and managed bundled-server startup (entry file ignored). | Authorized operator creates/configures the Hostinger Node.js Web App for the repository/`main`, confirms exact commit, Node 22.x, npm, root, Next.js preset/output/build, managed start/runtime, environment variables and port binding, then supplies successful hPanel/runtime logs. |
| B-002 | NOT VERIFIED | Cannot claim production MySQL integrity or migration safety | The repository schema is MySQL and contains a checked-in `0_init` baseline. CI uses disposable MySQL 8.0; no production `DATABASE_URL`, schema, migration history, or backup/restore evidence is available. | Have the database owner verify Hostinger MySQL identity/version/schema and a restorable backup. Do not run `npm run db:deploy` until the existing schema is compared with the baseline and migration resolution is explicitly approved. |
| B-003 | NOT VERIFIED | Cannot claim domain routing, HTTPS, health, or live route status | Fresh 2026-10-03 DNS lookups resolved apex and `www`. HTTPS apex home, `/api/health`, and `www` returned curl exit 35 / HTTP `000`; HTTP apex returned exit 52 / HTTP `000` (empty reply). No HTTP body/status was obtained, so the serving system and application routes remain unidentified. | Re-test from an authorized browser/network after Hostinger attaches the Node app and confirms DNS/TLS. Capture HTTPS status and `/api/health`, homepage, portal-login, protected SEO, and a built static asset. |
| B-004 | CI PASS; WARNING NOT VERIFIED | Exact repair CI smoke passed; cannot confirm whether the raw Actions log emitted the Node 20 warning | Run 37061731570 on `78801e811df56d8ca84f5776717b73e9fa94f8cf` passed all steps, including the production-start smoke. GitHub reports zero check annotations, but downloading the raw log archive returned EOF; no warning-absence claim is made. | Obtain the raw job log from GitHub UI/log access and check the Node 20 warning specifically. Hostinger startup remains separately unverified under B-001. |
| B-005 | BLOCKED LOCALLY; PASS IN CI | Local build/start are unavailable; repository build/start are validated only in CI disposable MySQL | Local `npm run build` stopped at `prisma generate` because TLS to `binaries.prisma.sh` disconnected; local `npm run db:verify` stopped because `DATABASE_URL` is unset. Repair run 37061731570 passed the production build and generated-server smoke against disposable MySQL. | Retain the CI evidence; do not bypass TLS or point local tests at production. A separate production DB verification remains unavailable and is tracked by B-002. |
| B-006 | BLOCKED | External provider success paths are not certified | SMTP, SMS, Meta/WhatsApp/social, payment, AI-provider, and malware-scanning credentials/services are not available or were not exercised. | Configure secrets only in provider/Hostinger settings, enable integrations individually, and retain approved sandbox/real acceptance evidence before claiming they are live. |
| B-007 | PASS ON REPAIR COMMIT | Prisma dependency remediation and MySQL CI compatibility passed on the repair branch; current `main` remains on the pre-repair tree | Prisma/client are pinned to 6.19.3 and `@prisma/config` resolves `deepmerge-ts` 8.0.2 via a scoped npm override. Local audits are clean; run 37061731570 passed npm audits/install, Prisma validate/generate, and MySQL migration/drift checks. No separate deepmerge API smoke test is claimed. Local Prisma engine download remains blocked by TLS. | Preserve the explicit versions and scoped override; do not use `npm audit fix --force`. Re-run CI for later source changes and merge only after the required review/production safety gates are satisfied. |
| B-008 | NOT VERIFIED | Cannot confirm that `main` requires reviews or passing CI | GitHub's branch-protection API returned 403 (“Resource not accessible by integration”); rulesets API returned 403 (plan/access restriction). No protection change was made. | A repository owner/admin must inspect the `main` branch protection/ruleset UI and confirm whether reviews and required CI checks are enforced. |

## Quality and security follow-up

- Review the current test/QA report for suite results; a passing policy suite does not certify every route, database workflow, browser, or provider.
- Historical development credentials in `worklog.md` were redacted. The optional ai-ops and notify-relay services now use development fallbacks only outside production; ai-ops refuses production startup without `PLATFORM_URL` and `OPS_SECRET`, and notify-relay rejects `/emit` if its production token is unset. Production secrets still must be supplied out-of-band.
- No tracked source archive, database file, private-key file, upload directory, or `public/downloads/` content was found in the repository scan. This does not inspect Hostinger filesystem/object storage or external backups.

## Honest feature boundaries

- PayPal and SSLCommerz checkout remain `INTEGRATION_NOT_BUILT` unless the relevant provider adapter is implemented and tested.
- Content Studio creates plans, scripts, prompts, marketing kits, and briefs; it does not claim to render image/video/audio files.
- Public WhatsApp contact was removed by the owner's prior directive. The private adapter remains gated and is not represented as active.
- Production performance, SEO ranking, accessibility conformance, and legal compliance have not been certified.

## Non-blocking technical debt

- Add database-backed HTTP route/session/CSRF tests and a complete isolated CRM-to-closure lifecycle test.
- Add approved external malware scanning and knowledge-version-chain support if required.
- Decide whether CRM stages should become admin-configurable; formalize agent-version and usage-cost records only if the business requires them.
- Extend reference inventory with per-URL access date, upstream license, and exact adopted pattern.

## Safety rules

1. Never deploy while required lint, typecheck, build, migration-safety, or backup gates are red.
2. Never turn an integration ACTIVE based only on environment-variable presence; perform the provider acceptance test.
3. Never print or commit production secret values.
4. Never mutate production or delete ignored/tracked database, upload, archive, or application assets as a deployment shortcut.
5. Keep production on MySQL; do not run destructive Prisma commands against the production database.
6. Continue only on `arena/01a0fde7-tech360`; push only to that fixed Arena session branch, not to `main`.
