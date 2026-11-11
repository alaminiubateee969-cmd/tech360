# Software Factory Control Center — Actual Acceptance Results

**Date:** 2026-11-02 · **Branch:** `arena/d7d6a770-tech360`
**Environment:** disposable SQLite preview database (`.preview/demo.db`) built from
the 96-model schema; Node 22; `PREVIEW_SQLITE_URL=file:$PWD/.preview/demo.db`,
`PORTAL_OTP=off`, `NODE_ENV=test`/dev. **No production database, deployment,
destructive operation or external provider call was made.**

This document records commands that were actually executed and their real
output. It does not claim success for anything that was not run.

---

## 1. Verification summary

| Gate | Command | Actual result |
|---|---|---|
| TypeScript | `npm run typecheck` (`tsc --noEmit`) | **PASS** — no errors |
| ESLint | `npm run lint` (`eslint .`) | **PASS** — 0 errors, 0 warnings |
| Schema drift | `node scripts/check-schema-drift.mjs` | **PASS** — `✓ no schema drift — 96 models, 96 tables, 1280 columns, 259 indexes` |
| Native type map | `npm run schema:check` | **PASS** — `✓ schema in sync — provider=mysql, 211 native type annotations` |
| Control DDL parity | `node scripts/factory/gen-control-ddl.mjs --check` | **PASS** — `✓ control-plane DDL and native-type map in sync (20 tables)` |
| Prisma schema | `DATABASE_URL='mysql://user:pass@127.0.0.1:3306/tech360' PRISMA_SCHEMA_ENGINE_BINARY=/bin/true PRISMA_QUERY_ENGINE_LIBRARY=/bin/true npx prisma validate --schema prisma/schema.prisma` | **PASS** — `The schema at prisma/schema.prisma is valid 🚀` (offline engine stub; no connection) |
| Production Prisma client | same stub env + `npx prisma generate --schema prisma/schema.prisma` | **PASS** — `✔ Generated Prisma Client (v6.19.3)` (preview client restored afterwards so the live preview keeps working) |
| Pure policy tests | `npx tsx --test tests/factory-control-policy.test.ts` | **PASS** — 22 tests / 22 pass / 0 fail |
| Database acceptance A–H | `PREVIEW_SQLITE_URL=file:$PWD/.preview/demo.db NODE_ENV=test npx tsx --test tests/factory-control-db.test.ts` | **PASS** — 10 tests / 10 pass / 0 fail |
| Live HTTP acceptance | `node scripts/factory/verify-http.mjs` against running dev server | **PASS** — 39/39 checks |
| Full repository suite | `npm test` | **PARTIAL** — 1,141 tests / 1,133 pass / 8 fail (all 8 pre-existing; see §4) |
| UI compile | `GET /` and `GET /admin/factory-control` on the dev server | **PASS** — both HTTP 200; no Turbopack/compile errors in server log |
| `npm run build` | not run | **NOT RUN** — it executes `node scripts/prisma.mjs migrate deploy`, which touches a database; no deployment approval was given |

---

## 2. Acceptance tests A–H (master prompt section 18)

| Test | Result | What was actually verified |
|---|---|---|
| **A — reusable templates / version / config isolation** | **PASS** | `Test A` in `tests/factory-control-db.test.ts`: two companies were provisioned from one approved template version; their `configChecksum` differ; stored template version checksum unchanged; a branding change to company A leaves company B's config byte-identical; a new `FactoryConfigRevision` is created. Policy tests additionally verify template manifests, required implemented capabilities, procedures, secret rejection, prototype-pollution-safe merge and deterministic checksums. |
| **B — sister-company provisioning with users/config/permissions/modules/health** | **PASS** | `Test B`: provisioning job status `PASSED` with every one of the 17 recorded steps `PASS`; application `STAGING`/`HEALTHY`; active `COMPANY_ADMIN` grant plus a privileged, expiring, audited operator grant; all module pins reference `APPROVED` versions; initialized records are all company-scoped; `runHealthChecks()` returns `HEALTHY`; an invalid duplicate definition is refused. Same flow repeated over HTTP by `verify-http.mjs` (validation → 201 provisioning → submit → activate → `LIVE`). |
| **C — two-client isolation including UI/API/report/file/background denial** | **PASS** | `Test C`: 8 distinct cross-company attempts (records list, forged app id, record create, report, file read with a forged company id, file read with the real foreign id, scoped job, and a factory `SUPER_ADMIN` with no grant) were all denied; `NO_COMPANY_GRANT` and `CROSS_COMPANY_DENIED` codes observed; `>= attempts.length` `DENY` audit events written; the owning company could still read its own file with a valid checksum. HTTP: unauthenticated `401`, unknown company scope `403`, `tenantKey` absent from registry and detail responses. |
| **D — reusable shared-module upgrades with dependents/compatibility/migrations/staging/rollback** | **PASS** | `Test D`: a non-breaking `reporting` v1.1.0 was created; impact analysis listed dependent templates and applications; per-application compatibility row `COMPATIBLE`; upgrade release created; staged; approved by `SUPER_ADMIN`; deployed after a verified pre-deploy backup; config and module pin became `1.1.0`; rollback restored the known-good config, restored version pins and set `ROLLED_BACK`; a breaking `2.0.0` target produced a `FAILED` release with a migration-plan note. Policy tests also cover semver gates and lifecycle transition refusals. |
| **E — optional-provider independence and clear unavailable reporting** | **PASS** | `Test E`: `email_smtp` disabled; `internal_events` stayed `AVAILABLE`; no external adapter was `AVAILABLE`; a contact record was still created and listed. Policy tests assert `DISABLED` / `NOT_CONFIGURED` / `UNAVAILABLE` states, that credentials alone never mean connected, and that internal-only operation stays healthy. The Integration Hub API reports adapter limitations, dependency notes and missing environment keys. |
| **F — backup/config restore in test env with integrity/permissions/files/health** | **PASS** | `Test F`: full backup created; SHA-256 verification passed; payload excluded `tenantKey`; restore created a **new STAGING** application in the **same** company; `restoredRecords === expectedRecords`, one file restored with a valid checksum, config checksum matched, permissions present and health `HEALTHY`; cross-company restore was refused. HTTP runner also exported the portable JSON archive containing `restoreInstructions`. |
| **G — roles, tenant boundaries, secret exposure, files, privileged ops, audit** | **PASS** | `Test G`: `COMPANY_AUDITOR` write denied (`ROLE_DENIED`) while read allowed; a `password`-containing config change refused as secret-like; an expired privileged grant refused (`GRANT_EXPIRED`); `>=5` control-plane audit events and `>0` platform `AuditLog` entries; health `HEALTHY`. HTTP runner verified session/CSRF, `401` without a session, `403` for an unknown company scope, file download with security headers and no `tenantKey` in responses. |
| **H — repeatability from an approved template without shared-source changes** | **PASS** | `Test H`: an approved definition was reused with a new slug, name, domain, admin user and unique tenant key; one v1 definition row created; config contains both `automatedSteps` and `manualSteps`; template source unchanged; zero source-company records copied into the new application; `FACTORY_DEFINITION_REUSED` audit event recorded. The wizard records automated versus engineering/manual approval steps at step 11/12. |

### Additional checks beyond A–H

- `activation is approval-gated and produces a LIVE, healthy application`: `submit` → unprivileged activation refused → `SUPER_ADMIN` activation succeeded; `LIVE`, company `ACTIVE`, `HEALTHY`, deployed `INITIAL` release, verified `PRE_UPGRADE` backup.
- `module library stays self-consistent after all operations`: approved manifests still declare an implemented capability; exported backup payload passes an independent secret scan.
- Live HTTP runner: all 21 `/api/factory/*` GET surfaces returned real data; 39 checks including record creation, file upload/download, scoped background job, health check, backup create/verify/export, engineering change request and Control Center page compile.

---

## 3. What the live HTTP runner exercised

`scripts/factory/verify-http.mjs` logs in as the seeded `SUPER_ADMIN`, reads the
CSRF cookie from `Set-Cookie`, then calls the real routes. Final output:

```
PASS authenticated SUPER_ADMIN session — SUPER_ADMIN
PASS unauthenticated request denied — 401
PASS overview returns real counts — {"companies":3, ...}
PASS private library bootstrap — true
PASS approved template catalog — 4
PASS configuration validation passes — []
PASS invalid definition rejected — ["company name must be at least 2 characters"]
PASS isolated provisioning with real acceptance steps — []
...
PASS control center page compiles — 200

SUMMARY 39/39 passed
```

The disposable preview database is writable and is the only database touched.

---

## 4. Full `npm test` result and pre-existing failures

```
# tests 1141
# suites 252
# pass 1133
# fail 8
# cancelled 0
# skipped 0
```

The baseline before this work was **1,119 tests / 1,111 pass / 8 fail**. The
same 8 failures remain; **no new failure was introduced**. They are:

| Suite / assertion | Reason (pre-existing) |
|---|---|
| `tests/database-workflows.test.ts` | requires a live MySQL server |
| `tests/governance-db.test.ts` | requires a live MySQL server |
| `tests/governance-outbound-db.test.ts` | requires a live MySQL server |
| `communication pipeline — the exact client copy` (2 nested assertions) | contract-text expectation in existing copy |
| `communication pipeline — the stated policy` (2 nested assertions) | contract-text expectation in existing policy text |
| `live pipeline monitoring permits operators and never returns private message bodies` | asserts an `agents: 'ADMIN'` source string in existing monitoring code |

The database-backed factory acceptance suite is intentionally **skipped** inside
`npm test` when neither `PREVIEW_SQLITE_URL` nor `DATABASE_URL` is configured;
it is run separately with the disposable preview database (10/10 pass). A
Prisma field-usage false positive introduced by a comma inside a migration-plan
string was fixed by removing the comma; the parity guard then passed.

---

## 5. Verified non-claims and remaining limitations

These are stated explicitly so no feature is reported complete without evidence:

- **No production build or migration.** `npm run build` was not run because it executes `migrate deploy`. `prisma validate` and a standalone production `prisma generate` passed with offline engine stubs; production builds regenerate the MySQL client in the controlled deployment pipeline.
- **No real dedicated infrastructure.** Model B records the required separate DB, storage, credentials, domain and TLS as manual, approved steps and refuses `LIVE` without recorded evidence. It does not create containers, DNS records, databases or TLS certificates.
- **No external provider delivery.** WhatsApp, SMS, telephony, payment and SMTP capabilities are adapter *definitions* with honest `NOT_CONFIGURED`/`UNAVAILABLE`/`DISABLED` status. No call, delivery, webhook or account access was fabricated or performed.
- **No automatic company-user login.** Company users are explicit company-scoped grants, not shared platform accounts. An operator must create a platform identity with a matching email and deliver a one-time credential; documented in `docs/SFCC_OPERATIONS.md` §15 and shown in wizard step 15.
- **No browser-driven click-through automation.** The UI compiles, typechecks, lints and server-renders (`/` and `/admin/factory-control` → 200), and the wizard's underlying API sequence was exercised end-to-end. Individual React click interactions were not automated in a headless browser.
- **Existing failures untouched.** The 8 pre-existing repository test failures were not modified or hidden.
- **No destructive operation** removed or overwrote existing data, routes, APIs, integrations, current instances or previous releases. All 20 new tables are additive.

---

## 6. Definition of done — honest assessment

**Achieved and verified:** private versioned template/module library; an
operator Control Center with all 14 requested sections plus overview; a working
15-step company wizard; repeatable provisioning from approved definitions;
server-enforced company isolation for records, reports, files, jobs, audit and
integration state; real lifecycle statuses; compatibility/impact analysis,
staging, approval, deploy and rollback with module-pin restoration; verified
backups and same-company staging restore; honest replaceable integration
adapters; engineering change-request triage; security gates; automated tests
A–H; operator documentation and this results document.

**Documented manual / out-of-scope work:** dedicated-instance infrastructure,
external provider accounts/fees/approvals, billing enforcement, automatic live
customer-data migration, a code-executing CI/CD runner, independent company-user
platform login provisioning, and a production deployment. These require
explicit approval and are not presented as implemented.

Normal flow implemented: **Select template → Configure company → Select
modules → Validate → Provision → Test → Approve → Deploy → Monitor.**
