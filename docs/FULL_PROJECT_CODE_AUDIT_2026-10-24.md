# TECH360 — Full Project Code Audit

**Audit date:** 2026-10-24
**Repository:** `alaminiubateee969-cmd/tech360` · branch `arena/7fc398c7-tech360` (from `main` @ `1007764`)
**Application version:** 0.2.1
**Auditor:** Arena agent (automated code review + live runtime verification)
**Companions:** [`OPERATIONS_GUIDEBOOK.md`](./OPERATIONS_GUIDEBOOK.md) ·
[`BACKUP_AND_RESTORE.md`](./BACKUP_AND_RESTORE.md) ·
[`PAYMENT_INTEGRATION_POLICY.md`](./PAYMENT_INTEGRATION_POLICY.md)
**Revision:** 2 — post-audit remediation (2026-10-24). Sections 10–13 record what changed, what was
re-verified, and what is still blocked.

---

## 0. Executive summary

TECH360 is a genuinely complete, production-shaped application: one Next.js 16 codebase that serves a
public marketing website, a client portal, a 46-view Super Admin CRM console, a 44-agent AI workforce, a
20-stage commercial pipeline and an automatic document/finance engine on the company letterhead. The
codebase is large (≈91,500 lines of TS/TSX, 180 API route files, 73 Prisma models) but unusually
disciplined: business rules live in small testable policy modules, integrations are honest about their
state, and destructive actions are gated by human approvals.

**Verified in this audit (ran here):**

| Gate | Command | Result |
|---|---|---|
| Lint | `npm run lint` | **PASS** — 0 errors |
| Type check | `npm run typecheck` | **PASS** — 0 errors (against a generated Prisma client) |
| Unit / policy tests | `npm test` | **951 / 954 PASS**, 3 blocked (MySQL-only, no local MySQL). Revision 2 added 36 tests |
| Dependency install | `npm ci` | **PASS** — 862 packages |
| Runtime boot | `next dev` + health | **PASS** — `/api/health` → `healthy`, `database: UP`, 44 agents |
| Public site | `GET /` | **PASS** — HTTP 200, server-rendered HTML |
| Admin auth + RBAC | login + 12 admin APIs | **PASS** — session issued, guards enforced |
| Commercial seed | `prisma/seed.ts` | **PASS** — admin, 110 departments, 44 agents, 26 workflows, 2,223 prompts, 6 posts |
| Demo CRM dataset | `scripts/preview/seed-demo.ts` | **PASS** — 6 clients, 6 leads, 3 projects, 27 tasks, 3 invoices, 3 payments |

**Not verifiable in this environment (and honestly reported as such):**

| Item | Why | Where it is covered |
|---|---|---|
| `npm run build` / `npm start` | Prisma engine binaries download from `binaries.prisma.sh`, which this sandbox cannot reach | GitHub Actions CI (disposable MySQL) |
| MySQL-specific behaviour | no MySQL server available | CI `migrate deploy` + drift gates |
| 3 database-backed test files | they construct a native-engine `PrismaClient` | CI |
| Live provider integrations (Stripe, WhatsApp, SMTP, SMS, social, AI) | no credentials | requires provider acceptance testing |
| Hostinger deployment state | no access to hPanel/runtime | owner verification |

Everything below distinguishes **verified** from **reported by documentation** from **not verified**.

---

## 1. What was reviewed

| Area | Files | Method |
|---|---|---|
| Routing surface | `src/app/**` (180 API routes, catch-all page, sitemap, rss) | inventory + spot review |
| Public site | `src/components/site/**` (31 views), `src/data` | render + route catalog review |
| Admin console | `src/components/admin/**` (46 views), `AdminApp.tsx` nav/RBAC | inventory + API contract spot checks |
| Business logic | `src/lib/**` (130 modules): pipeline, lifecycle-policy, commerce-policy, access-policy, ops-loop, agents, comms, invoices, handover, preview, security | read + behaviour checks |
| Data layer | `prisma/schema.prisma` (73 models), 14 migrations, seed | schema analysis + live queries |
| Governance | approvals, feature flags, gateway switches, honest-state reporting | read + API verification |
| Operations | scripts, CI workflows, deployment docs, backup/health endpoints | read + run |
| Documentation | 57 files under `docs/` + 12 root-level documents | consistency review |

---

## 2. Architecture assessment

### 2.1 Strengths (these are real and should be preserved)

1. **Policy modules instead of scattered `if`s.** `lifecycle-policy.ts`, `commerce-policy.ts`,
   `pipeline/rules.ts`, `contact-policy.ts`, `preview-policy.ts`, `invoice-policy.ts`, `dcc-policy.ts`,
   `access-policy.ts` are small pure functions with direct tests. This is the single biggest reason the
   system is auditable.
2. **Honest integration states.** Every adapter reports `CONFIGURED` / `NOT_CONFIGURED` /
   `INTEGRATION_NOT_BUILT` / `DISABLED_BY_ADMIN` and *refuses* instead of faking. There is no code path
   that marks a message sent or a payment settled without evidence.
3. **Server-side settlement only.** Payments settle from a verified webhook or an admin verification,
   never from a browser success URL. CSRF double-submit + RBAC + capability guards on admin mutations.
4. **Human approval as a first-class object.** `ApprovalRequest` covers scope sending, payment
   instructions, refunds, source handover, credential operations, deletions and social publishing, with
   risk levels and a configurable auto-approve floor.
5. **Closure is evidence-based.** A project cannot be closed without payment, all tasks done, delivery
   acceptance (explicitly received + working) and handover confirmation.
6. **Provider isolation.** Outbound channels share one outbox with retries, dead-lettering and attempt
   bookkeeping; the AI provider has an ordered fallback chain and a private local-model path.
7. **Lazy Prisma client.** `src/lib/db.ts` builds the client on first access, so pure modules (SOP
   executor, prompt retriever, policies) are loadable without a database — this is what makes 915 tests
   runnable in under 20 seconds.
8. **Operational self-knowledge.** `/api/health`, `/api/health/deep`, `/api/metrics`, the ops scan and the
   Backup & Recovery view report what they can *verify*, not what they hope.

### 2.2 Structural observations

| Observation | Impact | Recommendation |
|---|---|---|
| One SPA entry with hash routes for site/admin/portal | simple deploy, but hash routes are not indexable and can't use HTTP status codes for admin | already mitigated: real deep links via `[...path]` for public pages; keep admin hash-only |
| 46 admin views in one lazy chunk (`AdminApp`) | large first load for the console | acceptable; consider per-view dynamic import if console load time becomes an issue |
| 130 lib modules with a handful of very large files | cognitive load | keep new logic in small policy modules |
| `.zscripts/` contains historical one-off scripts and PNGs | repo clutter; some reference throwaway data | move to an archive branch or delete in a dedicated cleanup PR |
| 57 docs with overlapping scope | contradictions accumulate (see F-03) | this guidebook becomes the operational source of truth; retire superseded docs |

---

## 3. Findings register

Severity: **P0** production-blocking · **P1** material risk · **P2** quality/hygiene · **P3** nice-to-have.

### F-01 · P1 · ~~Public WhatsApp contact contradicts the recorded owner decision~~ → **RESOLVED (rev. 2)**
**Evidence (verified):** `src/lib/site-contact.ts` defines `PUBLIC_CONTACT.whatsappE164 = '+8801327100297'`
with a `wa.me` deep link; `src/components/site/SiteFooter.tsx:111-117` renders that link and number;
`src/lib/constants.ts` and `src/data/site.ts` re-export it. Meanwhile `README.md` states the latest owner
decision is *"no public WhatsApp number/action; AI support is the public contact route"*, and
`KNOWN_ISSUES_AND_BLOCKERS.md` says the public WhatsApp contact was removed by directive.

**Risk:** the site publishes a channel the owner believes is gone, and inbound WhatsApp traffic that
nobody is watching. This is a compliance/expectation risk, not a code defect.
**Resolution (rev. 2):** option (a), on owner instruction. The number, its `wa.me` link and every
helper that produced them were removed from `src/lib/site-contact.ts`, `src/lib/constants.ts`,
`src/data/site.ts`, `SiteFooter`, the generic `WhatsAppLink` component (no shared fallback any more),
the portal sign-in copy, the service CTA and three legal-policy paragraphs. Webchat, the enquiry form
and email were verified working afterwards (`TECH-2026-000107` and `-108` created in the live run).
Pinned by 4 rewritten tests. See §10.

### F-02 · P1 · Hostinger start command / preflight invocation is unverified → **MITIGATED (rev. 2), hosting side still open**
**Evidence (documented, not verified):** `npm start` runs `prestart` (env validation) then
`.next/standalone/server.js`. Hostinger's Next.js preset manages the server process; whether it invokes the
npm lifecycle is **not verified** in the repository.
**Risk:** if `prestart` never runs, a misconfigured production environment boots "successfully" and fails
later in confusing ways (or worse, runs with a weak secret).
**Mitigation (rev. 2):** `npm start` now runs `scripts/start-production.mjs`, which validates the
environment, refuses `PREVIEW_SQLITE_URL`, prints a redacted summary and only then boots the standalone
server — so the check no longer depends on npm lifecycle support. 10 tests cover it, including "no secret
value is printed". **Still open:** which command hPanel actually runs is not verifiable from this
repository; if the field contains `node .next/standalone/server.js` the wrapper is bypassed. Operator
must confirm and record it (guidebook §3.1a).

### F-03 · P1 · Documentation drift across 57 docs
**Evidence (verified):** `MASTER_PROJECT_AUDIT.md` describes SQLite + 43 models + SSH VPS deployment
(historical), `docs/PROJECT_STATE_REPORT.md` is dated 2026-10-03 and references an older branch/SHA,
`KNOWN_ISSUES_AND_BLOCKERS.md` partially conflicts with the code (F-01), and `DATABASE_SCHEMA_AND_MIGRATION_GUIDE.md`
overlaps `docs/architecture/DATABASE_ARCHITECTURE.md`.
**Risk:** an operator following an old document executes a retired procedure.
**Action:** mark superseded documents at the top (as `MASTER_PROJECT_AUDIT.md` already does) and point to
`OPERATIONS_GUIDEBOOK.md` + `docs/PROJECT_STATE_REPORT.md` as the only current sources.

### F-04 · P2 · Payment gateways that cannot be enabled are still documented as configurable → **RESOLVED (rev. 2)**
**Evidence (verified):** `.env.example` lists `PAYPAL_*` and `SSLCOMMERZ_*`; the platform marks both
`INTEGRATION_NOT_BUILT`. Settings refuses to make them live.
**Risk:** a non-technical operator sets the variables and assumes card/SSLCommerz payments work.
**Resolution (rev. 2):** `.env.example` now states that PayPal/SSLCommerz adapters are not implemented;
`PUT /api/admin/settings` refuses to enable either with **409 `GATEWAY_NOT_BUILT`** before persisting
(verified live); `docs/PAYMENT_INTEGRATION_POLICY.md` defines the four conditions for "operational" and
the requirements a real adapter must meet. 10 tests pin the behaviour, including signature, replay,
amount/currency mismatch and duplicate settlement.

### F-05 · P2 · Database-backed tests cannot run without MySQL
**Evidence (verified):** `tests/database-workflows.test.ts`, `tests/governance-db.test.ts`,
`tests/governance-outbound-db.test.ts` construct a native-engine Prisma client. In this sandbox the engine
binary cannot be downloaded, so those three fail with `Missing configured driver adapter` (the preview
client is generated with `engineType = "client"`). With the correct script
(`tsx --test --experimental-test-module-mocks`) the other **915** tests pass, including all policy,
security, governance and API-contract suites.
**Risk:** the CRM→closure lifecycle is only covered in CI.
**Action:** keep CI as the gate; optionally add a preview-mode variant that runs those three against SQLite.

### F-06 · P2 · No automated backup job inside the product → **IMPLEMENTED (rev. 2), live run BLOCKED**
**Evidence (verified):** `/api/admin/backup` reports artifacts it can see (`BACKUP_DIR`); the legacy
`deployment/backup.sh` is retired and fails fast; no cron/scheduler is shipped.
**Risk:** the console can honestly report "no backup", but nothing creates one.
**Delivered (rev. 2):** `scripts/backup/mysql-backup.sh` (consistent dump, checksum, integrity and
completion-marker verification, retention 7/4/3, optional rclone/scp off-server copy, flock overlap
guard, redacted failure alerting, `last-run.json`) and `scripts/backup/mysql-restore-drill.sh` (hard
`tech360_drill_` prefix rail, refuses the production name, read-only on production, row-count
comparison, `last-drill.json`). The admin Backup & Recovery view now reads that evidence and shows
`VERIFIED` only when the last run succeeded **and** a drill passed. 15 behavioural tests pin the
wrapper. **Blocked:** executing a real dump/restore needs the production MySQL server and host access;
until then backup status is **UNVERIFIED** (see §12).

### F-07 · P2 · Ops loop depends on an external trigger or the in-process driver
**Evidence (verified):** `AI_OPS_DRIVER` defaults to on (in-process); `/api/ops/cycle` requires
`OPS_SECRET`; `mini-services/ai-ops` is development tooling. In a fresh local run `/api/health` reported
`aiOperations: OFFLINE` until a cycle ran.
**Risk:** on a serverless/sleeping host the loop may not run on schedule.
**Action:** confirm the driver is enabled in production and monitor the heartbeat in `/api/health`.

### F-08 · P2 · Repository hygiene
**Evidence (verified):** `.zscripts/` holds 20+ one-off rebuild scripts and screenshots; `worklog.md` is
184 KB; root contains several overlapping audits.
**Action:** archive in a dedicated cleanup PR (no behavioural change).

### F-09 · P3 · `/api/admin/leads` does not exist
**Evidence (verified):** `GET /api/admin/leads` → 404; the console uses `/api/admin/pipeline` and
`/api/admin/leads/export`. Consistent internally, but surprising for an API consumer.
**Action:** document the route map (done in the guidebook) or add an alias.

### F-10 · P3 · ESLint excludes React-Compiler-only advisory rules
**Evidence (documented in `eslint.config.mjs` / `docs`):** Next 16 ships advisory rules targeting the React
Compiler, which this project does not enable; they are explicitly excluded, not hidden.
**Action:** none, unless React Compiler is adopted — then re-enable and fix.

### F-11 · P3 · Preview mode was added in this audit (new code)
**Evidence (this change):** `src/lib/preview-db.ts` + a guarded branch in `src/lib/db.ts`, plus
`scripts/preview/*`. It lets the whole product run on SQLite without MySQL.
**Safety:** refused when `NODE_ENV=production`; refuses non-`file:` URLs; the adapter is resolved lazily so
the production bundle never depends on it; the packages are optional (`npm i --no-save`).
**Action:** keep it development-only; never set `PREVIEW_SQLITE_URL` in hPanel.

---

## 4. Security review

| Control | Implementation | Verdict |
|---|---|---|
| Password storage | `src/lib/auth.ts` hash + verify, constant-time compare | OK |
| Session | HttpOnly `t360_session`, 12 h, server-side `Session` rows | OK |
| CSRF | double-submit `t360_csrf` on every admin mutation | OK |
| RBAC | `guard(req, {minRole|capability})` on admin routes; 21 capabilities × 10 roles | OK |
| 2FA | TOTP enrol/verify, challenge before session | OK |
| Lockout / rate limit | 5 fails → 15 min lock; per-IP limits on auth, chat, contact, portal | OK |
| Portal auth | Client ID + contact + **mandatory OTP** in production; fails closed (503) without a channel | OK |
| Webhooks | per-provider HMAC secrets, replay receipts (`InboundWebhookReceipt`) | OK |
| Secrets | env-only, ≥32 chars, distinct, validated before start | OK |
| Headers | nosniff, frame options, referrer policy, permissions policy, HSTS in `next.config.ts` | OK |
| PII in logs | Prisma `query` logging disabled in production (bound values are PII) | OK |
| File safety | sha256 + scan status + quarantine, no public serving of uploads | OK (scanner is a boundary) |
| Payment integrity | settlement only from verified webhook / admin verification | OK |
| Source protection | handover requires full payment + approval + unguessable token + expiry | OK |

**Residual risks:** no certified penetration test, no external malware scanner, no WAF/CDN binding
documented, and the `www`/`http` redirects depend on the proxy sending `x-forwarded-proto` truthfully.

---

## 5. Data layer review

- **73 models**, no enums (all statuses are validated strings — flexible, but the validation must stay in
  policy modules; it does).
- **14 migrations** including a `0_init` baseline; production applies them with `migrate deploy` inside the
  build, which means **a failed migration fails the deploy** — good, provided a backup exists (F-06).
- **MySQL native types** are enforced by `npm run schema:check` (86 annotations); any new long-text field
  without `@db.Text`/`@db.LongText` will fail the gate. Correct for MySQL 191-char VARCHAR semantics.
- **Money** is stored as float **and** integer minor units. Reconciliation must always use the minor units.
- **Soft deletion** (`deletedAt`, `mergedIntoId`) protects CRM history; hard deletes are avoided.
- **Sequence counters** are transactional, which is what makes `TECH-YYYY-NNNNNN` / `INV-YYYY-NNNN` /
  `PRJ-YYYY-NNNN` gap-free.
- **Indexes** are present on the hot paths (email, whatsapp, pipeline stage, clientId relations), consistent
  with the 73-model surface.

---

## 6. Runtime verification detail (this sandbox)

Environment: Node 22.22.3, no MySQL, no Prisma engine binaries, no provider credentials.
Method: preview mode (SQLite via libSQL driver adapter) running the real application code.

```
GET /                      200  server-rendered marketing HTML
GET /api/health            200  {status:"healthy", database:"UP (SQLite via Prisma — connected)",
                                aiAgents:"UP — 44 agents registered", aiOperations:"OFFLINE",
                                channels: all false (honest NOT_CONFIGURED)}
POST /api/auth/login       200  session + CSRF cookies issued for SUPER_ADMIN
GET /api/admin/dashboard   200  44 agents with department + level + approval flags
GET /api/admin/pipeline    200  leads by stage
GET /api/admin/clients     200  client master records
GET /api/admin/projects    200  projects with task progress
GET /api/admin/invoices    200  invoices on the letterhead engine
GET /api/admin/analytics   200  traffic/conversion series
GET /api/admin/conversations 200 visitor inbox
GET /api/admin/approvals   200  governance inbox
GET /api/admin/workforce   200  configured org chart
GET /api/admin/reports/ceo 200  executive report
GET /api/admin/settings    200  feature flags + gateway states
GET /api/blog              200  published posts
```

Behavioural checks that passed:

- **Guard direction:** with `mustChangePassword = true` the dashboard API returned
  `403 PASSWORD_CHANGE_REQUIRED` — the gate works and is enforced server-side.
- **Honest channels:** with no credentials, `/api/health` reports every channel `false`; nothing pretends
  to be connected.
- **Seed integrity:** the production seed ran unmodified against SQLite and produced the documented
  inventory (110 departments, 44 agents, 26 workflows, 2,223 prompt templates, 6 blog posts).

---

## 7. Production readiness scorecard

| Dimension | State | Comment |
|---|---|---|
| Application completeness | **High** | every pipeline stage has UI + API + policy |
| Code quality | **High** | small policy modules, strong typing, lint/typecheck clean |
| Security controls | **High** | RBAC, CSRF, 2FA, OTP, webhook HMAC, audit |
| Test coverage | **Medium-High** | 918 tests, 915 pass locally; DB lifecycle only in CI |
| Deployment automation | **Medium** | one CI workflow; deployment via Hostinger Git integration |
| Operational tooling | **Medium-High** | health/metrics/logs/ops monitor/backup view; no backup job (F-06) |
| External integrations | **Low-Medium** | code complete, credentials absent, several `INTEGRATION_NOT_BUILT` |
| Documentation | **Medium** | excellent depth, poor currency (F-03) — this guidebook fixes the operational gap |
| Data safety | **Medium** | migrations gated; backups depend on hosting |

**Overall:** ready to operate as a production system **once** the F-02 (startup validation), F-06 (backup
job) and F-01 (WhatsApp decision) items are closed. It is *not* ready to sell card/PayPal/SSLCommerz payment
until those adapters are built and provider-tested.

---

## 8. Recommended order of work

1. **F-01** owner decision on the public WhatsApp number (30 minutes).
2. **F-06** schedule and prove a database backup; run one restore drill (half a day).
3. **F-02** confirm the Hostinger startup lifecycle and the preflight (1 hour, during a deploy window).
4. **F-04** annotate `.env.example` for gateways that are not implemented (15 minutes).
5. **F-03/F-08** documentation consolidation and repo cleanup (1–2 days, no behaviour change).
6. **F-05** optional SQLite variant of the three DB tests (half a day).
7. Then, only with provider approval: build PayPal/SSLCommerz adapters, connect real channels, and record
   acceptance evidence before switching any gateway to live.

---

## 9. Method notes and limits

- This audit did not access hPanel, production MySQL, DNS/TLS, provider dashboards, or customer data.
- No production system was mutated. The only database written was a throwaway SQLite file under
  `.preview/` (git-ignored).
- Statements about provider behaviour are based on this repository's adapters and documented contracts,
  not on live provider calls.
- "Verified" in this document means *executed in this sandbox on this date* with the exact commands shown.

---

# Part II — Post-audit remediation (revision 2, same date)

This part records the remediation pass requested after revision 1. Every claim below is either
**executed in this sandbox** (commands shown) or explicitly **BLOCKED** with the missing access named.
Nothing is marked production-ready because a preview works.

## 10. Task 1 — public WhatsApp channel removed

**Status: PASS (verified).**

Removed the published number and every public chat deep link:

| File | Change |
|---|---|
| `src/lib/site-contact.ts` | `whatsappE164`, `whatsappDisplay`, `whatsappDigits`, `whatsappLink` deleted; owner decision documented; `channels: ['webchat','enquiry-form','email']` added |
| `src/lib/constants.ts` | `COMPANY.publicWhatsApp` / `publicWhatsAppLink` deleted |
| `src/data/site.ts` | `COMPANY.publicWhatsApp` / `whatsappLink` deleted; the number removed from three legal-policy contact paragraphs (privacy, payment, handover) |
| `src/components/site/SiteFooter.tsx` | WhatsApp anchor removed; email + AI-chat entry remain |
| `src/components/site/buttons.tsx` | `WhatsAppLink` no longer falls back to a shared number — it renders nothing unless a caller passes an explicit number |
| `src/components/site/PortalView.tsx` | "or message us on WhatsApp" replaced with email + chat |
| `src/components/site/ServiceDetailView.tsx` | CTA copy no longer promises a WhatsApp engineer |
| `src/components/site/DesignKitView.tsx` | showcase note matches reality |
| `src/components/site/ChatWidget.tsx` | "WhatsApp is optional" → "A phone number is optional" |
| `tests/tech360-messaging-repair.test.ts` | the four contact tests rewritten to assert **absence** (number, `wa.me`, shared fallback) and presence of webchat + email |

Deliberately preserved: the visitor's own *preferred contact* option in the enquiry form and the private
WhatsApp Cloud API adapter (inbound webhook, outbound agent channel, OTP channel). Neither publishes a
TECH360 number.

**Verification (live run against the preview database):**

```
GET /                                        → 200;  "8801327100297" occurrences: 0;  "wa.me": 0;  info@bdtech360.com: 5
POST /api/chat/session  (email + consent)    → 201; Client ID TECH-2026-000107 issued
POST /api/chat/message                        → 201; honest AI-unavailable reply, no phone required
POST /api/contact       (consent + details)   → 200; Client ID TECH-2026-000108 issued
tsx --test tests/tech360-messaging-repair.test.ts → 56/56 pass
```

## 11. Task 2 — automated MySQL backups

**Status: IMPLEMENTED + wrapper-tested (PASS); real backup/restore on the host: BLOCKED (no MySQL, no
host access). Backup status therefore remains UNVERIFIED.**

| File | Purpose |
|---|---|
| `scripts/backup/mysql-backup.sh` | consistent dump, gzip, sha256, integrity + completion-marker checks, retention, optional off-site, flock, redacted alerts, `last-run.json` |
| `scripts/backup/mysql-restore-drill.sh` | isolated restore with mandatory `tech360_drill_` prefix, read-only on production, row-count comparison, `last-drill.json` |
| `tests/backup-tooling.test.ts` | 15 behavioural tests (see below) |
| `src/app/api/admin/backup/route.ts` | reads the evidence files; adds `runner` (health, last run, last drill, schedule) |
| `src/components/admin/BackupRecoveryView.tsx` | "Scheduled runner" panel + `Automation: VERIFIED/UNVERIFIED` |
| `docs/BACKUP_AND_RESTORE.md` | schedule, retention, off-site, drill, recovery, limitations |
| `.env.example` | `BACKUP_DIR`, `TECH360_BACKUP_DIR`, `TECH360_BACKUP_OFFSITE`, `TECH360_BACKUP_ALERT_WEBHOOK`, `BACKUP_SCHEDULE`, `BACKUP_SCHEDULE_NOTE` |

Safety properties proven by the tests (stubbed MySQL binaries — wrapper logic only):

```
ok 1 syntax and safety        — bash -n; non-mysql URL refused; web-root path refused; dry run
ok 2 a successful run         — .sql.gz + .sha256 + last-run.json; dir 700 / file 600; VERIFY_OK
                              — password absent from stdout, stderr, argv and every artefact
                              — failed dump → exit 3 + status FAILED; empty dump refused; corruption → exit 4
ok 3 overlap and retention    — second concurrent run exits 75; expired artefacts pruned, newest kept
ok 4 restore drill            — refuses target without the prefix; refuses the production name;
                              — restores into the isolated DB, records PASS, only DROP/CREATE on the drill DB;
                              — corrupted dump fails with exit 4, source untouched
15/15 pass
```

**Operator actions still required (in this order):**

1. Confirm hPanel → Advanced → Cron Jobs can run a shell command for the account.
2. Create `~/.tech360-backup.env` (mode 600) with `DATABASE_URL`, `TECH360_BACKUP_DIR`, optionally
   `TECH360_BACKUP_OFFSITE` / `TECH360_BACKUP_ALERT_WEBHOOK`.
3. Add the daily job (`15 2 * * *`) as described in `docs/BACKUP_AND_RESTORE.md` §4.2/§4.4.
4. Run `bash scripts/backup/mysql-backup.sh` once by hand; paste `last-run.json` into the operations log.
5. Run the drill once into `tech360_drill_<date>`; paste `last-drill.json`.
6. Only then does the console's `Automation` card read `VERIFIED`.

**Why it cannot be done here:** this sandbox has no MySQL server, no `mysqldump`, and no access to the
Hostinger account; the scripts were exercised only against stubbed binaries, which proves the wrapper and
not MySQL itself.

## 12. Task 3 — Hostinger production startup

**Status: MITIGATED + locally VERIFIED; hosting verification BLOCKED (no hPanel access).**

Changes:

* `scripts/start-production.mjs` (new): refuses `PREVIEW_SQLITE_URL`, runs the canonical
  `validate-production-env.mjs`, prints a name-only summary, then boots `.next/standalone/server.js`
  in-process. Works whether or not the host runs the npm `prestart` lifecycle.
* `package.json`: `start` → `node scripts/start-production.mjs`; new `start:check`.
* `scripts/validate-production-env.mjs`: added the explicit `PREVIEW_SQLITE_URL` refusal.

Verified locally (`npm run start:check` and 10 tests):

```
complete config                         → exit 0, "required production environment checks passed"
no secret value in output               → PASS (asserted for all four secrets + DB password + AI key)
missing SESSION_SECRET                  → exit 1, named in the error
weak OPS_SECRET                         → exit 1, "at least 32 characters"
identical secrets                       → exit 1, "must be distinct secrets"
DATABASE_URL=file:./dev.db              → exit 1, must be mysql://
APP_ORIGIN=https://staging…             → exit 1, canonical origin required
PREVIEW_SQLITE_URL=file:/tmp/preview.db → exit 1, refused in production
```

**BLOCKED and needing the owner:** the value of the hPanel "start command" field, the build log of the
next deploy, and the first runtime log. If the field is not `npm start`, change it (documented rollback:
set it back to the previous value; the deployed artefact is unchanged, so the app keeps running).
Record the observed values in guidebook §3.1a.

Also **BLOCKED here:** starting the real standalone server requires `npm run build`, which stops at
`prisma generate` because `binaries.prisma.sh` is unreachable from this sandbox (the EACCES hardening
runs first and is fine). CI covers the build against disposable MySQL.

## 13. Task 4 — incomplete payment integrations remain safe

**Status: PASS (hardened + verified).**

* New gate: `PUT /api/admin/settings` returns **409 `GATEWAY_NOT_BUILT`** for PayPal/SSLCommerz *before
  persisting anything*. Verified live:
  `{"error":"PAYPAL checkout is not implemented (INTEGRATION_NOT_BUILT) and cannot be enabled.","code":"GATEWAY_NOT_BUILT"}`.
* Confirmed no regression: `STRIPE` can still be toggled (it has a real adapter); gateways then report
  `CONFIGURATION_REQUIRED` until keys exist — never `ACTIVE` on the strength of a switch.
* `docs/PAYMENT_INTEGRATION_POLICY.md` defines "operational" (adapter + credentials + switch + server-side
  settlement evidence) and the nine requirements a real adapter must satisfy before going live.
* 10 tests pin: registry definitions, code-derived `checkoutBuilt`, the settings refusal ordering,
  "no settlement from a success URL", signature verification (valid / wrong key / tampered), replay
  outside tolerance, malformed headers, exact amount + currency matching, duplicate delivery.
* No live financial transaction was initiated, and none may be without explicit authorisation.

## 14. Task 5 — verification summary (revision 2)

| Gate | Command | Result |
|---|---|---|
| Lint | `npx eslint .` | **PASS** — 0 errors |
| Types | `npx tsc --noEmit` | **PASS** — 0 errors |
| Tests | `npx tsx --test --experimental-test-module-mocks tests/**/*.test.ts` | **951 / 954 PASS**, 3 BLOCKED (MySQL-native client) |
| Startup gate | `node scripts/start-production.mjs --check` + tests | **PASS** (10 tests) |
| Backup wrapper | `tests/backup-tooling.test.ts` | **PASS** (15 tests) |
| Payment safety | `tests/payment-integration-safety.test.ts` | **PASS** (10 tests) |
| Public contact | `tests/tech360-messaging-repair.test.ts` | **PASS** (56 tests) |
| Live runtime | `/api/health`, `/`, 12 admin APIs, webchat, enquiry form, settings gate | **PASS** |
| Production build | `npm run build` | **BLOCKED** — Prisma engine download (`binaries.prisma.sh` unreachable here); CI covers it |
| MySQL-dependent tests (3) | `tests/database-workflows|governance-db|governance-outbound-db` | **BLOCKED** — need a MySQL-native Prisma engine + server |
| Real backup + restore drill | `scripts/backup/*.sh` on the host | **BLOCKED** — no MySQL/host access |
| hPanel start command | hPanel console | **BLOCKED** — owner access required |

Added tests: 36 (10 startup, 15 backup, 10 payment, 1 wiring). Total suite 954.

**Secret/access review of the change set:** no credential added to the repo; the new env names are
placeholders only; the backup scripts read secrets from a mode-600 file and never print them (asserted by
test); no route guard was weakened (the settings gate only got stricter); no migration was added or
altered; no data was deleted; the only database written in testing was the throwaway preview SQLite file
and the isolated stubbed drill target.

### Remaining production risks (unchanged unless noted)

1. Backup automation is unproven until the host run and drill are recorded (§11).
2. hPanel start command unverified; the wrapper is bypassed if it is not `npm start` (§12).
3. Production build/start not executed in this environment (§14).
4. PayPal/SSLCommerz remain unimplemented — now impossible to enable accidentally (§13).
5. Provider integrations (Stripe live keys, WhatsApp, SMTP, SMS, social, AI) still need credentials and
   acceptance evidence; the app reports them `NOT_CONFIGURED`.
6. Documentation drift F-03 and repo hygiene F-08 remain open (no behavioural risk).
