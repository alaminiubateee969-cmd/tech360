# Central AI SEO + Blog Automation + WhatsApp CRM Command Center

## Goal
Bring multi-brand publishing, SEO operations, lead capture, WhatsApp conversations, campaigns, and workflow automation into one Tech360 admin workspace. This is a target architecture and delivery plan, not a claim that every feature is already implemented.

## Product surface
- Central workspace: `/admin/command-center`
- Website registry: `/admin/command-center/websites`
- SEO and content calendar: `/admin/command-center/content`
- Article review and publishing: `/admin/command-center/publishing`
- WhatsApp inbox: `/admin/whatsapp`
- Contacts and pipeline: `/admin/whatsapp/contacts`
- Campaigns and templates: `/admin/whatsapp/campaigns`
- Automation workflows: `/admin/command-center/automations`
- Reports: `/admin/command-center/reports`

## Initial managed brands
1. ALO Education — Bangladesh students, study-abroad guidance, English and Bangla.
2. Tech360 — technology, product, automation, and service content.
3. alaminn.info — personal brand and portfolio content.

Each brand must have its own domain, logo, tone, audience, language settings, content approval policy, connected channels, analytics IDs, and publishing credentials. Do not assume all brands share credentials or publish to the same destination.

## Core modules

### 1. Website and channel registry
- Register websites and their permitted publishing destinations.
- Store integration metadata and encrypted credentials server-side only.
- Support per-brand RBAC, connection health, last sync, and audit history.
- Never expose API keys in client bundles, browser responses, or logs.
- Keep email DNS/mailboxes unchanged unless the owner explicitly requests otherwise.

### 2. AI SEO and content operations
- Keyword/topic backlog, content briefs, calendar, draft generation, editing, and approval.
- Per-brand voice and audience profiles; Bangla and English support.
- Metadata, canonical URL, structured data suggestions, internal-link suggestions, image alt text, and sitemap checks.
- Duplicate-topic and thin-content warnings.
- Draft, review, approved, scheduled, published, failed, and archived states.
- Record the publishing destination, canonical URL, article ID, timestamps, and errors.
- Measure results through connected analytics/search-console providers when authorized. Do not fabricate ranking or traffic metrics.

### 3. Publishing adapters
Use an adapter interface rather than hard-coding one vendor:
- Native Next.js CMS/blog adapter.
- Outrank hosted blog / Next.js Blog API adapter, optional and only after the owner supplies an account integration key.
- Webhook/API adapters for other CMS destinations.
- Preview before publish, idempotency keys, retries, and an audit event for every publish/update/delete.
- Server-side secrets only. For Outrank Next.js integration, use a server-side variable such as `OUTRANK_BLOG_API_KEY`, never a `NEXT_PUBLIC_` variable.
- Verify each website's routing and deployment architecture before choosing `/blog`, a subdomain, or a separate domain. Do not change production DNS automatically.

### 4. WhatsApp CRM parity scope
Use the existing Tech360 WhatsApp Cloud API foundation and communications ledger as the starting point. Deliver in phases:
- Shared inbox, assignment, internal notes, unread state, department boundaries, quick replies, media and status timeline.
- Contact profiles, tags, custom fields, source attribution, pipeline stages, lead score, CSV import/export.
- Meta-approved templates, template status sync, media library, campaign audience filters, scheduling, pause/cancel, per-recipient reporting and paced dispatch.
- Keyword automation, visual flow builder, greeting/away replies, follow-up sequences, AI-assisted drafting and human handoff.
- Multiple WhatsApp numbers, number/quality/token health, API tokens, signed webhooks and operational logs.
- Consent/opt-out, role checks, audit trails, service-window rules, template enforcement, and per-recipient consent re-check at send time.
- Add Instagram/Messenger only through supported official APIs and approved app permissions.
- Treat calling, catalog/forms, coexistence, and other advanced capabilities as separately scoped integrations requiring provider and account eligibility checks.

### 5. Workflow automation
Create reusable, auditable workflows such as:
SEO topic → content brief → AI draft → human approval → publish → generate social variants → approved distribution → lead capture → CRM attribution → consent-checked WhatsApp follow-up → counsellor assignment → conversion reporting.

Every workflow must support owner, status, trigger, permissions, dry-run/preview where applicable, retry/error queue, pause/disable, execution history, and idempotency. Outbound marketing messages must never bypass consent, template, or rate-limit controls.

### 6. Unified analytics
One cross-brand overview plus per-brand drill-down:
- Content drafted/reviewed/published and publishing failures.
- Search impressions/clicks/rank metrics only from connected data sources.
- Leads by source/campaign, WhatsApp sent/delivered/read/failed, opt-outs, agent workload, response times, and conversions.
- Clearly label unavailable metrics and data freshness.

## Architecture principles
- Keep the existing Next.js + TypeScript + Prisma + MySQL application as the control plane.
- Reuse current RBAC, CRM IDs, communications ledger, audit logs, and n8n integration where appropriate.
- Isolate each provider behind typed adapters and normalized event records.
- Encrypt integration secrets at rest, redact logs, rotate tokens, and validate webhook signatures against raw request bytes.
- Use queue-backed, rate-limited jobs for campaigns and publishing; make retries idempotent.
- Add database migrations and indexes only after reviewing the current Prisma schema and existing constraints.
- Do not store uploaded private student documents in public blog/media folders. Keep private documents in a separate access-controlled storage service.

## Suggested delivery phases
1. **Foundation:** review existing schema/RBAC, add website registry, provider connection records, audit events, adapter interfaces, and feature flags.
2. **Unified dashboard:** build the central overview, brand switcher, connection health, content calendar, and per-brand permissions.
3. **SEO/content MVP:** briefs, drafts, approvals, publish queue, one native publishing adapter, then optional Outrank adapter after credentials are supplied.
4. **WhatsApp inbox MVP:** complete inbox UI and robust thread/message model, deduplication backed by a database uniqueness strategy, delivery status updates, and test coverage.
5. **CRM/campaigns:** contact pipeline, templates, consent, scheduled campaigns, pacing, per-recipient results.
6. **Automation:** keyword rules, follow-up sequences, visual flows, n8n integration, human handoff.
7. **Analytics and hardening:** provider health, reporting, permissions audit, load/security tests, backups, recovery and deployment verification.

## Acceptance gates
- Existing tests, lint, typecheck, build, and migrations pass.
- Role/tenant tests prove one brand's users cannot access another brand's credentials or private records without permission.
- Webhook signature, replay/deduplication, rate-limit, opt-out, service-window, and approved-template tests pass.
- Publishing tests cover preview, approval, idempotency, retry, rollback/error reporting, canonical URL and sitemap.
- No production DNS changes, outbound campaigns, or live publishing until explicitly approved and credentials are configured.
- A staging test is completed before production rollout.

## External integration references
- Outrank Next.js Blog integration: https://www.outrank.so/docs/nextjs-blog
- Outrank Next.js subfolder guide: https://www.outrank.so/free-blog/guides/nextjs
- WabaCRM feature reference for parity planning: https://wabacrm.com/features
- Use official Meta WhatsApp Business Platform APIs for message delivery; do not automate WhatsApp Web.
