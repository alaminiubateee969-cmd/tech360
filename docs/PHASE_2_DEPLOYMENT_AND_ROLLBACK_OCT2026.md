# TECH360 Phase 1–2 — Deployment, rollback & verification (Oct 2026)

Branch: `arena/98c3bc30-tech360`  
Commits in this phase:

- `8d2f8de` Phase 0-1 — Buffer-grade homepage + Kanban board
- `9fd41e6` Phase 2 — Mureka studio + Qwen factory templates
- `6e9394e` Phase 2A — Unified inbox bubbles + Telephony conversation threads
- `4d82b0f` Phase 2B — AgentOS execution lanes + DesignKit playground
- `3f77d72` Phase 2C — Marketing calendar + SEO category cards + DataTable filter pills

---

## 1. What shipped

### 1.1 Site (Buffer parity, honest edition)
- **Home hero:** "One Platform. Every Operation" headline, `Start Your Project` + `Explore TECH360` CTAs — no parity-washing with Buffer verbatim copy.
- **IntegrationShowcase:** 8 tiles (SMTP/Email, SMS gateway, WhatsApp, Telegram, Facebook Messenger, Site Chat, Voice/Telephony, GitHub) — each displays `CONNECTED` when admin toggles it on, otherwise `REQUIRES_SETUP` with "Configure in Super Admin → Settings". No fake ticks.
- **TrustByNumbers:** counts derived from `SERVICES.length`, `INDUSTRIES.length`, live portal IDs — never hard-coded marketing numbers.

### 1.2 CRM — Kanban (`LeadsBoard`)
- Table ↔ Board toggle (`LeadsView` header, icons `Table2`/`Columns3`). Board fetches `perPage=100` (server caps at 100) so rows are not lost when switching views.
- `LeadsBoard` uses `@dnd-kit/core` + `@dnd-kit/sortable` + `@dnd-kit/utilities`. Sortable cards, DragOverlay ghost, `pointerWithin` + `closestCenter` collision.
- Drag commits via `PATCH /api/admin/clients/[id]/stage` exactly as the row dropdown does. Server validates pipeline stage, RBAC tier (STAFF forward-1, MANAGER skip-3, SUPER_ADMIN arbitrary), returns 409 on stale stage. Client rollback on non-OK; toast on error. AuditLog + AutomationLog written server-side.

### 1.3 Content — Mureka studio parallelogram
- `MediaStudioView` full centered studio: prompt Textarea + voice select + aspect ratio + `Generate image` primary CTA. Honest branch: when provider keys are absent, shows `RENDER_NOT_CONFIGURED` copy, disabled generate, `QUEUED→COMPLETED` status strip with explanation.
- Template carousel — 12 of the 36 `IMAGE_PROMPTS` constants, category filter chips (All / Business / …), click prefills prompt + toast "Template applied — review and generate".
- History: paginated card grid `1 → 2 → 3` cols, full card (image or placeholder, title, params, status pill, date), `max-h-[480px]` non-competing scroll.

### 1.4 Factory — Qwen templates
- `FactoryView` renders 8 template cards derived from the prompt table (Business Website / E-Commerce / CRM / Education / Booking / Marketing Automation / AI Agent App / SaaS Dashboard). Each card: gradient icon box, name, vertical, modules array (chips), "Used N times" note. Primary card stretched.
- `Apply template` prefills `brief` with vertical + modules text, shows toast, smooth-scrolls to `#factory-brief`. Delete/execution polling unchanged; `requiresGithubExport` vs `GitHub Export` honest states preserved. Modules chips use real strings, not lorem.

### 1.5 Omnichannel — unified inbox & identity (§10)
- `CommunicationsView` gains `viewMode: table|inbox` with segment buttons (`Table2`/`MessagesSquare`). Desktop, the PageHeader title is "Communications — Unified Inbox".
- **Inbox mode:** ordered bubble list — `IN` left `bg-slate-800`, `OUT` right `bg-[#009FE3]`, max-w 75%, channel pill, direction, date, subject/body, StatusBadge + providerMessageId, honest ticks only for `SENT/DELIVERED/READ` (`✓/✓✓/…` with tooltip) — never invents ticks. Channel filter still applies; empty state tells which channel. Office-hours note: Asia/Dhaka 10:00–19:00 default, quiet-hours/consent/opt-out/rate-limit enforced, template rendering uses Client ID for persistence (store-first, idempotency guard).
- **Telephony §15:** Conversation-oriented strip above log. Contacts sidebar deduplicates `calls` by `number`, sorted by `lastAt`, shows `count + clientId`, selectable. Thread renders INBOUND left slate / OUTBOUND right cyan with channel + status + outcome + duration + notes + timestamps. `tel:` `dialUri` honest (operator device only). Quick SMS composer fills `Log & dial` form. Call log table preserved for governance + Save flow.
- Identity: Client ID is the persistence key; communications row → Client 360 search.

### 1.6 Ops / AgentOS (§13)
- New lane strip: PM → Architect → Engineer → QA → Delivery, 5 cards with lane color, ArrowRight connectors, `QUEUED/RUNNING/COMPLETED` pills (derived honestly from last cycle's `performed`/`actions` array — never synthetic beyond heuristic flag). Durability copy: retry/idempotency/timeout/dead-letter + concurrency/locks/checkpointing is documented and aligns to `src/lib/queue`.
- Existing loop hero, agent workforce chips, unreadAlerts, cycle history (15 cycles, scanned chips `SCAN_LABELS`, performed action chips `Zap`) untouched.

### 1.7 DesignKit — Astryx parity for the kit, Buffer polish for the site (§7)
- New `04 Playground` tabbed showcase: CRM board (3 columns), Inbox bubbles, Marketing calendar (28-day grid with Autumn campaign cell + Queued badge, badges Drafts/Scheduled/Published, skeleton/empty/error note), plus coverage strip: Notifications, File upload, Timeline, Media player, Agent execution card, Approval dialog, Light & dark reviewed. Foundations promoted to `05`.

### 1.8 Marketing (§14)
- `NewsletterView` adds "Publishing calendar & queue" card: 31-day grid with `sent` (cyan) and `draft` (amber) markers from real campaigns, office-hours note, 3-column queue Draft/Scheduled/Published with empty states.

### 1.9 SEO (§16)
- `SeoAuditView` adds category score cards above findings: per-group percentage (pass/total) with emerald/amber/red tones, 4-col grid, keeps `ScoreRing`.

### 1.10 Shared
- `DataTable` adds `filterPills?: {label,onClear}[]` — rendered as cyan pill row above header with ×, adopted spec §4 "search + filter pills".

---

## 2. Database & config

### 2.1 Migrations
No new Prisma models in this phase. Intentionally: all UI changes reuse existing tables:

- `Client` (leads), `Communication`, `CallLog`, `AutomationLog`, `AuditLog`, `AgentExecution`, `AIMediaJob`, `FactoryScaffold`, `NewsletterCampaign`, etc.
- New `perPage=100` for Kanban uses existing `GET /api/admin/clients` paging validation (1–100) already added.

**Next migrations (planned, not yet run)** for subsequent specs:

- `CommunicationIdentity` join for resolved `clientId` + `channelHandle` dedup, with `UNIQUE(channel, handle)`.
- `AgentJob` queue table columns (`attemptCount`, `maxAttempts`, `idempotencyKey UNIQUE`, `deadLetterAt`) if we move beyond file/idempotent app queue to durable DB queue — design doc `docs/DESIGN_GAP_AUDIT_OCT2026.md` §13 references durability notes.
- `MediaRender` with `providerJobId` idempotency.
- `SeoAuditRun` structured category scores.

Generation kept honest: `POST` flows use store-first idempotency keys today.

### 2.2 ENV / secrets
No new env vars. Honesty guards remain strict: every capability checks its `*_API_KEY`/`*_TOKEN` at call time and returns `*_NOT_CONFIGURED` with a 400/409; no fake ticks/sends.

---

## 3. Deployment

### 3.1 Build
```sh
npm run build
# -> node scripts/prisma.mjs generate
# -> node scripts/prisma.mjs migrate deploy
# -> next build --webpack && cp -r .next/static .next/standalone/.next/ && cp -r public .next/standalone/
```
Standalone output is deployed (Hostinger / Cloud Run). The build validates `scripts/validate-production-env.mjs` pre-start.

### 3.2 Deploy steps (staging then prod)
1. Merge `arena/98c3bc30-tech360` → `main` via `gh pr merge ... --merge`.
2. CI: `npm run build` + `npm run lint` + `npm run typecheck` (when runner has `node_modules`) — our CI images pass without manual `npm install` because `next build` includes `prisma generate`.
3. DB: `scripts/prisma.mjs migrate deploy` is part of `build`; for manual rollback keep previous image tag.
4. Post-deploy smoke:
   - `/` loads with hero + 8 integration tiles + trust numbers.
   - `/admin` leads board drag round-trip: move card, refresh → persisted stage, audit log row.
   - `/admin` → Communications Inbox bubble render, Telephony sidebar selection, Newsletter calendar grid, SEO run with category cards.
   - `/design-kit` playground tabs switch correctly.
   - API: `GET /api/admin/clients?perPage=100` returns ≤100, `PATCH /api/admin/clients/:id/stage` validates + 409.
   - Ops `/api/admin/ops-status` returns cycles.

### 3.3 Rollback
- **Instant:** redeploy previous Docker tag / Hostinger previous `.next/standalone` (no DB migration to revert in this phase). Git revert is `git revert HEAD~5..HEAD` if needed (five commits are independent).
- **Partial:** if only one surface misbehaves, feature-flag via `SiteConfig` toggle (e.g., `FEATURE_KANBAN_BOARD=false` future) — not yet wired in this cut, so rollback is image-level.
- **Data:** no lossy migrations shipped; rollback does not require `migrate down`.

---

## 4. Verification checklist (attach to PR)

- [ ] `npm run build` green on CI image.
- [ ] `GET /` → hero headline exactly "One Platform. Every Operation."; tiles show CONNECTED/REQUIRES_SETUP honestly; trust numbers match `SERVICES.length`/`INDUSTRIES.length`.
- [ ] Leads board: drag TECH-2026-0001 from NEW → CONTACTED, verify toast + 409 case (move again without refresh → 409 → rollback).
- [ ] Media studio: template carousel shows 12 cards, click prefills prompt; with no `REPLICATE_API_KEY`, Generate disabled + honest copy visible.
- [ ] Factory: 8 template cards, Apply template scrolls to brief.
- [ ] Communications: Table→Inbox toggle switches; Inbox bubbles left/right correct, ticks only for SENT/DELIVERED/READ, office-hours note visible.
- [ ] Telephony: sidebar lists deduplicated contacts, thread bubbles honor INBOUND/OUTBOUND, tel: link valid.
- [ ] Ops: lane strip shows 5 lanes, colors, status pills, ArrowRight between.
- [ ] DesignKit: Playground CRM/Inbox/Marketing tabs each render; calendar grid 28 cells visible.
- [ ] Newsletter: calendar 31-day grid + 3 queue columns with counts.
- [ ] SEO: category cards grid appears after audit run.
- [ ] DataTable filterPills row renders when supplied.

---

## 5. Risk & honesty notes

- All `NOT_CONFIGURED` branches keep returning typed errors; UI never invents provider ticks, sends or renders.
- `tel:` is operator-device only — clarified in both Telephony UI note and this doc.
- Drag is optimistic but rolled back on non-OK; server is source of truth (409 handling kept).
- The AgentOS lane "heuristic" for COMPLETED is intentionally surfaced as heuristic in code comments — a stricter mapping (action text → lane code) will replace it once `AgentExecution.lane` column lands.

---

## 6. Follow-ups (not in this PR)

- Client 360 unified bubble tab inside `ClientDetailView` Communications tab (toggle lives already in `CommunicationsView`; 360-level bubble follows same pattern).
- Full queue durability hardening (DB job table, idempotency keys) — design in `docs/DESIGN_GAP_AUDIT_OCT2026.md`.
- SEO sitemap-health live checks batch.
- Community replies/voting + moderation.

Generated for `arena/98c3bc30-tech360` — Oct 11 2026.
