# TECH360 repository and production-readiness review — 2026-11-17

**Repository:** `alaminiubateee969-cmd/tech360`
**Default branch:** `main`
**Reviewed baseline:** `59e3e339287698920ff40b09547c4cc24397c0eb` (PR #79 merge)
**Review branch:** `arena/78fc673f-tech360`, based directly on the reviewed `main` SHA
**Verdict:** **Feature source is extensive; production acceptance is not certified.** This review makes WebChat reliability fixes, but it cannot configure or test Hostinger. The exact live SHA, database, runtime settings, provider transactions and operational safeguards still require authorized owner evidence.

The rationale and trade-offs for the existing major implementations are indexed in [`IMPLEMENTATION_RATIONALE_REGISTER.md`](./IMPLEMENTATION_RATIONALE_REGISTER.md); it preserves scope and points to the detailed source, policy, test and operations records.

## 1. GitHub pull-request reconciliation

GitHub's complete PR inventory at review time returned **79 numbered PRs: 77 merged, 0 open, and 2 closed without merge**. Of the merged PRs, **73 targeted `main` directly**. PRs #6, #63 and #65 were merge/reconciliation wrappers into feature branches, and #69 merged its conflict repair into the #67 feature branch; their resulting work reached `main` through the corresponding main-target PRs.

| PR | State | Reconciliation |
|---|---|---|
| #1–#8, #10–#42, #44–#79 (except PRs whose merge wrapper targeted another branch) | Merged | GitHub reports merged state. Current `main` is the merge commit for #79. |
| #43 | Closed, not merged | Its unrelated-history branch had 95 add/add conflicts. PR #44 explicitly resolved the conflict and preserved all incoming versions, byte-identically, in `legacy/integration/2026-10-28/`; the maintained `main` versions remained active. This is intentional reconciliation, not a missing live feature merge. |
| #9 | Closed, not merged | Proposed a superseded VPS/GitHub deployment path. Current production architecture is Hostinger's Node.js Web App Git integration. Reopening/restoring #9 would create a competing deployment path and is not recommended. |

**Conclusion:** no open or unmerged intended feature PR was found that should be merged into `main`. No merge/close action was performed. In particular, do not merge PR #9 or replace live MySQL/Next code with the historical prototype from #43. Main's newest merge commit is present in this checkout; local Git history is shallow, so PR status was verified through GitHub CLI, not by reconstructing every historical object locally.

## 2. Feature and requirement coverage

The repository contains a substantial maintained system: public site and contact intake; CRM and client portal; project/task lifecycle; quotes, invoices, manual payments and Stripe adapter; approval and audit workflows; 44 seeded AI agents and provider-selection paths; content/campaign tools; software-factory scaffolding; media planning; feed parsing; call/SMS console; inbound communication processing; security and deployment tooling. The source, route, schema, test, CI and documentation surfaces were inspected alongside the existing requirements register, SMS journey documents, integration matrix and production runbooks.

The important distinction is **implemented code vs. operationally activated service**:

- **SMS journey:** the application has SMS/channel adapters, opt-out/consent handling, inbound webhook processing, CRM linkage and truthful provider status. A real provider, approved sender/number, correct callback, signature enforcement and successful inbound/outbound acceptance test are not evidenced here. The configured endpoint must match the adapter's expected protocol; arbitrary SMS keys/URLs do not make it operational. The public site intentionally does not publish a WhatsApp contact action, per the recorded owner decision.
- **WebChat:** the public widget, consented persistence, cookie-bound thread reads/writes, CRM prospect linkage, staff inbox and optional AI orchestration are present. Hostinger values, actual production DB/migrations, deployed SHA, browser cookie behavior and staff response coverage remain unverified.
- **Payments:** manual paths and Stripe code exist, but provider credentials/webhook acceptance are unverified. PayPal and SSLCommerz remain explicitly `INTEGRATION_NOT_BUILT`; adding their environment names would not implement them.
- **Creative rendering:** the system can prepare scripts, shot plans and captions; it does not claim actual video/audio generation without a selected licensed renderer and a successful provider job.
- **Security/operational controls:** sessions, RBAC, consent, rate limits, migration guardrails, audit trails, backups and restore tooling exist in source; some production behaviors are still owner/operator evidence gates.

An earlier authoritative register calls itself historical and several other status reports have older dates. They remain evidence of their respective snapshots; this review does not silently promote old `PASS` rows to current production proof. Current operational blockers remain in [`KNOWN_ISSUES_AND_BLOCKERS.md`](../KNOWN_ISSUES_AND_BLOCKERS.md).

## 3. WebChat diagnosis and changes

### Source-level diagnosis

The public widget is included on the site and uses same-origin API routes; it is intentionally hidden on `#/admin` and `#/portal`. Its functional prerequisites are a reachable migrated MySQL database, stable `SESSION_SECRET` for the signed `t360_chat_session` cookie, a same-origin HTTPS browser session, and a working staff inbox. An AI provider is separately required for AI-generated answers; AI is not the transport layer for storing or reading the WebChat thread.

Two code paths could make chat appear broken even if the UI rendered:

1. In anonymous CHAT-first intake, the database stores `visitorEmail: null` but the browser retry sent `email: ""`. Strict comparison rejected the exact idempotent replay as `401 CHAT_SESSION_REQUIRED`.
2. The session route swallowed first-message persistence errors, then returned success. The widget could clear the intake and open a conversation with no saved initial message.

A further UI path treated a transient message-list read error after a successful start as if the intake had failed, despite the conversation already existing. The first-contact copy also promised an immediate assistant reply even when the provider was unavailable.

### Changes made on this review branch

- Compare replay contact values after normalizing absent/blank values; non-empty changed addresses still fail closed.
- Do not return successful session creation if the first message could not be persisted. Preserve the request ID and user text in the browser for retry.
- Keep a successful thread open if the follow-up thread read fails; expose a connection issue instead of stranding the visitor on the hidden form.
- Explain that messages are stored, an available AI may assist, and a human may reply; do not promise an unconfigured assistant.
- Add regression coverage for anonymous replay normalization and route-level retry/persistence invariants.

These are source changes on the review branch, **not yet merged or deployed**. A production browser test is required after deployment. See [`WEBCHAT_HOSTINGER_TROUBLESHOOTING.md`](./WEBCHAT_HOSTINGER_TROUBLESHOOTING.md) for the no-secret operator checklist and response-code guide.

## 4. Hostinger manual configuration still required

Yes—values must be entered by an authorized owner in Hostinger's Node.js Web App environment panel. No production credentials were requested, copied, generated for a provider, or placed in this repository.

### Core application / WebChat

- Actual Hostinger MySQL `DATABASE_URL` using the correct host, database name, user and password. Verify permissions and migrations against the intended database before/after deployment.
- `NODE_ENV=production`, Node.js 22.x, canonical `APP_PUBLIC_URL` and `APP_ORIGIN` values, and the selected Hostinger build/start settings (`npm run build`, `npm start`). Confirm the hPanel runtime actually runs the npm prestart validation.
- Unique, random `SESSION_SECRET`, `PORTAL_SECRET`, and `OPS_SECRET`, each at least 32 characters and distinct. `SESSION_SECRET` signs WebChat's cookie; keep it stable across instances and deploys or active visitor sessions become invalid.
- `AI_PROVIDER` and credentials for one approved provider for AI replies/agent execution. If deliberately operating without AI, configure `AI_PROVIDER=none` and accept that staff—not AI—must answer. The app's production validator refuses startup without a provider choice or explicit `none`.
- Owner-controlled first Super Admin bootstrap/forced password change/TOTP setup, with temporary bootstrap credentials removed afterward.

### Only if those features are enabled

- SMTP or Hostinger Mail API credentials and sender/domain authorization for outbound email.
- SMS provider URL/key/sender and an operational connected number/device; inbound webhook verification/restriction must be addressed separately. A configured key alone is not an acceptance test.
- Approved provider credentials, callback URLs and webhook secrets for WhatsApp/social/payment/n8n/media as applicable. Do not configure or advertise adapters that remain `NOT_CONFIGURED` or `INTEGRATION_NOT_BUILT`.
- Optional gateway registry, caller tokens, approved data policy and model allowlists if the shared AI gateway is a required architecture component. Its liveness route does not prove readiness.
- Backup schedule/offsite storage, restore drill, uptime/SSL/backup/security alert routing and provider-account renewal/rotation records.

`.env.example`, `docs/HOSTINGER_ENVIRONMENT_VARIABLES.md`, and the troubleshooting guide document variable **names and purpose** only; they are not a set of production values. Never paste credentials into chat, Git, public issues, or client-visible logs.

## 5. Industry, legal and security acceptance

The code has meaningful safeguards: privacy/contact consent, separate marketing opt-in policy, message opt-out handling, honest delivery states, no raw-email identity linking, signed chat cookies, server-side auth/RBAC, CSRF and rate limits, human approvals for high-impact actions, audit records, payment verification gates and explicit not-built states.

This is **not a legal certification**. No jurisdiction-specific legal counsel review, telecom/carrier registration, provider contract check, data-retention/deletion sign-off, formal accessibility audit, independent penetration test, or production incident-response exercise was supplied. The business owner/legal counsel must confirm the laws and provider terms applicable to TECH360's actual operator and customers (including the destinations where messages are sent). Do not infer compliance from a code test or a consent checkbox.

Repository governance and production operations still have evidence gaps documented in the blocker register, including main branch protection/review policy, owner-approved repository license, signed/tagged release decision, live deployment SHA/runtime, production database/migration verification, current backup plus isolated restore, monitoring/alert test, provider transaction acceptance, admin account acceptance and complete browser/device/accessibility/load QA. Until these close, do not declare the project fully production-ready or all industry requirements certified.

## 6. Current CI/security exception requiring follow-up

GitHub Actions run **44073933370** on the reviewed `main` SHA `59e3e339…` failed at **“Audit npm dependencies (full and production)”**; all subsequent MySQL/typecheck/test/build gates were skipped in that run. It is therefore incorrect to describe the latest `main` run as green.

The package-lock was refreshed on this review branch; Next.js and `eslint-config-next` resolve to `16.4.6`, addressing the moderate Next advisories present in the baseline `16.4.3`. The current npm registry still resolves `picomatch` to `4.0.7`; npm audit reports a high-severity ReDoS advisory for `picomatch` (including transitive Next tooling/runtime dependency paths). `npm audit fix` updated compatible packages but left 13 audit entries through that dependency graph. Do **not** suppress the audit, downgrade the threshold, or claim the vulnerability is fixed. Re-run the audit when upstream publishes a non-vulnerable release or adopt a reviewed and testable upstream mitigation; until then the full CI dependency-audit gate remains blocked.

### Checks run on the review branch

| Check | Result |
|---|---|
| Chat/security/consent regressions | PASS — 64 tests |
| Business policy tests | PASS — 18 tests |
| ESLint | PASS |
| Prisma schema type-map check | PASS — MySQL provider, 243 native annotations |
| Merge-conflict marker scan | PASS — 1,637 tracked files |
| Industry/service asset references | PASS — all checked paths present |
| Master SOP readiness command | Correctly reports `NOT_PRODUCTION_READY_BLOCKED` with license, tag, backup/restore, alerting, integrations, Hostinger identity, branch governance and acceptance blockers |
| npm dependency audit | BLOCKED — 13 high-severity audit entries through `picomatch@4.0.7` |
| TypeScript check | BLOCKED locally — `npm audit fix` reinstalled dependencies and left an ungenerated Prisma client stub; `prisma generate` could not reach `binaries.prisma.sh` from this sandbox. This does not replace exact-SHA CI. |
| Production installer check | Expected to fail without host secrets/database/admin bootstrap; it ran report-only and made no changes |
| Hostinger, live MySQL, real AI/SMS providers | NOT TESTED — no authorized production access or credentials |

## 7. Evidence, scope limits and reasoning

- PR inventory and merge state: GitHub CLI (`gh pr list --state all --limit 500`) and individual PR records for #9, #43 and #44.
- Latest source baseline and failed gate: current `main` merge SHA plus GitHub Actions run 44073933370 job metadata. Raw Actions log download ended with an EOF in this environment; failing step and skipped-step states were still exposed by run metadata.
- Code review: `src/components/site/ChatWidget.tsx`, `src/app/page.tsx`, `src/app/api/chat/{session,messages,message}/route.ts`, `src/lib/chat-session.ts`, `src/lib/chat-onboarding.ts`, production environment validator, and existing chat/security tests.
- Product status and known gaps: existing requirements register, AI agent human-loop, AI software-factory, deployment, environment, backup and blocker documents.
- No production API, Hostinger control panel, external provider, production database or secret was accessed; no deployment, migration or production data mutation was performed.
- The user message referred to example “formats below,” but no examples/attachments were present in the received message. This report follows the repository's existing audit style and links to the operator checklist.
