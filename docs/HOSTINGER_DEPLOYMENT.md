# TECH360 — Hostinger production deployment

```
PRODUCTION_STATUS=BLOCKED
```

Target architecture:

```
GitHub  alaminiubateee969-cmd/tech360  (main)
  ↓  Hostinger Node.js web app — Git integration
  ↓  install → build → start   (run by Hostinger, on the Hostinger server)
bdtech360.com
```

---

## 1. The root cause of the 403

Hostinger has **two different Git features**, and the wrong one is connected.

> Hostinger's own documentation, *Node.js → GitHub*:
> "This is a separate integration from the generic Git feature in the Websites
> section. This one runs the full Node.js build pipeline (install → build →
> start). **The generic one just copies files into a directory.** Use this one
> whenever your project needs `npm install` or a build step."

The panel currently shows the **generic** Websites → Git feature, deploying
`main` into `public_html`. That feature only copies files. It never runs
`npm install`, never runs `next build`, and never starts a Node process.

So "Deployment: Completed" is truthful and simultaneously useless here: the
repository source was copied into `public_html`, and nothing was built or run.

Observed behaviour, which matches that exactly:

| Request | Response | Meaning |
|---|---|---|
| `https://bdtech360.com/` | **403** | `public_html` exists, holds source, has no `index.html`; directory listing disabled |
| `https://bdtech360.com/index.php` | Hostinger static 404 | no PHP app either |
| `https://bdtech360.com/api/health` | Hostinger static 404 | **no Node process is bound to the domain** |
| random path | Hostinger static 404 | the static web server is answering, not the app |

TLS terminates and DNS resolves, so SSL, DNS, WAF and `.htaccess` are **not**
the cause. The 403 comes from the web server's directory-index handler.

**This cannot be fixed inside the repository.** TECH360 is a Next.js SSR
application with 109 API routes, session authentication and a MySQL database.
It cannot be served as static files, and converting it to a static export
would delete the CRM, the client portal, the admin panel and the AI workforce.

---

## 2. What the operator must do in hPanel

1. **hPanel → Websites → `bdtech360.com` → remove the generic Git connection.**
   Leaving it attached lets it overwrite `public_html` behind the Node app.
2. **hPanel → Websites → Add Website → Node.js app** (or convert the existing
   site to a Node.js web app).
3. Choose **Import Git Repository** and authorise the Hostinger GitHub App for
   `alaminiubateee969-cmd/tech360`.
4. Configure the build settings:

   | Setting | Value |
   |---|---|
   | Branch | `main` |
   | Node.js version | **22** |
   | Root directory | repository root |
   | Install command | `npm ci` |
   | Build command | `npm run hostinger:build` |
   | Start command | `npm run start` |
   | Output directory | `.next` |
   | Entry file | `.next/standalone/server.js` |

5. Add the environment variables from §3 **in the Hostinger app settings**,
   not in the repository.
6. Deploy, then watch the streamed build log.

> A Node.js app is only available on plans with Node.js web-app hosting.
> If the plan does not offer it, this application cannot run on that plan and
> the plan must be upgraded — no repository change can work around it.

---

## 3. Environment variables (set in Hostinger, never committed)

Required:

| Variable | Value |
|---|---|
| `NODE_ENV` | `production` |
| `DATABASE_URL` | `mysql://u394009794_bdtech360_user:<PASSWORD>@<DB_HOST>:3306/u394009794_bdtech360` |
| `NEXT_PUBLIC_SITE_URL` | `https://bdtech360.com` |
| `SESSION_SECRET` | long random value |
| `OPS_SECRET` | long random value |
| `PORTAL_SECRET` | long random value |

`<DB_HOST>` must be read from **hPanel → Databases → Management**. It is
**not** the SSH IP `189.49.97.102`. On Hostinger it is usually `localhost`
*from the server's own perspective*, but it must be confirmed, not assumed.

Required before the matching feature is usable — each endpoint returns **503**
while unset, by design:

| Variable | Enables |
|---|---|
| `N8N_WEBHOOK_SECRET` | `/api/webhooks/n8n` |
| `SOCIAL_WEBHOOK_SECRET` | `/api/webhooks/social` |
| `WHATSAPP_APP_SECRET` | inbound WhatsApp signature check |
| `SMTP_*` | email |
| `SMS_API_URL`, `SMS_API_KEY` | SMS |
| `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID` | WhatsApp sending |

Never place any of these in the repository, in `public_html`, or in chat.

---

## 4. Repository changes that make the Hostinger pipeline work

| Change | Why |
|---|---|
| removed `next-auth` | **This blocked the build.** It was imported by zero files, but its peer range `nodemailer@^7` conflicted with the app's `nodemailer@^10`, so `npm install` failed with `ERESOLVE`. Hostinger installs with npm, so the build would have failed before `next build` ran. The app uses its own auth in `src/lib/auth.ts`. |
| committed `package-lock.json` | Hostinger auto-detects npm/yarn/pnpm lockfiles — **not** `bun.lock`. Without an npm lockfile `npm ci` cannot run and the install is non-deterministic. `bun.lock` stays authoritative for local dev and CI. |
| `start` now uses **node**, not bun | The old script was `bun .next/standalone/server.js`. Hostinger's runtime is Node; bun is not installed. `start:bun` is kept for local use. |
| dropped the `\| tee server.log` pipe from `start` | The pipe made the exit status come from `tee`, so a crashed server still looked healthy to the supervisor — and it grew an unbounded log file inside the app directory. |
| added `hostinger:build` | Hostinger never runs Prisma. The build command now does `prisma generate && prisma migrate deploy && next build`. `migrate deploy` is forward-only: it replays reviewed migrations and never resets or drops. |
| added `engines.node: >=22 <23` | Pins Node 22, the Hostinger Cloud Startup runtime, instead of leaving Node 16/18/20/22/bun ambiguous. |

---

## 5. `main` is not yet deployable

`main` is currently commit `d82f030` and still contains:

```prisma
datasource db {
  provider = "sqlite"
}
```

The production database is **MySQL**. A Prisma client generated for SQLite
emits a different SQL dialect and cannot talk to MySQL, so the application
would start and then fail on its first query.

`main` also still exposes `db:push --accept-data-loss` and `db:reset`, and it
has no `prisma/migrations` baseline, so there is nothing for
`prisma migrate deploy` to apply.

**The MySQL migration, the baseline and the security fixes are on
`arena/01a0f285-tech360` and must be merged into `main` before the Hostinger
Node app is deployed.** Deploying `main` as it stands produces a running
process that cannot reach its database.

---

## 5b. First Super Admin account

The bootstrap already exists — `prisma/seed.ts` upserts a `SUPER_ADMIN` user
and flags it `mustChangePassword`, so the owner is forced to change it at
first login.

It previously fell back to a password literal committed in this repository,
which on a public GitHub repo is a publicly known Super Admin credential the
moment the seed runs. The seed now **refuses to run in production** unless
`ADMIN_PASSWORD` is set and at least 12 characters.

In the Hostinger app environment set:

| Variable | Value |
|---|---|
| `ADMIN_EMAIL` | the owner's address, e.g. `info@bdtech360.com` |
| `ADMIN_PASSWORD` | a strong temporary password, **entered only in the Hostinger UI** |

Then run the seed once, from the Hostinger app shell:

```bash
npm run db:seed
```

Sign in, change the password immediately, and delete `ADMIN_PASSWORD` from the
environment. No password is ever written to the repository, a workflow file,
a log, or this document.

---

## 6. Verification (run after the Node app is live)

```bash
curl -I https://bdtech360.com/
curl -I https://www.bdtech360.com/
curl -sS https://bdtech360.com/api/health
```

Expected health response:

```json
{"status":"healthy","app":"tech360-platform",
 "checks":{"database":{"status":"UP","detail":"MySQL via Prisma — connected"},
           "aiAgents":{"status":"UP","detail":"44 agents registered"}}}
```

The deployment is successful only when all of the following hold:

- `/` returns **200**
- `/api/health` returns **200** and `app` is `tech360-platform`
- `checks.database.status` is `UP` and the detail says **MySQL**
- `checks.aiAgents` reports **44 agents**
- admin sign-in works and the client portal loads
- static assets under `/_next/static/` return 200

A green Hostinger deployment badge on its own proves none of this.

---

## 7. Deployment is not performed by GitHub Actions

`.github/workflows/ci.yml` validates a commit and stops. It has no SSH, no
rsync, no scp and no remote restart, because a second deployment mechanism
could overwrite production behind Hostinger's back.

`scripts/deploy-hostinger.sh` is retained as a **manual** operator tool for
the things Hostinger's pipeline does not do — a verified `mysqldump` backup
before schema changes, a strict migration gate, and code rollback. Nothing
invokes it automatically.
