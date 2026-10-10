# TECH360 LLC — Enterprise Platform

**bdtech360.com · Websites · Web applications · Custom CRM · Client portals · Business dashboards · eCommerce · WhatsApp automation · n8n automation · AI agent systems · Business automation · Industry software · Maintenance & support**

Stack: **Next.js 16 (App Router) · Node.js 22.x · npm · TypeScript 5 · Tailwind CSS 4 · shadcn/ui · Prisma + MySQL · z-ai-web-dev-sdk (server-side AI)**

One codebase, three surfaces:

| Surface | Entry | What it does |
|---|---|---|
| **Public website** | `/` (hash routes `#/services`, `#/industries`, `#/work`, `#/blog`, …) | Marketing site, blog, case studies, contact intake → real lead in the CRM |
| **Client portal** | `/#/portal` (Client ID + email/WhatsApp) | Projects, milestones, meetings, files, previews, approvals, payments, invoices, handover |
| **Super Admin console** | `/#/admin` (role-based login) | CRM, projects, payments, invoices (official pad documents), 44-agent AI workforce, NL Command Center, **AI Software Factory**, **Media Studio**, **Feed Hub**, **Calls & SMS**, engagement-tracked newsletter (open pixel + click redirect, honest zeros until real sends), knowledge base with real PDF/DOCX/CSV/TXT upload + extraction, curated image-prompt library, governance switches, ops loop monitor, analytics, logs |
| **Design kit** | `/#/design-kit` | The live design system: buttons, accessibly-labelled sequence/funnel/swimlane diagrams, infographics, interface mockups and tokens — the same components the site and generated client apps use |

The official **company letterhead** (owner-provided pad + logo) drives every document the platform issues — SOW previews, tax invoices, the handover & acceptance certificate, printed legal policies (`src/lib/letterhead.ts`, see `OFFICIAL-DOCUMENTS.md`).

---

## 1. Local setup

The application uses **Node.js 22.x, npm, and MySQL**. Use a disposable/development MySQL database here—never point local commands at production.

```bash
npm ci --no-audit --no-fund
cp .env.example .env            # set DATABASE_URL to your development MySQL database
npx prisma generate
npx prisma migrate deploy       # applies reviewed migrations to the development database
npm run db:seed                 # first boot: super admin + departments + agents + templates
npm run dev
```

Set `ADMIN_EMAIL` and `ADMIN_PASSWORD` in the local environment before seeding. Production seeding refuses to run without a sufficiently strong `ADMIN_PASSWORD`; see `docs/HOSTINGER_DEPLOYMENT.md`.

Optional sidecars are separate Bun services, not part of the Hostinger Next.js Web App. In production, an explicitly configured scheduler may call `/api/ops/cycle`; the notification relay is optional and must be separately deployed/configured. Neither is required for the main web application:

```bash
cd mini-services/ai-ops       && bun install && bun run dev   # :3031 triggers the ops loop every 90s
cd mini-services/notify-relay && bun install && bun run dev   # :3032 socket.io realtime notifications
```

## 2. Environment variables

`.env.example` documents **every** variable (core, secrets, payment gateways, comms channels, social, n8n, Cloud). Rules:

- **Never commit `.env`.** The repo ships `.env.example` with placeholders only.
- The **honest channel principle**: an empty credential ⇒ the platform reports `NOT_CONFIGURED` (or `CONFIGURATION REQUIRED` for payment gateways) and **refuses** to send/settle through it — it never fakes success.
- `SESSION_SECRET`, `OPS_SECRET`, `PORTAL_SECRET`, `NOTIFY_RELAY_TOKEN` must be long random values in production.

## 3. Database

- Prisma with MySQL (`prisma/schema.prisma`).
- Production migrations use `npx prisma migrate deploy`; destructive reset and data-loss schema pushes are not production commands.
- The seed is idempotent-safe for first boot and requires a production `ADMIN_PASSWORD`.

## 4. Build · test · verify

```bash
npm ci
npm run lint
npm run typecheck
npm test
npm run build
npm start
```

GitHub Actions validates the same npm/Node.js 22 path against disposable MySQL.

## 5. Production deployment ownership

GitHub Actions validates the repository; it does not deploy production. When a Hostinger **Node.js Web App** is connected to the repository's `main` branch, Hostinger's Git integration can rebuild on pushes. The current Hostinger connection, app configuration, and live runtime still require independent verification; see `docs/HOSTINGER_DEPLOYMENT.md`.

```text
Pull Request → GitHub Actions CI (Node.js 22 + npm + disposable MySQL)
  → merge to main → Hostinger Node.js Web App Git integration (when configured)
  → Hostinger-managed npm install → hPanel build script `build` (npm run build)
  → required runtime command `npm start` runs the preflight then standalone server (Hostinger invocation **NOT VERIFIED**)
```

The required repository start command is `npm start`; npm runs `prestart` to validate production environment configuration before launching `.next/standalone/server.js`. Hostinger's documented Next.js preset ignores a custom entry-file field and manages its server start, so whether hPanel invokes the npm lifecycle (and therefore this preflight) is **NOT VERIFIED**. Confirm/configure that behavior before deployment.

There is no production SSH, VPS, PM2, rsync, scp, Google Cloud Run/Build, or manual server-copy path. The legacy Cloud Run deploy/backup helpers, Cloud Build file, and Dockerfile now fail fast or contain only a retirement notice; `scripts/deploy-hostinger.sh` is also a fail-fast retirement notice.

Hostinger settings and environment requirements are documented in `docs/HOSTINGER_DEPLOYMENT.md`, `docs/HOSTINGER_DEPLOYMENT_MATRIX.md`, and `docs/HOSTINGER_ENVIRONMENT_VARIABLES.md`.

## 6. Payments & governance

- **Super Admin → Settings → Feature Management**: 13 switches that change *real backend behavior* (portal sessions, payments, invoices, blog, contact intake, comms channels, AI agents, n8n, maintenance mode).
- **Super Admin → Settings → Payment Gateways**: per-gateway ON/OFF + sandbox/production. Disabled gateways are rejected server-side and never printed as accepted on invoices.
- Stripe: real REST checkout + HMAC-verified webhook (see `PAYMENT.md`).

## 7. Repository contents

- `src/` — the complete application (public site, admin console, client portal, ~45 API route groups, AI agent engine, journey/CRM engine, ops loop, letterhead engine, security libs).
- `prisma/` — the MySQL Prisma schema, reviewed migration baseline, and seed. Any local `db/` data is ignored and is not production storage.
- `public/` — brand assets (owner's original logo + company pad designs in `public/brand/`).
- `mini-services/` — ai-ops (:3031) + notify-relay (:3032).
- `deployment/` — legacy Google Cloud Run/Docker templates and scheduler samples. They are not part of Tech360's supported production path; the current production target is the Hostinger Node.js Web App documented above.
- `src/lib/factory/blueprint.ts` — the AI Software Factory engine: brief → blueprint → real Next.js/Prisma source tree → ZIP delivery package (see `docs/AI_SOFTWARE_FACTORY.md`).
- `src/lib/media/studio.ts`, `src/lib/feeds/parse.ts`, `src/lib/telephony.ts` — Media Studio planning + captions, hardened RSS/Atom/JSON parsing, and the honest call/SMS adapters.
- `scripts/verify-reference-links.mjs` — checks every owner-supplied reference against the live network and writes `docs/REFERENCE_VERIFICATION_MATRIX.md`.
- `n8n/` — 26 workflow definitions (W26 = free lead enrichment, regenerate with `node deployment/generate-n8n-lead-enrichment.cjs`).
- `scripts/`, `.github/` — CI/CD + deployment.
- `worklog.md` — the complete build/iteration log (honest QA state, every round).
- `OFFICIAL-DOCUMENTS.md`, `DEPLOYMENT.md`, `SECURITY.md`, `PAYMENT.md`.

## 8. Security notes

- `.env` never committed; secret scan runs in CI and locally (`rg` patterns in the workflow).
- Session auth (HttpOnly cookies) + CSRF double-submit on every admin mutation + RBAC (Super Admin / Admin / Manager / Sales / Developer / Support / Marketing / Client).
- Payment settlement only ever happens server-side (verified webhook or admin verification) — never on browser success URLs.
- See `SECURITY.md`.

## 9. Honest-status philosophy

Every external integration reports its true state (`CONFIGURED` / `NOT_CONFIGURED` / `DISABLED_BY_ADMIN` / `INTEGRATION_NOT_BUILT` / `CONFIGURATION_REQUIRED`) and refuses to act otherwise. The platform never fakes a sent message, a settled payment, or a connected workflow.
