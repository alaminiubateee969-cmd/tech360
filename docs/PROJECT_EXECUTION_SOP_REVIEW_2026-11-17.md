# Project Execution & Production Deployment SOP — repository-fit review

**Reviewed:** 2026-11-17 UTC
**Master workflow reviewed:** user-supplied SOP v1.0, Phases 01–24, including the proposed project-root tree.
**Repository baseline:** `main` at `59e3e339287698920ff40b09547c4cc24397c0eb` (PR #79); review work is on `arena/78fc673f-tech360`.
**Result:** SOP structure reviewed against the actual project. It is an execution checklist, not authorization to create accounts, deploy, migrate production data, or provision unused infrastructure.

## 1. Scope decision and phase disposition

| SOP phase(s) | Repository-fit result | Evidence / action boundary |
|---|---|---|
| 01 — Source and version | Mostly verified. GitHub PR inventory at review time: 79 PRs, 77 merged, none open, two closed without merge. #43's conflict payload was reconciled and preserved by #44; #9 is the retired alternate deployment path. No root license/tag was evidenced. | See `docs/REPOSITORY_AUDIT_2026-11-17.md`. License approval, protected-main policy and release tag remain owner/legal decisions. |
| 02 — Architecture audit | Source architecture, feature inventory, route/schema boundaries and implementation rationale are documented. | See `docs/IMPLEMENTATION_RATIONALE_REGISTER.md`, `docs/architecture/`, `docs/MASTER_SOP_V1_AUDIT_2026-11-14.md`. Historical evidence remains historical. |
| 03 — Stack and versions | Selected stack is Next.js/React/TypeScript, Node 22, npm, Prisma/MySQL, Hostinger-managed Node Web App and GitHub Actions. | Do not instantiate every candidate in the generic table. Redis, PostgreSQL, MongoDB, Docker, Compose, Nginx, PM2 and systemd are not the selected app stack. |
| 04 — Provider accounts | Account creation, business verification, billing, credentials and provider acceptance are owner/provider actions. | The repository documents variable names and setup, not real account values. No credentials are stored in this audit. |
| 05–06 — Server and project filesystem | Hostinger manages the app filesystem/runtime. The sample `/home/alamin/...` tree is appropriate only on an authorized self-managed Linux account. | Do not invent SSH access, server paths, or an alternate deployment. A safe per-project directory template and creation command are in §4. |
| 07 — Dependencies/build | Scripts, lockfile, lint/typecheck/tests/schema/build gates exist. Latest `main` CI is not green: the dependency audit failed before downstream jobs. | `picomatch@4.0.7` remains under a high-severity audit advisory. Local Prisma generation/typecheck may also be blocked where `binaries.prisma.sh` cannot be reached. No audit threshold is suppressed. |
| 08 — Database | MySQL is the only production database target; 19 migration directories are checked in at the reviewed baseline. | Production URL, grants, schema/migration inventory, CRUD/transactions and restore drill require the authorized Hostinger operator. Do not provision PostgreSQL/MongoDB/Redis for checklist completeness. |
| 09–12 — Environment, security, app config, accounts | Value-free environment inventory, fail-closed startup checks, auth/RBAC, OTP/TOTP, consent and security controls exist in code/docs. | Production values, real Super Admin bootstrap, rotation and role-boundary acceptance remain unverified. Never put secrets in the command below or in Git. |
| 13 — Integrations | Adapters and signature/configuration boundaries exist for selected channels. | Real provider setup and sandbox/live sends/payments are separately blocked pending owner authorization, credentials and acceptance evidence. A configured key is not a successful test. |
| 14 — Features | Core CRM, public site, portal, WebChat, AI workflow, finance/delivery controls, content tools and internal factory/planning modules have source and tests. The initial SMS journey is implemented as detailed in §2. | Some capabilities are explicitly not built or provider-gated (e.g. PayPal/SSLCommerz; actual media rendering). These are not silently claimed as complete or added to scope by this generic SOP. |
| 15 — QA | Automated tests and focused HTTP/security checks exist. | Full production browser/device, accessibility, load and every-provider sign-off is not evidenced. |
| 16–19 — Deploy, domain, DB, release | Hostinger Node.js Web App Git integration is the selected deployment path; repository has a production build/start contract and health/release identity. | Actual hPanel settings, exact deployed SHA, DB acceptance and live release are not verified. Build runs forward-only Prisma migrations; deploy only after owner-approved backup and target confirmation. |
| 20–21 — Operations, recovery | Health/metrics/audit/backup/restore tooling and runbooks exist. | Active external alert routing, current offsite backup, isolated restore evidence, measured RTO/RPO and rollback drill remain blocked until run on the real host. |
| 22–23 — Handover/support | Deployment, security, operations, backup, restore, rationale, SMS and WebChat runbooks exist. | Final release handover and post-handover support start only after owner acceptance; production support terms are not inferred. |
| 24 — Acceptance | The readiness utility reports `NOT_PRODUCTION_READY_BLOCKED` until external evidence gates close. | Do not label production ready based on source presence, a configured key, a preview, or CI alone. |

## 2. Initial SMS journey: source implementation and remaining acceptance

The inbound path is implemented in `src/app/api/webhooks/sms/route.ts`:

1. Accept the configured provider's JSON/form callback, require sender/body/provider message ID, normalize the phone to E.164, and reject malformed input.
2. Authenticate the explicitly selected provider: Twilio signature (`SMS_INBOUND_PROVIDER=TWILIO` plus `TWILIO_AUTH_TOKEN`), or a constant-time shared secret (`HTTPSMS`/`GENERIC` plus `SMS_WEBHOOK_SECRET`, at least 32 characters). An unset/unknown provider fails closed.
3. Claim an idempotent inbound webhook receipt; repeated provider event IDs do not create duplicate work.
4. Resolve an existing verified phone identity when one exists. For first contact, create/reuse a prospect via the existing `intakeLead` journey and issue the canonical Client ID without treating the phone as a verified CRM identity.
5. Persist the inbound communication/conversation state. Exact opt-out keywords (`STOP`, `STOPALL`, `STOP ALL`, `UNSUBSCRIBE`, `CANCEL`, `END`, `QUIT`) are handled deterministically before AI, set and audit the persisted opt-out, and do not trigger a discovery reply. Subsequent SMS replies/sends and SMS outbox retries are refused; the requested portal sign-in OTP is exempt. `START` does not silently reverse an opt-out. Other inbound messages call the shared conversation orchestrator and attempt SMS through the configured adapter; `NOT_CONFIGURED`/`FAILED` is not reported as delivery.
6. Formal/commercial stages use canonical email for full details where available; SMS response remains a short notice. STOP/opt-out implementation is covered by `tests/sms-policy.test.ts`; exact carrier-specific keyword coverage and whether a confirmation message is required must be checked for the chosen provider/jurisdiction.

Existing evidence: `tests/sms-policy.test.ts`, `tests/communication-integration-regressions.test.ts`, `tests/tech360-messaging-repair.test.ts`, `docs/implementation/COMMUNICATION_PIPELINE.md`, `docs/AI_AGENT_HUMAN_LOOP_DELIVERY.md`, `docs/MESSAGING_REPAIR_REPORT.md`. The code path and local policy tests are implemented; **real sender registration, inbound callback/signature test, outbound provider acceptance, carrier delivery and live provider credential checks are not verified here**. SMS is not production-accepted until those tests are recorded by the authorized provider/account owner.

## 3. Industry/security requirement check

This is an engineering evidence check, not a legal certification.

| Area | Source-level evidence | External/owner acceptance still needed |
|---|---|---|
| Authentication/access | Server-side RBAC, session protections, CSRF/rate limits and audit controls exist. | Real admin MFA enrollment and representative role-boundary test. |
| Privacy/contact | Contact-consent and separate marketing-consent paths; identity is not linked by raw email alone; chat session is signed. | Jurisdiction-specific privacy/retention/deletion/legal review and real production settings. |
| SMS/email | Consent and provider state are represented; inbound SMS is explicit-provider and signature/shared-secret gated; STOP keywords persist opt-out and suppress later SMS; local tests cover the source behavior. | Sender/carrier registration, real callback verification, provider contract, jurisdictional policy review, confirmation-message requirements and delivery evidence. |
| Payments | Approval and provider-signature/reconciliation controls exist; unbuilt processors are explicitly disabled. | Merchant/provider sandbox and authorized transaction acceptance. |
| Uploads/data | Validation/quarantine exists; no external antivirus result is fabricated. | Scanner selection if required, retention/access review and production storage evidence. |
| Release/security | Secret scan, migration gates and dependency audit exist; security threshold is not relaxed. | Current audit blocker resolution, protected `main`, owner-approved license/release, production backup/restore and monitoring evidence. |
| Industry-specific architecture/content | Global industry content, source register and software-factory blueprint define reference designs, USD-only content, governed-AI boundaries and physical IT/OT safety concepts; referenced standards include ISA-95/IEC 62264, HL7/FHIR, ISO 9001, FIDIC and AML/KYC practices. These are blueprints/content controls, not a certification or evidence that customer systems are deployed to those standards. | Domain expert review per engagement, applicability mapping to the actual jurisdiction, implementation evidence and independent audit/certification where required. Do not claim HIPAA, PCI DSS, ISO, SOX, FDA, IEC 62443 or other compliance from these docs alone. |
| Accessibility/performance | UI-level accessibility/performance checks and automated tests exist. | Full manual WCAG/accessibility, real device/browser and production load acceptance. |

No source audit can establish compliance with every law, provider contract, telecom rule or accessibility standard in every customer jurisdiction. Obtain the applicable legal/provider review; do not mark those items `PASS` merely because code or a consent checkbox exists.

## 4. Per-project directory structure instructions

The requested path pattern is `/home/alamin/projects/project-name/`. Use it only where the actual authorized Linux account home is `/home/alamin`; otherwise use that account's actual `$HOME`. Hostinger's managed Node Web App owns its app root, so this is **not** a replacement Hostinger deployment layout and does not authorize shell access there.

```text
/home/alamin/projects/<project-name>/
├── source/                         # Git checkout; canonical code and lockfile
├── config/
│   ├── development/                # value-free templates/docs only
│   ├── staging/                    # value-free templates/docs only
│   └── production/                 # names/metadata only; secrets injected by host
├── deployment/
│   ├── docker/                     # only when Docker is actually selected
│   ├── nginx/                      # only for a self-managed proxy
│   ├── systemd/                    # only for a self-managed service
│   └── scripts/                    # reviewed, non-secret operational scripts
├── database/
│   ├── migrations/                 # canonical migrations remain in source/prisma/
│   ├── seeds/                      # canonical seeds remain in source/prisma/
│   └── backups/                    # temporary encrypted copies only; offsite copy required
├── storage/                        # private persistent application files, not public web root
├── uploads/                        # quarantined/private uploads, not directly executable
├── logs/                            # access-controlled, redacted logs
├── releases/                       # immutable release/SHA artifacts, self-managed deploys only
├── reports/                        # redacted QA/readiness evidence
├── tests/                          # canonical tests remain in source/tests/
└── documentation/                  # canonical docs remain in source/docs/
```

**Do not create a second copy of migrations, tests, documentation or production config as competing sources of truth.** For this Tech360 repository, `source/prisma/migrations`, `source/prisma/seed.ts`, `source/tests/` and `source/docs/` remain canonical. Keep backups, uploads, secrets and customer data outside public/static paths. Do not use `chmod 777`; set ownership and least-privilege ACLs for the actual service user. Hostinger-managed Node deployment does not require creating empty Docker/Nginx/systemd directories.

### Safe directory creation command (self-managed Linux account only)

Run from a shell logged in as the project owner on the authorized server. The command is idempotent, creates directories only, and does not clone code, write secrets, change ownership, or configure a service. `umask 077` makes newly created directories private to that account; adjust ACLs deliberately only if the selected service runs as a different user.

```bash
set -eu
PROJECT_NAME="tech360"
case "$PROJECT_NAME" in
  ''|.|..|*/*|*[!A-Za-z0-9._-]*) echo "Invalid PROJECT_NAME" >&2; exit 2 ;;
esac
: "${HOME:?HOME must be set for the authorized project account}"
PROJECT_ROOT="$HOME/projects/$PROJECT_NAME"
umask 077
mkdir -p \
  "$PROJECT_ROOT/source" \
  "$PROJECT_ROOT/config/development" \
  "$PROJECT_ROOT/config/staging" \
  "$PROJECT_ROOT/config/production" \
  "$PROJECT_ROOT/deployment/docker" \
  "$PROJECT_ROOT/deployment/nginx" \
  "$PROJECT_ROOT/deployment/systemd" \
  "$PROJECT_ROOT/deployment/scripts" \
  "$PROJECT_ROOT/database/migrations" \
  "$PROJECT_ROOT/database/seeds" \
  "$PROJECT_ROOT/database/backups" \
  "$PROJECT_ROOT/storage" \
  "$PROJECT_ROOT/uploads" \
  "$PROJECT_ROOT/logs" \
  "$PROJECT_ROOT/releases" \
  "$PROJECT_ROOT/reports" \
  "$PROJECT_ROOT/tests" \
  "$PROJECT_ROOT/documentation"
printf 'Created/verified project directories under: %s\n' "$PROJECT_ROOT"
find "$PROJECT_ROOT" -maxdepth 3 -type d -print | sort
```

Do not run this command in the Arena sandbox expecting to create the real Hostinger account's filesystem, and do not apply it to the Hostinger managed app root unless Hostinger explicitly supports and authorizes that operation.

## 5. Format review and execution order

The user-supplied 24-phase checklist, provider matrix, per-variable checklist, database variants, QA matrix, acceptance table and directory tree were reviewed. They are useful as a **generic** acquisition/deployment format. The selected project-specific interpretation is documented above: use the actual MySQL/Hostinger path; mark unused technologies N/A; put external approvals in owner/provider action items; separate code implementation from live acceptance; and keep explicit evidence/status per phase.

Safe execution order remains: repository/PR and feature audit → exact stack/provider decisions → owner-managed accounts and values → verified MySQL backup and migration review → CI/local checks → Hostinger deployment of a reviewed `main` SHA → read-only health/release identity check → authorized live SMS/AI/email/payment acceptance → backup/restore/monitoring/accessibility acceptance → signed release/handover. Do not deploy the current review branch while the dependency-audit gate is unresolved.

## 6. Verification performed for this review

- `npm ci --ignore-scripts --no-audit --no-fund` — installed the locked packages; scripts were deliberately skipped, so Prisma Client generation did not occur.
- `npm run lint -- --no-warn-ignored` — **PASS**.
- `node --import tsx --test tests/sms-policy.test.ts tests/communication-integration-regressions.test.ts` — **PASS, 17/17 after the inbound and outbound SMS opt-out guards were added**.
- `npm run typecheck` — **BLOCKED/FAIL** because Prisma Client was not generated; downstream Prisma result types became unknown. `npx prisma generate` was attempted and failed because the sandbox could not establish TLS to `binaries.prisma.sh`.
- `tests/tech360-messaging-repair.test.ts` — attempted, but could not load the generated `.prisma/client/default`; therefore this suite is **not verified in this review**.
- `npm audit --omit=dev --audit-level=high` — **BLOCKED**, 12 high findings in the reported `picomatch` dependency graph. The full audit remains a release gate; no exception was added.
- No Hostinger deployment, production database action, live provider request, live SMS, or compliance certification was performed.
