# Software Factory Control Center — Operations Guide

**Date:** 2026-11-02 · **Branch:** `arena/d7d6a770-tech360`
**Audience:** BDTECH360 factory operators and engineers. This is an internal,
self-hosted control plane. It is not a customer-facing product.

---

## 1. What this is, and what it is not

This is a private control plane that repeatedly creates, configures, provisions,
isolates, monitors, upgrades, backs up and retires company application
configurations. It reuses one implementation of auth, RBAC, contacts, workflow,
documents, audit, notifications, reporting and integration adapters. It does not
replace the existing TECH360 CRM, portal, App Factory source generator or public
website; those routes, APIs and data remain untouched.

It is **not**:

- a template marketplace or a gallery of screenshots;
- a no-code promise that any conceivable application needs zero engineering;
- an external SaaS control plane or a mandatory paid dependency;
- a code-executing CI/CD runner, a container orchestrator or a DNS/registrar;
- an owner of WhatsApp, SMS, telephony, payment or email provider networks.

Every displayed status is derived from a database row or a computed check. There
are no placeholder metrics, fake activity or simulated deployment successes.

## 2. Where things live

| Path | Purpose |
|---|---|
| `prisma/schema.prisma` | 20 additive `Factory*` control-plane models (96 models total) |
| `prisma/migrations/14_software_factory_control_center/migration.sql` | 20 additive tables, no destructive SQL, no foreign keys to existing tables |
| `scripts/factory/gen-control-ddl.mjs` | regenerates the additive DDL and native-type map; `--check` is a CI gate |
| `src/lib/factory/control/` | pure policy kernel + catalog, health, backup, provision, releases, data, HTTP helpers |
| `src/app/api/factory/**` | 21 guarded JSON routes; all mutations require session + CSRF + RBAC |
| `src/components/admin/factory/` | Control Center shell, 15 panels, 15-step wizard, shared UI primitives |
| `src/app/admin/factory-control/page.tsx` | direct authenticated URL for the Control Center |
| `tests/factory-control-policy.test.ts` | pure policy tests (no DB) |
| `tests/factory-control-db.test.ts` | database-backed acceptance tests A–H |
| `scripts/factory/verify-http.mjs` | live HTTP acceptance runner against a running preview server |
| `docs/SFCC_ACCEPTANCE_RESULTS.md` | the actual command outputs and every result |

Entry points:

- Main console: `/#/admin` → **Product Factory → Software Factory Control Center**.
- Direct URL: `/admin/factory-control` (checks `/api/auth/me`, requires
  `ADMIN` or `SUPER_ADMIN`, and rejects accounts that must change password).

## 3. The 15 Control Center sections

The shell has 15 tabs: an overview plus the 14 sections required by the master
prompt.

| Tab | Reads from | Real actions |
|---|---|---|
| Control Center | `GET /api/factory/overview` | `POST /api/factory/bootstrap` (SUPER_ADMIN only) |
| Company Registry | `GET /api/factory/companies`, `GET .../[id]` | wizard, definition reuse, `PATCH .../[id]` registry metadata |
| Template Library | `GET /api/factory/templates` | create / validate / approve / new version |
| Module Library | `GET /api/factory/modules`, `GET .../[code]` | create / version / approve / impact analysis |
| Application Factory | `GET /api/factory/applications`, `GET .../[id]` | submit, activate, retire, health, config revision, privileged grant |
| Provisioning Queue | `GET /api/factory/jobs` | run a company-scoped background job |
| Deployment Center | `GET /api/factory/applications` | review environment, deployment model, domain, activation evidence |
| Release Management | `GET /api/factory/releases` | create / stage / approve / deploy / rollback |
| Integration Hub | `GET /api/factory/integrations` | refresh statuses, enable/disable adapters |
| Monitoring & Alerts | `GET /api/factory/monitoring` | run a real health check |
| Security & Audit Center | `GET /api/factory/audit` | global audit view (SUPER_ADMIN) or company-scoped view |
| Backup & Recovery | `GET /api/factory/backups` | create / verify / restore / export portable archive |
| Engineering Workspace | `GET /api/factory/engineering` | create / triage / approve change requests |
| Customer Administration | `GET /api/factory/records`, `reports`, `files` | create scoped records, upload/download files, run scoped jobs |
| Documentation & Help | `GET /api/factory/docs` | real pipeline, automated vs manual steps, document existence |

All `/api/factory/*` responses carry `Cache-Control: no-store`. Private data is
never cached by the browser.

## 4. Identity, roles and isolation

There are two independent authorization layers. **A company id in a URL, body or
UI is never trusted.**

1. **Platform layer** — `guard()` in `src/lib/api-guard.ts`: DB-backed scrypt
   sessions, HttpOnly cookie, CSRF double-submit, `ROLE_RANK` (12 roles),
   capability checks, read-only AUDITOR enforcement and per-IP rate limiting.
   `/api/factory/*` control-plane routes require `ADMIN`; business-data routes
   (`records`, `reports`, `files`, `jobs`) require `STAFF` plus the second layer.
2. **Company layer** — an explicit `FactoryCompanyMember` row keyed by
   `(companyId, userEmail)`. `resolveCompanyAccess()` checks active status,
   expiry, privileged-grant metadata (grantor + reason), role permissions and
   resource scope. Denials are written to `FactoryAuditEvent` and `AuditLog`.
   A `SUPER_ADMIN` with no matching grant is denied private business data.

Company roles: `COMPANY_ADMIN` (read/write/manage/audit), `COMPANY_USER`
(read/write), `COMPANY_AUDITOR` (read/audit only), `FACTORY_OPERATOR`
(privileged, time-limited, audited support grant with read/write/manage/audit).
Provisioning creates the definition's users plus one 7-day `FACTORY_OPERATOR`
grant for the operator, with a grantor, a reason and an expiry. That is an
explicit, revocable, audited grant — not an automatic unrestricted entitlement.

`FactoryCompany.tenantKey` is a server-issued identity secret. It is never
returned by the registry API, the company detail API or the portable backup.
Secrets are referenced by environment-variable *name* only; the definition
validator and the backup builder reject credential-shaped values.

## 5. Real statuses

`DRAFT`, `VALIDATED`, `PROVISIONING`, `TEST_FAILED`, `STAGING`,
`AWAITING_APPROVAL`, `LIVE`, `DEGRADED`, `ROLLED_BACK`, `RETIRED`. Company
statuses: `DRAFT`, `CONFIGURED`, `PROVISIONING`, `ACTIVE`, `SUSPENDED`,
`RETIRED`. Health: `HEALTHY`, `DEGRADED`, `DOWN`, `UNKNOWN`. Integration:
`AVAILABLE`, `NOT_CONFIGURED`, `UNAVAILABLE`, `DEGRADED`, `DISABLED`.

The state machine in `lifecycle.ts` refuses `DRAFT → LIVE`, refuses activation
without passed tests, a verified backup, non-`DOWN` health, an authorized
approval and (for dedicated instances) recorded deployment evidence. Retirement
preserves data and requires approval plus a verified final backup.

## 6. The 15-step Create New Company wizard

The wizard is literally 15 numbered steps, each backed by real inputs and API
calls:

| # | Step | What it does |
|---|---|---|
| 1 | Name & identity | name, unique slug, unique domain |
| 2 | Type, industry & template | company kind, industry, approved private template + version |
| 3 | Applications & modules | independently selectable modules; required ones locked |
| 4 | Branding, logo, colours & navigation | hex colours, product/logo text, navigation |
| 5 | Departments & teams | configurable organization units |
| 6 | Users & roles | company users and roles → explicit grants |
| 7 | Workflows, rules & SLA | pipelines, approval chains, SLA hours |
| 8 | Integrations | optional adapters, never marked connected without credentials |
| 9 | Storage, retention & backup | retention days, backup policy |
| 10 | Deployment environment | Model A / Model B, DEV / STAGING / PRODUCTION |
| 11 | Dependency, permission, cost & requirement review | honest dependency, permission, cost and classification review |
| 12 | Validation | `POST /api/factory/companies {action:"preview"}` — no writes |
| 13 | Isolated provisioning, automated setup & acceptance tests | `POST ... {action:"provision"}` — real job steps |
| 14 | Result review & activation approval | submit / activate through the application API |
| 15 | Access to the new company admin panel | links to the Control Center, direct URL and registry detail |

Normal flow: **Select template → Configure company → Select modules →
Validate → Provision → Test → Approve → Deploy → Monitor.**

The company definition is stored as a versioned row in
`FactoryCompanyDefinition`. Reusing an approved definition
(`POST /api/factory/companies {action:"reuse"}`) requires a new slug and new
users, produces a new tenant key, domain and data isolation, and never copies
another company's live customer records.

## 7. Deployment models

**Model A — shared platform, isolated tenant.** One installation; server-side
grants, scoped records, files, reports, jobs, audit events and integration
credentials. A browser-supplied tenant id is never accepted as authorization.

**Model B — dedicated instance.** The factory records the required separate
database, storage, credentials, deployment configuration and domain as explicit
manual steps. It refuses to mark a dedicated application `LIVE` without
recorded deployment evidence (≥20 characters). The control plane does **not**
create containers, DNS records, TLS certificates or separate databases: those
are real infrastructure operations requiring explicit approval. Nothing in the
product pretends otherwise.

## 8. Provisioning pipeline (what really happens)

`provisionCompany()` executes, in order, and records each step as
`PASS`/`FAIL` in `FactoryProvisionJob.steps`:

1. validate definition, template approval, module dependencies, secrets, custom fields;
2. create a unique company identity and tenant key;
3. write version 1 of the versioned company definition;
4. create explicit company grants + the audited operator grant;
5. generate a company-specific `ApplicationConfig` (safe merge, checksum, revision);
6. pin approved module versions;
7. initialize scoped module records (no live data from another company);
8. register integration adapters with honest status;
9. acceptance checks: identity, config, modules, permissions, isolation, template integrity, integrations;
10. create and verify a pre-activation backup;
11. run real health checks and create the initial release.

Failed provisioning leaves a `TEST_FAILED`/`FAILED` job and does not overwrite
any existing application, route or release.

## 9. Private library, versioning and production readiness

`bootstrapCatalog()` seeds 8 implemented shared capabilities (`identity`,
`contacts`, `workflow`, `documents`, `audit`, `notifications`, `reporting`,
`integration_hub`) and 4 approved templates (Company-in-a-Box, CRM, Support,
Projects). A template is marked `PRODUCTION_READY` only after its manifest,
capability, dependency, module-link and test-definition checks pass. Draft
versions cannot be provisioned. The library is private: it is never exposed
through customer portals or public APIs.

### Adding a new template or module (repeatable process)

1. **Classify** the requirement in Engineering Workspace: shared core, reusable
   module, configuration, or client extension. Record a change request.
2. **Implement** genuinely new logic in a controlled extension point; do not
   edit the shared core for a field, workflow, dashboard or module combination
   that configuration can express.
3. **Register** a DRAFT module/template through the library panels. The manifest
   must declare an *implemented* capability, dependencies, entity schemas,
   config keys, migrations, tests and acceptance criteria. Unknown capabilities
   are refused.
4. **Validate** the manifest/definition and all dependency and compatibility
   checks.
5. **Approve** the version (SUPER_ADMIN for releases). Only approved versions
   are selectable by the wizard.
6. **Analyze impact** for shared-module updates: dependent templates and every
   dependent application are listed, with per-application compatibility.
7. **Stage → approve → deploy → monitor → rollback** as needed. Breaking or
   downgrade changes are refused for automatic deployment.
8. **Record** the release, test results, migration plan and rollback point.

Client-specific customizations never modify the source template. When a
customization becomes reusable, it goes through review, testing, approval and
versioning as a new library version.

## 10. Configuration-only versus engineering

| Configuration only (no shared-core edit) | Requires implementation / migration / new integration |
|---|---|
| branding, logo, colours, navigation, departments, teams, roles, pipeline stages, form fields, notification rules, workflows, approval chains, SLA, message templates, reports/dashboards, integration settings, retention, module combinations | new business logic, new entity schema with a migration, a new external provider adapter, dedicated infrastructure, a shared-capability defect fix, a breaking version upgrade |

The wizard records `automatedSteps` and `manualSteps` in the generated config.
`docs` API and the Documentation tab state them explicitly. Requirement A–H
acceptance test H records automated versus engineering/manual approval steps.

## 11. Release, upgrade and rollback

`createUpgradeRelease()` computes an impact analysis (dependent templates and
applications) and a per-application semver compatibility report. Breaking or
downgrade results produce a `FAILED` release with a migration-plan note; they
are not deployable automatically. `stageUpgradeRelease()` updates a staging
application, never a live one. `approveRelease()` requires `SUPER_ADMIN` and a
meaningful note. `deployRelease()` requires a verified pre-deploy backup.
`rollbackRelease()` restores the last known-good configuration revision **and**
the exact module version pins, marks the application `ROLLED_BACK` and re-runs
health checks. Previous releases and customer data are never deleted.

## 12. Backup, verification and recovery

A backup payload contains: company metadata (without `tenantKey`), definition
rows, application config, config revisions, module pins, records, files,
releases, health checks, dependency manifest, checksums, counts and restore
instructions. `createBackup()` refuses secret-like payloads. `verifyBackup()`
recomputes the SHA-256, compares counts and scopes, and only then sets
`verifiedAt`. `restoreBackup()` refuses cross-company restore, creates a **new
STAGING** application inside the same company, restores records, files, grants,
revisions and pins, then runs health checks. The portable JSON archive is
downloadable from `/api/factory/backups?download=<id>` for off-host storage.

**A backup file is not verification.** Periodically run `verify` and an actual
restore in a test environment; record the result in the acceptance document.
Keep source, config, approved templates/modules, company definitions, DB dumps,
uploads, release metadata, deployment config and dependency manifests under
BDTECH360 control, separate from the primary host where practical.

## 13. Integration Hub

Provider logic is isolated behind `ADAPTERS` in `integrations.ts`. Current
adapters: `internal_events`, `internal_webhooks`, `email_smtp`,
`whatsapp_cloud`, `sms_gateway`, `telephony`, `payment_gateway`. Internal
adapters work with no external network. External adapters are enabled only with
their environment credentials and are never reported `AVAILABLE` unless an
explicit verification flag exists; otherwise the honest state is
`NOT_CONFIGURED`, `UNAVAILABLE`, `DEGRADED` or `DISABLED`.

- Enable/disable and refresh are recorded and audited.
- Missing environment keys are listed; no delivery, call completion, webhook
  processing or account access is fabricated.
- Provider fees, credentials, API approvals, template approvals, commercial
  restrictions and network ownership remain the operator's responsibility.
  BDTECH360 does not own any external network.
- Internal-only operation is the default when external providers are disabled;
  records and reports continue to work (acceptance test E).

## 14. Monitoring and health

`runHealthChecks()` recomputes: config checksum vs latest revision, approved
module pins, orphan records/files, active admin grants, integration honesty,
verified backups and lifecycle consistency. Results are persisted in
`FactoryHealthCheck`; `FactoryApplication.healthStatus` is updated from the
result. Monitoring tab lists real `DEGRADED`/`DOWN` alerts and can re-run a
check. Deployment approvals and activations require a non-`DOWN` health state.

## 15. Customer Administration and the company admin panel

Company-scoped business data is available through `records`, `reports`, `files`
and `jobs` APIs and the Customer Administration tab. Every call resolves an
explicit company grant and asserts the requested resource belongs to that
company. Cross-company attempts are denied and audited (acceptance test C).

**Known manual identity step:** company users are created as company-scoped
grants, not as shared platform login accounts. An operator who wants a company
administrator to sign in independently must create a platform `User` whose
email exactly matches a `FactoryCompanyMember` grant, with the least global
privilege needed, and deliver a one-time credential through an approved
channel. The wizard's final step states this. The Control Center itself is the
operator's company admin panel and is available through the operator's
explicit, time-limited grant.

## 16. Security checklist

- Sessions: DB-backed, HttpOnly, `SameSite=Lax`, `Secure` in production, lockout, optional TOTP.
- Mutations: CSRF double-submit, `guard()` RBAC, AUDITOR read-only, rate limits.
- Tenant isolation: server-side `FactoryCompanyMember` + resource scope assertions in every record, report, file, job, audit and integration operation.
- Secrets: names only in config/backup; `secretLikeReason()` blocks credential-shaped values; use environment variables, never the database.
- Files: MIME/extension allowlist, 5 MB limit, deterministic scan/quarantine, checksum verification, `DOCUMENT_SECURITY_HEADERS`, inline only for safe MIME types.
- Audit: `FactoryAuditEvent` + platform `AuditLog`, including every denial.
- Transport: TLS terminated by Caddy/Hostinger in production; HSTS, nosniff, frame and referrer headers are configured.
- Backups: no `tenantKey`, no credentials, verified restore, portable archive.
- Separation: DEV/STAGING/PRODUCTION are recorded per application; preview SQLite is refused when `NODE_ENV=production`.

## 17. Verification commands

```bash
# gates
npm run typecheck
npm run lint
npm run schema:check
node scripts/check-schema-drift.mjs
node scripts/factory/gen-control-ddl.mjs --check

# Prisma schema validation (offline engine stub; a dummy URL is enough because
# validate does not connect)
DATABASE_URL='mysql://user:pass@127.0.0.1:3306/tech360' \
PRISMA_SCHEMA_ENGINE_BINARY=/bin/true PRISMA_QUERY_ENGINE_LIBRARY=/bin/true \
  npx prisma validate --schema prisma/schema.prisma

# pure policy tests
npx tsx --test tests/factory-control-policy.test.ts

# database-backed acceptance tests (disposable preview database)
npm run preview:setup
PREVIEW_SQLITE_URL=file:$PWD/.preview/demo.db NODE_ENV=test \
  npx tsx --test tests/factory-control-db.test.ts

# live HTTP acceptance (server must be running)
PREVIEW_SQLITE_URL=file:$PWD/.preview/demo.db PORTAL_OTP=off npm run dev
node scripts/factory/verify-http.mjs

# full repository suite
npm test
```

`npm run build` is deliberately **not** used as a local gate here because it
executes `node scripts/prisma.mjs migrate deploy`, which touches a database.
Production builds regenerate the Prisma client from the MySQL schema and apply
migrations in the controlled deployment pipeline.

## 18. Explicit limitations and manual approvals

- Real container/DNS/database/TLS provisioning for Model B is a manual, approved infrastructure task.
- External provider accounts, fees, API approvals, template approvals and network availability are external dependencies.
- Billing/subscription enforcement and automatic live customer-data migration between versions are not implemented.
- No code-executing CI/CD runner is bundled; generated application source is managed by the existing reviewed App Factory.
- Independent company-user platform logins require the manual identity step in §15.
- No production database, destructive operation, deployment or external provider call was made while building this increment. Any such operation requires explicit approval and a verified recovery plan.

## 19. Licensing and third parties

No new runtime dependency was added for this increment. The control plane uses
the existing Next.js, React, Prisma, Tailwind and `lucide-react` stack already
present in the repository. `@prisma/adapter-libsql` and `@libsql/client` are
installed with `--no-save` only for the disposable local preview. See
`THIRD_PARTY_NOTICES.md`: reused projects are MIT-licensed and only ideas,
checklists and structure were reused; no proprietary source was copied, and
AGPL/GPL components were not integrated. Verify the license, redistribution
rights, commercial restrictions and self-hosting terms of any component before
adding it to the library.

## 20. Disaster recovery checklist

1. Export the portable archive of the latest **verified** backup.
2. Export the source repository, `prisma/schema.prisma`, migrations, `.env` *names*, approved template/module definitions, company definitions, release metadata, deployment config and dependency manifests.
3. Restore into a disposable STAGING application; verify counts, checksums, permissions, files and health.
4. Only then plan a controlled production restore with explicit approval and a rollback point.
5. Record the actual result, command and timestamp in `docs/SFCC_ACCEPTANCE_RESULTS.md`.
