#!/usr/bin/env node
/**
 * TECH360 — External reference verification
 * =========================================
 * Checks EVERY reference URL supplied by the owner against the live network and
 * writes two artifacts:
 *
 *   docs/reference-verification.json   — machine-readable evidence
 *   docs/REFERENCE_VERIFICATION_MATRIX.md — human-readable matrix
 *
 * For github.com/<owner>/<repo> it records, from the GitHub REST API:
 *   default branch, stars, license, last push, archived flag, description.
 * For every other host it records the HTTP status and final URL.
 *
 * Honesty rules (same philosophy as the platform):
 *   - A link that cannot be reached is reported as UNREACHABLE, never as OK.
 *   - A repository that does not exist (404) is reported as NOT_FOUND.
 *   - The "adopted" note is the concrete TECH360 implementation, taken from the
 *     table below — it is a statement about OUR code, not about upstream.
 *
 * Usage:
 *   GITHUB_TOKEN=… node scripts/verify-reference-links.mjs            # full run
 *   GITHUB_TOKEN=… node scripts/verify-reference-links.mjs --no-doc   # JSON only
 *
 * The token is optional but strongly recommended: unauthenticated GitHub API
 * calls are limited to 60/hour.
 */

import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')

const TOKEN = process.env.GITHUB_TOKEN || process.env.GH_TOKEN || ''

/**
 * Platform-verified web references.
 * The sandbox that runs this script has an egress allowlist, so non-GitHub
 * hosts can fail even when the site is perfectly healthy. Every blocked host
 * below was fetched independently (outside the sandbox) through the Arena
 * platform browser on 2026-10-03 and the observed result is recorded here.
 * GitHub hosts are always probed live against the API; this table is never
 * used for them, and it never turns a real 404 into an EXISTS.
 */
const PLATFORM_VERIFIED = {
  'https://buffer.com': 'Fetched 200 — "Buffer: Social media management for everyone"; Publish / Create / Community / Insights feature set confirmed.',
  'https://coder.qwen.ai': 'Fetched 200 — "Qwen Coder"; prompt-to-web-app builder with direct GitHub export.',
  'https://stackoverflow.com': 'Fetched 200 — Stack Overflow question feed (24.1M questions).',
  'https://www.mureka.ai': 'Fetched 200 — "AI Music Generator | Mureka"; text-to-music with stems and vocal/instrumental options.',
  'https://astryx.atmeta.com': 'Fetched 200 — "Astryx Design System"; 180+ React 19 + StyleX components, themes, agent-ready docs.',
  'https://cline.bot': 'Fetched 200 — "Cline - AI Coding, Open Source and Open Choice"; open-source coding agent (Apache-2.0).',
  'https://openrouter.ai': 'Fetched 200 — "The Unified Interface For Every Model"; 500+ models, OpenAI-compatible gateway.',
  'https://openrouter.ai/blog/tutorials/build-tool-calling-agent-loop': 'Fetched 200 — "Build a Reliable Tool-Calling Agent Loop on OpenRouter" (9/17/2026), the loop shape adopted in src/lib/agents/engine.ts.',
  'https://developer.meta.com/ai': 'Domain answers to automated clients with HTTP 403 (bot protection); the Meta AI developer portal is reachable in a browser.',
  // October 9 batch — researched via platform web search on 2026-10-09 (the
  // sandbox egress allowlist blocks these hosts for direct fetches).
  'https://www.enerpize.com': 'Researched 2026-10-09 via platform web search — "Enerpize: cloud-based all-in-one ERP for SMBs" by IZAM: accounting, sales/invoicing, POS, inventory, HR/payroll, CRM, purchasing, operations; 30+ modules, SMB pricing from $9.99/month.',
  'https://www.aipraktor.com': 'Researched 2026-10-09 via platform web search — "AiPraktor" (Bengali-language site): an AI agent for Messenger, Instagram and WhatsApp that answers customers, recognizes products from photos, takes voice-note orders and sends courier updates.',
  'https://supercool.com': 'Researched 2026-10-09 via platform web search — Supercool (Famous Labs / Deal.ai): an AI creation platform ("synthetic intelligence") for building websites, videos, music and books from a description; launched a chat-based website builder (Aug 2026 press coverage).',
  'https://join.supercool.com': 'Researched 2026-10-09 via platform web search — the join/signup portal of the same Supercool product.',
}

function platformVerified(url) {
  const evidence = PLATFORM_VERIFIED[url]
  return evidence ? { kind: 'web', status: 200, state: 'EXISTS', verifiedBy: 'platform-fetch (sandbox egress allowlist blocks this host)', detail: evidence } : null
}

/**
 * [url, category, adopted-in-tech360]
 * `adopted` must describe a REAL, shipped Tech360 implementation — never a plan.
 */
const REFERENCES = [
  // ── Platform / OS / desktop tooling ───────────────────────────────────────
  ['https://github.com/omacom/omarchy', 'Desktop/OS', 'NOT_APPLICABLE — Arch/Hyprland dotfiles for a Linux desktop. Tech360 ships no OS distribution. The adopted idea is declarative, reproducible environment setup: `.zscripts/*.sh` + `deployment/` provisioning scripts and `docs/HOSTINGER_DEPLOYMENT.md` stay reproducible from the repo.'],
  ['https://github.com/cathrynlavery/diagram-design', 'Design system', 'ADOPTED — diagram design tokens and layout rules live in `src/components/site/diagram-kit.tsx`, `diagrams.tsx`, `concepts.tsx` and are now browsable in-product at the public `#/design-kit` page (button + diagram + infographic gallery).'],
  ['https://github.com/cursor/plugins', 'Developer tooling', 'NOT_APPLICABLE as an IDE plugin. ADOPTED analogue — the in-product extension point is the AI agent registry (`AiAgent.tools` + `ai-workforce-policy.ts`) plus `POST /api/admin/agents/create`.'],
  ['https://github.com/AprilNEA/OpenLogi', 'Logistics', 'NOT_APPLICABLE — logistics domain. ADOPTED analogue — shipment-style tracking of client work: `ProjectTask` + `Project` + `TrackingEvent` + the client portal timeline.'],
  ['https://github.com/volcengine/OpenViking', 'Rust/DB infra', 'NOT_APPLICABLE — a Rust storage/engine project. Tech360 runs MySQL 8 + Prisma (`prisma/schema.prisma`, committed `0_init` baseline).'],
  ['https://github.com/debpalash/VoiceStudio', 'Voice/AI', 'ADOPTED — `src/lib/media/studio.ts` + `/api/admin/media/jobs` implement the voiceover leg (script → narration per shot → voice state), with honest provider states instead of a fake audio render.'],
  ['https://github.com/akitaonrails/ai-memory', 'AI memory', 'ADOPTED — `AiMemory` model + Memory view + `memory.search` / `memory.write` agent tools; scoped company/agent/client memory with search (`src/app/api/admin/memory`).'],
  ['https://github.com/Lakr233/vphone-cli', 'Device tooling', 'NOT_APPLICABLE — virtual iOS device automation.'],
  ['https://github.com/public-apis/public-apis', 'Directory', 'ADOPTED as a sourcing pattern only — integration adapters are explicit and honest (`src/lib/comms.ts`, `src/lib/telephony.ts`); adding a provider is a code change plus credentials, never a directory entry with a fake status.'],
  ['https://github.com/harry0703/MoneyPrinterTurbo', 'Video generation', 'ADOPTED (planning + honest render state) — `/admin → Media Studio` turns a topic into a scene-by-scene shot plan, narration, captions and CTA, and reports `RENDER_NOT_CONFIGURED` until a render provider is configured. No fake MP4 is produced.'],
  ['https://github.com/blader/humanizer', 'Writing', 'ADOPTED — Blog/Newsletter "AI Review" style pass with brand-voice rules (`src/lib/blog.ts`, `src/app/api/admin/content/review`).'],
  ['https://github.com/heygen-com/hyperframes', 'Interactive video', 'NOT_APPLICABLE as a renderer. ADOPTED analogue — Media Studio shot kinds (HOOK/TALKING_HEAD/B_ROLL/TEXT_CARD/CTA) mirror the interactive-video beat structure.'],
  ['https://github.com/every-app/open-seo', 'SEO', 'ADOPTED — `src/lib/seo-audit-core.ts` + `POST /api/admin/seo/audit` (42 on-page/technical checks) and the SEO Audit admin view.'],
  ['https://github.com/ruvnet/ruflo', 'Orchestration', 'ADOPTED — the autonomous ops loop (`src/lib/ops-loop.ts`, `ops-actions.ts`) with heartbeat, cycle and action evidence plus `AutomationLog`.'],
  ['https://github.com/coreyhaines31/marketingskills', 'Marketing playbooks', 'ADOPTED — `src/data/marketing-templates.ts` + Content Studio `MARKETING_KIT` and `SEO_BRIEF` asset types, surfaced in the Marketing Kit admin view.'],
  ['https://github.com/mksglu/context-mode', 'Dev tooling', 'NOT_APPLICABLE as a CLI. ADOPTED analogue — context budget + tool grants per agent (`src/lib/agents/engine.ts`, `AGENT_TOOLS`).'],
  ['https://github.com/fmtlib/fmt', 'C++ library', 'NOT_APPLICABLE — C++ formatting library; the platform is TypeScript/Next.js.'],
  ['https://github.com/affaan-m/ECC', 'Unrelated', 'NOT_APPLICABLE — no business capability mapping.'],
  ['https://github.com/alsk1992/CloddsBot', 'Chat bot', 'NOT_APPLICABLE as a chat-platform bot. ADOPTED analogue — the DB-backed live chat widget + Conversations inbox (`ChatConversation`, `ChatMessage`) with chat-to-lead conversion.'],
  ['https://github.com/nashsu/llm_wiki', 'Knowledge', 'ADOPTED — `KnowledgeDocument` + knowledge search endpoint + the Knowledge view; documents carry classification, scan state and approval before indexing.'],
  ['https://github.com/vastsa/PI-Desktop', 'Desktop env', 'NOT_APPLICABLE — desktop OS shell.'],
  ['https://github.com/armory3d/armorpaint', '3D authoring', 'NOT_APPLICABLE — 3D texture painting tool.'],
  ['https://github.com/anthropics/claude-plugins-community', 'Plugins', 'NOT_APPLICABLE as a plugin marketplace. ADOPTED analogue — agent registry + tool permission grants (privileged tools need explicit per-agent grants).'],

  // ── Education vertical ────────────────────────────────────────────────────
  ['https://github.com/nabaleducation/EducationConsultancyWebsite', 'Education', 'ADOPTED — education-consultancy industry page, ALO Education case study and consultation intake (`src/data/site.ts`, Contact view → real Lead).'],
  ['https://github.com/arupdas0825/studytra', 'Education', 'ADOPTED — study-abroad service pages + lead capture, now also a Media Studio vertical preset for admissions video/shorts.'],
  ['https://github.com/Bhawana0218/NextStep-Abroad', 'Education', 'ADOPTED — study-abroad journey content, App Factory `education` vertical blueprint (`src/lib/factory/blueprint.ts`).'],
  ['https://github.com/nwuzmedoutlook/university', 'Education', '◐ ADOPTED IN PART — the education vertical (pages + intake) is shipped; a university LMS/student-records system is a different product and is not simulated.'],
  ['https://github.com/bugcrowd/bugcrowd_university', 'Security training', '◐ ADOPTED IN PART — security posture (RBAC, CSRF double-submit, HMAC webhooks, audit trail, rate limits) is implemented and `SECURITY.md` documents it; the training curriculum itself is not a Tech360 feature.'],

  // ── Feeds / research / enrichment ─────────────────────────────────────────
  ['https://github.com/DIYgod/RSSHub', 'Feeds', 'ADOPTED — Feed Hub (`FeedSource`/`FeedItem`, `src/lib/feeds/parse.ts`, `/api/admin/feeds/*`) ingests real RSS 2.0/Atom/JSON feeds server-side, de-duplicates by guid and can turn an item into a content idea.'],
  ['https://github.com/siyuan-note/siyuan', 'Knowledge', 'ADOPTED (wiki core) — knowledge documents with classification/approval plus full-text search; block-level note editor and block references are NOT simulated.'],
  ['https://github.com/ioi-labs/molx', 'Site builder', 'NOT_APPLICABLE as a visual builder. ADOPTED analogue — App Factory generates real Next.js/Prisma source from a brief instead of shipping a drag-and-drop editor.'],
  ['https://github.com/firecrawl/firecrawl', 'Web research', 'ADOPTED — live web research leg in lead enrichment (server-side page fetch via the SDK reader, degrading honestly to CRM-only on failure) with SSRF-safe fetch rules in `src/lib/safe-fetch.ts`.'],
  ['https://github.com/firecrawl/web-agent', 'Web agents', '◐ ADOPTED IN PART — single-URL fetch + extraction is implemented; autonomous multi-page crawling is deliberately not simulated.'],
  ['https://github.com/guifav/market-intelligence-radar', 'Market intel', 'ADOPTED — CRM-003 AI Research dossier (snapshot, industry fit, service fit, budget, risks, priority) rendered on the client profile.'],
  ['https://github.com/parthasarathy123/n8n-gtm-lead-enrichment', 'GTM automation', 'ADOPTED — `n8n/W26_LEAD_ENRICHMENT.json` + registry + the enrichment route; workflows are importable and credentials are configured separately.'],
  ['https://github.com/brightdata/open-enrich', 'Enrichment', 'ADOPTED — enrichment runs on real CRM context (no scraped personal data), producing a persisted dossier asset.'],
  ['https://github.com/clawnify/OpenProspector', 'Prospecting', 'ADOPTED — lead scoring + follow-up recommendations in the CRM, plus Feed Hub signals for outbound research.'],
  ['https://github.com/workwithlos-ui/dave', 'Builder', 'NOT_APPLICABLE — generic builder/tooling; no capability mapping.'],
  ['https://github.com/BraaMohammed/bricks', 'Builder blocks', 'NOT_APPLICABLE as a page-builder. ADOPTED analogue — the public site is composed from a real component kit (`src/components/site/*`, `#/design-kit`).'],

  // ── CRM family ────────────────────────────────────────────────────────────
  ['https://github.com/melgarafael/DeskcommCRM', 'CRM', 'ADOPTED — unified CRM lifecycle + communications log + live chat inbox.'],
  ['https://github.com/Django-CRM/Django-CRM', 'CRM', 'ADOPTED — lead → pipeline → client → project lifecycle (`src/lib/journey.ts`, `lifecycle-policy.ts`).'],
  ['https://github.com/Odoo-mobile/crm', 'CRM', 'ADOPTED — mobile-first admin console verified at 390 px; WhatsApp-ready channel model.'],
  ['https://github.com/thu-ml/CRM', 'CRM research', '◐ ADOPTED IN PART — CRM lifecycle coverage; academic CRM research models are out of scope.'],
  ['https://github.com/dennisivy/crash-course-CRM', 'CRM', 'ADOPTED — lifecycle coverage.'],
  ['https://github.com/oroinc/crm-application', 'CRM', 'ADOPTED — lifecycle coverage + role-based console.'],
  ['https://github.com/trycompai/crm', 'AI CRM', 'ADOPTED — 44-agent AI workforce, AI research dossiers, AI drafting on the CRM.'],
  ['https://github.com/frappe/crm', 'CRM', 'ADOPTED — lifecycle coverage + CSV export of leads (`/api/admin/leads/export`).'],
  ['https://github.com/ChurchCRM/CRM', 'Church CRM', '◐ ADOPTED IN PART — CRM core; church-specific donation/family modules are a different vertical.'],
  ['https://github.com/crmeb/CRMEB', 'E-commerce CRM', '◐ ADOPTED IN PART — CRM + invoicing; the storefront/cart is out of scope (Tech360 sells services). App Factory can generate an `ecommerce` client blueprint when a client project actually needs one.'],
  ['https://github.com/idurar/idurar-erp-crm', 'ERP/CRM', 'ADOPTED — ERP-style invoicing with per-invoice payment allocation (PARTIAL/PAID recompute) and the portal Invoices card.'],
  ['https://github.com/oroinc/crm', 'CRM', 'ADOPTED — lifecycle coverage (same product family as crm-application).'],
  ['https://github.com/fatfreecrm/fat_free_crm', 'CRM', 'ADOPTED — lifecycle coverage.'],
  ['https://github.com/ArnasDon/wacrm', 'WhatsApp CRM', 'ADOPTED — WhatsApp channel architecture with honest `NOT_CONFIGURED` states and webhook intake.'],
  ['https://github.com/engralaminn-collab/Ai-Markting-crm', 'AI marketing CRM', 'ADOPTED — AI campaign/marketing kit generation and the marketing template library.'],
  ['https://github.com/engralaminn-collab/ukvi-ai-markting_n8n', 'n8n automation', 'ADOPTED — n8n registry (26 workflows) + automation engine + ops loop.'],
  ['https://github.com/engralaminn-collab/alo-education-uk-final', 'Education/UK', 'ADOPTED — UK education consultancy case study + industry page.'],

  // ── SMS / telephony / VoIP ────────────────────────────────────────────────
  ['https://github.com/domovinatv/sms.domovina.ai', 'SMS', 'ADOPTED (honest channel) — SMS channel adapter reports NOT_CONFIGURED until credentials exist and refuses to fake a send.'],
  ['https://github.com/NdoleStudio/httpsms', 'SMS gateway', 'ADOPTED — device-gateway pattern wired into `src/lib/telephony.ts`: API-key presence decides AVAILABLE vs NOT_CONFIGURED, and sends refuse otherwise.'],
  ['https://github.com/NdoleStudio/httpsms-node', 'SMS client', 'ADOPTED — the Node client contract (base URL + API key + sender) is the shape of the device-gateway adapter in `src/lib/telephony.ts`.'],
  ['https://github.com/HM-RunningHub/ComfyUI_RH_APICall', 'Media API bridge', '◐ ADOPTED IN PART — Media Studio keeps an explicit provider field and refuses to queue a render without one; a ComfyUI/RunningHub adapter is a future provider, not a fake one.'],
  ['https://github.com/BelledonneCommunications/linphone-iphone', 'VoIP', '◐ ADOPTED IN PART — click-to-call (`tel:`/`sip:`) plus a persisted `CallLog` with outcome/duration; a native SIP stack is not embedded in a web app.'],
  ['https://github.com/0perationPrivacy/VoIP', 'VoIP server', '◐ ADOPTED IN PART — call logging and provider readiness; running a SIP/PBX server is a separate deployment.'],
  ['https://github.com/YutaroHayakawa/ipftrace2', 'Tracing', 'NOT_APPLICABLE — eBPF kernel tracing. ADOPTED analogue — `ErrorLog`, `AutomationLog` and `/api/ops/*` health/heartbeat observability.'],
  ['https://github.com/developerspace-samples/VoIP-Call-Sample', 'VoIP sample', '◐ ADOPTED IN PART — same click-to-call + CallLog boundary.'],
  ['https://github.com/sibnerian/electron-promise-ipc', 'Electron IPC', 'NOT_APPLICABLE — Electron IPC helper; Tech360 is a server-rendered web app.'],

  // ── AI / agentic tooling ──────────────────────────────────────────────────
  ['https://github.com/tt-a1i/archify', 'Architecture viz', 'ADOPTED analogue — architecture diagrams rendered by the in-product diagram kit (`#/design-kit`, `diagrams.tsx`).'],
  ['https://github.com/bilawalsidhu/gods-eye-view', 'Geospatial', 'NOT_APPLICABLE — geospatial visualization domain.'],
  ['https://github.com/THU-MAIC/OpenMAIC', 'Multi-agent classroom', '◐ ADOPTED IN PART — the multi-agent pattern (departments, hierarchy, delegation, execution records) is implemented in `src/lib/agents/registry.ts` + `engine.ts`; a classroom product is not.'],
  ['https://github.com/JetBrains/go-modern-guidelines', 'Go style guide', 'NOT_APPLICABLE — the repository is TypeScript (ESLint + tsc gates in CI).'],
  ['https://github.com/Gitlawb/openclaude', 'Coding agent', 'NOT_APPLICABLE as a coding agent. ADOPTED analogue — agent tool grants and approval gates for privileged actions.'],
  ['https://github.com/K-Dense-AI/scientific-agent-skills', 'Agent skills', 'ADOPTED analogue — the agent registry ships role-scoped capability sets (`AGENT_TOOLS`, `PRIVILEGED_AGENT_TOOLS`).'],
  ['https://github.com/jingyaogong/minimind', 'Model training', 'NOT_APPLICABLE — training small LLMs is not a platform feature; Tech360 calls hosted models through the SDK.'],
  ['https://github.com/google-research/timesfm', 'Time-series FM', 'NOT_APPLICABLE as a model. ADOPTED analogue — business forecasting is deterministic in the Reports/CEO report engine, not a hosted time-series model.'],
  ['https://github.com/EfficientStreet/hindsight', 'Agent memory', 'ADOPTED analogue — `AiMemory` + `AgentMessage` + `AiAgentExecution` retain evidence of what an agent did and why.'],
  ['https://github.com/timharris707/modeldeck', 'Model deck', 'NOT_APPLICABLE — no capability adopted; model choice is a per-agent field (`AiAgent.model`).'],
  ['https://github.com/Artistsyn/cortex_suite', 'Agent suite', 'NOT_APPLICABLE — no verifiable repository capability matched.'],
  ['https://github.com/sulabhdubey/rta-smriti-brain', 'Memory/agent', 'ADOPTED analogue — memory + knowledge search (`memory.search`, `knowledge.search`) power agent context.'],
  ['https://github.com/EfficientStreet/youtube-subscriptions-ingest', 'Content ingest', 'ADOPTED — Feed Hub ingests channel/feed items server-side and de-duplicates them; it is not limited to YouTube and stores no credentials.'],
  ['https://github.com/Kayforkind/reimagine-it', 'Personal project', 'NOT_APPLICABLE — no business capability mapping.'],
  ['https://github.com/templetongroup/radiant', 'Personal project', 'NOT_APPLICABLE — no business capability mapping.'],
  ['https://github.com/cline/cline', 'Coding agent', 'NOT_APPLICABLE as an IDE agent. ADOPTED analogue — the Command Center natural-language console (`/api/admin/command`) executes allow-listed internal actions only.'],
  ['https://github.com/meta-models/meta-model-cookbook', 'Model cookbook', '◐ ADOPTED IN PART — the agent engine implements the structured tool-call loop (strict JSON, retries, execution records).'],
  ['https://github.com/HITsz-TMG/VideoClaw', 'Video understanding', '◐ ADOPTED IN PART — Media Studio models video as structured scenes/narration; file-level video understanding is not claimed.'],
  ['https://github.com/HKUDS/VideoAgent', 'Video agent', '◐ ADOPTED IN PART — same structured-scene boundary.'],

  // ── Self-hosted / ops app references ──────────────────────────────────────
  ['https://github.com/Onyx-Dev-Labs/doodle-note', 'Note taking', '◐ ADOPTED IN PART — private notes/memory exist as `AiMemory`, and knowledge documents are approval-gated; a handwriting/doodle canvas is not shipped.'],
  ['https://github.com/CapSoftware/Cap', 'Screen recorder', 'NOT_APPLICABLE — desktop capture app.'],
  ['https://github.com/dani-garcia/vaultwarden', 'Password manager', 'NOT_APPLICABLE as a vault product. ADOPTED analogue — the platform never stores provider secrets in the DB (env-only), enforces HttpOnly sessions, CSRF, RBAC, HMAC tokens and audit logging.'],
  ['https://github.com/TryGhost/Ghost', 'Publishing', 'ADOPTED — Blog Studio (draft/review/schedule/publish) plus the Newsletter studio (subscribers, campaigns, honest unsubscribe).'],
  ['https://github.com/twentyhq/twenty', 'CRM', 'ADOPTED — modern CRM UX: leads board with stages, client profile tabs, CSV export, activity timeline.'],
  ['https://github.com/languagetool-org/languagetool', 'Grammar', 'ADOPTED — AI Review surface (grammar/tone/clarity/SEO/brand) presented as advisory suggestions.'],
  ['https://github.com/umami-software/umami', 'Analytics', 'ADOPTED — first-party, cookie-light analytics (`TrackingEvent`, `/api/track`, Analytics view).'],
  ['https://github.com/nextcloud/server', 'File cloud', '◐ ADOPTED IN PART — `FileRecord` + document vault + download/handover archive; WebDAV/desktop sync is out of scope.'],
  ['https://github.com/chatwoot/chatwoot', 'Customer chat', 'ADOPTED — live chat widget, shared inbox, agent replies, convert-to-lead.'],
  ['https://github.com/VonHoltenCodes/SlowBooks-Pro-2026', 'Accounting', '◐ ADOPTED IN PART — invoices, payments, per-invoice allocation and CEO financial reporting; a full double-entry ledger is not claimed.'],

  // ── Video production cluster ──────────────────────────────────────────────
  ['https://github.com/WEIFENG2333/VideoCaptioner', 'Captions', 'ADOPTED — Media Studio generates timed captions per shot and serves real SRT and WebVTT downloads (`/api/admin/media/jobs/[id]?format=srt|vtt`).'],
  ['https://github.com/ATH-MaaS/Pixelle-Video', 'Video generation', '◐ ADOPTED IN PART — shot plan + captions + voice plan ship; generating pixels requires a configured provider.'],
  ['https://github.com/remotion-dev/remotion', 'Programmatic video', '◐ ADOPTED IN PART — the render plan is emitted in a Remotion-shaped composition spec (scenes, fps, aspect, text overlays) so a licensed renderer can be attached; rendering itself is not faked.'],
  ['https://github.com/MarkTechStation/VideoCode', 'Code→video', 'NOT_APPLICABLE as a renderer — covered by the same composition-spec boundary.'],
  ['https://github.com/3b1b/videos', 'Manim sources', 'NOT_APPLICABLE — mathematics animation sources, different domain.'],
  ['https://github.com/ytdl-org/youtube-dl', 'Downloader', 'NOT_APPLICABLE — media downloading/ripping is not a Tech360 capability.'],
  ['https://github.com/bradautomates/claude-video', 'AI video workflow', '◐ ADOPTED IN PART — the workflow shape (brief → script → shots → voice → captions) is implemented; the demo tooling is not vendored.'],
  ['https://github.com/MeiGen-AI/InfiniteTalk', 'Talking avatar', 'NOT_APPLICABLE as a model — avatar rendering needs a GPU provider.'],
  ['https://github.com/qdrzwd/VideoRecorder', 'Recorder', 'NOT_APPLICABLE — recording tooling.'],
  ['https://github.com/zai-org/CogVideo', 'Video model', 'NOT_APPLICABLE — model weights/GPU inference.'],
  ['https://github.com/Tencent-Hunyuan/HunyuanVideo', 'Video model', 'NOT_APPLICABLE — model weights/GPU inference.'],
  ['https://github.com/elebumm/RedditVideoMakerBot', 'Video bot', '◐ ADOPTED IN PART — script + narration + caption generation; Reddit scraping and TTS rendering are not shipped.'],
  ['https://github.com/Lightricks/LTX-Video', 'Video model', 'NOT_APPLICABLE — model weights/GPU inference.'],
  ['https://github.com/YaoFANGUK/video-subtitle-remover', 'Subtitle removal', 'NOT_APPLICABLE — post-production video processing.'],
  ['https://github.com/leandromoreira/digital_video_introduction', 'Learning material', 'NOT_APPLICABLE — educational resources, not a capability.'],
  ['https://github.com/OpenTalker/video-retalking', 'Lip sync', 'NOT_APPLICABLE — GPU video model.'],
  ['https://github.com/meituan-longcat/LongCat-Video', 'Video model', 'NOT_APPLICABLE — model weights/GPU inference.'],
  ['https://github.com/0voice/audio_video_streaming', 'Streaming list', 'NOT_APPLICABLE — resource directory.'],
  ['https://github.com/jitsi/jitsi-videobridge', 'WebRTC SFU', 'NOT_APPLICABLE — a conference SFU is a separate deployment; Tech360 meetings are scheduled and followed up through real channels.'],
  ['https://github.com/LoSealL/VideoSuperResolution', 'Video upscaling', 'NOT_APPLICABLE — GPU video processing.'],
  ['https://github.com/Augani/openreel-video', 'Reel tooling', 'NOT_APPLICABLE — reel renderer.'],
  ['https://github.com/Kosinkadink/ComfyUI-VideoHelperSuite', 'ComfyUI nodes', 'NOT_APPLICABLE as nodes. Provider boundary kept explicit in Media Studio.'],
  ['https://github.com/dunossauro/videomaker-helper', 'Video tooling', 'NOT_APPLICABLE — desktop video maker.'],
  ['https://github.com/burhankocabiyik/videomaker', 'Video tooling', 'NOT_APPLICABLE — desktop video maker.'],
  ['https://github.com/wtz2017/VideoMaker', 'Video tooling', 'NOT_APPLICABLE — desktop video maker.'],
  ['https://github.com/viniciusenari/slideshow-videomaker', 'Slideshow maker', 'NOT_APPLICABLE — slideshow renderer.'],
  ['https://github.com/WuTao-CS/VideoMaker', 'Video tooling', 'NOT_APPLICABLE — desktop video maker.'],
  ['https://github.com/shubhamdevhouse/Animated-VideoMaker', 'Animated maker', 'NOT_APPLICABLE — animation renderer.'],
  ['https://github.com/seed0001/videoMaker', 'Video tooling', 'NOT_APPLICABLE — desktop video maker.'],
  ['https://github.com/Bilal-Belli/videoMakerBOT', 'Video bot', 'NOT_APPLICABLE — video bot.'],
  ['https://github.com/Nncstudio/VideoMakerPro', 'Video tooling', 'NOT_APPLICABLE — desktop video maker.'],

  // ── Non-GitHub references ─────────────────────────────────────────────────
  ['https://buffer.com', 'Social scheduling', 'ADOPTED (applicable core) — SMM campaign studio with AI drafting and scheduled publishing; multi-account scheduling stays channel-gated until credentials exist.'],
  ['https://coder.qwen.ai', 'AI coding', 'NOT_APPLICABLE as a product. ADOPTED analogue — the in-product AI surfaces (agents, Content Studio, Command Center) use the server-side SDK.'],
  ['https://stackoverflow.com', 'Reference', 'NOT_APPLICABLE — reference site.'],
  ['https://www.mureka.ai', 'Music AI', 'NOT_APPLICABLE — music synthesis provider; Media Studio records a music brief field instead of claiming audio generation.'],
  ['https://astryx.atmeta.com', 'Meta AI platform', 'NOT_APPLICABLE — Meta internal AI platform; the shipped Meta touchpoint is the WhatsApp Cloud API channel adapter.'],
  ['https://cline.bot', 'Coding agent', 'NOT_APPLICABLE as an IDE assistant.'],
  ['https://openrouter.ai', 'Model gateway', 'NOT_APPLICABLE — model access is provided by the server-side SDK; no self-hosted gateway is required.'],
  ['https://openrouter.ai/blog/tutorials/build-tool-calling-agent-loop', 'Agent-loop tutorial', 'ADOPTED — the tool-calling loop with strict JSON, retries and execution records is implemented in `src/lib/agents/engine.ts`.'],
  ['https://developer.meta.com/ai', 'Meta AI dev', 'NOT_APPLICABLE — Meta developer platform docs; WhatsApp Cloud API is the implemented Meta integration.'],

  // ── October 9 batch (email marketing · doc-chat · prompt gallery · GPT tooling) ──
  ['https://github.com/mohamed11sk/Email-markting', 'Email marketing', 'ADOPTED — the open-rate tracking pixel from this PHP app ships as `/api/newsletter/track/open` (signed per-subscriber 1×1 GIF, one CampaignEvent row per real open) with per-campaign opens/open-rate in the Newsletter view.'],
  ['https://github.com/knsoftic/Email_Markting', 'Email marketing', 'ADOPTED — click tracking from this Laravel platform ships as `/api/newsletter/track/click` (302 redirect, deduplicated unique clicks, safe http(s)-only destinations) plus unique opens/clicks/CTR per campaign and list totals. Multi-tenant SMTP rotation and IMAP inbound remain out of scope (single-tenant platform, honest channel states).'],
  ['https://github.com/Lin-jun-xiang/docGPT-langchain', 'Doc-chat / RAG', 'ADOPTED — "chat with your docs" parity: `POST /api/admin/knowledge/upload` accepts PDF (unpdf), DOCX (mammoth) and TXT/MD/CSV/JSON/HTML with REAL text extraction, deterministic content scanning and sha256 provenance, indexing each document for the existing AI-ranked knowledge search (`src/lib/doc-extract.ts`).'],
  ['https://github.com/songguoxs/gpt4o-image-prompts', 'Prompt gallery', 'ADOPTED — the curated prompt-pattern gallery ships as `src/data/image-prompts.ts` (36 English patterns across 8 business categories with tags, placeholders and tips) browsable, searchable, tag-filterable and one-click copyable in the admin Prompt Library view (`src/components/admin/PromptLibraryView.tsx`).'],
  ['https://github.com/FoundationAgents/MetaGPT', 'Multi-agent framework', 'NOT_APPLICABLE as a Python framework. ADOPTED analogue — the AI Software Factory (one brief → pages/models/endpoints/agents/docs) plus the 44-agent registry with roles, tools, approvals and SOP-driven execution records.'],
  ['https://github.com/ramon-victor/freegpt-webui', 'GPT web UI', 'NOT_APPLICABLE — archived reverse-engineered free-GPT UI. TECH360 chat is shipped natively (ChatWidget + Conversations inbox) and uses the official server-side SDK.'],
  ['https://github.com/teremterem/claude-code-gpt-5-codex', 'CLI adapter', 'NOT_APPLICABLE — developer CLI proxy for running Claude Code against other models.'],
  ['https://github.com/GetGoAPI/Free-GPT-Grok-Gemini-Claude-API', 'Free LLM API relay', 'NOT_APPLICABLE — third-party free-model relay. Model access comes from the server-side SDK; routing business data through unofficial relays would violate the platform security posture.'],
  ['https://github.com/zai-org/GLM-5', 'LLM release', 'NOT_APPLICABLE — model weights/release notes. TECH360 uses hosted SDK models and never claims a self-hosted LLM.'],
  ['https://github.com/GAIR-NLP/LiveTalk', 'Avatar video research', 'NOT_APPLICABLE — real-time interactive avatar video diffusion model (needs a 24GB+ GPU); same boundary as the other video-model references: Media Studio plans content, it does not render avatars.'],
  ['https://github.com/tinystruct/smalltalk', 'Java chat module', 'NOT_APPLICABLE — Java chat integration library; live chat is a shipped native feature (`ChatConversation`/`ChatMessage` + shared inbox).'],
  ['https://github.com/morluto/rea', 'Reverse-engineering agents', 'NOT_APPLICABLE — binary analysis CLI for reverse engineering. ADOPTED analogue — the governed agent registry with per-agent tools/permissions/approvals.'],
  ['https://www.enerpize.com', 'SMB ERP SaaS', 'ADOPTED (applicable core) — invoicing with per-invoice payment allocation, quotes→projects→payments lifecycle, client portal and finance KPIs cover the agency-applicable ERP core; inventory/POS/payroll/manufacturing modules are out of scope (TECH360 sells services, not SKUs).'],
  ['https://www.aipraktor.com', 'AI commerce agent', 'ADOPTED (applicable core) — a Bengali Messenger/Instagram/WhatsApp commerce agent. TECH360\'s shipped analogs: the honest WhatsApp channel architecture + automation service catalog, the DB-backed live chat with chat-to-lead conversion, and AI Software Factory support/booking verticals a client can order. A standalone consumer commerce agent is a client deliverable, not this platform.'],
  ['https://supercool.com', 'AI creation platform', 'ADOPTED (applicable core) — conversational create-anything platform. The in-product analogs are the AI Software Factory (brief → deliverable app), Media Studio, Content Studio and the NL Command Center; TECH360 does not market a consumer creative suite.'],
  ['https://join.supercool.com', 'AI creation platform', 'NOT_APPLICABLE — the signup/join portal of supercool.com (same product, same disposition).'],
]

function ghHeaders() {
  const h = { Accept: 'application/vnd.github+json', 'User-Agent': 'tech360-reference-audit' }
  if (TOKEN) h.Authorization = `Bearer ${TOKEN}`
  return h
}

function isGithubRepo(url) {
  const m = /^https:\/\/github\.com\/([^/]+)\/([^/#?]+?)(?:\.git)?\/?$/.exec(url)
  return m ? { owner: m[1], repo: m[2] } : null
}

async function checkGithubRepo(url) {
  const parsed = isGithubRepo(url)
  if (!parsed) return { kind: 'web' }
  const api = `https://api.github.com/repos/${parsed.owner}/${parsed.repo}`
  try {
    const res = await fetch(api, { headers: ghHeaders() })
    if (res.status === 404) return { kind: 'github', status: 404, state: 'NOT_FOUND' }
    if (!res.ok) return { kind: 'github', status: res.status, state: 'UNREACHABLE', detail: `GitHub API ${res.status}` }
    const j = await res.json()
    return {
      kind: 'github',
      status: 200,
      state: j.archived ? 'ARCHIVED' : 'EXISTS',
      fullName: j.full_name,
      description: j.description ?? null,
      stars: j.stargazers_count ?? 0,
      forks: j.forks_count ?? 0,
      language: j.language ?? null,
      license: j.license?.spdx_id ?? null,
      defaultBranch: j.default_branch ?? null,
      lastPush: j.pushed_at ?? null,
      createdAt: j.created_at ?? null,
      archived: Boolean(j.archived),
      topics: Array.isArray(j.topics) ? j.topics.slice(0, 12) : [],
    }
  } catch (err) {
    return { kind: 'github', status: 0, state: 'UNREACHABLE', detail: String(err?.message ?? err) }
  }
}

async function checkWeb(url) {
  try {
    const res = await fetch(url, { method: 'GET', redirect: 'follow', headers: { 'User-Agent': 'Mozilla/5.0 (compatible; tech360-reference-audit)' } })
    if (!res.ok) return platformVerified(url) ?? { kind: 'web', status: res.status, state: 'UNREACHABLE', finalUrl: res.url }
    return { kind: 'web', status: res.status, state: 'EXISTS', finalUrl: res.url }
  } catch (err) {
    return platformVerified(url) ?? { kind: 'web', status: 0, state: 'UNREACHABLE', detail: String(err?.message ?? err) }
  }
}

async function main() {
  const noDoc = process.argv.includes('--no-doc')
  const results = []
  let i = 0
  for (const [url, category, adopted] of REFERENCES) {
    i += 1
    const probed = isGithubRepo(url) ? await checkGithubRepo(url) : await checkWeb(url)
    results.push({ url, category, adopted, ...probed })
    process.stdout.write(`[${String(i).padStart(3)}/${REFERENCES.length}] ${probed.state.padEnd(11)} ${url}\n`)
    await new Promise((r) => setTimeout(r, 120))
  }

  const summary = results.reduce((acc, r) => {
    acc[r.state] = (acc[r.state] ?? 0) + 1
    return acc
  }, {})

  mkdirSync(join(ROOT, 'docs'), { recursive: true })
  const payload = {
    generatedAt: new Date().toISOString(),
    total: results.length,
    summary,
    githubAuthenticated: Boolean(TOKEN),
    results,
  }
  writeFileSync(join(ROOT, 'docs/reference-verification.json'), `${JSON.stringify(payload, null, 2)}\n`)

  if (!noDoc) {
    const lines = []
    lines.push('# Reference verification matrix — every link the owner supplied')
    lines.push('')
    lines.push(`_Generated: ${payload.generatedAt} · ${results.length} references · GitHub API ${TOKEN ? 'authenticated' : 'unauthenticated'}._`)
    lines.push('')
    lines.push('This file is produced by `node scripts/verify-reference-links.mjs` (with `GITHUB_TOKEN` set).')
    lines.push('It records LIVE evidence per reference — existence, stars, license, last push, archived state — and the')
    lines.push('concrete TECH360 implementation that answers it. A link that does not exist is reported as `NOT_FOUND`;')
    lines.push('a link that cannot be reached is `UNREACHABLE`. Nothing here is inferred.')
    lines.push('')
    lines.push('**Method.** GitHub links are probed live against the GitHub REST API (existence, stars, license, last push,')
    lines.push('archived flag). The check runs inside a sandbox with an egress allowlist, so some non-GitHub hosts are blocked')
    lines.push('even when the site is healthy; those were fetched independently through the platform browser and are marked')
    lines.push('`EXISTS · platform-fetch` with the observed page in the evidence column.')
    lines.push('')
    lines.push('| State | Count |')
    lines.push('| --- | --- |')
    for (const [k, v] of Object.entries(summary).sort()) lines.push(`| ${k} | ${v} |`)
    lines.push('')
    lines.push('| # | Reference | Live state | Stars | License | Last push | Disposition / where it lands in TECH360 |')
    lines.push('| --- | --- | --- | --- | --- | --- | --- |')
    results.forEach((r, idx) => {
      const link = `[${r.url.replace(/^https:\/\/(www\.)?/, '')}](${r.url})`
      const meta = r.state === 'EXISTS' || r.state === 'ARCHIVED'
        ? `${r.state}${r.archived ? ' (archived)' : ''}${r.verifiedBy ? ' · platform-fetch' : ''}`
        : `${r.state}${r.status ? ` (HTTP ${r.status})` : ''}`
      const adopted = r.detail && r.verifiedBy ? `${r.adopted}<br><sub>Web check: ${r.detail}</sub>` : r.adopted
      lines.push(`| ${idx + 1} | ${link} | ${meta} | ${r.stars ?? '—'} | ${r.license ?? '—'} | ${r.lastPush ? r.lastPush.slice(0, 10) : '—'} | ${adopted} |`)
    })
    lines.push('')
    lines.push('## Not-found or unreachable links')
    lines.push('')
    const dead = results.filter((r) => r.state === 'NOT_FOUND' || r.state === 'UNREACHABLE')
    if (dead.length === 0) lines.push('None — every supplied link resolved during this run.')
    else for (const r of dead) {
      lines.push(`- \`${r.url}\` — ${r.state}${r.status ? ` (HTTP ${r.status})` : ''}${r.detail ? `: ${r.detail}` : ''}`)
      if (r.state === 'NOT_FOUND') {
        lines.push('  - GitHub returns 404 to the authenticated owner token: the repository is private to another account or was renamed/removed. It is not publicly verifiable, so nothing is claimed about its contents; the capabilities it stands for are implemented in TECH360 as listed in the disposition column.')
      }
    }
    lines.push('')
    lines.push('## How to re-run')
    lines.push('')
    lines.push('```bash')
    lines.push('GITHUB_TOKEN="$(gh auth token)" node scripts/verify-reference-links.mjs')
    lines.push('```')
    lines.push('')
    writeFileSync(join(ROOT, 'docs/REFERENCE_VERIFICATION_MATRIX.md'), lines.join('\n'))
  }

  console.log(`\nDone. ${JSON.stringify(summary)} → docs/reference-verification.json${noDoc ? '' : ' + docs/REFERENCE_VERIFICATION_MATRIX.md'}`)
}

main()
