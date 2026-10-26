# Tech360 Reference Coverage Audit and Implementation Backlog

**Branch:** `feature/whatsapp-crm-wabacrm-parity`  
**Purpose:** Turn the full user-supplied reference inventory into a traceable, license-aware backlog for Tech360.  
**Evidence standard:** “Implemented” means present in the current source and validated. A link in this document, a screenshot, a placeholder environment variable, or a UI label is not implementation evidence.

## Repository baseline snapshot

The inspected project is a Next.js 16 / React 19 / TypeScript app using Prisma 6 and MySQL, with Node 22 required in `package.json`. The feature branch has an admin command-center MVP and WhatsApp Cloud API basics. Existing dashboard content is stored as drafts; approval does not publish. The current channel status helper primarily checks configured credentials rather than performing provider health checks. The social environment variables are placeholders, not OAuth integrations.

The latest known PR #1 head is not verified by CI in this session. Do not merge or deploy based on this document alone. A complete repository-wide code/schema/security review and execution of typecheck, lint, build, migration tests, and E2E tests remain mandatory.

## User-provided product references: capability mapping

These are feature inspirations, not permission to copy proprietary UI/code/data. Inspect each repository's current license, dependencies, security posture, and architecture before reusing any code. Links to commercial websites indicate product patterns only and do not confer API access or rights to clone them.

| Reference(s) | Reusable product pattern | Tech360 target module | Current status in inspected branch |
|---|---|---|---|
| Buffer | Multi-account social calendar, per-channel composition, approvals, publishing and analytics | Marketing Studio | Not implemented; OAuth variables are placeholders |
| Qwen Coder, Cline, Cline plugins | Coding workspaces, tool use, approval gates, model choice and task history | AI Workbench / Dev Agent | Not verified as implemented; do not allow autonomous production writes |
| Stack Overflow | Searchable knowledge, source attribution, tags and Q&A | Knowledge Centre | Not verified; integrate only via authorized API/allowed use, not scraping |
| Mureka | Prompt-driven music, voice and media generation workflows | Creative Studio | Provider adapter and licensing checks required |
| Meta AI / Astryx | Multimodal assistant patterns | AI Workbench | No verified integration; use official accessible interfaces/APIs only |
| OpenRouter | Multi-model selection and fallback | AI Router | Environment placeholders only; router not implemented |
| Enerpize | ERP-style finance, inventory, operations and reporting patterns | Operations / ERP | Audit current Tech360 modules before adding overlapping systems |
| AIPraktor | Domain-specific AI workflow pattern | AI Workbench | Exact product scope and integration availability require validation |
| Supercool / join.supercool.com | AI-assisted creative/product workflow inspiration | Creative Studio | Not implemented; clarify exact feature set via product-specific review |
| Hatchable | App primitives for auth, DB, storage, jobs and AI | Platform foundation | Do not assume their backend is reusable; compare architecture and cost |
| HetrixTools | Uptime, server, SSL/domain and email reputation monitoring | Operations Health | Not integrated; optional monitoring provider or native checks |
| Mat3ra | Scientific/computational workflow and job tracking | Specialized workflow reference | Domain-specific; not a default CRM feature |
| Refine.ink | Multi-pass AI review and argument/consistency checks | AI Quality Gate | Not implemented; can implement independent review pipeline, no result claims borrowed |
| Lark Suite | Docs, messaging, tasks, calendar and workflow collaboration | Team Workspace | Not verified; evaluate integration vs rebuilding overlapping collaboration features |
| ToolJet | Internal apps, workflows, data-source connectors and role-aware dashboards | Integration/workflow builder | Not embedded; reference implementation patterns only |
| Hugging Face Education Toolkit | Tutorials, hands-on AI learning and demos | Learning Lab / onboarding | Reference repo is archived; content reuse requires license review |
| Omarchy | Opinionated Linux workstation/system configuration | DevOps documentation only | Not a business app feature; no OS changes from this product plan |
| Diagram Design | Diagram and visual-flow patterns | Workflow/diagram builder | Audit repository license/code before reuse; current visual builder not verified |
| OpenLogi | Operations/logistics workflow ideas | Operations integrations | Exact scope/license require repository review |
| OpenViking, ai-memory, llm_wiki, Hindsight, rta-smriti, SiYuan | Searchable context, memory, notes and knowledge organization | Governed Knowledge / Memory | No verified unified memory subsystem; implement tenant-scoped, source-cited, versioned knowledge |
| VoiceStudio, LiveTalk, smalltalk, VoIP/SIP, Linphone, Jitsi Videobridge, SMS/httpSMS | Speech, calling and messaging channel patterns | Voice & Communications | Some basic SMS/WhatsApp code exists; voice/call features not verified |
| Public APIs, RSSHub, Firecrawl, OpenProspector, Open Enrich, market-intelligence-radar, n8n lead enrichment | Discovery, feeds, crawl/enrichment and workflow triggers | Research/Enrichment Connectors | Not verified; only permitted public data, source terms, rate limits and privacy-aware use |
| MoneyPrinterTurbo, Hyperframes, Remotion, VideoCaptioner, Pixelle-Video, VideoCode, 3b1b/videos, CogVideo, HunyuanVideo, LTX-Video, InfiniteTalk, VideoAgent, OpenReel, ComfyUI VideoHelperSuite, assorted VideoMaker repos | Media and video creation pipelines | Creative Studio / Media Jobs | No verified integrated pipeline; model/hardware costs, generated media rights, safety and job queue required |
| open-seo, marketingskills, Ghost, Umami | SEO, campaign operations, publishing and privacy-aware analytics | SEO & Growth | Content draft/review exists; live CMS publishing and source-backed analytics are not verified |
| CRM references: DeskcommCRM, Django-CRM, Odoo CRM, thu-ml/CRM, dennisivy/crash-course-CRM, Oro CRM, TryCompAI CRM, Frappe CRM, ChurchCRM, CRMEB, IDURAR, Fat Free CRM, Twenty, WACRM, ALO education repositories | Contact/pipeline, task, role and CRM UX patterns | Core CRM | Tech360 already has CRM/client/project models; perform model-by-model gap audit before adopting another stack |
| Education repositories: nabaleducation/EducationConsultancyWebsite, StudyTra, NextStep-Abroad, university, bugcrowd_university | Education lead capture, university and student workflows | Education/Admissions vertical | Separate domain-specific product integration; not assumed present in Tech360 |
| AI agent frameworks: MetaGPT, Ruflo, ECC, Claude plugins community, context-mode, scientific-agent-skills, Minimind, Open Claude | Agent orchestration, skills and tool contracts | Department AI Employees | Not verified as end-to-end governed runtime; review license, tool risk and model assumptions first |
| PI-Desktop, ArmorPaint, vphone-cli, omarchy | Desktop/creative/system-specific tooling | Optional external tools | No direct integration required for the central business OS |
| Mat3ra and scientific model/tool references such as TimesFM | Specialized scientific compute/forecasting | Optional domain adapters | Do not include in default production footprint without a concrete business use case |
| GetGoAPI/free-API aggregators and unofficial “free API” projects | Potential multi-provider demos | Avoid as production dependency unless verified | Never use stolen/shared keys, bypass quotas, or assume the service is lawful/reliable |
| Tech360-owned references: alo-education-uk-final, ukvi-ai-markting_n8n, Ai-Markting-crm | Existing product/domain code and workflows | Migration / integration backlog | Must be audited independently and reconciled with canonical Tech360 data model |

## Commercial website references from the user

- Buffer: social publishing/calendar/analytics patterns.
- coder.qwen.ai and Cline: code-assistance/workbench patterns.
- Stack Overflow: developer knowledge/search patterns.
- Mureka: creative media generation patterns.
- astryx.atmeta.com: inspect access and official integration availability; no API assumed.
- OpenRouter: model catalog/routing and provider-failure patterns.
- Enerpize: finance/ERP workflow patterns.
- AIPraktor, Supercool, Hatchable, Mat3ra, Refine.ink, Lark Suite: capabilities must be confirmed against their current official product pages and account/API availability before planning direct integration.
- HetrixTools: operational monitor and notification patterns.

## Architecture target

1. **Single control plane:** keep the existing Tech360 Next.js/TypeScript/Prisma/MySQL architecture unless the repository audit shows a concrete need to split a service.
2. **Integration registry:** typed records for provider, brand/tenant, feature capability, config state, health state, scopes, last health check, last error, token expiry and audit history. Secrets encrypted server-side and never returned to the browser.
3. **Website chat first:** public widget ID only; rate-limited server API; anonymous visitor session; consented identity linking; staff inbox; no WhatsApp prerequisite.
4. **Unified communication ledger:** normalized event IDs, source channel, direction, provider IDs, client/visitor links, statuses, timestamps, attachments and immutable audit metadata; enforce idempotency through database uniqueness, not only a best-effort read-before-write.
5. **Private document vault:** quarantine → malware scan → hash → private object storage → metadata/classification → human verification. No public bucket or public website assets for sensitive client/student files.
6. **Marketing Studio:** brand kits, content assets, channel-specific variants, creative specs, preview, approval, scheduled jobs, idempotency, retry/cancel, external post IDs/URLs and source-backed analytics. No publish merely because AI drafted content.
7. **AI Router:** provider adapters behind one internal interface; explicit configured order; classified transient/quota failures; per-provider budget and rate caps; bounded retry/circuit breaker; paid fallback OFF by default; stop and surface AI_UNAVAILABLE if no permitted route exists.
8. **Department agents:** one AI mode routes to bounded specialists; each agent has explicit tools, data classes, budget, model policy, approval requirements and audit trace.
9. **Governed learning:** collect feedback and outcomes; propose source-cited memory/skills; evaluate against regression cases; human approve/version/rollback. No self-editing production code, RBAC or security rules.
10. **Workflow builder:** typed nodes with test/dry-run, credential binding, permission checks, run logs, retries, pause/disable and approval gates. Workflow execution must be server-side and idempotent.
11. **Quality and observability:** health checks, SLO/uptime alerts, logs/metrics/traces with redaction, backup/restore tests, database migration verification and per-integration status.
12. **Feature policy:** show NOT_CONFIGURED, NEEDS_AUTH, CONNECTED only after a real health test, DEGRADED, ERROR, or DISABLED. A non-empty env variable alone is not proof of a working integration.

## Priority implementation waves

### Wave 0: Audit and safety gates
- Inventory every app route, API, Prisma model, RBAC guard and scheduled job.
- Verify client deletion cascades do not erase communication/audit evidence; implement archive/supersede and approved lawful-erasure workflow.
- Add CI gates for typecheck, lint, unit, integration, build, Prisma/schema validation and migration checks.
- Produce evidence for each item: file path, tests, status, blocked reason.
- Review dependency licenses before copying any source code.

### Wave 1: Integration registry and website chat
- Persist integrations and per-brand allowed-origin configuration.
- Add health-check contract and accurate status UI.
- Implement visitor/session tables, chat thread/message persistence, idempotency constraints, rate limits, spam controls and widget embed.
- Staff inbox: unread, search, assign, internal note, tags, saved replies, close/reopen and SLA.
- Add tenant/brand scoping and RBAC tests.

### Wave 2: Unified communication ledger and CRM identity
- Normalize website chat, email, SMS and WhatsApp events.
- Unknown authorized inbound contact creates a client/lead only when identity rules and consent allow; don't merge ambiguous users.
- Persist send attempts and provider delivery events; reconcile webhook retries and duplicates.
- Add channel-independent search, timeline and attribution.

### Wave 3: Secure document handling and client portal
- Official provider media download, quarantine/scanning, SHA-256, private storage and per-client ACL.
- Authenticated client portal; uploads become pending document versions; immutable originals and review trail.
- OCR/classification/extraction only with data-policy-compatible AI; human verification required.
- No normal staff/admin hard-delete endpoints; lawful retention/erasure process separately audited.

### Wave 4: Social Marketing Studio and SEO
- One channel adapter at a time, using official OAuth/API and narrowly scoped permissions.
- Brand kits and channel-specific post variants; visual previews; accessibility and metadata checks.
- Approval/scheduling/queue/retries/pause/cancel and idempotency.
- CMS adapter (native Tech360 blog first) and real Search Console/analytics integrations if granted. No invented ranking metrics.
- Add image/audio/video creation as asynchronous provider jobs with licensing/cost guardrails, not synchronous request handlers.

### Wave 5: AI Router, specialist agents and evaluation
- First local Ollama adapter for approved local tasks; add configured providers in a tested ordered list.
- Quota ledger and budget enforcement; open-ended retries forbidden.
- Department agent registry, tool grants, prompt versions, task traces and human-approval policies.
- Add evaluation suite and rollback for memory/skills.
- Add multi-pass reviewer for content/claims and source/citation checks.

### Wave 6: Operations / finance / collaboration integrations
- Evaluate Lark, HetrixTools and ERP integrations after access/permissions/API terms are confirmed.
- Prefer connector integration instead of rebuilding full ERP/collaboration apps.
- Alerting, uptime, SSL expiry, backup heartbeats and status page.
- Finance and payment features must reuse the existing audit/RBAC and avoid duplicate sources of truth.

## Acceptance checklist (must be proven by tests)

- [ ] Website chat works with every messaging/social/AI integration blank.
- [ ] Integration UI accurately differentiates missing credentials, missing OAuth consent, successful connection, degraded state and errors.
- [ ] Public endpoints validate origin, rate limit, input and upload constraints.
- [ ] Multi-tenant/brand access tests prove isolation.
- [ ] Incoming events are idempotent under concurrent duplicate delivery.
- [ ] Client documents remain private and access-controlled, originals preserved, scan failure quarantined.
- [ ] Ordinary staff/admin actions cannot hard-delete communication, document versions or audit evidence; lawful erasure is explicit and audited.
- [ ] Every external send/publish has actor, approval, payload hash, idempotency key, destination, provider ID and final status.
- [ ] AI failover is tested for timeout, quota, invalid credentials, safety/data policy mismatch, and cost budget exhaustion.
- [ ] Paid fallback is disabled unless an explicit budget and opt-in are present.
- [ ] Agent tools are least-privilege; production-changing tools require approval.
- [ ] All social publish results and analytics originate from provider responses.
- [ ] Typecheck, lint, tests, build, migrations and E2E all pass in CI; deployment passes staging and recovery tests.

## Scope/rights boundary

Do not clone an entire commercial SaaS or bulk-copy another repository's UI/code without verifying its license and respecting terms. Implement compatible functionality using Tech360's own design system, or integrate an authorized provider. Some references are unrelated to the core business OS (scientific compute, desktop OS, voice/video generation); keep them as optional capabilities rather than bloating the default deployment. Avoid unofficial APIs or claims that paid/free tiers work indefinitely.

## Research caveat

This matrix classifies the full list supplied in the conversation at a capability level. It does **not** mean every commercial website or repository has been exhaustively cloned, security-reviewed, built, or license-audited. Repository-by-repository inspection must record exact commit, license file, build/dependency constraints, relevant components and reusable implementation evidence before any source code is imported.
