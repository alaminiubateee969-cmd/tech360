# Known Issues and Blockers

**Updated:** 2026-11-18 UTC
**Latest working-tree verification:** see the [repository-wide audit and measured coverage](docs/audit/2026-11-18/REPOSITORY_AUDIT.md). On `arena/3aa75515-tech360`, 2,100 tests / 418 suites, lint, MySQL-client typecheck, a migration-free production build and 97 production HTTP checks pass locally. The compiled-app browser run passes 13 functional checks and five of six automated accessibility surfaces; the remaining widget surface has two failing rules. SQLite/synthetic browser and regression evidence is not production/MySQL acceptance. Earlier [login/lockfile evidence](docs/ERROR_FIX_VERIFICATION_2026-11-18.md) remains historical supporting evidence.

**Committed base, not these unpublished edits:** `main` at `d8c68f4f8ea983bc64559c51ed9045a726a6cb85` passed [full MySQL CI](https://github.com/alaminiubateee969-cmd/tech360/actions/runs/44400326147) and the [MySQL baseline](https://github.com/alaminiubateee969-cmd/tech360/actions/runs/44400326179). PRs #79–#82 are already merged. No current working-tree changes were committed, pushed, merged or deployed, and production was not re-probed.
**Prior production-evidence audit:** `8d62c852787c3e8e936b3b32ef2fdd45b391d0c6` on `arena/8a6db089-tech360`
**Release verdict:** **NOT READY** — unresolved code/browser work and external acceptance gates remain; the repository-wide semantic audit is not complete.

Current production blockers are recorded in this register. The
[`Master SOP audit`](docs/MASTER_SOP_V1_AUDIT_2026-11-14.md) and other dated reports
remain supporting historical evidence and must not override newer verification here.

## Current code/browser work still open

- **Widget accessibility:** the final compiled-app mobile chat scan still reports `color-contrast` (small message/privacy metadata) and `scrollable-region-focusable` (message log). Functional persistence, private attachments, operator replies/replay and note privacy pass in the isolated browser fixture. ChatWidget is unchanged: obtain the separately approved change plan before editing it, then rerun keyboard/axe acceptance.
- **Workflow integrity follow-up:** journey step/retry logs still slice serialized JSON, and several state/audit/communication writes are not atomic or swallow persistence errors. Broader closure/payment/refund concurrency on MySQL remains unverified. The repaired board closure, settled-refund gate, journey role/client binding and unrelated-running-log preservation are covered by real disposable-DB regressions; this does not certify every lifecycle path.
- **CRM policy clarification:** create/import/bulk/manual-board stage labels can assert later lifecycle states. Determine the owner-approved historical-import/correction policy and test that no consumer treats a mutable label as payment/approval evidence. Do not silently rewrite existing customer records or remove import features by assumption.
- **Coverage limits:** all source/API/model/migration files are structurally inventoried, but that is not an exhaustive manual security review, every-button/device run, mutation/line coverage measurement or real-provider acceptance. See the audit's A–K evidence and unexecuted-test list.

## Blocker register

| ID | Status | Why it matters | Required authorized action |
|---|---|---|---|
| B-001 | BLOCKED — source state dirty; Hostinger logs not inspected | Live `/api/health` on 2026-11-17 returned `release.commit=59e3e339287698920ff40b09547c4cc24397c0eb`, matching `main` at probe time, but `release.sourceState=dirty`. The matching SHA is useful traceability, not proof of a clean, reproducible build or a verified Hostinger release. | Rebuild/deploy the reviewed SHA from a clean working tree; compare the served commit/source state with hPanel; capture Node 22, build/start commands and redacted deployment/runtime log IDs. Do not expose secrets. |
| B-002 | BLOCKED | Live `/api/health` reported database UP at probe time, but production migration history, controlled CRUD/transaction checks, grants and data consistency were not inspected. A health probe is not a database acceptance test. | Database owner runs the read-only verifier and controlled acceptance checks; retain redacted evidence. |
| B-003 | PARTIAL | Apex, HTTP input and `www` reached the canonical HTTPS app through external fetching. Raw redirect status, DNS records, certificate issuer/SAN/expiry and renewal alert were not captured because direct sandbox TLS is restricted. | Capture DNS and raw `curl -I`/certificate evidence from an authorized external client and verify expiry monitoring. |
| B-004 | BLOCKED | Backup and isolated restore tooling is tested, but no current production `last-run.json` / `last-drill.json`, offsite copy, measured RTO or accepted RPO was provided. | Configure host cron, run a real backup and isolated restore drill, and retain the no-secret evidence described in `docs/BACKUP_AND_RESTORE.md`. |
| B-005 | BLOCKED | External provider credentials/approvals and real sandbox/live transactions are not certified. Presence or a health flag is not transaction acceptance. | Test each applicable email, WhatsApp, SMS, social, Stripe, AI, n8n, media and voice integration separately after owner authorization. |
| B-006 | BLOCKED / POLICY DECISION | Retained historical evidence reported gateway liveness but `ready:false`: no application registry and no allowlisted real gateway provider. The current deployed state was not re-probed in this audit. | Owner decides whether the shared gateway is mandatory. If yes, configure registry digests/caller tokens/provider policy and require `/ready` 200 before acceptance. |
| B-007 | BLOCKED / CURRENT STATE UNVERIFIED | A retained earlier repository query reported `main` as `protected:false`; current ruleset/protection acceptance was not refreshed in this local audit. | Repository owner enables/verifies required review and exact-SHA `ci` checks through rulesets/branch protection. |
| B-008 | BLOCKED / OWNER-LEGAL | The public repository has no root license and GitHub reports no detected license. Public visibility does not grant commercial reuse rights. | Owner/legal counsel selects and approves a license. Do not add one by assumption. |
| B-009 | BLOCKED | A tag/release for the newly reviewed artifact and signed release/deployment-window acceptance are not evidenced by this audit. Earlier repository queries are not current release certification. | After all critical gates close, owner approves a tag/release and records rollback target and deployment window. |
| B-010 | BLOCKED | Active uptime, infrastructure, SSL-expiry, backup and security alert delivery was not evidenced. | Configure monitors and perform a test alert through the documented escalation route. |
| B-011 | BLOCKED | Real production admin bootstrap, forced password rotation, TOTP enrollment and representative role-boundary acceptance were not evidenced. | Authorized owner performs the account checks and records IDs/timestamps only, never credentials. |
| B-012 | BLOCKED | Full production browser/device/manual every-button, provider workflow, accessibility and load acceptance is not signed. | Execute the controlled QA matrix and retain results before handover acceptance. |
| B-013 | RESOLVED IN SOURCE — production deployment unverified | The PR #80 failure was historical. The npm lockfile now resolves Next.js and `eslint-config-next` `16.4.6`; the unused `next-intl` dependency was removed in merged PR #82. Full and production npm audits on 2026-11-18 both report 0 vulnerabilities, and exact-SHA main CI `44400326147` passed the unchanged audit gates. | Keep both audit gates required. Deploy only the reviewed npm lockfile; verify the actual production build separately under B-001. Do not treat this source-level resolution as production acceptance. |

## Verified baseline (not blockers)

- Exact-SHA main `ci` run `44400326147` and `mysql-baseline` run `44400326179` passed on `d8c68f4`, including actual disposable MySQL migrations, zero drift, database tests, production build and smoke checks.
- On the current repair branch, the latest complete local suite passed **2,100/2,100 tests in 418 suites**, with 0 failures/skips/cancellations. It used a fresh disposable SQLite database, not a live MySQL server. Earlier 1,939/2,026/2,046/2,084 runs are intermediate evidence, not the latest result.
- Fresh ESLint, production-MySQL-client TypeScript, Prisma validation/generation, static schema map/drift/immutability checks and both npm audits passed (0 vulnerabilities). The generated client was restored to MySQL after local SQLite acceptance; no source schema/migration or npm lockfile was changed.
- Migration-free production compilation generated 97 pages; standalone asset verification and 97 real standalone HTTP checks passed, including a deliberately unreachable MySQL connection, all 83 sitemap routes and canonical redirects. This does not verify successful live MySQL transactions on the new edits.
- The final compiled-app browser run passed 13 functional checks and five accessibility surfaces; one accessibility surface failed two rules. It had 0 page errors, 0 failed same-origin requests and 0 environment/dependency-blocked checks. Its nine-route image sample is not a full every-page/device sweep. Production/MySQL, real OTP and provider-delivery acceptance are separate.
- All 20 published migrations remain unchanged and correctly ordered. Static schema checks passed for 107 models/tables, 1,504 columns and 295 indexes.
- Live `https://bdtech360.com/api/health` on 2026-11-17 reported healthy application `0.2.1`, database UP, 44 agents, provider/channel configuration and an active operations heartbeat; its release commit matched observed `main`, but `sourceState` was `dirty`.
- Live public pipeline API returned the sanitised public journey. Unauthenticated admin/client/factory data endpoints and `/api/health/deep` returned 401.
- Minimal public `/api/health` and Super Admin-only `/api/health/deep` diagnostics are now merged in source and covered by passing main CI. Deployment of that source was not independently verified during this repair.

These facts do not replace the blocked production acceptance evidence above.



## Product gaps identified in the 2026-11-17 website audit

- **Dedicated Developer Portal: NOT IMPLEMENTED.** The repository has a `DEVELOPER` staff role inside `/#/admin`, but the public `/developer` URL returns 404 and there is no standalone Developer Portal route. Do not mark this as complete or provide a Super Admin login as a workaround. Implement a role-scoped Developer Workspace with assigned projects, technical documentation, API reference, issue/task tracking, release visibility and least-privilege access; keep secrets and unrelated client data hidden.
- **Full visual/browser sign-off: NOT COMPLETE.** Live service and industry pages expose their image references, and sampled homepage/service/industry images rendered, but a full browser `naturalWidth` sweep across every service and industry detail route, viewport and device has not been signed off.
- **Portal acceptance: PARTIAL.** Anonymous API boundaries were checked (401 on protected endpoints); authenticated Client, Super Admin and Developer workflows still require authorized end-to-end testing.

## Honest feature boundaries

- PayPal and SSLCommerz adapters remain `INTEGRATION_NOT_BUILT`; configuration names do not enable them.
- Redis, PostgreSQL, MongoDB, Docker, Compose, Nginx, PM2 and systemd are not required by the selected
  Hostinger-managed architecture. Do not deploy unnecessary parallel infrastructure to satisfy a generic
  matrix.
- The shared AI gateway's liveness is not readiness.
- A provider key being configured is not proof that a test message, payment or inference succeeded.
- Production Ready must not be declared until all critical blockers are closed with evidence.

## Safety rules

1. Never paste or commit production credentials, provider tokens, database URLs or backup data.
2. Never run destructive Prisma/database commands against production.
3. Never enable an integration from environment presence alone; complete provider acceptance first.
4. Never treat green CI as proof of a Hostinger deployment or a restorable production database.
5. Preserve the single supported Hostinger Node.js Web App path; retired deployment paths must fail closed.
