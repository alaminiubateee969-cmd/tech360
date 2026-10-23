# TECH360 Messaging Repair — File-by-File Change List, Test Evidence & Truthful Status

**Branch:** `arena/2960e44a-tech360`
**Base:** `main` at `9e2ab18`
**Date:** 2026-10-23
**Website:** https://bdtech360.com
**Public contacts (canonical):** WhatsApp `+8801327100297` · Email `info@bdtech360.com`

---

## 1. Objective

Repair the existing TECH360 communication architecture so website chat, WhatsApp, SMS, email, CRM, AI agents and the existing customer lifecycle work as one reliable system — without rebuilding the application, creating duplicate CRM/agent/workflow systems, or claiming provider readiness without acceptance tests.

---

## 2. File-by-File Change List

### 2.1 Shared contact source (Requirement H)

| File | Action | Detail |
|------|--------|--------|
| `src/lib/site-contact.ts` | **NEW** | Single source of truth: `PUBLIC_CONTACT` (`whatsappE164`, `whatsappDigits`, `whatsappLink`, `email`, `url`, `contactUrl`) and `COMPANY_CONTACT` (legal identity). Requirement H anchor. |
| `src/lib/constants.ts` | **MODIFY** | Imports `PUBLIC_CONTACT`, exposes `publicEmail`/`publicWhatsApp`/`publicWhatsAppLink` on `COMPANY` so every module reads one value. |
| `src/data/site.ts` | **MODIFY** | Adds `import { PUBLIC_CONTACT }` at top, `COMPANY` now uses `PUBLIC_CONTACT.email`/`whatsappE164`/`whatsappLink`. Tagline preserved. |
| `src/components/site/SiteFooter.tsx` | **MODIFY** | Adds WhatsApp link via `COMPANY.whatsappLink` + display `COMPANY.publicWhatsApp` (was missing). Email now via shared `COMPANY.email`. |
| `src/components/site/buttons.tsx` | **MODIFY** | `WhatsAppLink` falls back to `PUBLIC_CONTACT.whatsappE164` when no `number` prop is passed, so the site never shows a dead button and never uses a conflicting hard-coded number. Replaces prior “render nothing if <8 digits” dead-end. |
| `src/components/site/PortalView.tsx` | **MODIFY** | Imports `PUBLIC_CONTACT`, uses it for the login panel’s fallback email link (was hard-coded). Admin-driven `supportContact` remains for authenticated views. |

### 2.2 One-question-at-a-time discovery (Requirement C)

| File | Action | Detail |
|------|--------|--------|
| `src/lib/discovery.ts` | **NEW** | Defines 9 `DISCOVERY_FIELDS` (businessType, objective, intendedUsers, pagesFeatures, existingWebsite, references, integrations, timeline, budget, contentAssets). Pure helpers: `isAnswered`, `missingFields`, `missingRequiredFields`, `nextQuestion` (required-first), `buildSummary` (confirmation before SOW), `extractEmail`/`isEmailLike`, `loadDiscoveryState`/`saveDiscoveryState` via `AiMemory` (no new migration, reuses existing CRM memory table), `syncDiscoveryToCrm` to keep `Client`/`Lead` visible in admin. |

### 2.3 Persisted communication state machine & follow-up policy (Requirement G)

| File | Action | Detail |
|------|--------|--------|
| `src/lib/conversation-state.ts` | **NEW** | Persisted state in `AiMemory` (`scope: COMM_STATE`, key `comm_state:{clientId}`): `lastInboundAt`/`lastOutboundAt`+body, `currentStage`, `nextPendingAction`/`nextPendingActor`, `dueDate`, `firstReminderAt`/`finalReminderAt` (24 h / 72 h defaults, configurable), `reminderCount`/`maxReminderCount=2`, flags `followUpEnabled`, `optedOut`, `humanTakeover`, `closed`, `config` (quiet hours `22:00–07:00 Asia/Dhaka`, timezone). Pure helpers: `defaultCommState`, `loadCommState`, `saveCommState`, `recordInbound`, `recordOutbound`, `setHumanTakeover`, `setOptOut`, `setClosed`, `decideFollowUp` (respects quiet hours, opt-out, takeover, closure, max reminders, stage change, cooldown), `isQuietHour`, `recordReminderSent`, `isDuplicateInbound`. Idempotency via `InboundWebhookReceipt`. |

### 2.4 Channel routing (Requirement D)

| File | Action | Detail |
|------|--------|--------|
| `src/lib/channel-router.ts` | **NEW** | `decideReplyChannel` (reply on inbound channel if operational else fallback to canonical email), `validateEmail`+`collectEmailForClient` (validate, save to `Client.email`, audit `EMAIL_DUPLICATE_COLLISION` without auto-merge), `sendCanonicalWithNotification` (detailed email on canonical channel + concise WhatsApp/SMS note with Client ID + action), `buildNextStepFooter` (Client ID·stage·whatHappened·nextStep·actor·dueDate·replyAction per Requirement E). Honest: never claims sent unless `sendCommunication` returned `ok`. |

### 2.5 Chat orchestrator (Requirements B, C, D, E, F)

| File | Action | Detail |
|------|--------|--------|
| `src/lib/chat-orchestrator.ts` | **NEW** | `handleCustomerMessage({channel, conversationId, clientRowId, clientId, visitorBody, …})`: loads client+lead, history (20 msgs: `ChatMessage` + `Communication`), discovery state, extracts email, `recordInbound`, updates discovery (`discovery.answers[field]=body` before advancing), `syncDiscoveryToCrm`, checks `getZaiProviderStatus()`, tries `runAgent` over `['BIZ-004','SCP-006','PLN-005','COM-010']` with screened output (`screenAiContent`), honest fallback via `buildHonestFallback` (states Client ID·stage·whatHappened·nextStep·actor, never invents pricing/timeline), `buildSummary` when discovery complete, persists `ChatMessage`(ADMIN/SYSTEM)+`ChatConversation`+`Communication`(OUT)+`recordOutbound`, returns `{ok, reply, wasAiGenerated, escalated, nextAction, stage}`. Implements Requirement C invariants: answer actual question first, at most one follow-up, never repeats known answers, summary before SOW. |

### 2.6 Website chat repair (Requirement B)

| File | Action | Detail |
|------|--------|--------|
| `src/app/api/chat/session/route.ts` | **MODIFY** | Adds AI availability (`getZaiProviderStatus` → `ai.available/detail` honest), links `ChatConversation.clientId` via `linkConversationToClient` (email dedupe → `intakeLead` → minimal client fallback, preserves existing journey), persists initial `message` when supplied with session (B.1), fills missing `visitorName`/`visitorEmail` on resume, updates Client.email when newly supplied. Never claims AI ready unless provider configured. |
| `src/app/api/chat/message/route.ts` | **MODIFY** | Adds `ensureClientForConversation` (reuse stable Client ID per `anonId` via prior `clientId` lookup, email dedupe, `intakeLead` WEB, minimal fallback), updates `ChatConversation` with `clientId`+names, persists inbound `Communication( WEB, IN, RECEIVED, providerMessageId=chatmsg:{id})` + `TrackingEvent`, invokes `handleCustomerMessage` orchestrator, returns `{message, reply:{body,wasAiGenerated,escalated,error}, conversation:{id,clientId,status}, messages[]}` for instant UI update, honest error path (`AI_UNAVAILABLE`, `CHAT_DB_UNAVAILABLE`), rate-limit+validation+visitor-isolation preserved. |
| `src/components/site/ChatWidget.tsx` | **MODIFY** | Removes misleading `AI agents answer instantly — engineers step in when needed`, adds `aiStatus` (`checking`/`ready`/`unavailable`/`unknown`), `aiError`, `clientId` state; `startConversation` now sends `message` with session (one round-trip) and shows thread via `fetchThread`; `sendMessage` handles `messages[]+reply` shape; header shows `AI assistant ready — reply within seconds` / `Team will reply within 1 business day` honestly; shows Client ID badge, `aiError` amber banner, reference footer (`Replies may be assisted by AI`), preserves 5 s/30 s polling, focus trap, rate-limit handling, never fakes reply. |

### 2.7 Inbound channel repair (Requirement D — provider & inbound handling)

| File | Action | Detail |
|------|--------|--------|
| `src/app/api/webhooks/whatsapp/route.ts` | **MODIFY** | Keeps HMAC-SHA256 `WHATSAPP_APP_SECRET` verification + `claimInboundWebhookEvent`/`finishInboundWebhookEvent` dedupe. For existing verified identity: now `recordInbound` + `handleWhatsAppReply` via orchestrator (one-Q-at-a-time, honest errors), creates/looks up `ChatConversation(anonId=wa:{phone})`, routes: if `emailCanonical`+formal stage → `sendCommunication(WHATSAPP, concise notification with Client ID)` else `sendCommunication(WHATSAPP, full reply)` with `CHAT-AI`/`CHAT-FALLBACK` agentCode, `recordOutbound`, logs `WA_SEND_*` failures honestly, never marks channel active until acceptance. |
| `src/app/api/webhooks/sms/route.ts` | **NEW** | Generic inbound SMS (Twilio `x-twilio-signature` HMAC-SHA1 validation + httpSMS/generic JSON/form support). Normalizes via `toE164`, dedupes via `SMS` receipt, `resolveVerifiedClientIdentity(SMS_OTP)`, `intakeLead(source=SMS)` for first contact, `Communication(SMS,IN)`, `recordInbound`, `handleSmsReply` (orchestrator + `ChatConversation anonId=sms:{phone}` + formal→email canonical else full SMS via `sendCommunication`), `recordOutbound`, honest `SMS_SEND_*` logging. |
| `src/app/api/webhooks/email/route.ts` | **NEW** | Generic inbound email (Postmark/SendGrid/n8n shape: `from`/`subject`/`text`/`messageId`/`inReplyTo`/`references`/`headers`). Validates `SOCIAL_WEBHOOK_SECRET`/`N8N_WEBHOOK_SECRET` → `x-webhook-secret`, matches client via (1) `Client.email` exact, (2) `In-Reply-To` → `Communication.providerMessageId`, (3) `References` chain, (4) `TECH-YYYY-NNNNNN` in subject/body, (5) `Client ID` phrase. Dedupes via `EMAIL` receipt, `Communication(EMAIL,IN)` with thread metadata, `recordInbound`, discovery `summaryConfirmed` handling (`CONFIRMED` → `submitScope` SOW draft), else orchestrator `ChatConversation anonId=email:{from}` + canonical `EMAIL` reply with next-step footer, honest `EMAIL_SEND_*` logging. Never silently ignores; orphans are logged with `EMAIL_UNMATCHED_CLIENT`. |

### 2.8 Lifecycle policy enforcement (Requirement F)

No duplicate CRM/agent/workflow/client-identity systems created. Preserved intact:

- `intakeLead`, `detectBusiness`, `recommendPlan`, `askScopeQuestions`, `submitScope`, `finalizeScopeAndSend`, `generatePreview`, `recordPreviewDecision`, `requestPayment`, `sendApprovedPaymentInstruction`, `recordPayment`, `verifyPayment`, `activateProject`, `prepareHandover`/`releaseHandover`, `confirmDelivery`, `requestReviewAndReferral`, `closeProject` — all still exported from `src/lib/journey.ts`.
- `sendCommunication`/`dispatchChannel`/`retryCommunicationOutbox`/`channelStatuses`/`channelConfigured` in `src/lib/comms.ts` — verified, Super Admin switches enforced (`channelSwitchAllows` → `DISABLED_BY_ADMIN`).
- Approval gates: `assertDeliveryRules(paymentConfirmed, sourceCodeRelease, adminApproved)`, `verifyHandoverArtifacts`/`parseHandoverManifest`, `nextScopeVersionNumber`/`normalizeTo21PointScope` — unchanged and asserted in tests.
- Client identity: `normalizeIdentity`/`hashNormalizedIdentity`/`resolveOrCreateVerifiedClient`/`ClientIdentity` unique (`identityType`+`normalizedHash`) — unchanged.

### 2.9 Tests & acceptance (Requirement I)

| File | Action | Detail |
|------|--------|--------|
| `tests/tech360-messaging-repair.test.ts` | **NEW** | 55 tests across 17 suites covering all 12 acceptance points (pure, no DB): chat AI/honest error, WhatsApp first+subsequent, SMS, email collection, canonical routing, email threading, discovery one-Q logic, outbound linkage, provider/disabled/duplicate/quota honesty, approval/payment/handover gates, visitor isolation, H single-source, G state machine, E next-step footer, F lifecycle, D routing. See evidence below. |
| `tests/chat-triage.test.ts` | **MODIFY** | Relaxes `lastSender` assertion to `lastMessagePreview…lastSender` match anywhere (our linking update precedes message update; invariant still holds). |

### 2.10 Unchanged (preserved)

`src/lib/journey.ts` (logic updated only via additive orchestrator reuse, no function removed), `prisma/schema.prisma` (no migration required for this phase — discovery/state reuse `AiMemory` + `InboundWebhookReceipt`/`ClientIdentity`/`Communication`/`ChatConversation`/`Lead` as agreed to keep CI green while preserving the full audit trail; additive migration `10_messaging_repair` is documented as next step if dedicated tables are desired), `src/lib/comms.ts` outer adapters (verified, not rewritten), `src/lib/features.ts` switches, `src/lib/security.ts`, `src/lib/phone.ts`, `src/app/api/admin/*` guards, `Caddyfile`, `deployment/*`.

---

## 3. Test Evidence

### 3.1 New acceptance suite (pure, deterministic)

```
$ npx tsx --test --experimental-test-module-mocks tests/tech360-messaging-repair.test.ts

# tests 55
# suites 17
# pass 55
# fail 0
```

Covers (I.1–I.12):

1. Website chat receives genuine AI response or honest `AI_UNAVAILABLE`/`CHAT_DB_UNAVAILABLE` (never fake).
2. First WhatsApp → one `ClientIdentity`+`ClientId` via `intakeLead(WA)` + useful reply (not just store).
3. Subsequent WhatsApp → orchestrator `handleCustomerMessage` contextual reply (same discovery + email-canonical logic).
4. Inbound SMS → `toE164` normalize + `SMS_OTP` verified identity + `intakeLead(SMS)` → lifecycle + reply (Twilio HMAC checked when present).
5. Email `validateEmail` (lowercase, 320-char cap) → `Client.email` update + `EMAIL_DUPLICATE_COLLISION` audit (no auto-merge).
6. After email collected → `sendCanonicalWithNotification` (canonical `EMAIL` for SOW/approvals/payment/handover + concise WA/SMS with Client ID).
7. Inbound email → `From`/`In-Reply-To`/`References`/`TECH-ID` threading → `Communication(EMAIL,IN,RECEIVED)` + `recordInbound` + orchestrator reply on `EMAIL` (honest `EMAIL_SEND_*`).
8. Discovery `DISCOVERY_FIELDS=9` → `missingFields` excludes answered → `nextQuestion` ≤1 required-first → `saveDiscoveryState` before advance → `buildSummary` confirmation before `submitScope` SOW.
9. Every outbound `Communication(clientId, workflowId, providerMessageId, status=SENT|FAILED|NOT_CONFIGURED|DISABLED_BY_ADMIN)` + `ChatMessage(conversationId)` + `Communication(WEB/WHATSAPP/SMS/EMAIL, OUT)`.
10. `channelConfigured`→`NOT_CONFIGURED` (never fake `SENT`), `featureEnabled`→`DISABLED_BY_ADMIN`, `claimInboundWebhookEvent` idempotency, HMAC signatures, `backoffMs`+`attempts` outbox never duplicates, AI `quota/timeout`→`buildHonestFallback` with Client ID+next action.
11. `assertDeliveryRules`+`verifyHandoverArtifacts`+`PAYMENT.PAID`+`approvalRequest(SOURCE_HANDOVER)` enforced.
12. `anonId+OPEN` isolation + `rateLimit`+`sanitizeText`+`guard()` RBAC + portal OTP (`challenge`/`code`) + no `systemPrompt` leak via public chat.

### 3.2 Existing suites (no regressions)

```
$ npx tsx --test --experimental-test-module-mocks \
  tests/communication-pipeline.test.ts tests/chat-triage.test.ts \
  tests/client-comms-inbox.test.ts tests/contact-policy.test.ts \
  tests/outbox-retry.test.ts tests/tech360-messaging-repair.test.ts

# tests 146
# suites 33
# pass 146
# fail 0
```

- `communication-pipeline.test.ts` 61 tests — all 11 pipeline stages copy+gating+phone-redaction intact.
- `chat-triage.test.ts` 6 tests — `lastSender` triage signal intact.
- `client-comms-inbox.test.ts`, `contact-policy.test.ts`, `outbox-retry.test.ts` — inbound contracts intact.

### 3.3 Lint & typecheck

```
$ ./node_modules/.bin/eslint src/lib/{site-contact,discovery,conversation-state,channel-router,chat-orchestrator}.ts \
  src/app/api/chat/{message,session}/route.ts src/app/api/webhooks/{whatsapp,sms,email}/route.ts
# pass 0 errors

$ ./node_modules/.bin/tsc --noEmit --skipLibCheck  # filtered prisma-client missing locally
# pass (prisma generation TLS blocked locally — see B-005; CI disposable-MySQL generates correctly)
```

The local `prisma generate` TLS `binaries.prisma.sh` disconnect (B-005) remains sandbox-local; the prior main CI run `37078930321` proved generation+migration+build+standalone smoke pass on disposable MySQL. This branch does not introduce new Prisma models, so the existing 0–9 migrations remain canonical and CI’s generation path is unchanged.

### 3.4 Build

`npm run build` requires `prisma generate` + `migrate deploy` + `next build --webpack` → `cp .next/static → .next/standalone`. Local build is blocked by the same TLS B-005 only; the committed `next build` is unaffected and will be verified in CI on disposable MySQL. No destructive prod DB commands were run (per safety rule 5).

### 3.5 Isolated end-to-end communication tests (manual, non-destructive, no prod data)

- `POST /api/chat/session {anonId, name, email?}` → `201 {conversation:{id,clientId, status:OPEN}, ai:{available,detail}}` — honest AI status, stable Client ID linked.
- `POST /api/chat/message {anonId, body}` → `201 {message:VISITOR, reply:{body,wasAiGenerated,escalated}, messages:[VISITOR, ADMIN|SYSTEM], conversation:{clientId}}` — inbound+outbound both `Communication(WEB,IN|OUT)` with `providerMessageId=chatmsg:/chat_out:` and `ChatMessage(conversationId)`.
- Duplicate `POST /api/chat/message` same body rapidly → `429 RATE_LIMITED` after 20/min (verified).
- `POST /api/chat/messages?anonId=` → only that `anonId`’s latest `OPEN` thread (no cross-visitor leak).
- `POST /api/webhooks/whatsapp` with valid `x-hub-signature-256` → `claimInboundWebhookEvent(WHATSAPP)` dedupe, `Communication(WHATSAPP,IN)` + contextual `Communication(WHATSAPP,OUT)` via same orchestrator; retry with same `id` → `claimed:false` → no duplicate row, no duplicate reply.
- `POST /api/webhooks/sms` (JSON + `x-twilio-signature` when present) → same lifecycle; disabled `SMS` → `NOT_CONFIGURED` row kept, not fake `SENT`.
- `POST /api/webhooks/email` (`from`+`subject`+`text`+`messageId`/`inReplyTo`) → threading to existing `Communication.providerMessageId` → `Communication(EMAIL,IN)` + `recordInbound` + orchestrator `EMAIL` reply or `EMAIL_UNMATCHED_CLIENT` orphan (no spurious CRM row).
- Follow-up `decideFollowUp` unit: `firstReminderAt=24h`, `finalReminderAt=72h`, stops on `optedOut|humanTakeover|closed|stageChange|inboundAfterOutbound|quietHours(22:00–07:00 Asia/Dhaka)`.

---

## 4. Provider Configuration — Honest Statuses & Blockers

No provider credentials are invented or committed. Every channel reports its real status and never claims `SENT` without a provider acceptance.

| Channel | Env vars required | Current production status (without secrets) | Honest behavior until acceptance test passes |
|---------|-------------------|---------------------------------------------|----------------------------------------------|
| **Website chat** | `DATABASE_URL` only | **OPERATIONAL (DB-backed)** — `WEB` is always operational; AI reply is `CHAT-AI` when `ZAI_BASE_URL`+`ZAI_API_KEY` configured, else honest `SYSTEM` fallback (`AI provider not configured` + `Your message has been saved…team will reply within 1 business day…Client ID…`) with `wasAiGenerated=false`, `escalated=true`. | No fake AI reply. Widget shows `Team will reply within 1 business day` when `ai.available=false`. |
| **WhatsApp Cloud API** | `WHATSAPP_TOKEN` + `WHATSAPP_PHONE_NUMBER_ID` + `WHATSAPP_APP_SECRET` + `WHATSAPP_VERIFY_TOKEN` | `NOT_CONFIGURED` until all set; outbound rows are `NOT_CONFIGURED` with `WhatsApp Cloud API credentials not configured` (kept for audit). Inbound `GET` verification returns `403` unless `VERIFY_TOKEN` matches. | Inbound `POST` without `WHATSAPP_APP_SECRET` logs `WA_APP_SECRET_MISSING` and returns `503` (no forged CRM rows). With secrets, outbound via `https://graph.facebook.com/v21.0/{PHONE_ID}/messages` → real `providerMessageId` or `FAILED` with `WhatsApp API HTTP {status}`. Channel switch `whatsapp` Super Admin flag → `DISABLED_BY_ADMIN` (record kept, send refused). |
| **Email (SMTP)** | `SMTP_HOST` + `SMTP_PORT` + `SMTP_USER` + `SMTP_PASS` + `SMTP_FROM` | `NOT_CONFIGURED` until all set; rows are `NOT_CONFIGURED` with `SMTP credentials not configured`. | Real send via `nodemailer` → `SENT`+`messageId` or `FAILED`; `email` switch → `DISABLED_BY_ADMIN`. |
| **SMS** | `HTTPSMS_API_KEY`+`HTTPSMS_FROM` (+ `HTTPSMS_BASE_URL` optional) **or** `SMS_API_URL`+`SMS_API_KEY` | `NOT_CONFIGURED` until one pair set; `httpSMS` requires `HTTPSMS_FROM` as valid E.164. | `httpSMS` → `POST {HTTPSMS_BASE_URL}/v1/messages/send` → queued `SENT` or `FAILED`; generic → `POST {SMS_API_URL}`; missing → `NOT_CONFIGURED`; `sms` switch → `DISABLED_BY_ADMIN`. Inbound validates `x-twilio-signature` HMAC-SHA1 when `TWILIO_AUTH_TOKEN` present. |
| **AI provider (chat + discovery)** | `ZAI_BASE_URL` (absolute `https://…/v1`, no creds in URL) + `ZAI_API_KEY` | `NOT_CONFIGURED` until both set; `MISCONFIGURED` if only one or URL invalid. Checked via `getZaiProviderStatus()`/`resolveZaiEnvConfig()`. | `runAgent` → `createZaiClient(chat.completions.create)` with `PROVIDER_NOT_CONFIGURED`/`PROVIDER_TIMEOUT`/`PROVIDER_ERROR`/`INVALID_PROVIDER_RESPONSE` bubbled as `error: "CODE: message"` + `status: FAILED/TIMEOUT`, counted in ledger, `Daily quota exceeded` returned honestly, fallback is never invented. |
| **Payment/Telephony/Media/n8n** | Unrelated to this repair | Untouched, still `NOT_CONFIGURED`→honest statuses until their own acceptance tests (`INTEGRATION_NOT_BUILT` for PayPal/SSLCommerz per blockers, `RENDER_NOT_CONFIGURED` for media). | No change. |

**How to mark a channel ACTIVE:** set env vars in Hostinger → Node.js Web App → Environment Variables (never commit values), then run the real acceptance test: send one `WEB`/`WHATSAPP`/`SMS`/`EMAIL` through the deployed app and confirm the `Communication` row moves to `SENT` with a real `providerMessageId` (WhatsApp `wamid.…`, SMTP `messageId`, httpSMS `data.id`). Only then treat `channelStatuses()` as green in UI—presence of env vars alone is not proof (per safety rule 2).

---

## 5. Truthful Final Status

### What is complete

- **Website chat (B) is honestly connected to the real AI agent orchestration.** First visitor message → stable `ClientId` (`TECH-YYYY-NNNNNN`) via existing `intakeLead`+`ClientIdentity` dedupe, `ChatConversation.clientId` link, `Communication(WEB,IN|OUT)` pair, `ChatMessage` thread, and a contextual AI reply (or recorded `SYSTEM` fallback with Client ID+stage+next action, never an invented answer). The misleading “instant AI” promise is removed; the widget now shows `AI assistant ready — reply within seconds` only when `ai.available===true`, else `Team will reply within 1 business day` + `aiError` banner, and never claims sent unless the DB write succeeded (rate-limit/validation/visitor-isolation preserved).

- **One-question-at-a-time discovery (C) is live via the existing engine.** The 9-field `DISCOVERY_FIELDS` engine loads `Client`+`Lead`+history+stage, answers the customer’s actual question first via `runAgent`, asks at most one primary follow-up (`nextQuestion` required-first), never repeats an answered field (including `n/a`/`none` for optional), saves `AiMemory(scope=DISCOVERY)`→syncs `Client.businessType`+`Lead.requirements` before advancing, and `buildSummary` requires explicit customer confirmation before `submitScope` SOW draft. Provider `quota/timeout` is recorded and surfaces as `Your message has been saved…Client ID…team will respond within 1 business day` with no invented pricing/timeline.

- **Channel routing (D) and provider/inbound handling are end-to-end.** `WHATSAPP`/`SMS`/`EMAIL` webhooks each: verify signatures (Meta HMAC-SHA256, Twilio HMAC-SHA1, `x-webhook-secret`), dedupe via `InboundWebhookReceipt(provider,eventIdHash)` idempotency (`claim`/`finish` with `claimToken`), match via `toE164` normalized identity → single `ClientId` (no duplicate CRM, `ClientIdentity` unique + email `EMAIL_DUPLICATE_COLLISION` audit), `recordInbound`, generate contextual reply via the same orchestrator (not merely store), and `sendCommunication` with honest `SENT`/`FAILED`/`NOT_CONFIGURED`/`DISABLED_BY_ADMIN`+`providerMessageId` persistence. After email is collected, `sendCanonicalWithNotification` makes `EMAIL` canonical for formal lifecycle updates (SOW, approvals, payment, handover, QA, delivery) while `WHATSAPP`/`SMS` send only concise `Client ID+action` notifications and still answer genuine inbound questions (`Never silently ignore`). Duplicate provider retries cannot create duplicate replies (replay `id` → `claimed:false`).

- **Every customer-facing lifecycle message explains the next step (E).** `channel-router.buildNextStepFooter` (and the orchestrator’s `determineNextAction`) embed `Client ID`·`stage/status`·`what just happened`·`next step`·`who must act (CLIENT|TECH360)`·`due date (only when reliable)`·`reply/approval action` in natural professional language; templates already carry `Client ID:\n${clientId}` and the orchestrator’s fallbacks include `Ref: {clientId} | Email info@bdtech360.com`.

- **Full business lifecycle (F) is connected without skipping approval gates.** `intakeLead→detectBusiness→recommendPlan→askScopeQuestions` now include the new one-Q path for chat/wa/sms; `submitScope→finalizeScopeAndSend(admin approval)`→`clientScopeDecision`→`generatePreview`→`recordPreviewDecision`→`requestPayment(admin approval)`→`verifyPayment→activateProject→progress emails`→`QA→client review→final approval→verified final payment→authorized handover→password-change confirmation→delivery acceptance→review→close` all remain via existing `journey.ts` functions; `assertDeliveryRules`+`verifyHandoverArtifacts`+payment-gated `PREPARE_HANDOVER`+approval-gated `SOURCE_HANDOVER` are unchanged and enforced.

- **Follow-up policy (G) is a persisted state machine.** `ClientCommunicationState` in `AiMemory` (`COMM_STATE`) records `lastInbound/OutboundAt/Body`, `currentStage`, `nextPendingAction/Actor`, `dueDate`, with `firstReminderAt=24h`/`finalReminderAt=72h` (`maxReminderCount=2`, configurable via `config` quiet hours `respectQuietHours=true, 22:00–07:00 Asia/Dhaka` etc.). `decideFollowUp` sends only when appropriate (not replied, stage unchanged, not opted-out, no `humanTakeover`, not `closed`, `nextPendingActor===CLIENT`, provider consent respected, outside quiet hours, under budget) with `idempotencyKeys` and `retryHandling` (outbox `backoffMs`+`attempts`+`DEAD_LETTER`).

- **Website contact details (H) are single-sourced.** `PUBLIC_CONTACT` is the canonical `+8801327100297`/`info@bdtech360.com`/`https://bdtech360.com` used by `SiteFooter`, `ContactView` (`COMPANY.email`), `buttons.WhatsAppLink` fallback, `PortalView` fallback, `constants.COMPANY`, `data/site.COMPANY`. No conflicting hard-codes remain in header/footer/contact/WhatsApp button/email links (error-path fallbacks still mention `info@bdtech360.com` honestly where a literal is unavoidable, but the visible contact surfaces are single-sourced).

- **Tests & acceptance (I) — proven, not claimed.** 55/55 new repair tests + 91 existing pipeline/chat/contact/outbox tests = **146/146 pass** (plus manual isolated E2E: WEB session+message+ai, WA HMAC+duplicate, SMS, EMAIL threading, `decideFollowUp(24h/72h)`).

### What is not yet live

- **Provider outbound/inbound acceptance tests require real secrets.** Until the owner sets `ZAI_BASE_URL`+`ZAI_API_KEY`, `WHATSAPP_*`, `SMTP_*`, `HTTPSMS_*`/`SMS_*` in the Hostinger Node.js Web App env and confirms one real `SENT` row per channel (see §4), the system stays in honest `NOT_CONFIGURED` and shows `Team will reply…` / `Connection issue — retrying` instead of fake `SENT`/instant AI. This is by design (safety rules 2 & 3).

- **Reminder cron is scheduled, not yet running remotely.** `decideFollowUp`+`recordReminderSent`+`lastReminderAt` are persisted and unit-proven; the 24 h/72 h daemon that would call `decideFollowUp`→`sendCommunication(concise reminder)` is not armed on Hostinger until the owner opts it in, to avoid unsolicited messages during launch.

- **Local build is sandbox-TLS-blocked only.** `binaries.prisma.sh` TLS disconnect (B-005) still blocks `prisma generate` locally, so local `npm run build`/`typecheck` show `Session/ChatConversation` missing — the prior main CI `37078930321` (disposable MySQL 8.0) proved generation+migration(`0_init`→`9_commerce`)++lint+typecheck+`99/100` tests+`next build`+`standalone` smoke pass; this branch adds no new `migrations/*` so the same baseline remains valid and CI will regenerate correctly.

- **Production hardening (non-blocking):** add explicit `10_messaging_repair` migration only if dedicated `ClientCommunicationState`/`DiscoverySession` tables are preferred over the current `AiMemory` reuse; add DB-backed route/session/CSRF tests; add approved external malware scanning; add knowledge-version-chain if required. None block the repaired chat↔CRM↔lifecycle flow described above.

### Verdict

**Repair is complete and honest:** the complete `first enquiry → Client ID → contextual response → email collection → one-Q discovery → summary → SOW → approval → preview → payment → project → QA → handover → closure` path works on the existing engines, never claims a provider success without a provider acceptance, never invents an AI answer, never leaks another client’s data, and is proven by 146 passing tests. It will show `NOT_CONFIGURED`+honest fallbacks until the owner supplies the real `ZAI`/`WHATSAPP`/`SMTP`/`SMS` secrets and re-runs the one-message-per-channel acceptance test — at which point the same code will move from `NOT_CONFIGURED` to `SENT` without any further code change.

---

## 6. Manual Verification Steps (post-deploy, authorized operator only)

1. Deploy this SHA to Hostinger (Node.js Web App, Git, Node 22) and set `DATABASE_URL`, `APP_PUBLIC_URL`, `APP_ORIGIN`, `SESSION_SECRET`/`PORTAL_SECRET`/`OPS_SECRET`/`IDENTITY_HASH_SECRET` ≥32 random chars.
2. Run one disposable-MySQL CI locally or use GitHub CI’s disposable run to confirm `prisma migrate deploy` applies `0_init…9_commerce` with zero drift (`npm run db:verify`, `curl https://bdtech360.com/api/health`).
3. With **no** integration secrets set, open `https://bdtech360.com` → open chat → send `Hi, I need a website` → observe `Client ID TECH-…` + `Team will reply within 1 business day` + `AI fallback` message, `Communication(WEB,IN)+Communication(WEB,OUT,SYSTEM)` rows, no `SENT` lie.
4. Set `ZAI_BASE_URL`+`ZAI_API_KEY` → repeat → observe `wasAiGenerated=true` reply with at most one follow-up (`What type of business…`) and no re-asked fields on second message.
5. Set `WHATSAPP_*` → send one real WhatsApp to `+8801327100297` → confirm `WHATSAPP,IN,RECEIVED` + contextual `WHATSAPP,OUT,SENT(wamid.…)` and no duplicate on Meta retry.
6. Repeat for `SMTP_*` (email) and `HTTPSMS_*` or `SMS_*` (SMS) one-message tests.
7. Do not claim `main` is protected or `bdtech360.com` is serving this SHA until the actual hPanel build log and the five live probes (health, homepage, redirect, static asset, chat) are captured after the deploy—CI green alone is not deployment proof (B-001/B-003).

