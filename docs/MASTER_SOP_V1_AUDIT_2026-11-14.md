# TECH360 Master SOP v1.0 — Source, Build and Production Acceptance Audit

**Audit date:** 2026-11-14 UTC
**Repository:** `https://github.com/alaminiubateee969-cmd/tech360` (public, personal owner `alaminiubateee969-cmd`)
**Audited commit:** `8d62c852787c3e8e936b3b32ef2fdd45b391d0c6`
**Working branch:** `arena/8a6db089-tech360`
**Application version:** `0.2.1`
**Verdict:** **NOT PRODUCTION READY — BLOCKED EXTERNAL ACCEPTANCE EVIDENCE**

This is the current evidence boundary for the supplied Master SOP v1.0. `PASS` means the item was
proved by repository inspection, a local check, CI on the exact commit, or a live read-only probe.
`IMPLEMENTED / UNVERIFIED` means code and instructions exist but production execution is not proved.
`BLOCKED` means owner/provider/host access or authorization is required. `N/A` means the technology is
not selected by this application. No credential value was requested, read, generated for a provider,
or stored in this audit.

## 1. Executive decision

The application is extensive and internally coherent. Source quality gates, 1,677 automated tests,
type checking, linting, schema/migration invariants, dependency audits and a production Next.js build
all pass. The live apex serves the application, and its public health endpoint reported MySQL connected,
44 agents registered, an active operations heartbeat, and application version `0.2.1`.

It must nevertheless **not** be called Production Ready. The exact SHA running at Hostinger is not
published or independently tied to the audited SHA; a real production backup and isolated restore drill
are not evidenced; main is not protected; the repository has no root license or release tag; active alert
routing and provider transaction acceptance are not evidenced; and the shared AI gateway readiness route
currently reports `ready:false`. Those are acceptance blockers, not reasons to fabricate code.

## 2. Evidence captured in this audit

### 2.1 Source and GitHub

| Evidence | Result |
|---|---|
| Canonical origin | `https://github.com/alaminiubateee969-cmd/tech360.git` |
| Visibility / ownership | Public; personal repository owned by `alaminiubateee969-cmd`; session permission `ADMIN` |
| Default branch | `main` |
| Remote branch inventory | 60 branches at audit time; local checkout contains current branch and `main` |
| Tags / releases | 0 tags; no GitHub release — **BLOCKED owner release decision** |
| HEAD / main | Both `8d62c852787c3e8e936b3b32ef2fdd45b391d0c6` at audit time |
| Submodules / Git LFS | No `.gitmodules`; no `.gitattributes`; no LFS configuration found |
| License | No root `LICENSE`; GitHub reports `licenseInfo:null` — **BLOCKED owner/legal decision** |
| Access | GitHub API reports session permission `ADMIN` |
| Main branch protection | `protected:false`; protection details API returned 403 — **BLOCKED** |
| Exact-SHA CI | GitHub Actions `ci` run `43230152821` passed on `8d62c85` |

Public repository visibility does not itself grant a commercial-use license. No license was invented or
added because that is an owner/legal choice.

### 2.2 Current measured architecture

| Layer | Selected production technology |
|---|---|
| Web / API | Next.js App Router, declared `^16.1.1`, lockfile install `16.4.3`; standalone server output |
| UI | React `^19.0.0`, Tailwind CSS 4, TypeScript `^5` |
| Runtime | Node `>=22.0.0 <23`; npm lockfile |
| Data | MySQL via Prisma `6.19.3`; 101 models; 19 immutable migration directories |
| Auth | Custom credential/session auth, HttpOnly cookies, CSRF, optional staff TOTP, mandatory production portal OTP |
| RBAC | 12 canonical roles, server guards/capabilities, fail-closed view policy |
| Queue / worker | Durable MySQL `AgentJob` queue and in-process AI operations driver; Redis/BullMQ not selected |
| Cache | No required Redis cache; Redis phase is `N/A` unless architecture changes |
| Storage | Database/file records and host storage; external S3 is optional, not a current core dependency |
| AI | Gateway, OpenRouter/ZAI and private local-model adapters; human approval gates |
| Reverse proxy | Hostinger-managed Node.js Web App routing; application canonical redirects/headers |
| Process manager | Hostinger-managed runtime; PM2/systemd are not the selected deployment path |
| Container | Docker/Compose are retired and fail closed; not the selected production path |
| CI | GitHub Actions with disposable MySQL 8.0 |
| Operations | health/deep health, metrics, audit/error logs, backup evidence, ops heartbeat and admin views |

Measured repository inventory: 680 files under `src`, 250 API route files, 125 test/test-support files,
47 `*View.tsx` admin view modules, 101 Prisma models, 19 migrations, 97 environment variable names.

### 2.3 Clean quality baseline executed on 2026-11-14

| Check | Result |
|---|---|
| `npm ci --no-audit --no-fund` | PASS, 893 packages installed |
| `npm audit --audit-level=low` | PASS, 0 vulnerabilities |
| `npm audit --omit=dev --audit-level=low` | PASS, 0 vulnerabilities |
| Full tests (`npm test`) | PASS, **1,677/1,677**, 377 top-level tests / 352 suites, 0 skipped/failing |
| ESLint | PASS, 0 errors |
| TypeScript | PASS, `tsc --noEmit` |
| Production Next build | PASS, 89 static pages generated; dynamic routes compiled |
| Standalone assets | PASS, `.next/static` and `public` copied and matched |
| Migration immutability | PASS, 19 published migrations unchanged and ordered |
| MySQL schema map / drift | PASS, 101 models/tables, 1,382 columns, 279 indexes |
| Conflict markers | PASS, 1,603 tracked files scanned |
| Public image/assets | PASS, all referenced assets present and unique under enforced rules |
| Retired deployment paths | PASS, unsupported Docker/Cloud Build/deploy paths fail closed |

The direct `next build` used the generated offline Prisma client and did not apply a production
migration. Exact-SHA GitHub CI separately passed the repository's MySQL-backed pipeline. Neither is a
substitute for verifying the production migration table and backup.

## 3. Live domain and application probes

Read-only probes were performed through the available external page fetcher on 2026-11-14. Direct
sandbox `curl`/OpenSSL is network-restricted and could not capture raw response headers, certificate
chain details, redirect status codes or certificate expiry. The page fetcher successfully negotiated
HTTPS, followed the HTTP and `www` inputs to the canonical apex, and returned application content.

| Target | Observed result | Acceptance state |
|---|---|---|
| `https://bdtech360.com/` | Real TECH360 homepage returned; title `TECH360 — Enterprise Software, Automation & Digital Transformation` | PASS for content/routing |
| `http://bdtech360.com/` | Fetch resolved to final `https://bdtech360.com/` | PASS for redirect destination; exact 301/308 header still needs raw capture |
| `https://www.bdtech360.com/` | Fetch resolved to final `https://bdtech360.com/` | PASS for canonical destination and trusted TLS negotiation; exact status/cert SAN/expiry unrecorded |
| `https://bdtech360.com ` | A trailing space is not part of a valid URL/hostname and must be trimmed by the client; canonical URL is the no-space form | N/A as a distinct domain |
| `/api/health` | `healthy`; app `tech360-platform`; version `0.2.1`; MySQL connected/core schema available; 44 agents; ops cycle #14399, heartbeat 8s; uptime 8,755s | PASS at probe time |
| `/api/features` | maintenance false; website/blog/case studies/support/portal/payments true | PASS |
| `/api/pipeline/public` | Seven-step public journey and canonical domain returned | PASS |
| `/api/ai-gateway/health` | Liveness `ok` | PASS liveness only |
| `/api/ai-gateway/ready` | `ready:false`; no app registry; no gateway applications; no allowlisted real gateway provider | **BLOCKED if shared gateway is required** |
| Protected admin API | Anonymous content did not expose protected operational data; raw status/method-specific assertion still required by `health-check.sh` | IMPLEMENTED / raw live check pending |

The top-level health route uses the selected agent execution provider and currently sees OpenRouter
configured. The shared AI gateway is a separate, optional-by-current-routing component and correctly
fails readiness. If production policy requires all agent traffic through that gateway, this is a
critical blocker until `AI_GATEWAY_APPS`, caller token digests and provider policy are configured and
`/ready` returns 200.

## 4. Master SOP phase-by-phase disposition

### Phase 01 — Project acquisition and source verification (01.01–01.24)

| Items | State | Evidence / action |
|---|---|---|
| 01.01–01.10 | PASS | URL, public visibility, personal owner, admin access, HTTPS clone origin, `main`, 60 remote branches, zero tags/releases, exact HEAD, no submodules/LFS recorded above. |
| 01.11–01.12 | **BLOCKED** | No root license. Owner/legal counsel must choose commercial-use terms. |
| 01.13–01.19 | PASS | Full source/docs/deployment/CI/env/test/build inventories inspected; measured inventory above. |
| 01.20–01.23 | PASS (repository scope) | CI secret scan/conflict scan and tracked-file review found no committed production secret/database/private-key/upload payload; host filesystem remains outside scope. |
| 01.24 | PASS | Version and SHA recorded above. |

**Outputs:** this report is the Source Repository Audit, Version Record and current Initial Risk Report.

### Phase 02 — Complete source and architecture audit (02.01–02.30)

| Items | State | Evidence / action |
|---|---|---|
| 02.01–02.09 | PASS | Next/React frontend; Next route backend; REST handlers; Prisma/MySQL; auth/RBAC; 47-view admin console; portal and employee roles mapped. |
| 02.10–02.18 | PASS | MySQL queue/ops driver, scheduled triggers, signed webhooks, file extraction/scanning, omnichannel adapters, AI providers, payment governance, reports/analytics and notifications found. |
| 02.19–02.23 | PASS | External/internal dependencies, 19 migrations, seed, preview/demo builders inventoried. |
| 02.24–02.26 | PASS with declared boundaries | Placeholder and `INTEGRATION_NOT_BUILT` paths are deliberate fail-closed states; lint/typecheck/build prove no broken imports. PayPal and SSLCommerz remain explicitly unbuilt. |
| 02.27–02.29 | PASS for automated gates | Security suites and npm audits pass; deprecated install notices require planned upgrade testing, not blind major upgrades. Runtime build passes. |
| 02.30 | PASS | Schema relations, API routes, architecture docs and the operations guide map feature→API→database. |

**Outputs:** architecture maps under `docs/architecture`, inventories under `docs/audit`, and this current gap report.

### Phase 03 — Technology selection and version planning (03.01–03.10)

**PASS for source/design.** The final stack is the measured matrix in §2.2. Node 22 is pinned by
`engines` and CI; npm lockfile pins resolved dependencies; Debian/Linux-compatible standalone output is
used; MySQL 8 is the CI baseline. Development uses a disposable libSQL adapter, CI uses disposable MySQL,
and production uses Hostinger MySQL. Licensing is documented per dependency, but the repository-level
license decision is **BLOCKED**. Production sizing and host resource inventory require hPanel evidence.

### Phase 04 — External account creation and provider onboarding (04.01–04.15)

**BLOCKED — authorization required.** The code and environment register cover GitHub, domain/DNS,
Hostinger/MySQL, SMTP/Hostinger Mail, Google/OAuth where selected, Meta/WhatsApp/social, SMS, Stripe,
AI providers, monitoring, storage/media/voice and n8n. Account creation, phone/business verification,
MFA, billing, plans, credential creation, callbacks, live tests and renewal ownership must be completed
by an authorized company representative. Exact variable names are in `.env.example` and
`docs/HOSTINGER_ENVIRONMENT_VARIABLES.md`; no secret value belongs in this report.

### Phase 05 — Production server preparation (05.01–05.30)

**IMPLEMENTED / BLOCKED host evidence.** Node 22, npm, Git, MySQL, runtime directories, logs, backup,
monitoring and resource requirements are documented. The selected Hostinger Node.js Web App does not
use Docker, Compose, Nginx, PM2 or systemd under application control; 05.12–05.15 are therefore
provider-managed/N/A rather than missing code. CPU/RAM/disk/OS, firewall/SSH, timezone/NTP, mounts,
process/container/port inventory and current domain association require hPanel/server inspection.

### Phase 06 — Project directory and source deployment preparation (06.01–06.15)

**PASS for repository; BLOCKED host layout.** Clone/branch/commit, ignore rules, standalone output,
secret exclusion and release metadata mechanisms exist. Hostinger manages its own application root;
the SOP's sample `/home/alamin/...` hierarchy must not be invented. Service-user ownership,
permissions, source archive and release directories must be evidenced on the actual host. Legacy
self-hosted deployment files remain retired intentionally.

### Phase 07 — Dependency installation and build preparation (07.01–07.20)

**PASS.** npm/lockfile, Node 22, 893-package clean install, native Prisma generation path, audits,
licenses, declared deprecated-package warnings, scripts, typecheck, lint, 1,677 tests, production build
and standalone asset verification were executed. MySQL-backed CI passed on the exact SHA. The build
failure report is empty for this baseline.

### Phase 08 — Database infrastructure creation

| Items | State |
|---|---|
| 08.MY.01–08.MY.12 | IMPLEMENTED / production details **BLOCKED**. MySQL is the selected engine; schema/migrations/indexes/constraints/seed/backup tooling exist. Database creation, dedicated least-privilege user, grants, utf8mb4 collation and exact URL must be verified in Hostinger. |
| 08.PG.*, 08.MG.*, 08.RD.* | N/A. PostgreSQL, MongoDB and Redis are not required by the selected production architecture. Do not provision unused databases merely to satisfy a generic matrix. |
| 08.DC.01–08.DC.07 | PASS in CI and live health for connection/core schema; production CRUD/transaction/persistence acceptance still needs a controlled operator test. |
| 08.DC.08–08.DC.10 | **BLOCKED**. Code supports isolated backup/restore and least privilege; real host artifacts, restore PASS and grants must be captured. |

### Phase 09 — Environment variable collection (09.01–09.15)

**PASS for register/validation; BLOCKED values/provider tests.** Ninety-seven value-free names are in
`.env.example`; source usage, required/optional meaning, source, format, masking, startup validation,
invalid-value tests and rotation instructions exist. Actual credentials, connection tests, expired-token
tests and rotation records require authorized provider access.

### Phase 10 — Security and secrets management (10.01–10.30)

**PASS for implemented controls; BLOCKED operational evidence.** Secret generation guidance, hPanel
storage, env isolation, Git scans, runtime injection, least privilege guidance, TOTP, scrypt passwords,
secure sessions/cookies, CSRF, same-origin policy, rate limits, lockout, upload validation/quarantine,
SQL/XSS/SSRF/auth tests, audits, TLS application policy, audit logs, rotation, incident response and leak
revocation are implemented/tested. Production file permissions, all-admin MFA enrollment, external
malware scanner, provider token scopes, raw TLS certificate details and completed rotation drill require
operator evidence.

### Phase 11 — Application configuration (11.01–11.28)

**PASS for code/configuration contracts.** Canonical URL/origin, same-origin API communication, OAuth
callback register, sessions/cookies, upload/file storage, channels, queue/worker/ops driver, timezone,
locale/currency defaults, feature flags, logs/errors/retries/timeouts/pagination/rates, admin bootstrap,
seed and production-only validation exist. Production values and demo cleanup remain operator checks.

### Phase 12 — Authentication and account initialization (12.01–12.25)

**PASS for implementation; BLOCKED real-account acceptance.** Login/logout/session, password change,
portal OTP, TOTP, 12 roles/capabilities, invitation/team management, lock/suspension, deletion governance,
password policy and audit are implemented. Registration is business-controlled rather than open public
signup. Initial Super Admin seed, forced password rotation, TOTP enrollment and real role-boundary tests
must be run by the owner without exposing credentials.

### Phase 13 — External integrations (13.01–13.20 per integration)

**IMPLEMENTED / BLOCKED provider acceptance.** Each adapter has configuration, auth/signature,
timeout/retry/error and honest state handling. Provider accounts, permissions, callback/webhook setup,
token refresh where applicable, sandbox transactions/messages, failure tests, alerts, live approval and
rotation evidence are required independently for email, WhatsApp, SMS, social, Stripe, AI, storage,
media, voice and n8n. PayPal/SSLCommerz are `INTEGRATION_NOT_BUILT` and cannot be enabled as live.

### Phase 14 — Feature implementation and completion (14.01–14.20 per module)

**PASS for shipped module contracts.** UI/API/database/business rules, guards, validation, loading/empty/
success/error states, notifications, audit and automated tests are present across public site, CRM,
portal, finance/delivery, AI workforce, content, factory and operations modules. Feature evidence is
spread across the 1,677-test suite and operations guide. Provider-dependent acceptance remains blocked
under Phase 13 rather than being represented as fake success.

### Phase 15 — Complete functional QA (15.01–15.30)

**PASS automated baseline; BLOCKED full manual device/provider certification.** Public pages, auth,
admin, users/roles, modules/forms/APIs/database operations/search/filter/report/notifications/jobs/
webhooks/scheduled tasks/uploads/payments/error/permission boundaries are heavily covered. Automated
accessibility, SEO, image and performance policy checks exist. A signed browser/device matrix,
third-party live workflows, production load test and manual every-button walkthrough are not evidenced.

### Phase 16 — Deployment configuration (16.01–16.20)

**PASS for selected Hostinger path; BLOCKED runtime settings evidence.** Production standalone build,
secret injection contract, health checks, port via platform `PORT`, startup preflight, restart behavior
and DB/worker checks are implemented. Docker/Compose/PM2/systemd are N/A/retired because Hostinger's
managed Next.js runtime is selected. Capture hPanel Node 22, repository/branch/SHA, `build`, `.next`,
`npm start`, runtime port and restart logs.

### Phase 17 — Domain, DNS, Nginx and SSL (17.01–17.19)

**PARTIAL PASS / BLOCKED raw infrastructure evidence.** Apex, HTTP input and `www` all reached the
canonical HTTPS application through external fetching; apex and `www` TLS were trusted by that client;
security headers and canonical redirects are configured in source. Domain ownership, DNS zone records,
Hostinger attachment, provider-managed proxy/WebSocket/body/timeouts, raw redirect codes, certificate
issuer/SAN/expiry/renewal and SSL expiry alert still require DNS/hPanel and raw-header evidence. Nginx is
provider-managed and no unsupported second proxy should be deployed.

### Phase 18 — Production database and data validation (18.01–18.16)

**BLOCKED acceptance evidence.** Live health proves a MySQL connection and core schema at the probe time.
It does not prove the exact migration table, safe production seed, initial-admin rotation, controlled
CRUD/transaction/index/query performance/data consistency, file consistency, backup integrity, restore,
retention execution or sensitive-access review. Execute the documented read-only verifier and controlled
acceptance plan with owner approval.

### Phase 19 — Production deployment and release (19.01–19.20)

**PARTIAL PASS / BLOCKED release identity.** A live application and exact-SHA green CI exist, but no tag,
GitHub release, hPanel deployed-SHA evidence, deployment-window record, pre-deploy backup, post-deploy
login/critical/provider/worker checks, log review, traffic evidence, owner acceptance or rollback proof
was provided. Do not infer that version `0.2.1` means audited SHA `8d62c85` is deployed.

### Phase 20 — Monitoring and operations (20.01–20.20)

**IMPLEMENTED / BLOCKED active external monitoring.** Health/deep-health, database/AI/queue state,
metrics, audit/error/automation logs, SSL and backup procedures, alert webhook configuration, incident
escalation, log/maintenance guidance and Ops views exist. Evidence of uptime checks, CPU/RAM/disk/network
monitoring, alert delivery, SSL-expiry notification, log rotation and maintenance calendar is required.

### Phase 21 — Backup, disaster recovery and rollback (21.01–21.17)

**IMPLEMENTED / BLOCKED production proof.** Consistent compressed MySQL dumps, checksums, retention,
offsite copy options, failure alert, isolated restore drill, DR and rollback procedures, RPO guidance and
incident templates exist. Actual cron, encrypted/offsite copy, current dump, checksum, restore PASS,
measured RTO, accepted RPO and retained prior release are not evidenced.

### Phase 22 — Documentation and handover (22.01–22.30)

**PASS for technical documentation; BLOCKED approval.** Project/source/version/stack/architecture/server/
database/migrations/env/providers/integrations/domain/SSL/deploy/restart/backup/restore/rollback/
monitoring/admin/user/API/test/security/issues/maintenance/support materials exist. Some historical docs
retain their dated evidence and must not be treated as current. Subscription/renewal ownership and signed
handover approval require the owner.

### Phase 23 — Post-handover support (23.01–23.15)

**BLOCKED future operational period.** Stabilization, monitoring, bug/security/dependency work, token/SSL/
subscription renewals, backup/restore reviews, feedback/change control, release notes and monthly reports
are documented processes. They cannot be completed in advance or without owner/provider access.

### Phase 24 — Final production acceptance

| Acceptance area | Current state |
|---|---|
| Source | PASS — repository and SHA recorded |
| Technology | PASS — measured stack/version report |
| Accounts | BLOCKED — provider ownership/renewal/approval evidence incomplete |
| Database | BLOCKED — live connection seen; migration/CRUD/backup/restore acceptance incomplete |
| Environment | PASS code validation / BLOCKED actual host inventory evidence |
| Security | PASS automated controls / BLOCKED production access/MFA/TLS audit |
| Build | PASS |
| Testing | PASS automated; BLOCKED full manual/provider/device certification |
| Authentication | BLOCKED real production user/role/MFA evidence |
| Integrations | BLOCKED per-provider sandbox/live acceptance |
| Deployment | PARTIAL — live app/health; exact deployed SHA and hPanel config blocked |
| Domain | PARTIAL — canonical HTTPS content reached; raw DNS/redirect/cert-expiry evidence blocked |
| Data | BLOCKED persistence and restore evidence |
| Monitoring | BLOCKED active alerts/infrastructure monitor evidence |
| Recovery | BLOCKED verified rollback and production restore |
| Handover | BLOCKED owner approval |

**Final verdict: NOT PRODUCTION READY.**

## 5. Required owner/provider action register

| ID | Owner action | No-secret evidence to retain |
|---|---|---|
| A-01 | Approve a repository license and commercial-use policy | LICENSE commit / legal approval reference |
| A-02 | Protect `main` with required exact-SHA CI and review | Ruleset screenshot/export; required check name |
| A-03 | Confirm Hostinger app source, branch, deployed SHA, Node 22, build and start commands | Redacted hPanel fields and build/runtime log identifiers |
| A-04 | Verify MySQL identity, grants, migration history, charset/collation and controlled CRUD/transaction checks | Redacted DB report; no URL/password |
| A-05 | Run current backup, checksum, offsite copy and isolated restore drill | `last-run.json`, `last-drill.json`, measured RTO, accepted RPO |
| A-06 | Configure external monitoring and test alert delivery | Monitor IDs, destinations, test timestamps, SSL expiry threshold |
| A-07 | Decide whether the shared AI gateway is mandatory; if yes, configure its registry/policy | `/api/ai-gateway/ready` 200 body without tokens |
| A-08 | Accept and test each applicable provider separately | Provider account owner, environment, callback, test ID, result, renewal date |
| A-09 | Execute admin bootstrap, remove temporary password, force change and enroll TOTP | User ID/role and timestamps only |
| A-10 | Capture raw DNS, redirect and certificate evidence | A/AAAA/CNAME, 301/308 chain, issuer/SAN/notBefore/notAfter |
| A-11 | Approve release version/tag and deployment window after all blockers close | Tag, release, SHA, approvals, rollback target |
| A-12 | Sign final handover/acceptance | Signed approval reference and support start/end dates |

## 6. Provider account and credential inventory (names only)

Do not paste values into chat, tickets, Git or this document.

| Provider class | Account/setup owner action | Credential/configuration names |
|---|---|---|
| GitHub | Confirm canonical repo, MFA, protected branch, deploy integration | Hostinger Git integration/deploy authorization; no PAT in repo |
| Domain/Hostinger | Confirm registrar/zone, apex + www, Node app attachment, SSL auto-renew | DNS access and hPanel role managed out of band |
| MySQL | Dedicated database/user, least privilege, utf8mb4, backups | `DATABASE_URL` |
| Core application | Generate independent ≥32-char random secrets | `SESSION_SECRET`, `PORTAL_SECRET`, `OPS_SECRET`, `IDENTITY_HASH_SECRET` |
| AI | Approve provider/data policy/billing and models | `AI_GATEWAY_BASE_URL`, `AGENTOS_GATEWAY_TOKEN`, `AI_GATEWAY_APPS`, `OPENROUTER_API_KEY`, `ZAI_BASE_URL`, `ZAI_API_KEY`, local-model names |
| Email | Verify sender/domain, SPF/DKIM/DMARC, webhook | `SMTP_*`, `EMAIL_WEBHOOK_SECRET`, optional `HOSTINGER_MAIL_*` |
| Meta/WhatsApp/social | Business/app/phone verification, scopes, callbacks | `WHATSAPP_*`, `FACEBOOK_PAGE_TOKEN`, `INSTAGRAM_TOKEN`, `LINKEDIN_TOKEN`, `X_TOKEN`, `SOCIAL_WEBHOOK_SECRET` |
| SMS/voice | Sender/number registration and inbound signature | `SMS_*`, `HTTPSMS_*`, `TWILIO_*`, `SIP_DOMAIN` |
| Payment | Merchant verification; Stripe test mode before live approval | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`; manual payment settings |
| n8n | Private deployment, bridge auth, import/review inactive workflows | `N8N_WEBHOOK_BASE`, `N8N_WEBHOOK_SECRET` |
| Media/storage | Approve licensed renderer/storage and retention | `MEDIA_RENDER_*`, `TTS_*`, `MUSIC_PROVIDER_URL`; offsite backup configuration |
| Monitoring | Create uptime/error/SSL/backup alerts and escalation | Provider-specific DSN/webhook if selected; no mandatory vendor in code |

## 7. Execution order (Master SOP Steps 01–15)

1. **Complete:** source/repository acquired and audited.
2. **Complete:** technology and integration requirements identified.
3. **Partial:** domain is serving; host ownership/config evidence is still required.
4. **Selected:** MySQL and host storage; offsite backup provider remains owner-selected.
5. **Blocked:** verify production database account/grants and credentials out of band.
6. **Blocked:** authorize only applicable SMTP/OAuth/Meta/WhatsApp/payment/AI accounts.
7. **Blocked:** configure callback/webhook credentials and retain redacted test evidence.
8. **Complete:** value-free environment variable register exists.
9. **Implemented / verify host:** hPanel secret storage and startup validation.
10. **Complete in source:** integrations and application configuration are implemented/fail closed.
11. **Complete baseline:** install, build, migrations in CI, tests and audits pass.
12. **Partial:** application/domain are live; exact Hostinger SHA/config and raw SSL evidence blocked.
13. **Blocked:** real auth, critical workflow and provider acceptance tests.
14. **Blocked:** active alerts plus real backup/restore/rollback proof.
15. **Blocked:** owner release and handover acceptance.

## 8. Repeatable readiness command

```bash
npm run readiness:check                # source evidence; read-only; never prints values
npm run --silent readiness:json        # machine-readable output without npm's banner
npm run readiness:live                 # optional external probes; run where production is reachable
node scripts/master-sop-readiness.mjs --strict  # exits 2 while critical gates are blocked
```

The collector intentionally returns `NOT_PRODUCTION_READY_BLOCKED` until external acceptance evidence is
closed. It does not mutate the database, create provider accounts, inspect secret values, or claim that
a configured credential has completed a real transaction.
