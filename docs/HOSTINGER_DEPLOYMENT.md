# Tech360 — Hostinger Node.js Web App deployment

> **Status: PRODUCTION VERIFICATION REQUIRED.** This is the repository-side configuration target, not proof that Hostinger is configured or the live application is healthy.

## Evidence boundary

The GitHub source was refreshed from `origin/main` on 2026-10-03 (local date). Its current commit is `70f249c8711bb5fb6213df7e53d2444db87eeff1`; the session branch started at `c735e1798c91a780e4ebaf0498c77e834d56631d`. Since that base, `main` added the MySQL baseline and migration lock, dynamic health version, immutable Action pins, read-only baseline-workflow permissions, and updated documentation. Main CI run 37050663450 passed npm install, Prisma validation/generation, MySQL migration/deploy and drift checks, and lint, then failed at Typecheck because the health route's package import had one extra `../`; this repair corrects that path and awaits its own CI validation. The current main commit is GitHub truth; the Hostinger deployment state remains separately unverified.

The supplied current Hostinger deployment log says it cloned branch `main` at commit `70f249c8711bb5fb6213df7e53d2444db87eeff1`, then reported **“Installing Composer dependencies”** and **“Publishing completed.”** This log proves that deployment job used a Composer-oriented flow for the current main SHA; it does **not** prove Node.js 22, npm installation, a Next.js build, a running Node server, MySQL connectivity, or domain routing. The Node.js Web App hPanel configuration and fresh Node/Next build/runtime logs were not accessible from this repository session.

Fresh read-only probes on 2026-10-03 resolved DNS for the apex and `www` names, but `https://bdtech360.com/`, `https://bdtech360.com/api/health`, and `https://www.bdtech360.com/` each failed TLS with curl exit 35 / HTTP `000`; `http://bdtech360.com/` returned curl exit 52 (empty reply) / HTTP `000`. No application body or route status was obtained. DNS resolution alone does not prove DNS attachment, TLS, or application routing, so no live route is marked verified here.

## Required Hostinger app configuration

Create or configure the **Hostinger Node.js Web App** in hPanel. Do not use PHP hosting, Composer, Laravel, or the generic file-copy Git deployment for this Next.js server application.

| hPanel field | Required target | Verification state |
|---|---|---|
| Application type | Hostinger Node.js Web App with framework preset `next` | **NOT VERIFIED** in hPanel |
| Source repository | `alaminiubateee969-cmd/tech360` | **NOT VERIFIED** in hPanel |
| Branch | `main` | **NOT VERIFIED** in hPanel |
| Application root | Directory containing root `package.json` (repository root; Hostinger documents blank or `/` for a root-level app) | **NOT VERIFIED** in hPanel |
| Node.js version | `22` / `22.x` | Code requires 22.x; Hostinger selector **NOT VERIFIED** |
| Package manager | npm; Hostinger detects it from the committed `package-lock.json` | Repository verified; selected hPanel value **NOT VERIFIED** |
| Dependency installation | Hostinger-managed install; its GitHub guide describes npm install. CI uses `npm ci --no-audit --no-fund`. | Exact Hostinger install command **NOT VERIFIED** until deployment logs are inspected |
| Build script | `npm run build` (Hostinger hPanel script value: `build`) | Repository script verified; hPanel setting **NOT VERIFIED** |
| Output directory | `.next` (Hostinger's documented Next.js server-mode setting) | Repository/Next output verified; hPanel setting **NOT VERIFIED** |
| Entry file | Leave blank; Hostinger ignores the entry-file field for framework `next` | Documented behavior; actual hPanel value **NOT VERIFIED** |
| Hostinger start behavior | Next.js `next` preset starts its bundled standalone server | Documented behavior; actual hPanel/runtime behavior **NOT VERIFIED** |
| Repository start script | `npm run start` (`node .next/standalone/server.js`) for CI/manual smoke; not assumed to be a Hostinger hPanel command | Repository script verified; not yet run locally because Prisma engine download failed |
| Domains | Canonical apex `bdtech360.com`; `www.bdtech360.com` must have valid HTTPS and redirect to the apex | Attachment, certificate, and redirect **NOT VERIFIED** |

The package's `hostinger:build` alias delegates to the standard `build` script. For the documented Next.js `next` preset, the target hPanel build-script field is `build` (`npm run build`), which performs Prisma generation, forward-only migration deploy, Next.js build, and standalone asset copies. Verify the actual command in Hostinger's build logs.

The application root is the repository directory that contains `package.json`; `public_html` is not a substitute for the Node.js app root. Hostinger may manage the runtime/build directories itself. Do not invent or hard-code a Hostinger filesystem path.

The GitHub Actions workflow validates code only. Hostinger's connected Node.js Web App Git integration is the intended production deployment mechanism; it must be connected to `main` in hPanel. A successful GitHub CI run is not a Hostinger deployment result.

## Runtime and port

`package.json` requires Node `>=22.0.0 <23`; Hostinger's supported Node.js Web App versions include 22. Its current Next.js guide specifies app type `next`, build script `build`, output directory `.next`, and entry file ignored; Hostinger builds standalone output and starts the bundled server. The repository's `npm run start` launches `.next/standalone/server.js` for CI/manual smoke tests; it is not assumed to be an hPanel start command for the `next` preset.

Next standalone honors `PORT` when supplied, but Hostinger's public docs do not specify the port value or injection mechanism. Do not set a guessed port. Confirm the app's actual process binding using hPanel/runtime logs. The Hostinger runtime and port are **NOT VERIFIED**. A standalone production-start smoke test is configured in GitHub Actions; it remains **PENDING** until the branch run passes. No local production server was produced because Prisma engine download failed before the Next.js build.

## Environment variables

Add values only in the Hostinger Node.js Web App's Environment Variables panel. Use [`HOSTINGER_ENVIRONMENT_VARIABLES.md`](./HOSTINGER_ENVIRONMENT_VARIABLES.md) as the variable-name inventory. Do not put production `.env` files, passwords, tokens, or database credentials in Git.

Core app configuration identified in source:

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | Prisma MySQL connection; use the exact database host and database details shown by Hostinger |
| `NODE_ENV` | Set to `production` |
| `APP_PUBLIC_URL` | Public links and metadata; `https://bdtech360.com` |
| `APP_ORIGIN` | Origin check for checkout; `https://bdtech360.com` |
| `SESSION_SECRET` | Session/newsletter signing fallback |
| `PORTAL_SECRET` | Client portal token signing |
| `OPS_SECRET` | Operations endpoint authentication, if enabled |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD` | Initial Super Admin seed only; remove the temporary password after the first sign-in/password change |

The actual Hostinger MySQL host, production URL, and configured variables are **NOT VERIFIED**. Do not infer `localhost`, `127.0.0.1`, an SSH address, database name, username, or password. Never paste secret values into GitHub, documentation, logs, or chat.

## Prisma and database safety

The checked-in Prisma datasource says `provider = "mysql"`; SQLite is not the production database. The initial migration is `prisma/migrations/0_init/migration.sql`, and `prisma/migrations/migration_lock.toml` also declares the MySQL provider. CI uses a disposable MySQL service and applies the checked-in baseline there. CI database success does not prove that Hostinger's production MySQL database is reachable or migrated.

`npm run build` generates the Prisma client, applies committed pending migrations with forward-only `prisma migrate deploy`, runs the Next.js production build, and copies standalone static/public assets. Any failed step stops the build. Before triggering Hostinger, an authorized operator must confirm the actual MySQL endpoint, migration history/schema baseline, and recoverable backup; this audit has not verified those production facts. `npm run db:verify` is read-only and requires `DATABASE_URL`. Never run reset, force-reset, `db push`, or data-loss commands against production.

## Deployment-log acceptance criteria

A new Hostinger deployment should establish, in its deployment details, build logs, and runtime logs:

1. the correct GitHub repository, `main` branch, and exact deployment commit SHA;
2. the Node.js app runtime is 22.x, npm is selected from `package-lock.json`, the root is the repository root, and the framework preset is `next`;
3. Hostinger's managed dependency installation uses npm and the deployment path is the Node.js Web App flow, not Composer;
4. the hPanel build script is `build` (`npm run build`) and the output directory is `.next`;
5. `.next/standalone/server.js`, `.next/static`, and the copied `public` assets exist in the successful build;
6. the Hostinger Next.js preset starts its bundled standalone server without startup exceptions; check Runtime Logs rather than assuming a custom `npm run start` field;
7. the process remains running and binds the actual platform port if one is supplied (do not invent or hard-code it).

“Publishing completed” after “Installing Composer dependencies” is not sufficient evidence for any of those Node/Next.js checks.

## Safe domain cutover from the generic Composer/PHP flow

Before changing the website/domain association, preserve the GitHub repository, record production environment values securely outside Git/chat, and verify a recoverable Hostinger MySQL backup/restore procedure. Do not delete the database or repository when replacing the old website configuration. If Hostinger requires the existing generic Website → Advanced → Git site to be removed before attaching `bdtech360.com` to the Node.js Web App, perform that change only after the backup and environment-preservation checks. Then detach/disable the generic Composer/PHP deployment so it cannot overwrite or compete with the Node.js app, attach the apex domain to the Node.js Web App, enable valid HTTPS, attach `www` and redirect it to the canonical apex, and verify the resulting Node.js runtime and public routes. The hPanel domain cutover and backup/restore remain **NOT VERIFIED** here.

## Live verification required after Hostinger configuration

Run the checks from an external client and preserve the status, headers, response body (redacting personal data), and relevant runtime-log entries:

| URL/request | Required evidence |
|---|---|
| `GET https://bdtech360.com/` | HTTPS succeeds; application returns HTTP 200 |
| `GET https://www.bdtech360.com/` | Valid TLS certificate; redirects to the canonical `https://bdtech360.com/` domain (expected HTTP 301/308) |
| `GET https://bdtech360.com/api/health` | HTTP 200 only when critical DB check is up; JSON `app` is `tech360-platform`, `version` equals `package.json`, and database detail identifies connected MySQL |
| `POST https://bdtech360.com/api/portal/login` with `{}` | Intended validation/auth response (not an unhandled server error); a real login requires a seeded account and configured sign-in flow |
| `POST https://bdtech360.com/api/admin/seo/audit` with `{}` and no credentials | Protected-route refusal is expected; authenticated audit requires a manager session and a controlled target URL |
| `GET https://bdtech360.com/_next/static/...` | A real built asset returns successfully |

The health route must not report healthy while the database connection is down. Do not mark DNS, HTTPS, domain attachment, MySQL, or any live route verified until the corresponding check and Hostinger logs have actually passed.

## Official Hostinger references

- [Creating a Node.js App](https://docs.hostinger.com/node.js/creating-an-app) — Node.js Web App creation and supported Node.js versions.
- [Next.js on Hostinger Node.js Web Apps](https://docs.hostinger.com/node.js/overview-1/next) — `next` preset, `build` script, `.next` output, standalone build, automatic bundled-server start, and ignored entry-file field.
- [GitHub integration](https://docs.hostinger.com/node.js/github) — Hostinger-managed dependency install/build/start on the connected branch and deployment commit/log records.
- [Build Settings](https://docs.hostinger.com/node.js/build-settings) — Node versions, root directory, package manager, output directory, and entry-file rules.
- [Environment Variables](https://docs.hostinger.com/node.js/environment-variables) — values are injected into build/runtime and managed in hPanel.
- [Deployments](https://docs.hostinger.com/node.js/deployments) — selected source/branch/commit, build logs, and deployment settings.
