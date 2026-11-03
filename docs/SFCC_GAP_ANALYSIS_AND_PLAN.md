# Software Factory Control Center — inspection, gap analysis and plan

**Date:** 2026-11-02 · **Branch:** `arena/d7d6a770-tech360` · **Baseline commit:** `8d08ee5`
**Scope of this document:** required pre-implementation output for the BDTECH360
"Private Company & Software Factory" master prompt (section 17). It records what
was actually inspected, what already exists, what is missing, the risks, the
licensing position, and the incremental implementation plan with acceptance tests.

---

## 1. What was inspected

| Area | Finding |
|---|---|
| Runtime | Next.js 16 App Router, React 19, TypeScript 5, Tailwind 4, Prisma 6.19.3 → MySQL in production. Node 22. `npm ci` + `npm run build` + `npm test` are the real gates. |
| Surfaces | One codebase: public hash-routed site (`src/app/page.tsx`), client portal, and a lazy-loaded private admin console (`src/components/admin/AdminApp.tsx`). No separate factory service exists. |
| Auth / RBAC | `src/lib/auth.ts` (scrypt passwords, DB sessions, HttpOnly cookie, lockout, 2FA), `src/lib/api-guard.ts` (session + role + capability + AUDITOR read-only + CSRF double-submit + per-IP rate limit), `src/lib/access-policy.ts` (12 roles, 21 capabilities; `src/lib/constants.ts` `ROLE_RANK` also has 12). All admin API routes use `guard()`. |
| Audit | `src/lib/security.ts::audit()` → `AuditLog`. `src/app/api/admin/logs/audit`, `logs`, `logs/errors`, `logs/automation` exist. |
| Data model | `prisma/schema.prisma`: 76 models, 1,796 lines; 16 committed MySQL migrations at baseline (17 after the additive control-plane migration). A strict local drift gate (`scripts/check-schema-drift.mjs`, `tests/schema-ddl-parity.test.ts`) compares every model/column/index/default to the DDL. `scripts/mysql-schema-map.json` is the native-type contract. |
| Existing "factory" | `src/lib/factory/blueprint.ts` (33 KB) is an **AI Software Factory**: one client brief → deterministic plan → generated Next.js/Prisma source tree stored in `GeneratedAppFile`, review → approval → ZIP handover. APIs under `/api/admin/factory/apps/*`, UI `FactoryView`. It has scope binding/approval gates (`scope-manifest.ts`, `verify-scope.ts`, `scope-gate.ts`) and refuses to persist secrets in generated files. |
| Existing reusable modules | Contacts/leads/clients (`Client`, `Lead`), workflow definitions (`WorkflowDefinition`, `Sop`), documents (`FileRecord`, `src/lib/files.ts` with MIME scanning), audit, notifications, integration adapters (`src/lib/comms.ts`, `mail/`, `telephony.ts`, `webhooks/*`), reporting, skills/agents/model hub, backups (`/api/admin/backup`, `scripts/backup/*`, `docs/BACKUP_AND_RESTORE.md`). |
| Isolation model | **Single-company platform.** `Client`/`Project`/`Invoice`/`FileRecord` have no tenant/company boundary; portal access is per CRM client. There is no company registry, no tenant key, no per-company role assignment, no cross-company isolation test. |
| Deployment | `deployment/Dockerfile`, `deploy.sh`, `backup.sh`, `Caddyfile`, `DEPLOYMENT.md`, Hostinger/cPanel docs. Deployments are for **this one application**, not for generated per-company instances. |
| Development DB | `scripts/preview/setup.mjs` builds a disposable SQLite DB from the same schema and seeds it. Verified working in this environment (76 tables seeded). Preview is refused in production. |
| Test baseline | `npm test` → **1,119 tests / 1,111 pass / 8 fail** before any change. The 8 failures are pre-existing: DB-backed suites (`database-workflows`, `governance-db`, `governance-outbound-db`) require a live MySQL, plus 4 contract-text assertions in communication-pipeline/monitoring suites. They are unrelated to this work and were not touched. |

## 2. Gap analysis against the master prompt

Legend: **PRESENT** = real implementation exists · **PARTIAL** = related capability exists but not at the required level · **MISSING** = no implementation.

| # | Requirement | Baseline | Notes / risk |
|---|---|---|---|
| 3 | Separate "Software Factory Control Center" | **MISSING** | Only a source-generating "App Factory" panel exists; it is not a control plane. |
| 3.1 | Company creation + lifecycle | **MISSING** | `Client` is a CRM lead/customer, not a company instance. |
| 3.2 | Private template management | **PARTIAL** | `PromptTemplate`, `Sop`, `Skill`, `WorkflowDefinition` are internal libraries; no versioned application templates with module composition, test definitions, upgrade/rollback procedures. |
| 3.3 | Reusable module library | **PARTIAL** | Many capabilities implemented once, but no registry, no version pins, no dependency/impact analysis. |
| 3.4–3.5 | Company-specific configuration / generation | **MISSING** | `GeneratedApp.brief` is a one-off source-generation brief; no reusable company definition. |
| 3.6–3.7 | Version/release + environments | **PARTIAL** | `SkillVersion`, `GeneratedAppEvent` exist; no release approvals, compatibility checks or rollback for company apps. |
| 3.8 | Tenant isolation and permissions | **MISSING** | Highest risk: no tenant boundary anywhere. A tenant ID in the UI would be the only "isolation" if added naively. |
| 3.9–3.10 | Monitoring / backup / rollback | **PARTIAL** | Honest host-level backup status and health routes exist; nothing application-instance scoped or restorable through the factory. |
| 3.11–3.12 | Integration/dependency registry, engineering workspace, audit | **PARTIAL** | `integrations` view + `AuditLog` + change/approval records exist, but not scoped to a factory or release workflow. |
| 4 | Template library with production-readiness gating | **MISSING** | No template acceptance criteria/test results. |
| 5 | Build-once module architecture, impact analysis, non-breaking upgrades | **MISSING** | No dependency graph. |
| 6 | 15-step Create New Company wizard | **MISSING** | No wizard, no validation, no acceptance test runner, no version-controlled definition. |
| 7 | Model A shared tenant / Model B dedicated instance | **MISSING** | Both require real isolation. Model B additionally requires infra we cannot honestly claim to have created. |
| 8 | Central company registry (parent/sister/client, contract, backups, releases) | **MISSING** | |
| 9 | Configuration-driven differences + explicit engineering boundary | **MISSING** | |
| 10 | Managed lifecycle with approvals, staging, rollback, decommission | **MISSING** | |
| 11 | Engineering workspace (change requests, triage, impact, release approval) | **MISSING** | |
| 12 | Independently selectable business modules | **PARTIAL** | Capabilities exist globally; not selectable per application. |
| 13 | Integration Hub with replaceable adapters, honest status | **PARTIAL** | Adapters exist and are honest, but no registry/health per company and no disable-and-continue test. |
| 14 | Security | **PARTIAL** | Strong auth, RBAC, CSRF, rate limits, file scanning, audit exist. Tenant isolation, least-privilege factory admin, and secret handling for the new plane are MISSING. |
| 15 | Verified export/restore of company apps | **MISSING** | Existing backups are host-level MySQL dumps; no app-level verified restore. |
| 16 | 13-view professional dashboard with real statuses | **MISSING** | 40+ admin views exist; none cover the control center. |
| 18 | Acceptance tests A–H | **MISSING** | No factory-control test suite. |

**Preserved assets:** all 76 models, all ~200 API routes, the AI Software Factory,
portal, site, backup tooling, governance and all existing tests remain untouched
in behaviour. This work is **additive**: new tables, new `/api/factory/*` routes,
new admin view, new tests, new docs. No destructive migration, no route removal,
no data deletion.

## 3. External dependencies and licensing position

* No new npm package is introduced by this change. It uses the repository's
  existing MIT/Apache-2.0/BSD-licensed stack (Next.js, React, Prisma, Radix,
  lucide-react, zod-free validation implemented in-house, `jszip` for exports).
  `THIRD_PARTY_NOTICES.md` already records the reused concepts and deliberately
  excluded AGPL/GPL/unlicensed projects; nothing new was copied.
* Preview SQLite support uses `@prisma/adapter-libsql` + `@libsql/client` as
  **development-only, `npm i --no-save`** packages. They are not added to
  `package.json`, are not shipped in the production build and are already
  documented in `README.md`. Prisma 6.19.3 is Apache-2.0; libSQL is MIT.
* MySQL/Hostinger, Caddy, optional n8n, WhatsApp Cloud API, SMS/email/telephony
  and payment networks remain **external dependencies**. Access to a carrier or
  Meta network cannot be owned; the platform owns only its adapter interface.
  The control center never reports an unconfigured provider as connected.
* **Self-hosting:** the new control plane runs inside this repository's own
  Next.js process and its own database. No SaaS control plane, template
  marketplace, hosted CRM or deployment manager is required.

## 4. Risks identified before execution

1. **Cross-company data leakage** — the most serious risk. Mitigation: every
   business-data query is server-side scoped by `companyId` from an explicit
   membership grant; the company ID supplied by the UI is never trusted; denial
   is audited; tests attempt cross-company reads via records, reports, files,
   jobs and audit endpoints.
2. **Factory-admin overreach** — being a `SUPER_ADMIN` of the factory must not
   grant access to a client's private records. Mitigation: a separate
   `FactoryCompanyMember` grant with `privileged` flag, grantor, reason and
   expiry; all privileged reads are audited.
3. **False "deployment success"** — no container orchestrator or DNS API is
   available in this repository. Mitigation: provisioning produces a real,
   isolated **tenant configuration and dataset**; dedicated-instance
   infrastructure is represented as an explicit, unverified deployment
   requirement/artifact. Nothing is labelled `DEPLOYED` without recorded
   evidence.
4. **Schema drift / MySQL truncation** — new long fields need `@db.LongText`/
   `@db.Text` and matching map + DDL entries; the local drift gate enforces this.
5. **Destructive operations** — none planned. No `DROP`, no data deletion, no
   overwrite of a live application's config without a pre-upgrade backup and an
   explicit approval step.
6. **Live-environment risk** — all verification is done on the disposable
   SQLite preview and in unit tests; no production database is touched.

## 5. Implementation plan (incremental, dependency-ordered)

| Step | Deliverable | Depends on | Acceptance test |
|---|---|---|---|
| 1 | Gap analysis + plan (this document) | inspection | section 17 satisfied |
| 2 | Additive Prisma models + migration + native-type map | — | `check-schema-drift.mjs`, `schema-ddl-parity`, `prisma validate` |
| 3 | Pure policy kernel: definitions, config merge, semver compatibility, lifecycle state machine, isolation scope, adapter status, backup checksums | — | `tests/factory-control-policy.test.ts` |
| 4 | DB services: provisioning, health, releases/rollback, backup/restore, impact analysis, audit, integration hub | 2, 3 | `tests/factory-control-db.test.ts` on disposable SQLite |
| 5 | Guarded API routes `/api/factory/*` | 3, 4 | route-level integration tests (A–H) |
| 6 | Control Center UI: 14 requested sections + overview + company wizard | 5 | typecheck, build, manual click-through on live preview |
| 7 | Operator docs: repeatable extension process, recovery, automated vs manual steps, dependency manifest | 2–6 | docs review |
| 8 | Full verification: `npm test`, `npm run typecheck`, `npm run lint`, `npm run build`, acceptance results | all | `docs/SFCC_ACCEPTANCE_RESULTS.md` |

## 5.1 Implementation status (recorded 2026-11-02, after the work ran)

| Step | Status | Evidence |
|---|---|---|
| 1 | **Complete** | this document |
| 2 | **Complete** | 20 additive `Factory*` models; `prisma/migrations/14_software_factory_control_center/migration.sql`; schema-drift, native-map and DDL-parity gates pass |
| 3 | **Complete** | `src/lib/factory/control/{types,util,definition,lifecycle,integrations,access}.ts`; `tests/factory-control-policy.test.ts` (22/22) |
| 4 | **Complete** | `catalog`, `health`, `backup`, `provision`, `releases`, `data`, `http`; `tests/factory-control-db.test.ts` (10/10 on disposable SQLite) |
| 5 | **Complete** | 21 guarded `/api/factory/*` routes; `scripts/factory/verify-http.mjs` (39/39 live HTTP checks) |
| 6 | **Complete** | `src/components/admin/factory/*` (15 tabs covering all 14 requested sections plus overview), working 15-step wizard, direct authenticated `/admin/factory-control` page |
| 7 | **Complete** | `docs/SFCC_OPERATIONS.md` |
| 8 | **Partial — see results** | `docs/SFCC_ACCEPTANCE_RESULTS.md`; `npm test`, typecheck, lint, schema gates, Prisma validate and live HTTP verification ran; `npm run build` deliberately not run because it executes `migrate deploy` against a database |

No destructive operation, production migration, deployment or external-provider call was performed.

**Explicitly out of scope for this increment (documented, not faked):**
real container/DNS/database provisioning for dedicated instances; carrier/WhatsApp
network ownership; billing/subscription enforcement; automatic migration of
live customer data between versions; a code-executing CI/CD runner. These require
infrastructure approval and are recorded as manual steps in the operator guide.

## 6. Acceptance-test mapping (master prompt section 18)

| Test | Where it is exercised |
|---|---|
| A — reusable templates | template + 2 versions, two applications from one version with different config, config independence |
| B — company provisioning | wizard → validation → provision → roles/modules/config seeded → real health check |
| C — client isolation | cross-company reads through records, reports, files, jobs, audit; all denied + audited |
| D — reusable upgrades | module version bump → impact analysis → compatibility → staging upgrade → rollback |
| E — external dependency independence | disable optional provider → internal records still work; provider reported `UNAVAILABLE`/`NOT_CONFIGURED`, never successful |
| F — recovery | backup → checksum verify → restore into staging → integrity + permissions + files + health |
| G — security | role enforcement, tenant boundary, secret scan, file access, privileged grant expiry, audit trail |
| H — repeatability | second company from the same approved definition, no source changes, automated/manual steps recorded |

Results are reported in `docs/SFCC_ACCEPTANCE_RESULTS.md` after the suites actually run.

---

## Resolution status — 2026-11-03 (additive update)

The gaps identified in this historical analysis are now closed. The original
control plane is preserved; the following was added on top of it.

| Gap identified earlier | Resolution |
| --- | --- |
| No runtime consumes the generated configuration | `src/lib/factory/control/runtime.ts` + `/factory/apps/[slug]` render the checksummed theme, pages, navigation and pinned modules for every company. See `docs/SFCC_RUNTIME_ARCHITECTURE.md`. |
| Acceptance evidence was not backed by an executable suite | `runFactoryTests` performs 11 real checks and persists them in a `TEST` provisioning job; staging and deployment gates require that job to have passed. |
| Rollback restored configuration only | `rollbackRelease` recovers config revisions, exact module pins, records and file contents from the verified portable `PRE_UPGRADE` backup (additively, same-company only). |
| No industry template library from the supplied design references | 11 new versioned industry templates; all 18 references catalogued and mapped; 11 curated previews in the private Template Library. |
| DEDICATED runtime boundary was manual and undocumented | A real, checksummed, credential-free self-hosted deployment package is generated from live pinned state; the evidence-gated activation boundary remains explicit and honest. |
| Full DB/API end-to-end verification | `node scripts/factory/verify-http.mjs` extended from 39 to 49 live checks, including the runtime API, both private pages and the deployment package. |

Verification: `npm test` / `npm run test:offline` → 1,208/1,208; typecheck and
lint clean; schema gates unchanged (96/96/1,280/259, 211 annotations, 20
control tables); live HTTP runner 49/49. Full record:
`docs/TECH360-SOFTWARE-FACTORY-COMPLETION.md`.
