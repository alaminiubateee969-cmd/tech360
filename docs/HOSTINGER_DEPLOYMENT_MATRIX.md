# Tech360 deployment verification matrix

**Status: PRODUCTION VERIFICATION REQUIRED.** This matrix separates repository evidence from Hostinger/account state. It is not a production success certificate.

## GitHub/source snapshot

| Item | Verified value | Evidence/status |
|---|---|---|
| Repository | `alaminiubateee969-cmd/tech360` | `origin` URL and GitHub API |
| Session branch base at start | `c735e1798c91a780e4ebaf0498c77e834d56631d` | Confirmed before updates |
| Fresh `origin/main` | `70f249c8711bb5fb6213df7e53d2444db87eeff1` | Re-fetched from GitHub and confirmed by branch API on 2026-10-03 (local date); current GitHub truth |
| Changes on `main` since branch base | PR #8 merge, MySQL baseline + migration lock, dynamic health version, pinned Action SHAs, read-only baseline workflow permissions, updated deployment docs | Inspected commit/tree diff; session branch fast-forwarded to this exact commit with `git merge --ff-only origin/main` (no reset/rebase/force-push) |
| Application repair commit | `78801e811df56d8ca84f5776717b73e9fa94f8cf` on `arena/01a0fde7-tech360` | Pushed and CI-validated; not merged to `main` and not deployed. Subsequent report-only changes are tracked on the same session branch. |
| Branch protection / rulesets | **NOT VERIFIED** | GitHub API branch-protection request returned 403 (“Resource not accessible by integration”); rulesets API returned 403 (plan/access limitation) |
| PR #7 | Merged to `main` at `c735e1798c91a780e4ebaf0498c77e834d56631d` | GitHub PR API; merged 2026-10-02 |
| Hostinger-connected source/branch | Unknown | hPanel unavailable; must confirm repository and `main` in the Node.js Web App settings |

## Application version and runtime matrix

| Component | Repository requirement/value | Verification |
|---|---|---|
| Application version | `package.json`: `0.2.1` | Verified in package metadata and lockfile |
| Health API version | `package.json` version, imported programmatically | Code fix; verify after build and live response |
| Application Node.js | `>=22.0.0 <23` (Node.js 22.x) | Verified in `package.json`; Hostinger selector not inspected |
| Next.js | `16.3.8` resolved in `package-lock.json` | Verified; no framework upgrade made |
| Prisma / `@prisma/client` | `6.19.3` | Verified in package.json and npm/Bun lockfiles; validation and client generation passed in exact repair CI run 37061731570 |
| Database provider | MySQL (`provider = "mysql"`) | Verified in `prisma/schema.prisma`; production connection not verified |
| Package manager | npm; `package-lock.json` (lockfile v3) | Hostinger docs say manager is auto-detected from lockfiles; selected hPanel value not inspected; `bun.lock` is not the deployment lockfile |
| Build | Hostinger hPanel script `build` (`npm run build`; Prisma generate, forward-only `prisma migrate deploy`, Next build, standalone asset copy); `hostinger:build` delegates to the same script | Repository script and official `next` preset behavior verified; actual hPanel setting/logs not verified; production DB/migration state and backup are not verified |
| Output directory | `.next` for Hostinger framework preset `next` | Official Hostinger Next.js setting; actual hPanel value not inspected |
| Start behavior | Hostinger's Next.js preset starts the bundled standalone server; entry file is ignored. `npm run start` is the repository's CI/manual smoke script. | Official behavior documented; actual Hostinger process/logs **NOT VERIFIED** |
| Port | Next standalone honors `PORT` if present; no port is hard-coded | Hostinger's public docs warn about wrong-port binding but do not identify an injected port value; runtime binding is **NOT VERIFIED** and must be read from hPanel/runtime logs |

## GitHub Actions audit

The application runtime and the JavaScript runtime used to execute a GitHub Action are different settings. CI intentionally installs application Node.js 22; current first-party Actions execute on Node.js 24.

| Action | Before | Updated target | Action runtime / reason |
|---|---|---|---|
| `actions/checkout` | `v5` at the audit-start commit | Immutable SHA `3d3c42e5aac5ba805825da76410c181273ba90b1` (`v7.0.1`) | The currently fetched `main` pins the supported Node 24 release. `v5` already used Node 24, so it was not the Node 20 warning source. |
| `actions/setup-node` | `v4` in CI; absent from the baseline workflow at audit start | Immutable SHA `820762786026740c76f36085b0efc47a31fe5020` (`v7.0.0`); set `node-version: '22'` | Upstream v4 used Node 20; the pinned v7 release uses Node 24. The explicit input `22` remains the application/test runtime. |
| `actions/upload-artifact` | `v4` in the baseline workflow at audit start | Immutable SHA `043fb46d1a93c77aae656e7c1c64a875d1fc6a0a` (`v7.0.1`) | Upstream v4.6.2 metadata declared `using: node20`; the pinned v7 release uses Node 24. |
| Other/third-party actions, cache actions | None present in the two workflow files | None | All `uses:` references across both workflows were audited; no other action runtimes were found. |

Official upstream releases and immutable tag commits checked on 2026-10-02: `actions/checkout` v7.0.1 (`3d3c42e5aac5ba805825da76410c181273ba90b1`), `actions/setup-node` v7.0.0 (`820762786026740c76f36085b0efc47a31fe5020`), and `actions/upload-artifact` v7.0.1 (`043fb46d1a93c77aae656e7c1c64a875d1fc6a0a`). GitHub API tag-to-commit lookups matched all three SHAs. All three checked action metadata files declare the Node 24 Action runtime.

- [actions/checkout releases](https://github.com/actions/checkout/releases)
- [actions/setup-node releases](https://github.com/actions/setup-node/releases)
- [actions/upload-artifact releases](https://github.com/actions/upload-artifact/releases)
- [GitHub notice: Node 20 no longer available in Actions](https://github.blog/changelog/2026-09-23-node-20-is-no-longer-available-in-github-actions/)

The identified Node 20 Action references at audit start were `actions/setup-node@v4` and `actions/upload-artifact@v4` (`upload-artifact@v4.6.2` metadata declared `using: node20`). The current workflow references use immutable SHAs for the verified v7 releases, whose metadata declares Node 24. Repair run 37061731570 passed; the GitHub check reports no annotations. However, downloading the raw Actions log returned EOF, so the specific Node 20 warning status remains **NOT VERIFIED** from that run's log.

## CI and MySQL

| Gate | Current evidence |
|---|---|
| Existing CI on pre-repair main `c735e17` | Run `37041699125` reported success and all listed job steps completed; its raw log download was unavailable in this sandbox, so it is not evidence of the new action versions or warning status |
| Fresh `origin/main` run `37050663450` on `70f249c` | npm install, Prisma validate/generate, disposable MySQL, baseline deploy, zero-drift check, and lint passed; Typecheck failed with a GitHub annotation: `Cannot find module '../../../../../package.json'` in the health route (one `../` too many). Tests, `db:verify`, and build were skipped. This repair uses the correct four-level import; the raw log download returned EOF, but API step statuses/annotation were readable. |
| Post-repair branch CI | **PASS** — run [37061731570](https://github.com/alaminiubateee969-cmd/tech360/actions/runs/37061731570) on `78801e811df56d8ca84f5776717b73e9fa94f8cf`; npm audits/install, Prisma validate/generate, MySQL migration + zero drift, lint, typecheck, tests, read-only DB verification, production build, standalone output, and production-start smoke all passed. Raw log download returned EOF, so the specific Node 20 warning status remains **NOT VERIFIED**. |
| MySQL baseline workflow | **PASS** — run [37061731386](https://github.com/alaminiubateee969-cmd/tech360/actions/runs/37061731386) on the repair commit |
| CI database image | Workflow specifies `mysql:8.0`; exact server minor is **NOT VERIFIED** because the repair-run raw log download returned EOF |
| Production `DATABASE_URL` / connection | Not present in repository and not available from Hostinger; **NOT VERIFIED** |
| Production migration state / backup | Not available; **NOT VERIFIED**. Do not run `npm run db:deploy` blindly |

## Hostinger and domain

| Layer | Required target | Evidence/status |
|---|---|---|
| Deployment type | Hostinger Node.js Web App | **NOT VERIFIED** in hPanel |
| Runtime | Node.js 22.x | Required by code; Hostinger setting **NOT VERIFIED** |
| Package manager/build/start | npm, hPanel build script `build` (`npm run build`), Hostinger-managed Next.js standalone start | Recommended from official Hostinger docs; actual hPanel settings/logs **NOT VERIFIED**. `npm run start` is repository CI/manual smoke only. |
| Root directory | Repository root containing `package.json` (Hostinger documents blank or `/` for root apps) | Target only; hPanel value **NOT VERIFIED** |
| Domain and canonical redirect | `bdtech360.com` canonical; `www.bdtech360.com` valid HTTPS, redirecting to apex | Hostinger attachment, TLS, and redirect **NOT VERIFIED** |
| Environment variables | Set in the Node.js Web App environment panel | Values intentionally not available here; **NOT VERIFIED** |
| Last supplied Hostinger log | Cloned `main` at `70f249c8711bb5fb6213df7e53d2444db87eeff1`; then “Installing Composer dependencies” / “Publishing completed” | Proves that logged job used Composer for the current main SHA; not evidence of npm, Next.js build, Node startup, or MySQL |
| DNS lookup | Host records resolved during this audit | DNS resolution only; does not prove domain attachment/routing |
| HTTPS and routes | Fresh 2026-10-03 probes: apex and `www` DNS resolve; HTTPS homepage, `/api/health`, and `www` fail TLS (curl exit 35 / HTTP `000`); HTTP apex returns empty reply (exit 52 / HTTP `000`) | No application body/status; TLS, domain routing, and all routes **NOT VERIFIED** |

Required production routes after configuration: `/`, `/api/health`, `POST /api/portal/login`, protected `POST /api/admin/seo/audit`, and a built `/_next/static/` asset. See [`HOSTINGER_DEPLOYMENT.md`](./HOSTINGER_DEPLOYMENT.md) for the runbook.

## Security/file audit

| Item | Finding |
|---|---|
| Tracked `.env` | None; only `.env.example` is tracked |
| Tracked private keys / common high-risk secret patterns | No matching file/pattern found in the tracked-file scan performed during this audit; CI secret scan remains a separate check |
| `db/custom.db` | Not tracked and not present in this checkout; ignored by `.gitignore` |
| `upload/` | Not tracked and not present in this checkout; ignored by `.gitignore` |
| `public/downloads/tech360-platform-full-source.zip` | Not tracked and not present in this checkout; `public/downloads/` is ignored |
| Public source archive | No archive was found in the tracked tree or this checkout. Hostinger filesystem/public object storage was not inspected, so external copies remain **NOT VERIFIED** |

## Hostinger configuration references

Hostinger's current Node.js Web App settings and deployment logs are documented at:

- [Creating a Node.js App](https://docs.hostinger.com/node.js/creating-an-app)
- [Build Settings](https://docs.hostinger.com/node.js/build-settings)
- [Environment Variables](https://docs.hostinger.com/node.js/environment-variables)
- [Deployments](https://docs.hostinger.com/node.js/deployments)
