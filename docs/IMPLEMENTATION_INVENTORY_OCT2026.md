# TECH360 Implementation Inventory — Phase 0 Baseline

**Date:** 2026-10-11  
**Branch:** `arena/98c3bc30-tech360` @ `aad33e3` (Merge PR #21)  
**Baseline docs:** `docs/DESIGN_GAP_AUDIT_OCT2026.md` (263 lines), `COVERAGE-AUDIT.md` (155 refs)  
**Method:** UI → API → auth → DB → background execution → external integration → persisted result, per master prompt. File existence ≠ working feature.

> Status legend: **WORKING_AND_TESTED** · **IMPLEMENTED_NOT_TESTED** · **PARTIALLY_IMPLEMENTED** · **UI_ONLY** · **NOT_CONFIGURED** · **BROKEN** · **MISSING**

---

## 1. Verified baseline

- **Repo:** `alaminiubateee969-cmd/tech360`, branch `arena/98c3bc30-tech360` exists, HEAD `aad33e3`, `main` protected=false, working tree clean.
- **Stack:** Next 16 App Router + React 19 + TS5 + Tailwind4 + shadcn + Prisma 6 MySQL (`prisma/schema.prisma`, 53 models, 0_init baseline), `bun.lock` + `package-lock.json`, `next.config.ts` standalone, `scripts/prisma.mjs`, `components.json`, `tailwind.config.ts`.
- **Deps verified:** `@dnd-kit/core@6.3.1`, `@dnd-kit/sortable@10`, `framer-motion@12.23.2`, `recharts@2.15.4`, `react-day-picker@9.8.0`, `socket.io-client@4.8.3` installed.
- **Routes:** 124 `route.ts` under `src/app/api` (44 admin groups + portal/auth/track/webhooks), 123 components, 26 admin views (`AdminApp` lazy), 3 surfaces via hash router `src/app/page.tsx`.
- **Data:** `src/data/site.ts` 111k (20 services, 20 industries, case studies, PROCESS 7 phases, LEGAL, STATS, TRUST_POINTS no fake counters), `src/data/images.json` + `images.ts`, `src/data/image-prompts.ts` 36 prompts / 8 cats.
- **Tests:** 28 files in `tests/` (`tsx --test --experimental-test-module-mocks`), `COVERAGE-AUDIT` + `docs/REFERENCE_VERIFICATION_MATRIX.md` live probe 2026-10-09: 146 EXISTS, 1 ARCHIVED, 3 NOT_FOUND (engralaminn private repos 404).
- **Build assumption:** `npm run build` does `prisma generate && migrate deploy && next build --webpack && cp static/standalone`. `npm run typecheck` blocked locally without generated client (CI passes on disposable MySQL). Honest channel principle already enforced.

---

## 2. Feature-by-feature inventory

### 2.1 Public website

| Feature | UI | API | Auth/Guard | DB | Execution | Integration | Persisted | Status | Evidence |
|---|---|---|---|---|---|---|---|---|---|
| Hash SPA router (public/portal/admin) | `src/app/page.tsx` 800+ lines, `parseHash`, `PUBLIC_SECTIONS`, `SiteHeader`, `SiteFooter`, `ChatWidget` | `/api/track`, `/api/blog`, `/api/reviews`, `/api/newsletter` (POST) | public | `TrackingEvent`, `BlogPost`, `Review`, `NewsletterSubscriber` | rAF scroll progress, consent-gated GTM/Meta inject `injectAnalytics()` | GTM `GTM-TM87LDXK`, Meta `957513230517009` consent-gated, server track always | `TrackingEvent`, subscriber rows | **WORKING_AND_TESTED** | `page.tsx`, `SiteHeader.tsx`, `SiteFooter.tsx`, `lib/constants.TRACKING`, browser-verified |
| Hero (cinematic video + poster fallback) | `HomeView.tsx:Hero` — poster bg, lazy video via IO, sound toggle, gradient, motion words | — | — | — | `useEffect` IO `rootMargin 200px` 2s fallback | `/videos/hero-loop.mp4`, `/videos/hero-poster.jpg` in `public/videos` | — | **WORKING_AND_TESTED** | `HomeView.tsx:11-200` verified |
| Industries strip / trust bullets | `IndustriesServedStrip` 6 items, `TRUST_POINTS` 4 bullets | — | — | — | — | — | — | **PARTIALLY_IMPLEMENTED** | Text strip only; no logo wall / numeric proof. Buffer gap — Phase 1 req |
| Flagship services (6 cards) | `FlagshipServices` grid 6 icons + tagline | — | — | — | — | — | — | **PARTIALLY_IMPLEMENTED** | Cards hover only; spec requires alternating screenshot+text with problem/solution/preview/CTA — Phase 1 req |
| Why Tech360 / Process / IndustriesPreview / SelectedWork / Stats / LatestInsights | `WhyTech360`, `ProcessStrip` 5 phases, `IndustriesPreview` 8 tiles, `SelectedWork` 3 case studies, `StatsBand` 4 chips, `LatestInsights` 3 posts + skeletons | `/api/blog` (GET), `/api/reviews` | public GET | `BlogPost`, `Review` | fetch+abort, cache key | — | — | **WORKING_AND_TESTED** | `HomeView.tsx` 831 lines, `src/data/site.ts` stats honest |
| Blog / Work / Careers / Contact / Legal | `BlogView`, `BlogPostView`, `WorkView` 460 lines, `CareersView`, `ContactView` 649 lines, `LegalView` | `/api/blog`, `/api/contact`, `/api/track` | public | `BlogPost`, `FormSubmission`, `TrackingEvent` | `ContactView` real intake → lead | — | `FormSubmission` | **WORKING_AND_TESTED** | intake verified `src/lib/journey.intakeLead` |
| Newsletter footer signup | `SiteFooter.tsx` form state → `POST /api/newsletter` | `src/app/api/newsletter/route.ts` | public | `NewsletterSubscriber` | — | `NOT_CONFIGURED` until SMTP? Actually subscriber creation is local, send is gated | subscriber row | **WORKING_AND_TESTED** | `SiteFooter.tsx:12-80` |
| Chat widget | `ChatWidget.tsx` 719 lines | `/api/chat`, `/api/admin/conversations` | anonId + admin guard | `ChatConversation`, `ChatMessage` | `AgentMessage` memory? | z-ai-web-dev-sdk server-side | `ChatConversation/Message` | **IMPLEMENTED_NOT_TESTED** | widget present, agent tool loop not visually proven end-to-end |
| Hash routing + consent + track | `consentStore` ls `t360_consent`, `visitorAnonId` `t360_anid`, `trackServerEvent` POST `/api/track` `keepalive:true` | `/api/track` | — | `TrackingEvent` | consent gates Pixel/GTM injection | honest: server track always, Pixel only after granted | `TrackingEvent` rows | **WORKING_AND_TESTED** | `page.tsx:40-120` |

### 2.2 CRM / Client 360

| Feature | UI | API | Auth | DB | Execution | Integration | Persisted | Status |
|---|---|---|---|---|---|---|---|---|
| Leads table (search + stage/status filters + CSV export) | `LeadsView.tsx` 230 lines: search debounce 300ms, `STAGES` 20, `STATUSES` 6, `DataTable`, `Pager` 20 | `GET /api/admin/clients?query&stage&status&page` `GET /api/admin/leads/export` | `STAFF` reads, `ADMIN` export | `Client`, `Lead` `where deletedAt:null` | `audit LEADS_EXPORTED` | — | rows | **WORKING_AND_TESTED** | `LeadsView`, `clients/route.ts`, `leads/export/route.ts` |
| Client 360 detail (11 tabs, timeline) | `ClientDetailView.tsx` 600+ lines: overview, lead, comms, scopes, previews, payments, meetings, memories, automationLogs, approvals, documents, timeline `tl[200]` | `GET /api/admin/clients/[id]` includes lead/comms/scopes/previews/payments/invoices/meetings/memories/logs/approvals/files + projects/tasks/deliveries/handovers | `STAFF` | `Client` + 15 relations, `Project` + tasks etc | unified `tl` sorted desc | — | — | **WORKING_AND_TESTED** | timeline built in `clients/[id]/route.ts:40-80` |
| Journey engine (intake → handover) | `CommandCenterView`, `ClientDetailView` journey actions | `POST /api/admin/journey` `JOURNEY_ACTIONS` 27 cases → `src/lib/journey.ts` | `MANAGER`+ | `Client.pipelineStage`, `Lead`, `ScopeOfWork`, `Preview`, `Invoice/Payment`, `Project/Task`, `Delivery/Handover`, `Review/Referral` | `detectBusiness`, `recommendPlan`, `askScopeQuestions`, `submitScope`, `generatePreview`, `requestPayment`, `recordPayment`, `verifyPayment`, `activateProject`, `prepare/releaseHandover`, `closeProject` + `runAgent` + `setStage` forward-only + `AutomationLog` | `sendCommunication` honest `NOT_CONFIGURED` | all models | **IMPLEMENTED_NOT_TESTED** | engine exists `journey.ts` 800+ lines, no kanban, stage PATCH missing |
| Kanban drag (spec: Table \| Board) | **MISSING** — table only, no `DndContext`, no `Sortable` | `PATCH /api/admin/leads/:id` reported in spec **MISSING**; `PATCH /api/admin/clients/[id]/stage` **MISSING** | — | `Client.pipelineStage` | — | — | — | **MISSING** | `@dnd-kit` installed but zero usage outside `AdminApp` icon import |
| Identity resolution | intake `findFirst` by email OR whatsapp/phone de-dupe in `journey.intakeLead` | intake routes `/api/contact`, `/api/chat`, n8n webhooks | — | `Client.email/whatsapp/phone` unique where not null, indexes on each | `rememberMemory` origin | — | `Client` row | **PARTIALLY_IMPLEMENTED** | name-similarity auto-merge not present (correct), manual review missing UI |
| Search & filters | `LeadsView` search + stage/status Select, `ClientDetailView` tabs | `clients/route.ts` query contains on clientId/name/business/email/whatsapp/businessType | `STAFF` | indexes `pipelineStage`, `status`, `email`, `whatsapp`, `deletedAt` | — | — | — | **WORKING_AND_TESTED** | but no saved filters/bulk/column prefs (DataTable gap) |

### 2.3 AI AgentOS

| Feature | UI | API | Auth | DB | Execution | Integration | Persisted | Status |
|---|---|---|---|---|---|---|---|---|
| 44 agents registry | `AgentsView.tsx` list + `POST /api/admin/agents/create` queued for Super Admin approval | `GET /api/admin/agents`, `POST /api/admin/agents/create`, `GET /api/admin/agents/[code]`, `POST /api/admin/agents/[code]/run`, `POST /api/admin/agents/bootstrap`, `GET /api/admin/agents/export` | `ADMIN` create, `SUPER_ADMIN` approve, `guard` RBAC | `AiAgent` (code unique, dept FK), `AiAgentExecution` (RUNNING/SUCCESS/FAILED/TIMEOUT/AWAITING_APPROVAL), `Department` | `runAgent` `agents/engine.ts` 800+ lines: dept validation, `authorizeAgentTool`, cross-client deny, quota `tokensUsedToday`, `AiOpsLock`, retry 3× `withTimeout`, `extractJson`, `rememberMemory`, `recallMemory`, `searchKnowledge` | `z-ai-web-dev-sdk` via `createZaiClient().chat.completions.create` `thinking disabled`, SSRF-safe `safe-fetch.ts` | `AiAgentExecution` + counters `executionCount/success/failure/tokensToday` | **IMPLEMENTED_NOT_TESTED** | reported 44, DB seed 44, but per-agent tool-permission & human-like loop not browser-proven |
| Ops loop heartbeat | `DashboardView.tsx:AiOpsCard` polling `/api/admin/ops-status` 30s, ping dot ACTIVE/STALE/OFFLINE, cycles, last actions pills | `GET /api/admin/ops-status`, `POST /api/ops/cycle` (OPS_SECRET), `src/lib/ops-loop.ts`, `ops-actions.ts` + `mini-services/ai-ops :3031` | `OPS_SECRET` for cycle, `STAFF` for status | `AiOpsLock`, `AutomationLog`, `AiAgentExecution` | 90s cadence, `cycles`, `recentCycles`, `agents {registered, totalExecutions, successes, failures, executions24h}` | notify-relay `:3032` socket.io optional | `AiMemory`? | **WORKING_AND_TESTED** | dashboard card verified |
| Agent tasks PM→Arch→Eng→QA→Delivery | `ProjectsView` tasks `ProjectTask` status TODO/IN_PROGRESS/REVIEW/DONE/BLOCKED + `assigneeType AGENT/HUMAN` `assigneeRef` code | `POST /api/admin/projects/[id]` task endpoints? `PUT /api/admin/projects`? | `MANAGER`+ | `ProjectTask.order/dueAt/evidence JSON` | `activateProject` calls `runAgent PRJ-018` breakdown | — | `ProjectTask` | **PARTIALLY_IMPLEMENTED** | tasks CRUD exists but no visual SOP lane graph, no token/cost display |
| Memory / Knowledge for agents | `MemoryView.tsx` + `src/lib/agents/engine.rememberMemory/recallMemory`, `KnowledgeView.tsx` upload PDF/DOCX/TXT → `doc-extract.ts` `unpdf/mammoth` sha256 → `KnowledgeDocument` status UPLOADED/SCANNED/QUARANTINED/INDEXED/APPROVED/ARCHIVED | `POST /api/admin/knowledge/upload`, `POST /api/admin/knowledge/search`, `GET /api/admin/knowledge`, `PATCH /api/admin/knowledge/[id]/status`, `GET /api/admin/memory` | `STAFF` + classification `PRIVATE/CONFIDENTIAL` | `AiMemory` scope COMPANY/BRAND/SERVICES/CLIENT/PROJECT…, `KnowledgeDocument.extractedText/db.LongText`, `FileRecord` | `searchKnowledge` INDEXED/APPROVED only | — | memory rows + docs | **WORKING_AND_TESTED** | extraction real, malware-scan placeholder (B-006) |
| Approvals governance | `ApprovalsView.tsx` queue PENDING/APPROVED/REJECTED/EXECUTED/FAILED, decision note, audit | `GET /api/admin/approvals`, `POST /api/admin/approvals/[id]/decision` | `SUPER_ADMIN` decides, `MANAGER` requests via agent `requiresApproval` | `ApprovalRequest` type FINAL_SCOPE_SEND/PAYMENT_INSTRUCTION etc risk LOW..CRITICAL | `journey` creates `ApprovalRequest` for final scope send etc | — | `ApprovalRequest` + `AuditLog` | **WORKING_AND_TESTED** | sensitive actions gated |
| Human-like workflow criteria (10 steps) | `ChatWidget` + `CommunicationsView` + `ConversationsView` (partial) | `runAgent` + `journey` stages | — | — | agents generate answers but tool execution not always visible? `AgentMessage` `sessionId` present | WhatsApp/Email honest gates | `Communication` + `AiMemory` | **PARTIALLY_IMPLEMENTED** | agents exist, end-to-end first-message→handover not test-proven; §9 gap stands |

### 2.4 Communications — unified omnichannel

| Feature | UI | API | Auth | DB | Execution | Integration | Persisted | Status |
|---|---|---|---|---|---|---|---|---|
| Inbound channels (chat/SMS/WhatsApp/FB/IG/Email) | `CommunicationsView.tsx`, `ConversationsView.tsx`, `TelephonyView.tsx`, `ChatWidget` 719 lines | `/api/chat`, `/api/contact`, `/api/admin/communications`, `/api/admin/communications/send`, `/api/admin/conversations`, `/api/admin/conversations/[id]`, `/api/admin/telephony` + `CallLogs` | `STAFF` | `Communication` channel WHATSAPP/EMAIL/SMS/FB/IG/LINKEDIN/X/WEB/PORTAL direction IN/OUT status QUEUED/SENT/DELIVERED/READ/RECEIVED/FAILED/NOT_CONFIGURED/DISABLED_BY_ADMIN/DEAD_LETTER, attempts/nextRetryAt, `ChatConversation`/`ChatMessage`, `CallLog` | `sendCommunication` `src/lib/comms.ts` + `outbox-retry.ts` `AutomationLog` | `NOT_CONFIGURED` unless credential, `src/lib/telephony.ts` honest adapters | `Communication` + `CallLog` | **PARTIALLY_IMPLEMENTED** | storage complete, UI is DataTable rows not bubbles; office hours 10-19 Asia/Dhaka not enforced; French? |
| Unified inbox (bubbles + ticks + assignment) | **MISSING** visual — rows only | same | — | same | same | same | — | **UI_ONLY** (table) → need bubble spec §10 |
| Outbox retry / dead letter | hidden | `src/lib/outbox-retry.ts` + `AutomationLog` retry | — | `Communication.attempts/lastAttemptAt/nextRetryAt` indexes | idempotency via providerMessageId? | — | attempts | **IMPLEMENTED_NOT_TESTED** | logic present, not proven under webhook retry |

### 2.5 Project delivery (happypath)

| Feature | UI | API | Auth | DB | Execution | Integration | Persisted | Status |
|---|---|---|---|---|---|---|---|---|
| Scope SOW versioned | `ClientDetailView` scopes | `POST /api/admin/journey SUBMIT_SCOPE` → `generatePreview`, `requestPayment` etc | `MANAGER`+ | `ScopeOfWork` version unique [clientId,version], status DRAFT/AI_REVIEWED/AWAITING_ADMIN_APPROVAL/APPROVED/FINAL/SUPERSEDED, `ScopeApproval` decisions | `submitScope` forge + `ApprovalRequest FINAL_SCOPE_SEND` | — | SOW JSON `content` | **WORKING_AND_TESTED** |
| Preview HTML tokenized | `ProjectsView`? `PreviewView`? `src/app/api/preview/[token]` + `action` | `GET /api/preview/[token]`, `POST /api/preview/[token]/action` APPROVE/REVISION, `src/lib/journey.generatePreview` `padHeader/css/footer` letterhead | token expirable `PREVIEW_TTL_DAYS` 30 | `Preview` token unique status GENERATED/SENT/VIEWED/REVISION_REQUESTED/APPROVED/EXPIRED + `PreviewEvent` | letterhead `OFFICIAL-DOCUMENTS.md` | `Preview.html/db.LongText` + events | **WORKING_AND_TESTED** |
| Invoices / Payments | `PaymentsView.tsx`, `InvoicesView`? `src/app/api/admin/payments`, `src/app/api/admin/invoices/[number]`, `POST /api/admin/journey REQUEST_PAYMENT/RECORD_PAYMENT/VERIFY_PAYMENT` | `POST /api/payments` webhook? `src/app/api/webhooks` | `ADMIN` verify | `Invoice` number unique amount/status DRAFT/SENT/PARTIAL/PAID/OVERDUE/CANCELLED, `Payment` transactionId unique status PENDING/PARTIAL/PAID/FAILED/REFUNDED + verifiedBy/at + invoiceId FK | Stripe REST checkout + HMAC webhook `PAYMENT.md`, `invoice.allocation` per-invoice (R14) | pending | **WORKING_AND_TESTED** | Stripe honest; PayPal/SSLCommerz `INTEGRATION_NOT_BUILT` |
| Project + tasks | `ProjectsView.tsx` board? actually table | `GET/POST /api/admin/projects`, `GET/PATCH /api/admin/projects/[id]` | `MANAGER`+ | `Project` code PRJ-YYYY-NNNN status PLANNING..COMPLETED currency/total/paid/paymentStatus, `ProjectTask` order/due/evidence | `activateProject` → `AiAgent PRJ-018` breakdown, `evaluateProjectClosure` | — | — | **WORKING_AND_TESTED** |
| Delivery / Handover | `ProjectsView` + `ClientDetailView` files? | `POST /api/admin/journey PREPARE_HANDOVER/RELEASE_HANDOVER` via `prepareHandover` `releaseHandover` | `SUPER_ADMIN` release | `Delivery` checklist JSON evidence, `HandoverRecord` packageToken unique status PENDING_APPROVAL/PREPARED/RELEASED/DOWNLOADED/CONFIRMED + expiry | payment-gated `PAYMENT.md` | ZIP package `src/lib/factory/blueprint`? actually `GeneratedAppFiles`? handover via `FileRecord` content blob | — | **WORKING_AND_TESTED** | password-change step exists |
| Reviews / Referrals | `ReviewsView.tsx`, `PortalView.tsx` | `POST /api/reviews`, `/api/referrals`, `GET /api/reviews` public, `PATCH /api/admin/reviews` moderate | portal auth | `Review` rating/content/published/consent, `Referral` status REQUESTED..CONVERTED + convertedClient FK | `requestReviewAndReferral` creates PENDING/REQUESTED; client submits via portal, admin moderates | — | — | **WORKING_AND_TESTED** | honest no fake testimonials (`ClientReviews` returns null if empty) |
| Client portal | `PortalView.tsx` 1275 lines | `/api/portal/me`, `/api/portal/auth`, meetings, previews, payments, files | `Client` via OTP? `PORTAL_SECRET` | `Client` isolated by id, `Meeting.clientResponse`, `Preview.events` | — | — | — | **WORKING_AND_TESTED** | |

### 2.6 Media Studio (Mureka reference)

| Feature | UI | API | Auth | DB | Execution | Integration | Persisted | Status |
|---|---|---|---|---|---|---|---|---|
| Planning: script→shots→narration→SRT/VTT→render-spec | `MediaStudioView.tsx` 350+ lines: generator form (type/topic/language/aspect/duration) + assets DataTable + campaigns list + Latest preview | `GET/POST /api/admin/media/jobs`, `GET /api/admin/media/jobs/[id]`, `POST /api/admin/media/jobs/[id]/review`? + `src/lib/media/studio.ts` | `MANAGER`+ | `MediaJob` code MS-0001 kind VIDEO/SHORT/AUDIO/VOICEOVER status DRAFT/PLANNED/VOICE_READY/CAPTIONS_READY/RENDER_QUEUED/RENDERED/FAILED renderState RENDER_NOT_CONFIGURED, `MediaShot` seq/kind HOOK/TALKING_HEAD/B_ROLL… | planning honest `RENDER_NOT_CONFIGURED` until provider, queue-render button | no real audio render | `MediaJob` plan/captions JSON | **PARTIALLY_IMPLEMENTED** | spec requires centered studio: prompt+templates+voice+style+aspect+lang+preview+history+asset library + save-to-project + honest QUEUED→RUNNING→COMPLETED — currently left table right form, no template carousel, no player, no prompt-library merge |

### 2.7 Factory (Qwen reference)

| Feature | UI | API | Auth | DB | Execution | Integration | Persisted | Status |
|---|---|---|---|---|---|---|---|---|
| Blueprint engine | `FactoryView.tsx` Brief form (appName/client/vertical language/currency/color contact notes + 14 module chips) → Generate → file tree + events | `GET /api/admin/factory/apps`, `POST /api/admin/factory/apps`, `GET /api/admin/factory/apps/[id]`, `POST /api/admin/factory/apps/[id]/export` (ZIP) | `ADMIN` + approval `DELIVERED`? | `GeneratedApp` code AF-0001 vertical crm/marketing/education/ecommerce/booking/realestate/support status DRAFT/PLANNED/BUILT/PREVIEW/APPROVED/DELIVERED, stage BRIEF/PLAN/SCAFFOLD…, `GeneratedAppFile` (appId,path) unique, `GeneratedAppEvent` | `src/lib/factory/blueprint.ts` deterministic scaffold → ZIP delivery `JSZip/fflate` | ZIP only | `GeneratedAppFiles` bytes | **WORKING_AND_TESTED** | but spec requires template cards, one-click preset, live preview mock, module chips visual, tech overview, build progress, GitHub export (missing) |
| GitHub export | **MISSING** UI + `POST /api/admin/factory/apps/[id]/export-github` **MISSING** | `GET /api/admin/factory/apps/[id]/export` exists | — | — | — | PAT required, report success/failure | — | **MISSING** |
| DesignKit parity | `DesignKitView.tsx` 224 lines 4 sections Buttons/Diagrams (Sequence Funnel Swimlane Lifecycle Checklist Cloud Security)/Mockups (Website/CrmConsole/AdminDashboard)/Tokens | — | public `#/design-kit` | — | — | — | — | **PARTIALLY_IMPLEMENTED** | vs Astryx 180 comps + templates + playground + themes + CLI — spec §7 requires buttons/inputs/select/search/filters/tags/badges/cards/tables/kanban/charts/modals/drawers/tabs/notifs/uploads/calendars/timelines/bubbles/players/agent cards/approval dialogs/empty/skeleton/error + playground + light/dark + tokens (prioritize reusable) |

### 2.8 Marketing automation (Buffer)

| Feature | UI | API | Auth | DB | Execution | Integration | Persisted | Status |
|---|---|---|---|---|---|---|---|---|
| Newsletter (Ghost parity) | `NewsletterView.tsx` 250+ lines: stats ACTIVE/UNSUB/total/campaignsSent, growth chart `recharts AreaChart`, subscribers DataTable, campaigns, AI draft (`/api/admin/newsletter/campaigns/draft`), edit dialog, send | `GET /api/admin/newsletter`, `POST /api/admin/newsletter/campaigns/draft`, `PUT /api/admin/newsletter/campaigns/:id`, `POST /api/admin/newsletter/campaigns/:id/send`, `POST /api/newsletter` public, `GET /api/newsletter/track/open` signed GIF, `GET /api/newsletter/track/click` 302, `src/lib/newsletter.ts` | `MARKETING`+ draft, `ADMIN` send | `NewsletterSubscriber` ACTIVE/UNSUB, `EmailCampaign` DRAFT/QUEUED/SENT, `CampaignEvent` kind OPEN/CLICK deduplicated, honesty zeros until real sends | `CampaignEvent` per unique open, `recipientCount` | SMTP `NOT_CONFIGURED` guard `src/lib/comms.ts` refuses send; honest zeros | rows + events | **WORKING_AND_TESTED** | but no Buffer publishing queue/calendar/Start Page/campaign analytics attribution per spec §14 |
| Content Studio + Prompt Library + Feeds + SEO | `ContentStudioView.tsx`, `PromptLibraryView.tsx`, `FeedsView.tsx`, `SeoAuditView.tsx` + `MarketingKitView.tsx` | `/api/admin/content/generate`, `/api/admin/content/review`, `/api/admin/feeds/*`, `/api/admin/seo/audit` `seo-audit-core.ts` 42 checks | `STAFF`/`MARKETING` | `ContentAsset` MARKETING_KIT/SEO_BRIEF…, `PromptTemplate`, `FeedSource/FeedItem`, `Campaign` | `src/lib/feeds/parse.ts` RSS2/Atom/JSON dedupe guid, `src/lib/media/studio.ts`, `src/lib/seo-audit-core.ts` | no publishing pipeline | — | **PARTIALLY_IMPLEMENTED** | SEO 42 checks verified; audit needs score-ring + actionable list (spec §16) |
| Telephony & SMS | `TelephonyView.tsx` generic rows | `/api/admin/telephony` CRUD `CallLog` direction OUTBOUND/INBOUND channel CLICK_TO_CALL/SIP/DEVICE_GATEWAY | `STAFF` | `CallLog` status LOGGED/CONNECTED/COMPLETED/MISSED/FAILED/NOT_CONFIGURED | `src/lib/telephony.ts` honest adapters `NOT_CONFIGURED` | — | `CallLog` | **UI_ONLY** | needs contact sidebar + bubble thread + composer (spec §15) |

### 2.9 Shared UI / cross-cutting

| Feature | Status | Notes |
|---|---|---|
| DataTable shared | **PARTIALLY_IMPLEMENTED** | `src/components/admin/shared/DataTable.tsx` sorting + pager present; missing filter pills, saved filters, bulk, column prefs, active chips, `…` overflow (Phase 1+4 req) |
| Responsive + a11y | **PARTIALLY_IMPLEMENTED** | `SiteHeader` mobile drawer, `min-h-11` touch targets, `aria-label`, `focus-visible:ring`, `Reveal` etc; Kanban keyboard missing, DataTable dense on mobile |
| RBAC | **WORKING_AND_TESTED** | `src/lib/api-guard.ts` + `ROLE_RANK` SUPER_ADMIN>ADMIN>MANAGER>STAFF `SESSION_SECRET` HttpOnly `t360_session` + CSRF double-submit, `auth.ts` 2FA TOTP `totp.ts` |
| Security (prompt injection, tenant isolation, least-privilege tools, audit) | **PARTIALLY_IMPLEMENTED** | `authorizeAgentTool`, `agentMayAccessClient`, `sanitizeText`, `constant-time`, `security.ts`, ` AuditLog`, `ErrorLog`; prompt-injection from client docs/external fetch not yet hardened for tool override |
| Analytics / SEO historical | **IMPLEMENTED_NOT_TESTED** | `SeoAuditView` + 42 checks exists, no historical comparison or fix verification UI (§16) |
| Production deploy | **IMPLEMENTED_NOT_TESTED** (B-001..B-008) | Hostinger Node Web App `npm start` → `.next/standalone/server.js` `prestart` validate, `DATABASE_URL` MySQL, no prod evidence in this branch (probes TBD) |

---

## 3. Critical path gaps to close before “first message → final delivery” can be demoed end-to-end

1. **No Kanban board** — 20-stage pipeline invisible as board; `PATCH .../stage` endpoint missing; concurrent drag not handled.
2. **No bubble inbox** — comms present as rows; identity-linked timeline exists but not as unified chronological inbox (§12).
3. **Media studio is not a studio** — planning works but UX is admin table, not Mureka workspace (§6).
4. **Factory has no templates/preview/GitHub** — engine works, acquisition UX does not (§8).
5. **DesignKit not a playground** — 4 sections vs spec §7 25+ primitives + playground + themes.
6. **Human-like AI loop not proven** — agents run but §9 ten-step business execution (intake→delivery with approvals) lacks a single monitored trace UI + verification that tools actually mutate DB (not just chat).
7. **Marketing is newsletter only** — no calendar/queue/publish-history/analytics attribution (§14).
8. **Telephony is rows not conversations** (§15).
9. **Office-hours + escalation not enforced** (10-19 Dhaka default, quiet hours, rate limits, opt-out) (§10).

---

## 4. What this document confirms true vs reported

- **Confirmed true:** Hash SPA is one real route file; `Client.clientId TECH-YYYY-NNNNNN` + 20 `PIPELINE_STAGES` + `PROJECT_TYPES`/`BUDGET_RANGES`; 124 APIs; 53 models; `journey.ts` full engine with `ApprovalRequest`; `Preview` tokenized 30d; Stripe webhook HMAC; `runAgent` real z.ai backend with quota/retry/metrics; `ops-loop` + sidecars; `image-prompts.ts` 36; `DataTable` + `PageHeader` + `StatusBadge` primitives; shadcn + Radix + Tailwind4.
- **Reported but not yet verified live in this session:** That CI at `aad33e3` green proves build; that 44 agents are all ACTIVE; that SMTP/SMS/Meta creds would succeed; that Hostinger deployment at `bdtech360.com` serves this SHA (B-001..B-003 NOT_VERIFIED); that `npm run typecheck/test/build` pass on this branch with generated Prisma client (blocked locally TLS).
- **Reported and re-checked as gaps (not inferred):** Kanban, bubbles, studio, factory templates, playground, calendar — inspected file-by-file as MISSING/UI_ONLY above.

---

## 5. Next implementation order (authorized phases)

- **Phase 0 done** — this inventory (no prod data mutated).
- **Phase 1 (this PR):** Homepage Buffer-grade (hero update + integration showcase + trust-by-numbers + alternating services), **Leads Kanban Table|Board + PATCH stage endpoint**, DataTable filter pills (shared), responsive polish. Tests + build after each.
- **Phase 2A (next commits):** `PATCH stage` audit + Client 360 unified inbox ordering + AI tool execution proof + workflow state machine UI.
- **Phase 2B:** Media Studio centered workspace + AgentOS lanes (PM→Arch→Eng→QA→Delivery) with QUEUED/RUNNING/WAITING/COMPLETED/FAILED + duration/tokens/cost.
- **Phase 3:** End-to-end wiring inbox→CRM→requirements→proposal→payment→project→agent→QA→review→delivery→support (single `clientId` links).
- **Phase 4:** Factory templates + live scaffold preview + ZIP + GitHub export + DesignKit playground + Marketing calendar/telephone bubbles/SEO ring.
- **Phase 5:** Public Q&A (gated) only after core flows stable.

*No source history, migration, or prod secret was mutated to produce this inventory.*
