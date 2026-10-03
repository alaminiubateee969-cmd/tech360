# TECH360 — Reference Coverage Audit

**Date:** September 17, 2026 (recovered + extended after the round-14 sandbox restore; extended again September 19 with the video-cluster + dev-tooling batch)
**Scope:** Every website and repository link shared by the owner across the project conversations (139 unique references), audited against the delivered TECH360 platform.
**Method:** Each reference was inspected for its core capability, then mapped to the platform's shipped features (43 Prisma models, 44 AI agents, 24 admin views, 3 services). "Round" numbers refer to the work-log entries in `worklog.md` where each feature was built and verified. After a workspace revert destroyed rounds 11–13 from disk, every listed feature was REBUILT and re-verified in round 14 — see the recovery entry in the worklog.

**Re-review (2026-10-03):** the ⛔ dispositions below record *what the upstream
project is*, which is not the same as *whether the capability applies here*.
Every link has since been re-checked live and the applicable capabilities were
**built**, not deferred: the AI Software Factory, Media Studio (script → shots →
narration → SRT/VTT → render spec), the Feed Hub (real RSS/Atom/JSON ingestion),
the Call & SMS centre and the public Design Kit. See
[`docs/REFERENCE_VERIFICATION_MATRIX.md`](docs/REFERENCE_VERIFICATION_MATRIX.md)
for per-link live evidence and
[`docs/AI_SOFTWARE_FACTORY.md`](docs/AI_SOFTWARE_FACTORY.md) for what shipped.
Read the ⛔ column as "not vendored", never as "not answered".

**Legend**

| Mark | Meaning |
| --- | --- |
| ✅ | Capability already exists in TECH360 (built and browser-verified in the referenced round) |
| ➕ | Gap found by an audit pass and added (round 13: firecrawl-style live web research · round 14: per-invoice payment allocation) |
| ◐ | Partially applicable — the applicable core is covered; the rest is honestly out of scope |
| ⛔ | Not applicable to TECH360 — a different product category, with the reason stated |

**Totals:** 139 references audited → ✅ 45 covered · ➕ 2 added by audit · ◐ 20 partially applicable · ⛔ 72 not applicable (documented reasons). Every reference appears in a table below.

---

## A. Reference websites (6)

| Reference | What it is | TECH360 | Where / Round |
| --- | --- | --- | --- |
| kexsio.com | Digital-agency portfolio site | ✅ | 12-page public site: home, services (20), industries (20), work, blog, about, contact — `src/app/page.tsx` (R1–R8) |
| wix.com | Visual website builder SaaS | ⛔ | TECH360's site is hand-crafted production code; a drag-and-drop builder is a different product. No fake builder UI is shipped |
| builder.io | Headless visual page builder | ⛔ | Same as above — honesty over simulation |
| emergent.sh | AI app-builder platform | ⛔ | TECH360 *is* the AI-assisted platform being built; self-referential |
| docs.codemagic.io | Mobile-app CI/CD service | ◐ | Mobile-app build pipelines are N/A: TECH360 is a web platform with no iOS/Android app. GitHub Actions validates the application against disposable MySQL and does not deploy production; Hostinger's Node.js Web App Git integration is the intended path when configured. Current Hostinger connection/deployment is not verified. |
| prisma.io | Database ORM | ✅ | The application data layer is Prisma with 43 models, client generation in CI/build, and a checked-in MySQL migration baseline. Earlier SQLite/db:push notes in this historical audit are superseded; production uses MySQL and has not been live-verified. |

## B. CRM family (16)

All of these map to TECH360's unified CRM lifecycle: leads → pipeline → clients → communications → projects → invoices → payments, with CSV export (frappe/Twenty parity), chat-to-lead conversion (R11) and per-invoice payment allocation (R14).

| Reference | What it is | TECH360 | Where / Round |
| --- | --- | --- | --- |
| twentyhq/twenty | Modern open-source CRM | ✅ | Full CRM: Leads board + stages, client profiles (11 tabs incl. AI Research), pipeline, activity timeline, CSV export — `LeadsView`, `ClientDetailView` (R4–R14) |
| frappe/crm | CRM on Frappe framework | ✅ | Same lifecycle coverage + CSV export `/api/admin/leads/export` (R11/R14) |
| Django-CRM/Django-CRM | Django-based CRM | ✅ | Same lifecycle coverage (R4–R11) |
| odoo-mobile/crm | Odoo mobile CRM app | ✅ | Responsive mobile-first admin (agent-browser verified at 390 px) + WhatsApp-ready channel model (R5–R11) |
| thu-ml/CRM | CRM research project | ✅ | CRM lifecycle coverage (R4–R11) |
| dennisivy/crash-course-CRM | CRM tutorial project | ✅ | Lifecycle coverage (R4–R11) |
| oroinc/crm | OroCRM platform | ✅ | Lifecycle coverage (R4–R11) |
| oroinc/crm-application | OroCRM application | ✅ | Same as above (one product family) |
| fatfreecrm/fat_free_crm | Ruby on Rails CRM | ✅ | Lifecycle coverage (R4–R11) |
| ChurchCRM/CRM | Church management CRM | ◐ | CRM core covered; membership/church-specific modules (donations, families, groups) are a different vertical |
| crmeb/CRMEB | E-commerce + CRM suite | ◐ | CRM + invoicing covered; storefront/cart/product-catalog e-commerce is out of scope (TECH360 sells services, not SKUs) |
| trycompai/crm | AI-first CRM | ✅ | This is TECH360's native territory — 44-agent registry, AI research dossier, AI drafting (R7–R14) |
| melgarafael/DeskcommCRM | Desktop communication CRM | ✅ | Web CRM + unified inbox (communications log + live chat) (R4–R11) |
| engralaminn-collab/Ai-Markting-crm | AI marketing CRM | ✅ | AI campaigns (SMM), AI review assistant, lead scoring agents (R7–R14) |
| ArnasDon/wacrm | WhatsApp CRM | ✅ | WhatsApp channel architecture + honest channel states + n8n registry (R5–R9) |
| clawnify/OpenProspector | Outbound prospecting | ✅ | Lead capture (site forms, chat-to-lead) + AI enrichment + follow-up recommendations (R11–R14) |
| idurar/idurar-erp-crm | ERP + CRM with invoicing | ➕ | Invoicing existed (R10); round 14 added the missing per-invoice payment allocation: payments link to invoices, PARTIAL/PAID statuses recompute per invoice, portal Invoices card + Pay Now wired to the live Stripe checkout API |

## C. Live chat & customer conversations (1)

| Reference | What it is | TECH360 | Where / Round |
| --- | --- | --- | --- |
| chatwoot/chatwoot | Open-source customer chat | ✅ | DB-backed live chat widget (`ChatWidget`), admin shared inbox (`ConversationsView`), reply/close/reopen, convert-to-lead creates real Client+Lead, `chat_open` analytics event (R11, rebuilt R14) |

## D. Publishing, writing & grammar (3)

| Reference | What it is | TECH360 | Where / Round |
| --- | --- | --- | --- |
| TryGhost/Ghost | Publishing + newsletter platform | ✅ | Blog Studio with scheduling/publishing (R8) + Newsletter studio: subscribers, growth chart, AI drafting, honest unsubscribe page, footer signup (R11, rebuilt R14) |
| languagetool-org/languagetool | Grammar & style checking | ✅ | "AI Review" in Blog Studio + Newsletter composer: grammar/tone/clarity/SEO/brand issues with severity, advisory-only (R12, rebuilt R14) |
| blader/humanizer | Human-sounding writing | ✅ | Same AI Review surface with TECH360 brand-voice rules (R12, rebuilt R14) |

## E. Analytics & SEO (3)

| Reference | What it is | TECH360 | Where / Round |
| --- | --- | --- | --- |
| umami-software/umami | Privacy-first web analytics | ✅ | First-party traffic analytics: pageviews, uniques, referrers, top pages, event mix, SQL-verified numbers, cookie-light consent-aware beacon (R11, rebuilt R14) |
| every-app/open-seo | SEO toolkit | ✅ | `sitemap.ts` (60 URLs, real lastmods), robots, blog routes honor feature flags (R11, rebuilt R14) |
| DIYgod/RSSHub | RSS feed generator farm | ◐ | TECH360 publishes a valid RSS 2.0 feed (`/rss.xml`); running a feed-*farm* that scrapes thousands of third-party sites is a different product |

## F. Lead enrichment & market intelligence (6)

| Reference | What it is | TECH360 | Where / Round |
| --- | --- | --- | --- |
| guifav/market-intelligence-radar | Market intelligence dashboards | ✅ | CRM-003 AI Research dossier: snapshot, industry, service fit, budget, risks, priority score (R12, rebuilt R14) |
| brightdata/open-enrich | Data enrichment API | ✅ | Same dossier from real CRM context — enrichment without scraping personal data (R12, rebuilt R14) |
| parthasarathy123/n8n-gtm-lead-enrichment | GTM lead enrichment flows | ✅ | Dossier + n8n workflow registry (25 workflows) for GTM automation (R9, R12) |
| firecrawl/firecrawl | Web scraping/crawling for LLMs | ➕ | Round 13 (rebuilt R14): live web research in enrichment — paste the client's URL, the server fetches the page via the SDK page-reader, and feeds the text to CRM-003 as primary evidence; fetch failures degrade honestly to CRM-only |
| firecrawl/web-agent | Web agents on firecrawl | ➕ | Same live-fetch leg; agent-driven crawling beyond a supplied URL is deliberately not simulated |
| ioi-labs/molx | Website builder blocks | ⛔ | Visual builder category — see section L |

## G. Messaging, SMS & channel automation (5)

| Reference | What it is | TECH360 | Where / Round |
| --- | --- | --- | --- |
| NdoleStudio/httpsms | SMS over WhatsApp gateway | ✅ | SMS channel with honest NOT_CONFIGURED state until credentials are added; channel settings + Super Admin switches (R5–R10) |
| NdoleStudio/httpsms-node | Node client for the above | ✅ | Same channel implementation surface (R5–R10) |
| domovinatv/sms.domovina.ai | SMS AI service | ✅ | Same honest channel model (R5–R10) |
| engralaminn-collab/ukvi-ai-markting_n8n | n8n marketing automation | ✅ | n8N integration registry, automation engine, ops loop — 25 workflows incl. follow-ups and reporting (R9) |
| ruvnet/ruflo | Workflow orchestration | ✅ | Automation engine + autonomous ops loop with heartbeat + cycle evidence (R9–R10) |

## H. Education & study-abroad sites (5)

| Reference | What it is | TECH360 | Where / Round |
| --- | --- | --- | --- |
| nabaleducation/EducationConsultancyWebsite | Education consultancy site | ✅ | 20 industry pages incl. education consultancy; ALO Education case study; consultation booking flow (R2–R8) |
| arupdas0825/studytra | Study-abroad services | ✅ | Study-abroad/study-consultancy service pages + lead capture (R2–R8) |
| Bhawana0218/NextStep-Abroad | Study-abroad agency | ✅ | Same coverage (R2–R8) |
| engralaminn-collab/alo-education-uk-final | UK education consultancy | ✅ | ALO Education case study + UK-focused industry page (R8) |
| nwuzmedoutlook/university | University site template | ◐ | TECH360 is a B2B agency platform, not a university LMS; education vertical pages + consultancy workflows cover the applicable part |

## I. Knowledge, memory & files (7)

| Reference | What it is | TECH360 | Where / Round |
| --- | --- | --- | --- |
| siyuan-note/siyuan | Note-taking / knowledge management | ✅ | Knowledge Base (20+ articles) + AI-ranked search + internal notes on clients/leads (R8) |
| akitaonrails/ai-memory | AI memory layer | ✅ | `AiMemory` model with scope/key/provenance, used by agents and ops loop (R7) |
| EfficientStreet/hindsight | Agent memory | ✅ | Same `AiMemory` + evidence envelopes (R7) |
| sulabhdubey/rta-smriti-brain | Memory brain | ✅ | Same (R7) |
| nextcloud/server | Self-hosted files platform | ✅ | Client Documents Hub: uploads, folders, delivery-linked files, previews (R5) |
| nashsu/llm_wiki | LLM knowledge wiki | ✅ | AI-ranked knowledge search over KB articles (R8) |
| Onyx-Dev-Labs/doodle-note | Note app | ◐ | Staff-facing notes + KB articles covered; consumer note-taking app is a different product |

## J. ERP, invoicing & finance (2)

| Reference | What it is | TECH360 | Where / Round |
| --- | --- | --- | --- |
| idurar/idurar-erp-crm | ERP + CRM with invoicing | ➕ | See section B — per-invoice payment allocation added R14 |
| VonHoltenCodes/SlowBooks | Bookkeeping | ◐ | Invoice/payment ledger + finance KPIs + per-invoice allocation covered; full double-entry accounting is out of scope for an agency CRM |

## K. AI models, agents & media generation (11)

| Reference | What it is | TECH360 | Where / Round |
| --- | --- | --- | --- |
| jingyaogong/minimind | Train a tiny LLM | ⛔ | TECH360 uses a hosted LLM through the SDK instead of training models — different discipline |
| google-research/timesfm | Time-series foundation model | ⛔ | Same reason; analytics uses deterministic SQL over real events |
| THU-MAIC/OpenMAIC | Multi-agent framework | ⛔ | TECH360's 44-agent registry with RBAC/approvals/quotas is the in-product analog (R7) |
| harry0703/MoneyPrinterTurbo | AI short-video generation | ◐ | VID-022 produces video *scripts & shot plans* (honest: plans, not rendered video files) |
| debpalash/VoiceStudio | Voice/AI audio studio | ◐ | VOX-043 produces voiceover *scripts & direction* — no fake audio synthesis claims |
| HM-RunningHub/ComfyUI_RH_APICall | ComfyUI image pipeline API | ◐ | DSN-021 design-prompt agent produces design briefs (prompts, not pixels) |
| timharris707/modeldeck | Model gateway | ⛔ | SDK-provided model routing; no self-hosted gateway needed |
| Artistsyn/cortex_suite | Agent suite | ⛔ | 44-agent registry + command center is the product itself |
| K-Dense-AI/scientific-agent-skills | Agent skill packs | ⛔ | Capability registry with per-agent tools/permissions (R7) |
| Gitlawb/openclaude | Claude clone | ⛔ | Different product category |
| heygen-com/hyperframes | Interactive video | ⛔ | Different product category |

## L. Builders, desktop, OS & end-user apps (14)

| Reference | What it is | TECH360 | Where / Round |
| --- | --- | --- | --- |
| BraaMohammed/bricks | Page-builder blocks | ⛔ | Visual builder category |
| workwithlos-ui/dave | Builder/tooling | ⛔ | Same |
| CapSoftware/Cap | Screen recorder | ⛔ | Desktop app category |
| dani-garcia/vaultwarden | Password manager | ⛔ | Platform security = audit logs, CSRF, HMAC tokens, rate limits, RBAC (R10 security audit) — not a password vault product |
| omacom/omarchy | Arch Linux WM setup | ⛔ | Operating-system tooling |
| tt-a1i/archify | Architecture visualizations | ⛔ | Different domain |
| cathrynlavery/diagram-design | Diagram design system | ✅ | Eight responsive, accessible infographic components plus three product-concept diagrams in `src/components/site/diagrams.tsx` and `concepts.tsx`; consistent title bands, numbered roadmaps, connectors, legends and English labels (R18) |
| bilawalsidhu/gods-eye-view | Geospatial visualization | ⛔ | Different domain |
| vastsa/PI-Desktop | Desktop environment | ⛔ | Desktop OS project |
| armory3d/armorpaint | 3D texture painting | ⛔ | 3D authoring tool |
| Lakr233/vphone-cli | Phone CLI | ⛔ | Device tooling |
| EfficientStreet/youtube-subscriptions-ingest | YT subscriptions ingest | ⛔ | Personal tooling — no business fit |
| Kayforkind/reimagine-it | Personal project | ⛔ | No business fit |
| templetongroup/radiant | Personal project | ⛔ | No business fit |

## M. VoIP, telephony & native (5)

| Reference | What it is | TECH360 | Where / Round |
| --- | --- | --- | --- |
| BelledonneCommunications/linphone-iphone | VoIP client (iOS) | ⛔ | Native VoIP/SIP stack — out of scope; meetings happen via scheduling + channel follow-ups |
| 0perationPrivacy/VoIP | VoIP server | ⛔ | Same |
| developerspace-samples/VoIP-Call-Sample | VoIP sample | ⛔ | Same |
| YutaroHayakawa/ipftrace2 | eBPF tracing | ⛔ | Infrastructure debugging tool |
| sibnerian/electron-promise-ipc | Electron IPC | ⛔ | Desktop framework internals |

## N. Developer tooling (4)

| Reference | What it is | TECH360 | Where / Round |
| --- | --- | --- | --- |
| cursor/plugins | Cursor editor plugins | ⛔ | IDE tooling — the in-product analog is the 44-agent registry with tools/permissions |
| anthropics/claude-plugins-community | Claude community plugins | ⛔ | Same analog |
| mksglu/context-mode | Context-mode dev tool | ⛔ | Same |
| JetBrains/go-modern-guidelines | Go style guide | ⛔ | TECH360 is TypeScript/Next.js — not a Go project |

## O. Unrelated or tangential domains (8)

| Reference | What it is | TECH360 | Where / Round |
| --- | --- | --- | --- |
| AprilNEA/OpenLogi | Logistics project | ⛔ | Different domain |
| volcengine/OpenViking | ByteDance open project | ⛔ | Different domain |
| fmtlib/fmt | C++ formatting library | ⛔ | Different language/domain |
| public-apis/public-apis | Public API directory | ⛔ | Directory, not a capability |
| affaan-m/ECC | Unrelated project | ⛔ | Different domain |
| alsk1992/CloddsBot | Bot project | ⛔ | TECH360's bots are the 44 in-product agents, not a chat-platform bot |
| bugcrowd/bugcrowd_university | Security training curriculum | ◐ | SECURITY.md + secret scanning + audit trail cover the applicable security posture; a training curriculum is not a feature |
| coreyhaines31/marketingskills | Marketing playbooks | ✅ | Content Studio now generates a persisted, implementation-ready Marketing Kit (positioning, ICPs, messaging, channel plan, launch calendar, landing-page outline, social/ads/email assets, KPIs, UTMs and compliance checklist) plus dedicated SEO briefs; backed by CST-020 with honest-claims constraints |

---

## Honest boundaries

1. **No fake features.** Every ⛔ above is a different product category — TECH360 does not simulate a page builder, a VoIP stack, a password manager, or a video render farm.
2. **Provider availability is not established here.** A historical note reported an LLM quota outage on September 16–17, 2026, but this audit did not re-check current provider quotas or production credentials. Treat live-provider behavior as **NOT VERIFIED** until a current authorized sandbox/acceptance test passes; failures must remain honest and must not fabricate success.
3. **Deployment boundary.** GitHub repository access is available in this session; GitHub Actions validates source against disposable MySQL and does not deploy production. There is no supported VPS/SSH deployment path. Hostinger's Node.js Web App Git integration is the intended production path, but its current connection, deployment, and live status remain **NOT VERIFIED**.

*This audit is repository documentation. The source-archive builder writes under ignored `archives/`; source archives must not be published under `public/downloads/`.*

---

## Extension — round 18 audit (owner's September 19 link batch)

**Scope:** 43 additional unique references from the owner's latest message (the video-production cluster and the developer/AI-tooling references). Every link was dispositioned against the delivered platform; no link was skipped.

## P. Video production & processing tools (33)

The applicable capability — *planning* video content (scripts, shot plans, storyboards) — is covered by agent VID-022. Actually rendering, editing, subtitling or super-resolving video files is a different product category: TECH360 is a business-management platform, not a video render farm. No fake video features are shipped.

| Reference | What it is | TECH360 | Where / Round |
| --- | --- | --- | --- |
| WEIFENG2333/VideoCaptioner | Video captioning tool | ⛔ | Video file processing — different product |
| ATH-MaaS/Pixelle-Video | Video generation service | ⛔ | Video rendering — different product |
| remotion-dev/remotion | Programmatic video in React | ◐ | VID-022 produces the *content plan* (script + shots); rendering rendered video files is out of scope |
| MarkTechStation/VideoCode | Code-to-video tool | ⛔ | Same rendering boundary |
| 3b1b/videos | Manim math-video source | ⛔ | Educational animation source — different domain |
| ytdl-org/youtube-dl | Video downloader | ⛔ | Downloader tooling — no business fit |
| bradautomates/claude-video | AI video workflow demo | ⛔ | Demo project — the agent-registry is the in-product analog |
| MeiGen-AI/InfiniteTalk | Talking-avatar video | ⛔ | Avatar rendering — different product |
| qdrzwd/VideoRecorder | Screen recorder | ⛔ | Desktop tooling |
| zai-org/CogVideo | Video generation model | ⛔ | Model research — TECH360 uses hosted SDK models |
| Tencent-Hunyuan/HunyuanVideo | Video generation model | ⛔ | Same |
| elebumm/RedditVideoMakerBot | Reddit→TTS video bot | ◐ | VID-022 covers the script/storyboard half; TTS+render is out of scope |
| Lightricks/LTX-Video | Video generation model | ⛔ | Model research |
| YaoFANGUK/video-subtitle-remover | Subtitle removal | ⛔ | Video file processing |
| leandromoreira/digital_video_introduction | Video-learning material | ⛔ | Educational content, not a capability |
| OpenTalker/video-retalking | Lip-sync video | ⛔ | Video processing |
| meituan-longcat/LongCat-Video | Video generation model | ⛔ | Model research |
| 0voice/audio_video_streaming | Streaming resource list | ⛔ | Resource directory |
| HITsz-TMG/VideoClaw | Video understanding | ◐ | The platform's video-understanding capability ships via the SDK on the backend (skills system); no fake in-product video feature is claimed |
| jitsi/jitsi-videobridge | WebRTC video bridge | ⛔ | SFU infrastructure — TECH360 meetings are scheduled + channel-followed, not a video-conference product |
| HKUDS/VideoAgent | Video-understanding agent | ◐ | Same as VideoClaw |
| LoSealL/VideoSuperResolution | Video upscaling | ⛔ | Video file processing |
| Augani/openreel-video | Video reel tool | ⛔ | Video product |
| Kosinkadink/ComfyUI-VideoHelperSuite | ComfyUI nodes | ⛔ | Pipeline tooling for image/video workflows |
| dunossauro/videomaker-helper | Video maker helper | ⛔ | Video tooling |
| burhankocabiyik/videomaker | Video maker | ⛔ | Video tooling |
| wtz2017/VideoMaker | Video maker | ⛔ | Video tooling |
| viniciusenari/slideshow-videomaker | Slideshow video maker | ⛔ | Video tooling |
| WuTao-CS/VideoMaker | Video maker | ⛔ | Video tooling |
| shubhamdevhouse/Animated-VideoMaker | Animated video maker | ⛔ | Video tooling |
| seed0001/videoMaker | Video maker | ⛔ | Video tooling |
| Bilal-Belli/videoMakerBOT | Video maker bot | ⛔ | Video tooling |
| Nncstudio/VideoMakerPro | Video maker pro | ⛔ | Video tooling |

## Q. Developer & AI-tooling references (10)

| Reference | What it is | TECH360 | Where / Round |
| --- | --- | --- | --- |
| cline/cline | AI coding IDE/agent | ⛔ | Developer IDE — TECH360's 44-agent registry with tools/permissions is the in-product analog (R7) |
| coder.qwen.ai | Qwen AI coder | ⛔ | Same category as cline |
| openrouter.ai | Model gateway | ⛔ | Model routing is provided by the SDK; no self-hosted gateway needed |
| openrouter.ai blog (tool-calling agent loop) | Agent-loop tutorial | ✅ | The pattern is implemented for real in `src/lib/agents/engine.ts` — structured tool use, strict JSON, retries, execution records, honest failures (R7–R8) |
| developer.meta.com/ai + astryx.atmeta.com | Meta AI dev platform | ⛔ | The WhatsApp Cloud API integration (Meta) is already the shipped Meta touchpoint (R5) |
| meta-models/meta-model-cookbook | Meta AI cookbook | ◐ | Multi-modal agent patterns; the platform's agents + SDK cover the applicable core |
| mureka.ai | AI music generation | ⛔ | Music synthesis — different product |
| buffer.com | Social media scheduling | ✅/◐ | SMM campaign studio + AI drafting + scheduled publishing cover the applicable core; multi-account social scheduling stays honestly channel-gated until credentials land (R7–R11) |
| stackoverflow.com | Q&A reference site | ⛔ | Reference site, not a capability |
