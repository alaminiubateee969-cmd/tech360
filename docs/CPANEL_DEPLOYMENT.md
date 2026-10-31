# cPanel Deployment Guide (Node.js application)

**Scope:** deploy this repository — a Next.js 16 / React 19 / Prisma 6 / MySQL
server — on a cPanel account that provides the **Setup Node.js App** feature
(Passenger-based Node hosting). Verified against the source contract in this
repository; **not** verified against a live cPanel host in this session.

**Status of the "install.php wizard" requirement:** not implemented, deliberately.
This application has no PHP runtime or PHP code path. A PHP installer would be
an inert file that could not create the admin account, run Prisma migrations, or
write the runtime configuration, and shipping it would misrepresent the system
as installable. The same four installer duties are provided by
[`scripts/install.mjs`](../scripts/install.mjs) — see step 6.

---

## 0. Host requirements (check these first)

| Requirement | Why | How to verify |
|---|---|---|
| cPanel with **Setup Node.js App** | The app is a long-running Node server, not static files or PHP | cPanel → Software → *Setup Node.js App* exists |
| **Node.js 22.x** (engines: `>=22 <23`) | `package.json` engines gate; Prisma 6.19.3 support | Node.js App panel → *Node.js version* dropdown |
| **MySQL 8.0+** database + user | Production datasource is MySQL only | cPanel → Databases → MySQL Databases |
| Ability to set environment variables | Secrets, DB URL, integrations | Node.js App panel → *Environment variables* |
| ~1.5 GB disk + build memory | `node_modules` + `.next` build output | cPanel → Disk usage |
| Optional: SSH or cron | Migrations, scheduler, log tail | cPanel → Advanced |

If the account is PHP-only (no Node.js app selector, no long-running process),
this application **cannot** run there. Use a VPS or a Node-capable host instead.
Installing PHP add-ons does not change this.

---

## 1. Get the code onto the account

Preferred (repeatable):

```bash
cd ~/apps
git clone https://github.com/alaminiubateee969-cmd/tech360.git tech360
cd tech360
git checkout main
```

Alternative: upload a source archive via *File Manager* and extract it **outside**
`public_html` (for example `~/apps/tech360`). Never extract into `public_html`
directly — `.env`, `prisma/`, and `node_modules/` must not be web-reachable.

---

## 2. Create the MySQL database

1. cPanel → **MySQL Databases** → create database `tech360`.
2. Create a user with a strong password; add it to the database with **ALL PRIVILEGES**.
3. Note the exact strings: cPanel prefixes both, e.g. `cpuser_tech360`, `cpuser_tech`.
4. Build the URL (URL-encode special characters in the password):

```
mysql://cpuser_tech:ENCODED_PASSWORD@localhost:3306/cpuser_tech360
```

Do **not** run `prisma migrate reset` or `db push` against this database — the
repository's contract is `migrate deploy` only (no schema reset, no data drop).

---

## 3. Configure environment variables

Create `.env` in the application root (`~/apps/tech360/.env`, mode `600`) **or**
enter the same keys in the Node.js App panel. Full list:
[`.env.example`](../.env.example). Minimum required set:

```dotenv
NODE_ENV=production
DATABASE_URL=mysql://cpuser_tech:...@localhost:3306/cpuser_tech360
APP_PUBLIC_URL=https://bdtech360.com
APP_ORIGIN=https://bdtech360.com
SESSION_SECRET=<32+ random chars>
PORTAL_SECRET=<32+ random chars>
OPS_SECRET=<32+ random chars>
ADMIN_EMAIL=owner@example.com
ADMIN_PASSWORD=<12+ chars, first-boot only>
```

Generate secrets on the server, never in chat or in Git:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

Integration keys (SMTP, WhatsApp Cloud API, AI provider) are optional at install
time. When they are absent the application reports those integrations as
unavailable — it does not pretend they are active. Add them only when you can
run the provider's own acceptance test (see step 8).

---

## 4. Install dependencies

```bash
cd ~/apps/tech360
npm ci --no-audit --no-fund
```

`npm ci` is used instead of `npm install` so the deployed tree matches
`package-lock.json` exactly. If the host blocks lifecycle scripts, the Prisma
engine step in step 5 repairs permissions (`scripts/prisma.mjs`).

---

## 5. Build

```bash
npm run build
```

This runs, in order: Prisma client generation → `prisma migrate deploy` →
`next build` → copy of static assets and `public/` into `.next/standalone/`.
The build output is self-contained; the runtime entry point is
`.next/standalone/server.js`.

If the build fails on `EACCES` for `node_modules/@prisma/engines/*`, that is the
documented Hostinger/cPanel permission case handled by `scripts/prisma.mjs`
(see `docs/HOSTINGER_DEPLOYMENT.md`).

---

## 6. Run the installer

```bash
npm run install:check   # report only, no writes
npm run install:app     # migrations + idempotent seed (SUPER_ADMIN upsert)
```

`install:app` performs the installer duties:

| Duty | Implementation |
|---|---|
| System configuration | validates required env, secret strength, Node version, MySQL URL |
| Database setup | `prisma migrate deploy` (committed migrations only) |
| Admin creation | `prisma/seed.ts` — upserts `SUPER_ADMIN` from `ADMIN_EMAIL`/`ADMIN_PASSWORD` |
| SMTP / WhatsApp / AI | reports configuration state per integration; never claims "active" |

After the first successful install, **remove `ADMIN_PASSWORD` from the
environment** and change the password at first login. The seed is idempotent and
preserves existing users.

---

## 7. Register the application in cPanel

1. cPanel → **Setup Node.js App** → *Create Application*.
2. **Application root:** `apps/tech360`
3. **Application URL:** the domain/subdomain that should serve the site.
4. **Application startup file:** `.next/standalone/server.js`
5. **Node.js version:** 22.x
6. Add the environment variables from step 3 (or rely on `.env`).
7. Click **Run NPM Install**, then **Restart**.

The Passphrase/Passenger layer proxies the domain to the Node process on the
port cPanel assigns (`PORT` is provided by cPanel; `scripts/start-production.mjs`
honours it). Do not hard-code port 3000 in production.

If your host instead offers a reverse-proxy file, point it at the same process.
Static files are served by Next.js itself; no separate `public_html` copy is
required, and copying `.next/static` into `public_html` will break asset paths.

### HTTPS

1. cPanel → **SSL/TLS Status** → *Run AutoSSL* for the domain.
2. Confirm the apex domain is canonical. The app redirects `www` and
   `X-Forwarded-Proto: http` to `https://bdtech360.com` (`next.config.ts`).
3. Set `force HTTPS` in the domain settings so plain HTTP never reaches the app.

---

## 8. Verify the deployment (evidence, not assumption)

Run these and keep the output as deployment evidence:

```bash
curl -sS -o /dev/null -w '%{http_code}\n' https://bdtech360.com/            # expect 200
curl -sS https://bdtech360.com/api/health | head -c 400                     # expect status/db fields
curl -sS -o /dev/null -w '%{http_code}\n' https://bdtech360.com/api/ai-gateway/ready  # 200 only if configured
```

Then, in the browser:

1. `/#/admin` → sign in with the Super Admin account → change the password.
2. `/#/contact` → submit a test enquiry → confirm the returned **Client ID**
   (`TECH-YYYY-NNNNNN`) and that the record appears in Admin → Clients with
   attribution and a follow-up schedule.
3. Admin → Settings → confirm SMTP/WhatsApp/AI switches match reality.
4. Only after a provider acceptance test (a real email received, a real
   WhatsApp template delivered) mark that integration as live in your own
   records — the application intentionally does not self-certify.

---

## 9. Scheduled work (optional, only when you need it)

The operations loop is `POST /api/ops/cycle` and requires `OPS_SECRET`.
If you enable it, use cPanel → **Cron Jobs**:

```cron
*/15 * * * * curl -fsS -X POST -H "x-ops-secret: $OPS_SECRET" https://bdtech360.com/api/ops/cycle >/dev/null 2>&1
```

Cron does not expand shell variables from your `.env`; pass the secret by a
protected script instead of inlining it in the crontab, and keep the secret out
of shell history. Until a scheduler is configured and a heartbeat is persisted,
treat the operations loop as **not running** (see `deployment/scheduler.md`).

---

## 10. Backup, restore, rollback

- **Database:** cPanel → phpMyAdmin → export before every deploy. Keep the dump
  off the same host.
- **Uploads:** back up the configured upload/object-storage location (files are
  not stored in Git).
- **Rollback:** `git checkout <previous-sha> && npm ci && npm run build` then
  restart. Migrations are forward-only; restore the pre-deploy dump if a
  migration must be reversed.

See `docs/BACKUP_AND_RESTORE.md` and `docs/ROLLBACK_AND_RECOVERY_GUIDE.md`.

---

## 11. Hardening checklist

- [ ] `.env` outside `public_html`, permissions `600`, owner-only read.
- [ ] `node_modules/`, `prisma/`, `.git/` not web-reachable.
- [ ] `ADMIN_PASSWORD` removed from the environment after the first install.
- [ ] Directory listing disabled for the domain.
- [ ] AutoSSL active; HTTP → HTTPS redirect confirmed.
- [ ] Default `admin@` / `root@` mailboxes do not exist.
- [ ] cPanel and app logins use unique credentials; 2FA enabled where offered.
- [ ] `npm run install:check` passes on the deployed tree.
- [ ] A restore from backup has been tested at least once.

---

## 12. What this guide does not claim

- It does not certify that a specific cPanel host runs Node 22 correctly.
- It does not prove a provider (SMTP/WhatsApp/AI) is working — only that it is
  configured; provider acceptance requires a real send/inference test.
- It does not replace `docs/HOSTINGER_DEPLOYMENT.md`, which covers the currently
  targeted Hostinger Node.js Web App path.
