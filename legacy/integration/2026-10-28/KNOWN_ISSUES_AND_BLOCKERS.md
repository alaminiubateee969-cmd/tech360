# Known Issues and Blockers

**Updated:** 2026-10-03
**Branch:** `arena/01a1006a-tech360`

## Production/deployment blockers

| ID | Status | Impact | Evidence / blocker | Required next action |
|---|---|---|---|---|
| B-001 | FIX MERGED; MAIN CI PASS; HOSTINGER NOT VERIFIED | The source-side Prisma EACCES repair is in `main`, but there is no evidence Hostinger deployed that SHA or started a healthy app | PR #11 merged the repair at `9f11195809c30ff21b7f61779373b63bd15513f9`; main CI run 37078930321 passed all configured steps, including EACCES reproduction/repair, disposable-MySQL migration, build, and standalone HTTP smoke. The last supplied Hostinger failure log is from `807c3a7` and predates the repair merge. Current hPanel logs/runtime are unavailable; direct public-domain probes returned TLS errors or an empty HTTP reply, not application responses. | Confirm Hostinger deployed the intended source SHA; inspect actual build/runtime logs and then verify DB/migrations, `/api/health`, homepage, redirects, and static assets. Do not equate CI with deployment. |
| B-002 | NOT VERIFIED | Cannot claim production MySQL integrity or migration safety | The repository schema is MySQL and contains a checked-in `0_init` baseline. CI uses disposable MySQL 8.0; no production `DATABASE_URL`, schema, migration history, or backup/restore evidence is available. | Have the database owner verify Hostinger MySQL identity/version/schema and a restorable backup. Do not run `npm run db:deploy` until the existing schema is compared with the baseline and migration resolution is explicitly approved. |
| B-003 | NOT VERIFIED | Cannot claim domain routing, HTTPS, health, or live route status | Direct 2026-10-03 probes resolved the apex/`www` hosts but HTTPS returned curl exit 35 / HTTP `000`; HTTP apex returned exit 52 / HTTP `000` (empty reply). No valid application status/body was received, so the serving system and routes remain unidentified. | Re-test from an authorized browser/network after Hostinger attaches the Node app and confirms DNS/TLS. Capture HTTPS status and `/api/health`, homepage, portal-login, protected SEO, and a built static asset. |
| B-004 | MAIN CI PASS; NODE RUNTIME WARNING NOT VERIFIED | A green GitHub run proves repository CI only, not Hostinger | Run 37078930321 on exact main SHA `9f11195809c30ff21b7f61779373b63bd15513f9` completed successfully; GitHub reports all configured job steps passed, including the production-start smoke. The raw log was not inspected for Node 20 warnings. | Keep the exact CI record; inspect raw logs for the warning only if that signal remains required. Hostinger startup is separately tracked under B-001. |
| B-005 | BLOCKED LOCALLY; PASS ON MAIN CI | The local sandbox cannot generate the Prisma client/build because the engine download cannot complete | Local `npm run build` stops during Prisma generation: TLS to `binaries.prisma.sh` disconnects before migration or Next build. Local typecheck reports only missing generated Prisma model exports (`Session`, `ChatConversation`, `ChatMessage`); `npm test` is 99/100, with its only failure requiring the generated client. Main CI run 37078930321 passed generation, typecheck, all tests, build, and production-start smoke against disposable MySQL. Local `DATABASE_URL` is unset. | Do not bypass TLS or point local checks at production. Retain the CI evidence; perform independent production DB verification only with authorized Hostinger evidence (B-002). |
| B-006 | BLOCKED | External provider success paths are not certified | SMTP, SMS, Meta/WhatsApp/social, payment, AI-provider, and malware-scanning credentials/services are not available or were not exercised. | Configure secrets only in provider/Hostinger settings, enable integrations individually, and retain approved sandbox/real acceptance evidence before claiming they are live. |
| B-007 | DEPENDENCY AUDIT PASS; CURRENT BRANCH CI PENDING | The scoped glob override avoids the current unpatched advisory without downgrading Next or suppressing audit results | Prisma/client 6.19.3 and scoped `deepmerge-ts` 8.0.2 override remain in the lockfile; `tinyglobby@0.2.17` is scoped to `@next/eslint-plugin-next`. Local full and production audits report zero vulnerabilities; the scoped `globSync` API check passes locally. Main CI run 37078930321 passed its then-current audits; this branch adds an explicit API regression step which has not run in GitHub Actions yet. Local Prisma engine download remains blocked by TLS. | Preserve explicit versions/scoped override; do not use `npm audit fix --force`. Run the updated branch workflow and review its actual result before merge. |
| B-008 | NOT VERIFIED | Cannot confirm that `main` requires review or passing CI checks | GitHub’s branch endpoint currently returns `protected: false`; branch-protection/ruleset API access previously returned 403 (“Resource not accessible by integration” / plan-access restriction), so required review/status-check policy cannot be certified from this session. | A repository owner/admin must inspect the `main` branch rules/rulesets UI and confirm or configure required reviews and passing CI. |

## Quality and security follow-up

- Review the current test/QA report for suite results; a passing policy suite does not certify every route, database workflow, browser, or provider.
- Historical development credentials in `worklog.md` were redacted. The optional ai-ops and notify-relay services now use development fallbacks only outside production; ai-ops refuses production startup without `PLATFORM_URL` and `OPS_SECRET`, and notify-relay rejects `/emit` if its production token is unset. Production secrets still must be supplied out-of-band.
- No tracked source archive, database file, private-key file, upload directory, or `public/downloads/` content was found in the repository scan. This does not inspect Hostinger filesystem/object storage or external backups.
- The legacy Cloud Run deploy/backup scripts, Cloud Build configuration, and Dockerfile were retired to remove an unsafe second deployment path, placeholder-secret creation, and a suppressed backup-copy failure. They must not be treated as a production deploy or backup procedure.

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
6. Continue only on `arena/01a1006a-tech360`; push only to that fixed Arena session branch, not to `main`.
