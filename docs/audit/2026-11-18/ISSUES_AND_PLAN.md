# Repository audit — issue register, repairs and remaining work

Audit directory/start label: 2026-11-18 UTC. Authorized branch:
`arena/3aa75515-tech360`; base/HEAD
`d8c68f4f8ea983bc64559c51ed9045a726a6cb85`.
Tool artifacts retain their actual UTC timestamps. This register supersedes the
initial candidate-only plan; it does **not** claim the repository-wide semantic
or production audit is complete. See [A–K report](REPOSITORY_AUDIT.md),
[structural census](repository-inventory.json), [validation](validation-results.json)
and [changed files](CHANGED_FILES.md).

## Preservation and evidence rules

- Original 8 tracked changes and 3 untracked paths were checkpointed before the
  expanded audit. Incremental source/test/report checkpoints preserve later
  pre-edit states under `archives/audit-checkpoints/20261118T215124Z/`.
  The archive, browser dependencies, fixtures and native engines are ignored,
  not production application inputs. Hash verification is recorded separately.
- All work stays on the authorized branch. No staging, commit, push, PR, merge,
  deployment, DNS change, credential rotation or production DB write occurred.
  The frozen branch was not checked out, modified or used as a repair source.
- Regression failures below are actual executed pre-fix evidence unless labelled
  static/documentary. A tool/setup failure is not an application regression.
  Combined suites overlap; do **not** add their counts together as coverage.
- Synthetic sessions/clients/chats/approvals use isolated local databases. The
  existing 0600 browser credential fixture was neither printed nor recreated.
  No external message, paid fallback, real model request or production test row
  was used. ChatWidget is unchanged.

## Repaired issues

Severity is contextual, not a CVSS score. A group can contain several related
failure modes; its case count is not a vulnerability count.

| ID | Severity | Paths / root cause | Repair and meaningful evidence |
|---|---|---|---|
| AUTH-001 | Medium / availability | `src/app/api/auth/login/route.ts`; new `src/lib/database-errors.ts`: DB exceptions escaped the sign-in response boundary | Retryable safe JSON 503/Retry-After/no-store/no cookies for recognized outages; other failures stay safe 500. 34 login regressions and an actual dead-MySQL standalone request pass. |
| AUTH-002 | High | Same login route: enabled MFA with missing secret fell through to password-only session issuance | Fail closed with `TOTP_UNAVAILABLE`; valid MFA/lockout/rate-limit behavior retained. Real pre-fix failure and the login matrix cover the case. |
| BUILD-001 | Medium | Root stale `bun.lock` disagreed with npm/CI; ambiguous archive/startup guidance | Pre-existing deletion retained; root Bun locks ignored; npm lock unchanged. Archive inputs/start instructions corrected; optional sidecars not replaced. |
| AUD-001 | Medium / latent authorization | `src/lib/access-policy.ts`: an unknown minimum role defaulted to rank zero | Validate both roles against the canonical role set. Known/unknown/prototype-key role regressions pass; no active invalid-literal caller was invented. |
| AUD-002 | High / privacy/cost | `agents/provider-selection.ts`, startup validator: explicit missing/invalid provider selected another configured provider | Explicit choices fail closed; automatic selection remains supported. Synthetic configured-key tests prove no paid/private-data fallback from an explicit choice. |
| AUD-003 | Medium / reporting | Same selector: disabled AI could be reported as configured because diagnostics fell through | Disabled/unconfigured states align with actual selection; no configured/healthy inference claim from a key's presence. |
| AUD-004 (formerly CAND-004) | High | `agents/engine.ts`: stored agent model prefixes could override global disabled/explicit provider policy | Central provider selection governs model hints. Real disposable-DB/intercepted-fetch engine regressions; no real provider sends. |
| AUD-005 (formerly CAND-005) | High / workflow integrity | `n8n/adapter.ts`, `automation/actions.ts`, `automation/engine.ts`: outbound ACK writes and workflow waiting state raced early callbacks/lost acknowledgements | Transactional, idempotent/monotonic external execution reconciliation and durable callback resume. Tests inject callbacks around real DB writes and outbound-response ordering. MySQL multi-process behavior still needs acceptance. |
| AUD-006 (formerly CAND-006) | High / test safety | `scripts/test.mjs`: any MySQL URL could reach DB-mutating suites | Refuse production/non-disposable/remote/mixed-preview URLs before child setup/spawn. Real runner is probed with intercepted children and synthetic URLs; no production connection is made. |
| AUD-007 | High / network boundary | `network-address.ts`, `safe-fetch.ts`, `rea/target-policy.ts`: special/mapped IPv6, CGNAT and other protected address forms were incompletely classified | Shared protected-address validation and hardened fetch/target policy. 38 network/chat/model pre-fix failures led to focused repairs; synthetic/intercepted tests are not a real private-network exploit or DNS/load acceptance. |
| AUD-008 | Medium / persistence | `webchat/thread.ts`: bounded retrieval/count filters could omit or reorder visible messages | Ordered keyset history with visitor/operator visibility maintained. Real disposable fixture exercises 650 rows / 637 visible messages. Browser reload and durable message checks now pass. |
| AUD-009 | Medium / reliability | Visitor/operator SSE routes and shared thread helper: cursor, cancellation and response-header handling | Cursor validation, cancellation/reader cleanup and SSE header contract repaired. Focused stream tests plus live-browser operator reply and reload acceptance pass. Broad multi-client reconnect/load remains unverified. |
| AUD-010 | High/Medium / model boundary | `model/providers/{ollama,openai-compatible}.ts`, `model/response-validation.ts`: empty/malformed replies, redirect and embedding-shape inconsistencies | Reject invalid output/redirects, validate finite consistent vectors and avoid fictional successful responses. Local intercepted provider regressions, not actual inference. |
| AUD-011 | Medium / truthful model operation | Same providers/router: request options and first-content/total timing were not consistently respected/reported | Context/output options and honest timing separation covered by focused provider tests. No real quality, RSS or throughput acceptance is inferred. |
| AUD-012 | Medium / evidence tooling | `verify-local-models.mjs`, `benchmark-local-models.mjs`, new `scripts/lib/model-evidence.mjs`: digest/checksum/promotion/measurement claims exceeded evidence | Read-only manifest/blob/size verification; unsupported apply rejected; streamed first-content measurement; absent RSS remains null; heuristic rates not called quality scores. 8 pre-fix tooling failures; regression suite passes without a real model host. |
| AUD-013 | High / confidentiality | CRM client list/detail composites, `admin-record-views.ts`, related DTO/UI: private workforce memory/log/job data and finance relations could bypass dedicated endpoint guards | DB select/projection and capability boundaries; restricted fields are null with explicit access flags, not fake zeroes. Corrected initial 20-case DB reproduction failed 20/20, then passed; current expanded CRM suite has 22 cases. |
| AUD-014 | High / financial confidentiality | Project detail/list composites and consumers exposed totals/payments to roles without `finance.read` | Finance-aware project projections preserve operational identity/status but omit financial values. Real role/session/DB tests and authenticated browser HTTP probes pass. |
| AUD-015 | High / approval confidentiality | Dedicated approvals and CRM composites exposed private workforce/unknown approval kinds and sensitive payload/result/decision fields, including to AUDITOR | Shared DB-level type allowlist, finance-aware filter and conditional field select/redaction; non-Super-Admin sees permitted statuses only. 21-case CRM expansion initially 10 pass / 11 fail; fixed. PM browser sees a real pending operational card, no private payload/finance/workforce rows, no decision controls, explicit `status=ALL` history. |
| AUD-016 | Medium / broken mutations | `admin-client.ts`, `LeadsBoard.tsx`, `ProjectsView.tsx`: board fetches omitted the CSRF-aware API helper | Shared CSRF mutation methods; optimistic rollback/toasts retained. Four request/wiring regressions and current full suite pass. Not a claim that every board drag path was browser-tested. |
| AUD-017 | Medium/High / authorization and correction | Client/project stage routes and task-run route: hard-coded role aliases, unknown-stage index `-1` and missing task execution capability | Canonical roles; unknown persisted stages cannot masquerade as the predecessor of NEW; task execution requires `project.write`. Real project-integrity DB cases pass. |
| AUD-018 | High / evidence loss | Task PATCH and `agents/jobs.ts`: slicing serialized evidence corrupted JSON and concurrent reads could overwrite acknowledged notes | Whole-entry 60,000 UTF-8-byte budget with explicit legacy preservation, 413/no mutation on human overflow, compare-and-set conflicts. Worker preserves durable job output/task link and audits capacity/sync failures without truncation/re-inference. Boundary and concurrent DB tests pass; barriers do not replace MySQL concurrency testing. |
| AUD-019 | High / completion integrity | Project status board could set COMPLETED without verified financial/work/delivery/source evidence | Shared persisted closure evaluator, verified same-currency payments minus settled refunds, task and latest ordered delivery/source acceptance; serializable status CAS and closedAt on board completion. Current 19-case integrity suite covers PAID-without-verification, foreign currency, CLOSED-but-settled refund rejection, missing gates and genuine successful completion. |
| AUD-020 | Medium / false success | `journey.ts` stage helper marked every RUNNING client automation successful | Removed client-wide log update; each workflow owns its own completion. Expanded integrity test initially 15 pass / 1 fail, then passed with the unrelated log remaining RUNNING. |
| AUD-021 | Medium / public frontend | Home review DTO/API nullable mismatch and availability handling; missing hero video path; white-on-bright controls | Public review contract/parser; honest empty/unavailable/abort handling; existing `/videos/hero-loop.mp4`; readable public control colors. Four home pre-fix failures, 11 parser cases, browser video/reviews/assets and homepage axe pass. |
| AUD-022 | Medium / framework compatibility | Root page reused as a component/export surface, caught by generated Next PageProps checks | Extracted `PublicSiteApp.tsx`; framework-only root/catch-all retain route/blog behavior. Generated checks kept, not suppressed. Extraction contracts, full production type/build and browser deep-link sample pass. |
| AUD-023 | High / cross-tenant confidentiality | Admin conversation CRM profile queried sibling conversations by client only, despite direct thread tenant guard | Scope sibling query by the authenticated tenant. Real DB test proves foreign direct thread 404 while its ID/subject previously leaked through the owned thread's CRM profile: 21 pass / 1 fail before, then 22/22 pass. Not whole-application tenant certification. |
| AUD-024 | High / journey authorization/binding | `api/admin/journey/route.ts`: FINANCE passed manager rank and could close a project; supplied project ID was not tied to supplied client | Per-action capability checks before client/service work; scoped CLOSE_PROJECT lookup. Two real DB failures returned 200 for prohibited closures; now 403/404 without mutating the wrong project/client. Correct authorized completion still passes. |
| AUD-025 | Medium / isolation and secret logging | `preview-db.ts` comments promised a conflict refusal that did not exist; invalid URL error echoed credentials | Reject a requested preview alongside non-file DATABASE_URL before optional adapter resolution; log variable names, not connection strings. Eight configuration-only tests: four failed before, all pass after; no file/network operation in probes. |
| AUD-026 | Medium / accessibility | Console shell/dashboard/cards/provider notice/table headers/buttons/activity scroller used low-contrast tones, inherited public body color or lacked keyboard focus | Readable dark-surface text, AA-colored invoice/approval actions, explicit workforce button text, named focusable activity list. Static regression contracts plus settled-animation/data axe and actual keyboard focus/scroll pass; dashboard and PM approval history have zero measured rule violations. |
| AUD-027 | Medium / operational documentation | Deployment guide asserted staging approval, nonexistent npm aliases, automatic catalogue verification/promotion/RSS/quality and stale endpoint/count requirements | Source-backed owner-controlled guide; tests separated from live DB; build's migration side effects explicit; real commands and honest measurement/health/API limits. Documentary repair, not an execution or release approval. |

## Remaining work — not marked repaired

| ID | Severity / state | Exact scope / next action |
|---|---|---|
| OPEN-001 | Medium; reproduced; separate edit plan required | `src/components/site/ChatWidget.tsx`: final settled mobile chat has `color-contrast` and `scrollable-region-focusable` violations. Propose changing only small light-surface metadata/privacy text to an AA tone and making the named message log keyboard-focusable with visible focus. Preserve message/session/upload/reconnect logic; obtain the separately approved plan before edits. Then repeat axe, keyboard scroll/focus, persistence, attachments and replies. No workaround/global CSS override was applied. |
| OPEN-002 | Medium; confirmed unsafe code pattern, boundary regression still needed | `journey.ts` `stepLog` and `automation-retry.ts`: `JSON.stringify(steps).slice(0,12000)` can persist invalid JSON; subsequent parsing can fail or discard history. Add real DB boundary/legacy/concurrency tests, then preserve whole entries or explicitly reject capacity without falsifying workflow status. No repair is claimed here. |
| OPEN-003 | Potential High; incomplete fault/concurrency audit | Lifecycle/status/communication/audit writes include separate updates and swallowed errors; journey close is not fully atomic with all client/stage/audit writes. Add fault injection/rollback and MySQL concurrent mutation tests. Existing board transaction/CAS is narrower than whole-lifecycle atomicity. |
| OPEN-004 | Potential Medium/High; code-review candidate, not behavioral acceptance | `journey.ts` `activateProject` currently counts PAID rows without the closure evaluator's verifiedAt/verifiedBy/currency checks. Reproduce legacy/unverified/foreign-currency activation cases without inference/sends and determine the approved deposit gate. Closure and source release remain separately guarded; do not call this already verified. |
| OPEN-005 | Policy/consumer audit incomplete | Client create/import/bulk/manual-board stage/status labels permit historical/correction states. Clarify intended import/correction authority and examine all consumers so a label cannot stand in for payment/approval evidence. Do not delete historical records or remove imports by assumption. |
| OPEN-006 | External environment; new-source MySQL acceptance unexecuted | No local mysqld/Docker. New uncommitted source still needs approved publication and exact-source disposable-MySQL migration replay, drift, tests, seed safety and concurrency. Main's older green CI is not a substitute. |
| OPEN-007 | Broad coverage not certified | All API/model/migration files have structural entries, not individual semantic sign-off. Full record/tenant ownership, upload/SSRF/webhook failure modes, all callers/buttons/devices and every lifecycle/automation path still need review/acceptance beyond the demonstrated repairs. |
| OPEN-008 | External services unexecuted | Actual private model weights/inference/quality/RSS; n8n live callbacks; email/OTP/SMS/WhatsApp/social/payment/refund provider delivery; restore/load/alerts and Hostinger runtime/configuration. Obtain explicit access/authorization and retain redacted evidence; no paid fallback or unsolicited send. |
| OPEN-009 | Local tooling prerequisites | Python build smoke exits 1 because uv is missing; container smoke also needs Docker. Do not classify this as passing or as an application runtime failure. The optional Python path is not certified. |

## Latest executed validation and chronology

- Latest complete standard suite: **2,100 tests / 418 suites passed**, 0 fail,
  cancel, skip or todo, on fresh disposable SQLite; lint and restored-MySQL-client
  typecheck pass. Earlier full 1,939 / 1,973 / 2,026 / 2,046 / 2,084 totals are
  historical checkpoints, not independent extra tests.
- Latest production-provider compile: MySQL generation, direct webpack build,
  framework typecheck, 97 generated pages and faithful standalone assets pass,
  with no reconcile/migrate command. Known dead-test-DB static blog/setting lookup
  warnings are retained, not hidden.
- Actual MySQL-bundled standalone smoke: **97 HTTP checks**, including 83 sitemap
  routes and the real unreachable-MySQL login 503 contract, passes.
- Final compiled-app browser: **13 functional PASS**, **5 accessibility surfaces
  PASS / 1 FAIL**, two rule violations on the remaining widget surface; 0 page
  errors, failed same-origin requests or environment/dependency blockers; nine
  rendered route/image sample. The overall browser command exits **1**, correctly.
- Earlier dev browser attempts were incomplete. Kernel logs confirm the dev
  worker PID 39130 was OOM-killed (~2,539,560 KiB anonymous RSS); later connection
  refusals are environment failures, not failed product assertions. A separate
  earlier consent-banner hydration timeout was a harness count/click race; the
  final harness waits for the persisted denied choice to hydrate. All attempts
  are preserved instead of rewriting their outcomes as passes.
- Fresh full and production npm audits return 0 vulnerabilities; root lockfile is
  unchanged. `npm ls --all` exits 0 but still reports extraneous
  `@emnapi/runtime@1.11.3`, also seen in the earlier isolated clean install. Do not
  call the tree warning-free. `picomatch@4.0.7` is dev-only; the historical advisory
  was withdrawn. No blind/forced upgrade was performed.

## Repair order from here

1. Preserve this evidence; do not publish/deploy or change ChatWidget implicitly.
2. Add whole-JSON step-log and atomic lifecycle fault regressions; resolve
   activation and historical-import policy/consumer questions with evidence.
3. Obtain the widget-specific plan approval, then repair only its measured
   accessibility issues and rerun the real chat/keyboard/browser matrix.
4. After publication approval, run the current source through disposable MySQL
   CI and concurrency/seed/migration acceptance; rerun full local gates after
   any further source edits.
5. Obtain owner-authorized real integration, Hostinger, restore/load/alert and
   manual accessibility/device acceptance. Refresh source inventory/report and
   review every changed diff before any release request.
