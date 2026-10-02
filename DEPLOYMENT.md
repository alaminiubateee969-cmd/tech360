# Tech360 production deployment

**Status: PRODUCTION VERIFICATION REQUIRED.** The repository defines the Node.js deployment target; a GitHub CI result or a Hostinger “Publishing completed” message alone does not prove the web app is running.

## Intended production path

```text
GitHub repository (main)
  → GitHub Actions CI (application Node.js 22 + npm + disposable MySQL)
  → Hostinger Node.js Web App Git integration (only when connected/configured)
  → Hostinger-managed npm dependency install
  → npm run build
  → Hostinger Next.js preset starts the bundled standalone server
  → MySQL via Prisma
  → bdtech360.com over HTTPS
```

`npm run start` remains the repository's explicit standalone start script for CI/manual smoke tests. Hostinger's documented Next.js preset ignores a custom entry-file setting and starts its bundled server; the actual hPanel setting must still be checked.

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
| Entry/start behavior | Hostinger Next preset ignores the entry-file field and starts its bundled standalone server; `npm run start` is the repository's CI/manual smoke command, not a verified hPanel field. |
| Database | MySQL; `prisma/schema.prisma` has `provider = "mysql"` |
| Domain | `bdtech360.com` canonical; attach `www.bdtech360.com` with valid HTTPS and redirect it to the canonical apex |

Hostinger's official Next.js settings specify app type `next`, build script `build`, output directory `.next`, and no entry file (ignored for this framework). Hostinger says it builds Next in standalone mode and starts the bundled server. This repository sets `output: "standalone"`; `npm run build` generates Prisma Client, applies committed pending migrations with `prisma migrate deploy`, builds Next.js, and copies `.next/static` and `public` into `.next/standalone`. The existing `hostinger:build` npm alias delegates to this same `build` script; use the documented Next.js `build` preset field in hPanel, not Composer or a guessed entry file. `npm run start` is reserved for CI/manual smoke tests. Official docs also allow `/` or an empty root-directory value when `package.json` is at the repository root.

The actual Hostinger settings and selected root are **not confirmed**. Do not use `public_html` as the source root or evidence of a running Node app.

## Runtime, port, and variables

The application requires Node.js `>=22.0.0 <23`, and Hostinger's Node.js Web App supports selecting Node.js 22. Its documented `next` preset starts the bundled standalone server; `npm run start` also launches `.next/standalone/server.js` for CI/manual checks. Next standalone honors `PORT` when supplied, but Hostinger's public docs do not establish the port value or injection mechanism. Do not hard-code or guess a port; verify the actual binding from hPanel/runtime logs. The Hostinger runtime and port remain **NOT VERIFIED**.

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

The Hostinger deployment details should show the selected repository, `main`, the exact commit SHA, Node 22, npm, the Next.js preset, `.next` output, the build script, and a successful Next.js build—not only a clone or publish message. Hostinger's Next.js preset starts the bundled standalone server and ignores a custom entry-file field; confirm the actual start behavior from the deployment details/runtime logs instead of assuming an hPanel `npm run start` field. Reject Composer/PHP output as evidence for this application. Check the build output for `.next/standalone/server.js`, copied `.next/static` files, and `public` assets; then inspect Hostinger runtime logs for the Node process, port binding, and startup errors.

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
