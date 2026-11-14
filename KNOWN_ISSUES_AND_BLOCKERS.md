# Known Issues and Blockers

**Updated:** 2026-11-14 UTC
**Audited source:** `8d62c852787c3e8e936b3b32ef2fdd45b391d0c6` on `arena/8a6db089-tech360`
**Release verdict:** **NOT PRODUCTION READY — critical external evidence remains BLOCKED**

The authoritative current audit is
[`docs/MASTER_SOP_V1_AUDIT_2026-11-14.md`](docs/MASTER_SOP_V1_AUDIT_2026-11-14.md). Older dated reports
remain historical evidence and must not override this register.

## Current blockers

| ID | Status | Why it matters | Required authorized action |
|---|---|---|---|
| B-001 | BLOCKED | The live Hostinger deployment does not expose an exact deployed commit SHA, so it cannot be tied to the audited source even though application version `0.2.1` is live. | Capture hPanel source repository, branch, SHA, Node 22, build/start commands and deployment/runtime log IDs. Do not expose secrets. |
| B-002 | BLOCKED | Live `/api/health` reports MySQL connected and core schema available, but production migration history, controlled CRUD/transaction checks, grants and data consistency were not inspected. | Database owner runs the read-only verifier and controlled acceptance checks; retain redacted evidence. |
| B-003 | PARTIAL | Apex, HTTP input and `www` reached the canonical HTTPS app through external fetching. Raw redirect status, DNS records, certificate issuer/SAN/expiry and renewal alert were not captured because direct sandbox TLS is restricted. | Capture DNS and raw `curl -I`/certificate evidence from an authorized external client and verify expiry monitoring. |
| B-004 | BLOCKED | Backup and isolated restore tooling is tested, but no current production `last-run.json` / `last-drill.json`, offsite copy, measured RTO or accepted RPO was provided. | Configure host cron, run a real backup and isolated restore drill, and retain the no-secret evidence described in `docs/BACKUP_AND_RESTORE.md`. |
| B-005 | BLOCKED | External provider credentials/approvals and real sandbox/live transactions are not certified. Presence or a health flag is not transaction acceptance. | Test each applicable email, WhatsApp, SMS, social, Stripe, AI, n8n, media and voice integration separately after owner authorization. |
| B-006 | BLOCKED / POLICY DECISION | `/api/ai-gateway/health` is live, but `/api/ai-gateway/ready` reports `ready:false`: no application registry and no allowlisted real gateway provider. | Owner decides whether the shared gateway is mandatory. If yes, configure registry digests/caller tokens/provider policy and require `/ready` 200 before acceptance. |
| B-007 | BLOCKED | GitHub reports `main` as `protected:false`; protection details API is inaccessible to this integration. | Repository owner enables/verifies required review and exact-SHA `ci` checks through rulesets/branch protection. |
| B-008 | BLOCKED / OWNER-LEGAL | The public repository has no root license and GitHub reports no detected license. Public visibility does not grant commercial reuse rights. | Owner/legal counsel selects and approves a license. Do not add one by assumption. |
| B-009 | BLOCKED | There is no Git tag or GitHub release for `0.2.1`, and no signed release/deployment-window acceptance. | After all critical gates close, owner approves a tag/release and records rollback target and deployment window. |
| B-010 | BLOCKED | Active uptime, infrastructure, SSL-expiry, backup and security alert delivery was not evidenced. | Configure monitors and perform a test alert through the documented escalation route. |
| B-011 | BLOCKED | Real production admin bootstrap, forced password rotation, TOTP enrollment and representative role-boundary acceptance were not evidenced. | Authorized owner performs the account checks and records IDs/timestamps only, never credentials. |
| B-012 | BLOCKED | Full production browser/device/manual every-button, provider workflow, accessibility and load acceptance is not signed. | Execute the controlled QA matrix and retain results before handover acceptance. |

## Verified baseline (not blockers)

- Exact-SHA GitHub `ci` run `43230152821` passed on `8d62c85`.
- Local clean install completed; npm full and production audits found 0 vulnerabilities.
- Full test suite passed: 1,677/1,677, 0 failures/skips.
- ESLint and TypeScript passed.
- Production Next.js build and standalone asset verification passed.
- Nineteen migrations passed immutability/order checks; schema map/drift checks passed for 101 models,
  1,382 columns and 279 indexes.
- Live `https://bdtech360.com/api/health` reported healthy application `0.2.1`, connected MySQL/core
  schema, 44 agents and an active operations heartbeat at probe time.
- Live public feature and pipeline APIs returned real application data.

These facts do not replace the blocked production acceptance evidence above.

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
