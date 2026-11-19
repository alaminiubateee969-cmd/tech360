# TECH360 — repository-wide audit and safe-hardening evidence

Audit start/directory label: **2026-11-18 UTC**. Individual execution artifacts keep
their actual timestamps; the browser report records `2026-11-19T03:46:22.631Z`.
Repository: `alaminiubateee969-cmd/tech360`.
Authorized branch: `arena/3aa75515-tech360`.
Unchanged base/HEAD: `d8c68f4f8ea983bc64559c51ed9045a726a6cb85`.

This is a measured **working-tree checkpoint**, not an assertion that all code,
buttons, devices, business policies or production services have been certified.
No publication or deployment is authorized by this document.

## A. Executive result

The latest complete local suite passes **2,100 tests in 418 suites**, with zero
failures, cancellations, skips or todo. Fresh ESLint, production-MySQL-client
TypeScript, Prisma validation, static schema/migration and asset checks pass.
A migration-free MySQL-provider build produced 97 pages, and its actual standalone
server passed **97 HTTP checks**, including all 83 sitemap routes and controlled
login failure when MySQL is deliberately unreachable.

The final compiled-app browser run passes **all 13 named functional checks** and
**five of six automated accessibility surfaces**: **18 PASS / 1 FAIL overall**.
The remaining mobile ChatWidget surface fails two rules: text contrast and
keyboard-focusable scrolling. Its source remains untouched under the standing
separate-change-plan restriction. Functional chat persistence, attachment privacy,
live operator reply, replay idempotency and private notes pass in the isolated
fixture; that does not waive the accessibility findings.

Substantive repairs cover fail-closed auth/provider policy, CRM/approval privacy,
workflow callback ordering, task evidence integrity, verified closure gates,
CSRF-aware board requests, conversation tenant scoping and measured frontend
accessibility/contract defects. Open lifecycle/log/activation/policy questions,
new-source MySQL/concurrency and real integration/restore/load acceptance prevent
release certification. **A structural census and a green suite are not an
exhaustive semantic/security audit.**

## B. Authority, preservation and method

### Safety boundaries actually maintained

- Worked only on the authorized branch, with HEAD unchanged. Nothing was staged,
  committed, pushed, merged or deployed. No other branch was checked out or used
  as a repair source. The frozen branch was not modified.
- No production database read/write, migration, reset, push, seed, restore,
  account repair, credential rotation, DNS/hosting change or unsolicited message.
- No real model/provider/n8n requests or paid fallback acceptance. Networked tests
  use synthetic keys, intercepted fetches or approved local fixture servers.
- Existing private browser fixture files remain 0600, are ignored, and were not
  printed, deleted or reseeded. Added approval fixtures remain PENDING; no real
  governance decision/execution/send was made.
- ChatWidget itself is byte-identical to HEAD. No global CSS workaround was used
  to bypass its edit restriction.

### Preservation and reproducibility

`archives/audit-checkpoints/20261118T215124Z/` preserves the original eight tracked
changes and three untracked/deleted paths, plus incremental pre-edit source,
test, tooling and report snapshots. See [checkpoint verification](checkpoint-verification.json)
for manifest/hash results. Checkpoints are local ignored artifacts, not deployed
source or a replacement for an owner backup. They include overlapping states;
counts are not unique repaired-file counts.

The inventory tool reads every tracked/non-ignored working file **outside its own
output directory**, hashes it, parses JS/TS with installed TypeScript and records
imports, consumers, exported API methods, DB/security/validation/external-call
signals, role literals, ownership field names and direct test references. It does
not run application modules, connect to databases, send requests or write Git.

Selected route/service chains were then read semantically, exercised with genuine
disposable database/session/CSRF behavior, tested before and after repairs, and
checked through the compiled application. Pure policy/intercepted-provider/static
contract tests are labelled as such. No line/branch/mutation coverage percentage
was measured or invented. Legacy/reference trees were inventoried, not declared
safe to delete because of missing imports.

## C. Measured inventory and architecture

The [per-file census](repository-inventory.json) is the source of structural
counts. Its own directory, ignored dependencies/build output, local databases,
checkpoints and `.git` internals are intentionally excluded.

| Structural measurement | Count / result |
|---|---:|
| Selected repository files read / hashed | 1,808 |
| Text files / binary asset entries | 1,558 / 250 |
| Active `src` JS/TS files | 749 |
| API route files / exported HTTP methods | 279 / 359 |
| Prisma models / published migrations | 107 / 20 |
| Standard `tests/**/*.test.ts` files | 159 |
| Nonstandard test scripts | 5 |
| Unresolved active local imports / active parser syntax errors | 0 / 0 |
| Active files with a direct test source/import reference | 296 of 749 |
| API route files with a direct test source/import reference | 75 of 279 |

**Direct reference is not coverage**: a source-text assertion or imported helper
can count, and indirect runtime tests may not. Neither ratio establishes tested
statements, complete authorization or every-method behavioral acceptance.

Current canonical roles: `SUPER_ADMIN`, `ADMIN`, `FINANCE`, `PROJECT_MANAGER`,
`MANAGER`, `DEVELOPER`, `SALES`, `SUPPORT`, `MARKETING`, `DESIGNER`, `AUDITOR`,
`STAFF`. Invalid policy/user roles now deny rather than becoming rank zero.
Numeric hierarchy is not a substitute for action-specific capabilities.

The active application is Next.js App Router + React/TypeScript, npm, Prisma
MySQL, public marketing/portal/admin surfaces, server-side services/policies and
API handlers, durable job/automation stores, WebChat, a separate private-model
router and optional integrations. Reusable public client routing lives in
`PublicSiteApp.tsx`, not an invalidly reused framework page export. The old root
implementation was compared with the extraction: only the component name and two
public consent-control contrast classes changed; navigation/consent logic was not
dropped. Native SQLite is disposable test/browser tooling, not production storage.

## D. Baseline and defect evidence

PRs #79–#82 and their earlier repairs are already integrated into the base.
Historical full MySQL CI [44400326147](https://github.com/alaminiubateee969-cmd/tech360/actions/runs/44400326147)
and baseline [44400326179](https://github.com/alaminiubateee969-cmd/tech360/actions/runs/44400326179)
passed at the base SHA. These are **not** results for the uncommitted repairs.
No duplicate merge or publication was performed.

The starting preserved repair checkpoint passed 1,939 local tests. Later full
milestones of 1,973 / 2,026 / 2,046 / 2,084 are historical overlapping runs, not
extra independent coverage. Latest: **2,100 / 418**.

Examples of genuine executed red-to-green evidence:

- Initial login outage regressions failed 18 of 27; enabled MFA with missing
  enrollment secret separately issued an improper password-only session. The
  expanded 34-case login suite now passes, and a real closed-port MySQL login
  smoke returns safe retryable 503 without session cookies.
- Network/chat/private-model focused tests reproduced 38 failures before repairs;
  model evidence tooling reproduced eight more. Focused combined milestones
  passed, followed by the full suite. No real inference is implied.
- Corrected initial CRM boundary reproduction failed 20/20 with real sessions/DB;
  an early invalid experimental setup was not counted as product evidence.
  Approval expansion later had 10 pass / 11 fail of 21; tenant-sibling regression
  had 21 pass / 1 fail of 22. Current 22-case CRM suite passes.
- Initial lifecycle/task-integrity 11-case reproduction failed all 11; later
  unrelated-RUNNING-log test failed one of 16. The current expanded 19-case suite
  covers authorization/client binding, whole-entry evidence, refund and closure
  gates. Combined preview/journey/isolation reproduction had 21 pass / 6 fail of
  27 before its fixes; focused 54/3 then passed.
- Four public-home regressions failed before contract/video/control repairs.
  Separate public-review parser tests cover nulls and malformed data.
- Settled console axe diagnostic showed eight low-contrast nodes and one
  unfocusable scroll region. After targeted source changes, the actual rebuilt
  dashboard and PM approval history scans have zero violations, and keyboard
  activity focus/scroll works. Static accessibility contracts are supplementary,
  not a substitute for those browser checks.

See [issue register](ISSUES_AND_PLAN.md) for AUTH-001/002, BUILD-001 and AUD-001–027,
exact paths/root causes, repairs and unrepaired issues. Group counts are not
security-vulnerability counts or CVSS scores.

## E. Repairs and preserved behavior

| Area | Verified repair scope | Important limit |
|---|---|---|
| Login/MFA | Safe unavailable-DB response; unexpected failures remain 500; enabled-but-missing MFA secret cannot issue a session | No production account was inspected or modified |
| Authorization/provider policy | Canonical known-role checks; action capabilities; global explicit/disabled agent provider cannot be overridden by saved model prefix | Full API/capability/record ownership review is unfinished |
| Private model | Default local-only order, explicit remote opt-in, no redirect/empty-content success, consistent finite embedding batches, correct Ollama options | Synthetic/intercepted responses are not weight/inference/quality acceptance |
| Evidence tools | Actual manifest/blob/byte verification, read-only behavior, streamed first-content timing and null unmeasured RSS | No automatic promotion, quality score or host sizing certification |
| CRM/projects | Role-aware finance/private-workforce projections and restricted/null UI states | Not proof that every document/free-text/derived financial channel is classified |
| Approvals | DB allowlist/filter/select, unknown/private kinds excluded for operational roles; status-only label and explicit ALL history | Decision/execution governance beyond named existing tests not newly live-accepted |
| n8n/automation | Terminal callback monotonicity, outbound ACK/callback reconciliation, retry/accounting and idempotent durable resume | Real n8n/server/multi-process MySQL/load behavior not exercised |
| Task evidence | Preserve entire entries/legacy raw content within a 60,000 UTF-8-byte budget; 413/no mutation or CAS conflict; worker capacity warning durably audited | Broader step-log truncation and multi-writer lifecycle atomicity remain open |
| Project closure | Verified same-currency payments minus settled refunds; tasks/delivery/source acceptance; board serializable CAS/closedAt | Journey's entire multi-write closure path is not atomic or MySQL-concurrency certified |
| WebChat | Ordered keyset deltas, real SSE event cursor/cancel cleanup, tenant-scoped linked siblings | Widget source unchanged; broader reconnect/load/manual device matrix not complete |
| Public/console frontend | Honest nullable review parsing/availability, real hero asset, CSRF board helpers, public and sampled console contrast, keyboard activity region | Only named rendered/axe surfaces accepted; not every admin panel or device |
| Build/docs | npm root lock only, preserved sidecars, safer test datasource guard, source-backed deployment procedure and historical-report notices | `npm run build` still intentionally includes migration operations; do not run it blindly |

All exact modified/new/deleted paths and their rationale are in
[CHANGED_FILES.md](CHANGED_FILES.md) and its JSON companion. Deleting the already
removed stale root Bun lockfile is not deletion of an application feature.

## F. Backend, database, security and workflow coverage

| Module / boundary | Executed local evidence | Not established |
|---|---|---|
| Auth, CSRF, role policy | Standard regressions; real compiled login/HttpOnly cookie; role HTTP probes; dead-DB refusal | Full production session/MFA/device/recovery acceptance |
| CRM/project/approval composites | Real guard/session/DB regressions; PM approval UI and STAFF/PM/DEVELOPER/SALES authenticated HTTP projections | Every role on every action, arbitrary tenant/client linkage and all free-text disclosures |
| Lifecycle/payment/refund/source gates | Real persisted unverified/foreign-currency/refunded evidence cases; genuine gated completion succeeds | Payment provider/refund settlement delivery, activation legacy paths, all concurrency/rollback faults |
| Task jobs/retries/evidence | Capacity/legacy/conflict/worker persistence regressions; existing queue/approval tests in the full suite | Sustained worker lease/failover/load and MySQL transaction interleavings |
| Scope/preview/delivery/handover | Existing policy/DB suites plus closure denial/success evidence | Complete new browser first-contact-to-source-release journey with real channels/providers |
| WebChat and attachments | 650-row/637-visible-message DB pagination; stream tests; real synthetic upload/download, replay and note privacy; tenant sibling regression | Malicious corpus/scanner service, every MIME/size/storage/tenant combination, sustained multi-tab/reconnect load |
| Network admission | Protected IPv4/mapped/expanded IPv6, DNS/fetch and target policy tests | A comprehensive internet/private-network penetration test or every SSRF sink |
| Webhooks/integrations | Existing signature/replay/idempotency regressions and injected n8n callback order faults | Actual provider deliveries/HMAC configuration, production replay/load and secret lifecycle |
| Database/schema | Prisma valid; 107-model/table static map, 1,504 columns, 295 indexes; 20 migrations immutable and ordered | Successful current-source MySQL CRUD/migration/seed/concurrency/restore; no server available locally |
| Knowledge/memory/workforce | Private route/composite boundaries and provider/registry/service tests | Real ingestion/scanning/embedding/RAG quality, actual model weights/worker capacity |
| Reporting/content/media/education/Factory/REA | Structural inventory and existing standard suites; education/public HTTP route smoke | Exhaustive generated artifact correctness, live publishing/rendering/research/mobile/service acceptance |

No broad destructive cleanup, unknown-field migration, guessed production
connection, audit-history rewrite or fictional sent/paid/delivered record was used
to make a check pass. Existing legacy/reference assets remain preserved.

## G. Executed browser and accessibility results

Authoritative final result: [browser-verification.json](browser-verification.json).
The harness used Chromium/Playwright with axe against a **compiled source-MySQL
build**, then an intentionally isolated native SQLite runtime using the existing
synthetic fixture. Preview adapter unset, external/AI credentials absent,
operations driver off, cross-origin browser requests blocked. It is not a MySQL
runtime, Hostinger, provider or load test.

Functional checks actually passed:

1. Desktop H1/layout, real hero video and public reviews response.
2. Real labelled anonymous admin sign-in page.
3. Synthetic Super Admin signs in via form; HttpOnly session; named activity
   region receives keyboard focus and scrolls with End when overflow exists.
4. Contactless mobile chat starts without exporting contact channels and retains
   its second message through reload, with AI honestly disabled.
5. A real 59-byte text attachment downloads in the owning chat; unsigned access
   gets 401.
6. One live operator reply, identical replay without duplicate message, internal
   note absent from visitor data after reload.
7. Portal route renders its own labelled Client ID/contact fields (not OTP proof).
8–11. STAFF, PROJECT_MANAGER, DEVELOPER and SALES authenticated HTTP boundaries.
12. PM pending operational approval card/status-only label, private payload and
   financial/workforce rows omitted, no Approve/Reject controls, ALL history URL.
13. Nine public paths render and finish loading sampled local images. This is
   **not** a full browser visit to all 83 sitemap URLs.

| Automated WCAG 2.1 AA surface | Outcome |
|---|---|
| Desktop homepage including consent banner | 0 measured violations |
| Anonymous admin login | 0 measured violations |
| Settled synthetic Super Admin dashboard | 0 measured violations |
| Anonymous portal sign-in | 0 measured violations |
| PM status-only approval history | 0 measured violations |
| Mobile active chat after reload | **FAIL:** `color-contrast`, `scrollable-region-focusable` |

Final report: 0 page errors, 0 failed same-origin requests and 0 blocked
checks from environment/dependency failures. The overall browser command correctly
exits **1**. Automated axe results do not provide WCAG certification or replace
screen-reader/manual keyboard/zoom/reduced-motion acceptance.

Historical attempts remain separately named, not overwritten as passes. Early dev
runs were incomplete after a kernel-confirmed OOM kill (one Next worker ~2.54 GB
anonymous RSS). Later connection refusals were environment effects. A refresh
button's transition contrast false positive disappeared when measured after
settlement. A subsequent consent-banner hydration count/click race was fixed in
the **harness**, not consent code; final nine-route sweep passes. No swallowed
undefined assertion remains in the executed keyboard test.

Widget repair plan (requires the separately approved change): darken measured
small light-surface message/privacy metadata to AA, name/focus the scroll log and
show focus; do not alter its session/message/upload/reconnect logic. Rerun the
same functional, keyboard and axe matrix after any authorized change.

## H. Dependencies, runtime and deployment truth

- Node 22/npm; Next and eslint-config-next 16.4.6; Prisma/client 6.19.3. Root
  `package.json`, `package-lock.json`, source schema and all published migrations
  remain byte-identical to HEAD.
- An earlier ordinary clean `npm ci` installed 863 packages and left the lockfile
  unchanged. Latest full/production audits each report **zero vulnerabilities**.
  `npm ls --all` exits 0 but reports one extraneous `@emnapi/runtime@1.11.3`, also
  reproduced in the earlier clean install: do not call the tree warning-free.
  `picomatch@4.0.7` is dev-only; the earlier advisory was withdrawn. No forced or
  blind dependency upgrade was used.
- Native pinned Prisma engines live only in ignored tooling/dependencies and
  were checksum-verified when obtained through the previously documented GitHub
  mirror. Their use does not change the production provider or engine version.
- The root generated client was restored to **MySQL** after SQLite tests/browser
  checks, then freshly typechecked/validated. Bundled standalone client is also
  MySQL. No audit application server remains running.
- **Do not run `npm run build` blindly:** its lifecycle reconciles and deploys
  migrations. The audit used generation/direct `next build --webpack`/asset copy
  only against a dummy, deliberately closed loopback MySQL port. Expected static
  DB lookup warnings are retained; dynamic content completeness is unverified.
- No local mysqld, Docker or uv is available. Python build regression exits 1 for
  missing uv; container/runtime smoke and current-source real-MySQL/seed tests
  are not locally accepted. Existing tests were not skipped to manufacture a
  zero-skip suite; these separate commands are tracked explicitly.
- The [deployment guide](../../deployment/DEPLOYMENT_GUIDE.md) now distinguishes
  owner approval from instructions; exact commands from nonexistent npm aliases;
  weight hashes from manifest names; host free memory from model RSS; heuristic
  probes from quality/promotion; and public health from authenticated diagnostics.
  Unauthenticated deep health must return 401, **not** 200.

## I. Validation record and repeatability

[validation-results.json](validation-results.json) records exact commands/modes,
counts, log digests and non-executed gates. Core latest results:

| Gate | Result / limit |
|---|---|
| Full standard suite, fresh disposable SQLite | 2,100 / 418 pass; 0 fail/cancel/skip/todo |
| Fresh lint / restored MySQL-client typecheck | Pass / pass |
| Prisma generation/validate; static schema/map/drift/immutability | Pass; no DB migration command |
| Full / production npm audit | 0 / 0 vulnerabilities |
| Industry/service assets, conflict markers | Pass; conflict scan itself covers tracked files only |
| Disposable database-build / retired deployment scripts | Pass / pass |
| CI YAML and embedded shell syntax | Static validation, not GitHub Actions execution |
| Production-provider direct build / standalone assets | Pass; 97 pages |
| Real bundled-MySQL standalone HTTP | 97 checks pass, including 83 sitemap paths and real unavailable-DB login |
| Compiled native-SQLite browser | 18 pass / 1 fail, with scope above |
| Python build / container check | Missing uv / absent Docker; not passed |
| New-source disposable MySQL / seed safety / provider / recovery / load | Not executed or not verified |

DB-mutating tests belong only in a disposable checkout/database. The hardened
root test runner refuses production mode, remote/non-test MySQL targets, routing
overrides and mixed MySQL/preview configuration before child setup. Running an
individual DB test directly can bypass the wrapper; never point it at live data.
See the guide rather than copying a test/build command into the live checkout.

Portable unit/DB regressions are in `tests/`; browser/safe-build tooling is local
under the ignored checkpoint `browser-tools/` and has not been made a new CI
requirement. Browser fixtures and engine binaries are deliberately not packaged
as production source. Local temporary log paths in the JSON record are evidence
locations, not a promise those `/tmp` files survive a new sandbox.

## J. Open work and release gates

The [issue register](ISSUES_AND_PLAN.md#remaining-work--not-marked-repaired) gives
OPEN-001–009 and concrete next actions. Important unresolved source-observed
patterns are **not** silently called repaired:

- Journey/retry step arrays still slice serialized JSON at 12,000 characters.
  They need real boundary/legacy/concurrency regressions and whole-entry storage.
- Journey/state/audit/communication multi-write atomicity and swallowed failures
  need fault/rollback and MySQL concurrency tests; a board transaction is narrower.
- Project activation currently counts PAID labels; unverified/foreign-currency
  legacy behavior and the approved deposit evidence gate need reproduction.
- Historical create/import/bulk/manual stage labels need owner-approved correction
  policy and consumer review; a mutable stage must not stand in for payment or
  approval evidence. This audit did not remove import features or rewrite records.
- Full record/tenant ownership, indirect leak channels, every-route/method and
  every UI/device acceptance remain incomplete.

External owner gates: approval to publish the reviewed current source; exact-source
disposable MySQL CI/migration/seed/concurrency; authorized real n8n/providers and
payment/refund/OTP deliveries; private model byte/revision and human quality/RSS
measurements; Hostinger startup/environment/release identity; isolated backup
restore/RPO/RTO; load/failover/alerts and manual accessibility/device acceptance.
Missing access is a limit, not an application pass or permission to change systems.

Older report/parity checkmarks are explicitly historical. Source availability,
logical catalogue sizes, configured keys, HTTP liveness, an older CI SHA or a
user-supplied deployment timestamp do not prove current live execution.

## K. Handoff, deliverables and readiness

- Main report: this document.
- Repaired/open issue matrix: [ISSUES_AND_PLAN.md](ISSUES_AND_PLAN.md).
- Exact changed paths/rationale: [CHANGED_FILES.md](CHANGED_FILES.md) and
  [changed-files.json](changed-files.json).
- Structural file/API/import/consumer/test census:
  [repository-inventory.json](repository-inventory.json).
- Executed verification and preservation:
  [validation-results.json](validation-results.json),
  [checkpoint-verification.json](checkpoint-verification.json), and
  [browser-verification.json](browser-verification.json); named earlier browser
  reports are historical, not current failures or current passes.
- Refreshed source-only ZIP: `archives/tech360-platform-full-source.zip`, ignored
  and never placed under `public/`. It is a source snapshot, **not a deployable
  release**, an owner-data backup or release authorization. Its external metadata
  stays in `archives/archive-meta.json`. Exclusion checks do not replace a human
  sensitive-content review of existing historical documentation before sharing.
- Current entrypoints: root README, QA/blocker/reference/master notices,
  deployment guide and appended worklog. Earlier dated reports remain preserved.

**Readiness: NOT READY.** Local hardening is substantially improved and measured;
the full semantic audit and named code/browser/external acceptance gates remain
open. Nothing has been published or deployed, and no production-readiness
certification is given.
