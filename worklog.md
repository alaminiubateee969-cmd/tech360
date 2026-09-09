# TECH360 Platform — Build Worklog

Project: Tech360 LLC enterprise platform (bdtech360.com)
Stack: Next.js 16 (App Router, single `/` route SPA), TypeScript, Tailwind 4 + shadcn/ui, Prisma + SQLite, z-ai-web-dev-sdk (backend only)

## Constraints & Decisions
- Environment exposes ONLY the `/` route → entire app is a single-route SPA with hash-based navigation (public site views + gated admin console at `#/admin`).
- All backend logic in `/api/*` route handlers (no server actions).
- AI agents run server-side via z-ai-web-dev-sdk.
- External comms (WhatsApp Cloud API, SMTP, SMS, social) use server-side env credentials; when NOT configured, status is honestly `NOT_CONFIGURED` (never fake success).
- Client IDs: `TECH-YYYY-NNNNNN`, collision-safe via unique constraint + retry.
- Tracking: Meta Pixel 957513230517009, GTM GTM-TM87LDXK (consent-aware).

---
Task ID: 1
Agent: main
Task: Foundation — worklog, Prisma schema, lib modules, seed

Work Log:
- (in progress)

Stage Summary:
- (pending)

---
Task ID: 1 (continued)
Agent: main
Task: Foundation progress + shared contracts for subagents

Work Log:
- Prisma schema pushed: 30+ models (users/sessions/clients/leads/projects/tasks/scopes/approvals/previews/invoices/payments/communications/meetings/deliveries/handovers/reviews/referrals/forms/blog/departments/agents/executions/memory/knowledge/templates/campaigns/content/approvals/audit/errors/automation/agent-messages/notifications/tracking/files/n8n/settings).
- Libs: constants (pipeline 20 stages), auth (scrypt+sessions+RBAC+CSRF), security (rate limit, sanitize, audit, error log), ids (TECH-YYYY-NNNNNN collision-safe), agents/registry (110 depts, 44 agents, constitution), agents/engine (real z-ai-web-dev-sdk execution + memory + knowledge search), comms (WhatsApp Cloud API/SMTP/SMS adapters, honest NOT_CONFIGURED), journey (full first-message→delivery engine).
- Seed executed: super admin admin@bdtech360.com (default password Tech360@2026, ADMIN_PASSWORD env override, must-change on first login), 110 departments, 44 agents, 23 templates, 25 n8n registry rows, 6 blog posts, company memory.
- Brand assets extracted from uploaded zip to public/images (logo + platform/dashboard imagery). Brand palette: #009FE3 (primary blue), #18B83A (green), #063B8F (deep blue), #E2E8F0 lines.

## API CONTRACT (v1 — all subagents must follow)

Base: same-origin relative fetch only. JSON in/out. Auth: HttpOnly session cookie `t360_session` (set by login); CSRF: cookie `t360_csrf` must be echoed in `x-csrf-token` header on ALL mutating admin requests. Read `t360_csrf` via document.cookie.

PUBLIC:
- POST /api/contact {name,businessName,businessType,email,whatsapp,country,projectType,budgetRange,details,preferredContact,consent,tracking} → {ok,clientId,message}
- GET /api/blog → {posts:[{slug,title,excerpt,category,publishedAt,coverImage?}]}
- GET /api/blog/[slug] → {post:{slug,title,excerpt,content,category,author,publishedAt,views}}
- POST /api/track {name,path,consent,meta} → {ok} (analytics server-side log)
- POST /api/newsletter {email,consent} → {ok}
- GET /api/health → {status,db,agents,channels:{WHATSAPP,EMAIL,SMS,...}} (each true|false)
- Preview (tokenized public links):
  - GET /api/preview/[token] → HTML page
  - POST /api/preview/[token]/view → {ok}
  - POST /api/preview/[token]/action {decision:APPROVED|REVISION_REQUESTED,notes?} → {ok,message}
  - GET /api/handover/[token]/download → file (gated; 403 if not released)
  - POST /api/handover/[token]/confirm {passwordsChanged,notes?} → {ok}

AUTH:
- POST /api/auth/login {email,password} → {ok,user:{email,name,role,mustChangePassword}} + cookies
- POST /api/auth/change-password {currentPassword,newPassword} → {ok}
- POST /api/auth/logout → {ok}
- GET /api/auth/me → {user} | 401 {error}

ADMIN (require session; mutations require CSRF header):
- GET /api/admin/dashboard → {stats:{totalLeads,newLeads,qualifiedLeads,clients,activeProjects,projectsAwaitingApproval,paymentPending,paidProjects,outstandingReceivables,completedProjects,openTasks,unreadCommunications,failedAutomations,pendingAdminApprovals}, pipeline:[{stage,count}], revenueByMonth:[{month,paid}], recentLeads:[...], recentActivity:[...]}
- GET /api/admin/clients?query=&stage=&status=&page= → {clients:[{id,clientId,name,businessName,businessType,status,pipelineStage,source,createdAt,lastActivity}], total, page}
- GET /api/admin/clients/[id] → {client, lead, communications:[...], scopes:[...], previews:[...], payments:[...], invoices:[...], projects:[...], meetings:[...], memories:[...], automationLogs:[...], timeline:[{at,type,text}]}
- POST /api/admin/journey {clientId, action, payload} → {ok, result, message} — action from JOURNEY_ACTIONS (INTAKE, DETECT_BUSINESS, RECOMMEND_PLAN, ASK_SCOPE_QUESTIONS, SUBMIT_SCOPE, AI_SCOPE_REVIEW, GENERATE_PREVIEW, REQUEST_PAYMENT, RECORD_PAYMENT, VERIFY_PAYMENT, START_PROJECT, PREPARE_HANDOVER, CLOSE_PROJECT, ...)
- GET /api/admin/approvals?status=PENDING → {approvals:[{id,type,title,description,client,agentCode,risk,createdAt,payload}]}
- POST /api/admin/approvals/[id]/decision {decision:APPROVED|REJECTED,note} → {ok, result}
- GET /api/admin/communications?channel=&status=&clientId=&page= → {comms:[...], total, channelsStatus:{WHATSAPP:'CONFIGURED'|'NOT_CONFIGURED',...}}
- POST /api/admin/communications/send {clientId,channel,to?,subject?,body} → {ok,status}
- GET /api/admin/payments?status=&clientId= → {payments:[...]}
- POST /api/admin/payments {clientId,amount,currency,method,transactionId,milestone,notes} → {ok,payment}
- POST /api/admin/payments/verify {paymentId} → {ok} (activates project on first payment)
- GET /api/admin/projects?status= ; GET /api/admin/projects/[id] → {project,tasks,scopes,payments,previews,delivery,handovers}
- POST /api/admin/projects/[id]/close → {ok}
- GET /api/admin/agents?dept=&status=&query= → {agents:[{code,name,title,dept,status,executions,successRate,requiresApproval,level}], departments:[{code,name,category}]}
- GET /api/admin/agents/[code] → {agent, executions:[...]}
- POST /api/admin/agents/[code]/run {input,expectJson?} → {ok,output,json?,executionId,status}
- POST /api/admin/agents/create {purpose,description} → {ok} (governed: approval queue)
- GET /api/admin/memory?scope=&clientId=&query= → {memories:[...]}
- POST /api/admin/memory {scope,key,content,clientId?,importance?} → {ok}
- GET /api/admin/knowledge?status=&q= → {docs:[...]}
- POST /api/admin/knowledge/upload (multipart: file, title, classification) → {ok,doc}
- POST /api/admin/knowledge/search {query} → {results:[...]}
- GET /api/admin/logs/audit?page= → {logs:[...]}
- GET /api/admin/logs/errors?resolved= → {logs:[...]}
- GET /api/admin/logs/automation?status=&workflow= → {logs:[...]}
- POST /api/admin/command {sessionId,message} → {reply, action, data} — NL command center (Oracle agent + real actions)
- GET /api/admin/analytics → {leadsTrend:[{date,count}], pipeline:[...], channelMix:[...], agentActivity:[...]}
- GET /api/admin/content?campaignId= → {assets,campaigns}
- POST /api/admin/content/generate {type,topic,params} → {ok,asset}
- GET /api/admin/n8n → {workflows:[...]}
- GET /api/admin/n8n/[code]/download → JSON file
- GET /api/admin/reports/ceo → {report} (AI-generated from live data)

FRONTEND STRUCTURE (single route /):
- page.tsx (owned by main agent): hash router. Public hashes: #/ #/about #/services #/services/:slug #/industries #/industries/:slug #/work #/technologies #/process #/blog #/blog/:slug #/careers #/contact #/legal/:slug #/faq. Admin hash: #/admin (gated by /api/auth/me).
- Subagent A (Task 2-a) creates: src/data/site.ts + src/components/site/*.tsx ONLY.
- Subagent B (Task 2-b) creates: src/components/admin/AdminApp.tsx (default export) ONLY.

Stage Summary:
- Foundation complete. Contracts frozen. Proceeding with API routes + delegation of UI.

---
Task ID: 2-b
Agent: admin console
Task: Build Super Admin AI Command Center UI
Work Log:
- Read worklog + Prisma schema + lib/constants (20 pipeline stages, journey actions) to mirror the frozen API contract exactly.
- Built src/lib/admin-client.ts: getCsrf() (t360_csrf cookie), fetchJson() auto-attaching x-csrf-token on POST/PUT/PATCH/DELETE + JSON error extraction, useApi<T>() hook (AbortController, abort-safe, refresh), ~40 typed interfaces, typed api.* endpoint helpers, honest formatting helpers.
- Built 29 files under src/components/admin/ ONLY (no routes, no page.tsx/layout.tsx/API/site changes): AdminApp (default export; auth gate via /api/auth/me, mustChangePassword flow, sidebar + Sheet on mobile, topbar with search/bell/user menu, 17 views + detail overlays, framer-motion transitions, forced dark palette), LoginScreen, ChangePasswordScreen, DashboardView (14 KPI cards + pipeline BarChart + revenue AreaChart + recent leads + activity feed), LeadsView (leads/clients mode, debounced search, stage/status filters, pagination), ClientDetailView (20-stage stepper, journey action bar with 7 actions + payload dialogs, 8 tabs incl. payments record/verify, honest message/preview link), ApprovalsView (PENDING/ALL, risk badges, payload viewer, approve/reject + note, execution result), CommunicationsView (channelsStatus chips CONFIGURED/NOT_CONFIGURED/FAILED, filters, manual send with honest status), PaymentsView (summary + verify + optional invoices), ProjectsView + ProjectDetailView (status stepper, read-only tasks, delivery checklist, handover states, close), AgentsView (workforce tree by category→dept Accordion, agent dialog with tools/permissions/system prompt/executions, RUN AGENT panel, governed Create Agent), CommandCenterView (sessionId, seeded live context, quick chips, markdown-ish + data tables, typing indicator), MemoryView, KnowledgeView (XHR multipart upload w/ progress, semantic search), ContentStudioView (generate form, honest asset output), AnalyticsView (4 recharts, defensive normalization), LogsView (audit paginated/errors read-only/automation steps expandable), N8nView (download anchors), ReportsView (CEO report on demand), SettingsView (health, channel chips, env NAMES ONLY, deploy package link, legal links), shared/ (StatusBadge tone map, DataTable w/ skeletons + sticky headers, EmptyState, KpiCard, SectionCard, PageHeader, JsonView, Markdownish, Pager + ClientPicker, styles constants).
- Honest-UI guarantees: NO fake data; every value from the APIs; skeletons per fetch; honest empty states; statuses shown verbatim (NOT_CONFIGURED → "Not Configured" amber, FAILED → red); journey/approval/send results displayed exactly as returned; buttons disabled while in flight; toasts via sonner.
- Verification: eslint on admin files → 0 problems; tsc --noEmit → 0 errors in my files (remaining project errors belong to src/lib/auth.ts, journey.ts, site/*, examples/, skills/); bun runtime smoke-imported all 29 modules OK; dev.log compiles clean.
- Journey payload shapes the API must accept: SUBMIT_SCOPE {text, scopeText}; RECORD_PAYMENT {amount, method, transactionId?, milestone?, notes?}; PREPARE_HANDOVER/CLOSE_PROJECT {projectId?}; others {}.
Stage Summary:
- Files: src/lib/admin-client.ts + src/components/admin/{AdminApp,LoginScreen,ChangePasswordScreen,DashboardView,LeadsView,ClientDetailView,ApprovalsView,CommunicationsView,PaymentsView,ProjectsView,AgentsView,CommandCenterView,MemoryView,KnowledgeView,ContentStudioView,AnalyticsView,LogsView,N8nView,ReportsView,SettingsView}.tsx + shared/{styles,StatusBadge,DataTable,cards,JsonView,Markdownish,Pager}.tsx/ts (29 files, ~5,900 lines).
- Integration: render <AdminApp onExit={...}/> at #/admin; mount sonner <Toaster/> in the app shell (I only call toast).
- API gaps found (documented in agent-ctx/2-b-admin-console.md): /api/admin/deploy-package not in contract; client-detail response lacks approvals (UI falls back to /api/admin/approvals + client-side filter — recommend clientId param or inclusion); approvals no-status assumed = ALL; no error-resolve endpoint (read-only errors tab); no task-update endpoint (read-only tasks); comm send response assumed {ok,status,error?,message?}; GENERATE_PREVIEW result assumed to include link (matches lib/journey.ts); agent.dept matched vs dept code OR name; health db handled as bool-or-string; analytics item key names normalized defensively; legal slugs (#/legal/privacy|terms|refund) must exist in Task 2-a router.
Return: 29 files created, lint/tsc clean for my files, 12 API gaps/assumptions documented above.

---
Task ID: 2-a
Agent: frontend public site
Task: Build premium public corporate website UI
Work Log:
- Read worklog (API contract) + audited existing partial 2-a output: src/data/site.ts, src/data/images.ts and 26 files under src/components/site/ were already scaffolded by an earlier unlogged run; completed, corrected and verified them this session (no page.tsx / layout.tsx / API / admin files touched; no new routes; no new packages).
- src/data/site.ts (2,000+ lines): verified counts — 20 services (slug/icon/tagline/problem/solution/features[6]/tech/workflow[5]/example), 20 industries (problems[3-4]/solution/exampleSystem/recommended), 8 anonymised case studies, 6 technology groups, 7 process phases (Discover→Scope→Preview→Payment→Build→Deliver→Handover & Support with approval/verification/payment gates), 12 FAQs, 5 career roles, 7 full legal docs (terms/privacy/refund/delivery/payment/client-approval/source-code-handover, numbered sections, identity block everywhere: TECH360 LLC · Missouri LC014737249 · EIN 98-1940053 · 117 S Lexington St Ste 100, Harrisonville MO · info@bdtech360.com · signed-agreement-prevails clause), honest qualitative STATS (100+ internal departments, 20-stage pipeline aligned to PIPELINE_STAGES, US LLC/EIN, 50s→60min video pipeline), TRUST_POINTS.
- Fixed data to match frozen spec exactly: BUSINESS_TYPES (21 spec options), COUNTRIES (12 spec options incl. USA/UK/UAE), PROJECT_TYPES (16 spec options), BUDGET_RANGES (8 spec options Under $500 → $50,000+ / To be discussed); added aggregate `export const SITE` (company/navLinks/services/industries/caseStudies/technologies/process/faqs/roles/legal/stats/trustPoints) for the main router; extended Payment Policy with section 6 (late/partial/failed payments) so every doc clears the 400-word floor (now 383→~470).
- Components verified/finished in src/components/site/ (all 'use client', brand palette #009FE3/#063B8F/#18B83A/#0B1F33/#526173/#E2E8F0, arbitrary Tailwind values, 44px touch targets, focus-visible rings, mobile-first grids, framer-motion whileInView reveals, card hover lift):
  - SiteHeader (fixed, transparent-over-hero → solid on scroll via useSyncExternalStore, active-link state, mobile Sheet menu, logo /images/tech360-logo-web.png with @2x srcSet).
  - SiteFooter (identity, 4 link columns, mailto/WhatsApp/address, © 2026 TECH360 LLC · Missouri LC014737249, no social icons).
  - HomeView (cinematic hero: /videos/hero-loop.mp4 mounted only after IntersectionObserver/2s fallback so it never blocks paint, poster CSS background + onError fallback, readability gradient, eyebrow, staggered H1, 3 CTAs, trust strip, honest Sound:Off pill toggling video.muted; industries strip; 6 flagship services; 4 differentiators; 8 photo industry tiles; 5-step process strip; 3 case cards; honest stats band; latest insights via GET /api/blog; dark CTA band).
  - About / Services / ServiceDetail (404 state, rotating related services) / Industries / IndustryDetail (photo hero, problems, solution, example system, recommended) / Work (NDA note, no fabricated metrics) / Technologies (tech-stack.png + cloud/security/automation diagrams) / Process (7-phase timeline + dev-lifecycle.png + quality-checklist.png + gates summary) / Blog + BlogPost (GET /api/blog[/slug], skeletons, error/empty/404 states, hand-written markdown renderer ##/###/bold/lists, reading time, WhatsApp share) / Careers (5 roles, mailto apply with preset subject) / Contact (react-hook-form + zod, all spec fields incl. Selects, consent checkbox, POST /api/contact with tracking{ref,path}, Client-ID success panel + WhatsApp link, honest API-error/loading states) / Legal (sidebar of 7 docs + clean not-found state) / FAQ (12-item Accordion).
  - Shared: SectionHeading (now accepts id for aria-labelledby), CtaBand, PageHero (breadcrumb), ImageView + LazyImage alias (skeleton + honest "Image unavailable" fallback), Reveal/RevealList/RevealItem, StatChip, buttons (Primary/Outline/WhatsApp/LinkArrow), icons map (+Layers), nav helpers.
- Quality/a11y fixes this session: every aria-labelledby now resolves to a real id (added SectionHeading id prop + wired 15 headings, sr-only headings for stats band & example system); removed dead code in ProcessView, hidden icon in IndustriesView, unused imports; fixed 3 react-hooks/set-state-in-effect lint errors by refactoring BlogView/HomeView/BlogPostView fetch state to a derived-freshness cache pattern (no setState in effect bodies); LegalView unknown slug now renders a clean 404 with real links instead of silently showing doc #1.
- Verification: `bunx eslint src/components/site src/data/site.ts src/data/images.ts` → 0 problems; `bun run lint` (project) → 0 errors, 1 pre-existing warning (prisma/seed.ts, not mine); `bunx tsc --noEmit` → 0 errors in my files (9 pre-existing errors remain in examples/, skills/, src/lib/auth.ts, src/lib/journey.ts — outside my scope); runtime smoke-import of all 27 modules + data-count assertions via bun → all OK; images.json has all 21 required keys (41 URLs).
- Integration notes for main agent (page.tsx): default exports — HomeView({onNavigate}), AboutView, ServicesView, ServiceDetailView({slug}), IndustriesView, IndustryDetailView({slug}), WorkView, TechnologiesView, ProcessView, BlogView, BlogPostView({slug}), CareersView, ContactView, LegalView({slug}), FaqView; SiteHeader({currentHash?}) and SiteFooter default exports; data via named exports from '@/data/site' (or SITE aggregate) and IMAGES/imageFor from '@/data/images'; public hashes #/, #/about, #/services, #/services/:slug, #/industries, #/industries/:slug, #/work, #/technologies, #/process, #/blog, #/blog/:slug, #/careers, #/contact, #/legal/:slug (terms|privacy|refund|delivery|payment|client-approval|source-code-handover), #/faq — matching the router list in this worklog; views render their own <main id="main-content"> so the shell only needs header/footer + view.
Stage Summary:
- Files: src/data/site.ts (complete content model + SITE aggregate), src/data/images.ts (IMAGES + imageFor over images.json), 26 components in src/components/site/ (SiteHeader, SiteFooter, HomeView, AboutView, ServicesView, ServiceDetailView, IndustriesView, IndustryDetailView, WorkView, TechnologiesView, ProcessView, BlogView, BlogPostView, CareersView, ContactView, LegalView, FaqView, PageHero, SectionHeading, CtaBand, ImageView/LazyImage, Reveal, StatChip, buttons, icons, nav).
- Verification: eslint clean on all owned files; tsc clean for owned files; bun runtime import of all 27 modules OK; data counts match spec (20/20/8/7/12/5/7 + 21 countries… options); aria-labelledby audit clean.
- Deviations: LazyImage shipped as an alias of ImageView (same contract); SITE aggregate added alongside named exports; header is `fixed` (sticky behaviour) — all within spec intent. Nothing internal (admin/CRM/agents) is exposed on public pages.
