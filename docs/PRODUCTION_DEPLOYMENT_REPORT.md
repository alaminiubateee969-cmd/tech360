# Production Deployment Report

**Status: NOT VERIFIED — do not call production complete.**
**Audit date:** 2026-10-03 · **Working branch:** `arena/01a0fde7-tech360`

## Repository-side target

The checked-in application targets Hostinger's **Node.js Web App** with framework preset `next`, Node.js 22.x, npm, the repository-root `package.json`, hPanel build script `build` (`npm run build`), output `.next`, and Prisma/MySQL. Hostinger's documented Next.js preset starts its bundled standalone server and ignores an entry-file field; the repository's `npm run start` is for CI/manual smoke tests, not an assumed hPanel command. Do not guess or hard-code Hostinger's port. The app version is `0.2.1`; `/api/health` reads the package version dynamically. GitHub Actions validates against disposable MySQL and is not a Hostinger deploy mechanism.

## Production evidence

- Hostinger hPanel app type, connected repository/branch/commit, Node selector, root, npm selection, Next.js preset/output/build settings, managed start behavior, actual port binding, protected environment variables, and runtime logs: **NOT VERIFIED**.
- Production MySQL host/version, connection, existing schema/migration history, and backup/restore: **NOT VERIFIED**. No production database command was run.
- Fresh 2026-10-03 probes resolved apex and `www` DNS, but HTTPS apex homepage, `/api/health`, and `www` each failed TLS (curl exit 35 / HTTP `000`); HTTP apex returned an empty reply (curl exit 52 / HTTP `000`). No HTTP status/body was obtained. TLS/domain attachment and all live routes: **NOT VERIFIED**.
- GitHub branch CI containing the updated Actions and standalone/start smoke test: **PENDING** until a post-push run is inspected.
- Local production build/start: **NOT VERIFIED**; Prisma engine download failed before the Next.js production build, so no local standalone server was produced.

The supplied Hostinger log identifies `main` at `70f249c8711bb5fb6213df7e53d2444db87eeff1` and then reports “Installing Composer dependencies” / “Publishing completed.” That is evidence of the wrong Composer-oriented job for that SHA, not of a Node.js, npm, Next.js, MySQL, or running application deployment.

## Required evidence to update this report

Record the verified GitHub source commit; Hostinger app configuration and successful Next.js build/runtime logs; MySQL connection/schema/backup/migration evidence; external HTTPS responses for the homepage, the `www`-to-apex redirect, `/api/health`, portal-login, protected SEO, and a built static asset; and a documented recovery/rollback plan. Do not run `npm run db:deploy` against an existing production database until its baseline state and backup are reviewed.
