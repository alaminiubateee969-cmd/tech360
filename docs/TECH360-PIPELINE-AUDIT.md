# Tech360: first message to final delivery audit

Audit date: 2026-10-24. This is a code and automated-test audit, **not production acceptance**.

## Shared command center

Admin and Super Admin can open Core Agents and Command Center. The command center now includes:

- Live CRM stage counts, pending approval types, persisted agent/job/message states.
- Operations worker heartbeat, reported as ACTIVE, STALE or OFFLINE.
- Server channel configuration flags, explicitly not connectivity checks.
- Existing Oracle actions and the separate optional zero-price OpenRouter assistant.

Private memory, knowledge, DCC and infrastructure keep their Super Admin boundaries, including corresponding Oracle commands. Conversation history is scoped to both user and session. The optional OpenRouter assistant cannot run business tools. The main journey agent engine currently calls the configured ZAI-compatible client; the separate private model service does not automatically replace that engine. Configuring the assistant alone does not configure production agent inference.

## Requirement trace

| Requested stage | Existing implementation / evidence | Operational boundary |
| --- | --- | --- |
| 1. First message, Client ID, CRM history | `journey.intakeLead`, `ids`, channel webhooks, pipeline FIRST_MESSAGE template | Requires authenticated ingress/provider configuration; unverified contact details are not identity proof |
| 2. Business type, recommendation, questions | `detectBusiness`, `recommendPlan`, `askScopeQuestions` | Needs successful model execution and provider acceptance |
| 3. Draft scope, internal review | `submitScope`, versioned scopes, approval requests | Draft is not final approval |
| 4. Final scope | FINAL_SCOPE_APPROVED template and governed scope approval/send | Human approval remains mandatory |
| 5A. Meeting | Meeting template, scheduling engine, Oracle scheduling actions | Booking URL/provider configuration must be valid |
| 5B. Scope acceptance | `clientScopeDecision`, persisted scope approval | Explicit supported decision required; no missing-decision default |
| 6. HTML preview | `generatePreview`, tokenized preview delivery | Provider acceptance is not client approval |
| 7A. Revision | `recordPreviewDecision`, revision notice, admin notification/task | Tasks still require actual implementation and verification |
| 7B. Preview approval/payment step | Preview decision and approval-gated payment template | Does not automatically verify a payment |
| 8. Payment | `recordPayment`, governed `verifyPayment`, verified gateway event handling | Uploaded proof is not payment verification; partial payment is not full settlement |
| 9. Delivery preparation | `prepareHandover`, artifact manifest, completed-task/full-payment checks | Must have actual eligible project artifacts |
| 10. File release and client confirmation | `releaseHandover`, pinned approved manifest, artifact hashes, delivery confirmation | Full payment and approved file release remain mandatory |
| 11. Closure, review/referral | `closeProject`, lifecycle acceptance policy, `requestReviewAndReferral` | Requires actual client acceptance and required handover evidence |

Client profile history is assembled in `src/lib/pipeline/profile.ts`: identity/contact fields, source, messages, scope versions, approvals, payments, delivery/handover and reviews/referrals. Template wording and send/approval classifications are covered by `tests/communication-pipeline.test.ts`.

## Changes from this audit

1. Fixed missing/unknown scope and preview decisions defaulting to approval at the Admin journey API. Added validation at both API and journey service boundaries.
2. Added Messenger to authenticated social relay intake, retaining its source and event id with replay protection. This is relay intake support, not native Messenger outbound support.
3. Corrected returning-lead stage-2 logging: a failed/no-channel attempt is no longer recorded as sent merely because it was not awaiting approval.
4. Added the shared read-only live pipeline monitor. Database failure returns 503, not zeroed success data. No prompts, message bodies, payment proof or file links are returned by this monitoring endpoint.
5. Prevented Admin Oracle commands from bypassing Super Admin-only memory, knowledge and DCC access.

## Verification

- `npm run typecheck`: PASS.
- Targeted pipeline/security/template/social/preview/handover tests: **151 passed, 0 failed**.
- All tests excluding the three database-dependent files: **959 passed, 0 failed, 0 cancelled**.
- ESLint on changed command, journey API, social API, monitoring and policy files: PASS.
- Full `npm test` before the final additional policy test: **958 passed, 3 failed test files, 35 cancelled**. The three database-backed files (`database-workflows`, `governance-db`, `governance-outbound-db`) require `DATABASE_URL`, absent in this sandbox. This is NOT a passing full end-to-end suite.
- Generated an engine-less Prisma client locally for type/unit-test verification. Production must generate its normal deployable client; no runtime engine or database is supplied by this audit.

## Outstanding before “all work auto done” can be certified

- Configure and migrate the real database; run the database-backed and production end-to-end tests.
- Configure the main journey AI inference endpoint/key and evaluate output quality. Own agent definitions do not mean owned model weights or free inference.
- Activate/verify the operations runtime or authenticated scheduler; inspect heartbeat AND successful work records.
- Configure WhatsApp, SMS, email and social relays with real account permissions, signatures/secrets, delivery callbacks and consent rules. A token-present flag does not prove social sending is supported.
- Test every channel's inbound event, duplicate event, client association, saved message, outbound acceptance and failure/retry behavior. Provider delivery must be verified separately from request acceptance.
- Verify the deployed booking link, preview review path, client scope approval, payment gateway/manual verification, refunds, and human approval authority.
- Build and test the actual client project, complete real project tasks, attach scan-clean artifacts and approve the exact manifest. Agents must not fabricate project completion.
- Exercise both positive AND negative payment/file-release gates, delivery receipt, password-change confirmation, closure, review consent and referral flows.
- Verify exact brand/contact settings on deployment. No changes to the site's phone-display policy were made.

Existing automation paths, templates and tests do not prove that every arbitrary inbound message can autonomously progress every stage. The pipeline intentionally pauses for client responses, missing evidence, human review and restricted actions. No “approve everything”, fabricated payment confirmation, automatic legal reply, or unpaid source-code release was added.
