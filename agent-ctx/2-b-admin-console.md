# Task 2-b — Admin Console Agent Work Record

Task ID: 2-b
Agent: admin console
Task: Build the Private Super Admin AI Command Center UI (SPA component tree rendered at #/admin)

## Scope discipline
- Created ONLY: `src/lib/admin-client.ts` + `src/components/admin/**` (29 files).
- Did NOT touch: `src/app/page.tsx`, `src/app/layout.tsx`, any API route, `src/components/site/**`.

## Files created (29)
- `src/lib/admin-client.ts` — getCsrf() (reads `t360_csrf` cookie), `fetchJson(url, {method, body})` (auto `x-csrf-token` on POST/PUT/PATCH/DELETE, JSON parse, throws ApiError with server `error`/`message`), `useApi<T>(url|null)` hook (AbortController, abort-safe, refresh tick), ~40 TS interfaces mirroring the frozen contract + Prisma models, `api.*` typed endpoint helpers, formatting helpers (fmtDate/fmtMoney/fmtBytes/prettify/parseMaybeJson/clientDisplayName).
- `src/components/admin/AdminApp.tsx` — DEFAULT EXPORT `AdminApp({ onExit })`. Auth bootstrap GET /api/auth/me (401 → LoginScreen; mustChangePassword → ChangePasswordScreen), dark palette forced via documentElement `.dark` (added only if absent, removed on unmount), sidebar (fixed lg+, Sheet on <lg), topbar (client search → Enter navigates to Clients view with query, notification bell with live unread/pending/failed counts from /api/admin/dashboard, user dropdown with logout POST /api/auth/logout + "Back to website"), 17 views + client/project detail overlays, framer-motion page transitions, footer.
- Screens: `LoginScreen.tsx`, `ChangePasswordScreen.tsx`.
- Views: `DashboardView.tsx` (14 KPI cards, pipeline vertical BarChart, revenue AreaChart, recent leads table, activity feed), `LeadsView.tsx` (mode: leads|clients, debounced search, 20-stage + status filters, pagination), `ClientDetailView.tsx` (20-stage stepper, contact/lead cards, journey action bar with 7 actions + payload dialogs, 8 tabs, record payment + verify, honest journey message + preview link), `ApprovalsView.tsx` (PENDING/ALL tabs, risk badges, payload JSON/scope view, approve/reject with note, execution result), `CommunicationsView.tsx` (channelsStatus banner with honest CONFIGURED/NOT_CONFIGURED/FAILED chips, filters, message table with error tooltips, manual send with ClientPicker + honest status line), `PaymentsView.tsx` (summary cards computed from data, verify PENDING payments, invoices if returned), `ProjectsView.tsx` (list + `ProjectDetailView` with status stepper, read-only tasks, payments, scopes, previews, delivery checklist, handover states, close with confirm), `AgentsView.tsx` (stats, category filter + search, workforce tree grouped by category → departments (Accordion) → agents, agent detail dialog with purpose/tools/permissions/system-prompt collapsible/recent executions, RUN AGENT panel, Create Agent governed dialog), `CommandCenterView.tsx` (sessionId=crypto.randomUUID(), seeded with live dashboard context, quick-command chips, markdown-ish replies, data payload → compact tables, typing indicator), `MemoryView.tsx`, `KnowledgeView.tsx` (XHR multipart upload with progress bar, classification select, semantic search results with excerpts), `ContentStudioView.tsx` (campaigns, assets table, generate form type/language/aspect/duration, safe-content note), `AnalyticsView.tsx` (LineChart/BarChart/PieChart/BarChart, defensive normalization), `LogsView.tsx` (Audit paginated with expandable details, Errors with honest read-only note, Automation with expandable steps/input/output), `N8nView.tsx` (cards + real download anchors), `ReportsView.tsx` (on-demand CEO report with Oracle+Pulse loading state), `SettingsView.tsx` (/api/health status, channel chips, env var NAMES ONLY docs, deployment package link, legal links).
- `shared/`: `styles.ts` (palette + class constants), `StatusBadge.tsx` (every status string → honest color mapping + RiskBadge), `DataTable.tsx` (generic typed table, skeleton rows, sticky header, max-h scroll, thin scrollbars, keyboard row activation), `cards.tsx` (EmptyState/KpiCard/SectionCard/PageHeader), `JsonView.tsx` (minimal syntax coloring), `Markdownish.tsx` (headings/bold/inline code/lists/code fences/hr), `Pager.tsx` (pagination + ClientPicker search-select).

## Journey payload shapes sent by the UI (main agent must accept these)
- `ASK_SCOPE_QUESTIONS`, `GENERATE_PREVIEW`, `REQUEST_PAYMENT` → `{}`
- `SUBMIT_SCOPE` → `{ text, scopeText }` (both keys set to same value)
- `RECORD_PAYMENT` → `{ amount, method, transactionId?, milestone?, notes? }`
- `PREPARE_HANDOVER`, `CLOSE_PROJECT` → `{ projectId? }` (omitted when client has no projects)

## API gaps / assumptions found (contract v1)
1. **`GET /api/admin/deploy-package`** (ZIP) is referenced by SettingsView but is NOT in the frozen contract — needs to be added by the API agent.
2. **Client-detail Approvals tab**: `/api/admin/clients/[id]` response does not include approvals. UI fetches `/api/admin/approvals` (no status param, assumed = all) and filters client-side by `clientId` OR client display name. Recommend the API include approvals in the client detail response, or support `?clientId=` on the approvals endpoint.
3. **Approvals "ALL" tab** assumes no-status → all statuses (PENDING documented only).
4. **No error-resolve endpoint** (PATCH) in contract → Errors tab renders read-only with an explicit note.
5. **No task-update endpoint** in contract → project tasks rendered read-only with status badges (per instructions).
6. `/api/admin/communications/send` response assumed `{ ok, status, error?, message? }` — status displayed verbatim (SENT/FAILED/NOT_CONFIGURED…).
7. `/api/admin/payments` may optionally return `invoices[]` — rendered if present.
8. `GENERATE_PREVIEW` journey result assumed to contain `link` (and/or `previewUrl`) — matches lib/journey.ts which returns `{ previewId, token, link }`.
9. Agents list: `agent.dept` matched against department `code` OR `name` (contract ambiguous); unmatched agents shown under "Unassigned".
10. `/api/health`: `db` handled as boolean OR status string; `channels` values handled as boolean OR 'CONFIGURED' string.
11. Analytics `channelMix` / `agentActivity` item field names normalized defensively (channel|name, count|value; agent|name|code, executions|count).
12. Settings legal links point to `#/legal/privacy`, `#/legal/terms`, `#/legal/refund` — slugs must exist in Task 2-a's public hash router.

## Verification
- `bunx eslint src/components/admin src/lib/admin-client.ts` → 0 errors, 0 warnings.
- `bunx tsc --noEmit` → 0 errors in admin files (remaining project errors are in src/lib/auth.ts, src/lib/journey.ts, src/components/site/*, examples/, skills/ — owned by other agents).
- `bun run lint` (whole project) → only errors in `src/components/site/*` (Task 2-a files, not mine).
- Bun runtime smoke import of all 29 modules → all OK; `AdminApp.tsx` default export confirmed.
- dev.log clean (compiles fine).

## Integration note for main agent
Render at `#/admin`:
```tsx
import AdminApp from '@/components/admin/AdminApp'
// <AdminApp onExit={() => { window.location.hash = '#/' }} />
```
Ensure the sonner `<Toaster />` is mounted in the app shell (I only call `toast.*`). Toaster theme will follow next-themes; the console forces the `dark` class on <html> while mounted (reverts on exit if it wasn't dark before).
