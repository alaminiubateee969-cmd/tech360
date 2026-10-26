# Tech360 Unified Business OS: Architecture, Reference Audit & 90-Day Plan

## Executive goal

Build one first-party Tech360 operating system for:
- Unified CRM and customer identity
- Website live chat from day one, with WhatsApp added later by environment configuration
- Unified communication timeline and secure client documents
- Social account connection, content calendar, cross-channel campaign composer, approval and analytics
- SEO research, blog/content production and publishing
- One AI router, one company-wide orchestrator, department-specialist AI employees, shared governed knowledge and measurable learning
- Integrations that honestly show NOT_CONFIGURED / NEEDS_AUTH / CONNECTED / DEGRADED / ERROR

This document is a plan and repository-reference review, not a claim that every feature is already implemented. The current feature branch has a command-center MVP foundation; production integrations and the majority of this plan still require code, credentials, migrations and testing.

## Product rules

1. Start without a WhatsApp number. Website chat and CRM must work independently.
2. Credentials are optional per integration. Blank credentials mean NOT_CONFIGURED, not a fake connected state.
3. When valid environment configuration is added, perform a health check and expose setup/connection status. OAuth providers still require consent, redirect URL configuration, scopes and sometimes a manual authorization callback. Never infer a live connection from a non-empty token alone.
4. All inbound/outbound communications should link to one Client identity where known. Anonymous website visitors get a temporary visitor/session identity until a user voluntarily identifies themselves; never silently merge identities based on weak signals.
5. Every channel adapter uses a common internal contract, but platform-specific permissions and features must remain visible.
6. Every AI task uses one internal AI Router. Feature code must not call providers directly.
7. Free usage is preferred, but "free forever" is not guaranteed. Provider quotas, rate limits, model availability, terms, and privacy rules can change. No unofficial or stolen-key APIs, account sharing, scraping private content, or attempts to evade rate limits.
8. Fail over only to an explicitly configured, healthy, policy-compatible provider. Track quotas per provider/key/model, use circuit breakers and bounded retries, and stop rather than silently incur charges.
9. Never send sensitive client documents, passports, bank statements, immigration records, or private CRM data to a third-party AI provider unless the provider is explicitly approved for that data class.
10. Agents do not self-modify production code, policies, permissions or their own evaluation criteria. They learn through reviewed knowledge, feedback, evaluated skills and versioned prompts.
11. Drafting and analysis can be automated. External side effects such as publishing, sending campaigns, deleting/archiving records, or changing CRM identity require explicit permission and configured approval rules.
12. All activity is attributable: task runs, model/provider, usage, decisions, approvals, tool calls, connector status, errors and changes are logged with sensitive data redacted.

## Current project inspection (limited to files fetched on the feature branch)

Inspected:
- `package.json`: Next.js 16, React 19, TypeScript, Prisma 6, test/lint/typecheck scripts, Node 22 requirement.
- `.env.example`: existing core, communications, WhatsApp, SMTP, SMS, a few social tokens, n8n and media-provider variables.
- `src/lib/comms.ts`: channel status/send adapter pattern; currently supports WhatsApp, SMTP email, SMS and basic token-presence checks for Facebook/Instagram/LinkedIn/X.
- `src/app/api/webhooks/whatsapp/route.ts`: verifies Meta webhook signature and processes inbound text/status; current implementation uses a best-effort duplicate check, and a message with media is currently represented by a placeholder rather than an actual downloaded file.
- `src/app/admin/command-center/page.tsx`: central command-center UI foundation.

A missing opening object brace in the WhatsApp `fetch()` options was found and corrected in `src/lib/comms.ts` on this feature branch. This is a source edit, not proof that typecheck/build now passes. The repository has not been checked out and executed in this session.

Not verified in this review:
- Full repository-wide implementation and schema behavior
- Actual provider credentials, OAuth grants, Meta app review, webhooks, live sends or publishing
- CI/typecheck/lint/build/E2E status after the latest commit
- Production deployment, data migration safety, and live integration status

## Competitor / open-source patterns to learn from

Use these as reference patterns, not as a promise to clone every feature. Inspect licenses and dependencies before copying code. Prefer integrating a mature component when its license, security and architecture fit; otherwise implement the compatible design pattern in Tech360.

| Reference | Learn from it | Demo / official docs |
|---|---|---|
| Chatwoot | Omnichannel inbox, website live chat, agent assignment, channel-specific inboxes, customer identity and conversations | https://www.chatwoot.com/features ; https://app.chatwoot.com |
| Buffer | Multi-account social composer, channel-aware publishing, calendar, analytics and approval/team workflow patterns | https://buffer.com ; https://buffer.com/pricing |
| ToolJet | Internal dashboards, workflow nodes, role-based access, data-source connectors and agent tooling | https://tooljet.com ; https://docs.tooljet.com/docs/getting-started/platform-overview/ |
| n8n | Event-driven workflows, schedules, webhooks, integrations and human approval nodes | https://n8n.io ; https://docs.n8n.io |
| OpenRouter | Multi-model/provider routing and ordered provider fallback controls | https://openrouter.ai ; https://github.com/OpenRouterTeam/docs/blob/main/guides/routing/provider-selection.mdx |
| LiteLLM | Self-hostable gateway patterns, provider routing, budgets and rate/latency-aware selection | https://docs.litellm.ai/docs/routing |
| Twenty CRM | Modern open-source CRM entities and pipeline UX | https://github.com/twentyhq/twenty |
| Frappe CRM | Lead/contact/deal workflow and extensible CRM patterns | https://github.com/frappe/crm |
| Open SEO (provided list) | SEO workflow and content operation patterns; review exact scope/license before adoption | https://github.com/every-app/open-seo |
| MoneyPrinterTurbo (provided list) | Video-generation workflow concepts only; assess model costs, content rights, dependencies and license | https://github.com/harry0703/MoneyPrinterTurbo |
| OpenViking (provided list) | Context/memory storage patterns; evaluate security and data isolation | https://github.com/volcengine/OpenViking |
| RSSHub (provided list) | Public feed ingestion where source terms permit | https://github.com/DIYgod/RSSHub |
| Firecrawl (provided in notes) | Website crawling/extraction patterns; honor robots, terms, rate limits and privacy | https://github.com/firecrawl/firecrawl |
| Education repositories (provided list) | Education/admissions domain UX and enquiry flows; verify each repository separately | https://github.com/nabaleducation/EducationConsultancyWebsite ; https://github.com/Bhawana0218/NextStep-Abroad |

The attached research list contains many more projects across CRM, education, agents, media, productivity, and integrations. It is a source inventory, not proof that every repository has been cloned, built, audited, or licensed for reuse. This review prioritizes reference architectures directly relevant to the requested product; a repository-by-repository license/security/code audit is a separate workstream.

## Module A: Website chat first, WhatsApp later

### Website chat requirements
- Embeddable, responsive widget for Tech360 and each managed brand/site.
- Visitor welcome, pre-chat form, language choice, offline lead capture and consent notice.
- Real-time conversation updates, typing indicator where supported, attachments with size/type limits, delivery/read states where supported, agent handoff, internal notes, canned replies, labels, assignment, business hours and SLA.
- Persistent conversation timeline linked to CRM client after verified identity; anonymous visitor history remains separate until consented identity linking.
- Staff inbox with unread count, search, filters, assignment, saved replies, conversation status and full audit history.
- Accessible mobile and desktop UI; keyboard navigation and localization.
- Rate limiting, abuse protection, spam filtering, safe upload scanning and retention rules.
- Install snippet that identifies the site using a public widget ID, not a secret. Server validates allowed domains and tenant/brand scope.

### WhatsApp activation
- If `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_APP_SECRET`, and `WHATSAPP_VERIFY_TOKEN` are absent, mark WhatsApp NOT_CONFIGURED and keep website chat working.
- If values are present, validate configuration, show NEEDS_WEBHOOK_TEST until Meta's webhook verification and signed test event succeed, then show CONNECTED only after a successful health test.
- Support message statuses, idempotent inbound handling, client matching/creation, media download, service-window checks and template approvals.
- Meta app setup, business verification, permissions, phone-number registration, webhook URL and subscriptions remain external prerequisites.
- Never use unofficial WhatsApp Web scraping/automation.

## Module B: Unified social media command center

### Account connection
A brand can connect multiple supported accounts from a central Integrations screen. Use official OAuth where offered, encrypted token storage, least-privilege scopes, expiry/refresh handling, reconnect prompts, revoke/disconnect, and health status. Legacy static token variables are a transitional compatibility mechanism, not the final multi-account token vault.

Candidate channels:
- Facebook Pages / Messenger
- Instagram professional accounts / DMs
- LinkedIn Pages and permitted profile publishing
- X
- TikTok
- YouTube / Shorts
- Pinterest
- Threads
- Telegram
- Bluesky / Mastodon
- Website blog / RSS
Only show capabilities that the official API and granted scopes actually support. Some channels support publishing but not DMs, analytics, or automatic publishing for every account type. Never claim universal API parity.

### Marketing Studio
- Multi-brand campaign brief with goal, audience, language, CTA, destination URL, offer and campaign dates.
- One content concept transformed into channel-specific captions, character limits, hashtags, alt text, creative dimensions and posting variants.
- Media library and brand kits (logos, colors, voice, prohibited claims, approved CTA).
- Calendar with draft / needs-review / approved / scheduled / publishing / published / failed states.
- Preview each platform separately before scheduling.
- Human approval and role-gated publishing; scheduled queue, retries with idempotency, rate limiting and cancel/pause.
- Track post URL, provider ID, publish result, errors, engagement metrics when officially available.
- Separate content generation from publication. No external post is sent merely because an AI generated it.
- Campaign analytics, UTM builder, attribution and lead-to-campaign reporting.
- Email/newsletter, blog, SEO landing pages and WhatsApp template campaigns are separate channel workflows with their own consent/compliance checks.

## Module C: AI Router: free-first, quota-aware, controlled failover

All AI features call a single internal API such as `aiRouter.generate(task, policy)`. Feature code never imports provider SDKs directly.

### Suggested provider tiers
1. **Local/private:** Ollama or another approved local inference server for low-risk, privacy-sensitive tasks when hardware/model quality permits.
2. **Configured free-tier providers:** only provider keys/accounts the owner deliberately configured and whose current terms allow the intended use.
3. **Aggregator route:** OpenRouter or another approved gateway, with explicit provider order and data-policy settings.
4. **Paid fallback:** disabled unless the owner explicitly configures a budget and enables it.
5. **No eligible provider:** return a clear AI_UNAVAILABLE / QUOTA_EXHAUSTED status and queue or ask for manual handling. Do not pretend a task succeeded.

### Routing sequence
- Classify task: code, general reasoning, SEO, classification, translation, image/audio, extraction, or private-data task.
- Check policy, task capability, provider availability, allowed data class, context size, latency target and remaining quota.
- Select an eligible provider using priority, health, cost, quota and model capability.
- On 429/quota exhausted, transient 5xx, timeout or provider outage: bounded exponential backoff, mark provider cooldown/circuit-breaker state, then try the next eligible provider.
- Do not retry permanent 4xx, safety blocks, invalid credentials or malformed requests indefinitely.
- Avoid duplicate side effects. AI retries must not double-publish, double-send or double-create CRM records.
- Track provider/model, request IDs, latency, token usage where available, estimated cost, quota/error code and fallback reason. Never log API keys or full sensitive prompts.
- Use idempotency keys for queued jobs; use daily/monthly hard budgets, per-department limits, and alerts. Paid providers remain disabled by default.
- A provider's quota reset is not guaranteed at an exact time unless its API documents that behavior. Refresh health/quota observations periodically.
- Prefer one internal router or an approved gateway, not several competing routers with conflicting fallback rules.

### Configuration contract (names are proposals until implemented)
- `AI_ROUTER_ENABLED`
- `AI_PROVIDER_ORDER`
- `AI_ALLOW_PAID_FALLBACK=false`
- `AI_DAILY_BUDGET_USD=0`
- `AI_MAX_RETRIES=2`
- `AI_EXTERNAL_DATA_POLICY=restricted`
- `OLLAMA_BASE_URL`, `OLLAMA_MODEL`
- `GEMINI_API_KEY`, `GROQ_API_KEY`, `CEREBRAS_API_KEY`, `OPENROUTER_API_KEY`, `MISTRAL_API_KEY`
Do not add all keys just because the names exist here. Implement each provider adapter with a health check and tests before listing it as supported. Store actual secrets only in the hosting environment/secret manager, never in Git, browser code, prompts or chat.

## Module D: One AI mode, specialist AI employees by department

### One interface, many controlled specialists
One company-wide chat/command interface accepts requests in natural language. A deterministic policy/router identifies intent and routes work to a specialist. Specialists share approved company context, but each has explicit tools, data access, output schema, budget and approval policy.

Initial department map:
- Executive / Operations
- Sales and CRM
- Customer Support / Website Chat
- WhatsApp and Communications
- Marketing and Social Publishing
- SEO and Blog
- Content / Design / Video
- Admissions / Education Consultancy
- Research / Knowledge Management
- Finance (read-only analysis by default)
- HR / People Operations (restricted)
- Engineering / DevOps (read-only diagnostics by default)
- Compliance / Quality Assurance
- Analytics / Reporting

Each AI employee definition includes: department, purpose, allowed tools, denied actions, knowledge collections, prompt version, model policy, budget, SLA, approval requirement, tests, owner, run history and outcome metrics. Avoid creating dozens of fake agents that are only labels; each listed employee must have a real, testable runtime and observable task history.

### Shared memory and learning
- Store approved SOPs, policies, brand voice, product data, resolved cases, validated FAQ, and reviewed lessons in a versioned knowledge base.
- Retrieval is tenant/brand/department scoped with source citations and access checks.
- Store feedback with task IDs and the version of the prompt/skill used.
- Convert repeated successful workflows into candidate skills; run regression and safety evaluations before promoting them.
- Maintain short-term task state, long-term reviewed knowledge and agent execution history separately.
- Add scheduled evaluations for correctness, hallucinations, privacy leaks, tool permission violations, latency, cost and success rate.
- Use explicit human approval for memory promotion and policy changes. Never learn from arbitrary inbound messages as trusted instructions.
- Prompt injection in emails, social posts, uploaded documents and web pages must be treated as untrusted data.
- Shared memory is not shared permission: agents must still enforce record-level access.

## 90-day staged delivery

### Days 1–15: foundations and visible demo
- Audit current schema, API routes, auth/RBAC, integration status, and existing UI.
- Add seeded demo mode with realistic fictional records and obvious DEMO labels; demo data never mixes with production tenants.
- Implement truthful connector registry and integration settings page.
- Deliver website chat MVP, unified inbox shell, visitor-to-client linking flow, and persistent communication timeline.
- Fix existing compile/test blockers; add typecheck/lint/build/critical tests in CI.
- Add provider-neutral AI router interface and one tested provider adapter plus mock adapter.
- Acceptance: app runs without WhatsApp/social/AI credentials; no fake Connected statuses; website chat demo works locally.

### Days 16–30: CRM and channel foundation
- Complete client identity matching, lead/client auto-creation, duplicate protection, audit ledger and attachment metadata.
- Complete secure private object storage interface and malware-scanning/quarantine workflow.
- Implement WhatsApp Cloud API behind optional env config, webhook signature verification, status updates, 24-hour reply rules, and media retrieval.
- Add first official social OAuth/publishing adapter selected by real business priority.
- Acceptance: each integration can be absent without breaking the app; signed webhook replay does not duplicate records; client-scoped access tests pass.

### Days 31–45: Marketing Studio
- Build multi-brand/account registry, brand kits, channel-specific content composer, media library, approval queue, calendar, scheduled jobs and publish results.
- Add the next official social connectors only after permissions/scopes and test accounts are available.
- Add SEO brief, keyword/research workflow, blog draft, metadata preview, internal-link suggestions and publishing adapters.
- Acceptance: draft -> review -> approve -> scheduled -> provider response states are audited; retries do not double-publish.

### Days 46–60: provider failover and department agents
- Implement configured provider adapters, quota/error classification, circuit breakers, bounded retries, budgets and usage dashboard.
- Add task router, department registry, specialist tools, shared approved knowledge and job queue.
- Add approval gates and permission tests for any tool that sends, publishes, changes or exports data.
- Acceptance: mocked quota exhaustion moves to the next eligible configured provider; if none exists, job fails honestly without charges or false success.

### Days 61–75: AI learning and quality controls
- Add feedback capture, reviewed memory/skill proposals, regression evaluation, prompt/skill versioning and quality/cost dashboard.
- Add document OCR/extraction and version comparison with human review.
- Add scheduling, retry queues, failure recovery, retention, backups and restore tests.
- Acceptance: agent learning is auditable, reversible and evaluation-gated; no self-authorized production policy/code changes.

### Days 76–90: hardening and staged release
- Run security review, RBAC/tenant-isolation tests, webhook tests, provider failure tests, accessibility review and load tests.
- Run a limited staging pilot with test channels and fictional or explicitly approved test records.
- Confirm backups/restores, alerting, retention rules, incident playbook and manual fallback.
- Release only the modules whose acceptance tests pass. Unfinished integrations remain clearly labelled NOT_CONFIGURED / BETA / NOT_READY.

A 90-day target is a delivery roadmap, not a guarantee that a fully autonomous, reliable agent for every department will be achieved in three months. Scope depends on team capacity, APIs, credentials, data quality and evaluation results.

## Global acceptance criteria

- Website chat and CRM work with no WhatsApp number or social credentials configured.
- Adding valid integration configuration activates a testable setup flow, not a fake Connected badge.
- One client profile shows all authorized channel conversations and attachment references.
- One social post can be adapted and previewed per selected channel, reviewed, scheduled, and tracked separately per provider.
- Provider failover occurs only on classified transient/quota errors, only across configured policy-compatible providers, with budget enforcement and no duplicate side effects.
- One AI mode routes to real specialist runtimes; department agents have bounded permissions and auditable runs.
- Knowledge/skills can be reviewed, versioned, evaluated, rolled back and traced to source material.
- Sensitive data is never sent to unapproved external providers.
- Typecheck, lint, build, unit, integration, migration and end-to-end tests pass before production deployment.
- No live publishing, customer messaging, database migration or DNS/email change without explicit approved deployment steps.

## Next implementation sequence

1. Complete repository/schema/security audit and make CI green.
2. Build integration registry + honest status checks.
3. Deliver first-party website chat and unified communication ledger.
4. Implement secure attachment/document processing.
5. Add optional WhatsApp connector and prove it on Meta test assets.
6. Build social composer/calendar and one channel adapter at a time.
7. Add the single AI router, quotas, fallback and budget controls.
8. Add department agents and supervised knowledge/skill learning.
9. Expand integrations based on real usage and test evidence.
