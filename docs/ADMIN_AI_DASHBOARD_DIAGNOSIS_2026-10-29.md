# Admin, Super Admin and AI dashboard diagnosis

**Date:** 2026-10-29
**Scope:** this repository and an isolated, fictional SQLite preview. The live Hostinger application, production MySQL and real AI providers were not accessed.

## Findings and repairs

| Finding | Evidence | Repair |
|---|---|---|
| AI execution had no provider configuration in this workspace. | `/api/health` reported `NOT_CONFIGURED`; both roles' command requests produced a persisted `FAILED` execution with `PROVIDER_NOT_CONFIGURED`. | Dashboard, agent registry and Command Center now explain the missing configuration. Command Center does not submit an inference request when its provider status is explicitly unconfigured. No fake AI response was added. |
| Provider diagnostics did not match the execution engine. | The engine supported AI Gateway and OpenRouter, but health, chat and ops diagnostics checked only ZAI. Production startup also required ZAI even when another supported provider was selected. | Added one provider-selection contract: AI Gateway → OpenRouter → ZAI. Health, chat, ops and operator dashboards use it. Startup accepts one complete supported configuration and still refuses when none is present. Configuration is not labelled a successful provider health check. |
| Admin's roster shortcut was unnecessarily Super Admin-only. | The backing agent/operator API allowed ADMIN, but the dashboard's **Open AI Workforce** button did not. | Both ADMIN and SUPER_ADMIN can use the shortcut. Existing server-side governance restrictions are unchanged. |
| Dashboard module tiles bypassed the sidebar's role filter. | The module directory rendered every tile, and navigation did not check the destination role. Restricted APIs still rejected unauthorized requests. | Sidebar, tiles and navigation now share `canAccessAdminView`; unknown views fail closed. The final content branch no longer falls through to Settings. |
| The preview could not be reproduced using the README command. | README referenced `npm run preview:setup`, but package.json lacked that script. The preview also lacked an ADMIN account. | Restored the script and added a preview-only `operations@tech360.local` ADMIN account. Production seeding was not changed. |
| Dashboard entry/preview access was confusing. | `/admin` previously reached the public catch-all rather than the console; the standalone command-center page had no login link. Next dev rejected the preview/loopback origin, and an HTTP-proxy header could redirect a preview request to the production domain. | `/admin` and `/super-admin` redirect to the existing authenticated `/#/admin`; the standalone page links to login and explains authentication/password-change errors. Added development-origin allowances and limited the TLS redirect to the production hostname. |

## Verified role boundaries

- **ADMIN:** dashboard, Core Agents and Command Center are available. Memory, settings, logs, model infrastructure and configured workforce/org-chart routes remain restricted.
- **SUPER_ADMIN:** dashboard, agent operations and governance surfaces are available.
- Anonymous dashboard API requests return **401**.
- A newly created Admin was required to change its temporary password before accessing dashboard data; the password-change endpoint remained accessible and the subsequent dashboard request succeeded.
- Client-side filtering is a usability measure, not the security boundary. Existing API authentication, CSRF and RBAC remain authoritative.

## Verification evidence

- **101 focused tests passed** across role policy, workforce RBAC, roster, provider selection, health and production startup.
- **15 browser checks passed:** Super Admin and Admin login/navigation, roster shortcut, filtered tiles, unconfigured AI state, disabled command submission, aliases, standalone login guidance and simulated Arena-preview hostname. No JavaScript page exceptions were observed in those flows.
- `npm run typecheck`: **passed**.
- `npm run lint`: **passed**.
- `npx next build --webpack`: **passed** with the MySQL Prisma client and a dummy build-only database URL. All 67 static pages generated. This was a compilation/static-generation check, **not** a production migration or deployment; no real MySQL was available. The full `npm run build` migration step was not run.
- `npm test`: **1,050 passed, 8 failing test entries** (the runner also counts failed parent suites). Four underlying assertions concern existing communication copy/policy and were reproduced on the unchanged baseline. Three database suites require the normal MySQL Prisma client/database and cannot initialize against the adapter-only preview client. These are not represented as a clean full-suite result.
- `npm run verify:ai` was also attempted. Its existing database-double harness crashes on `db.$transaction`; the unchanged baseline reproduces the crash. No live AI success is claimed.

## Local preview

The live preview uses fictional data only. Open `/admin` or `/#/admin`:

| Role | Demo email | Demo password |
|---|---|---|
| Super Admin | `admin@tech360.local` | `Tech360-Demo-2026!` |
| Admin | `operations@tech360.local` | `Tech360-Demo-2026!` |

These are public demo credentials, not production credentials. SQLite preview mode refuses production use.

## Remaining activation step

A Super Admin/operator must configure **one** supported provider in the hosting environment, restart the application and run a read-only agent task:

1. `AI_GATEWAY_BASE_URL` + `AGENTOS_GATEWAY_TOKEN`; or
2. `OPENROUTER_API_KEY` (optionally `OPENROUTER_MODELS`); or
3. `ZAI_BASE_URL` + `ZAI_API_KEY`.

Never put these values in browser code or prefix them with `NEXT_PUBLIC_`. Do not send passwords or API keys in chat. The separate private local-model service is not automatically the workforce execution provider.

**Production status:** the code repairs are saved on the session branch. Live hosting configuration, provider credentials, real inference, production RBAC and deployment remain **not verified**.
