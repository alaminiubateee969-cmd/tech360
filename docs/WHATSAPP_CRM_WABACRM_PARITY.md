# Tech360 WhatsApp CRM — WabaCRM Feature-Parity Audit

**Target repository:** engralaminn-collab/tech360  
**Implementation branch:** feature/whatsapp-crm-wabacrm-parity  
**Product:** Native Tech360 CRM module, not a WabaCRM account or browser extension.  
**Runtime:** Existing Next.js 16 / Node.js 22 / TypeScript / Prisma / MySQL application. Keep the existing CRM, authentication, RBAC, client IDs, communications ledger, n8n bridge and audit trail.

## Ground rules

- Use the official Meta WhatsApp Business Platform / Cloud API only. Do not automate WhatsApp Web or use browser extensions, session cookies, QR scraping or unofficial phone-farm APIs.
- The business owns its Meta Business Portfolio, WhatsApp Business Account, phone numbers, app and billing method.
- Never report a message as sent/delivered/read until the provider response or status webhook confirms it.
- Apply Meta's 24-hour customer-service window and approved-template rules on the server, not only in the UI.
- Enforce opt-out and consent at campaign dispatch time, not just when a campaign is created.
- Verify webhook HMAC signatures against the exact raw request bytes, deduplicate provider event/message IDs, rate-limit endpoints and record security-relevant actions.
- Do not log access tokens, app secrets, full authorization headers or unnecessary message content.
- New tables must be added with reviewed Prisma schema changes and migrations; never mutate production data manually or run migrations against production as a test.

## Repository baseline inspected

Existing foundations were found in main:

- src/app/api/webhooks/whatsapp/route.ts: GET verification, HMAC-SHA256 signature validation, inbound message intake, provider-status updates and CRM linking.
- src/lib/comms.ts: WhatsApp Cloud API text send adapter and channel configuration checks.
- src/app/api/admin/communications/route.ts: RBAC-protected communications ledger/filtering.
- src/app/api/admin/communications/send/route.ts: manager-authorized manual outbound messaging.
- Client and Communication Prisma models: existing CRM records, provider message IDs, direction and status.
- .env.example: WhatsApp token, phone-number ID, app secret and verify token already named.

These are foundations, not proof that the complete WabaCRM feature set already exists. A complete interactive shared inbox, template/campaign engine, flow builder, multi-number management, health monitor and mobile client were not verified during this initial code-path audit.

## Feature parity matrix

Status meanings: **Existing foundation** = relevant code is present but requires tests; **Build** = implementation is still needed; **External dependency** = requires Meta approval/credentials or another provider.

| Area | WabaCRM capability to reproduce | Tech360 status / implementation notes |
|---|---|---|
| Shared inbox | Unified conversation view, assignment, unread state, 24-hour window timer | Build WhatsApp-specific inbox UI/API using Communication as the message ledger; do not confuse existing website live-chat conversations with WhatsApp threads. |
| Team operations | Multiple agents, availability, least-busy routing, departments, quick replies, per-number visibility | Build assignment/department models and enforce access on every API query/action. |
| Contacts CRM | Auto-create contacts, source, tags, groups, custom fields, configurable stages, lead score, CSV import | Existing Client/Lead/pipeline foundations; add tag/group/custom-field and safe import flows without duplicating clients. |
| Identity & dedupe | Normalize E.164 numbers, map WhatsApp IDs to existing Client IDs, idempotent inbound events | Improve current webhook with unique provider IDs and transaction-safe upsert/deduplication. |
| Templates | Header/body/footer/buttons, variables, media headers, approval status sync | Build template CRUD/preview/sync; Meta owns approval. Never imply an unapproved template can be sent. |
| Campaigns | Audience filters, approved-template broadcast, merge fields, scheduling, pause/cancel, per-recipient report, rate limiting | Build persisted campaign/recipient/dispatch queue and resumable workers. Re-check consent, template status and provider limits immediately before each send. |
| Drip campaigns | Multi-step sequence and per-day sending cap | Build campaign steps, timezone-aware schedules, idempotent jobs, cancellation and audit records. |
| Keyword bots | Exact/contains triggers, cooldown, number scope, one response per inbound event | Build deterministic rules with priority, cooldown, recursion prevention and STOP/START reserved handling. |
| Visual flow builder | Branching steps, text/media/buttons/location/CTA and AI handoff | Build versioned flow graph, validator, draft/publish workflow and simulation before activation. |
| Greetings & away messages | First-contact welcome, business-hours response and cooldown | Build per-number/business-hours rules; templates required when outside the service window. |
| Follow-up automation | Follow up on quiet conversations | Build opt-in-aware delayed jobs that re-check consent and the service window at send time. |
| AI agent personas | Sales/support persona, bounded turns, knowledge base, human takeover | Integrate existing Tech360 AI governance/approval. AI may draft; external sends must follow configured policy and hand off immediately when a human responds. |
| Media library | Upload/reuse image, video, document and template media | Build private storage, MIME/size validation, malware scanning where available, Meta media IDs and expiry/error handling. |
| Multiple numbers | Embedded Signup, coexistence, own credentials, number-scoped access | Build number registry and per-number configuration. Embedded Signup/coexistence depend on Meta app configuration and approval. Never expose tokens to the browser. |
| Webhooks & API | Signed webhook forwarding, API tokens, redelivery/logs | Existing inbound webhook exists; build outbound signed event delivery, named/revocable integration tokens, scopes, retries and delivery logs. |
| Status & health | Sent/delivered/read/failed, quality/tier/token expiry alerts | Current webhook updates communication status; add canonical status mapping, reconciliation, hourly checks and owner alerts. Token expiry visibility depends on Meta token type/permissions. |
| Calling | Browser calling and call log | Optional later phase; depends on Meta WhatsApp Business Calling eligibility and required API support. |
| Messenger/Instagram inbox | Additional social channel inbox | Separate Meta permissions and webhooks; reuse shared inbox abstraction only after WhatsApp access controls are correct. |
| WhatsApp forms/catalog | In-chat forms, catalog/cart orders | Optional later phase; requires applicable Meta product permissions, payload support and business configuration. |
| Mobile app | Android agent inbox | Later phase; first ship responsive PWA/inbox and stable authenticated APIs. |
| Reporting | Campaign, agent, source, delivery and conversion metrics | Build from authoritative event records; distinguish queued, sent, delivered, read, failed and skipped. |
| Security/governance | RBAC, audit trail, privacy, retention and opt-out | Extend existing guard/audit helpers; add retention controls and export/delete workflows. |

## Delivery sequence

### Phase 0 — safe baseline and integration validation
1. Verify the existing webhook, outbound sender, status callback and environment-variable behavior.
2. Add replay/idempotency protection for provider message IDs and inbound events.
3. Define canonical message status transitions and tests for signature failure, malformed payloads, duplicate delivery, opt-out and provider failures.
4. Confirm that missing credentials produce an honest NOT_CONFIGURED state.

### Phase 1 — native WhatsApp CRM core
1. Add reviewed Prisma models/migrations for WhatsApp numbers, conversations, agent assignments, templates, tags/groups, consent events and webhook event IDs.
2. Implement a responsive shared inbox, search/filter, message timeline, assignment, quick replies and 24-hour service-window indicator.
3. Add message/media send support and provider status reconciliation.
4. Enforce department/number permissions on server-side reads and writes.

### Phase 2 — campaigns and automation
1. Implement template sync and approval-aware campaign composer.
2. Add audience segmentation, recipient snapshots, per-recipient outcomes, scheduling, pause/cancel, pacing and retry/dead-letter handling.
3. Add keyword bots, greetings, away replies, follow-ups and opt-out handling.
4. Add dry-run/simulation and admin approval for high-volume campaigns.

### Phase 3 — advanced parity
1. Visual flow builder and AI persona/knowledge base with human takeover.
2. Signed outbound webhooks, scoped API tokens and delivery logs.
3. Multi-number Embedded Signup/coexistence, health checks and alerts.
4. Messenger/Instagram, forms/catalog, calling, and mobile/PWA expansion as separate permission-gated workstreams.

## Acceptance criteria

- Every inbound Meta event is signature-verified, safely parsed and idempotently stored.
- Duplicate webhooks never create duplicate communications, contacts or campaign outcomes.
- Every outbound message is associated with a client, number, actor/automation, policy decision and provider ID where supplied.
- Campaigns exclude opted-out contacts and re-check consent and template/window policy at send time.
- Only approved templates are sent outside the 24-hour customer-service window.
- A user cannot read or send from a number/department outside their authorization, even by calling an API directly.
- Message state is never fabricated; failed/unknown provider results remain explicitly failed/unknown.
- Secrets are server-side only, and webhook/API integrations are revocable and auditable.
- Tests cover webhook signatures, duplicate events, rate limits, status transitions, consent, template/window enforcement, RBAC and campaign cancellation.
- No production deployment is declared complete until CI, migration review, Meta test-number end-to-end testing and rollback/backup checks pass.

## External dependencies still required

Implementation alone cannot activate production messaging. Configure a Meta developer app, WhatsApp Business Account, phone number, permanent/system-user token as appropriate, app secret, webhook subscription and approved templates. Meta may require business verification, permissions and review. Meta message charges and eligibility are controlled by Meta, not Tech360.
