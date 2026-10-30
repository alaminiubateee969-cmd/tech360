# Work showcase gallery, intake attribution, lead follow-up automation, installer + cPanel guide

**Branch:** `arena/35a29cec-tech360` → **base:** `main` (`3c10b6c`)
**Commit:** `9b3bbc5a18187be35369261965327ec7b131949c`
**Type:** additive audit-driven change set. No merge, no deploy, no production change.

---

## 1. Audit result that drove this PR

A read-only, command-based audit of the whole repository
([`docs/AUDIT_2026-10-30_GAP_REPORT.md`](../blob/arena/35a29cec-tech360/docs/AUDIT_2026-10-30_GAP_REPORT.md)).

Prior project documents quoted **43 Prisma models / ~110 API routes**. Measured in
this checkout: **75 models, 201 route handlers, 506 source files, 43 registered AI
agents, 20 pipeline stages, 14 migrations**. Those older figures are stale.

Already implemented and preserved (not rebuilt): Client ID sequencing
(`TECH-YYYY-NNNNNN`, atomic, non-reusing), RBAC with 21 capabilities, approval
gates, WhatsApp Cloud API webhook + templates + inbox, SMTP mail, portal OTP auth,
HTML-preview-before-payment and source-after-full-payment flows, audit logging,
security headers, CSRF, rate limiting, file validation.

Genuine gaps found and filled here: work gallery, UTM/device/browser/location
capture, CRM task + follow-up scheduling on intake, `MARKETING`/`DESIGNER` roles,
installer, cPanel guide.

Deliberately **not** done, and why:

| Item | Reason |
|---|---|
| `CLIENT` added to staff `ROLES` | Clients authenticate through the separate portal (OTP). Adding them to the console role list would let the team API mint console users whose access depends on rank instead of portal ownership checks. Needs an owner decision. |
| WhatsApp broadcast module | Needs Meta template-category rules and opt-out handling before it is safe. Bulk sending already exists via campaigns. |
| `install.php` | This is a Node/Next.js app with no PHP runtime. A PHP installer could not create an admin, run migrations, or write config — it would be an inert file implying capability that does not exist. Replaced by `scripts/install.mjs`. |
| Per-email open tracking | Newsletter open/click tracking exists; extending it to transactional mail is a privacy-policy decision. |

---

## 2. What changed

### New

| File | Purpose |
|---|---|
| `src/data/work-examples.ts` | 12 systems, typed, with `outOfScope` per entry and a shared honesty notice |
| `src/components/site/WorkExamples.tsx` | Premium gallery: category filters, asymmetric grid, accessible detail dialog (Escape / backdrop / focus return), visible concept notice |
| `public/images/work/*.jpg` | 12 generated concept visuals, **self-hosted** (the existing `images.json` relies on an external CDN) |
| `src/lib/intake-context.ts` | Pure attribution/device/location extraction — allowlist, bounded, header-only geo |
| `src/lib/attribution-client.ts` | First-touch UTM capture in `sessionStorage`, allowlisted keys only |
| `src/lib/lead-followup-policy.ts` | Pure follow-up scheduling policy (4 branches) |
| `src/lib/lead-followup.ts` | Persistence: `Lead.tracking.followUp` + CRM task |
| `scripts/install.mjs` | `install:check` / `install:app` — config validation, `migrate deploy`, idempotent SUPER_ADMIN seed, integration state reporting |
| `docs/CPANEL_DEPLOYMENT.md` | cPanel Node.js deployment, honest host requirements, verification commands |
| `docs/AUDIT_2026-10-30_GAP_REPORT.md` | Full audit + prioritised gap report (G-01…G-09) |
| `tests/intake-context.test.ts`, `tests/lead-followup-policy.test.ts`, `tests/role-expansion.test.ts`, `tests/work-examples.test.ts` | 37 new assertions |

### Modified

| File | Change |
|---|---|
| `src/app/api/contact/route.ts` | Captures intake context; stores attribution/device/location; schedules follow-up; creates CRM task; records outcome in the audit log |
| `src/components/site/ContactView.tsx` | Sends first-touch UTM payload instead of the raw hash |
| `src/components/site/WorkView.tsx` | Gallery rendered above the existing illustrative scenarios — both sections kept |
| `src/components/admin/ClientDetailView.tsx` | Attribution / device / location / follow-up panel; says "Not captured" rather than hiding gaps |
| `src/lib/constants.ts`, `src/lib/access-policy.ts` | `MARKETING` + `DESIGNER` roles at staff rank, restricted capabilities |
| `src/lib/journey.ts` | `createHumanTask` exported (one task implementation; no behaviour change) |
| `src/lib/admin-client.ts` | `LeadRecord` gains `tracking`, `sourceDetails` |
| `package.json` | `install:check`, `install:app` |
| `tests/operating-model-hardening.test.ts` | Role list extended |
| `KNOWN_ISSUES_AND_BLOCKERS.md`, `REQUIREMENTS_REGISTER.md` | Dated B-005 evidence refresh; pointer to the current audit |

### Removed

Nothing. The 25 deleted diff lines are all **replaced in place**: the old
`tracking` object construction, `PageHero` copy, a duplicate `sr-only` heading id,
`createHumanTask` visibility, and one test title. No page, route, model, agent,
template, capability, or assertion was dropped.

### Data safety

No Prisma schema change and **no migration**. Attribution and follow-up reuse
existing JSON columns (`FormSubmission.tracking`, `Lead.tracking`), so a
production `migrate deploy` has nothing new to apply. Verified that no other
consumer parses those columns' structure, so the shape change cannot break an
existing reader.

---

## 3. Verification

Environment: clean `npm ci` (862 packages), Node 22.22.3.

| Gate | Result |
|---|---|
| `npx eslint .` | **PASS** — 0 errors, 0 warnings |
| `npx tsc --noEmit` | **PASS** — see Prisma caveat below |
| `npx tsx --test tests/**/*.test.ts` | **1015 tests, 978 pass, 10 fail** |
| New tests only | **118/118 pass** (new + adjacent: intake, follow-up, roles, work-examples, operating-model, contact policy/consent, RBAC) |
| Live smoke | `/` **200**, `/?x=1` **200**, `/robots.txt` **200**, **12/12** gallery images **200** (`image/jpeg`) |
| Unauthenticated admin APIs | `/api/admin/clients`, `/team`, `/settings`, `/memory` → **401 UNAUTHENTICATED** |
| Contact validation | missing consent → **400**, invalid request id → **400** (unchanged contract) |
| Gallery actually shipped | Strings `Twelve production-grade…`, `eCommerce Storefront`, `work-examples` found in the served client chunks |

### The 10 failures are pre-existing — proven, not asserted

I ran the 10 affected files on this branch and again on a stashed clean `main`:

| Run | tests | pass | fail | cancelled |
|---|---|---|---|---|
| Branch | 87 | 62 | **10** | 15 |
| Clean `main` (control) | 87 | 62 | **10** | 15 |

Identical. Causes are environmental (no generated Prisma client, no MySQL):
`database-workflows`, `governance-db`, `governance-outbound-db`,
`hostinger-mail-inbound`, `hostinger-mail-client-boundary`, webhook/body-cap,
`social-webhook-idempotency`, `model-service`, `outbox-retry-integration`,
`rag-pipeline`, plus 2 `communication-pipeline` copy-drift assertions (tracked as
finding **G-07**, not fixed here because it needs approved final wording).

---

## 4. Prisma blocker (B-005) — unchanged, nothing fabricated

| Check | Result |
|---|---|
| `prisma` / `@prisma/client` | `6.19.3` / `6.19.3` — untouched, no 7.x installed |
| `@prisma/engines-version` | `7.1.1-3.c2990dca…` |
| Datasource | `provider = "mysql"` — unmodified |
| `prisma generate` | **FAILED** — engine download blocked |
| `prisma generate --no-engine` | **FAILED** — same schema-engine download |
| `binaries.prisma.sh` | TLS handshake failure (`SSL_ERROR_SYSCALL`), HTTP `000` |
| `registry.npmjs.org` | HTTP `200` (npm works; engine CDN does not) |
| Cached engine binary | none on the filesystem |

Consequences stated precisely:

- `node_modules/.prisma/client` is the placeholder stub (`PrismaClient: any`), so
  `tsc --noEmit` passes **without validating any Prisma query shape**.
- Database-backed routes return 5xx here: `GET /api/health` → **503**
  (`database: DOWN`), `GET /sitemap.xml` → **500** (`src/app/sitemap.ts` → `db`),
  `POST /api/contact` → **500** after validation passes.
- DB-backed integration suites are **blocked**, not passing.
- `npm run build` was **not run** locally (same engine download).

Rules honoured: no engine-mirror override, no TLS bypass, no incompatible
downgrade/upgrade, no hand-written client, no production `DATABASE_URL` set or read.

---

## 5. Screenshots

Not captured: no browser-capture tooling is available in this sandbox, and I will
not describe a visual result I did not observe. Instead, rendering was verified at
the bundle level and every asset at HTTP level (table in §3). A reviewer can
reproduce with:

```bash
npm ci && PREVIEW_SQLITE_URL= PORTAL_OTP=off npx next dev -H 0.0.0.0 -p 3000
# open /#/work  (gallery) and /#/contact
```

To capture real screenshots, run on a host where `prisma generate` succeeds and
the DB is reachable, then screenshot `/#/work`, a detail dialog, and the
`/#/admin` client "Lead Intake" panel.

---

## 6. Review notes

- Attribution is **untrusted input**: the client payload is re-sanitised and
  re-validated server-side; only allowlisted keys survive; referrer is reduced to
  a hostname and landing path to a pathname (both previously stored raw).
- Location is **coarse and header-only**; absent headers store `null`, never a
  guess, and no geo-IP service is contacted.
- Follow-up scheduling **cannot** fail the submission: it runs after the lead is
  saved, and a failure is recorded in the audit log with `followUpStored`/
  `taskCreated` flags rather than turning the visitor's request into an error.
- The gallery makes no performance, revenue, award or endorsement claim, and a
  test enforces that (regex ban on `%`, `Nx`, "guarantee", "proven", "award").

---

## 7. Known blockers / remaining work before a production claim

1. **G-01** — no provider exercised (SMTP, WhatsApp, SMS, AI). All integrations
   remain configuration-gated; none is marked active.
2. **G-05/G-06** — Prisma client generation and `npm run build` must run on a host
   with engine-CDN access; attach CI/host evidence.
3. **G-02** — decide whether `CLIENT` becomes a console role or stays portal-only.
4. **G-03** — WhatsApp broadcast needs template/opt-out policy before shipping.
5. **G-07** — `communication-pipeline` welcome-email copy drift needs approved
   final wording.
6. **G-04** — remaining `images.json` CDN dependencies should be self-hosted.

**This PR is not merge-ready until a host build passes and B-005 is cleared.**
No CI status is claimed; CI on this branch has not been observed.
