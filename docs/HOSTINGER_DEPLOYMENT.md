# Tech360 — Hostinger Node.js Web App deployment

> **Status: PRODUCTION VERIFICATION REQUIRED.** The verified `main` SHA passes GitHub CI, including a production-start smoke against disposable MySQL. No Hostinger log for that SHA or successful live-domain application response is available; deployment, database, startup, TLS, and routing remain **NOT VERIFIED**.

## Evidence boundary

Current GitHub source: `main` is `286c4336be4d9d3ac640c67744a1028a826b1de4`. GitHub Actions run [37611562610](https://github.com/alaminiubateee969-cmd/tech360/actions/runs/37611562610) passed all configured steps for that exact SHA, including the Prisma permission regression guard, disposable-MySQL migrations/drift checks, production build, standalone validation, and startup HTTP smoke. This is source/CI evidence only.

The last supplied Hostinger failure log cloned `main` at `807c3a737c06e3034a0261ecb3e69abb41f4c1b0` (before the PR #11 repair), completed npm install and Prisma client generation, then failed at `prisma migrate deploy` with schema-engine **EACCES**. No newer Hostinger build/runtime log for `286c4336be4d9d3ac640c67744a1028a826b1de4` is available, so whether Hostinger deployed or recovered on that SHA is **NOT VERIFIED**. The verified root cause and repository-side repair are documented below ("Prisma engine EACCES").

Direct read-only probes on 2026-10-03 resolved the apex and `www` addresses, but HTTPS requests to the homepage and `/api/health` failed with curl exit 35 / HTTP `000`; HTTP apex returned exit 52 / HTTP `000` (empty reply). An earlier external fetcher returned generic Hostinger 403/404 pages, which also did not establish application health. No successful current application response was obtained; DNS/TLS attachment, runtime, canonical redirects, and live routes remain **NOT VERIFIED**.

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
| Dependency installation | Hostinger-managed install; its GitHub guide describes npm install. CI uses `npm ci --no-audit --no-fund`. The committed `.npmrc` (`include=dev`) forces Hostinger's production-mode `npm install` to include the devDependencies the Next.js build needs; `tw-animate-css` (imported by `src/app/globals.css`) is a regular dependency. | Exact Hostinger install command **NOT VERIFIED** until deployment logs are inspected |
| Build script | `npm run build` (Hostinger hPanel script value: `build`) | Repository script verified; hPanel setting **NOT VERIFIED** |
| Output directory | `.next` (Hostinger's documented Next.js server-mode setting) | Repository/Next output verified; hPanel setting **NOT VERIFIED** |
| Entry file | Leave blank; Hostinger ignores the entry-file field for framework `next` | Documented behavior; actual hPanel value **NOT VERIFIED** |
| Hostinger start command | `npm start`; npm runs the production environment preflight and then `node .next/standalone/server.js` | Repository scripts verified; actual hPanel command **NOT VERIFIED** |
| Domains | Canonical apex `bdtech360.com`; Next.js redirects `www` and trusted HTTP-proxy requests to the apex HTTPS origin | Application rules are in source; DNS attachment and TLS **NOT VERIFIED** |

The package's `hostinger:build` alias delegates to the standard `build` script. For the documented Next.js `next` preset, the target hPanel build-script field is `build` (`npm run build`), which performs Prisma generation, forward-only migration deploy, Next.js build, and standalone asset copies. Verify the actual command in Hostinger's build logs.

The application root is the repository directory that contains `package.json`; `public_html` is not a substitute for the Node.js app root. Hostinger may manage the runtime/build directories itself. Do not invent or hard-code a Hostinger filesystem path.

The GitHub Actions workflow validates code only. Hostinger's connected Node.js Web App Git integration is the intended production deployment mechanism; it must be connected to `main` in hPanel. A successful GitHub CI run is not a Hostinger deployment result. The repository contract is `npm start`: npm runs `prestart`, which validates production configuration without printing values, then starts the standalone server. The production AI operations driver is now in `src/instrumentation.ts`; it starts only at runtime in production, waits 30 seconds, defaults to a 90-second interval, honors `AI_OPS_DRIVER=off`, and uses a database lease to prevent overlap. Hostinger startup behavior and driver logs remain **NOT VERIFIED** until hPanel evidence is available.

## Runtime and port

`package.json` requires Node `>=22.0.0 <23`. Hostinger's documented Next.js preset uses app type `next`, build script `build`, output directory `.next`, and ignores the entry-file field. The repo's required start command is `npm start`, which runs the production environment preflight and then launches `.next/standalone/server.js`. Whether the selected Hostinger preset actually invokes that npm lifecycle command (rather than starting the bundled server directly) is **NOT VERIFIED**; confirm it in hPanel and runtime logs.

Next standalone honors `PORT` when supplied, but Hostinger's public docs do not specify the port value or injection mechanism. Do not set a guessed port. Confirm the app's actual process binding using hPanel/runtime logs. The Hostinger runtime and port are **NOT VERIFIED**. The standalone production-start smoke passed in main CI run 37611562610 against disposable MySQL; this does not verify Hostinger. The raw Actions log was not inspected for Node runtime warnings. No local production server was produced because Prisma engine download failed before the Next.js build.

## Environment variables

Add values only in the Hostinger Node.js Web App's Environment Variables panel. Use [`HOSTINGER_ENVIRONMENT_VARIABLES.md`](./HOSTINGER_ENVIRONMENT_VARIABLES.md) as the variable-name inventory. Do not put production `.env` files, passwords, tokens, or database credentials in Git.

Core app configuration identified in source:

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | Prisma MySQL connection; copy the exact Hostinger host, port, database name, username, and password from its MySQL panel |
| `NODE_ENV` | Set to `production` |
| `APP_PUBLIC_URL` | Public links and metadata; `https://bdtech360.com` |
| `APP_ORIGIN` | Origin check for checkout; `https://bdtech360.com` |
| `SESSION_SECRET` | Session/newsletter signing fallback |
| `PORTAL_SECRET` | Client portal token signing |
| `OPS_SECRET` | Required distinct random secret for operations endpoint authentication |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD` | Initial Super Admin seed only; remove the temporary password after the first sign-in/password change |

The Hostinger database settings and configured environment variable names are **NOT VERIFIED**. The startup preflight accepts only a credentialed MySQL URL with a database name; it does not assume a hostname, port, or database name. An authorized operator must copy and verify the exact endpoint from Hostinger's MySQL panel before a deployment build can run `prisma migrate deploy`. Never paste secret values into GitHub, documentation, logs, or chat.

## Prisma and database safety

The checked-in Prisma datasource says `provider = "mysql"`; SQLite is not the production database. The initial migration is `prisma/migrations/0_init/migration.sql`, and `prisma/migrations/migration_lock.toml` also declares the MySQL provider. CI uses a disposable MySQL service and applies the checked-in baseline there. CI database success does not prove that Hostinger's production MySQL database is reachable or migrated.

`npm run build` generates the Prisma client, applies committed pending migrations with forward-only `prisma migrate deploy`, runs the Next.js production build, and copies standalone static/public assets. Any failed step stops the build. Before triggering Hostinger, an authorized operator must confirm the actual MySQL endpoint, migration history/schema baseline, and recoverable backup; this audit has not verified those production facts. `npm run db:verify` is read-only and requires `DATABASE_URL`. Never run reset, force-reset, `db push`, or data-loss commands against production.

## Prisma engine EACCES — verified root cause and fix (2026-10-03)

The first Hostinger Node.js Web App build of `main` (`807c3a7`) failed at
`prisma migrate deploy` with:

```
Error: Schema engine exited
Command failed with EACCES
.../node_modules/@prisma/engines/schema-engine-debian-openssl-1.1.x
spawn .../schema-engine-debian-openssl-1.1.x EACCES
```

Verified root cause (reproduced locally on Linux with the real Prisma
6.19.3 engines, commit `c2990dca591cba766e3b7ef5d9e8a84796e47ab7`):

1. Prisma 6.19.3 downloads native engine binaries lazily and applies
   `chmod +x` **only while downloading** (`@prisma/fetch-engine`:
   `downloadBinary` → `chmodPlusX`).
2. When a **valid engine cache** exists (`~/.cache/prisma/master/<commit>/<target>/`
   with a matching `.sha256`), the cache-integrity check makes Prisma
   **reuse the existing in-place file and skip re-downloading** — it never
   re-chmods an existing file.
3. Hostinger's build filesystem provisions the engine file **without the
   executable bit**, so the reuse path hands a non-executable file to the
   CLI and the spawn fails with EACCES.

Fix (committed, minimal, no masking):

- `scripts/prisma.mjs` — a Prisma execution wrapper used by the production
  build. Before every Prisma command it restores the executable bit on all
  engine artifacts in every location Prisma 6.19.3 uses
  (`node_modules/@prisma/engines`, `node_modules/prisma`,
  `node_modules/.prisma/client`, the Prisma cache), execve-tests each
  spawnable engine, and — if a filesystem cannot honor the executable bit —
  falls back to executable copies plus the official
  `PRISMA_SCHEMA_ENGINE_BINARY` / `PRISMA_MIGRATION_ENGINE_BINARY` /
  `PRISMA_QUERY_ENGINE_BINARY` overrides. It fails loudly if the engines
  cannot be made executable; it never uses `|| true` and never skips a
  failing migration.
- `package.json`: the `build` (and `db:deploy`) scripts invoke Prisma via
  `node scripts/prisma.mjs …` instead of bare `prisma …`.
- `.github/workflows/ci.yml`: a deterministic regression guard seeds a valid
  engine cache, strips the executable bit (the exact Hostinger state),
  asserts the **original** `npx prisma migrate deploy` fails with EACCES,
  then applies the migrations through the wrapper against the disposable
  MySQL — proving the failure mode and the fix on every main CI run.

No `binaryTargets`/OpenSSL target was forced: the engines Prisma selects
for each environment (`debian-openssl-1.1.x` on Hostinger,
`debian-openssl-3.0.x` in CI/sandbox) are correct as-is; only the
permissions were wrong.

## Deployment-log acceptance criteria

A new Hostinger deployment should establish, in its deployment details, build logs, and runtime logs:

1. the correct GitHub repository, `main` branch, and exact deployment commit SHA;
2. the Node.js app runtime is 22.x, npm is selected from `package-lock.json`, the root is the repository root, and the framework preset is `next`;
3. Hostinger's managed dependency installation uses npm and the deployment path is the Node.js Web App flow, not Composer;
4. the hPanel build script is `build` (`npm run build`) and the output directory is `.next`;
5. `.next/standalone/server.js`, `.next/static`, and the copied `public` assets exist in the successful build;
6. the required `npm start` command runs the production preflight before the standalone server; confirm from Runtime Logs that the selected Hostinger preset invokes npm lifecycle scripts or otherwise executes the preflight;
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
