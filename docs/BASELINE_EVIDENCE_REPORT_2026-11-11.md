# TECH360 — Phase 0 Baseline Evidence Report

**Date:** 2026-11-11 (local timezone UTC)  
**Repository:** https://github.com/alaminiubateee969-cmd/tech360  
**Active branch:** `arena/8e149e11-tech360`  
**HEAD / SHA:** `b8486a7848e1228b98c2b46aefa7cf2f71f613d0` — "Merge pull request #66 from alaminiubateee969-cmd/arena/2073fcff-tech360"  
**Relationship to main:** identical (this branch is at verified latest main, `origin/main` = `b8486a7`)  
**Production domain:** https://bdtech360.com (not reachable from this sandbox; no production credentials held)  
**Mode:** Read-only baseline + targeted repairs only. No production data touched, no migration run, no deployment performed.

---

## 1. PURPOSE

This is the baseline evidence report required by the master directive before major changes. It records:

- repository, branch, commit and deployment identity;
- stack, route, schema and feature inventory;
- executed verification (install, lint, typecheck, tests) with results;
- known defects, open pull requests and unrepaired blockers;
- the one targeted repair completed in this session (real logo replacing the generic monogram in public chrome).

Status conclusions are source- and test-based only. Nothing here claims production behaviour, which has not been observed.

---

## 2. REPOSITORY & SESSION IDENTITY

| Item | Value |
|---|---|
| Canonical repository (per directive) | `alaminiubateee969-cmd/tech360` |
| Remote | `https://github.com/alaminiubateee969-cmd/tech360.git` (fetch + push) |
| Active branch | `arena/8e149e11-tech360` (status: active) |
| HEAD SHA | `b8486a7848e1228b98c2b46aefa7cf2f71f613d0` |
| `origin/main` | `b8486a7848e1228b98c2b46aefa7cf2f71f613d0` (branch == main) |
| Working tree before this session | clean |
| Local runtime | Node 22.22.3, npm 10.9.8 (engine requirement: `>=22.0.0 <23`) |
| Stack | Next.js 16 (App Router), React 19, Tailwind CSS 4, shadcn/ui, Prisma 6.19.3 + MySQL, zod, tsx |

### Open pull requests (as of this session)

- **PR #67 (DRAFT)** — "Improve TECH360 branding and factory access boundaries", branch `arena/065d5495-tech360`, base `main`, head `4ed88c63`. Created 2026-11-11. 34 changed files (+435/−312). CI on its head commit: MySQL validation job SUCCESS. It contains overlapping Phase 1 branding work (circular logo + blue/green accents) and Phase 2 factory Super Admin boundary work, created **before** main absorbed PRs #62–#66. Its baseline notes that main advanced 154 paths after it branched with 14 overlapping modified paths. **No action taken on PR #67 from this branch** — it lives on a different session branch; overlap is documented here for reconciliation at review time.

### Second public repo (carried forward from prior audits)

`engralaminn-collab/tech360` exists as a stale public copy. Canonical repo per this directive is `alaminiubateee969-cmd/tech360`. Reconciliation is an owner decision (D-1 in prior audits), not a code action.

---

## 3. STACK & ARCHITECTURE INVENTORY

Source presence only; not an end-to-end test of every surface.

| Layer | Implementation | Evidence |
|---|---|---|
| Frontend | Next.js 16 App Router, React 19, Tailwind 4, shadcn/Radix | `src/app`, `components.json`, `tailwind.config.ts` |
| Public website | 16 static sections + dynamic service/industry/legal slugs via `getStaticPublicRoutePaths()` | `src/lib/public-route-catalog.ts`; sections: about, platform, services, industries, work, work/projects, work/case-studies, technologies, design-kit, process, pipeline, blog, careers, contact, legal, faq, portal |
| Service catalogue | 26 services with dedicated images + `ServiceCard` system | `src/data/service-images.ts`, `src/components/site/ServiceCard.tsx`, `public/images/services/*.webp` |
| Industries | 20 vertical blueprints | `src/data/industries/` |
| Backend | 242 API route handlers | `find src/app/api -name route.ts` |
| Database | MySQL via Prisma, 97 models, 18 migrations | `prisma/schema.prisma`, `prisma/migrations` |
| Auth / RBAC | Session auth (HttpOnly cookies), CSRF double-submit, 12 roles (`SUPER_ADMIN | ADMIN | MANAGER | STAFF` ...), AUDITOR read-only, MFA, `guard()` fails closed | `src/lib/api-guard.ts`, `prisma/schema.prisma` (User, Session) |
| CRM | Client + ClientIdentity + Lead + merge (`crm-merge.ts`), duplicate detection on email/WhatsApp/business name | `src/lib/crm-merge.ts` |
| Client IDs | `TECH-YYYY-NNNNNN`, collision-resistant, `nextClientId()` | `src/lib/ids.ts` |
| Grand Projects | `Project` model (code `PRJ-YYYY-NNNN`) linked to Client, scopes, tasks, invoices, payments, previews, deliveries, handovers | `prisma/schema.prisma` |
| SOW / approvals | `ScopeOfWork` versioned (`@@unique([clientId, version])`), `ScopeApproval`, `ApprovalRequest` with governed execution | `src/lib/governance/` |
| HTML preview | `Preview` + `PreviewEvent`, tokenized links, expiry, SHA-256 handover verification | `src/lib/preview-policy.ts` (tests) |
| Payments | Hand-rolled Stripe REST + HMAC webhook verification; bank transfer, bKash, Nagad; payment states DRAFT→…→VERIFIED PAID; no auto-PAID from screenshot/SMS/claim | `src/app/api/admin/payments/`, `PAYMENT.md` |
| AI workforce | 44 executable core agents, 110 departments, 2,200 logical catalogue definitions; registry validated; execution requires provider credentials (fail-closed 503) | `src/lib/agents/registry.ts` |
| Communications | `comms.ts` adapters (email/SMTP, HTTP SMS gateway, WhatsApp Cloud, social), honest `NOT_CONFIGURED` states, idempotent inbound webhooks, consent records | `src/lib/comms.ts`, WebChat signed session cookie |
| Software Factory | `src/lib/factory/blueprint.ts` — brief → blueprint → real Next.js/Prisma source tree → ZIP delivery package; factory control plane | `src/lib/factory/` |
| Documents / letterhead | Owner letterhead engine (`src/lib/letterhead.ts`), 17 official document renderers, branding API | `OFFICIAL-DOCUMENTS.md` |
| Mini-services (separate Bun runtimes) | ai-ops (:3031), notify-relay (:3032) — optional sidecars, not part of the Next.js web app | `mini-services/` |
| CI | GitHub Actions: Node.js 22 + npm + disposable MySQL 8.0; validate/build/migrate/test/secret-scan | `.github/workflows/ci.yml`, `.github/workflows/mysql-baseline.yml` |

**What is intentionally NOT in the build path:** `legacy/` (prototype from PR #39, preserved out of build path), `deployment/` (retired Google Cloud Run/Docker helpers), `download/`.

---

## 4. EXECUTED VERIFICATION (THIS SESSION)

All commands run from `/home/user/tech360` on Node 22.22.3 / npm 10.9.8, tree at `b8486a7` plus this session's changes. No production database, no live provider credentials.

### 4.1 Dependency installation

```
npm ci --no-audit --no-fund   → PASS, 863 packages (+30 adapter packages below)
```

### 4.2 Prisma client generation (environment-blocked locally, not a code defect)

```
npx prisma generate           → FAILS locally
```

**Reason:** the sandbox cannot reach `https://binaries.prisma.sh` (TLS handshake failure, `SSL_ERROR_SYSCALL`, HTTP `000`). The native schema/query/migration engine binaries for Prisma 6.19.3 cannot be downloaded here. This is the long-standing local blocker **B-005** (documented in `KNOWN_ISSUES_AND_BLOCKERS.md`); GitHub Actions CI runs generation, typecheck, tests and build against disposable MySQL 8.0 and is green (run 42768720254, 35/35 steps on main).

**Effect locally:** the Prisma client **type declarations** were generated (the generator reached type emission before the engine download step), so `tsc --noEmit` validates application types and passes. Runtime database queries cannot execute locally without the native engine; the app fails closed (`/api/health` → 503 `database: DOWN`). No engine mirror, no TLS bypass, no hand-written client, no stub fabrication was used — consistent with the standing safety rules.

### 4.3 Repair: undeclared optional test dependency declared (P2 #11 from prior audits)

The offline test path requires `@prisma/adapter-libsql@6.19.3` + `@libsql/client@0.15.15` (must match `@prisma/client` 6.19.3). Previously installed only with `--no-save`, so a fresh checkout ran red until the operator followed undocumented instructions. Declared as dev dependencies so the green suite stops reporting red:

```
npm install --save-dev @prisma/adapter-libsql@6.19.3 @libsql/client@0.15.15   → PASS
```

### 4.4 Lint

```
npm run lint   → PASS (eslint, no errors)
```

### 4.5 TypeScript typecheck

```
npx tsc --noEmit   → PASS, exit 0
```

Honest caveat per prior audits: locally this validates application types against the emitted client declarations, but it cannot validate Prisma query shapes against a live MySQL dialect; CI does that against MySQL 8.0.

### 4.6 Tests

```
npm run test:offline   → PASS
# tests 1455 · # suites 322 · pass 1455 · fail 0 · cancelled 0 · skipped 0 · todo 0
```

Runs the full suite against `.preview/test.db` — a fresh, empty SQLite database built from the **same production Prisma schema** (provider annotations stripped), with zero seeded rows. Covers real Prisma transactions: tenant isolation, payment gating, scope versioning, CRM stage transitions, webhook replay protection, identity resolution, handover authorization, AI workforce RBAC, factory control policy, payment/bank-receipt policy, preview policy, portal OTP, email/webhook auth, and more. Previous audit's green baseline was 1,423/1,423 (318 suites); this tree measures 1,455/1,455 (322 suites).

**Not covered locally:** browser/E2E (no Playwright), live provider calls (Stripe/SMTP/WhatsApp/AI), MySQL dialect execution (CI), production build (`next build` invokes `prisma generate`, blocked by the TLS restriction above), staging smoke, accessibility execution.

---

## 5. BRANDING STATUS (PHASE 1)

**Authoritative brand assets (owner-supplied, in `public/brand/` and `public/images/`):**

| Asset | Format | Size | Role |
|---|---|---|---|
| `public/images/tech360-logo.png` | PNG (alpha) | 1254×1254 | Real circular TECH360 emblem — now used in navbar + footer |
| `public/brand/tech360-logo-original.jpg` | JPEG | 432×432 | Favicon + Apple touch icon (`src/app/layout.tsx`) |
| `public/brand/tech360-logo-owner.jpg` | JPEG | 1254×1254 | Owner's original |
| `public/brand/tech360-header-high-res.png`, `tech360-footer-high-res.png`, `tech360-letterhead-a4.png`, `tech360-company-pad-design*.png` | PNG | various | Letterhead/header/footer pad assets |
| `public/brand/tech360-seal*.png` | PNG | — | Approval seal |

**Brand tokens (measured from the owner letterhead/emblem, single source of truth in `src/app/globals.css`):**

`--brand-navy #002077 · --brand-blue #024cb9 · --brand-bright #007bdb · --brand-teal #029962 · --brand-green #25b03b · --brand-mint #90d8b4 · --brand-cyan #009fe3 · --brand-ink #0b1f33 · --brand-slate #526173 · --brand-rule #e2e8f0`

`--primary` = brand blue (#024cb9). Guarded by `tests/brand-tokens.test.ts` (part of the 1,455 passing).

### Repair completed this session

**Defect:** the public header (`src/components/site/SiteHeader.tsx`) and footer (`src/components/site/SiteFooter.tsx`) rendered `BrandMark` — a hand-drawn generic monogram (rounded navy square with a "T" shape). Phase 1 forbids substituting a generic monogram and requires the real logo in navbar and footer.

**Fix:**
- Header: `<BrandMark />` → `<Image src="/images/tech360-logo.png" alt="TECH360" width={36} height={36} priority />` (real logo, keeps proportions and transparency, wordmark unchanged).
- Footer: same replacement.
- Deleted `src/components/site/BrandMark.tsx` (no other references).

**Already correct before this session (verified, not changed):**
- Favicon / Apple icon = `/brand/tech360-logo-original.jpg` (real logo).
- Admin console, login screen and official-info view = `/brand/tech360-logo-original.jpg`.
- Official letterhead engine (`src/lib/letterhead.ts`) = `/brand/tech360-logo-original.jpg` with navy → blue → green gradient rule; brand colors navy #063B8F / blue #009FE3 / green #18B83A.
- Every service card has a distinct service image (`public/images/services/*.webp`).

**Not yet verified / not in scope of this repair:** real logo in email transport templates (letterhead engine covers generated documents; outbound email templates use the letterhead engine), CRM wordmark surfaces beyond those checked, favicon rendering on production, 2x logo variants. No customers, testimonials, projects, certifications or statistics were invented anywhere.

---

## 6. FEATURE CLASSIFICATION (SUMMARY)

Classifications are source- and test-based; "present" ≠ "verified end-to-end". Carried forward from prior audits (PHASE_0_READ_ONLY_AUDIT_2026-11-10, MASTER_PROJECT_AUDIT, REMAINING_WORK) and re-checked against this tree.

| Area | Classification | Basis |
|---|---|---|
| Prisma client generation / typecheck | PARTIALLY (locally engine-blocked) | Types generated; `tsc` passes; CI green on MySQL 8.0; native engine download blocked by sandbox TLS |
| Test suite | VERIFIED WORKING (logic layer) | 1,455/1,455 pass offline against production-schema SQLite |
| Lint | VERIFIED WORKING | `eslint .` clean |
| Client ID `TECH-YYYY-NNNNNN` + duplicate-resistant merge | VERIFIED WORKING | `src/lib/ids.ts`, `crm-merge.ts`, DB tests |
| Scope versioning + approval immutability | VERIFIED WORKING | DB tests pass |
| HTML preview tokenization + expiry | VERIFIED WORKING (model/policy level) | `preview-policy.test.ts` pass; live HTML output for a real project not tested |
| Payment gating (no PAID without verified reconciliation) | VERIFIED WORKING (DB-transaction level) | `payment-gated project activation`, `failed payment verification has no activation side effect` |
| Source handover (SHA-256, gated on verified full payment) | VERIFIED WORKING (DB level) | handover tests pass |
| WebChat session security | VERIFIED WORKING (code review level) | signed HttpOnly/SameSite/Secure cookie, constant-time check, idempotency, consent |
| AI workforce registry | VERIFIED WORKING (structure) | 44 agents validated; execution blocked without provider credentials |
| Public website pages / service detail / industries | IMPLEMENTED_NOT_TESTED | Routes + components exist; no browser execution |
| Client portal / Super Admin console | IMPLEMENTED_NOT_TESTED | Code present; not exercised in a browser |
| WhatsApp / SMS / SMTP / Stripe / social / n8n | NOT_CONFIGURED | Adapters built, honest fail-closed; no credentials, no live calls |
| Browser E2E / accessibility / mobile responsiveness | MISSING (not tested) | No Playwright/a11y suite |
| QA / `QaRecord`, `Milestone`, `DeliveryArtifact`, `DiscoverySession` models | MISSING | Tracked via JSON blobs / `ProjectTask`; identified as P1 gap in prior audits |
| `main` branch protection | NOT VERIFIED | GitHub reported `protected: false`; owner gate |
| Production deployment (Hostinger Node.js Web App) | NOT VERIFIED | CI does not deploy; deployed SHA/runtime unknown |

---

## 7. KNOWN BLOCKERS & RISKS (CARRIED FORWARD)

From `KNOWN_ISSUES_AND_BLOCKERS.md` (updated 2026-10-26) and prior audits:

- **B-001/B-003:** Hostinger deployment never verified; domain `bdtech360.com` unreachable from sandbox (TLS/empty replies); cannot distinguish "site down" from sandbox egress limits.
- **B-002/B-005:** No production MySQL access; local Prisma engine download blocked (this session).
- **B-004/B-007/B-008:** CI green but branch protection / Node runtime warnings / ruleset policy not certifiable from this session.
- **B-006/B-009/B-011:** External providers (SMTP, SMS, Stripe, AI, n8n) not credentialed or exercised; fail-closed by design.
- **B-010:** Stale second public repo `engralaminn-collab/tech360`.
- **S-2/S-3 (security):** channel status derives from env presence, not verified connectivity; WhatsApp env-name drift between code (`WHATSAPP_TOKEN`) and some operator docs (`WHATSAPP_ACCESS_TOKEN`).
- **S-6:** `main` branch unprotected; repository public (owner decisions D-2/D-3).
- Missing first-class models: `Milestone`, `QaRecord`/`QA`, `DeliveryArtifact`, `DiscoverySession`, `Tenant` (client-level isolation only; single-business CRM coherent, not multi-tenant SaaS).
- No malware scanning beyond honest pattern checks; no rehearsed rollback; no proven-restorable production backup.

None of these were worsened by this session. None were silently suppressed.

---

## 8. CHANGES MADE IN THIS SESSION (branch `arena/8e149e11-tech360`)

1. `package.json` / `package-lock.json`: declared `@prisma/adapter-libsql@^6.19.3` and `@libsql/client@^0.15.15` as dev dependencies (offline test adapter, matches `@prisma/client` 6.19.3).
2. `src/components/site/SiteHeader.tsx`: public navbar now renders the real TECH360 logo (`/images/tech360-logo.png`) instead of the generic monogram; deleted `src/components/site/BrandMark.tsx`.
3. `src/components/site/SiteFooter.tsx`: public footer now renders the real TECH360 logo instead of the generic monogram.
4. `docs/BASELINE_EVIDENCE_REPORT_2026-11-11.md`: this report (new).

Verification after changes: `npm run lint` PASS, `npx tsc --noEmit` PASS, `npm run test:offline` 1,455/1,455 PASS.

---

## 9. RECOMMENDED NEXT STEPS (NOT EXECUTED)

1. Reconcile PR #67 overlap (branding + factory Super Admin boundaries) before any merge targeting the same surfaces — do not discard either set of functionality.
2. Run `prisma generate`, typecheck against the live generated client, full suite, `next build` and MySQL 8 CI in an environment that can reach `binaries.prisma.sh`.
3. Add browser E2E + accessibility + mobile responsiveness coverage for the primary WebChat channel and public routes.
4. Add first-class `Milestone`, `QaRecord`/`QA`, `DeliveryArtifact`, `DiscoverySession` migrations (additive only) to unblock the §10 delivery gate.
5. Formalize the four-state connectivity vocabulary and verify WhatsApp env name (`WHATSAPP_TOKEN` per `.env.example`) against operator docs.
6. Obtain owner decisions D-1…D-10 (canonical repo, repo visibility, protect `main`, staging/read-only prod DB, restored backup drill, credentials).
7. Only then: Phase 1–15 implementation per the master directive, PR with baseline findings, security review, CI gates, staging acceptance, human review, then deployment via Hostinger Node.js Web App and rollback verification.

---

## 10. BASELINE VERDICT

**NOT READY for production.** Engineering core (CRM, identity, approvals, SOW, preview, payment gate, handover, RBAC, WebChat) is implemented and passing 1,455 tests at the logic layer; production has never been observed (no DB access, no backup restore, no health check, no deployment evidence, `main` unprotected, external integrations unconfigured). This matches the prior audit's "PROCEED WITH CONDITIONS" — owner-gated infrastructure and verification work remains before any go-live claim.

---

*Evidence commands and outputs in this report were captured from `/home/user/tech360` at HEAD `b8486a7` on 2026-11-11. No production data, credentials, or deployments were accessed.*