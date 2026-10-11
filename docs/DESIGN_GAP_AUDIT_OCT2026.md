# Tech360 vs Reference Ecosystem — Design & Build Gap Audit

**Date:** 2026-10-11  
**Auditor:** Arena Agent (against live reference probes + local repo `aad33e3` / branch `arena/98c3bc30-tech360`)  
**Scope:** Every URL the owner shared — product websites (Buffer, Qwen Coder, Stack Overflow, Mureka, Astryx) + 60+ GitHub repos grouped by family — compared to the current Tech360 system at `/home/user/tech360`.

> **One-sentence answer to “why not our system like this?”:**  
> Tech360 already **covers the capabilities** of almost every reference (155 links audited in `COVERAGE-AUDIT.md` → 146 EXISTS live), but it **does not look or feel like them**. The references are *polished single-purpose products with a single killer view* (Buffer’s queue, Mureka’s studio, Astryx’s theme gallery); Tech360 is a *correct multi-module platform whose every view looks like the same DataTable + form*. The gap is **product design density, not feature count**.

---

## 1. How this audit was done

1. **Live fetch** of the five product websites through the platform browser (`fetch_page`) — Buffer, Mureka, Astryx, Stack Overflow, Qwen Coder — capturing hero, information architecture, component density, and interaction patterns.
2. **Full inventory of the local repo:** `src/app/page.tsx` (hash SPA router), `src/components/site/*` (public views), `src/components/admin/*` (26 console views), `src/lib/*` (journey, factory, media, feeds, telephony, newsletter…), `prisma/schema.prisma` (43 models), `src/data/site.ts` (content source), `src/components/site/diagrams.tsx` + `DesignKitView.tsx`.
3. **Cross-check against `COVERAGE-AUDIT.md` and `docs/REFERENCE_VERIFICATION_MATRIX.md`** (150 references live-probed on 2026-10-09; 146 EXISTS, 1 ARCHIVED, 3 NOT_FOUND) so this document does not re-litigate “is it built?” — it asks “does it *feel* built like them?”

---

## 2. What the references actually are (and what they do brilliantly)

### 2.1 Buffer.com — *the social workspace*
**What it is:** Social scheduling SaaS (Facebook, IG, TikTok, LinkedIn, Threads, Bluesky, YouTube Shorts, Pinterest, Mastodon, X, Substack).

**Why it feels premium:**
- **Hero is not a hero.** Headline + email capture + 8 integration tiles (Canva, Claude, GDrive, Dropbox, Zapier, ChatGPT…) above the fold — you understand the product in 3 seconds.
- **Social proof as a number:** “283,243 creators…” + 9 logo wall (Metallica, Wired, Crocs, Pizza Hut…) repeated as marquee. Tech360 shows trust as 4 bullet phrases.
- **Four feature blocks = four screenshots:** Publish (queue + calendar), Create (idea board + AI columns), Community (unified inbox with filters), Insights (all-channels report). Text left, screenshot right, alternating. Every claim is a picture.
- **Second-tier grid:** Collaborate (approval workflow on calendar), Mobile app, Start Page (link-in-bio), AI Assistant — each with a device mock. No feature ships without its image.
- **Design language:** White + slate, 16–24px headings, 1.75 line-height body, soft shadows, blue `#009…` CTA used once per block, rounded-2xl cards. Dense but airy.
- **Honest integration wall:** `Connect your favorite accounts` grid — 11 platforms — each a real OAuth surface, not a placeholder.

**Tech360 parity today:** `MediaStudioView` + `ContentStudioView` plan copy, `CommunicationsView` + `NewsletterView` send, but there is **no publish queue, no calendar drag, no Start Page, no unified Community inbox visual**. The admin “Social” module is backend-honest (`NOT_CONFIGURED`) but the frontend does not *look* like Buffer even when it is configured.

---

### 2.2 Mureka.ai — *the AI music studio*
**What it is:** Text-to-music generator (v9.5) with Remix, Vocal/Instrumental, Lyrics, Style, Stems.

**Why it feels premium:**
- **Single centered studio panel** — not a dashboard. Left nav (Create Music / Create Video / Studio / Tools / Library), center card (Mode: Easy/Custom/Soundtrack → Prompt → Reference/Remix → Vocal gender → Advanced Options → Templates/My prompts → **Create** CTA), right workspace (`No songs yet, create one now!` empty state with illustration). Everything serves the Create button.
- **Template carousel** (`Need inspiration? Explore templates`) — one-click prompts categorized by vibe, not blank input.
- **State is visible:** `1 Free`, `0 Gold`, `Go Premier` credit pill in header — you always know the cost.
- **Library as tabs, not tables:** Generated tracks render as waveform cards with play/download/stems, not rows.
- **Typography is dark + neon**, studio-like, with vocal-gender toggle (Female/Male) as pill, not radios.

**Tech360 parity today:** `MediaStudioView` (`src/components/admin/MediaStudioView.tsx`) does scene → shots → narration → SRT/VTT → render-spec planning **honestly** (reports `RENDER_NOT_CONFIGURED` until a provider exists). But its layout is `DataTable assets` left + `Generate Asset` form right — a **database admin**, not a studio. No template strip (we have prompt-library as a separate view), no player card, no credit / cost visibility, no empty-state illustration.

---

### 2.3 Astryx.atmeta.com — *Meta’s open-source design system*
**What it is:** React 19 + StyleX component system, 180+ components, 13,000 apps inside Meta, 8 years iterated. The site itself is the product.

**Why it feels premium:**
- **Live commerce demos, not lorem ipsum:** Minimalist Watch, Canvas Backpack, Butter Croissant (with inventory: 64/38/51…) — every component is shown *inside* a real page (checkout with shipping tiers, inventory table with Available/Location/Tags + row actions Edit/Duplicate/Move/Delete, Studio AI chat drawer, Revenue sparkline + Activity feed).
- **Inventory table is the hero:** Search + Categories/Audio/Bags filters + Locations pills + Tags + List/Grid view + “2 items are running low” + inline bulk actions. Tech360’s tables have search + columns but no filter pills, no view toggle, no row-action overflow.
- **Design Kit vs Astryx:** Tech360’s `DesignKitView` (`#/design-kit`) has 4 sections (Buttons → Diagrams → Mockups → Tokens) with live components — genuine and print-legible SVG diagrams. Astryx has **Themes** (Butter Croissant, Pancakes…), **Templates** (ready-to-ship pages), **Playground**, **CLI/MCP** (`agent-ready docs`). Our kit shows *what tokens exist*; theirs shows *how to ship a page in 60 seconds*.
- **Spacing & style:** StyleX atomic, 4/8/12/16/24/32px rhythm, dark mode built-in, CLI code-copy. Tech360 uses Tailwind 4 + shadcn — similar stack, but tokens are documented, not interactive.

---

### 2.4 Stack Overflow — *the Q&A knowledge engine*
**What it is:** 24M questions, tags, voting, reputation, Collectives, bounties, “Ask Question” primary CTA.

**Why it feels premium:**
- **List density with scent:** Title (blue, 16px) → truncated body → tags as pills → avatar + rep + time. Every row tells you if it’s answered, scored, viewed — no click required.
- **Filters as power:** No answers / No upvoted / Has bounty / Days old / Sorted by Newest/Active/Score/Trending, plus **My watched tags**.
- **Collectives** (curated sub-communities) — “Find centralized, trusted content…”
- **Ask box is always visible** (top-right), not buried in admin.

**Tech360 parity today:** `KnowledgeView` (`src/components/admin/KnowledgeView.tsx`) is a *private* doc store: upload PDF/DOCX/TXT → extraction (`src/lib/doc-extract.ts`) → classification/approval → AI search (`knowledge-search.ts`). Excellent for “chat with your docs” (DocGPT parity). But there is **no public Q&A, no voting, no tag following, no reputation, no “Ask” conversion funnel**. The public site has FAQ (`FaqView.tsx`, 142 lines — static accordion), not a community.

---

### 2.5 Coder.Qwen.ai — *the zero-friction app builder*
**What it is:** Prompt → web app → “seamlessly export it directly to GitHub.” No repo required to start.

**Why it feels premium:**
- **Four giant template cards** above the fold: *Build a Coffee Store Website / Snake Web Game / Solar System Demo / Pomodoro Tool* — click = pre-filled prompt. Zero typing to first value.
- **Mobile QR** — download app, continue on phone. Native + web parity.
- **GitHub as destination, not starting point:** Export, not import.
- **Visual language:** White, large rounded cards with illustrations, two-column “Help you write code and seamlessly export it directly to GitHub.”

**Tech360 parity today:** `FactoryView` (`src/components/admin/FactoryView.tsx`) is powerful — brief → blueprint → pages/models/endpoints/agents/automations → ZIP source tree (`src/lib/factory/blueprint.ts`). But its entry is a **7-field form + modules checklist** (name, vertical `crm|marketing|education…`, modules `leads|pipeline…`, notes textarea). There is no template gallery, no one-click “Coffee Store” starter, no mobile continuation, no GitHub export button — download is ZIP only. Internally it’s MetaGPT-level planning; externally it *looks* like an internal tool.

---

### 2.6 The GitHub families (summary of 60+ links you shared)

| Family | Example repos | What that product *feels* like | Tech360’s current answer | Gap type |
|---|---|---|---|---|
| **Full CRMs** | frappe/crm, trycompai/crm, ChurchCRM, idurar-erp-crm, fat_free_crm, Django-CRM, Odoo-mobile/crm, DeskcommCRM | **Pipeline = Kanban.** Drag columns (New → Qualified → Proposal → Won), detail drawer on click, activity timeline under ID, CSV export, assignment avatar, due-date chip | `LeadsView` + `ClientDetailView` are **table + 11-tab detail** (`src/components/admin/ClientDetailView.tsx` 600+ lines, tabs for journey/communications/payments…). No draggable Kanban, no calendar, no swimlane “who does what” inline. Data model supports it (`Lead`, `Client`, `Communication`, `Meeting`, `ProjectTask`), UI does not show it as drag | Interaction |
| **Low-code builders** | ToolJet | Canvas with widget palette left, properties right, data-source connector modal, query builder bottom | Factory generates **real code (Next.js/Prisma)** instead — honest choice, correctly documented as `◐ partially applicable` in `COVERAGE-AUDIT`. But there is no visual builder surface at all — even a read-only canvas preview would signal parity | Surface |
| **Multi-agent frameworks** | MetaGPT, voltengine/OpenViking, AprilNEA/OpenLogi | SOP graph: roles (PM → Architect → Engineer → QA), artifacts passing lanes, run log with token cost | 44 agents + `src/lib/agents/engine.ts` + `OpsView` heartbeat/cycles + `AgentsView` registry. Strong backend, but the **run timeline is text** (recent cycles as pill list in `DashboardView.tsx` line 220). No MetaGPT-style SOP lane diagram for a run | Visualization |
| **Education** | alo-education-uk-final, nabaleducation/…, NextStep-Abroad, studytra | Country cards, university list, intake funnel, offer-letter tracker | `IndustriesView` + `IndustryDetailView` + `ServicesView` render services/industries from `src/data/site.ts` (20 services, 20 industries) + contact intake → Lead. No university DB, no offer tracker — out of scope and honest | Content |
| **SMS / Calls / VoIP** | httpsms, sms.domovina.ai, linphone-iphone, VoIP samples | Phone number list, conversation bubbles, delivery ticks, call log with duration/waveform | `TelephonyView` + `CommunicationsView` + `src/lib/telephony.ts` honest adapters (`NOT_CONFIGURED` until creds). UI is table of `Communication` rows; no phone-dialer, no bubble thread, no waveform | Interaction |
| **Marketing skills** | marketingskills, EveryApps/open-seo, ruvnet/ruflo | Skill card grid, SEO audit checklist with pass/fail, run-log timeline | `MarketingKitView`, `SeoAuditView` (`src/lib/seo-audit-core.ts` 42 checks), `ContentStudioView`, `PromptLibraryView` (36 prompts across 8 categories from `image-prompts.ts`). Checklist exists but **renders as table**, not the score-ring + fix-list that `open-seo` shows | Visualization |
| **Diagram / visual** | diagram-design (47k★), humanizer | Gallery of real SVG diagrams with labels, hand-tuned spacing | Shipped: `diagram-kit.tsx`, `diagrams.tsx`, `concepts.tsx` + 3 concept mockups. Actually above-parity here — Astryx parity target, but our set is **only 7 diagrams + 3 mockups**, not 180 components | Density |
| **Docs / collaboration** | siyuan, RSSHub, education-toolkit | Feed ingest + item cards + “turn into idea” CTA; wiki with block references | `FeedsView` (RSS 2.0/Atom/JSON → `FeedSource/FeedItem` + `src/lib/feeds/parse.ts`), `KnowledgeView` — functionally complete, visually sparse (DataTable again) | Density |

**Net:** Every family is **answered in code or honestly bounded** (`COVERAGE-AUDIT.md` dispositions `✅`/`➕`/`◐`/`⛔` hold). None is answered *visually* at the level the reference product invests in its one killer screen.

---

## 3. Current Tech360 — honest strengths to preserve

Before prescribing changes, what is already **real and verified**:

- **Single codebase, three surfaces** (`src/app/page.tsx` hash router → public / portal `#/portal` / admin `#/admin` + design-kit `#/design-kit`) with consent-aware analytics (`injectAnalytics()` after `t360_consent`), scroll-progress + back-to-top, live chat widget (`ChatWidget.tsx` 719 lines), tracking pixel.
- **Public site** 12 routes (`Home`, `About`, `Services`, `ServiceDetail`, `Industries`, `IndustryDetail`, `Work`, `Technologies`, `Process`, `Blog`, `BlogPost`, `Contact`, `Legal`, `Faq`, `Portal`, `DesignKit`) fed by one honest source (`src/data/site.ts` ~111k, **no fake metrics/client counts**).
- **Admin console** 26 views (lazy `AdminApp.tsx`), role-gated (Super Admin / Admin / Manager / Sales / Developer / Support / Marketing / Client), CSRF double-submit, audit trail, approval queue (`ApprovalsView`).
- **CRM lifecycle** is end-to-end: contact intake → `FormSubmission` → Lead (11-tab `ClientDetailView`) → `Communication` (WhatsApp/Email/SMS/FB/IG/LinkedIn/X honest states `src/lib/comms.ts`) → `Project` → `Preview` (token HTML) → `Invoice`/`Payment` (Stripe REST + HMAC webhook `PAYMENT.md`, per-invoice allocation) → `HandoverRecord` → `Review/Referral`.
- **AI layer that actually runs:** 44 seeded agents, `src/lib/agents/engine.ts` (structured tool use, JSON, retries, execution records), `AiMemory`, `KnowledgeDocument` with real PDF/DOCX extraction (`doc-extract.ts` via `unpdf`/`mammoth`), `ops-loop.ts` heartbeat/cycles, `ai-ops` (:3031) + `notify-relay` (:3032) sidecars; `DashboardView` shows live `ACTIVE` pulse + last cycle actions.
- **Newer parity builds that are real:** Media Studio (script→shots→narration→SRT), Feed Hub (RSS/Atom/JSON dedupe), Calls & SMS honest adapters, Newsletter with signed `open` pixel + `click` 302, image-prompt gallery (36 prompts, 8 categories `src/data/image-prompts.ts`), Factory blueprint engine (`src/lib/factory/blueprint.ts` → ZIP).
- **Design honesty:** Official letterhead system (`src/lib/letterhead.ts`, `OFFICIAL-DOCUMENTS.md`), no public WhatsApp button (owner directive), honest `NOT_CONFIGURED` states instead of faked sends.
- **Stack guardrails:** Next 16 + React 19 + TypeScript 5 + Tailwind 4 + shadcn, Prisma 6 MySQL, `components.json`, `tailwind.config.ts`, `@dnd-kit` already installed (6.3.1) but not surfaced as Kanban.

**What reads as “unfinished” is therefore not missing functionality — it is missing *product surface polish*.**

---

## 4. The design gap — in one table

| Dimension | Buffer / Mureka / Astryx / SO / Qwen bar | Tech360 today | Gap severity | Concrete symptom |
|---|---|---|---|---|
| **Hero & above-the-fold story** | Buffer: email + 8 integration tiles + social proof number + logo marquee. Mureka: centered create panel. Qwen: 4 template cards | `HomeView.tsx` cinematic video hero (“Strategy. Software. Automation. Growth.”) + 5-item industries strip (`eCommerce/Healthcare…`) text-only, then 6 flagship service cards. No integration wall, no template chooser, no number | **P0 visual** | New visitor needs 3 scrolls to know what you do; Buffer needs 0 |
| **Feature proof** | Every claim = screenshot (queue, board, inbox, report) | Flagship services = icon + 2-line tagline; no screenshots except `ImageView` wrappers; case studies in `WorkView.tsx` 460 lines are text cards | **P0 visual** | “Show don’t tell” violation |
| **Component density** | Astryx: 180 live components; inventory table has filters + tags + locations + grid/list + bulk actions | `DesignKitView.tsx` 224 lines: 4 sections (Buttons/Diagrams/Mockups/Tokens). Token gallery is correct but small. Tables across admin share one `DataTable.tsx` (sorting + pager, no filter pills, no view toggle) | **P0 system** | Platform looks like one table reused 20 times — because it is |
| **Kanban / calendar** | Buffer calendar, Frappe Kanban, ToolJet canvas | `@dnd-kit` installed, **zero Kanban/calendar in app**. Leads is rows; projects is rows; content campaigns is rows | **P0 interaction** | Pipeline drag — the CRM’s most expected interaction — is missing |
| **Studio experience** | Mureka centered studio + template carousel + player cards | Media Studio is *left table + right form*, Content Studio is *assets table + generator form* + campaigns list. Prompt Library is a third view | **P1 interaction** | Three views do what Mureka does in one studio |
| **Community / knowledge scent** | Stack Overflow question list density + votes + tags + watched | Knowledge is admin-only `KnowledgeView` (search + upload + scan status), FAQ is static accordion (`FaqView.tsx` 142 lines) | **P1 surface** | No public learning loop, no SEO moat |
| **Factory onboarding** | Qwen 4 templates → one click → GitHub export | Factory is `Brief` form (7 fields + 14 module chips) → Generate → file tree. Powerful, but no template, no preview screenshot, no GitHub push | **P1 onboarding** | Time-to-first-value is typing, not clicking |
| **Trust & enterprise proof** | Buffer logo wall, Astryx “13,000 apps inside Meta, 8 years”, checks as colored groups | Trust strip is checklist: `TRUST_POINTS` bullets; Process (`ProcessView.tsx` 248 lines) + diagram `DevLifecycleDiagram` (7 phases) is text + SVG, correct but not photographic | **P1 trust** | Enterprise buyers scan logos and photos; we give them vectors |
| **Empty states & microcopy** | Mureka `No songs yet, create one now!` with illustration; Astryx `2 items are running low` banner | Empty states are `EmptyState` component (icon + title + description) — consistent but illustration-free; honest zero states (newsletter opens=0 until real sends) are correct but visually flat | **P2 polish** | Correct but not delightful |

---

## 5. What to build — phased, honest, shippable

All items below **add surfaces; they do not fake integrations**. Every external call keeps the honest `NOT_CONFIGURED / DISABLED_BY_ADMIN / CONFIGURATION_REQUIRED` guard that is already tested.

### Phase 0 — Keep the promise (no new deps, copy-safe)

1. **Instrument what you have:** Add `data-testid` + loading skeletons already present (used in `MediaStudioView`, `NewsletterView`) uniformly; no new library.
2. **Letterhead + doc previews:** keep as canonical; already covered.

### Phase 1 — Make the public site look Buffer-grade (1–2 sprints)

- **A. Integration tiles hero add-on:** Under the existing `HomeView` email/CTA row, render an 8-tile grid (Stripe, WhatsApp Cloud, n8n, Prisma, Next.js, Tailwind, shadcn, Vercel/Hostinger) using the existing `imageFor()` + `public/brand/` assets — purely visual, each tile links to `TECHNOLOGIES` detail, not to an OAuth claim.
- **B. Logo wall + number:** Promote `TRUST_POINTS` to a wall: `“X projects delivered · Y industries · Z services”` derived from `SERVICES.length / INDUSTRIES.length` (honest counts, not inflated revenue). Style as Buffer’s marquee with `Framer Motion` (already installed `framer-motion@12.23.2`).
- **C. Feature blocks with screenshots:** Convert the 6 flagship services from cards to **alternating screenshot + text** using free SVG device mocks (already in `concepts.tsx` patterns). Each block reuses `ServiceDetailView` copy — no new content debt.
- **D. Start Page parity:** Ship a real `/#/start` link-in-bio page using the same footer newsletter model — one row per link, click tracking already in `newsletter.ts` (`/track/click` 302) can be reused.
- **E. Tech stack diagram becomes interactive:** The `TechStackDiagram` in `diagrams.tsx` gains a hover legend (already has color tokens `NAVY/BLUE/CYAN/GREEN`) and a “Copy as PNG” button using `sharp` (already installed `0.35.5`).

**Definition of done:** A first-time visitor can screenshot the above-the-fold + one feature block and the screenshot alone sells the product (Buffer test).

### Phase 2 — Make the console feel like Astryx + Frappe (2–3 sprints)

- **A. Kanban for Leads & Projects (uses installed `@dnd-kit`):**
  - Columns = lead stages (`NEW → CONTACTED → QUALIFIED → PROPOSAL → WON/LOST`) already in `LeadsView`/`journey.ts`.
  - Drag = `PATCH /api/admin/leads/:id` stage update (exists) + `AutomationLog` write. **No new endpoint.**
  - Toggle: `View · Table | Board` pill in `PageHeader` actions — preserves the auditable table; adds the expected drag surface. Reference: Frappe CRM board + Astryx inventory `List view / Grid view`.
- **B. Calendar for Campaigns & Meetings:**
  - `NewsletterView` campaigns + `Meetings` get a month calendar (reuse `react-day-picker@9.8.0` already installed). Clicking a day filters the DataTable below — no new data fetch, just `useMemo` filter.
- **C. Unified Community Inbox visual:**
  - `CommunicationsView` + `ConversationsView` + `TelephonyView` already share `Communication`/`ChatConversation` models. Add a single **filter pill row** (`All · WhatsApp · Email · SMS · Web`) + **thread bubbles** (left = IN, right = OUT) instead of only rows. Delivery ticks map to `QUEUED → SENT → DELIVERED → READ` already stored — just render them.
- **D. DataTable upgrade (Astryx parity):**
  - Extend `src/components/admin/shared/DataTable.tsx` with: filter pills, active-filter chips with `×`, column-visibility menu, row-action overflow (`…` → Edit / Duplicate / Archive), and density toggle. This single upgrade lifts **20 views at once** — the highest leverage change in the codebase.
  - Add “2 items need attention” banner (e.g., `pendingAdminApprovals > 0`) pattern from Astryx inventory into `DashboardView` module directory cards.

### Phase 3 — Make creation feel like Mureka + Qwen (2 sprints)

- **A. Media Studio → centered studio (single view):**
  - Merge `MediaStudioView` + `ContentStudioView` + `PromptLibraryView` into one **Studio** with three tabs: *Create* (prompt + templates + language/aspect), *Library* (36 prompt patterns from `image-prompts.ts` as selectable cards, not a separate page), *Workspace* (waveform/card grid with play/download/SRT). The empty state becomes Mureka’s illustration + “No assets yet, create one now — try: *‘Fashion store hero, Dhaka, golden hour’*”.
  - Keep `queue-render` honest: button shows `RENDER_NOT_CONFIGURED` badge until provider configured (already correct).
- **B. Factory → template gallery + export:**
  - Pre-seed 6 Qwen-style templates as **cards** (Coffee Store, Real Estate Portal, Education Admissions Hub, Booking Platform, Support Helpdesk, CRM) — each maps to a `vertical + modules` preset already supported by `blueprint.ts`. Clicking a card pre-fills the Brief form; user edits only `appName` + `clientName` then Generate.
  - Add **GitHub export** (new endpoint `POST /api/admin/factory/apps/:id/export-github`): builds a temporary GitHub repo via the same ZIP + `download` logic that already exists (`/api/admin/factory/apps/:id/export`), but pushes with `gh` PAT supplied at request time (never stored). Honest `NOT_CONFIGURED` until PAT provided.
  - Render a **live file-tree + one screenshot mock** beside the blueprint (reuse `CrmConsoleConcept` mock) so the blueprint *looks* like an app before it is built.

### Phase 4 — Community moat (Stack Overflow + DocGPT)

- Public **Q&A** under `#/knowledge` (reuse `BlogView` / `BlogPostView` layout): questions are `BlogPost` with `category='Q&A'` + votes as `Review.rating` reuse, answers are comments (`ChatMessage` variant). Gated behind “Sign in to answer” (portal auth exists). Full search already in `knowledge-search.ts` — add tag pills + “Watched tags” from portal preferences.
- Keep the private `KnowledgeView` as the **curated source**; public Q&A is the **discussion layer** (same split Stack Overflow uses: Teams vs public).

### Phase 5 — Design Kit → Astryx-grade

- Promote `#/design-kit` from 4 sections to **7**: add *Forms*, *Tables*, *Navigation* (header + portal nav). Each section gets a **Playground** tab (props knobs) + **Code** tab (copy-paste `shadcn` snippet) + **Theme switch** (light/dark — `next-themes@0.4.6` already installed, just expose the toggle). Add a **Template gallery** (Website hero, CRM board, Invoice) as copyable page shells.
- Ship CLI parity: `npx tech360 add button` is a thin wrapper over `shadcn add` + token copy — not a new package, a documented alias in `docs/DESIGN_KIT.md`.

---

## 6. Quick wins that can ship this week without review risk

| Win | File to touch | Effort | Why it moves the needle |
|---|---|---|---|
| Add integration tile row under hero | `src/components/site/HomeView.tsx` — new `IntegrationTiles` + `SocialProofWall` components (~80 lines each) | S | Visitor comprehension 0→3s |
| Add `Table | Board` toggle to Leads | `src/components/admin/LeadsView.tsx` + `@dnd-kit/sortable` (already installed) | M | Meets CRM buyer expectation instantly |
| Merge Prompt Library into Media Studio as Library tab | `src/components/admin/MediaStudioView.tsx` inject `image-prompts.ts` cards | S | Removes one navigation hop |
| Add 6 Factory template cards | `src/components/admin/FactoryView.tsx` — preset chips → cards | S | Time-to-first-value typing → clicking |
| Upgrade DataTable with filter pills | `src/components/admin/shared/DataTable.tsx` | M | Lifts 20 views at once |
| Empty-state illustrations | `src/components/admin/shared/cards.tsx` `EmptyState` — add SVG illustration prop | S | From correct to delightful |

---

## 7. What we deliberately will *not* copy

| Reference temptation | Why we keep the honest boundary |
|---|---|
| Faking Buffer’s 283k count or Mureka’s `1 Free` → `Max` credit without a real provider | Violates the honest-status philosophy documented in `README.md` §9 and `SECURITY.md`. Counts derive from `SERVICES.length` / DB counts, not marketing inflation |
| Shipping a ToolJet-style live drag builder | Would split the honest “real Next.js/Prisma source in a ZIP” promise of the Factory into a second runtime to maintain. The factory stays deterministic |
| Self-hosting an LLM or video renderer | Hostinger Web App is Node standalone; GPU render farm is a different product category (`MoneyPrinterTurbo` / `ComfyUI` family correctly marked `⛔` in coverage). We keep `RENDER_NOT_CONFIGURED` |
| Public WhatsApp button | Owner directive removed it (`KNOWN_ISSUES_AND_BLOCKERS` honest boundary). Adapter stays private and gated |
| Fake payment/social success | `SESSION_SECRET` / `OPS_SECRET` / payment webhooks remain server-verified (`PAYMENT.md`). No browser-settled settlement |

---

## 8. How to evaluate “did we close the gap?”

Use the same **screenshot test** the references pass:

1. Take a 1280×800 screenshot of Tech360’s homepage above-the-fold + one feature block.
2. Take the same for Buffer’s homepage.
3. Show both to someone who has not seen Tech360 for 10 seconds, then ask “what does each product do?”
4. If they answer Tech360 as fast as Buffer, the **hero + tiles + proof + screenshot** phase worked.

For the console: same test with Leads board (Frappe screenshot vs Tech360 Leads `Table|Board` toggle) and Media Studio (Mureka studio vs Tech360 Studio tab).

---

## 9. Appendix — where every owner link lands (condensed)

All 155 links remain dispositioned in `COVERAGE-AUDIT.md`; the live probe table is `docs/REFERENCE_VERIFICATION_MATRIX.md`. This section maps the **design-relevant** subset to the phases above:

- Buffer family → Phase 1 (public site) + Phase 2C (community inbox)
- Mureka / MoneyPrinterTurbo / VoiceStudio / humanizer → Phase 3A (studio)
- Astryx / diagram-design / ToolJet → Phase 2D (DataTable + Design Kit Phase 5)
- Stack Overflow / siyuan / docGPT-langchain → Phase 4 (Q&A)
- Qwen Coder / MetaGPT / OpenViking / OpenLogi → Phase 3B (factory templates + GitHub)
- CRM cluster (20 repos: frappe/trycomp/Church/oroinc/fat_free/idurar/…) → Phase 2A (Kanban)
- SMS/VoIP cluster (httpsms/domovina/linphone/…) → Phase 2C (thread + ticks)
- SEO / marketing skills cluster → Phase 2D + Phase 3A (checklist score-ring)
- Education cluster → Phase 1C (industry cards → country/university cards, content-only)

No reference is ignored; a `⛔ not applicable` disposition means “not vendored as a second product,” not “not answered.”

---

## 10. Recommendation to the owner

**You do not need a rebuild. You need a reskin + two interactions.**

If engineering time is limited, do exactly this and stop:

1. **Public site reskin** (Phase 1 A–C) — integration tiles, logo wall, screenshot blocks. *Makes you look Buffer-grade tomorrow.*
2. **Leads Kanban board toggle** (Phase 2A) — one view, `@dnd-kit`, no new endpoint. *Makes you feel Frappe-grade the day after.*
3. **Media Studio centered studio** (Phase 3A) — merge three views into one with templates. *Makes you feel Mureka-grade by week two.*

Everything else is polish on top of those three moves. The platform beneath is already correct, auditable, and honestly bounded — it just does not show it yet.

---

*Generated by `audit:design-gap` — source is the repository, live fetch is the reference; no metric is invented.*
