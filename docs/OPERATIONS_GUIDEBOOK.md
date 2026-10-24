# TECH360 — Production & Operations Guidebook

**Platform:** TECH360 LLC (brand **Tech360**, domain **bdtech360.com**) — website, CRM, client portal,
AI workforce and delivery automation in one Next.js application.
**Book version:** 2026-10-24 · **Application version:** 0.2.1 · **Repository:** `alaminiubateee969-cmd/tech360`
**Audience:** the platform owner (Super Admin), operations staff, finance, delivery, support, and any engineer
who has to deploy, run, fix or audit this system.

> **How to use this book.** Chapters 1–4 are read once by everyone. Chapters 5–9 are the daily working
> manual for the website, CRM, delivery and money. Chapter 10 covers the AI workforce. Chapters 11–13 are
> for security, data and troubleshooting. Chapter 14 is the runbook drawer you open during an incident.
> Chapter 15 is reference material (variables, routes, models, glossary).
>
> **Honesty rule used throughout.** Every statement about an external service is written as one of:
> `CONFIGURED` (credential present and the adapter is real), `NOT_CONFIGURED` (no credential — the
> platform refuses to pretend), `INTEGRATION_NOT_BUILT` (no adapter exists yet), `DISABLED_BY_ADMIN`
> (switched off in Settings). This book never claims a message was sent, a payment settled, or a workflow
> ran unless the platform recorded it.

---

## Table of contents

| # | Chapter | Who reads it |
|---|---|---|
| 1 | [Platform map](#1-platform-map) | everyone |
| 2 | [Roles and access control](#2-roles-and-access-control) | everyone |
| 3 | [Deployment and environment](#3-deployment-and-environment) | owner / engineer |
| 4 | [Daily, weekly and monthly operations](#4-daily-weekly-and-monthly-operations) | operations |
| 5 | [Website operations](#5-website-operations) | marketing / owner |
| 6 | [CRM operations](#6-crm-operations) | sales / support |
| 7 | [Delivery operations: scope → handover → closure](#7-delivery-operations-scope--handover--closure) | delivery |
| 8 | [Finance operations](#8-finance-operations) | finance |
| 9 | [Client portal operations](#9-client-portal-operations) | support |
| 10 | [AI workforce operations](#10-ai-workforce-operations) | owner / AI ops |
| 11 | [Governance and security operations](#11-governance-and-security-operations) | owner / security |
| 12 | [Data operations: migrations, backup, restore](#12-data-operations-migrations-backup-restore) | engineer |
| 13 | [Monitoring and troubleshooting](#13-monitoring-and-troubleshooting) | everyone |
| 14 | [Runbooks (incident playbooks)](#14-runbooks-incident-playbooks) | on-call |
| 15 | [Reference appendices](#15-reference-appendices) | everyone |

---

## 1. Platform map

### 1.1 One application, four surfaces

There is exactly **one** Next.js application (App Router). Everything is served from the same origin.

| Surface | Address | Auth | What lives there |
|---|---|---|---|
| **Public website** | `/` → hash routes (`#/services`, `#/industries`, `#/work`, `#/blog`, `#/process`, `#/about`, `#/careers`, `#/contact`, `#/legal`, `#/faq`) | none | Marketing site, service/industry detail pages, case studies, blog, careers, contact intake, legal policies, AI chat widget |
| **Client portal** | `/#/portal` | Client ID + contact on file + one-time code | Projects, milestones, previews, approvals, documents, invoices, payments, meetings, handover, review/referral |
| **Super Admin console** | `/#/admin` | Staff login (role-based) + optional TOTP | CRM, pipeline, communications, projects, finance, AI workforce, factory, growth, logs, settings |
| **Design kit** | `/#/design-kit` | none | Live design system: tokens, buttons, diagrams, infographics, mockups |

> **Public contact channels (owner decision 2026-10-24).** The platform publishes **no WhatsApp
> number and no chat deep link**. Public enquiries arrive through three routes only: the on-site AI
> assistant / webchat (no phone number needed), the `#/contact` enquiry form, and email
> `info@bdtech360.com`. Private CRM messaging over the WhatsApp Cloud API still exists as a business
> integration — it is never advertised as a public contact route. Enforced by
> `src/lib/site-contact.ts` and pinned by `tests/tech360-messaging-repair.test.ts`.

Deep links are real URLs, not only hashes: `/services/<slug>`, `/industries/<slug>`, `/blog/<slug>`,
`/legal/<policy>` are resolved by the catch-all route (`src/app/[...path]/page.tsx`) through
`src/lib/public-route-catalog.ts`, which also drives `sitemap.xml` and `rss.xml`.

### 1.2 Request paths that matter

| Path | Purpose | Notes |
|---|---|---|
| `/api/health` | shallow health | app version, DB status, AI provider status, agent count, ops heartbeat, channel flags |
| `/api/health/deep` | deep health | adds deeper dependency probes |
| `/api/metrics` | counters for monitoring | consumed by external uptime tooling |
| `/api/ops/cycle` | runs one autonomous ops cycle | requires `OPS_SECRET` header; throttled to ≥45 s |
| `/api/ops/scan`, `/api/ops/act`, `/api/ops/heartbeat` | ops loop primitives | same secret model |
| `/api/webhooks/*` | inbound provider callbacks (stripe, whatsapp, email, sms, social, n8n, hostinger-mail) | each verifies its own signature |
| `/api/portal/*` | portal APIs | signed portal cookie |
| `/api/admin/*` | admin APIs | session + RBAC + CSRF on mutations |

### 1.3 Technology and size (measured in this repository)

| Item | Value |
|---|---|
| Framework | Next.js 16 App Router, React 19, TypeScript 5, Tailwind CSS 4, shadcn/ui |
| Runtime | Node.js `>=22.0.0 <23`, npm, standalone output |
| Database | MySQL via Prisma 6.19.3 (`prisma/schema.prisma`) |
| API route files | **180** under `src/app/api` |
| Database models | **73** |
| Migrations | **14** (`prisma/migrations`, baseline `0_init`) |
| Admin views | **46** components in `src/components/admin` |
| Public views | **31** components in `src/components/site` |
| Shared libraries | **130** TypeScript modules in `src/lib` |
| Test files | **66** (`tests/*.test.ts`, `node:test`) |
| n8n workflow definitions | **26** (`n8n/W01…W26.json`) |
| Documentation files | **57** under `docs/` |
| Source size | ≈ **91,500 lines** of TS/TSX |

### 1.4 Repository layout

```
src/app/                 routes: pages, API route handlers, sitemap, rss
src/components/site/     public website + client portal UI
src/components/admin/    Super Admin console (46 views)
src/lib/                 business logic: pipeline, comms, payments, invoices, agents, ops loop, security
prisma/                  schema, migrations, seed
n8n/                     26 importable workflow definitions
mini-services/           optional ai-ops (:3031) and notify-relay (:3032) Bun sidecars
scripts/                 build, prisma engine repair, verify, e2e harness, preview tooling
docs/                    audits, runbooks, this guidebook
```

### 1.5 The business pipeline the software enforces

Every customer moves through one pipeline, stored on `Client.pipelineStage`:

```
NEW → CONTACTED → BUSINESS_IDENTIFIED → PLAN_RECOMMENDED → SCOPE_COLLECTION → SCOPE_REVIEW
→ FINAL_SCOPE → CLIENT_APPROVAL → PAYMENT_PENDING → PROJECT_ACTIVE → DEVELOPMENT
→ CLIENT_REVIEW → FINAL_PAYMENT → DELIVERY → HANDOVER → PASSWORD_CHANGE
→ REVIEW_REQUESTED → REFERRAL_REQUESTED → COMPLETED → CLOSED
```

Rules the code enforces (not just conventions):

- Source code is **never released** before full payment and an approved `SOURCE_HANDOVER` approval.
- A project **cannot close** unless payment is complete, every task is `DONE`, delivery is `CONFIRMED`
  with explicit client acceptance, and handover is `CONFIRMED` (`src/lib/lifecycle-policy.ts`).
- Commercial, financial, publication and handover actions require a human approval record.
- An unconfigured channel **refuses** to send; it never marks a message `SENT`.

---

## 2. Roles and access control

### 2.1 Roles

Defined once in `src/lib/constants.ts` and mapped to capabilities in `src/lib/access-policy.ts`.

| Role | Rank | Typical holder | Can do (summary) |
|---|---|---|---|
| `SUPER_ADMIN` | 4 | owner | everything: settings, secrets switches, team, backup, handover release, refund decisions |
| `ADMIN` | 3 | operations lead | CRM write/merge, scope approve, approvals, delivery, handover release, finance read + invoice write |
| `FINANCE` | 2 | accounts | finance read, invoice write/approve, payment record/verify, refund request |
| `PROJECT_MANAGER` | 2 | delivery | projects, tasks, delivery prepare, preview management, CRM read |
| `MANAGER` | 2 | team lead | CRM write, comms send, scope write, project write |
| `AUDITOR` | 2 | compliance | read-only across audit, CRM, finance, projects |
| `DEVELOPER` | 1 | engineer | project read/write, preview management, task work |
| `SALES` | 1 | growth | CRM read/write, comms send, lead handling |
| `SUPPORT` | 1 | support | CRM read, comms send, chat inbox, meetings |
| `STAFF` | 1 | general | minimal read |

### 2.2 Capabilities (the real gate)

`crm.read` · `crm.write` · `crm.merge` · `comms.send` · `scope.write` · `scope.approve` ·
`preview.manage` · `project.read` · `project.write` · `delivery.prepare` · `handover.release` ·
`finance.read` · `finance.invoice.write` · `finance.invoice.approve` · `finance.payment.record` ·
`finance.payment.verify` · `finance.refund.request` · `finance.refund.decide` · `audit.read` ·
`team.manage` · `settings.manage`

Every admin API handler calls `guard(req, { minRole | capability })` from `src/lib/api-guard.ts`.
The console navigation *hides* what a role cannot use, but **hiding is not the security control** — the
server-side guard is.

### 2.3 Authentication controls

| Control | Admin console | Client portal |
|---|---|---|
| Primary factor | email + password (`scrypt`-style hash helper in `src/lib/auth.ts`) | Client ID + contact value on file |
| Second factor | optional TOTP (`/api/auth/2fa`, `src/lib/totp.ts`) | **always** a 6-digit one-time code in production |
| Session | HttpOnly `t360_session` cookie, 12 h, server-side `Session` row | signed HttpOnly portal token (`PORTAL_SECRET`) |
| CSRF | double-submit `t360_csrf` header on every mutation | same-origin + signed token |
| Lockout | 5 failed logins → 15 min lock; 10 attempts / 5 min per IP | 10 attempts / 10 min per IP, 5 wrong codes per challenge |
| Forced change | `mustChangePassword` blocks every action until changed | n/a |
| Audit | every login success/failure, 2FA challenge, portal OTP event | same |

**Portal sessions fail closed:** if no OTP channel (email/WhatsApp/SMS) is configured, portal sign-in
returns `503` rather than allowing a weaker check. `PORTAL_OTP=off` is honoured **only** outside production.

---

## 3. Deployment and environment

### 3.1 The only supported production path

```
Pull request → GitHub Actions CI (Node 22 + npm + disposable MySQL)
   → merge to main → Hostinger Node.js Web App (Git integration)
   → Hostinger runs npm install → build script `build` (= npm run build)
   → required runtime command `npm start` (prestart validates env, then standalone server)
```

There is **no** SSH/VPS/PM2/rsync path. The legacy Cloud Run, Cloud Build, Dockerfile and
`deployment/deploy.sh` helpers are retired and fail fast; do not use them.

> **Startup validation is now independent of the process manager.** `npm start` runs
> `scripts/start-production.mjs`, which validates the environment, refuses preview-only SQLite, prints a
> redacted summary and only then boots the standalone server — so even a host that skips the npm
> `prestart` lifecycle still gets the fail-closed check, provided the configured start command is
> `npm start` (or `node scripts/start-production.mjs`).
>
> What is still **NOT VERIFIED** is *which command hPanel actually runs*. If someone typed
> `node .next/standalone/server.js` into the start-command field, the wrapper is bypassed. Confirm the
> field value in hPanel and record it here (§3.4 step 3 and the startup evidence block below).

### 3.1a Startup evidence (what has been verified, and what has not)

| Claim | Status | Evidence |
|---|---|---|
| The production entry point validates configuration and refuses unsafe settings | **VERIFIED (local)** | `npm run start:check` + `tests/production-startup.test.ts` (10 tests) |
| Secrets are never printed by the startup path | **VERIFIED (local)** | the same tests assert no secret value appears in stdout/stderr |
| Preview-only SQLite is refused in production | **VERIFIED (local)** | `attachPreviewAdapter` throws; `validate-production-env.mjs` adds an error; both covered by tests |
| The standalone server boots from the wrapper | **NOT VERIFIED** | requires a completed `npm run build`, which needs the Prisma engine download (blocked in the audit sandbox; covered by CI) |
| hPanel runs `npm start` | **NOT VERIFIED** | requires hPanel access. Operator action: screenshot the start-command field and paste the runtime log lines into this table |

Record the actual command here once confirmed:

```
hPanel runtime command (observed): ______________________
build command (observed):          ______________________
Node version (observed):           ______________________
first boot log timestamp:          ______________________
```

### 3.2 Build and start commands

| Command | What it does |
|---|---|
| `npm ci --no-audit --no-fund` | reproducible install (`.npmrc` forces `include=dev`, which the build needs) |
| `npm run build` | prisma generate → `migrate deploy` → `next build` → copies `.next/static` and `public` into standalone |
| `npm run prestart` | `scripts/validate-production-env.mjs` — refuses to start on bad/missing production config |
| `npm start` | `NODE_ENV=production node scripts/start-production.mjs` — validates (again, in-process), refuses preview SQLite, prints a redacted summary, then boots `.next/standalone/server.js` |
| `npm run start:check` | validates the production environment and exits without starting the server |
| `npm run lint` / `typecheck` / `test` | quality gates (see §13.1) |
| `npm run db:seed` | first-boot data: super admin, departments, 44 agents, 26 workflows, prompt templates, blog |
| `npm run db:verify` | read-only database verification |
| `npm run schema:check` / `schema:drift` | MySQL native-type map and schema drift gates |

### 3.3 Required environment (production start refuses without these)

`DATABASE_URL` (credentialed `mysql://` with a database name) · `APP_PUBLIC_URL` and `APP_ORIGIN`
(must be exactly `https://bdtech360.com`) · `SESSION_SECRET` · `PORTAL_SECRET` · `OPS_SECRET` ·
`ZAI_BASE_URL` · `ZAI_API_KEY`.

Additional enforced rules in `validate-production-env.mjs`:

- Each of `SESSION_SECRET`, `PORTAL_SECRET`, `OPS_SECRET`, `IDENTITY_HASH_SECRET`, `EMAIL_WEBHOOK_SECRET`
  must be **≥32 characters**, whitespace-free, non-trivial, and **pairwise distinct**.
- `IDENTITY_HASH_SECRET` is required when a WhatsApp credential is present (identity lookups must stay
  resolvable across deploys — do **not** rotate it casually).
- `AI_OPS_DRIVER` ∈ {`on`,`off`}; `ZAI_BASE_URL` must be an absolute HTTP(S) URL with no userinfo/query.
- `PREVIEW_SQLITE_URL` is **refused**: it is a development-only switch for the offline preview database
  (`src/lib/preview-db.ts`). Production must use a `mysql://` `DATABASE_URL`.

The complete variable list is in `.env.example` (78 names) and Chapter 15.1.

### 3.4 First-boot sequence

1. Create the Hostinger Node.js Web App, attach the repository, branch `main`, Node 22.
2. Add **every** required environment variable in hPanel (never in the repo).
3. Set the build command to `npm run build` and the **start command to `npm start`**. Do not enter
   `node .next/standalone/server.js` — that bypasses the startup validation wrapper.
4. Point `DATABASE_URL` at the Hostinger MySQL database; confirm the DB user has DDL rights for migrations.
5. Deploy. The build applies committed migrations (`prisma migrate deploy`) — it does **not** seed.
6. Seed once, deliberately: `npm run db:seed` with `ADMIN_EMAIL` and a strong `ADMIN_PASSWORD`.
7. Remove `ADMIN_PASSWORD` from the environment after the first successful login.
8. Log in at `/#/admin`, complete the forced password change, enrol TOTP.
9. Verify: `/api/health` returns `status: healthy` and `database: UP`; `/` returns 200; a static asset
   returns 200; `www` redirects to the apex; an admin API returns 401 when logged out.
10. Configure Settings (Chapter 11) before inviting staff.

### 3.5 Release checklist (run for every deploy)

```
[ ] CI green on the exact SHA (lint, typecheck, tests, migrate deploy, build, standalone smoke)
[ ] No new env var added without updating .env.example and this book
[ ] Migration reviewed: additive first; destructive changes need a backup + approval
[ ] Backup taken immediately before deploy (see §12.4)
[ ] Deploy merged SHA; capture the hPanel build log
[ ] Post-deploy smoke: /api/health, /, /#/admin login, one admin API, one portal login
[ ] Watch /api/admin/logs/errors for 15 minutes
[ ] Record the deployed SHA in the operations log
```

### 3.6 Local / offline preview mode (no MySQL required)

The repository ships a preview mode so the whole product can be reviewed without a MySQL server:

```bash
npm ci
npm i --no-save @prisma/adapter-libsql @libsql/client     # preview-only adapter
node scripts/preview/setup.mjs                            # builds + seeds .preview/demo.db
PREVIEW_SQLITE_URL=file:$PWD/.preview/demo.db npm run dev
```

`PREVIEW_SQLITE_URL` swaps Prisma's native engine for the pure-JS libSQL adapter
(`src/lib/preview-db.ts`). It is **refused in production** and refuses non-`file:` URLs. Nothing else in
the application changes: same routes, same guards, same schema. Use it for demos, UI review, training and
troubleshooting — never as production storage.

---

## 4. Daily, weekly and monthly operations

### 4.1 Daily open (10 minutes, at start of business day)

| Step | Where | What "good" looks like |
|---|---|---|
| 1 | `/api/health` | `status: healthy`, `database: UP`, `aiAgents: UP (44 agents)` |
| 2 | Admin → **Ops Monitor** | last cycle within the expected interval, no red actions |
| 3 | Admin → **Dashboard** | new leads since yesterday, cash collected, projects at risk |
| 4 | Admin → **Approvals** | inbox worked to zero or each item consciously deferred |
| 5 | Admin → **Live Chat** | unread conversations triaged |
| 6 | Admin → **Communications** | `FAILED` / `NOT_CONFIGURED` / `DEAD_LETTER` rows reviewed |
| 7 | Admin → **Logs → Errors** | new errors triaged or assigned |
| 8 | Admin → **Payments** | new proofs verified or rejected today |
| 9 | Admin → **Projects** | tasks blocked >48 h escalated |
| 10 | Admin → **Ops Monitor → CEO report** | read the daily executive summary |

### 4.2 Daily close (5 minutes)

- Record the day's cash in the operations log; reconcile against Payments.
- Note any integration that reported `NOT_CONFIGURED` (it is a business decision, not a bug).
- Flip nothing in Settings at the end of a day unless the change is written down.

### 4.3 Weekly (60 minutes)

| Cadence | Task |
|---|---|
| Weekly | Newsletter: draft → review → send (respect consent list; see §5.6) |
| Weekly | Blog: publish at least one article; check `Blog Studio` statuses |
| Weekly | SEO audit run; act on the top three findings |
| Weekly | Review agent success rates in **Configured Org Chart** / **Core Agents** |
| Weekly | Review quarantined documents and stale approvals from the ops scan |
| Weekly | Export leads (`/api/admin/leads/export`) as an off-platform backup of the funnel |
| Weekly | Check backup artifacts and their age (Admin → **Backup & Recovery**) |

### 4.4 Monthly

| Cadence | Task |
|---|---|
| Monthly | Rotate non-identity secrets (`SESSION_SECRET`, `OPS_SECRET`, `PORTAL_SECRET`) per §11.5 |
| Monthly | Access review: deactivate leavers, re-check roles in **Team** |
| Monthly | Restore drill: restore the latest backup into a scratch database and verify row counts (§12.5) |
| Monthly | Dependency and vulnerability review (`npm audit --omit=dev`) |
| Monthly | Financial close: invoices vs payments vs bank statement |
| Monthly | DCC certification sweep for department capabilities |
| Monthly | Documentation refresh: this book, `.env.example`, runbooks |

---

## 5. Website operations

### 5.1 Page inventory

| Hash route | Content source | Owner | Notes |
|---|---|---|---|
| `#/` | `HomeView` + `src/data` | owner | hero, services, proof, CTA |
| `#/about`, `#/process`, `#/technologies` | static views | owner | |
| `#/services` and `#/services/<slug>` | `src/data` service catalogue | owner | deep-linkable, in sitemap |
| `#/industries` and `#/industries/<slug>` | industry catalogue | owner | |
| `#/work` | case studies | owner | gated by `case_studies` flag |
| `#/blog`, `#/blog/<slug>` | database `BlogPost` | marketing | `blog` flag; only `PUBLISHED` + past `publishedAt` |
| `#/careers` | static | owner | |
| `#/contact` | form → `/api/contact` | sales | creates a real lead with consent evidence; the visitor's own phone/WhatsApp **preference** is optional and is never a published company channel |
| `#/legal`, `#/legal/<policy>` | policy documents on the company pad | owner | prints on official letterhead |
| `#/faq` | static | owner | |
| `#/design-kit` | live components | design | public showcase |

### 5.1a Public contact channels (locked policy)

| Channel | Where | Notes |
|---|---|---|
| AI assistant / webchat | every page (widget) | no phone number or WhatsApp account needed; records consent |
| Enquiry form | `#/contact` | creates the lead + Client ID |
| Email | `info@bdtech360.com` | the canonical formal channel |

**No public WhatsApp number and no chat deep link are published.** Verify after any change:

```bash
grep -rn "8801327100297\|wa\.me" src/components/site src/lib/site-contact.ts src/lib/constants.ts src/data/site.ts
# expected: no output (the generic WhatsAppLink component only renders when a caller passes an explicit number)
```

### 5.2 Content changes (no deploy needed)

Blog, newsletter, reviews and case-study text live in the database and are edited in the console.
Static marketing copy lives in `src/data` / components and **does** require a deploy — batch those changes
into one release rather than deploying five times a week.

### 5.3 Blog Studio (`#/admin` → Growth → Blog Studio)

- Statuses: `DRAFT` → `SCHEDULED` → `PUBLISHED`. Only `PUBLISHED` with `publishedAt <= now` is public.
- `slug` is unique and becomes the URL `/blog/<slug>` — **never change a published slug** (it breaks links
  and SEO); create a new post instead.
- Tags are stored as a JSON array; excerpt is used for meta description and cards.
- Deletion is not offered in the UI for published posts — unpublish instead, then archive.
- SEO: title ≤ 60 chars, excerpt ≤ 155 chars, one H1, descriptive alt text on images.

### 5.4 Contact intake → lead (`POST /api/contact`)

1. Visitor submits the contact form; consent is captured with timestamp and policy version.
2. `contact-policy.ts` validates the submission (spam, required fields, consent).
3. A `Client` row is created with a sequential `Client ID` (`TECH-YYYY-NNNNNN`, `SequenceCounter`).
4. Stage `NEW`; the Lead Intake agent (`REV-002 Sentry`) scores and enriches it asynchronously.
5. Admin sees it in **Leads**; a notification is created.

If `support` or `maintenance_mode` flags are set, the route returns an honest refusal instead of silently
dropping the message.

### 5.5 AI chat widget

- Visitor starts a session (`/api/chat/session`) → conversation row (OPEN) → messages.
- The orchestrator (`src/lib/chat-orchestrator.ts`) applies `ai-reply-guard.ts`: no invented prices,
  no invented delivery dates, no unapproved commitments, no credential requests.
- If the AI provider is `NOT_CONFIGURED`, the widget still records the message and tells the visitor a
  human will reply — it never fakes an AI answer.
- Admins triage in **Live Chat**: reply, close, or convert the conversation to a lead/client.
- Consent: an email/phone typed in chat is only persisted as a contact with the recorded consent event.

### 5.6 Newsletter (engagement-tracked, honest zeros until real sends)

| Step | Action |
|---|---|
| 1 | Subscribers arrive from the footer, blog, or contact form (`consentAt` + `consentVersion` recorded) |
| 2 | Compose a campaign in **Newsletter** (draft) |
| 3 | Send requires the `email` flag **and** a configured SMTP/Hostinger Mail channel |
| 4 | Opens tracked by a 1×1 pixel (`/api/newsletter/track/open`), clicks by redirect (`/track/click`) |
| 5 | Unsubscribe is one click, idempotent, and always honoured (`/api/newsletter/unsubscribe`) |

A refused send produces a refusal record — the campaign is **not** marked sent and the counters stay at
zero. That is deliberate: no fake engagement numbers.

### 5.7 Reviews and referrals

- Reviews arrive from the portal after delivery; status `PENDING` → `APPROVED`/`REJECTED`.
- Publishing requires `consent = true`; only `published` reviews appear on the public feed
  (`/api/reviews`, gated by the `public_website` flag).
- Referrals are logged per client and can be converted into a new lead (a new Client ID is issued).

### 5.8 SEO and tracking

- `sitemap.ts` and `rss.xml` are generated from the public route catalogue + published posts.
- Consent banner gates Meta Pixel and GTM: scripts load only after `t360_consent=granted`; our own
  `/api/track` events are recorded regardless (first-party, no third-party cookie).
- SEO Audit (`#/admin` → Growth → SEO Audit) runs `src/lib/seo-audit-core.ts` against the live pages and
  stores findings.
- Canonical host is `https://bdtech360.com`; `www` and plain HTTP are redirected by `next.config.ts`.
  **Do not** enable a CDN that rewrites `x-forwarded-proto`, or every visitor will be redirected.

### 5.9 Maintenance mode

Settings → Feature Management → **Maintenance Mode**: public data APIs (`/api/blog`, `/api/contact`,
`/api/newsletter`, `/api/reviews`) return `503` with an honest notice while admin APIs stay live so the
switch can be turned back off. Use it during a data repair, not as a general "pause business" button.

---

## 6. CRM operations

### 6.1 Where things live

| View | Path | Purpose |
|---|---|---|
| Leads | CRM → **Leads** | funnel board, scoring, stage moves, conversion |
| Clients | CRM → **Clients** | client master record, enrichment, merge, documents |
| Client detail | Clients → row | full 360: projects, invoices, comms, meetings, files, memory |
| Approvals | CRM → **Approvals** | the governance inbox (nothing commercial happens without it) |
| Communications | CRM → **Communications** | outbox/inbox across channels with retry and dead-letter |
| Live Chat | CRM → **Live Chat** | visitor conversations, triage, convert to lead |
| Calls & SMS | CRM → **Calls & SMS** | call log, click-to-call, SMS history |
| Communication Pipeline | CRM → **Communication Pipeline** | per-client messaging journey and templates |
| Pipeline | Dashboard / Leads | 20-stage board view |

### 6.2 Client ID and identity

- Format `TECH-YYYY-NNNNNN`, allocated by `SequenceCounter` inside a transaction — never typed by hand.
- `ClientIdentity` stores HMAC-hashed email/phone (keyed by `IDENTITY_HASH_SECRET`) for verified lookups
  across channels. Rotating that secret **breaks existing identity links** — treat it as permanent.
- Duplicate clients are merged in **Clients → Merge** (`src/lib/crm-merge.ts`): projects, invoices,
  communications, files and memory move to the surviving record; the loser is marked `mergedIntoId` and
  soft-deleted. Merging is audited and reversible only by restoring the affected rows.

### 6.3 The 20 stages — what the operator actually does

| # | Stage | Trigger to enter | Operator action | Exit gate |
|---|---|---|---|---|
| 1 | `NEW` | first message from any channel | acknowledge within SLA, capture business basics | contact verified |
| 2 | `CONTACTED` | first outbound contact logged | confirm need, budget band, timeline | qualifies |
| 3 | `BUSINESS_IDENTIFIED` | business type known | confirm type + industry, attach signals | type agreed |
| 4 | `PLAN_RECOMMENDED` | plan proposed | send plan + price band (never a fake quote) | client reacts |
| 5 | `SCOPE_COLLECTION` | discovery answers gathered | run Scope Collection agent, fill gaps | scope drafted |
| 6 | `SCOPE_REVIEW` | scope drafted | Scope Review agent gap analysis + human read | approved internally |
| 7 | `FINAL_SCOPE` | SOW finalised | generate SOW on letterhead, attach to approval | admin approves `FINAL_SCOPE_SEND` |
| 8 | `CLIENT_APPROVAL` | SOW sent | track client approval (portal or signed reply) | client approves |
| 9 | `PAYMENT_PENDING` | approval recorded | issue advance invoice, give enabled payment methods only | payment verified |
| 10 | `PROJECT_ACTIVE` | advance settled | create project, assign tasks, kick-off | build starts |
| 11 | `DEVELOPMENT` | project running | weekly updates, task evidence, change control | build complete |
| 12 | `CLIENT_REVIEW` | preview published | share preview link, collect feedback | feedback resolved |
| 13 | `FINAL_PAYMENT` | client accepts preview | issue final invoice | final payment verified |
| 14 | `DELIVERY` | delivery checklist ready | upload artifacts, run checklist | delivery marked `READY` |
| 15 | `HANDOVER` | payment complete + approval `SOURCE_HANDOVER` | prepare package, set expiry, release | client downloads + confirms |
| 16 | `PASSWORD_CHANGE` | credentials handed over | instruct and verify password change | confirmed |
| 17 | `REVIEW_REQUESTED` | delivery confirmed | ask for review + referral (optional, never automatic-public) | response or 7 days |
| 18 | `REFERRAL_REQUESTED` | review stage done | ask for referral | response |
| 19 | `COMPLETED` | closure policy satisfied | close project, archive | all gates green |
| 20 | `CLOSED` | archive | retention rules apply | — |

**Stage moves are evidence-based.** A stage that requires a settlement cannot be advanced while the payment
row is `PENDING`; the API rejects the move rather than letting the board lie.

### 6.4 Communications (the outbox)

Every outbound message is a `Communication` row with an honest status:

`QUEUED` → `SENT` / `DELIVERED` / `READ` (provider ack) · `FAILED` · `NOT_CONFIGURED` ·
`DISABLED_BY_ADMIN` · `DEAD_LETTER`.

- Retries are automatic with backoff (`src/lib/outbox-retry.ts`, `attempts`, `nextRetryAt`).
- After the maximum attempts the row becomes `DEAD_LETTER` and stops retrying — it needs a human.
- **`NOT_CONFIGURED` is not an error.** It means the channel has no credential. Fix the credential in the
  environment and flip the channel flag in Settings; do not mark the message sent manually.
- Channel flags (`whatsapp`, `email`, `sms`) are separate from credentials: a configured credential on a
  disabled channel is still refused.

### 6.5 Live Chat triage

1. Open **Live Chat**; unread counts come from `unreadCount` + `lastSender`.
2. Read the thread; reply directly (goes out as `ADMIN`, never impersonating the AI).
3. Classify: support question, sales enquiry, existing client, spam.
4. Sales enquiry → **Convert to lead** (creates/links a `Client`, issues a Client ID, records consent).
5. Close the conversation when resolved; closing is reversible but not silent (audited).

### 6.6 Calls and SMS

- `CLICK_TO_CALL` / `SIP` / `DEVICE_GATEWAY` adapters in `src/lib/telephony.ts` report
  `NOT_CONFIGURED` unless `TWILIO_*` or `SIP_DOMAIN` is set.
- Every call is logged (`CallLog`) with direction, outcome, duration and who logged it; missed inbound calls
  surface on the dashboard.
- SMS uses `SMS_API_URL`/`SMS_API_KEY`/`SMS_SENDER` or `HTTPSMS_*`. Same honest-state rule.

### 6.7 Meetings

- `REQUESTED` → `SCHEDULED` → `COMPLETED` / `CANCELLED` / `DECLINED`.
- Booking link defaults to `MEETING_BOOKING_URL` or `https://bdtech360.com/#contact`.
- The client can confirm/decline/reschedule from the portal (`/api/portal/meeting/respond`); the response is
  stored with a timestamp and shown to the operator.

### 6.8 Files, documents and knowledge

- Uploads become `FileRecord` rows with `sha256`, classification and `scanStatus`
  (`PENDING` → `CLEAN` / `QUARANTINED` / `REJECTED`).
- Quarantined files are never served to clients and appear in the ops scan until resolved.
- Client documents are listed in the portal with download counts; every download is audited.

### 6.9 CRM hygiene rules

- One client = one Client ID. Duplicate channels get merged, not duplicated.
- Never edit `clientId`, `createdAt`, or invoice numbers by hand.
- Every stage change gets a note in `notes` or a `Communication` row — future you needs the context.
- Export the funnel weekly; the database is the system of record, the export is the backup.

---

## 7. Delivery operations: scope → handover → closure

### 7.1 Scope of work

| Version state | Meaning | Who moves it |
|---|---|---|
| `DRAFT` | being written | sales / Scope Collection agent |
| `AI_REVIEWED` | gap analysis complete (`aiNotes` filled) | Scope Review agent |
| `AWAITING_ADMIN_APPROVAL` | waiting for a human | admin |
| `APPROVED` | cleared to send | admin with `scope.approve` |
| `FINAL` | sent and accepted | system after client acceptance |
| `SUPERSEDED` | replaced by a newer version | system |

Versioning is append-only: never edit an approved scope — create version *n+1*.

### 7.2 Preview before payment (the trust mechanism)

1. Build the preview and publish it: `Preview` row with a token, version and expiry (`PREVIEW_TTL_DAYS`).
2. Share the link `/api/preview/<token>` with the client (portal or email).
3. Views are tracked (`PreviewEvent`); expired tokens render an honest "expired" page, never a 404 loop.
4. Client feedback is captured; changes create a new preview version.
5. **No payment is requested before the client has seen a working preview.**

### 7.3 Projects and tasks

- `Project.code` = `PRJ-YYYY-NNNN`, unique. Statuses: `PLANNING`, `ACTIVE`, `DEVELOPMENT`, `TESTING`,
  `CLIENT_REVIEW`, `DELIVERY`, `HANDOVER`, `COMPLETED`, `ON_HOLD`, `CANCELLED`.
- Tasks: `TODO` → `IN_PROGRESS` → `REVIEW` → `DONE`, or `BLOCKED` (always with a reason).
- Each task can be assigned to an agent (`assigneeType = AGENT`, `assigneeRef` = agent code) or a human.
- Evidence (`evidence` JSON: file ids / notes) is required before a task is marked `DONE` on client-facing work.
- The AI Task Agent (`TSK-019 Flow`) can break a scope into tasks; a human must still approve the plan.

### 7.4 Delivery checklist

`Delivery.checklist` is JSON with six must-be-true keys: `scope`, `files`, `docs`, `deployment`,
`credentials`, `testing`. The delivery is only `READY` when all six are true, and only `CONFIRMED` when
the client answers **received = true** and **working = true** (`evaluateDeliveryAcceptance`). A partial
answer produces `PARTIAL` with a reason code — never a silent success.

### 7.5 Source handover (the most sensitive step)

| Gate | Requirement |
|---|---|
| 1 | `paymentStatus = PAID` on the project |
| 2 | `SOURCE_HANDOVER` approval `APPROVED` by a human with `handover.release` |
| 3 | Package built and token issued (`packageToken`, unique, with `expiryAt`) |
| 4 | Download by token, counted and audited |
| 5 | Client confirmation recorded (`confirmedAt`) |
| 6 | Password-change instruction tracked to `PASSWORD_CHANGE` stage |

An expired or unknown token gets no content. Handover packages are never attached to email bodies and
never placed under `public/`.

### 7.6 Project closure

`evaluateProjectClosure` must return `allowed: true`: fully paid **and** all tasks `DONE` **and**
delivery `CONFIRMED` with client acceptance **and** handover `CONFIRMED`. Closure is audited; reopening a
closed project requires a Super Admin and a written reason.

---

## 8. Finance operations

### 8.1 Invoice lifecycle

`DRAFT` → `AWAITING_APPROVAL` → `APPROVED` → `ISSUED` → `SENT` → `VIEWED` → `PARTIAL` → `PAID`
(with `OVERDUE`, `VOID`, `CANCELLED`, `REFUND_PENDING`, `PARTIALLY_REFUNDED`, `REFUNDED`, `DISPUTED`).

- Numbering: `INV-YYYY-NNNN` from a transactional `SequenceCounter`. Gaps are not allowed; a void keeps
  its number and gains a reason.
- Money is stored twice: `amount` (display float) and integer minor units (`subtotalMinor`, `taxMinor`,
  `totalMinor`, `discountMinor`). Reconcile on the minor units.
- Every invoice renders on the **official company letterhead** (`src/lib/letterhead.ts`) with a
  `paymentMethodsSnapshot` of the methods that were actually enabled when it was issued.
- Revisions increment `revision` and record `supersedesInvoiceNumber`; nothing is ever silently re-numbered.

### 8.2 Gateway governance

| Method | Adapter | Default state |
|---|---|---|
| Bank transfer | honest instructions from `BANK_TRANSFER_DETAILS` | available once configured |
| bKash / Nagad | merchant number instructions | available once configured |
| Stripe | real REST checkout + HMAC webhook (`/api/webhooks/stripe`) | requires `STRIPE_SECRET_KEY` + `STRIPE_WEBHOOK_SECRET` |
| PayPal | **INTEGRATION_NOT_BUILT** | cannot be enabled as live |
| SSLCommerz | **INTEGRATION_NOT_BUILT** | cannot be enabled as live |

Settings → **Payment Gateways** holds per-gateway ON/OFF + sandbox/production. A disabled gateway is
rejected server-side and is never printed as an accepted method. Settlement happens **only** on a verified
webhook or an admin verification — never on a browser "success" URL.

### 8.3 Recording and verifying payments

1. Client pays and (in the portal) submits proof → `Payment` row `PENDING` with the proof file.
2. Finance opens **Payments**, checks the bank/bKash statement, and verifies.
3. Verification requires the `finance.payment.verify` capability and writes `verifiedBy` + `verifiedAt`.
4. On verification: invoice → `PAID`/`PARTIAL`, project `paidAmount` updated, `paymentStatus`
   recalculated, receipt generated (`PaymentReceipt`, printable on the pad).
5. Anything unverified stays `PENDING` and is visible on the dashboard as outstanding.

**Never** mark a payment paid because the client says so. Evidence or it did not happen.

### 8.4 Refunds

`RefundCase` flow: request (`finance.refund.request`) → decision (`finance.refund.decide`, a different
person ideally) → execution → `REFUNDED`/`PARTIALLY_REFUNDED`. Every refund needs a reason, a linked
payment, and an approval record for amounts at or above the governance threshold.

### 8.5 Reconciliation (weekly)

| Check | Source | Expected |
|---|---|---|
| Invoiced total | sum of `totalMinor` where status ∈ {ISSUED, SENT, VIEWED, PARTIAL, PAID, OVERDUE} | matches finance sheet |
| Collected total | sum of verified `Payment.amount` | matches bank statement |
| Outstanding | invoiced − collected | equals sum of unpaid invoices |
| Receipts | one per verified payment | no orphans either way |
| Gateway fees | provider statement | recorded as a note, never invented |

### 8.6 Taxes, currency and terms

- `taxRateBps` + `taxLabel` + `taxMinor` — basis points, so 15% is `1500`. Tax is never silently zeroed.
- Currency per invoice/project (`USD` default); never mix currencies inside one invoice.
- Payment terms and the applicable terms version are stamped on the invoice (`termsVersion`).

---

## 9. Client portal operations

### 9.1 What the client sees

Projects and milestones · tasks progress · previews and approvals · documents · invoices and payment
instructions · payment receipts · meetings (confirm/decline) · handover package · review and referral
request · AI team activity card.

### 9.2 Sign-in (production)

1. Client enters `Client ID` + one contact value on file (email / WhatsApp / phone).
2. Platform sends a 6-digit code over a configured channel (`PORTAL_OTP_CHANNEL` prefers email/sms/whatsapp).
3. Client enters the code → signed HttpOnly session cookie (12 h).
4. Failures never reveal *which* field was wrong; 5 wrong codes invalidate the challenge.

**If nobody has a configured channel, portal login returns 503.** Fix the channel, do not lower the bar.

### 9.3 Support tasks

| Situation | Action |
|---|---|
| Client cannot receive the code | verify the contact on file, correct it, resend; check channel status in Settings |
| Client wants a new email/phone | update the client record (audited), never the identity hash by hand |
| Client cannot see an invoice | check invoice status (`DRAFT` is invisible), then the `invoices` flag |
| Client asks for source before final payment | explain the handover gate; offer preview access instead |
| Client approved but status did not move | check `ScopeApproval`/`Preview` version and the approval record |
| Client wants everything deleted | GDPR-style deletion is a Super Admin action with an approval record |

### 9.4 Portal security posture

- No portal session = 401 on every `/api/portal/*` route (except login).
- Sessions are signed with `PORTAL_SECRET`; rotating it logs out every client (acceptable, expected).
- Client documents are only served after a session check + client-id match; no guessed URLs work.
- The `client_portal` feature flag can suspend the whole surface instantly.

---

## 10. AI workforce operations

### 10.1 The roster (44 seeded agents)

| Code | Name | Title | Approval gate |
|---|---|---|---|
| CEO-001 | Atlas | CEO Command Agent | — |
| REV-002 | Sentry | Lead Intake Agent | — |
| CRM-003 | Ledger | CRM Keeper Agent | — |
| BIZ-004 | Scout | Business Detection Agent | — |
| PLN-005 | Compass | Plan Recommendation Agent | — |
| SCP-006 | Probe | Scope Collection Agent | — |
| SCP-007 | Auditor | Scope Review Agent | — |
| SCP-008 | Forge | Final Scope Agent | — |
| PRP-009 | Quill | Proposal Agent | — |
| COM-010 | Echo | Client Communication Agent | — |
| WAP-011 | Relay | WhatsApp Agent | **yes** |
| EML-012 | Postman | Email Agent | **yes** |
| SMS-013 | Beacon | SMS Agent | **yes** |
| SOC-014 | Herald | Social Inbox Agent | — |
| MTG-015 | Tempo | Meeting Agent | — |
| PAY-016 | Vault | Payment Agent | **yes** |
| INV-017 | Tally | Invoice Agent | — |
| PRJ-018 | Anchor | Project Manager Agent | — |
| TSK-019 | Flow | Task Agent | — |
| CST-020 | Muse | Content Agent | — |
| DSN-021 | Prism | Design Prompt Agent | — |
| VID-022 | Cine | Video Script/Plan Agent | — |
| KNW-023 | Sage | Knowledge Agent | — |
| MEM-024 | Recall | Memory Agent | — |
| SEC-025 | Warden | Security Agent | — |
| FSF-026 | Quartermaster | File Safety Agent | — |
| CMP-027 | Judge | Compliance Agent | — |
| EVD-028 | Notary | Evidence Agent | — |
| DLV-029 | Courier | Delivery Agent | — |
| HND-030 | Gatekeeper | Source Code Handover Agent | **yes** |
| APP-031 | Steward | Client Approval Agent | — |
| REV-032 | Phoenix | Revision Agent | — |
| ADM-033 | Aegis | Admin Approval Agent | — |
| ERR-034 | Sentinel | Error Monitoring Agent | — |
| PUB-035 | Beacon-S | Social Publishing Agent | **yes** |
| RSK-036 | Hindsight | Review & Referral Agent | — |
| DEP-037 | Pioneer | Deployment Agent | — |
| QA-038 | Inspector | QA Agent | — |
| RPT-039 | Pulse | CEO Reporting Agent | — |
| CMD-040 | Oracle | Command Center Agent | — |
| AGC-041 | Midwife | Agent Creation Agent | **yes** |
| LRN-042 | Catalyst | Performance Learning Agent | — |
| VOX-043 | Vocalist | Voiceover Agent | — |
| OPS-044 | Conductor | Automation Orchestrator Agent | — |

Agents are organised under 110 departments. Levels: `L1` executive → `L3` operational.

### 10.2 Running an agent

| Way | How | Notes |
|---|---|---|
| Manual | Admin → **Core Agents** → Run (or `POST /api/admin/agents/[code]/run`) | requires `ai_agents` flag + provider config |
| Job queue | `AgentJob` rows with policy checks (`src/lib/agents/*`) | durable, retryable, one decision per job |
| Ops loop | autonomous passes during a cycle | deterministic rules decide before any model call |
| Delegation | `AgentDelegation` between agents | depth-limited to prevent runaway chains |

Every execution is an `AiAgentExecution` with tokens, status, latency and error. Success rates shown in the
console are computed from those rows — never estimated.

**When the provider is not configured** (`ZAI_BASE_URL` / `ZAI_API_KEY` / local model), agent runs return
`NOT_CONFIGURED` and the UI says so. The platform does not fabricate output.

### 10.3 Approvals (the human gate)

| Type | Raised by | Who decides | What the decision releases |
|---|---|---|---|
| `FINAL_SCOPE_SEND` | Scope Final agent | Admin | sending the final SOW |
| `PAYMENT_INSTRUCTION` | Payment agent | Finance/Admin | giving payment instructions |
| `REFUND` | Payment agent / finance | Super Admin | money going back |
| `SOURCE_HANDOVER` | Handover agent | Admin/Super Admin | source code release |
| `CREDENTIAL_OP` | Security agent | Super Admin | credential changes |
| `DELETION` | any | Super Admin | destructive data actions |
| `SOCIAL_PUBLISH` | Publishing agent | Admin | public posts |
| `LEGAL_COMM` / `SENSITIVE_COMM` | Comms agents | Admin | sensitive outbound messages |
| `AGENT_CREATE` | Agent Creation agent | Super Admin | creating a new agent |
| `EXTERNAL_SEND` | any channel agent | Admin | external sends above the auto-approve risk |

`governance.autoApproveRiskBelow` (Setting) sets a risk floor: anything at or above it always needs a
human. **Never raise it to skip the gate on money or handover.** Every decision is audited with the decider.

### 10.4 The autonomous ops loop

Cycle: **detect → decide → execute → verify → log → learn**.

Scans run every cycle: unscored leads, overdue leads, retryable communications, failed automations,
unresolved errors, stale approvals, expired previews, quarantined documents.

| Trigger | Interval | Auth |
|---|---|---|
| In-process driver (`AI_OPS_DRIVER=on`, default) | internal, ≥45 s between cycles | n/a |
| External scheduler / mini-service `:3031` | POST `/api/ops/cycle` | `OPS_SECRET` header |
| Manual | Admin → **Ops Monitor** | session |

Verify the loop is alive at `/api/health` → `aiOperations.heartbeat`. `OFFLINE` means no recent heartbeat —
start the driver or the scheduler, and check `AI_OPS_DRIVER` is not `off`.

### 10.5 Knowledge, memory, skills, prompts

- **Knowledge Base**: upload PDF/DOCX/CSV/TXT → extraction (`src/lib/doc-extract.ts`) → chunks
  (`KnowledgeChunk`) → classification (`PUBLIC`/`PRIVATE`/`CONFIDENTIAL`/`HIGHLY_SENSITIVE`).
  Retrieval is filtered by classification against the caller. Uploads require a scan status before indexing.
- **Memory**: `AiMemory` holds durable facts per client/agent with an expiry and provenance.
- **Skills**: `Skill` + `SkillVersion` + `SkillRun`; a skill version is immutable once run in production.
- **Prompt Library**: 2,223 seeded prompt templates by category (REVENUE, SCOPE, COMMS, FINANCE, DELIVERY,
  GROWTH, EXECUTIVE, CONTENT, OPERATIONS, GOVERNANCE) with variable contracts.

### 10.6 Factories and studios

| Tool | What it really does | Safety |
|---|---|---|
| **App Factory** | brief → blueprint → real Next.js/Prisma source tree → ZIP | generated code is a starting point, never auto-deployed |
| **Media Studio** | shot plans, captions, prompts (`src/lib/media/studio.ts`) | rendering reports `RENDER_NOT_CONFIGURED` until a licensed provider is configured |
| **Feed Hub** | imports RSS/Atom/JSON sources, hardened parser | items are quarantined on parse failure, never half-imported |
| **Content Studio** | plans, scripts, marketing kits, SEO briefs | does not claim to render images/video/audio |
| **Workflow Builder** | `WorkflowDefinition` + steps | runs are logged; failures are visible, not retried silently |
| **Command Center** | natural-language command → structured action | dangerous actions always resolve to an approval request |
| **Model Management** | provider registry, local model health | a public model endpoint is refused by policy |

### 10.7 n8n

26 workflow definitions (`n8n/W01…W26.json`) with matching `N8nWorkflow` rows: lead intake, WhatsApp,
email, social inbox, business detection, plan recommendation, scope collection/review/final, admin and
client approval, meeting, HTML preview, payment, project start/tasks/updates, final payment, delivery,
source handover, password change, review request, referral request, daily CEO report, error monitoring,
lead enrichment.

To use them: import into your n8n instance, set `N8N_WEBHOOK_BASE` + `N8N_WEBHOOK_SECRET`
(`/api/webhooks/n8n` verifies it), then enable the `n8n` flag. Download the JSON from
`/api/admin/n8n/[code]/download`. Without credentials the registry still lists them and reports
`NOT_CONFIGURED` — it does not claim they are running.

---

## 11. Governance and security operations

### 11.1 Settings (Super Admin only)

| Area | What it controls | Rules |
|---|---|---|
| Feature Management | 13 switches (public website, portal, payments, invoices, channels, AI agents, n8n, blog, case studies, support, maintenance) | every switch is enforced server-side |
| Payment Gateways | per-gateway ON/OFF + sandbox/production | `INTEGRATION_NOT_BUILT` gateways cannot be made live |
| Code Execution | whether the platform creates runnable code | requires target confirmation |
| Shell Execution | whether platform-built apps may run shell steps | requires target confirmation |
| Approval Mode | human-in-the-loop posture | tightening is always safe; loosening needs a written decision |
| Command Mode | whether the Command Center may execute directly | keep conservative |
| Auto-approve risk | `governance.autoApproveRiskBelow` | never raise above `MEDIUM` for money/handover |
| Brand / tracking IDs | `company.*`, `site.gtmId`, `site.metaPixelId` | public identifiers only |

### 11.2 Secret management

- Secrets live **only** in hPanel environment variables. Never in the repo, never in the database, never in
  chat or tickets.
- Credentials are referenced by **name** in the database; live status is computed at request time.
- `IDENTITY_HASH_SECRET` is effectively permanent (rotating it breaks identity links).
- `ADMIN_PASSWORD` is removed after first boot.

### 11.3 Access control reviews

| Frequency | Check |
|---|---|
| Monthly | every user's role still matches the job; leavers deactivated (`isActive=false`) |
| Monthly | no shared accounts; TOTP enrolled for every admin |
| Quarterly | capability matrix reviewed against `src/lib/access-policy.ts` |
| On change | every new admin route has a `guard(...)` — CI review item |

### 11.4 Audit and logs

| Log | Contents | Retention (recommended) |
|---|---|---|
| `AuditLog` | logins, decisions, mutations, downloads, exports | ≥ 1 year |
| `ErrorLog` | failures with source, code, correlation id | 90 days |
| `AutomationLog` | workflow runs, retries, dead letters | 90 days |
| `AgentEvent` / `AiAgentExecution` | agent lifecycle, tokens, outcomes | 90 days |
| `TrackingEvent` | first-party page/CTA events | 13 months (consent-scoped) |

Never delete audit rows to "clean up" — export instead.

### 11.5 Secret rotation runbook

1. Announce the window; note that portal users and staff get logged out.
2. Generate a new value (≥32 random characters, no whitespace).
3. Update hPanel, redeploy or restart the app.
4. Verify `/api/health`, one admin login, one portal login.
5. Record date, who, and which secret — **never the value**.

`SESSION_SECRET` → staff sessions · `PORTAL_SECRET` → portal sessions · `OPS_SECRET` → scheduler ·
`EMAIL_WEBHOOK_SECRET` / `N8N_WEBHOOK_SECRET` / `SOCIAL_WEBHOOK_SECRET` → inbound webhooks (must be updated
on both sides) · `IDENTITY_HASH_SECRET` → **do not rotate** without a written migration plan.

### 11.6 Incident classification

| Severity | Definition | Response |
|---|---|---|
| SEV-1 | data breach, payment fraud, total outage, source-code leak | immediate: contain, notify owner, rotate secrets, preserve logs |
| SEV-2 | financial or delivery blocked, channel down for all clients | within 1 h |
| SEV-3 | one feature degraded, one client affected | within 1 business day |
| SEV-4 | cosmetic / documentation | backlog |

### 11.7 Security posture summary

Session cookies (HttpOnly, SameSite=Lax, Secure in production) · CSRF double-submit on mutations ·
RBAC + capability guards on every admin route · rate limiting on auth and public intake · constant-time
comparisons for tokens (`src/lib/constant-time.ts`) · signed webhooks with replay protection
(`InboundWebhookReceipt`) · parameterised queries only (Prisma) · security headers in `next.config.ts` ·
no secrets in the client bundle · server-side settlement only.

---

## 12. Data operations: migrations, backup, restore

### 12.1 Schema and migrations

- 73 models, 14 migrations, baseline `0_init`. Production applies with `prisma migrate deploy` (part of
  `npm run build`).
- `prisma migrate reset`, `db push --force`, and any destructive command are **forbidden in production**.
- MySQL native types are mandatory (`@db.Text`, `@db.LongText`, `@db.LongBlob`) wherever a string can exceed
  191 characters — `npm run schema:check` enforces this map, `npm run schema:drift` compares schema vs DB.

### 12.2 Safe migration procedure

1. Write the migration and test it on a scratch MySQL copy.
2. Prefer additive changes (new nullable column) over destructive ones.
3. Take a backup (§12.4) and record the schema version.
4. Deploy; the build runs `migrate deploy`.
5. Verify with `npm run db:verify` and a smoke test of the affected feature.
6. If the migration fails: stop, do not "fix forward" blindly — restore the backup and fix on a branch.

### 12.3 Retention

| Data | Retention | Notes |
|---|---|---|
| Client records | life of relationship + 7 years | financial evidence |
| Invoices / payments / receipts | 7 years | statutory |
| Audit logs | ≥ 1 year | never silently pruned |
| Chat transcripts | 24 months | consent-scoped |
| Tracking events | 13 months | consent-scoped |
| Uploaded files | per contract | quarantined files 30 days |
| Error / automation logs | 90 days | export before pruning |

### 12.4 Backup (implemented — see `docs/BACKUP_AND_RESTORE.md`)

Automation lives in two scripts; the full procedure, scheduling and limitations are in
**`docs/BACKUP_AND_RESTORE.md`**.

| Piece | What it does |
|---|---|
| `scripts/backup/mysql-backup.sh` | consistent `mysqldump --single-transaction`, gzip, SHA-256, integrity + completion-marker verification, retention, optional off-server copy, `last-run.json` evidence |
| `scripts/backup/mysql-restore-drill.sh` | restores into an isolated `tech360_drill_*` database, compares row counts with production, writes `last-drill.json` |
| hPanel cron (recommended `15 2 * * *`) | the trigger; the application cannot schedule shell commands on Hostinger |
| `#/admin` → System → **Backup & Recovery** | reads the two evidence files; shows `VERIFIED` only when the last run succeeded *and* a drill passed |

```bash
# daily (cron), from a mode-600 env file:
bash scripts/backup/mysql-backup.sh
# monthly drill, isolated target mandatory:
bash scripts/backup/mysql-restore-drill.sh --target-database "tech360_drill_$(date +%Y%m%d)"
```

Retention default: 7 daily, 4 weekly, 3 monthly. Backups are written outside the web root with
directory mode `700` and file mode `600`; the database password never touches a command line.

**Current status: implementation verified by 15 automated wrapper tests; a real backup and a real
restore drill have NOT yet been recorded on the host — treat backup status as UNVERIFIED until §6 of
`docs/BACKUP_AND_RESTORE.md` is executed and its output logged.**

### 12.5 Restore drill (monthly, isolated)

```
1. bash scripts/backup/mysql-restore-drill.sh --target-database tech360_drill_<date>
   (the script refuses any target that is not prefixed tech360_drill_ or that matches production)
2. It verifies SHA-256 + gzip, restores, and compares table + row counts for
   User, Client, Project, Invoice, Payment, ApprovalRequest, AiAgent.
3. PASS → last-drill.json + Setting backup.restore_test → console shows "restore proven".
4. FAIL → exit 4, evidence recorded, nothing in production touched.
5. Record duration and result in the operations log (that number is your measured RTO).
```

Never restore over production to "test" it. Never drop a database you might still need to recover.

### 12.6 Exports

`/api/admin/leads/export` and the document endpoints produce CSV/PDF. Exports are audited, classified
(`CONFIDENTIAL`), and must never be uploaded back into `public/`.

---

## 13. Monitoring and troubleshooting

### 13.1 Quality gates

| Gate | Command | What it proves |
|---|---|---|
| Lint | `npm run lint` | static rules |
| Types | `npm run typecheck` | generated Prisma client + all TS |
| Tests | `npm test` (66 files, `node:test`) | business policies, guards, governed flows |
| Schema | `npm run schema:check` · `npm run schema:drift` | MySQL native types and drift |
| Database | `npm run db:verify` | read-only live checks |
| Build | `npm run build` | production artefact + migrations |
| Smoke | `npm start` + `/api/health` | the artefact actually serves |

CI runs these against disposable MySQL. A green CI is **not** a deployment — verify the live app separately.

### 13.2 Health signals

| Endpoint | Watch for |
|---|---|
| `/api/health` | `status: healthy`; `database: UP`; `aiAgents: UP`; channel booleans match your intent |
| `/api/health/deep` | dependency-level probes; use for alerting |
| `/api/metrics` | counters; feed your uptime monitor |
| Admin → **Ops Monitor** | cycle heartbeat, performed actions, CEO report |

### 13.3 Diagnostic decision table

| Symptom | Most likely cause | Check | Fix |
|---|---|---|---|
| Production process exits immediately at start | environment validation failed (missing/weak secret, non-mysql URL, preview SQLite) | the `[startup-config]` lines on stderr | fix the named variables — values are never printed |
| Site returns 500 on every page | `DATABASE_URL` wrong or MySQL down | `/api/health` database status | restore DB access; verify credentials |
| App redirects to `bdtech360.com` unexpectedly | `x-forwarded-proto: http` from a proxy | request headers | fix proxy/TLS; do not edit the redirect |
| Admin login returns 401 for a correct password | account locked or `isActive=false` | `User.failedLogins`, `lockedUntil` | wait 15 min or Super Admin unlocks |
| Every admin action returns `PASSWORD_CHANGE_REQUIRED` | `mustChangePassword` | user row | complete the password change |
| 403 on a screen that used to work | role/capability changed | Team view + `access-policy.ts` | correct the role |
| Mutations return 403 CSRF | missing `x-csrf-token` | browser cookies | reload the session |
| Portal login returns 503 | no OTP channel configured | Settings channel status `.env` | configure email/WhatsApp/SMS |
| Messages stuck at `NOT_CONFIGURED` | credential missing | env var presence | set the credential + enable the flag |
| Messages `FAILED` then `DEAD_LETTER` | provider rejects or is down | `Communication.error` | fix provider; retry from the row |
| Payments recorded but invoice unchanged | verification did not run | `Payment.verifiedAt` | verify as finance |
| Invoice will not issue | gateway/flag disabled or approval missing | Settings + approvals | enable + approve |
| Handover link 403/expired | not paid, no approval, or expired token | project + approvals + `expiryAt` | satisfy gates, reissue |
| Project will not close | tasks/delivery/handover incomplete | `evaluateProjectClosure` reason code | complete the gate |
| Agent run returns `NOT_CONFIGURED` | no AI provider | `/api/health` `aiProvider` | set `ZAI_BASE_URL`/`ZAI_API_KEY` |
| Agent run times out | provider latency / `AGENT_RUN_TIMEOUT_MS` | execution row | raise timeout or reduce work |
| Ops loop `OFFLINE` | driver off / scheduler not calling | `AI_OPS_DRIVER`, heartbeat | enable driver or scheduler |
| Newsletter says sent but zero opens | no real send / pixel blocked | campaign + comms rows | confirm provider; treat zeros as truth |
| Backup & Recovery shows UNVERIFIED | no `last-run.json`, the last run failed, or no drill passed | the panel's "Scheduled runner" block | run §6 of `docs/BACKUP_AND_RESTORE.md`; check the cron job in hPanel |
| Settings refuses to enable PayPal/SSLCommerz (409) | `INTEGRATION_NOT_BUILT` — by design | `docs/PAYMENT_INTEGRATION_POLICY.md` | implement + provider-verify before enabling; record manual payments as `MANUAL` |
| Public site shows a WhatsApp number | regression | `grep -rn '8801327100297' src` | must be empty; contact routes are webchat, form, email |
| Prisma `EACCES` on build | engine lost its executable bit | build log | `scripts/prisma.mjs` repairs it; re-run build |
| Slow pages / timeouts | DB indexes, large exports, AI latency | error log + timing | use indexes, paginate, queue |

### 13.4 Error triage workflow

1. **Logs → Errors**: read `source`, `code`, `correlationId`.
2. Reproduce with the correlation id across `AuditLog`, `AutomationLog`, `Communication`.
3. Classify: configuration (`NOT_CONFIGURED`), data, code defect, provider outage.
4. Fix configuration immediately; open a code defect for anything else.
5. Mark the error resolved with a note that says *what changed*, not "fixed".

---

## 14. Runbooks (incident playbooks)

Each runbook: **symptom → immediate containment → diagnosis → resolution → follow-up**.

### RB-01 Production is down
1. Confirm from outside: `curl -I https://bdtech360.com`, then `/api/health`.
2. hPanel → runtime logs → build/deploy status. Did the last deploy fail?
3. If the last deploy is the cause: redeploy the previous known-good SHA (rollback, §RB-02).
4. If the process is up but the DB is down: restore DB access (RB-04).
5. Write the timeline in the operations log.

### RB-02 Rollback a bad deploy
1. Identify the last good SHA (recorded at deploy time).
2. Revert the merge on `main` through a pull request (preferred) or redeploy the previous SHA.
3. If the release included a migration: **check schema compatibility first**. Additive migrations are
   usually safe to leave; destructive ones require a restore.
4. Verify `/api/health`, homepage, admin login, one portal login.
5. Post-incident: root cause, why CI missed it, add the missing test.

### RB-03 Database unreachable
1. hPanel → MySQL status; check disk, connections, credentials.
2. Confirm `DATABASE_URL` in the app environment is unchanged.
3. Restart the app after DB recovery so connection pools re-establish.
4. `npm run db:verify` then a health check.
5. If data is suspected corrupted: stop writes (maintenance mode), restore from the newest verified dump.

### RB-04 Suspected data breach / leaked credential
1. Rotate `SESSION_SECRET`, `PORTAL_SECRET`, `OPS_SECRET`, and the affected provider credential.
2. Disable the affected users (`isActive=false`); force password resets.
3. Preserve `AuditLog`, `InboundWebhookReceipt`, request logs — do not clean up.
4. Identify blast radius from audit + identity tables (what was read, exported, downloaded).
5. Notify per legal obligation; document decisions and timestamps.

### RB-05 Payment disputed / double charged
1. Find the `Payment` and the provider transaction id.
2. Do **not** delete the payment: create a `RefundCase` with the reason and evidence.
3. Decide with `finance.refund.decide` (different person from the requester).
4. Execute, then confirm the invoice status (`PARTIALLY_REFUNDED`/`REFUNDED`).
5. Reconcile against the provider statement and record the resolution.

### RB-06 Client cannot sign in to the portal
1. Confirm the client record's email/WhatsApp/phone (exactly one must be on file and valid).
2. Check channel health in Settings (`email`, `whatsapp`, `sms` + credentials).
3. Check rate limiting: 10 attempts / 10 min per IP — a locked office IP looks like a broken portal.
4. Re-issue: correct the contact, retry. Audit row `PORTAL_OTP_FAILED` tells you what happened.
5. If `PORTAL_OTP=off` appears set in production, remove it — production always requires a code.

### RB-07 Source code must go out today, final payment is short
1. It cannot. The gate is `paymentStatus = PAID` **and** an approved `SOURCE_HANDOVER`.
2. Options: settle the balance, or grant a documented discount that makes the invoice paid.
3. Never patch the database to flip `paymentStatus`.

### RB-08 AI provider outage
1. `/api/health` → `aiProvider` status; agent runs will fail or report `NOT_CONFIGURED`.
2. Deterministic paths keep working: pipeline rules, approvals, invoices, portal.
3. Switch provider order with `AI_PROVIDER_ORDER`, or fall back to the private local model if healthy.
4. Communicate: AI-assisted turnaround is degraded, humans are answering.

### RB-09 Runaway agent / cost spike
1. Settings → disable `ai_agents`.
2. Inspect `AiAgentExecution` for the offending code; check quotas (`dailyQuota`, `tokensToday`).
3. Cancel queued `AgentJob` rows; raise an approval gate for that agent.
4. Rotate the provider key if spend is unbounded.
5. Post-incident: lower quota, add a circuit breaker, add a test.

### RB-10 Build fails with Prisma engine errors
1. Read `scripts/prisma.mjs` output — it restores executable bits and re-execs.
2. If the engine file is corrupt, clear the Prisma cache in the build environment and rebuild.
3. Never bypass by committing binaries or disabling migrations.

### RB-11 Backup looks missing / stale
1. Backup & Recovery view lists what it can actually see in `BACKUP_DIR` and the default dirs.
2. Run a fresh dump now; record size + checksum.
3. Schedule the drill from §12.5 so the next report can say "restore proven".

### RB-12 Something is very wrong and you must stop the world
1. Settings → **Maintenance Mode** on (public data APIs return 503, admin stays reachable).
2. Disable `payments`, `client_portal`, and outbound channel flags.
3. Disable `ai_agents`.
4. Record who did it, why, and when — then work RB-01…RB-11 as appropriate.

---

## 15. Reference appendices

### 15.1 Environment variables (78 documented names)

**Core (required):** `DATABASE_URL`, `APP_PUBLIC_URL`, `APP_ORIGIN`, `NODE_ENV`.
**Secrets (required, ≥32 chars, distinct):** `SESSION_SECRET`, `OPS_SECRET`, `PORTAL_SECRET`,
`IDENTITY_HASH_SECRET`.
**First boot:** `ADMIN_EMAIL`, `ADMIN_PASSWORD` (remove after seeding).
**AI provider:** `ZAI_BASE_URL`, `ZAI_API_KEY`, `AGENT_RUN_TIMEOUT_MS`, `AI_OPS_DRIVER`, `AI_PROVIDER_ORDER`,
`MODEL_API_KEY`, and the private-model family `LOCAL_MODEL_*` / `LOCAL_OPENAI_*`.
**Operations:** `OPS_INTERVAL_SEC`, `PLATFORM_URL`, `PREVIEW_TTL_DAYS`.
**Payments:** `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `BANK_TRANSFER_DETAILS`,
`BKASH_MERCHANT_NUMBER`, `NAGAD_MERCHANT_NUMBER`, `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`,
`PAYPAL_WEBHOOK_ID`, `SSLCOMMERZ_STORE_ID`, `SSLCOMMERZ_STORE_PASSWORD`.
**Communications:** `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_APP_SECRET`,
`WHATSAPP_VERIFY_TOKEN`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`,
`EMAIL_WEBHOOK_SECRET`, `HTTPSMS_API_KEY`, `HTTPSMS_FROM`, `HTTPSMS_BASE_URL`, `SMS_API_URL`,
`SMS_API_KEY`, `SMS_SENDER`, `PORTAL_OTP`, `PORTAL_OTP_CHANNEL`, `FACEBOOK_PAGE_TOKEN`,
`INSTAGRAM_TOKEN`, `LINKEDIN_TOKEN`, `X_TOKEN`, `SOCIAL_WEBHOOK_SECRET`, `MEETING_BOOKING_URL`.
**n8n:** `N8N_WEBHOOK_SECRET`, `N8N_WEBHOOK_BASE`.
**Media:** `MEDIA_RENDER_PROVIDER`, `MEDIA_RENDER_API_KEY`, `TTS_PROVIDER_URL`, `TTS_API_KEY`,
`MUSIC_PROVIDER_URL`.
**Telephony:** `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER`, `SIP_DOMAIN`.
**Hostinger Mail:** `HOSTINGER_MAIL_ENABLED`, `HOSTINGER_MAIL_API_TOKEN`, `HOSTINGER_MAILBOX_RESOURCE_ID`,
`HOSTINGER_MAIL_FROM_ADDRESS`, `HOSTINGER_MAIL_WEBHOOK_SECRET`.
**Relay:** `NOTIFY_RELAY_TOKEN`, `NOTIFY_RELAY_URL`.
**Preview (development only):** `PREVIEW_SQLITE_URL` — refused in production.

### 15.2 Admin console map (46 views)

Overview: Dashboard · Ops Monitor.
CRM: Leads · Clients · Approvals · Communications · Live Chat · Calls & SMS · Communication Pipeline.
Finance & Delivery: Payments · Projects.
Product Factory: App Factory · Media Studio.
Growth: Feed Hub · Reviews & Referrals · Blog Studio · Newsletter · SEO Audit · Marketing Kit · Prompt Library.
Intelligence: Core Agents · Configured Org Chart · DCC Certification · Command Center · Model Management ·
Skill Registry · Departments · Task Queue · Workflow Builder · AI Memory · Knowledge Base · Content Studio ·
Analytics.
System: Logs · n8n Workflows · Reports · Team · CRM Integrations · Backup & Recovery · Settings.

### 15.3 API surface by group (180 route files)

`auth` (login, logout, me, change-password, 2fa) · `admin/*` (46 groups: agents, analytics, approvals,
backup, blog, clients, collaboration, command, communications, compliance-audit, content, conversations,
dashboard, dcc, deploy-package, documents, events, factory, feeds, governance, identity, intake-review,
integrations, invoices, journey, knowledge, knowledge-graph, leads/export, logs, mail, media, meetings,
memory, model-hub, n8n, newsletter, notifications, ops-status, payments, pipeline, projects, prompts,
referrals, refunds, reports, reviews, scopes, seo/audit, settings, sops, team, telephony, workflows,
workforce) · `chat` (session, message, messages) · `portal/*` (login, me, documents, invoices, meeting,
payments, referral, request-preview, review) · `preview/[token]` · `webhooks/*` (stripe, whatsapp, email,
sms, social, n8n, hostinger-mail) · `ops/*` (cycle, scan, act, heartbeat) · `model/v1/*` (private
OpenAI-compatible gateway) · `health`, `health/deep`, `metrics` · public `blog`, `reviews`, `features`,
`contact`, `newsletter`, `track`, `rss.xml`, `sitemap`.

### 15.4 Data model map (73 models, grouped)

Auth/RBAC: `User`, `Session`.
CRM: `Client`, `Lead`, `ClientIdentity`, `Communication`, `Meeting`, `Notification`, `FormSubmission`.
Delivery: `Project`, `ProjectTask`, `ScopeOfWork`, `ScopeApproval`, `Preview`, `PreviewEvent`, `Delivery`,
`HandoverRecord`, `FileRecord`.
Money: `Invoice`, `Payment`, `PaymentReceipt`, `RefundCase`, `SequenceCounter`.
Growth: `Review`, `Referral`, `BlogPost`, `NewsletterSubscriber`, `EmailCampaign`, `CampaignEvent`,
`Campaign`, `ContentAsset`, `TrackingEvent`.
AI: `AiAgent`, `AiAgentExecution`, `AgentJob`, `AgentMessage`, `AgentDelegation`, `AgentEvent`, `AiMemory`,
`AiOpsLock`, `KnowledgeDocument`, `KnowledgeChunk`, `KnowledgeIngestRecord`, `KnowledgeEntity`,
`KnowledgeRelation`, `PromptTemplate`, `Skill`, `SkillVersion`, `SkillRun`, `ModelDeployment`,
`WorkflowDefinition`, `Sop`, `SopRun`, `Department`, `DepartmentCapabilityAssessment`.
Chat: `ChatConversation`, `ChatMessage`.
Factory/Media/Feeds: `GeneratedApp`, `GeneratedAppFile`, `GeneratedAppEvent`, `MediaJob`, `MediaShot`,
`FeedSource`, `FeedItem`, `CallLog`.
Governance: `ApprovalRequest`, `AuditLog`, `ErrorLog`, `AutomationLog`, `N8nWorkflow`, `Setting`,
`InboundWebhookReceipt`, `CeoReport`.

### 15.5 Scripts

| Script | Purpose |
|---|---|
| `scripts/prisma.mjs` | Prisma wrapper that repairs engine permissions (Hostinger EACCES fix) |
| `scripts/validate-production-env.mjs` | fail-closed production config gate (`prestart`) |
| `scripts/verify-database.mjs` | read-only DB verification |
| `scripts/e2e-sqlite.mjs` | end-to-end HTTP harness against a throwaway database |
| `scripts/preview/setup.mjs` | offline preview database builder |
| `scripts/health-check.sh` | shell health probe |
| `scripts/convert-schema-to-mysql.mjs` | MySQL native-type enforcement (`schema:check`) |
| `scripts/check-schema-drift.mjs` | schema vs database drift |
| `scripts/verify-ai-production.ts` | AI provider/agent verification report |
| `.github/scripts/verify-production.sh` | production verification in CI |
| `deployment/backup.sh` | retired — do not use (fails fast) |

### 15.6 Glossary

**Client ID** — sequential customer reference `TECH-YYYY-NNNNNN`.
**Stage** — one of the 20 pipeline positions.
**Approval** — a human decision record that releases a governed action.
**Preview** — a working HTML build shown before payment.
**Handover** — release of source/credentials after full payment.
**Ops cycle** — one detect→decide→execute→verify→log→learn pass.
**Honest state** — `CONFIGURED` / `NOT_CONFIGURED` / `INTEGRATION_NOT_BUILT` / `DISABLED_BY_ADMIN`.
**DCC** — department capability certification.
**Dead letter** — a communication that exhausted automatic retries.

### 15.7 Service level guidance (internal targets)

| Activity | Target |
|---|---|
| New lead first response | ≤ 4 business hours |
| Scope delivered after discovery | ≤ 3 business days |
| Preview after advance payment | ≤ 10 business days (project dependent) |
| Payment verification | same business day |
| Client portal sign-in issue | ≤ 2 business hours |
| SEV-1 acknowledgement | immediate |
| Invoice issuance after approval | same business day |

### 15.8 Escalation matrix

| Issue | First | Then |
|---|---|---|
| Login / access | Super Admin | owner |
| Money / refunds | Finance | Super Admin |
| Delivery blocked | Project Manager | Admin |
| Integration outage | Admin | provider support |
| Suspected breach | Super Admin | owner + legal |
| Hosting / database | Admin | Hostinger support |

---

*End of book. Keep this file in the repository and update it in the same pull request as any behavioral
change. If a procedure here disagrees with the running system, the system is right and the book is a bug.*
