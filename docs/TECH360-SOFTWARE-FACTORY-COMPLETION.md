# TECH360 — Software Factory Completion Record

**Date:** 2026-11-03
**Branch:** `arena/d7d6a770-tech360`
**Scope:** complete, functional, privately controlled Software Factory — additive to the full-project refresh at `56b15da`

---

## Request

Build one central, reusable, extensible, configuration-driven, secure platform
that BDTECH360 can operate from its own authorized infrastructure to create and
run many business applications for the parent company, sister companies,
internal departments and external clients — **"Build the core once. Reuse it
for every new company."** All five core systems (Private Template Library,
Reusable Module Engine, Company Provisioning Engine, Version Control and
Release Management, Deployment/Backup/Recovery/Rollback) must be integrated,
working features. Not a design, prototype, static dashboard, mock API,
placeholder record or documentation-only deliverable. 18 attached images were
design references.

---

## What was delivered

### A. A real application runtime (the previously missing consumer)

- `src/lib/factory/control/runtime.ts` — `resolveRuntime`, `runtimeState`,
  `runFactoryTests`, `runtimeAction`. Reads the checksummed config, loads
  pinned approved module manifests, operates on company-scoped rows.
- `src/app/api/factory/runtime/route.ts` and `[slug]/route.ts` — guarded
  private API (state + 10 actions).
- `src/app/factory/apps/page.tsx` — private application portal (grant-scoped).
- `src/app/factory/apps/[slug]/page.tsx` +
  `src/components/factory/runtime/RuntimeApp.tsx` — one renderer for every
  company: config-driven theme, sidebar pages, dashboards, boards, galleries,
  reports, timelines, record forms, workflow advance, file upload, audit
  trail, executable test evidence and operations strip.
- `next.config.ts` — `noindex` + `no-store` on all private factory surfaces.

### B. Real evidence instead of hardcoded "passed"

- `runFactoryTests` executes 11 checks (config checksum, known-good revision,
  approved pins, manifest validity, record isolation, record schema, file
  checksums, a real create/read/validate/delete round trip, ungranted-access
  refusal, verified recovery point, renderable theme/pages) and persists them
  in `FactoryProvisionJob` with `action: TEST`.
- `stageUpgradeRelease` runs that suite on the actual staging instance and
  refuses staging when it fails.
- `deployRelease` refuses deployment without a persisted `PASSED` test job and
  re-runs the suite on LIVE, restoring the previous configuration if it fails.

### C. Full portable-payload rollback

`rollbackRelease` now restores config revisions, exact module pins, records
and file contents from the verified `PRE_UPGRADE` portable backup — additively,
idempotently, same-company only, with corrupted content and foreign payloads
refused. Newer rows are never deleted. The outcome is recorded as
`PORTABLE_PAYLOAD_RESTORED` (or an explicit honest failure state) in the audit
trail.

### D. Industry template library from the 18 design references

- 11 new versioned templates composed from the 8 approved shared modules
  (education/school, fitness, doctor consult, travel, real estate, commerce,
  manufacturing ERP, analytics, e-learning, outdoor retail, IT services),
  each with its own theme tokens, 6 pages, navigation, pipeline, reports and
  procedures. Library total: **15 templates**.
- All **18** references catalogued and mapped in `design-references.ts`;
  11 curated ~20–40 KB previews in `public/factory/industry/`; integrated into
  the private Template Library with an expandable full mapping viewer.
- Older core templates still work: `definition.ts` derives meaningful,
  module-backed pages from navigation labels when a stored template version
  predates explicit page seeds.

### E. Honest, self-hosted DEDICATED boundary

`deploy-package.ts` + `/api/factory/deployments/[applicationId]` generate a
checksummed, credential-free deployment package from real database state:
pinned modules, config checksum, real commands (`npm ci`, `npm run db:deploy`,
`npm run build`, `npm start`), real environment keys, migration step,
verification commands, infrastructure checklist, explicit boundaries and
recovery point. Downloadable from the Deployment Center. DEDICATED activation
still requires recorded `deploymentEvidence` and a verified rollback point.

---

## Verification (all executed in this workspace)

| Gate | Result |
| --- | --- |
| `npm run typecheck` | clean, 0 diagnostics |
| `npm run lint` | clean, 0 problems |
| `npm test` | **1,208 tests / 1,208 pass / 0 fail / 0 cancelled** |
| `npm run test:offline` | **1,208 / 1,208**, fresh 96-table disposable SQLite DB |
| `tests/factory-control-runtime.test.ts` | **9 / 9** (new runtime acceptance suite) |
| `tests/factory-control-policy.test.ts` | 22 / 22 |
| `tests/factory-control-db.test.ts` | 10 / 10 |
| `node scripts/check-schema-drift.mjs` | 96 models / 96 tables / 1,280 columns / 259 indexes |
| `npm run schema:check` | 211 native-type annotations, in sync |
| `node scripts/factory/gen-control-ddl.mjs --check` | 20 control tables, in sync |
| `node scripts/factory/verify-http.mjs` | **49 / 49** live HTTP checks (was 39) |
| `/api/factory/docs` | 13 / 13 registered documents present |
| `npx next build --webpack` (isolated `distDir`) | **Compiled successfully** in 70–75 s; **Finished TypeScript** in 36–41 s; all 70 routes collected. Static export then stops at `/sitemap.xml` because this preview workspace has no production MySQL client/server (deliberate `PREVIEW_SQLITE_URL`-in-production guard, then `P2038`). This is an environment limit, not a compile error. |

New HTTP checks cover the private portal, config-driven runtime state,
executable acceptance suite over HTTP, real record creation, live scoped
report, both private pages, and the self-hosted deployment package.

Live runtime probe: `11 passed / 0 failed` acceptance checks, 8 pinned
modules, real scoped records, `HEALTHY`, verified backup, portable archive,
`LIVE` application with an explicit company grant.

---

## Files added

```
src/lib/factory/control/runtime.ts
src/lib/factory/control/design-references.ts
src/lib/factory/control/deploy-package.ts
src/components/factory/runtime/RuntimeApp.tsx
src/app/factory/apps/page.tsx
src/app/factory/apps/[slug]/page.tsx
src/app/api/factory/runtime/route.ts
src/app/api/factory/runtime/[slug]/route.ts
src/app/api/factory/deployments/[applicationId]/route.ts
tests/factory-control-runtime.test.ts
public/factory/industry/*.jpg                 (11 curated previews)
docs/SFCC_RUNTIME_ARCHITECTURE.md
docs/TECH360-SOFTWARE-FACTORY-COMPLETION.md
```

Files changed additively: `types.ts`, `definition.ts`, `provision.ts`,
`catalog.ts`, `releases.ts`, `Panels.tsx`, `next.config.ts`,
`src/app/api/factory/docs/route.ts`, `scripts/factory/verify-http.mjs`,
`docs/SFCC_GAP_ANALYSIS_AND_PLAN.md`.

---

## Honest limits

- Preview/SQLite is the active client; production MySQL CI acceptance,
  a completed `npm run build` static export, live deployment and
  external-provider calls were **not** performed. Production webpack
  compilation and TypeScript validation did succeed in an isolated build
  directory; static prerendering requires a real MySQL client and server.
- No headless-browser click-through was run; page compilation was verified
  over HTTP (200) and TypeScript/ESLint.
- DEDICATED infrastructure (DNS, database, TLS, credentials) is intentionally
  operator-controlled; the platform generates the reproducible package and
  enforces the evidence gate rather than pretending to have provisioned it.
- Nothing was deleted. All previously created functions, features, public
  pages, admin console views and tests remain.
