# BDTECH360 Software Factory — Application Runtime Architecture

**Status:** implemented and verified · 2026-11-03 · branch `arena/d7d6a770-tech360`

This document describes how the five core systems became a single operating
platform that *runs* many business applications, rather than a control plane
that only records their configuration. It is additive: everything described in
`SFCC_GAP_ANALYSIS_AND_PLAN.md`, `SFCC_OPERATIONS.md` and
`SFCC_ACCEPTANCE_RESULTS.md` still exists and still works.

---

## 1. The core idea

> **Build the core once. Reuse it for every new company.**

```
  approved templates  ─┐
  shared modules      ─┼─→  versioned ApplicationConfig  ─→  ONE runtime renderer
  company definition  ─┘         (SHA-256 checksummed)        (/factory/apps/[slug])
                                        │
                                        └─→ real, company-scoped records,
                                            files, workflows, reports,
                                            health, tests, releases, backups
```

There is **one** Next.js application, **one** runtime module
(`src/lib/factory/control/runtime.ts`), and **one** React renderer
(`src/components/factory/runtime/RuntimeApp.tsx`). Company-specific behavior
is data: theme tokens, pages, navigation, workflows, reports, enabled modules
and pinned module versions. No per-company source tree is generated, and no
company needs its own rebuild.

---

## 2. What was added

| Capability | Implementation | Evidence it is real |
| --- | --- | --- |
| Config-driven presentation | `ThemeTokens` and `RuntimePage` in `ApplicationConfig`; `buildApplicationConfig` derives them from the approved template defaults, company branding and navigation; both are inside the checksummed config | `tests/factory-control-runtime.test.ts` asserts the theme, 6+ pages, and the stored checksummed fields |
| One runtime renderer | `src/lib/factory/control/runtime.ts` (`resolveRuntime`, `runtimeState`, `runFactoryTests`, `runtimeAction`) + `RuntimeApp.tsx` | HTTP runner: `GET /api/factory/runtime/<slug>` returns real pages/modules; `POST` actions create and remove real rows |
| Private application portal | `/factory/apps` and `/api/factory/runtime` list only applications with an explicit, active, unexpired company grant | HTTP runner 49/49; ungranted identity denied and audited in unit tests |
| Private company application | `/factory/apps/[slug]` renders the versioned theme, pages and module entity forms; sidebar, dashboards, boards, galleries, reports, timelines, files, live audit trail | `private company application page compiles — 200` |
| Executable acceptance evidence | `runFactoryTests` performs 11 real checks including a create → read → schema-validate → delete round trip, cross-company isolation, file checksums, recovery point and renderability; results are persisted in a `FactoryProvisionJob` with `action: TEST` | `executable acceptance suite runs over HTTP with persisted evidence — 11 passed / 0 failed` |
| Real release gates | `stageUpgradeRelease` runs the executable suite on the staging instance; `deployRelease` refuses without a persisted `PASSED` test job and re-runs the suite on LIVE, restoring the previous config if it fails | `tests/factory-control-db.test.ts` Test D passes with the new gates |
| Full-payload rollback | `rollbackRelease` now recovers config revisions, exact module pins, **records and file contents** from the verified portable `PRE_UPGRADE` backup, additively and within the same company only | `SFCC acceptance suite (database)` Test D still passes; `PORTABLE_PAYLOAD_RESTORED` recorded in the audit detail |
| Industry template library | 11 new versioned templates composed from the 8 approved shared modules: education, fitness, healthcare, travel, real estate, commerce, outdoor retail, manufacturing ERP, analytics, e-learning, IT services | `TEMPLATE_SEEDS.length === 15` (4 core + 11 industry); approved catalog reports 15 |
| Design references incorporated | All 18 supplied references catalogued and mapped to templates in `design-references.ts`; 11 curated compressed previews under `public/factory/industry/`; shown in the private Template Library with a full mapping viewer | `DESIGN_REFERENCES.length === 18`; every reference maps to a registered template |
| Self-hosted DEDICATED package | `/api/factory/deployments/[applicationId]` generates a checksummed, credential-free runbook from real DB state: pinned modules, real commands, real env keys, verification commands, infrastructure checklist, explicit boundaries and recovery point | `self-hosted deployment package is downloadable and credential-free — 200`; checksum recomputation tested |
| Private-route hardening | `next.config.ts` adds `X-Robots-Tag: noindex, nofollow, noarchive` + `no-store` for `/factory/*`, `/admin/factory-control` and `/api/factory/*` | Config check in `npm run typecheck` / build |

---

## 3. Runtime API contract

| Method | Endpoint | Purpose |
| --- | --- | --- |
| `GET` | `/api/factory/runtime` | List company applications for which this identity holds an active grant |
| `GET` | `/api/factory/runtime/:slug` | Live state: company, app, template, config, theme, pages, pinned modules, records, files, audits, releases, health, jobs, backups, aggregates |
| `POST` | `/api/factory/runtime/:slug` | `{ action, payload }` → `state`, `report.run`, `record.create`, `record.update`, `record.delete`, `workflow.advance`, `file.upload`, `file.read`, `tests.run`, `health.run` |
| `GET` | `/api/factory/deployments/:applicationId` | Self-hosted deployment package (`?download=1` for a JSON attachment) |

**Authorization is server-side and non-negotiable.** The `companyId` is never
accepted from the browser for runtime operations: it is derived from the
private slug, then checked against `resolveCompanyAccess` (explicit, active,
unexpired grant; privileged grants need a grantor and a recorded reason).
Denials are written to the audit trail. The `guard` wrapper additionally
enforces session, RBAC, auditor read-only and CSRF. A `SUPER_ADMIN` without an
explicit company grant is denied private business data.

Every record is validated against the pinned module's declared entity schema
(`validateModuleRecord`), every file is checksummed and scoped, and workflow
transitions may only write fields the pinned manifest actually declares.

---

## 4. The five core systems, now integrated end to end

1. **Private Template Library** — 15 versioned templates (4 core + 11
   industry), each with roles, navigation, security, setup/test/acceptance/
   upgrade/backup/rollback procedures, and now theme tokens and page
   definitions. Production-ready is granted only after validation.
2. **Reusable Module Engine** — 8 approved modules with manifests, entity
   schemas, permissions and dependencies. One module version update goes
   through impact analysis → compatibility → staged upgrade → executable
   tests → authorized approval → deployment with a verified rollback point.
3. **Company Provisioning Engine** — validated definition → isolated
   identity → versioned definition → grants → checksummed configuration →
   pinned modules → seeded scoped entities → adapters with honest status →
   real acceptance checks → verified backup → health → STAGING.
4. **Version Control and Release Management** — immutable template versions,
   config revisions with SHA-256, release rows with proposed config, staging
   application, executable test evidence, approval, deployment and rollback.
5. **Deployment, Backup, Recovery and Rollback** — portable checksummed
   archives, verified-only restore into a NEW staging app in the SAME company,
   full-payload additive rollback of records/files/revisions/pins, and a
   reproducible self-hosted deployment package for DEDICATED instances.

---

## 5. The honest DEDICATED boundary

The factory cannot create DNS records, database servers, TLS certificates or
credentials from inside an HTTP request on infrastructure it does not control.
It therefore:

- generates a **real, checksummed deployment package** with the exact
  commands, environment keys, migration step, verification commands and
  infrastructure checklist needed on an authorized BDTECH360 host;
- contains **no credential values** and no `tenantKey`;
- records the required manual steps and the package export in the audit trail;
- **refuses DEDICATED activation** unless `deploymentEvidence` is recorded and
  a verified rollback point exists (`canTransition`, `LIVE` case).

This is deliberately stated rather than simulated. SHARED_TENANT applications
run immediately on the single runtime; DEDICATED applications additionally
require operator evidence.

---

## 6. Design references → working templates

All 18 attachments are catalogued in
`src/lib/factory/control/design-references.ts`. They informed the color
systems, page structures, navigation and workflow pipelines of the industry
templates; they are not embedded as decorative images in place of features.

| Template | References | Theme motif |
| --- | --- | --- |
| `school-website` | 1 | campus |
| `fitness-platform` | 4 | energy |
| `doctor-consult` | 2 | clinical |
| `travel-agency` | 1 | horizon |
| `real-estate` | 2 | architecture |
| `ecommerce-store` | 2 | shop |
| `manufacturing-erp` | 1 | industrial |
| `analytics-reports` | 2 | data |
| `elearning-app` | 1 | learning |
| `outdoor-gear` | 1 | trail |
| `it-services` | 1 | data |

Curated previews (11 × ~20–40 KB JPEG) live in `public/factory/industry/` and
are rendered inside the private Template Library, so the 14 MB source
attachments are not shipped.

---

## 7. What was deliberately NOT done

- No production migration, production deploy, live MySQL acceptance run,
  external-provider call, headless-browser click-through or destructive
  production operation.
- No claim that a DEDICATED server/DNS/database/TLS was created automatically.
- No deletion or replacement of any previously created feature. Public site,
  admin console, communication pipeline, SFCC control plane and all their
  tests remain intact.
- Private factory routes are intentionally absent from the public sitemap and
  are now `noindex`.
