# Tech360 production deployment

**Status: PRODUCTION VERIFICATION REQUIRED.** The repository defines the Node.js deployment target; a GitHub CI result or a Hostinger “Publishing completed” message alone does not prove the web app is running.

## Intended production path

```text
GitHub repository (main)
  → GitHub Actions CI (application Node.js 22 + npm + disposable MySQL)
  → Hostinger Node.js Web App Git integration (only when connected/configured)
  → Hostinger-managed npm dependency install
  → npm run build
  → required runtime command `npm start` (preflight then standalone server; hPanel invocation must be verified)
  → MySQL via Prisma
  → bdtech360.com over HTTPS
```

The required repository start command is `npm start`; npm runs `prestart` to validate production configuration before launching `.next/standalone/server.js`. Hostinger's documented Next.js preset ignores a custom entry-file setting and manages its server start, so whether hPanel invokes npm lifecycle scripts (and therefore the preflight) is **NOT VERIFIED**. Confirm/configure that behavior in hPanel and runtime logs.

GitHub Actions validates changes and does not deploy. Hostinger's connected Node.js Web App Git integration can rebuild on pushes to its selected branch. The current Hostinger connection and production runtime have not been verified from this repository session.

## Hostinger target settings

| Setting | Required target |
|---|---|
| App type | **Node.js Web App**, framework preset `next` (not PHP, Composer, or generic file-copy Git) |
| Repository | `alaminiubateee969-cmd/tech360` |
| Branch | `main` |
| Application root | Repository root containing `package.json`; Hostinger documents `/` or blank for a root-level app |
| Node.js | `22` / `22.x` |
| Package manager | npm, auto-detected from committed `package-lock.json` |
| Dependency install | Hostinger-managed; its GitHub guide describes npm install. Verify the actual command in deployment logs; CI uses `npm ci`. |
| Build script | `npm run build` (hPanel Next build script is `build`) |
| Output directory | `.next` (Hostinger's documented Next.js server-mode setting) |
| Entry/start behavior | Required repository command is `npm start` (prestart validation, then standalone server); Hostinger Next preset's actual hPanel invocation is **NOT VERIFIED**. |
| Database | MySQL; `prisma/schema.prisma` has `provider = "mysql"` |
| Domain | `bdtech360.com` canonical; attach `www.bdtech360.com` with valid HTTPS and redirect it to the canonical apex |

Hostinger's documented Next.js settings specify app type `next`, build script `build`, output directory `.next`, and no entry file (ignored for this framework); its preset may manage the bundled-server start itself. This repository sets `output: "standalone"`; `npm run build` generates Prisma Client, applies committed pending migrations with `prisma migrate deploy`, builds Next.js, and copies `.next/static` and `public` into `.next/standalone`. The existing `hostinger:build` npm alias delegates to this same `build` script; use the documented Next.js `build` preset field in hPanel, not Composer or a guessed entry file. The required repository runtime command is `npm start` so its `prestart` environment validation runs before the standalone server. Whether Hostinger's selected preset invokes that npm lifecycle is **NOT VERIFIED**; confirm or configure it in hPanel before treating startup validation as active. Official docs also allow `/` or an empty root-directory value when `package.json` is at the repository root.

The actual Hostinger settings and selected root are **not confirmed**. Do not use `public_html` as the source root or evidence of a running Node app.

## Runtime, port, and variables

The application requires Node.js `>=22.0.0 <23`, and Hostinger's Node.js Web App supports selecting Node.js 22. The required repository start command is `npm start`, which runs the preflight and then launches `.next/standalone/server.js`; whether Hostinger's documented `next` preset invokes it is **NOT VERIFIED**. Next standalone honors `PORT` when supplied, but Hostinger's public docs do not establish the port value or injection mechanism. Do not hard-code or guess a port; verify actual start behavior and binding from hPanel/runtime logs. The Hostinger runtime and port remain **NOT VERIFIED**.

Set production environment values in **Hostinger → Node.js Web App → Environment Variables**, never in Git. See [`docs/HOSTINGER_ENVIRONMENT_VARIABLES.md`](docs/HOSTINGER_ENVIRONMENT_VARIABLES.md) for the source-derived manifest. Core configuration includes:

- `DATABASE_URL` — secret MySQL URL from the actual Hostinger database configuration;
- `NODE_ENV=production`;
- `APP_PUBLIC_URL=https://bdtech360.com` and `APP_ORIGIN=https://bdtech360.com`;
- unique `SESSION_SECRET`, `PORTAL_SECRET`, and `OPS_SECRET` values as required by enabled features;
- `ADMIN_EMAIL` and strong `ADMIN_PASSWORD` only for the initial Super Admin seed, then remove the temporary password.

Do not infer a database host from an SSH address or assume `localhost`; use the value shown in the Hostinger database connection details. Do not commit `.env` or real credentials.

## Prisma and production data safety

The production schema provider is MySQL. The CI workflow creates a disposable MySQL service, applies the checked-in migration baseline, checks schema drift, and runs the read-only database verifier. This is not a connection to production.

`npm run build` generates the Prisma client, applies committed pending migrations with forward-only `prisma migrate deploy`, builds Next.js, and prepares standalone static/public assets. The production build therefore requires the configured MySQL `DATABASE_URL`; do not trigger it against production until the database identity, existing migration/schema state, and a recoverable backup have been confirmed. `npm run db:verify` is read-only. Never reset production data, use `db push`, or use data-loss commands.

## Deployment evidence to require

The Hostinger deployment details should show the selected repository, `main`, the exact commit SHA, Node 22, npm, the Next.js preset, `.next` output, the build script, and a successful Next.js build—not only a clone or publish message. The required repository start command is `npm start`; confirm from hPanel/runtime logs that the selected preset invokes npm lifecycle scripts so `prestart` validation runs before the standalone server. Reject Composer/PHP output as evidence for this application. Check the build output for `.next/standalone/server.js`, copied `.next/static` files, and `public` assets; then inspect Hostinger runtime logs for the Node process, port binding, startup validation, and errors.

After a deployment, test from an external client:

```bash
curl -sS -D - https://bdtech360.com/ -o /dev/null
curl -sS -D - https://bdtech360.com/api/health
curl -sS -D - https://www.bdtech360.com/ -o /dev/null  # expect HTTPS redirect to canonical apex
curl -sS -D - -X POST -H 'content-type: application/json' \
  --data '{}' https://bdtech360.com/api/portal/login
curl -sS -D - -X POST -H 'content-type: application/json' \
  --data '{}' https://bdtech360.com/api/admin/seo/audit
```

For `/api/health`, require HTTP 200, `app: "tech360-platform"`, the version from `package.json`, and `checks.database.status: "UP"` with MySQL connected. A database failure must remain non-200. `/api/portal/login` should return its intended validation/auth response, not a server error. The SEO audit is a protected manager route; an unauthenticated refusal is expected and must not be called a successful authenticated audit. Also check `/_next/static/` assets and review runtime logs.

No live HTTP status or Hostinger runtime was verified during this audit. See [`docs/HOSTINGER_DEPLOYMENT.md`](docs/HOSTINGER_DEPLOYMENT.md) for the evidence record and operational checklist.

## Official Hostinger references

- [Creating a Node.js App](https://docs.hostinger.com/node.js/creating-an-app)
- [Next.js on Hostinger Node.js Web Apps](https://docs.hostinger.com/node.js/overview-1/next) — `next` preset, `.next` output, standalone start behavior, ignored entry-file field.
- [GitHub integration](https://docs.hostinger.com/node.js/github) — Hostinger-managed install/build/start on a connected branch and per-commit deployment logs.
- [Build Settings](https://docs.hostinger.com/node.js/build-settings)
- [Environment Variables](https://docs.hostinger.com/node.js/environment-variables)
- [Deployments and deployment logs](https://docs.hostinger.com/node.js/deployments)
