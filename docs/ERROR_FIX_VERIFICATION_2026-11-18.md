# Error repair and verification — 2026-11-18 UTC

Branch: `arena/3aa75515-tech360`

Base: `d8c68f4f8ea983bc64559c51ed9045a726a6cb85` (merged PR #82)

The repairs below are local working-tree changes on this branch. They have not
been pushed, merged into `main`, or deployed. Passing local checks are not
production acceptance; external blockers remain in
[`KNOWN_ISSUES_AND_BLOCKERS.md`](../KNOWN_ISSUES_AND_BLOCKERS.md).

## What was actually wrong

### 1. Login did not handle database outages

`POST /api/auth/login` let exceptions from the user lookup, failed-attempt
update, or session creation escape to Next.js. An unavailable database therefore
produced an uncontrolled HTTP 500 rather than a useful, retryable response.

- Classify Prisma availability/connection-pool failures by `code` or
  `errorCode`, including initialization failures without a code.
- Return HTTP 503, `code: DATABASE_UNAVAILABLE`, `Retry-After: 30`, and
  `Cache-Control: no-store`; never issue authentication cookies on failure.
- Unexpected errors and explicit schema/configuration failures remain HTTP 500
  with safe JSON, not a falsely successful login or a falsely retryable outage.
- Do not echo exception messages, database URLs, passwords or stack traces into
  the response. The new handler logs only a fixed diagnostic code and does not
  attempt another database write to record an outage.
- CI's existing dead-MySQL production smoke now verifies the login response,
  retry header, absence of cookies and absence of credential/configuration data.

The initial 27-test regression set reproduced 18 failures before the outage
handler was added; all those cases now pass.

### 2. Missing MFA secret silently bypassed two-factor authentication

The old condition checked `twoFactorEnabled && twoFactorSecret`. An enabled
account with a null or empty secret skipped the entire second-factor branch and
received a password-only session. Both cases were reproduced as HTTP 200.

An enabled account now always enters the MFA branch. If its secret is missing,
sign-in returns HTTP 503 with `TOTP_UNAVAILABLE` and no session; the enrollment
must be repaired through authorized account recovery. Valid enrollment, second-
factor challenges, invalid-code rejection, disabled users and lockouts remain
covered. No accounts, flags or secrets were modified by this repair.

### 3. Two competing root lockfiles described different dependencies

The root `bun.lock` was stale while CI and production use npm. It still listed
removed dependencies and different package resolutions. It has been removed;
`package-lock.json` remains unchanged and is the sole root lockfile. Root Bun
lockfiles are ignored to avoid reintroducing package-manager ambiguity. Optional
Bun sidecars under `mini-services/` are unchanged and retain their own manifests.

The source-archive file list and setup documentation now follow that policy.
The generated archive README also uses the actual required `npm start` preflight
contract instead of claiming that it is only a manual smoke-test command.

### 4. The blocker register was reporting superseded CI failures as current

Updated the register to distinguish merged source repairs and passing main CI
from historical red runs and still-unverified production acceptance. Dependency
blocker B-013 is resolved **in source**, not a claim about production deployment.
Older dated audit reports remain historical evidence.

## Verification performed after the code changes

| Check | Result |
|---|---|
| Clean dependency installation | `npm ci --ignore-scripts --no-audit --no-fund` passed; Prisma generation performed separately |
| Full suite (`npm test`) | **1,939 passed; 0 failed, skipped, cancelled or todo**; disposable SQLite adapter generated from the production schema |
| New staff-login suite | **34 tests**, including outages at lookup/update/session creation, safe failures, MFA enrollment, lockout, rate limiting and successful login |
| ESLint (`npm run lint`) | Passed |
| TypeScript with regenerated **MySQL** Prisma client (`npm run typecheck`) | Passed |
| Prisma schema validation | Passed; provider remains MySQL |
| Full npm audit / production npm audit | Both passed with **0 vulnerabilities**; audit thresholds unchanged |
| Conflict-marker and industry/service asset checks | Passed; no missing referenced assets |
| Published migration immutability/order | All **20** published migrations unchanged and correctly ordered |
| Static schema map/drift checks | Passed: **107** models/tables, **1,504** columns, **295** indexes |
| Production compilation (`next build --webpack`) | Passed with MySQL client; no migration execution |
| Standalone asset copy/integrity | Passed; static and public trees match source |
| Actual `npm start` / standalone HTTP checks | **97 passed**, including all **83** unique sitemap routes, education, JS/CSS/public assets, protected APIs and canonical redirects |
| Real MySQL connection-refusal path | Built server returned safe login HTTP 503, retry header, no cookies and minimal unhealthy health response |
| Workflow syntax | Both YAML files parsed; **28 CI** and **13 baseline** shell steps passed `bash -n` |
| Source archive | Builder and its path/content exclusions passed; generated ZIP stays in ignored `archives/`, not Git or the web root |
| Patch whitespace (`git diff --check`) | Passed |

The HTTP harness used raw HTTP for explicit Host-header redirect assertions;
Node's `fetch` substituted the URL host when a Host header was supplied. No
application redirect change was necessary.

## Environment limits and safety

- There is no MySQL server or Docker executable in this sandbox. The full new
  local suite therefore used the repository's disposable SQLite adapter.
- Native Prisma engines for the pinned 6.19.3 engine commit were obtained from
  the same documented GitHub mirror used in previous audits. Compressed and
  decompressed SHA-256 checks were verified, and files were installed only in
  ignored `node_modules`. The normal Prisma binary host is outside sandbox
  egress; explicit local engine paths were used for MySQL client generation.
- Local production compilation and runtime smoke deliberately used a closed
  loopback MySQL port with dummy credentials. The resulting expected connection-
  refusal diagnostics do not mean the compilation failed. No production
  database was contacted, migrated, seeded, reset or modified.
- Successful MySQL migration/transaction/build evidence exists for the base
  commit on `main`: [full CI 44400326147](https://github.com/alaminiubateee969-cmd/tech360/actions/runs/44400326147)
  and [baseline 44400326179](https://github.com/alaminiubateee969-cmd/tech360/actions/runs/44400326179)
  both passed. Those historical runs do **not** certify these new branch edits.
  The updated branch must pass real-MySQL CI after publication and before merge.
- No branch protection, repository settings, production deployment or external
  provider configuration was changed. Live authenticated browser/provider and
  production database acceptance remain unverified.
