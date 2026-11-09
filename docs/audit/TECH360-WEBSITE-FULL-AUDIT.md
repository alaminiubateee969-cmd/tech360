# TECH360 Website Full Audit, 20-Site Global UX Benchmark & Reconstruction Plan

- **Repository:** `alaminiubateee969-cmd/tech360`
- **Active Branch:** `arena/5f2a22c2-tech360` (branched from `main` @ `fc66262e4bb169f065f780e313e5cf7308a713aa`)
- **Primary Domain:** `https://bdtech360.com`
- **Audit Date:** 2026-11-09 (UTC)
- **Audit Mode:** `READ-ONLY AUDIT -> REPORT -> IMPLEMENT -> TEST -> PR`

---

## 1. Executive Summary & Audit Methodology

### 1.1 Methodology
1. **Static Source & Security Inspection:** Audited routing (`src/app/page.tsx`, `src/app/[...path]/page.tsx`, `src/lib/public-route-catalog.ts`, `src/app/sitemap.ts`, `src/proxy.ts`, `next.config.ts`), all public views (`src/components/site/**`), data registries (`src/data/**`), public/private APIs (`src/app/api/**`), admin/AI workforce modules (`src/components/admin/**`, `src/lib/ai-workforce-policy.ts`, `src/lib/pipeline/**`, `src/lib/admin-view-policy.ts`), and policy docs (`docs/AI_VISIBILITY_POLICY.md`, `docs/INDUSTRY_SOLUTIONS_AUDIT.md`).
2. **Baseline Test & Static Analysis Verification:** Ran `npm run lint` (PASS), `npm run typecheck` (PASS), `node scripts/verify-industry-assets.mjs` (PASS), and `npm test` (1,258 tests across 275 suites PASS on offline SQLite adapter).
3. **Live Headless Browser Audit (Playwright + Chromium):** Executed automated DOM, HTTP status, metadata, heading, landmark, broken-image, console-error, SPA history, and horizontal-overflow checks against the running Next.js server (`0.0.0.0:3000`) across 74 routes and all 5 required viewports (`1440×900`, `1280×800`, `768×1024`, `390×844`, `320×700`).
4. **20-Site Global UX Benchmark:** Fetched chunk-0 primary marketing homepages of all 20 benchmark companies (`Stripe`, `HubSpot`, `Salesforce`, `Shopify`, `Webflow`, `Vercel`, `Notion`, `Intercom`, `Atlassian`, `Slack`, `Asana`, `monday.com`, `Canva`, `Figma`, `GitHub`, `Cloudflare`, `AWS`, `Microsoft`, `Apple Business`, `Adobe`) via live HTTP markdown extraction (`fetch_page`). Note: direct Chromium outbound navigation from the container is sandbox-restricted to GitHub/npm/PyPI, so external sites were inspected via `fetch_page` content extraction rather than multi-page visual browser crawls.

### 1.2 Top-Line Findings Summary
| Category | Critical | High | Medium | Low | Total |
|---|---:|---:|---:|---:|---:|
| Internal System / AI Workforce Public Exposure | 4 | 3 | 1 | 0 | **8** |
| Public Navigation, IA & Broken Links/Anchors | 2 | 4 | 2 | 0 | **8** |
| Visual Assets & Localization Defects (Chinese/Garbled PNGs, Duplicate Heroes) | 2 | 2 | 1 | 0 | **5** |
| Routing, SEO Metadata, Semantic HTML & Accessibility (WCAG 2.2 AA) | 1 | 4 | 3 | 1 | **9** |
| Content Depth (20 Industries Registry Unwired, Homepage Hierarchy, Service Pages) | 0 | 3 | 2 | 0 | **5** |
| Private AI Agent Workspace, Design Kit Governance & Rule Engine | 0 | 2 | 1 | 0 | **3** |
| **Total Verified Issues** | **9** | **18** | **10** | **1** | **38** |

---

## 2. Complete Route & Endpoint Inventory

### 2.1 Public, Customer, and Workspace Web Routes
| Route (Clean URL / Hash Equivalent) | Classification | HTTP Status (Baseline) | Indexability | H1 Count (Baseline) | `#main-content` Count | Baseline Status & Notes |
|---|---|---:|---|---:|---:|---|
| `/` (`#/`) | Public indexable | 200 | `index, follow` | 1 | 1 | Exposes 11-stage internal pipeline, Chinese-text `/images/crm-dashboard.png`, internal AI assistant copy, Design Kit links |
| `/about` (`#/about`) | Public indexable | 200 | `index, follow` | 1 | 2 | Nested `<main id="main-content">` |
| `/services` (`#/services`) | Public indexable | 200 | `index, follow` | 1 | 2 | Nested `<main id="main-content">` |
| `/services/premium-business-websites` | Public indexable | 200 | `index, follow` | 1 | 2 | CtaBand claims "WhatsApp reaches a real engineer" (contradicts no-public-WhatsApp policy) |
| `/services/enterprise-websites` | Public indexable | 200 | `index, follow` | 1 | 2 | Same CtaBand copy + nested `<main>` |
| `/services/ecommerce-platforms` | Public indexable | 200 | `index, follow` | 1 | 2 | Same CtaBand copy + nested `<main>` |
| `/services/custom-crm-development` | Public indexable | 200 | `index, follow` | 1 | 2 | Includes `ServiceJourney`; nested `<main>` |
| `/services/whatsapp-ai-sales-crm` | Public indexable | 200 | `index, follow` | 1 | 2 | DeskcommCRM product page (customer-facing AI product — allowed); nested `<main>` |
| `/services/client-portals` | Public indexable | 200 | `index, follow` | 1 | 2 | Nested `<main>` |
| `/services/business-dashboards` | Public indexable | 200 | `index, follow` | 1 | 2 | Nested `<main>` |
| `/services/whatsapp-automation` | Public indexable | 200 | `index, follow` | 1 | 2 | Nested `<main>` |
| `/services/whatsapp-cloud-api-integration` | Public indexable | 200 | `index, follow` | 1 | 2 | Nested `<main>` |
| `/services/email-automation` | Public indexable | 200 | `index, follow` | 1 | 2 | Nested `<main>` |
| `/services/sms-automation` | Public indexable | 200 | `index, follow` | 1 | 2 | Nested `<main>` |
| `/services/n8n-workflow-automation` | Public indexable | 200 | `index, follow` | 1 | 2 | Includes `ServiceJourney`; nested `<main>` |
| `/services/ai-agent-systems` | Public indexable | 200 | `index, follow` | 1 | 2 | Customer-facing AI product; nested `<main>` |
| `/services/ai-business-automation` | Public indexable | 200 | `index, follow` | 1 | 2 | Includes `ServiceJourney`; nested `<main>` |
| `/services/api-integrations` | Public indexable | 200 | `index, follow` | 1 | 2 | Nested `<main>` |
| `/services/database-systems` | Public indexable | 200 | `index, follow` | 1 | 2 | Nested `<main>` |
| `/services/cloud-deployment-google-cloud` | Public indexable | 200 | `index, follow` | 1 | 2 | Nested `<main>` |
| `/services/cpanel-stackcp-deployment` | Public indexable | 200 | `index, follow` | 1 | 2 | Nested `<main>` |
| `/services/custom-software-development` | Public indexable | 200 | `index, follow` | 1 | 2 | Nested `<main>` |
| `/services/maintenance-support` | Public indexable | 200 | `index, follow` | 1 | 2 | Nested `<main>` |
| `/services/digital-transformation-consulting` | Public indexable | 200 | `index, follow` | 1 | 2 | Nested `<main>` |
| `/industries` (`#/industries`) | Public indexable | 200 | `index, follow` | 1 | 2 | Lacks category filter/search; duplicate hero photos across 9 slugs; `INDUSTRY_REGISTRY` unwired |
| `/industries/ecommerce` | Public indexable | 200 | `index, follow` | 1 | 2 | Uses shallow `INDUSTRIES` stub instead of rich `INDUSTRY_REGISTRY`; shares hero image |
| `/industries/education` | Public indexable | 200 | `index, follow` | 1 | 2 | `EducationSolutions` uses `alt=""` on content cards; `INDUSTRY_REGISTRY` unwired |
| `/industries/schools-training` | Public indexable | 200 | `index, follow` | 1 | 2 | Includes `IndustryExperience`; `INDUSTRY_REGISTRY` unwired |
| `/industries/healthcare` | Public indexable | 200 | `index, follow` | 1 | 2 | Shares `/images/industry-healthcare.jpg` with `hospitals-clinics` |
| `/industries/hospitals-clinics` | Public indexable | 200 | `index, follow` | 1 | 2 | Shares `/images/industry-healthcare.jpg` |
| `/industries/real-estate` | Public indexable | 200 | `index, follow` | 1 | 2 | Shares `/images/industry-built.jpg` with `construction` |
| `/industries/restaurants-food` | Public indexable | 200 | `index, follow` | 1 | 2 | `INDUSTRY_REGISTRY` unwired |
| `/industries/agencies` | Public indexable | 200 | `index, follow` | 1 | 2 | Shares `/images/industry-business.jpg` across 5 slugs |
| `/industries/professional-services` | Public indexable | 200 | `index, follow` | 1 | 2 | Shares `/images/industry-business.jpg` |
| `/industries/marketing-agencies` | Public indexable | 200 | `index, follow` | 1 | 2 | Shares `/images/industry-business.jpg` |
| `/industries/local-businesses` | Public indexable | 200 | `index, follow` | 1 | 2 | Shares `/images/industry-commerce.jpg` |
| `/industries/international-smes` | Public indexable | 200 | `index, follow` | 1 | 2 | Shares `/images/industry-business.jpg` |
| `/industries/finance` | Public indexable | 200 | `index, follow` | 1 | 2 | `INDUSTRY_REGISTRY` unwired |
| `/industries/retail` | Public indexable | 200 | `index, follow` | 1 | 2 | Shares `/images/industry-commerce.jpg` |
| `/industries/logistics` | Public indexable | 200 | `index, follow` | 1 | 2 | `INDUSTRY_REGISTRY` unwired |
| `/industries/travel-hospitality` | Public indexable | 200 | `index, follow` | 1 | 2 | Includes `IndustryExperience`; `INDUSTRY_REGISTRY` unwired |
| `/industries/construction` | Public indexable | 200 | `index, follow` | 1 | 2 | Shares `/images/industry-built.jpg` |
| `/industries/manufacturing` | Public indexable | 200 | `index, follow` | 1 | 2 | 26-workflow, 52-module flagship in `INDUSTRY_REGISTRY` currently unwired on page |
| `/industries/legal-services` | Public indexable | 200 | `index, follow` | 1 | 2 | Shares `/images/industry-business.jpg` |
| `/industries/technology-companies` | Public indexable | 200 | `index, follow` | 1 | 2 | `INDUSTRY_REGISTRY` unwired |
| `/work` (`#/work`) | Public indexable | 200 | `index, follow` | 1 | 2 | Clearly marks illustrative scenarios; needs Portfolio / Projects / Case Studies sub-navigation |
| `/technologies` (`#/technologies`) | Public indexable | 200 | `index, follow` | 1 | 2 | Nested `<main>` |
| `/process` (`#/process`) | Public indexable | 200 | `index, follow` | 1 | 2 | Links to `#/pipeline`; should present clean 7-step public customer delivery journey |
| `/platform` (`#/platform`) | Public indexable | **404** (clean) / 200 (hash) | Missing in catalog | 1 (hash) | 1 | **FAIL:** Missing from `public-route-catalog.ts`; `href="#templates"` & `href="#messenger"` break SPA router; `AI_NATIVE_MESSENGER` leaks internal AI auto-send/admin-gate counts |
| `/blog` (`#/blog`) | Public indexable | 200 | `index, follow` | 1 | 2 | Nested `<main>` |
| `/blog/google-cloud-run-architecture-for-small-teams` | Dynamic content | 200 | `index, follow` | 0 (SSR) / 1 (CSR) | 2 | SSR initial HTML renders skeleton without `<h1>` until client fetch completes |
| `/blog/client-id-discipline-in-crm-design` | Dynamic content | 200 | `index, follow` | 0 (SSR) / 1 (CSR) | 2 | Same SSR skeleton behavior |
| `/blog/n8n-workflow-automation-for-sme-growth` | Dynamic content | 200 | `index, follow` | 0 (SSR) / 1 (CSR) | 2 | Same SSR skeleton behavior |
| `/blog/ai-agents-that-actually-execute` | Dynamic content | 200 | `index, follow` | 0 (SSR) / 1 (CSR) | 2 | Same SSR skeleton behavior |
| `/blog/whatsapp-cloud-api-for-bangladeshi-businesses` | Dynamic content | 200 | `index, follow` | 0 (SSR) / 1 (CSR) | 2 | Same SSR skeleton behavior |
| `/blog/why-html-preview-before-payment-changes-software-outsourcing` | Dynamic content | 200 | `index, follow` | 0 (SSR) / 1 (CSR) | 2 | Same SSR skeleton behavior |
| `/careers` (`#/careers`) | Public indexable | 200 | `index, follow` | 1 | 2 | Nested `<main>` |
| `/contact` (`#/contact`) | Public indexable | 200 | `index, follow` | 1 | 2 | Honest Client ID ownership review handling; nested `<main>` |
| `/faq` (`#/faq`) | Public indexable | 200 | `index, follow` | 1 | 2 | Nested `<main>` |
| `/legal` (`#/legal`) | Public indexable | 200 | `index, follow` | **2** | 2 | **FAIL:** Duplicate `<h1>` (`PageHero` + `<article>`) and nested `<main>` |
| `/legal/terms` | Public indexable | 200 | `index, follow` | **2** | 2 | **FAIL:** Duplicate `<h1>` + nested `<main>` |
| `/legal/privacy` | Public indexable | 200 | `index, follow` | **2** | 2 | **FAIL:** Duplicate `<h1>` + nested `<main>` |
| `/legal/refund` | Public indexable | 200 | `index, follow` | **2** | 2 | **FAIL:** Duplicate `<h1>` + nested `<main>` |
| `/legal/delivery` | Public indexable | 200 | `index, follow` | **2** | 2 | **FAIL:** Duplicate `<h1>` + nested `<main>` |
| `/legal/payment` | Public indexable | 200 | `index, follow` | **2** | 2 | **FAIL:** Duplicate `<h1>` + nested `<main>` |
| `/legal/client-approval` | Public indexable | 200 | `index, follow` | **2** | 2 | **FAIL:** Duplicate `<h1>` + nested `<main>` |
| `/legal/source-code-handover` | Public indexable | 200 | `index, follow` | **2** | 2 | **FAIL:** Duplicate `<h1>` + nested `<main>` |
| `/portal` (`#/portal`) | Authenticated customer (`noindex`) | 200 | `noindex, nofollow` | **0** | 2 | **FAIL:** Missing `<h1>`; `320×700` overflow (`scrollWidth: 400`); `WorkforceCard` & `/api/portal/me` leak internal AI workforce names/runs |
| `/pipeline` (`#/pipeline`) | Internal AI Agent workspace (currently public!) | 200 | Currently `index, follow`! | 1 | 2 | **CRITICAL:** Currently indexed in sitemap, linked in public nav/footer, and renders internal 11-stage templates, CRM fields, and AI actions to unauthenticated visitors |
| `/design-kit` (`#/design-kit`) | Internal AI Agent workspace (currently public!) | 200 | Currently `index, follow`! | 1 | 2 | **CRITICAL:** Currently indexed in sitemap, linked in public nav, dead `e.preventDefault()` on `See our work`, not registered as an Admin module |
| `/admin` & `/super-admin` -> `/#/admin` | Internal/admin (`noindex`) | 200 (redirect) | `Disallow` in `robots.txt` | 1 | 1 | Protected by session + RBAC (`AdminApp.tsx`); publicly linked in `SiteFooter.tsx` (`Super Admin / Admin Login`) |
| `/admin/command-center` | Internal AI Agent workspace | 200 (UI gate) / 401 API | `Disallow: /admin` | 1 | 1 | Server-side `/api/admin/command-center/*` returns 401 unauthenticated |
| `/admin/factory-control` | Internal AI Agent workspace | 200 (UI gate) / 401 API | `Disallow: /admin` | 0 (denied state) | 0 | Server-side `/api/auth/me` + `/api/factory/*` returns 401 unauthenticated |
| `/factory/apps/[slug]` | Authenticated / provisioned app | Dynamic | Non-public | 1 | 1 | Provisioned factory runtime |

### 2.2 API Endpoint Classification Summary
| Endpoint Prefix / Route | Classification | Auth / Security Control | Audit Finding |
|---|---|---|---|
| `GET /api/pipeline/public` | Public API | Unauthenticated (`Cache-Control: public`) | **CRITICAL:** Leaks `crmProfileFields`, `crmSaveFields`, `actionSaveFields`, `autoSendStages`, `adminApprovalStages`, `autoSendMessages`, `adminApprovalMessages`, and all 13 `SPEC_STAGES` (`whatsapp`, `emailBody`, `aiAction`, `crmSave`). Zero frontend runtime `fetch()` callers exist; only `SiteFooter` link and contract test reference it. Must be sanitized to public 7-step journey, moving full spec to authenticated `/api/admin/pipeline/spec`. |
| `GET /api/portal/me` | Authenticated customer API | Signed `t360_portal` cookie (`verifyPortalToken`) | **HIGH:** Queries `db.aiAgentExecution` and returns `workforce: [{ agentName, agentTitle, work, status }]` to clients, directly violating `docs/AI_VISIBILITY_POLICY.md`. |
| `POST /api/contact` | Public API | Consent-evidenced, idempotent `requestId` + SHA-256 hash, rate-limited | **PASS:** Properly withholds `Client ID` (`202 PENDING_REVIEW`) when contact ownership requires manual review. |
| `POST /api/chat/session`, `POST /api/chat/message`, `GET /api/chat/messages` | Public API | Signed `HttpOnly` chat cookie + `anonId` + `requestId` idempotency + rate limit | **MEDIUM:** `message/route.ts` fallback error says `"Our assistant is temporarily unavailable"` and `code: 'AI_UNAVAILABLE'`; update user-facing message to `"Our support team..."` per `AI_VISIBILITY_POLICY.md`. |
| `GET /api/blog`, `GET /api/blog/[slug]`, `POST /api/newsletter`, `GET /api/reviews`, `GET /api/features`, `POST /api/track`, `POST /api/mcp`, `GET /api/health` | Public API | Input sanitization, rate limiting, read-only public records | **PASS** |
| `/api/admin/**`, `/api/agents`, `/api/command`, `/api/audit`, `/api/approvals/**` | Internal/admin & AI Agent API | `guard(req, { minRole })` (`STAFF` / `MANAGER` / `ADMIN` / `SUPER_ADMIN`) + CSRF | **PASS:** Verified by `tests/ai-workforce-rbac.test.ts` and live 401 checks. |
| `/api/factory/**` | Internal AI Agent / Factory API | `requireActor(req)` (`ADMIN` / `SUPER_ADMIN`) | **PASS** |
| `/api/ai-gateway/**`, `/api/model/v1/**`, `/api/ops/**`, `/api/webhooks/**` | Machine-to-machine API | Constant-time HMAC / bearer / `OPS_SECRET` fail-closed verification | **PASS** |

---

## 3. Detailed Defect Ledger (Read-Only Audit Findings)

| ID | Severity | Surface / File | Exact Evidence | Required Fix |
|---|---|---|---|---|
| **AUD-01** | Critical | `src/components/site/SiteHeader.tsx`, `SiteFooter.tsx`, `src/app/sitemap.ts` | `Pipeline` (`#/pipeline`) and `Design Kit` (`#/design-kit`) are exposed in primary nav, footer, and XML sitemap; `Super Admin / Admin Login` (`#/admin`) and `Pipeline API (JSON)` (`/api/pipeline/public`) are linked in `SiteFooter.tsx:66-73`. | Reconstruct public nav to `Solutions \| Industries \| Work \| Resources \| Company` + `Start a Project` + `Client Portal`; remove Pipeline, Design Kit, Super Admin Login, and Pipeline API from public header/footer/sitemap. |
| **AUD-02** | Critical | `src/app/page.tsx`, `AgentPipelineView.tsx`, `DesignKitView.tsx` | Unauthenticated visitors opening `/pipeline` or `/design-kit` see internal 11-stage WhatsApp/email templates, `crmSave` field assignments, `aiAction` arrays, and internal design playground. | Keep `/pipeline` and `/design-kit` routes functional (`noIndex: true`), gate full `AgentPipelineView` and `DesignKitView` behind authenticated operator session (`MANAGER+` / `STAFF+`), and render a sanitized 7-step public delivery overview (on `/pipeline`) or operator sign-in gate (on `/design-kit`) when unauthenticated. |
| **AUD-03** | Critical | `src/app/api/pipeline/public/route.ts` | Public JSON endpoint returns internal `crmProfileFields`, `crmSaveFields`, `actionSaveFields`, `autoSendMessages`, `adminApprovalMessages`, and `SPEC_STAGES`. | Sanitize `/api/pipeline/public` to return only public brand/contact info, qualified core rule, Client ID format example, and the 7-step customer delivery journey; expose full spec at authenticated `GET /api/admin/pipeline/spec`. |
| **AUD-04** | Critical | `ChatWidget.tsx`, `HomeView.tsx`, `PortalView.tsx`, `PlatformView.tsx`, `src/app/api/portal/me/route.ts` | Violates `docs/AI_VISIBILITY_POLICY.md`: `ChatWidget.tsx` says `"AI assistant ready"`, `"webchat agent"`, `"Replies may be assisted by AI"`; `HomeView.tsx` says `"AI assistant · typing…"`, `"26 workflow files in source"`, `"20 Pipeline-stage definitions"`; `PortalView.tsx` & `/api/portal/me` expose `WorkforceCard` (`"Our AI team at work — Your project is delivered by our AI workforce"`); `PlatformView.tsx` exposes `"Nine AI auto-sends... seven admin-gated sends"`; `buttons.tsx` uses `<Bot>` icon on live support button. | Replace all public/portal internal AI workforce disclosures with `"Live Support"`, `"Chat with Tech360 Support"`, `"Talk to our team"`, `<MessageSquare>` icon, and remove `workforce` execution rows from `/api/portal/me` and `PortalView.tsx`. |
| **AUD-05** | Critical | `public/images/crm-dashboard.png`, `hero-platform.png`, `automation-workflow.png`, `dev-lifecycle.png`, `quality-checklist.png` (+ root `public/*.png`) | Visual inspection confirmed Chinese headings & garbled AI text (`客户关系管理表模型`, `SaaS产品模型模式`, `启动/发货通知`, `需求分析/部署上线`, `代码质量/数据库安全`). `crm-dashboard.png` is rendered live on Homepage (`PremiumSections.tsx:210`) and in `shared.ts:44`. | Regenerate/replace all 5 Chinese-text PNGs + misspelled `tech-stack.png` (`Cloudfllare`, `PHP`, `Bootstrap`) + `security-architecture.png` (`Laravel authentication`) in both `public/images/` and `public/` with crisp, 100% English TECH360-branded visuals. |
| **AUD-06** | Critical | `src/data/industry-images.ts` | 9 industry slugs share duplicate hero photos (`/images/industry-business.jpg` reused 5×, `/images/industry-commerce.jpg` 3×, `/images/industry-healthcare.jpg` 2×, `/images/industry-built.jpg` 2×). | Create/assign 20 distinct, self-hosted English-verified hero images under `public/images/` so every one of the 20 industries has a unique visual identity. |
| **AUD-07** | Critical | `src/app/[...path]/page.tsx`, `src/lib/public-route-catalog.ts`, `PlatformView.tsx` | `/platform` returns HTTP 404 on clean URL; `PlatformView.tsx` uses `href="#templates"` and `href="#messenger"` which clobber `window.location.hash` and route to 404 `UnknownPublicRoute`. | Register `/platform` in `public-route-catalog.ts` and `sitemap.ts`; convert in-page jumps to `scrollIntoView` buttons/handlers that never clobber the SPA hash route. |
| **AUD-08** | Critical | `src/components/site/DesignKitView.tsx:154` | `<PrimaryLink href="#/work" onClick={(e) => e.preventDefault()}>See our work</PrimaryLink>` silently blocks navigation in live button strip, leaving only a decorative demo button. | Make playground showcase buttons explicitly labeled demo buttons (`type="button"`) or allow real navigation without broken `preventDefault` traps. |
| **AUD-09** | Critical | `src/app/page.tsx:290-309` | Client-side hash navigation only updates `document.title` and `<meta name="description">` for `legal` and `pipeline`; navigating to `#/services`, `#/industries/*`, `#/work`, `#/contact`, `#/about`, etc. retains homepage `<title>`, description, and `<link rel="canonical" href="https://bdtech360.com">`. | Sync `document.title`, `<meta name="description">`, `<link rel="canonical">`, `og:title`, `og:description`, `og:url`, and `<meta name="robots">` dynamically for every route in `page.tsx` using `resolvePublicRoute`! |
| **AUD-10** | High | `src/app/page.tsx:337` + 17 `*View.tsx` components | `page.tsx` wraps `<PublicView>` in `<main id="main-content">`, and every view (`AboutView`, `ServicesView`, `ServiceDetailView`, `IndustriesView`, `IndustryDetailView`, `WorkView`, `TechnologiesView`, `ProcessView`, `BlogView`, `BlogPostView`, `CareersView`, `ContactView`, `FaqView`, `LegalView`, `PortalView`, `AgentPipelineView`, `DesignKitView`) renders a second nested `<main id="main-content">`, producing invalid HTML and duplicate IDs on 62 routes. | Keep `<main id="main-content" tabIndex={-1}>` solely in `src/app/page.tsx` and change inner view wrappers to `<div>`, ensuring exactly 1 `<main id="main-content">` on every route and moving focus cleanly via skip-to-content. |
| **AUD-11** | High | `src/components/site/LegalView.tsx:76`, `PortalView.tsx`, `BlogPostView.tsx`, `public/llms.txt`, `src/lib/agent-content.tsx` | All 8 `/legal*` routes render 2 `<h1>` tags (`PageHero` + `<article>`); `/portal` renders 0 `<h1>` tags (`<h2>Client portal</h2>`); `/blog/[slug]` renders 0 `<h1>` during initial SSR before client fetch; `/legal/terms-of-service` aliases 404 when agents guess long slugs. | Demote inner `<article>` title in `LegalView` to `<h2>`; promote `PortalView` sign-in heading to `<h1>`; pass server-resolved blog post (or render immediate `<h1>` fallback) on `/blog/[slug]`; support clean alias slugs or canonical legal links consistently. |
| **AUD-12** | High | `src/components/site/PortalView.tsx` (`320×700` viewport) | Playwright audit detected horizontal overflow on `/portal` at `320×700` (`scrollWidth: 400 > innerWidth: 320`). | Fix wide input/card/padding constraints in `PortalView.tsx` so `scrollWidth <= innerWidth` at `320×700` and all 5 viewports. |
| **AUD-13** | High | `src/components/site/IndustriesView.tsx`, `IndustryDetailView.tsx` | All 20 rich enterprise industry specifications in `src/data/industries/index.ts` (`INDUSTRY_REGISTRY`: challenges, business models, departments, roles/RBAC, 6-plane factory architecture, modules, 18-field workflows, integrations, security controls, KPIs, delivery roadmap, FAQs) are completely unwired from the public views! | Connect `IndustriesView.tsx` (with category tabs + search across all 20 slugs) and `IndustryDetailView.tsx` to `INDUSTRY_REGISTRY` (`getIndustryBySlug`), filtering out any internal-sounding jargon while showcasing deep domain-specific modules, workflows, roles, integrations, compliance, deliverables, and FAQs. |
| **AUD-14** | High | `src/components/site/HomeView.tsx` | Current homepage mixes internal 11-stage pipeline mechanics, internal file counts (`26 workflow files in source`, `20 Pipeline-stage definitions`), Chinese-text CRM screenshot, and links to `#/design-kit`. | Reconstruct `HomeView.tsx` around the 13-part enterprise B2B hierarchy: Hero, Trust/Capability Strip, Core Solutions Grid, Featured Software Products, AI & Automation Capabilities, Industry Solutions Showcase, Selected Work/Case Studies, 7-Step Customer Delivery Journey, Technology & Security Capabilities, Why TECH360, Resources/Insights Preview, FAQ Preview, and Final Conversion CTA. |
| **AUD-15** | High | `src/components/site/ServiceDetailView.tsx`, `ServicesView.tsx` | `ServiceDetailView.tsx:221` CtaBand states `"WhatsApp reaches a real engineer"` (retired channel); service detail pages lack structured ideal-customer profile, technology/integration context, FAQ accordion, and industry cross-links. | Fix CtaBand copy across all 21 services and enrich `ServiceDetailView.tsx` + `ServicesView.tsx` with grouped 4-pillar filtering (`AI Solutions`, `Software Products`, `Services`, `CRM & Business Automation`), architecture/integration context, relevant industry cross-links, delivery timeline/SOW model, and service-specific FAQs. |
| **AUD-16** | High | `src/components/site/EducationSolutions.tsx:20,28` | `<ImageView src={item.image} alt="" ... />` passes empty `alt=""` on meaningful solution cards; also verify all `<img>` tags across site have descriptive `alt` text and `width`/`height` or `aspectRatio` to prevent CLS. | Provide descriptive English `alt` attributes for every `EDUCATION_SOLUTIONS` item and verify zero empty/missing content `alt` attributes site-wide. |
| **AUD-17** | High | `src/components/admin/AdminApp.tsx`, `src/lib/admin-view-policy.ts` | `DesignKitView` has no module entry in `AdminApp.tsx` or `VIEW_MIN_ROLE`, and there is no machine-readable Design Kit governance API or unified 10-point AI Agent Rule Engine validator enforcing Pipeline + Design Kit + RBAC rules together. | Add `designKit` (`Design Kit & UI Governance`) to `AdminViewId`, `VIEW_MIN_ROLE` (`STAFF`), `ROLE_VIEWS`, and `AdminApp.tsx` (`Product Factory`); add authenticated `/api/admin/design-kit` & `/api/admin/pipeline/spec`; implement and test `src/lib/ai-agent-rule-engine.ts` enforcing all 10 mandatory AI Agent governance rules. |
| **AUD-18** | Medium | `public/llms.txt`, `src/lib/agent-content.ts`, `public/robots.txt` | `llms.txt` and `agent-content.ts` advertise `/pipeline` (`AI Agent Pipeline — The eleven-stage client journey`) and `design-kit` to external crawlers/LLMs; `robots.txt` does not disallow `/pipeline` or `/design-kit`. | Remove internal `/pipeline` and `/design-kit` disclosures from `llms.txt` and `agent-content.ts`, replace with `/process` and `/platform`, and add `Disallow: /pipeline` and `Disallow: /design-kit` to `public/robots.txt`. |

---

## 4. Global 20-Site UX Benchmark (Live `fetch_page` Inspection)

> **Scope & Truthfulness Disclosure:** All 20 reference websites below were fetched live on 2026-11-09 via `fetch_page` (chunk 0 markdown extraction of each primary marketing landing page; for Microsoft, `/en-us/business` returned 404 so `/en-us/` including its Business tab was inspected). Direct multi-page Chromium browsing of third-party domains is blocked by sandbox network rules, so observations strictly reflect verified homepage structure, navigation links, CTA hierarchy, trust framing, and content patterns extracted from live markup.

| # | Company | Inspected URL | Verified Navigation & CTA Pattern | Verified Homepage, Product & Trust Framing | Concrete Takeaway Applied to TECH360 |
|---:|---|---|---|---|---|
| 1 | **Stripe** | `https://stripe.com/` | Concise top bar with structured mega-menus, secondary sign-in, high-contrast primary CTA (`Get started`). | Crisp value headline + modular bento product cards (`Payments`, `Billing`, `Connect`) + concrete enterprise case-study accordion with products used. | Group TECH360's 21 services into 4 scannable `Solutions` mega-menu columns with 1-line descriptions and featured product callouts. |
| 2 | **HubSpot** | `https://www.hubspot.com/` | Product-pillar mega-menu with icons + dual hero CTA (`Get a demo` primary + secondary action). | Unified platform narrative (`Marketing, sales, and service, finally on the same page`) + controlled AI messaging (`AI you control. Results you can trust.`). | Frame TECH360's CRM, Portals, Websites, and Automation as one connected business platform with human-controlled approvals. |
| 3 | **Salesforce** | `https://www.salesforce.com/` | Solution + Industry + Product taxonomy; dual CTA (`Start for free` / `Watch demo`) + skip-to-content link. | Capability icon strip (`Sales`, `Service`, `Commerce`, `Small Business`) + layered platform architecture card (`trust built-in, not bolted on`). | Add an interactive Solutions & Industry capability switcher and 6-plane architecture overview on `/industries/[slug]` and `/platform`. |
| 4 | **Shopify** | `https://www.shopify.com/` | Clean merchant-outcome top bar + skip link + single unmistakable primary CTA. | Channel/capability pills (`Payments`, `Shipping`, `Customers`, `Retail`, `Inventory`, `Catalog`) + visual storefront examples. | Use interactive domain/capability pills on TECH360's Homepage, Services, and Work showcase so buyers immediately recognize deliverables. |
| 5 | **Webflow** | `https://webflow.com/` | Utility `Log in` + `Contact Sales` + primary CTA separated cleanly on right side of header. | Role/outcome-oriented storytelling (`Design`, `CMS`, `Optimize`, `Collaboration`) with scannable 3-bullet capability summaries per card. | Separate `Client Portal` utility link from primary `Start a Project` button; keep service cards scannable with 3 concrete deliverables each. |
| 6 | **Vercel** | `https://vercel.com/` | Minimalist high-contrast header, skip-nav link, technical precision without clutter. | Architectural proof pillars (`Tenant Isolation`, `Domain Management`, `Custom SSL`, `Preview URLs`, `Web Application Firewall`). | Highlight TECH360's concrete engineering controls (staging HTML preview URLs, tenant isolation, RBAC, TLS, audit logs, source handover) without fake vanity numbers. |
| 7 | **Notion** | `https://www.notion.com/` | Clean 5-group top bar + concrete job-to-be-done use-case cards (`Triage feedback`, `Automate reporting`). | Concrete workflow cards with direct `→` action affordances and whitespace-led typography. | Present AI & Automation capabilities on TECH360's homepage as concrete business workflows rather than internal prompt/agent jargon. |
| 8 | **Intercom** | `https://www.intercom.com/` | Focused product + resources navigation; dual CTA (`Start free trial` / `View demo`). | Side-by-side product clarity (Helpdesk + Customer Service workflows) with crisp UI previews and ticket status cards. | Replace Chinese/garbled screenshots on TECH360 with clean, authentic English UI console previews (`CRM`, `Client Portal`, `Support Inbox`). |
| 9 | **Atlassian** | `https://www.atlassian.com/` | Collections-based mega-menu (`Teamwork`, `Strategy`, `Service`, `Software`, `Product`) + `Contact us`. | Tabbed collection switcher grouping multiple related products into buyer-friendly suites, with explicit methodology disclaimers on metrics. | Organize TECH360's 21 services into 4 buyer-centric suites (`AI Solutions`, `Software Products`, `Services`, `CRM & Business Automation`) and keep explicit honesty notices on illustrative work. |
| 10 | **Slack** | `https://slack.com/` | Short top bar, skip link, reduced-motion pause/play controls on hero animations, action-oriented tabs (`Knowledge`, `People`, `Process`, `Platform`). | Interactive scenario pills (`Close deals`, `Plan launches`, `Chat with clients`, `Automate tasks`) + WCAG motion controls. | Ensure all TECH360 animations respect `prefers-reduced-motion` and use interactive step tabs for the 7-step customer delivery journey. |
| 11 | **Asana** | `https://asana.com/` | Department & workflow-led IA + explicit governance framing (`Enterprise governance: identity, scoped permissions, audit trail`). | Multi-tab solution explorer (`Work Management`, `Service Management`, `Client Management`) + skill/integration breakdowns. | Surface role-based permissions, integrations, and human approval checkpoints clearly on TECH360 industry and service pages. |
| 12 | **monday.com** | `https://monday.com/` | Mega-menu explicitly grouped by `Use Cases / Departments`, `Business Applications` (`CRM`, `Service`, `Dev`), `Company Size` (`Enterprise`, `SMB`), and `Industries`, plus `Contact sales` + `Log in`. | Department filter pills (`Marketing`, `Operations`, `IT`, `Product`, `Sales`, `HR`, `PMO`) above interactive workspace previews. | Categorize TECH360's 20 industries by sector (`Commerce & Hospitality`, `Healthcare & Education`, `Finance, Legal & Professional`, `Industrial, Built & Logistics`, `Technology & Growth`) with instant search. |
| 13 | **Canva** | `https://www.canva.com/` | Skip link, category tabs (`AI`, `Presentations`, `Social`, `Video`), accessible external-link announcements. | Visual card grid with clear hover states, descriptive `alt` text on every card image, and zero clutter. | Fix empty `alt=""` on `EducationSolutions` cards and ensure every visual card across TECH360 has descriptive English `alt` text and clean hover elevation. |
| 14 | **Figma** | `https://www.figma.com/` | Minimalist navigation (`Products`, `Solutions`, `Community`, `Resources`, `Pricing`) + clear `Get started` CTA. | End-to-end design-to-production narrative (`Start with design context. Build with consistency.`) with crisp design-token visuals. | Keep TECH360's Design Kit intact inside the authenticated workspace so internal operators and AI agents share a single governed design-token source of truth. |
| 15 | **GitHub** | `https://github.com/` | Developer-grade navigation (`Platform`, `Solutions`, `Resources`, `Open Source`, `Enterprise`) + skip link + dual CTA. | Capability cards (`Actions — CI/CD and automation`, `Code Quality`, `Code Security`, `Secret Protection`) with concise 1-sentence descriptions. | Mirror GitHub's engineering-discipline clarity in TECH360's `Technology & Security Capabilities` section (CI gates, secret protection, RBAC, verified backups, full source handover). |
| 16 | **Cloudflare** | `https://www.cloudflare.com/` | Architecture-first value proposition + problem-to-solution comparison cards (`Why choose Cloudflare`). | Problem quote -> architectural solution cards with clean diagramming and zero marketing fluff. | Retain problem -> solution -> deliverables clarity across all 21 TECH360 service detail pages. |
| 17 | **AWS** | `https://aws.amazon.com/` | Enterprise mega-menu + industry customer story cards (`Automotive`, `Healthcare & Life Sciences`) + accessible skip link. | Industry-tagged solution cards linking directly to domain architectures and implementation paths. | Cross-link every TECH360 industry detail page to its matching services and illustrative project scenarios. |
| 18 | **Microsoft** | `https://www.microsoft.com/en-us/` | Audience toggle (`Personal` / `Business`), quick-link icon strip, structured footer by category. | Clear separation between consumer/general entry points and enterprise business solutions (`Azure`, `AI solutions`, `Sign in`). | Maintain strict separation between TECH360's public buyer experience, authenticated `Client Portal`, and internal operator workspace. |
| 19 | **Apple Business** | `https://www.apple.com/business/` | Generous typographic hierarchy, high contrast, calm spacing, zero pop-up clutter, footnoted claims. | Benefit-led bento cards (`Performance`, `Private by design`, `IT Management`) with restrained palette and crisp photography. | Apply generous vertical rhythm, calm whitespace, max 65–75ch reading measure, and honest, qualified policy statements across TECH360. |
| 20 | **Adobe** | `https://business.adobe.com/` | Tabbed enterprise product explorer (`AI & agents`, `Content & workflows`, `Data & analytics`, `Documents`) + explicit privacy/terms notice on chat concierge. | Outcome-grouped solution pillars + transparent privacy/consent disclosure on interactive chat tools. | Preserve explicit Privacy Policy consent + honest human-team framing in TECH360's `Live Support` chat widget (`ChatWidget.tsx`). |

---

## 5. Architecture & Implementation Plan

### Commit 1 — Public Navigation, Footer, Route Catalog & SPA Metadata Reconstruction
1. **Header (`src/components/site/SiteHeader.tsx`, `src/components/site/nav.ts`):**
   - Logo links to `/` (`#/` on SPA, clean `/` href compatibility).
   - Exactly **5 primary navigation items**:
     1. **`Solutions`** (accessible mega-menu with 4 columns: `AI Solutions`, `Software Products`, `Services`, `CRM & Business Automation`, covering all 21 service routes + links to `/services` and `/platform`).
     2. **`Industries`** (categorized mega-menu across 5 sector groups covering all 20 industry slugs + quick search link to `/industries`).
     3. **`Work`** (dropdown: `Portfolio Overview`, `System Scenarios`, `Delivery Case Frameworks` -> `/work`, `/work?tab=projects`, `/work?tab=case-studies` / anchored views).
     4. **`Resources`** (dropdown: `Blog & Engineering Notes` -> `/blog`, `FAQ` -> `/faq`, `Technologies & Architecture` -> `/technologies`, `Delivery Process` -> `/process`).
     5. **`Company`** (dropdown: `About TECH360` -> `/about`, `Careers` -> `/careers`, `Contact` -> `/contact`, `Legal & Policies` -> `/legal`).
   - Right-side actions: quiet utility link **`Client Portal`** (`#/portal`) + primary CTA button **`Start a Project`** (`#/contact`).
   - Full WCAG 2.2 AA keyboard support (`Enter`/`Space` toggle, `ArrowDown`/`Escape` close, `aria-expanded`, `aria-controls`, outside-click close, focus return, responsive mobile/tablet drawer with accordion groups across `768px`, `390px`, `320px`).
2. **Footer (`src/components/site/SiteFooter.tsx`):**
   - Remove `AI Agent Pipeline`, `Super Admin / Admin Login`, and `Pipeline API (JSON)`.
   - Organize clean columns (`Solutions`, `Industries`, `Resources`, `Company & Legal`) + newsletter form + `Live Support` chat button + verified company registration (`TECH360 LLC`, Missouri LLC `LC014737249`, `info@bdtech360.com`).
3. **Routing, Sitemap & SPA Metadata (`src/lib/public-route-catalog.ts`, `src/app/sitemap.ts`, `src/app/page.tsx`, `src/app/[...path]/page.tsx`, `public/robots.txt`, `public/llms.txt`, `src/lib/agent-content.ts`):**
   - Add `/platform` to `public-route-catalog.ts` and `sitemap.ts`.
   - Mark `/pipeline` and `/design-kit` as `noIndex: true`, remove from `sitemap.ts`, `llms.txt`, and `agent-content.ts`, and add `Disallow: /pipeline` and `Disallow: /design-kit` to `robots.txt`.
   - Support common legal slug aliases (e.g. `terms-of-service` -> `terms`, `privacy-policy` -> `privacy`, `refund-cancellation-policy` -> `refund`, `project-delivery-policy` -> `delivery`, `payment-policy` -> `payment`) in `LegalView` / catalog fallback so external links never 404.
   - Update `src/app/page.tsx` to dynamically synchronize `document.title`, `<meta name="description">`, `<link rel="canonical">`, OpenGraph tags, and `<meta name="robots">` on every hash/SPA route transition!
   - Remove duplicate nested `<main id="main-content">` across all 17 inner view components so every page has exactly 1 `<main id="main-content">`.

### Commit 2 — AI Visibility Policy Enforcement, Sanitized `/api/pipeline/public` & Private AI Agent Workspace / Rule Engine
1. **Enforce `docs/AI_VISIBILITY_POLICY.md` Across All Public & Customer Surfaces:**
   - `ChatWidget.tsx` & `buttons.tsx` & `/api/chat/message`: Rename `"AI assistant ready"` / `"webchat agent"` / `"Replies may be assisted by AI"` to `"Live Support"`, `"Chat with Tech360 Support"`, `"Talk to our team"`, using `<MessageSquare>` instead of `<Bot>`.
   - `PortalView.tsx` & `src/app/api/portal/me/route.ts`: Remove `WorkforceCard` and remove `workforceExecutions` (`agentName`, `agentTitle`) from `/api/portal/me`; fix missing `<h1>` and `320×700` horizontal overflow on `/portal`.
   - `PlatformView.tsx` & `src/data/site.ts`: Replace internal `AI_NATIVE_MESSENGER` (`"Nine AI auto-sends... seven admin-gated sends"`) with customer-facing `UNIFIED_CLIENT_COMMUNICATIONS` and fix broken `#templates` / `#messenger` hash links.
2. **Sanitize `/api/pipeline/public` & Gate `/pipeline` + `/design-kit`:**
   - Update `GET /api/pipeline/public` to return a clean, public, customer-safe 7-step delivery journey contract (brand, domain, email, Client ID format example, qualified core policy `"HTML Preview Before Payment. Source Code After Full Payment."` subject to approved SOW, and 7 customer milestones) with zero CRM field names, zero WhatsApp/SMS/email template bodies, and zero AI action/gate internals.
   - Create authenticated `GET /api/admin/pipeline/spec` (`guard(req, { minRole: 'MANAGER' })`) returning the full 11-stage `SPEC_STAGES`, `CRM_PROFILE_FIELDS`, and gate metadata for authorized operators and internal relays.
   - Create authenticated `GET /api/admin/design-kit` (`guard(req, { minRole: 'STAFF' })`) exposing machine-readable Design Kit tokens, typography, spacing, colors, component contracts, responsive breakpoints, and human-approval token governance rules.
   - Register `designKit` in `src/lib/admin-view-policy.ts` and `src/components/admin/AdminApp.tsx` (`Product Factory -> Design Kit & UI Governance`), and gate direct `/pipeline` and `/design-kit` routes so unauthenticated visitors see the sanitized 7-step public journey / operator authentication gate while signed-in operators get full access.
   - Implement `src/lib/ai-agent-rule-engine.ts` codifying and validating all **10 AI Agent Rule Engine invariants** (1. Identity/tenant/role check, 2. Active policy version check, 3. Authorized tool check, 4. Pipeline precondition check, 5. Design Kit token compliance check, 6. Human approval gate on sensitive actions, 7. Structured audit record creation, 8. Postcondition/result validation, 9. Safe stop & escalation on uncertainty/denial, 10. Zero self-granted privilege escalation).

### Commit 3 — Visual Asset Remediation (Zero Chinese/Garbled PNGs, 20 Unique Industry Hero Assets, Accessible Alt Text)
1. Regenerate all defective PNG diagrams/mockups (`crm-dashboard.png`, `hero-platform.png`, `automation-workflow.png`, `dev-lifecycle.png`, `quality-checklist.png`, `tech-stack.png`, `security-architecture.png`) in both `public/images/` and `public/` using crisp, high-resolution, 100% English SVG-to-PNG rendering via `sharp` matching TECH360's brand system (`#0B1F33`, `#063B8F`, `#009FE3`, `#18B83A`), and replace the raw `<img>` on `PremiumSections.tsx` with crisp English UI/visuals.
2. Provide 20 distinct, self-hosted industry hero images under `public/images/` and update `src/data/industry-images.ts` so zero industry slugs share duplicate hero imagery while keeping `scripts/verify-industry-assets.mjs` green.
3. Fix empty `alt=""` attributes in `EducationSolutions.tsx` and audit all image dimensions/aspect ratios.

### Commit 4 — Homepage 13-Section Reconstruction, 21 Service Pages, 20 Industry Pages (`INDUSTRY_REGISTRY`), Work & Legal Fixes
1. **Homepage (`HomeView.tsx`):** Reconstruct into the clean 13-part enterprise B2B hierarchy with zero internal AI workforce disclosures, honest capability proof, 4-pillar Solutions grid, Featured Software Products, AI & Automation customer solutions, Industry Showcase, Illustrative Work Scenarios, 7-Step Customer Delivery Journey (`HTML Preview Before Payment. Source Code After Full Payment.` qualified by approved SOW), Technology & Security Architecture, Why TECH360, Engineering Insights preview, FAQ preview, and Conversion CTA.
2. **Services (`ServicesView.tsx`, `ServiceDetailView.tsx`):** Add 4-group solution pillar filter + search on `/services`; fix CtaBand retired WhatsApp claim on `ServiceDetailView.tsx` and add Ideal Customer Profile, Architecture & Integration Fit, Related Industries, SOW Delivery Steps, and Service FAQs across all 21 services.
3. **Industries (`IndustriesView.tsx`, `IndustryDetailView.tsx`):** Wire both views to `INDUSTRY_REGISTRY` (`src/data/industries/index.ts`), adding sector categorization + live search on `/industries` and rich domain challenges, modules, operational workflows, role personas, integrations, security/compliance controls, deliverables, and FAQs on all 20 `/industries/[slug]` pages (with safe in-page scroll buttons instead of hash-clobbering `#anchors`).
4. **Work (`WorkView.tsx`), Process (`ProcessView.tsx`), Blog (`BlogPostView.tsx`), Legal (`LegalView.tsx`):**
   - Add Portfolio / System Scenarios / Delivery Case Frameworks filterable tabs on `WorkView.tsx` (preserving honest illustrative disclaimers).
   - Align `ProcessView.tsx` with the 7-step public customer journey (removing `#/pipeline` links).
   - Fix duplicate `<h1>` in `LegalView.tsx` and pass server-fetched post data to `BlogPostView.tsx` so SSR HTML renders `<h1>` immediately.

### Commit 5 — Automated Regression Tests & Full 5-Viewport Playwright Verification
1. Update `tests/pipeline-public-contract.test.ts` and `tests/public-route-catalog.test.ts` for the sanitized `/api/pipeline/public` contract, authenticated `/api/admin/pipeline/spec`, `/platform` route, and `noIndex` `/pipeline` & `/design-kit` routes.
2. Add comprehensive new unit/integration tests covering:
   - Public navigation structure (`Solutions | Industries | Work | Resources | Company` + `Start a Project` + `Client Portal`, zero Pipeline/Design Kit/Admin Login links in header/footer).
   - `docs/AI_VISIBILITY_POLICY.md` compliance across all public views and `/api/portal/me`.
   - 10-point AI Agent Rule Engine (`tests/ai-agent-rule-engine.test.ts`) + Design Kit admin governance (`tests/admin-view-policy.test.ts`).
   - 20 distinct industry hero images + `INDUSTRY_REGISTRY` integration.
3. Run full CI verification gates (`npm audit --audit-level=low`, `verify-industry-assets.mjs`, `check-conflict-markers.mjs`, `retired-deployment-paths.mjs`, `check-migration-immutability.mjs`, `seed-safety.mjs`, `lint`, `typecheck`, `npm test`, `npm run build`) AND full 5-viewport Playwright browser verification (`1440×900`, `1280×800`, `768×1024`, `390×844`, `320×700`) before opening the PR against `main`.
