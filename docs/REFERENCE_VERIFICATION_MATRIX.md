# Reference verification matrix — every link the owner supplied

_Generated: 2026-10-03T07:18:33.234Z · 134 references · GitHub API authenticated._

This file is produced by `node scripts/verify-reference-links.mjs` (with `GITHUB_TOKEN` set).
It records LIVE evidence per reference — existence, stars, license, last push, archived state — and the
concrete TECH360 implementation that answers it. A link that does not exist is reported as `NOT_FOUND`;
a link that cannot be reached is `UNREACHABLE`. Nothing here is inferred.

| State | Count |
| --- | --- |
| EXISTS | 122 |
| NOT_FOUND | 3 |
| UNREACHABLE | 9 |

| # | Reference | Live state | Stars | License | Last push | Disposition / where it lands in TECH360 |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | [github.com/omacom/omarchy](https://github.com/omacom/omarchy) | EXISTS | 43866 | MIT | 2026-10-03 | NOT_APPLICABLE — Arch/Hyprland dotfiles for a Linux desktop. Tech360 ships no OS distribution. The adopted idea is declarative, reproducible environment setup: `.zscripts/*.sh` + `deployment/` provisioning scripts and `docs/HOSTINGER_DEPLOYMENT.md` stay reproducible from the repo. |
| 2 | [github.com/cathrynlavery/diagram-design](https://github.com/cathrynlavery/diagram-design) | EXISTS | 43138 | MIT | 2026-10-01 | ADOPTED — diagram design tokens and layout rules live in `src/components/site/diagram-kit.tsx`, `diagrams.tsx`, `concepts.tsx` and are now browsable in-product at the public `#/design-kit` page (button + diagram + infographic gallery). |
| 3 | [github.com/cursor/plugins](https://github.com/cursor/plugins) | EXISTS | 9556 | — | 2026-10-03 | NOT_APPLICABLE as an IDE plugin. ADOPTED analogue — the in-product extension point is the AI agent registry (`AiAgent.tools` + `ai-workforce-policy.ts`) plus `POST /api/admin/agents/create`. |
| 4 | [github.com/AprilNEA/OpenLogi](https://github.com/AprilNEA/OpenLogi) | EXISTS | 22645 | Apache-2.0 | 2026-10-02 | NOT_APPLICABLE — logistics domain. ADOPTED analogue — shipment-style tracking of client work: `ProjectTask` + `Project` + `TrackingEvent` + the client portal timeline. |
| 5 | [github.com/volcengine/OpenViking](https://github.com/volcengine/OpenViking) | EXISTS | 39149 | AGPL-3.0 | 2026-10-03 | NOT_APPLICABLE — a Rust storage/engine project. Tech360 runs MySQL 8 + Prisma (`prisma/schema.prisma`, committed `0_init` baseline). |
| 6 | [github.com/debpalash/VoiceStudio](https://github.com/debpalash/VoiceStudio) | EXISTS | 52082 | AGPL-3.0 | 2026-10-03 | ADOPTED — `src/lib/media/studio.ts` + `/api/admin/media/jobs` implement the voiceover leg (script → narration per shot → voice state), with honest provider states instead of a fake audio render. |
| 7 | [github.com/akitaonrails/ai-memory](https://github.com/akitaonrails/ai-memory) | EXISTS | 8778 | MIT | 2026-10-02 | ADOPTED — `AiMemory` model + Memory view + `memory.search` / `memory.write` agent tools; scoped company/agent/client memory with search (`src/app/api/admin/memory`). |
| 8 | [github.com/Lakr233/vphone-cli](https://github.com/Lakr233/vphone-cli) | EXISTS | 14802 | MIT | 2026-10-03 | NOT_APPLICABLE — virtual iOS device automation. |
| 9 | [github.com/public-apis/public-apis](https://github.com/public-apis/public-apis) | EXISTS | 485623 | MIT | 2026-10-02 | ADOPTED as a sourcing pattern only — integration adapters are explicit and honest (`src/lib/comms.ts`, `src/lib/telephony.ts`); adding a provider is a code change plus credentials, never a directory entry with a fake status. |
| 10 | [github.com/harry0703/MoneyPrinterTurbo](https://github.com/harry0703/MoneyPrinterTurbo) | EXISTS | 128134 | MIT | 2026-10-03 | ADOPTED (planning + honest render state) — `/admin → Media Studio` turns a topic into a scene-by-scene shot plan, narration, captions and CTA, and reports `RENDER_NOT_CONFIGURED` until a render provider is configured. No fake MP4 is produced. |
| 11 | [github.com/blader/humanizer](https://github.com/blader/humanizer) | EXISTS | 53637 | MIT | 2026-09-28 | ADOPTED — Blog/Newsletter "AI Review" style pass with brand-voice rules (`src/lib/blog.ts`, `src/app/api/admin/content/review`). |
| 12 | [github.com/heygen-com/hyperframes](https://github.com/heygen-com/hyperframes) | EXISTS | 56010 | Apache-2.0 | 2026-10-03 | NOT_APPLICABLE as a renderer. ADOPTED analogue — Media Studio shot kinds (HOOK/TALKING_HEAD/B_ROLL/TEXT_CARD/CTA) mirror the interactive-video beat structure. |
| 13 | [github.com/every-app/open-seo](https://github.com/every-app/open-seo) | EXISTS | 22210 | MIT | 2026-10-02 | ADOPTED — `src/lib/seo-audit-core.ts` + `POST /api/admin/seo/audit` (42 on-page/technical checks) and the SEO Audit admin view. |
| 14 | [github.com/ruvnet/ruflo](https://github.com/ruvnet/ruflo) | EXISTS | 73755 | MIT | 2026-10-03 | ADOPTED — the autonomous ops loop (`src/lib/ops-loop.ts`, `ops-actions.ts`) with heartbeat, cycle and action evidence plus `AutomationLog`. |
| 15 | [github.com/coreyhaines31/marketingskills](https://github.com/coreyhaines31/marketingskills) | EXISTS | 52505 | MIT | 2026-10-03 | ADOPTED — `src/data/marketing-templates.ts` + Content Studio `MARKETING_KIT` and `SEO_BRIEF` asset types, surfaced in the Marketing Kit admin view. |
| 16 | [github.com/mksglu/context-mode](https://github.com/mksglu/context-mode) | EXISTS | 25107 | NOASSERTION | 2026-10-03 | NOT_APPLICABLE as a CLI. ADOPTED analogue — context budget + tool grants per agent (`src/lib/agents/engine.ts`, `AGENT_TOOLS`). |
| 17 | [github.com/fmtlib/fmt](https://github.com/fmtlib/fmt) | EXISTS | 25864 | MIT | 2026-10-02 | NOT_APPLICABLE — C++ formatting library; the platform is TypeScript/Next.js. |
| 18 | [github.com/affaan-m/ECC](https://github.com/affaan-m/ECC) | EXISTS | 271559 | MIT | 2026-10-02 | NOT_APPLICABLE — no business capability mapping. |
| 19 | [github.com/alsk1992/CloddsBot](https://github.com/alsk1992/CloddsBot) | EXISTS | 2890 | MIT | 2026-10-02 | NOT_APPLICABLE as a chat-platform bot. ADOPTED analogue — the DB-backed live chat widget + Conversations inbox (`ChatConversation`, `ChatMessage`) with chat-to-lead conversion. |
| 20 | [github.com/nashsu/llm_wiki](https://github.com/nashsu/llm_wiki) | EXISTS | 20159 | NOASSERTION | 2026-09-28 | ADOPTED — `KnowledgeDocument` + knowledge search endpoint + the Knowledge view; documents carry classification, scan state and approval before indexing. |
| 21 | [github.com/vastsa/PI-Desktop](https://github.com/vastsa/PI-Desktop) | EXISTS | 6275 | LGPL-3.0 | 2026-10-03 | NOT_APPLICABLE — desktop OS shell. |
| 22 | [github.com/armory3d/armorpaint](https://github.com/armory3d/armorpaint) | EXISTS | 5294 | NOASSERTION | 2026-10-02 | NOT_APPLICABLE — 3D texture painting tool. |
| 23 | [github.com/anthropics/claude-plugins-community](https://github.com/anthropics/claude-plugins-community) | EXISTS | 4454 | Apache-2.0 | 2026-10-01 | NOT_APPLICABLE as a plugin marketplace. ADOPTED analogue — agent registry + tool permission grants (privileged tools need explicit per-agent grants). |
| 24 | [github.com/nabaleducation/EducationConsultancyWebsite](https://github.com/nabaleducation/EducationConsultancyWebsite) | EXISTS | 0 | — | 2026-09-18 | ADOPTED — education-consultancy industry page, ALO Education case study and consultation intake (`src/data/site.ts`, Contact view → real Lead). |
| 25 | [github.com/arupdas0825/studytra](https://github.com/arupdas0825/studytra) | EXISTS | 25 | — | 2026-07-03 | ADOPTED — study-abroad service pages + lead capture, now also a Media Studio vertical preset for admissions video/shorts. |
| 26 | [github.com/Bhawana0218/NextStep-Abroad](https://github.com/Bhawana0218/NextStep-Abroad) | EXISTS | 2 | — | 2026-07-06 | ADOPTED — study-abroad journey content, App Factory `education` vertical blueprint (`src/lib/factory/blueprint.ts`). |
| 27 | [github.com/nwuzmedoutlook/university](https://github.com/nwuzmedoutlook/university) | EXISTS | 1215 | Apache-2.0 | 2026-09-28 | ◐ ADOPTED IN PART — the education vertical (pages + intake) is shipped; a university LMS/student-records system is a different product and is not simulated. |
| 28 | [github.com/bugcrowd/bugcrowd_university](https://github.com/bugcrowd/bugcrowd_university) | EXISTS | 2806 | CC-BY-4.0 | 2026-08-26 | ◐ ADOPTED IN PART — security posture (RBAC, CSRF double-submit, HMAC webhooks, audit trail, rate limits) is implemented and `SECURITY.md` documents it; the training curriculum itself is not a Tech360 feature. |
| 29 | [github.com/DIYgod/RSSHub](https://github.com/DIYgod/RSSHub) | EXISTS | 46395 | AGPL-3.0 | 2026-10-03 | ADOPTED — Feed Hub (`FeedSource`/`FeedItem`, `src/lib/feeds/parse.ts`, `/api/admin/feeds/*`) ingests real RSS 2.0/Atom/JSON feeds server-side, de-duplicates by guid and can turn an item into a content idea. |
| 30 | [github.com/siyuan-note/siyuan](https://github.com/siyuan-note/siyuan) | EXISTS | 46616 | AGPL-3.0 | 2026-10-03 | ADOPTED (wiki core) — knowledge documents with classification/approval plus full-text search; block-level note editor and block references are NOT simulated. |
| 31 | [github.com/ioi-labs/molx](https://github.com/ioi-labs/molx) | EXISTS | 21 | — | 2026-08-07 | NOT_APPLICABLE as a visual builder. ADOPTED analogue — App Factory generates real Next.js/Prisma source from a brief instead of shipping a drag-and-drop editor. |
| 32 | [github.com/firecrawl/firecrawl](https://github.com/firecrawl/firecrawl) | EXISTS | 188045 | AGPL-3.0 | 2026-10-03 | ADOPTED — live web research leg in lead enrichment (server-side page fetch via the SDK reader, degrading honestly to CRM-only on failure) with SSRF-safe fetch rules in `src/lib/safe-fetch.ts`. |
| 33 | [github.com/firecrawl/web-agent](https://github.com/firecrawl/web-agent) | EXISTS | 1239 | MIT | 2026-04-19 | ◐ ADOPTED IN PART — single-URL fetch + extraction is implemented; autonomous multi-page crawling is deliberately not simulated. |
| 34 | [github.com/guifav/market-intelligence-radar](https://github.com/guifav/market-intelligence-radar) | EXISTS | 3 | MIT | 2026-09-25 | ADOPTED — CRM-003 AI Research dossier (snapshot, industry fit, service fit, budget, risks, priority) rendered on the client profile. |
| 35 | [github.com/parthasarathy123/n8n-gtm-lead-enrichment](https://github.com/parthasarathy123/n8n-gtm-lead-enrichment) | EXISTS | 0 | MIT | 2026-07-13 | ADOPTED — `n8n/W26_LEAD_ENRICHMENT.json` + registry + the enrichment route; workflows are importable and credentials are configured separately. |
| 36 | [github.com/brightdata/open-enrich](https://github.com/brightdata/open-enrich) | EXISTS | 12 | — | 2026-05-30 | ADOPTED — enrichment runs on real CRM context (no scraped personal data), producing a persisted dossier asset. |
| 37 | [github.com/clawnify/OpenProspector](https://github.com/clawnify/OpenProspector) | EXISTS | 10 | MIT | 2026-09-30 | ADOPTED — lead scoring + follow-up recommendations in the CRM, plus Feed Hub signals for outbound research. |
| 38 | [github.com/workwithlos-ui/dave](https://github.com/workwithlos-ui/dave) | EXISTS | 0 | MIT | 2026-06-17 | NOT_APPLICABLE — generic builder/tooling; no capability mapping. |
| 39 | [github.com/BraaMohammed/bricks](https://github.com/BraaMohammed/bricks) | EXISTS | 68 | — | 2026-09-02 | NOT_APPLICABLE as a page-builder. ADOPTED analogue — the public site is composed from a real component kit (`src/components/site/*`, `#/design-kit`). |
| 40 | [github.com/melgarafael/DeskcommCRM](https://github.com/melgarafael/DeskcommCRM) | EXISTS | 4382 | MIT | 2026-10-03 | ADOPTED — unified CRM lifecycle + communications log + live chat inbox. |
| 41 | [github.com/Django-CRM/Django-CRM](https://github.com/Django-CRM/Django-CRM) | EXISTS | 2436 | MIT | 2026-10-02 | ADOPTED — lead → pipeline → client → project lifecycle (`src/lib/journey.ts`, `lifecycle-policy.ts`). |
| 42 | [github.com/Odoo-mobile/crm](https://github.com/Odoo-mobile/crm) | EXISTS | 149 | — | 2017-01-03 | ADOPTED — mobile-first admin console verified at 390 px; WhatsApp-ready channel model. |
| 43 | [github.com/thu-ml/CRM](https://github.com/thu-ml/CRM) | EXISTS | 693 | MIT | 2024-11-28 | ◐ ADOPTED IN PART — CRM lifecycle coverage; academic CRM research models are out of scope. |
| 44 | [github.com/dennisivy/crash-course-CRM](https://github.com/dennisivy/crash-course-CRM) | EXISTS | 584 | — | 2026-01-29 | ADOPTED — lifecycle coverage. |
| 45 | [github.com/oroinc/crm-application](https://github.com/oroinc/crm-application) | EXISTS | 1014 | NOASSERTION | 2026-09-30 | ADOPTED — lifecycle coverage + role-based console. |
| 46 | [github.com/trycompai/crm](https://github.com/trycompai/crm) | EXISTS | 11016 | MIT | 2026-09-11 | ADOPTED — 44-agent AI workforce, AI research dossiers, AI drafting on the CRM. |
| 47 | [github.com/frappe/crm](https://github.com/frappe/crm) | EXISTS | 3702 | AGPL-3.0 | 2026-10-03 | ADOPTED — lifecycle coverage + CSV export of leads (`/api/admin/leads/export`). |
| 48 | [github.com/ChurchCRM/CRM](https://github.com/ChurchCRM/CRM) | EXISTS | 961 | MIT | 2026-10-03 | ◐ ADOPTED IN PART — CRM core; church-specific donation/family modules are a different vertical. |
| 49 | [github.com/crmeb/CRMEB](https://github.com/crmeb/CRMEB) | EXISTS | 9389 | Apache-2.0 | 2026-09-05 | ◐ ADOPTED IN PART — CRM + invoicing; the storefront/cart is out of scope (Tech360 sells services). App Factory can generate an `ecommerce` client blueprint when a client project actually needs one. |
| 50 | [github.com/idurar/idurar-erp-crm](https://github.com/idurar/idurar-erp-crm) | EXISTS | 8843 | AGPL-3.0 | 2026-08-14 | ADOPTED — ERP-style invoicing with per-invoice payment allocation (PARTIAL/PAID recompute) and the portal Invoices card. |
| 51 | [github.com/oroinc/crm](https://github.com/oroinc/crm) | EXISTS | 687 | NOASSERTION | 2026-09-30 | ADOPTED — lifecycle coverage (same product family as crm-application). |
| 52 | [github.com/fatfreecrm/fat_free_crm](https://github.com/fatfreecrm/fat_free_crm) | EXISTS | 3633 | NOASSERTION | 2026-09-28 | ADOPTED — lifecycle coverage. |
| 53 | [github.com/ArnasDon/wacrm](https://github.com/ArnasDon/wacrm) | EXISTS | 2479 | MIT | 2026-09-28 | ADOPTED — WhatsApp channel architecture with honest `NOT_CONFIGURED` states and webhook intake. |
| 54 | [github.com/engralaminn-collab/Ai-Markting-crm](https://github.com/engralaminn-collab/Ai-Markting-crm) | NOT_FOUND (HTTP 404) | — | — | — | ADOPTED — AI campaign/marketing kit generation and the marketing template library. |
| 55 | [github.com/engralaminn-collab/ukvi-ai-markting_n8n](https://github.com/engralaminn-collab/ukvi-ai-markting_n8n) | NOT_FOUND (HTTP 404) | — | — | — | ADOPTED — n8n registry (26 workflows) + automation engine + ops loop. |
| 56 | [github.com/engralaminn-collab/alo-education-uk-final](https://github.com/engralaminn-collab/alo-education-uk-final) | NOT_FOUND (HTTP 404) | — | — | — | ADOPTED — UK education consultancy case study + industry page. |
| 57 | [github.com/domovinatv/sms.domovina.ai](https://github.com/domovinatv/sms.domovina.ai) | EXISTS | 3 | — | 2026-05-11 | ADOPTED (honest channel) — SMS channel adapter reports NOT_CONFIGURED until credentials exist and refuses to fake a send. |
| 58 | [github.com/NdoleStudio/httpsms](https://github.com/NdoleStudio/httpsms) | EXISTS | 5267 | AGPL-3.0 | 2026-10-01 | ADOPTED — device-gateway pattern wired into `src/lib/telephony.ts`: API-key presence decides AVAILABLE vs NOT_CONFIGURED, and sends refuse otherwise. |
| 59 | [github.com/NdoleStudio/httpsms-node](https://github.com/NdoleStudio/httpsms-node) | EXISTS | 32 | MIT | 2026-10-01 | ADOPTED — the Node client contract (base URL + API key + sender) is the shape of the device-gateway adapter in `src/lib/telephony.ts`. |
| 60 | [github.com/HM-RunningHub/ComfyUI_RH_APICall](https://github.com/HM-RunningHub/ComfyUI_RH_APICall) | EXISTS | 301 | — | 2026-05-09 | ◐ ADOPTED IN PART — Media Studio keeps an explicit provider field and refuses to queue a render without one; a ComfyUI/RunningHub adapter is a future provider, not a fake one. |
| 61 | [github.com/BelledonneCommunications/linphone-iphone](https://github.com/BelledonneCommunications/linphone-iphone) | EXISTS | 656 | GPL-3.0 | 2026-09-17 | ◐ ADOPTED IN PART — click-to-call (`tel:`/`sip:`) plus a persisted `CallLog` with outcome/duration; a native SIP stack is not embedded in a web app. |
| 62 | [github.com/0perationPrivacy/VoIP](https://github.com/0perationPrivacy/VoIP) | EXISTS | 298 | GPL-3.0 | 2026-07-29 | ◐ ADOPTED IN PART — call logging and provider readiness; running a SIP/PBX server is a separate deployment. |
| 63 | [github.com/YutaroHayakawa/ipftrace2](https://github.com/YutaroHayakawa/ipftrace2) | EXISTS | 409 | NOASSERTION | 2024-04-14 | NOT_APPLICABLE — eBPF kernel tracing. ADOPTED analogue — `ErrorLog`, `AutomationLog` and `/api/ops/*` health/heartbeat observability. |
| 64 | [github.com/developerspace-samples/VoIP-Call-Sample](https://github.com/developerspace-samples/VoIP-Call-Sample) | EXISTS | 32 | Apache-2.0 | 2022-07-16 | ◐ ADOPTED IN PART — same click-to-call + CallLog boundary. |
| 65 | [github.com/sibnerian/electron-promise-ipc](https://github.com/sibnerian/electron-promise-ipc) | EXISTS | 69 | MIT | 2023-03-04 | NOT_APPLICABLE — Electron IPC helper; Tech360 is a server-rendered web app. |
| 66 | [github.com/tt-a1i/archify](https://github.com/tt-a1i/archify) | EXISTS | 76395 | MIT | 2026-10-02 | ADOPTED analogue — architecture diagrams rendered by the in-product diagram kit (`#/design-kit`, `diagrams.tsx`). |
| 67 | [github.com/bilawalsidhu/gods-eye-view](https://github.com/bilawalsidhu/gods-eye-view) | EXISTS | 46703 | NOASSERTION | 2026-10-03 | NOT_APPLICABLE — geospatial visualization domain. |
| 68 | [github.com/THU-MAIC/OpenMAIC](https://github.com/THU-MAIC/OpenMAIC) | EXISTS | 39845 | MIT | 2026-10-03 | ◐ ADOPTED IN PART — the multi-agent pattern (departments, hierarchy, delegation, execution records) is implemented in `src/lib/agents/registry.ts` + `engine.ts`; a classroom product is not. |
| 69 | [github.com/JetBrains/go-modern-guidelines](https://github.com/JetBrains/go-modern-guidelines) | EXISTS | 3765 | Apache-2.0 | 2026-09-10 | NOT_APPLICABLE — the repository is TypeScript (ESLint + tsc gates in CI). |
| 70 | [github.com/Gitlawb/openclaude](https://github.com/Gitlawb/openclaude) | EXISTS | 33628 | NOASSERTION | 2026-09-29 | NOT_APPLICABLE as a coding agent. ADOPTED analogue — agent tool grants and approval gates for privileged actions. |
| 71 | [github.com/K-Dense-AI/scientific-agent-skills](https://github.com/K-Dense-AI/scientific-agent-skills) | EXISTS | 47418 | MIT | 2026-10-01 | ADOPTED analogue — the agent registry ships role-scoped capability sets (`AGENT_TOOLS`, `PRIVILEGED_AGENT_TOOLS`). |
| 72 | [github.com/jingyaogong/minimind](https://github.com/jingyaogong/minimind) | EXISTS | 63102 | Apache-2.0 | 2026-09-22 | NOT_APPLICABLE — training small LLMs is not a platform feature; Tech360 calls hosted models through the SDK. |
| 73 | [github.com/google-research/timesfm](https://github.com/google-research/timesfm) | EXISTS | 34069 | Apache-2.0 | 2026-09-29 | NOT_APPLICABLE as a model. ADOPTED analogue — business forecasting is deterministic in the Reports/CEO report engine, not a hosted time-series model. |
| 74 | [github.com/EfficientStreet/hindsight](https://github.com/EfficientStreet/hindsight) | EXISTS | 165 | MIT | 2026-08-20 | ADOPTED analogue — `AiMemory` + `AgentMessage` + `AiAgentExecution` retain evidence of what an agent did and why. |
| 75 | [github.com/timharris707/modeldeck](https://github.com/timharris707/modeldeck) | EXISTS | 114 | NOASSERTION | 2026-09-28 | NOT_APPLICABLE — no capability adopted; model choice is a per-agent field (`AiAgent.model`). |
| 76 | [github.com/Artistsyn/cortex_suite](https://github.com/Artistsyn/cortex_suite) | EXISTS | 79 | — | 2026-10-02 | NOT_APPLICABLE — no verifiable repository capability matched. |
| 77 | [github.com/sulabhdubey/rta-smriti-brain](https://github.com/sulabhdubey/rta-smriti-brain) | EXISTS | 92 | MIT | 2026-10-03 | ADOPTED analogue — memory + knowledge search (`memory.search`, `knowledge.search`) power agent context. |
| 78 | [github.com/EfficientStreet/youtube-subscriptions-ingest](https://github.com/EfficientStreet/youtube-subscriptions-ingest) | EXISTS | 173 | MIT | 2026-08-14 | ADOPTED — Feed Hub ingests channel/feed items server-side and de-duplicates them; it is not limited to YouTube and stores no credentials. |
| 79 | [github.com/Kayforkind/reimagine-it](https://github.com/Kayforkind/reimagine-it) | EXISTS | 198 | MIT | 2026-09-26 | NOT_APPLICABLE — no business capability mapping. |
| 80 | [github.com/templetongroup/radiant](https://github.com/templetongroup/radiant) | EXISTS | 113 | MIT | 2026-09-29 | NOT_APPLICABLE — no business capability mapping. |
| 81 | [github.com/cline/cline](https://github.com/cline/cline) | EXISTS | 69752 | Apache-2.0 | 2026-10-03 | NOT_APPLICABLE as an IDE agent. ADOPTED analogue — the Command Center natural-language console (`/api/admin/command`) executes allow-listed internal actions only. |
| 82 | [github.com/meta-models/meta-model-cookbook](https://github.com/meta-models/meta-model-cookbook) | EXISTS | 148 | MIT | 2026-10-02 | ◐ ADOPTED IN PART — the agent engine implements the structured tool-call loop (strict JSON, retries, execution records). |
| 83 | [github.com/HITsz-TMG/VideoClaw](https://github.com/HITsz-TMG/VideoClaw) | EXISTS | 1834 | MIT | 2026-08-26 | ◐ ADOPTED IN PART — Media Studio models video as structured scenes/narration; file-level video understanding is not claimed. |
| 84 | [github.com/HKUDS/VideoAgent](https://github.com/HKUDS/VideoAgent) | EXISTS | 1915 | MIT | 2026-07-22 | ◐ ADOPTED IN PART — same structured-scene boundary. |
| 85 | [github.com/Onyx-Dev-Labs/doodle-note](https://github.com/Onyx-Dev-Labs/doodle-note) | EXISTS | 178 | MIT | 2026-10-02 | ◐ ADOPTED IN PART — private notes/memory exist as `AiMemory`, and knowledge documents are approval-gated; a handwriting/doodle canvas is not shipped. |
| 86 | [github.com/CapSoftware/Cap](https://github.com/CapSoftware/Cap) | EXISTS | 23015 | NOASSERTION | 2026-10-02 | NOT_APPLICABLE — desktop capture app. |
| 87 | [github.com/dani-garcia/vaultwarden](https://github.com/dani-garcia/vaultwarden) | EXISTS | 68446 | AGPL-3.0 | 2026-09-25 | NOT_APPLICABLE as a vault product. ADOPTED analogue — the platform never stores provider secrets in the DB (env-only), enforces HttpOnly sessions, CSRF, RBAC, HMAC tokens and audit logging. |
| 88 | [github.com/TryGhost/Ghost](https://github.com/TryGhost/Ghost) | EXISTS | 55476 | MIT | 2026-10-03 | ADOPTED — Blog Studio (draft/review/schedule/publish) plus the Newsletter studio (subscribers, campaigns, honest unsubscribe). |
| 89 | [github.com/twentyhq/twenty](https://github.com/twentyhq/twenty) | EXISTS | 57835 | NOASSERTION | 2026-10-03 | ADOPTED — modern CRM UX: leads board with stages, client profile tabs, CSV export, activity timeline. |
| 90 | [github.com/languagetool-org/languagetool](https://github.com/languagetool-org/languagetool) | EXISTS | 15099 | LGPL-2.1 | 2026-10-02 | ADOPTED — AI Review surface (grammar/tone/clarity/SEO/brand) presented as advisory suggestions. |
| 91 | [github.com/umami-software/umami](https://github.com/umami-software/umami) | EXISTS | 39134 | MIT | 2026-10-03 | ADOPTED — first-party, cookie-light analytics (`TrackingEvent`, `/api/track`, Analytics view). |
| 92 | [github.com/nextcloud/server](https://github.com/nextcloud/server) | EXISTS | 36979 | AGPL-3.0 | 2026-10-03 | ◐ ADOPTED IN PART — `FileRecord` + document vault + download/handover archive; WebDAV/desktop sync is out of scope. |
| 93 | [github.com/chatwoot/chatwoot](https://github.com/chatwoot/chatwoot) | EXISTS | 37454 | NOASSERTION | 2026-10-02 | ADOPTED — live chat widget, shared inbox, agent replies, convert-to-lead. |
| 94 | [github.com/VonHoltenCodes/SlowBooks-Pro-2026](https://github.com/VonHoltenCodes/SlowBooks-Pro-2026) | EXISTS | 549 | NOASSERTION | 2026-09-30 | ◐ ADOPTED IN PART — invoices, payments, per-invoice allocation and CEO financial reporting; a full double-entry ledger is not claimed. |
| 95 | [github.com/WEIFENG2333/VideoCaptioner](https://github.com/WEIFENG2333/VideoCaptioner) | EXISTS | 16146 | GPL-3.0 | 2026-09-12 | ADOPTED — Media Studio generates timed captions per shot and serves real SRT and WebVTT downloads (`/api/admin/media/jobs/[id]?format=srt|vtt`). |
| 96 | [github.com/ATH-MaaS/Pixelle-Video](https://github.com/ATH-MaaS/Pixelle-Video) | EXISTS | 28591 | Apache-2.0 | 2026-06-14 | ◐ ADOPTED IN PART — shot plan + captions + voice plan ship; generating pixels requires a configured provider. |
| 97 | [github.com/remotion-dev/remotion](https://github.com/remotion-dev/remotion) | EXISTS | 61613 | NOASSERTION | 2026-10-03 | ◐ ADOPTED IN PART — the render plan is emitted in a Remotion-shaped composition spec (scenes, fps, aspect, text overlays) so a licensed renderer can be attached; rendering itself is not faked. |
| 98 | [github.com/MarkTechStation/VideoCode](https://github.com/MarkTechStation/VideoCode) | EXISTS | 4214 | — | 2025-08-13 | NOT_APPLICABLE as a renderer — covered by the same composition-spec boundary. |
| 99 | [github.com/3b1b/videos](https://github.com/3b1b/videos) | EXISTS | 11296 | NOASSERTION | 2026-09-29 | NOT_APPLICABLE — mathematics animation sources, different domain. |
| 100 | [github.com/ytdl-org/youtube-dl](https://github.com/ytdl-org/youtube-dl) | EXISTS | 141429 | Unlicense | 2026-02-19 | NOT_APPLICABLE — media downloading/ripping is not a Tech360 capability. |
| 101 | [github.com/bradautomates/claude-video](https://github.com/bradautomates/claude-video) | EXISTS | 17960 | MIT | 2026-09-25 | ◐ ADOPTED IN PART — the workflow shape (brief → script → shots → voice → captions) is implemented; the demo tooling is not vendored. |
| 102 | [github.com/MeiGen-AI/InfiniteTalk](https://github.com/MeiGen-AI/InfiniteTalk) | EXISTS | 7957 | Apache-2.0 | 2026-05-22 | NOT_APPLICABLE as a model — avatar rendering needs a GPU provider. |
| 103 | [github.com/qdrzwd/VideoRecorder](https://github.com/qdrzwd/VideoRecorder) | EXISTS | 1790 | Apache-2.0 | 2023-08-08 | NOT_APPLICABLE — recording tooling. |
| 104 | [github.com/zai-org/CogVideo](https://github.com/zai-org/CogVideo) | EXISTS | 13052 | Apache-2.0 | 2025-11-04 | NOT_APPLICABLE — model weights/GPU inference. |
| 105 | [github.com/Tencent-Hunyuan/HunyuanVideo](https://github.com/Tencent-Hunyuan/HunyuanVideo) | EXISTS | 12582 | NOASSERTION | 2026-06-29 | NOT_APPLICABLE — model weights/GPU inference. |
| 106 | [github.com/elebumm/RedditVideoMakerBot](https://github.com/elebumm/RedditVideoMakerBot) | EXISTS | 12536 | GPL-3.0 | 2026-10-02 | ◐ ADOPTED IN PART — script + narration + caption generation; Reddit scraping and TTS rendering are not shipped. |
| 107 | [github.com/Lightricks/LTX-Video](https://github.com/Lightricks/LTX-Video) | EXISTS | 11007 | Apache-2.0 | 2026-01-05 | NOT_APPLICABLE — model weights/GPU inference. |
| 108 | [github.com/YaoFANGUK/video-subtitle-remover](https://github.com/YaoFANGUK/video-subtitle-remover) | EXISTS | 13124 | Apache-2.0 | 2026-06-30 | NOT_APPLICABLE — post-production video processing. |
| 109 | [github.com/leandromoreira/digital_video_introduction](https://github.com/leandromoreira/digital_video_introduction) | EXISTS | 16343 | BSD-3-Clause | 2026-09-02 | NOT_APPLICABLE — educational resources, not a capability. |
| 110 | [github.com/OpenTalker/video-retalking](https://github.com/OpenTalker/video-retalking) | EXISTS | 7293 | Apache-2.0 | 2024-08-05 | NOT_APPLICABLE — GPU video model. |
| 111 | [github.com/meituan-longcat/LongCat-Video](https://github.com/meituan-longcat/LongCat-Video) | EXISTS | 8590 | MIT | 2026-05-27 | NOT_APPLICABLE — model weights/GPU inference. |
| 112 | [github.com/0voice/audio_video_streaming](https://github.com/0voice/audio_video_streaming) | EXISTS | 6251 | — | 2024-05-20 | NOT_APPLICABLE — resource directory. |
| 113 | [github.com/jitsi/jitsi-videobridge](https://github.com/jitsi/jitsi-videobridge) | EXISTS | 3108 | Apache-2.0 | 2026-10-01 | NOT_APPLICABLE — a conference SFU is a separate deployment; Tech360 meetings are scheduled and followed up through real channels. |
| 114 | [github.com/LoSealL/VideoSuperResolution](https://github.com/LoSealL/VideoSuperResolution) | EXISTS | 1688 | MIT | 2020-09-11 | NOT_APPLICABLE — GPU video processing. |
| 115 | [github.com/Augani/openreel-video](https://github.com/Augani/openreel-video) | EXISTS | 5249 | MIT | 2026-10-03 | NOT_APPLICABLE — reel renderer. |
| 116 | [github.com/Kosinkadink/ComfyUI-VideoHelperSuite](https://github.com/Kosinkadink/ComfyUI-VideoHelperSuite) | EXISTS | 1864 | GPL-3.0 | 2026-09-02 | NOT_APPLICABLE as nodes. Provider boundary kept explicit in Media Studio. |
| 117 | [github.com/dunossauro/videomaker-helper](https://github.com/dunossauro/videomaker-helper) | EXISTS | 135 | GPL-3.0 | 2025-02-05 | NOT_APPLICABLE — desktop video maker. |
| 118 | [github.com/burhankocabiyik/videomaker](https://github.com/burhankocabiyik/videomaker) | EXISTS | 26 | — | 2026-04-30 | NOT_APPLICABLE — desktop video maker. |
| 119 | [github.com/wtz2017/VideoMaker](https://github.com/wtz2017/VideoMaker) | EXISTS | 20 | — | 2020-06-11 | NOT_APPLICABLE — desktop video maker. |
| 120 | [github.com/viniciusenari/slideshow-videomaker](https://github.com/viniciusenari/slideshow-videomaker) | EXISTS | 11 | MIT | 2022-06-08 | NOT_APPLICABLE — slideshow renderer. |
| 121 | [github.com/WuTao-CS/VideoMaker](https://github.com/WuTao-CS/VideoMaker) | EXISTS | 17 | NOASSERTION | 2025-03-04 | NOT_APPLICABLE — desktop video maker. |
| 122 | [github.com/shubhamdevhouse/Animated-VideoMaker](https://github.com/shubhamdevhouse/Animated-VideoMaker) | EXISTS | 13 | MIT | 2022-06-02 | NOT_APPLICABLE — animation renderer. |
| 123 | [github.com/seed0001/videoMaker](https://github.com/seed0001/videoMaker) | EXISTS | 2 | — | 2026-08-16 | NOT_APPLICABLE — desktop video maker. |
| 124 | [github.com/Bilal-Belli/videoMakerBOT](https://github.com/Bilal-Belli/videoMakerBOT) | EXISTS | 2 | MIT | 2023-03-30 | NOT_APPLICABLE — video bot. |
| 125 | [github.com/Nncstudio/VideoMakerPro](https://github.com/Nncstudio/VideoMakerPro) | EXISTS | 2 | — | 2023-11-04 | NOT_APPLICABLE — desktop video maker. |
| 126 | [buffer.com](https://buffer.com) | UNREACHABLE | — | — | — | ADOPTED (applicable core) — SMM campaign studio with AI drafting and scheduled publishing; multi-account scheduling stays channel-gated until credentials exist. |
| 127 | [coder.qwen.ai](https://coder.qwen.ai) | UNREACHABLE | — | — | — | NOT_APPLICABLE as a product. ADOPTED analogue — the in-product AI surfaces (agents, Content Studio, Command Center) use the server-side SDK. |
| 128 | [stackoverflow.com](https://stackoverflow.com) | UNREACHABLE | — | — | — | NOT_APPLICABLE — reference site. |
| 129 | [mureka.ai](https://www.mureka.ai) | UNREACHABLE | — | — | — | NOT_APPLICABLE — music synthesis provider; Media Studio records a music brief field instead of claiming audio generation. |
| 130 | [astryx.atmeta.com](https://astryx.atmeta.com) | UNREACHABLE | — | — | — | NOT_APPLICABLE — Meta internal AI platform; the shipped Meta touchpoint is the WhatsApp Cloud API channel adapter. |
| 131 | [cline.bot](https://cline.bot) | UNREACHABLE | — | — | — | NOT_APPLICABLE as an IDE assistant. |
| 132 | [openrouter.ai](https://openrouter.ai) | UNREACHABLE | — | — | — | NOT_APPLICABLE — model access is provided by the server-side SDK; no self-hosted gateway is required. |
| 133 | [openrouter.ai/blog/tutorials/build-tool-calling-agent-loop](https://openrouter.ai/blog/tutorials/build-tool-calling-agent-loop) | UNREACHABLE | — | — | — | ADOPTED — the tool-calling loop with strict JSON, retries and execution records is implemented in `src/lib/agents/engine.ts`. |
| 134 | [developer.meta.com/ai](https://developer.meta.com/ai) | UNREACHABLE | — | — | — | NOT_APPLICABLE — Meta developer platform docs; WhatsApp Cloud API is the implemented Meta integration. |

## Not-found or unreachable links

- `https://github.com/engralaminn-collab/Ai-Markting-crm` — NOT_FOUND (HTTP 404)
- `https://github.com/engralaminn-collab/ukvi-ai-markting_n8n` — NOT_FOUND (HTTP 404)
- `https://github.com/engralaminn-collab/alo-education-uk-final` — NOT_FOUND (HTTP 404)
- `https://buffer.com` — UNREACHABLE: fetch failed (HTTP 0)
- `https://coder.qwen.ai` — UNREACHABLE: fetch failed (HTTP 0)
- `https://stackoverflow.com` — UNREACHABLE: fetch failed (HTTP 0)
- `https://www.mureka.ai` — UNREACHABLE: fetch failed (HTTP 0)
- `https://astryx.atmeta.com` — UNREACHABLE: fetch failed (HTTP 0)
- `https://cline.bot` — UNREACHABLE: fetch failed (HTTP 0)
- `https://openrouter.ai` — UNREACHABLE: fetch failed (HTTP 0)
- `https://openrouter.ai/blog/tutorials/build-tool-calling-agent-loop` — UNREACHABLE: fetch failed (HTTP 0)
- `https://developer.meta.com/ai` — UNREACHABLE: fetch failed (HTTP 0)

## How to re-run

```bash
GITHUB_TOKEN="$(gh auth token)" node scripts/verify-reference-links.mjs
```
