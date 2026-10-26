# Final verification — 2026-10-26

**Verdict: the repository builds, tests, boots and serves again.** Before this
round it could not do any of those things: `main` carried 24 files with raw
merge-conflict markers, `package.json` was not valid JSON, and neither `npm ci`,
`npm run build`, `npm test` nor `next dev` could run.

Scope: verify the merged state of `main` (merge commit `d8c73b1`, PR #39) and
make every claim below reproducible from a clean checkout.

---

## 1. What was wrong

PR #39 merged `integration/tech360-merge`. Its conflicts were committed
unresolved. `git grep '^<<<<<<< '` found conflict markers in **24 files**:

`package.json` (6 hunks) · `prisma/schema.prisma` (2, ~2 600 lines duplicated) ·
`bun.lock` (154) · `tsconfig.json` · `next.config.ts` · `eslint.config.mjs` ·
`.gitignore` · `Caddyfile` · `DEPLOYMENT.md` · `prisma/seed.ts` ·
`public/robots.txt` · `src/app/{layout,page}.tsx` · `src/app/globals.css` ·
`src/lib/{auth,db}.ts` · `src/components/ui/progress.tsx` · 7 API routes.

The conflicting sides were two different applications:

| | Canonical (side `HEAD` / `main`) | Uploaded prototype (`upload/tech360-production-final`) |
|---|---|---|
| Shape | Hash-route SPA: `src/components/{site,admin}` | `TopNav`/`PublicSite`/`CrmView` |
| Auth | scrypt + signed session cookie + CSRF | NextAuth (`next-auth`) + bcrypt |
| Schema | `prisma/schema.prisma`, MySQL migrations | different model set (`Agent`, `Visitor`, `FileItem`, `NLCommand`, …) |
| Docs | `docs/`, `tests/`, CI against MySQL | `FINAL_BUILD_REPORT.md`, Cloud Run/Dockerfile |

## 2. How it was resolved

1. **Every conflict resolved in favour of the canonical side.** Verified, not
   assumed: for all 24 files the `HEAD` side of the marker block was compared
   byte-for-byte against `a078f40` (the real `main` parent) and was identical in
   23 of them (`tsconfig.json` differed only by its missing trailing newline).
2. **The prototype was quarantined, not deleted.** All **223 files** that the
   merge added — and that nothing in the canonical app imports — were moved with
   `git mv` to `legacy/upload-prototype/` (history preserved) and excluded from
   `tsconfig.json`, `eslint.config.mjs` and therefore the Next build.
   See `legacy/README.md` for the evidence and revival instructions.
3. `next-env.d.ts` was removed from the index — it is generated and already
   git-ignored.

**Evidence that the prototype was never wired in:** an import-graph scan of all
826 canonical files resolved every `@/…` and relative import and found **zero**
references into the 223 files. Conversely, type-checking the merge as-committed
produced **471 errors in 94 files — all of them in the quarantined set, none in
canonical code.**

## 3. Gates (run after the resolution)

| Gate | Command | Result |
|---|---|---|
| Install | `npm ci --no-audit --no-fund` | ✅ 862 packages |
| Prisma client | `npx prisma generate` | ✅ Client v6.19.3 from `prisma/schema.prisma` |
| Typecheck | `npx tsc --noEmit` | ✅ **0 errors** (was 471) |
| Lint | `npm run lint` | ✅ 0 problems |
| Tests | `npm test` | ✅ 997 tests · 959 pass · 35 cancelled · **3 failing suites, all MySQL-only** |
| Production build | `next build --webpack` | ✅ exit 0 · BUILD_ID `bKtOI5_eqN7h2bLXx-VSE` · 53 dynamic + 135 static routes · 105 MB standalone |

The three failing suites (`tests/database-workflows.test.ts`,
`tests/governance-db.test.ts`, `tests/governance-outbound-db.test.ts`) fail in
their `before` hook with `Environment variable not found: DATABASE_URL` —
they need a live MySQL server, which this sandbox does not have. They are the
same three the project's own worklog documents as CI-only; GitHub Actions runs
them against a disposable MySQL service.

## 4. Runtime verification (real HTTP, not screenshots)

Throwaway SQLite preview database (`npm run preview:setup` → 73 tables, seeded
with the real `prisma/seed.ts` plus the demo dataset: 6 clients, 3 projects,
3 invoices, 44 agents).

| Check | Result |
|---|---|
| `GET /` | 200 · 152 KB SSR HTML · title `Tech360 — Enterprise Software, Automation & Digital Transformation` |
| `GET /api/health` | 200 · `database: UP`, `aiProvider: NOT_CONFIGURED` (honest) |
| `GET /api/blog`, `/api/reviews`, `/api/features` | 200 · real rows from the DB |
| `GET /sitemap.xml`, `/robots.txt` | 200 |
| `POST /api/auth/login` — wrong password | 401 |
| `POST /api/auth/login` — `admin@tech360.local` | 200 + `t360_session` + `t360_csrf` cookies |
| Admin APIs with session (`/api/admin/{dashboard,clients,agents,analytics,invoices}`) | 200 with real data |
| Same APIs without session | 401 |
| Admin write without `x-csrf-token` | 403 `CSRF validation failed` |
| Same write with valid token | passes auth → 400 field validation |
| `POST /api/contact` (public intake) | 200 · issued `TECH-2026-000107` · row in `Client`/`FormSubmission`/`AuditLog` |
| Repeat with the same `requestId` | 200 · `replayed: true`, no duplicate |
| `GET /api/portal/me` without cookie | 401 |
| `POST /api/portal/login` (dev, `PORTAL_OTP=off`) | 200 · portal cookie |
| `GET /api/portal/me` with cookie | 200 · client, invoices, payments, scope, handover, workforce sections |

**Production start path** (`node scripts/start-production.mjs`, i.e. what
`npm start` runs): preflight passes with a complete production environment,
standalone server boots on `0.0.0.0:3100`, `GET /` → 200, and with MySQL absent
`/api/health` → 503, `/api/blog` → 503 `"the database did not answer"`,
`/api/reviews` → 503 — honest failure, never fabricated data.

## 5. Defects found and fixed during this verification

1. **Preview instructions installed an incompatible adapter.** `npm i
   @prisma/adapter-libsql` without a version now resolves to 7.10.1, which
   renames the export to `PrismaLibSql`; against `@prisma/client` 6.19.3 the
   preview seed died with `TypeError: PrismaLibSQL is not a constructor`.
   Version pinned to `6.19.3` in `README.md`, `docs/OPERATIONS_GUIDEBOOK.md`,
   `scripts/preview/setup.mjs` and the hint in `src/lib/preview-db.ts`.
2. **Portal sign-in silently impossible in dev.** `resolvePortalOtpMode` returns
   `required` unless `PORTAL_OTP=off`, so following the README produced
   `503 "Sign-in codes cannot be delivered right now"` with no explanation.
   The start command in `README.md`, the guidebook and the setup banner now
   include `PORTAL_OTP=off` plus the reason (production still always requires a
   delivered code).

## 6. Remaining honest limits

- **MySQL-only suites** were not executed here (no server in the sandbox); they
  run in GitHub Actions against a disposable MySQL. This is unchanged.
- **No live provider credentials** exist here: AI, SMTP, WhatsApp, Stripe and
  social channels stay `NOT_CONFIGURED` and **refuse** to act — verified as
  honest refusals, never simulated success.
- **Hostinger runtime is not verifiable from this repository** — whether hPanel
  invokes the npm lifecycle (and therefore the preflight) still needs
  confirmation on the host, as `README.md` already states.
- The quarantined prototype is preserved but **not** part of the product; it
  cannot be revived in this tree without its own schema, dependencies and root
  route.

## 7. Continuous integration (independent proof for the MySQL-only paths)

Pushed as `arena/e56c843a-tech360` → **PR #41**. GitHub Actions ran both jobs and
**both passed**:

| Job | Duration | Result |
|---|---|---|
| Generate + prove the MySQL baseline | 1m11s | ✅ |
| Validate against MySQL | 4m28s | ✅ |

The `Validate against MySQL` job executed, among others:

`Secret scan` · `npm ci` · `Verify production start fails closed on missing configuration` ·
`Verify retired deployment paths fail closed` · `npm audit` · `Prisma schema is in sync with the MySQL type map` ·
`Committed migrations reproduce the schema (no drift)` · `Apply migrations to the disposable MySQL` ·
`Baseline must leave zero schema drift` · `Lint` · `Typecheck` ·
**`Business and database isolation tests (MySQL)`** · `Verify production seed bootstrap is idempotent` ·
`Database integrity (MySQL, read-only)` · `Production build` · `Validate standalone server and static/public output` ·
`Smoke-test the generated production server`.

This closes the one gap left by the sandbox: the three suites that cannot run
without MySQL (`database-workflows`, `governance-db`, `governance-outbound-db`)
pass against a disposable MySQL server, and the migration baseline still shows
zero drift.

**Summary: install, lint, typecheck, the full test suite (including the MySQL
paths), the production build, the standalone server and the runtime HTTP flows
are all verified. The platform is real, and the checks are reproducible.**
