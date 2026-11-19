# Exact changed-file index

Authorized branch: `arena/3aa75515-tech360`; unchanged base/HEAD `d8c68f4f8ea983bc64559c51ed9045a726a6cb85`.

**109 changed paths:** 1 deleted, 70 modified, 38 new. Nothing staged, committed, pushed or deployed.

This index includes the original 11 preserved paths, subsequent application/test repairs and the audit artifacts themselves. The lone deleted path is the already removed stale root `bun.lock`; the application/sidecars were not removed. Checkpoint, dependency, fixture, build and ZIP outputs stay ignored. Per-file source hashes and import/consumer/test references are in [repository-inventory.json](repository-inventory.json), not recursively embedded into this self-listed document.

Layer counts: Application: 52, Operational/build tooling: 11, Reports/documentation: 22, Tests: 24.

The 95 snapshot-hash checks across 15 checkpoint manifests preserve overlapping pre-edit versions, not 95 unique changed source files. See [verification](checkpoint-verification.json).

## Application

| Status | Path | Rationale |
|---|---|---|
| modified | `src/app/[...path]/page.tsx` | Consume reusable PublicSiteApp instead of importing a framework page component. |
| modified | `src/app/api/admin/approvals/route.ts` | Capability + DB allowlist/field projection with explicit full/status-only visibility metadata. |
| modified | `src/app/api/admin/clients/[id]/route.ts` | Role-aware composite relation selects/projections and timeline privacy; restricted fields are not fake zeroes. |
| modified | `src/app/api/admin/clients/[id]/stage/route.ts` | Canonical correction role/capability checks; unknown legacy stage cannot act as predecessor of NEW. |
| modified | `src/app/api/admin/clients/route.ts` | Require CRM read/write capabilities in addition to numeric minimum role. |
| modified | `src/app/api/admin/conversations/[id]/route.ts` | Scope linked CRM conversation siblings by authenticated tenant, not shared client alone. |
| modified | `src/app/api/admin/conversations/[id]/stream/route.ts` | Prefer real Last-Event-ID cursor over stale initial query cursor on reconnect. |
| modified | `src/app/api/admin/journey/route.ts` | Authorize each action before reads/services and bind supplied closure project to supplied client. |
| modified | `src/app/api/admin/projects/[id]/route.ts` | Project read capability; exclude private workforce job details and finance relations without permission. |
| modified | `src/app/api/admin/projects/[id]/status/route.ts` | Canonical capability/role checks and serializable evidence-gated COMPLETED compare-and-set/closedAt. |
| modified | `src/app/api/admin/projects/[id]/tasks/[taskId]/route.ts` | Whole-entry evidence/legacy handling, byte-limit 413 without mutation, capability and state/evidence CAS conflict. |
| modified | `src/app/api/admin/projects/[id]/tasks/[taskId]/run/route.ts` | Require project.write before queuing a project-task AI draft. |
| modified | `src/app/api/admin/projects/route.ts` | Project read capability and finance-aware list projection. |
| modified | `src/app/api/auth/login/route.ts` | Safe availability/unexpected error boundary and fail-closed missing-secret MFA; no session on errors. |
| modified | `src/app/api/chat/stream/route.ts` | Emit actual SSE id field so EventSource can resume visitor message cursors. |
| modified | `src/app/api/reviews/route.ts` | Typed public review contract and explicit ISO date serialization. |
| modified | `src/app/page.tsx` | Keep a valid framework-only page wrapper; move reusable router/client shell intact to PublicSiteApp. |
| modified | `src/components/admin/AdminApp.tsx` | Readable muted shell labels on the measured dark background. |
| modified | `src/components/admin/AgentProviderNotice.tsx` | Readable provider-status guidance on dark console. |
| modified | `src/components/admin/ApprovalsView.tsx` | Label status-only access, hide restricted details/decisions, request ALL history explicitly, repair measured contrast. |
| modified | `src/components/admin/ClientDetailView.tsx` | Hide restricted finance tabs, distinguish withheld workforce data, and avoid fake financial zeroes. |
| modified | `src/components/admin/DashboardView.tsx` | Repair measured dashboard contrast/inherited button text and name/focus keyboard-scrollable activity. |
| modified | `src/components/admin/LeadsBoard.tsx` | Use shared CSRF-aware client-stage helper; retain optimistic UI rollback/errors. |
| modified | `src/components/admin/ProjectsView.tsx` | Use CSRF-aware status helper and explicit restricted finance states/null-safe payment rows. |
| modified | `src/components/admin/shared/DataTable.tsx` | Readable dark table headings and honest empty text. |
| modified | `src/components/admin/shared/cards.tsx` | Readable KPI/header/description/empty-state muted labels. |
| modified | `src/components/site/HomeView.tsx` | Use real hero asset and validated nullable reviews; honest empty/unavailable/abort behavior; readable controls. |
| new | `src/components/site/PublicSiteApp.tsx` | Preserve original public router/portal/admin/consent shell after extraction; darken two measured public consent control colors. |
| modified | `src/components/site/buttons.tsx` | Darken public primary/WhatsApp button colors for measured text contrast without changing actions. |
| modified | `src/lib/access-policy.ts` | Validate both canonical roles before numeric comparison, including prototype-key rejection. |
| modified | `src/lib/admin-client.ts` | Reflect restricted/null DTOs and provide CSRF-aware board mutation helpers. |
| new | `src/lib/admin-record-views.ts` | Shared project-finance redaction and fail-closed approval type/filter/select/status-only projection. |
| modified | `src/lib/agents/engine.ts` | Respect centralized global provider policy over saved agent model prefixes. |
| modified | `src/lib/agents/jobs.ts` | Never truncate/overwrite acknowledged task evidence; preserve terminal job draft and durably audit capacity/CAS sync issues. |
| modified | `src/lib/agents/provider-selection.ts` | Central explicit/global/disabled/auto provider policy and truthful diagnostics; no implicit fallback from explicit choice. |
| modified | `src/lib/automation/actions.ts` | Handle durable n8n SUCCEEDED/RUNNING outcomes without false failure or lost wait. |
| modified | `src/lib/automation/engine.ts` | Reconcile early terminal callbacks after waiting persistence; atomically compensate attempts with conditional resume. |
| new | `src/lib/database-errors.ts` | Classify Prisma availability by safe codes/shape without parsing or exposing raw messages. |
| modified | `src/lib/journey.ts` | Use common closure evidence; stop claiming every unrelated RUNNING client workflow succeeded on stage changes. |
| modified | `src/lib/lifecycle-gates.ts` | Shared persisted verified-payment/refund/task/latest-delivery/source closure evidence for board and journey. |
| modified | `src/lib/model/providers/ollama.ts` | Correct nested generation options, no prompt redirects, reject empty/invalid responses, per-input finite embeddings, no fictional first-token metric. |
| modified | `src/lib/model/providers/openai-compatible.ts` | Reject redirect/empty chat/incomplete or inconsistent non-finite embedding success. |
| new | `src/lib/model/response-validation.ts` | Shared finite nonempty vector and consistent batch validation. |
| modified | `src/lib/model/router.ts` | Default private chain is local-only; remote requires explicit opt-in; invalid explicit chain denies. |
| modified | `src/lib/n8n/adapter.ts` | Transactional monotonic callback/ACK reconciliation, preserved durable terminal outcome, idempotent retry/resume. |
| new | `src/lib/network-address.ts` | Shared binary subnet classifier for protected IPv4 and normalized/mapped/expanded IPv6 boundaries. |
| modified | `src/lib/preview-db.ts` | Refuse conflicting non-file primary datasource before adapter loading; redact invalid preview URL errors. |
| new | `src/lib/project-task-evidence.ts` | Bound whole serialized task evidence at 60,000 UTF-8 bytes; preserve malformed legacy raw content. |
| new | `src/lib/public-review-contract.ts` | Validate public review nullable fields, ratings and dates without fabricating reviews. |
| modified | `src/lib/rea/target-policy.ts` | Apply the same protected-address classification to REA target admission. |
| modified | `src/lib/safe-fetch.ts` | Use shared protected-address admission instead of incomplete text-prefix classification. |
| modified | `src/lib/webchat/thread.ts` | Order/paginate deltas by (createdAt,id) before LIMIT; real SSE cursor framing and cancellation cleanup. |

## Tests

| Status | Path | Rationale |
|---|---|---|
| new | `tests/admin-accessibility-contract.test.ts` | Supplement executed axe/keyboard evidence with dark-console contrast/activity focus contracts. |
| new | `tests/admin-board-requests.test.ts` | Exercise CSRF-aware client/project board request wiring and errors. |
| modified | `tests/agent-provider-selection.test.ts` | Explicit/invalid/disabled provider matrix with synthetic configured-key and secret-free diagnostics assertions. |
| modified | `tests/agent-readiness.test.ts` | Preserve skip-link contract after reusable shell extraction; no assertion removed. |
| new | `tests/audit-chat-pagination-db.test.ts` | Real disposable 650-row chat history with ties, visibility, cursor, stream framing and cancellation regressions. |
| new | `tests/audit-crm-boundaries-db.test.ts` | Real sessions/guards/DB role projections, approval allowlists/field privacy, tenant-sibling leak regression. |
| new | `tests/audit-external-execution-db.test.ts` | Intercepted outbound requests and injected callbacks around real DB writes; monotonicity/resume and global provider policy. |
| new | `tests/audit-network-boundaries.test.ts` | Protected/normalized IP and fetch/target admission regressions; no real private-network exploit. |
| new | `tests/audit-private-model.test.ts` | Synthetic/intercepted or local server provider protocol, redirect, output/embedding/timing/private-order regressions. |
| new | `tests/audit-project-integrity-db.test.ts` | 19 real disposable-DB task evidence/concurrency/gating/role/client-binding/refund/closure cases; no inference or send. |
| new | `tests/auth-login.test.ts` | 34 outage, fail-closed MFA, session, rate-limit, lockout and safe-error regressions. |
| modified | `tests/business-policies.test.ts` | Known/unknown/prototype role fail-closed regression matrix. |
| modified | `tests/dashboard-agent-roster.test.ts` | Keep operator/authorization assertion while allowing repaired button styling. |
| modified | `tests/factory-super-admin-boundary.test.ts` | Preserve public pipeline confidentiality assertions after shell extraction. |
| new | `tests/model-evidence-scripts.test.ts` | Read-only private-endpoint/manifest/blob/streaming metric tooling regressions without a real model host. |
| modified | `tests/model-service.test.ts` | Update expected local-only private default; explicit remote path covered by new regression. |
| modified | `tests/pipeline-public-contract.test.ts` | Preserve operator-pipeline confidentiality assertions against extracted public shell. |
| modified | `tests/portfolio-filter-history.test.ts` | Keep navigation/history wiring assertions against extracted public shell. |
| new | `tests/preview-db-isolation.test.ts` | 8 configuration-only conflict/protocol/production/redaction probes; no adapter/files/DB opened. |
| modified | `tests/production-env.test.ts` | Reject invalid/unavailable explicit provider while retaining configured/auto/intentional-off acceptance. |
| modified | `tests/project-task-agent-loop-contract.test.ts` | Assert the strengthened project.write guard without dropping approval/task-loop checks. |
| new | `tests/public-home-contract.test.ts` | Hero/review/control/public-shell contract regressions. |
| new | `tests/public-review-contract.test.ts` | 11 nullable/malformed/rating/date public-review parser cases. |
| new | `tests/test-runner-safety.test.ts` | Intercept the actual child-process boundary and verify disposable URL acceptance/production/remote override rejection. |

## Operational/build tooling

| Status | Path | Rationale |
|---|---|---|
| modified | `.env.example` | Document fail-closed explicit AI-provider choices and explicit remote-model opt-in; blank example secrets stay blank. |
| modified | `.github/workflows/ci.yml` | Strengthen real dead-MySQL login smoke: safe retryable 503, Retry-After, no cookies or credential echo; no disabled gate. |
| modified | `.gitignore` | Keep npm as the sole root lock contract; ignore root Bun locks without changing optional sidecars. |
| deleted | `bun.lock` | Retain pre-existing removal of stale competing root Bun resolutions; package-lock.json is unchanged. |
| new | `scripts/audit-repository.mjs` | Read-only whole-selected-tree SHA/AST/import/consumer/API/role/DB/security/test-reference inventory; no semantic pass inference. |
| modified | `scripts/benchmark-local-models.mjs` | Private-only read-only benchmark, streamed first-content timing and honest heuristic/quality/RSS limits. |
| modified | `scripts/build-source-archive.sh` | Use npm-only root inputs and actual npm-start preflight guidance; keep local data/secrets/build/archive exclusions. |
| new | `scripts/lib/model-evidence.mjs` | Shared private model endpoint/timeout/auth argument boundary for read-only evidence tools. |
| modified | `scripts/test.mjs` | Refuse production/remote/non-disposable/mixed/routing-override datasources before DB-mutating child setup. |
| modified | `scripts/validate-production-env.mjs` | Reject unavailable/invalid explicit provider rather than accepting another configured paid-provider path. |
| modified | `scripts/verify-local-models.mjs` | Verify actual manifests/blobs/digests/byte lengths read-only; reject unsupported apply/promotion claims. |

## Reports/documentation

| Status | Path | Rationale |
|---|---|---|
| modified | `COVERAGE-AUDIT.md` | Label historical reference/parity mapping as distinct from current test coverage and acceptance. |
| modified | `KNOWN_ISSUES_AND_BLOCKERS.md` | Replace superseded source/CI claims with latest measured results, unresolved code/widget work and honest owner gates. |
| modified | `MASTER_PROJECT_AUDIT.md` | Keep historical snapshot; add current-source audit entrypoint. |
| modified | `README.md` | Clarify npm setup and point to current measured audit, open work and build migration hazards. |
| modified | `TEST_AND_QA_REPORT.md` | Update current QA notice with latest tests/build/browser scope and unrepaired findings; retain historical body. |
| new | `docs/ERROR_FIX_VERIFICATION_2026-11-18.md` | Preserve initial auth/MFA/lockfile repair evidence and local-vs-production limits. |
| new | `docs/audit/2026-11-18/CHANGED_FILES.md` | Human-readable exact changed-file index and rationale; self-listed without recursive content hashes. |
| new | `docs/audit/2026-11-18/ISSUES_AND_PLAN.md` | Replace candidate-only plan with actual red/green repair register and unrepaired source/external follow-up. |
| new | `docs/audit/2026-11-18/REPOSITORY_AUDIT.md` | A–K measured scope, repairs, module/browser coverage, open gates, deliverables and single honest readiness verdict. |
| new | `docs/audit/2026-11-18/browser-console-before-repairs.json` | Retain settled pre-repair console accessibility diagnostic as historical evidence. |
| new | `docs/audit/2026-11-18/browser-fifth-attempt.json` | Preserve an earlier browser attempt verbatim with actual failures/environment limits; not current acceptance. |
| new | `docs/audit/2026-11-18/browser-first-attempt.json` | Preserve an earlier browser attempt verbatim with actual failures/environment limits; not current acceptance. |
| new | `docs/audit/2026-11-18/browser-fourth-attempt.json` | Preserve an earlier browser attempt verbatim with actual failures/environment limits; not current acceptance. |
| new | `docs/audit/2026-11-18/browser-second-attempt.json` | Preserve an earlier browser attempt verbatim with actual failures/environment limits; not current acceptance. |
| new | `docs/audit/2026-11-18/browser-third-attempt.json` | Preserve an earlier browser attempt verbatim with actual failures/environment limits; not current acceptance. |
| new | `docs/audit/2026-11-18/browser-verification.json` | Final executed compiled-app browser result: 18 pass/1 fail, widget rule details, assets and explicit limits. |
| new | `docs/audit/2026-11-18/changed-files.json` | Machine-readable exact current changed paths/status/rationale; excludes ignored local artifacts. |
| new | `docs/audit/2026-11-18/checkpoint-verification.json` | Verify 95 preserved snapshot hashes across 15 manifests and recorded pre-existing absence; private fixture permission check only. |
| new | `docs/audit/2026-11-18/repository-inventory.json` | Generated per-file hashes/AST/calls/imports/consumers/roles/API/test references; structural evidence only. |
| new | `docs/audit/2026-11-18/validation-results.json` | Exact executed modes/results/log digests plus blocked/not-run gates; no additive coverage fiction. |
| modified | `docs/deployment/DEPLOYMENT_GUIDE.md` | Replace unverified authorization/model/RSS/alias/API claims with source-backed owner-controlled procedure and migration/test safety. |
| modified | `worklog.md` | Preserve old rounds, add historical-evidence notice and append the actual repairs, latest results, restrictions and open gates. |
