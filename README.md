# TECH360 LLC — Enterprise Platform

**bdtech360.com · Websites · Web applications · Custom CRM · Client portals · Business dashboards · eCommerce · WhatsApp automation · n8n automation · AI agent systems · Business automation · Industry software · Maintenance & support**

Stack: **Next.js 16 (App Router) · TypeScript 5 · Tailwind CSS 4 · shadcn/ui · Prisma + SQLite · z-ai-web-dev-sdk (server-side AI)**

One codebase, three surfaces:

| Surface | Entry | What it does |
|---|---|---|
| **Public website** | `/` (hash routes `#/services`, `#/industries`, `#/work`, `#/blog`, …) | Marketing site, blog, case studies, contact intake → real lead in the CRM |
| **Client portal** | `/#/portal` (Client ID + email/WhatsApp) | Projects, milestones, meetings, files, previews, approvals, payments, invoices, handover |
| **Super Admin console** | `/#/admin` (role-based login) | CRM, projects, payments, invoices (official pad documents), 44-agent AI workforce, NL Command Center, governance switches, ops loop monitor, analytics, logs |

The official **company letterhead** (owner-provided pad + logo) drives every document the platform issues — SOW previews, tax invoices, the handover & acceptance certificate, printed legal policies (`src/lib/letterhead.ts`, see `OFFICIAL-DOCUMENTS.md`).

---

## 1. Local setup

```bash
bun install                     # or: npm ci
cp .env.example .env            # fill secrets (placeholder values only — see the comments inside)
bun run db:push                 # (re)create/align the SQLite schema
bun run db:seed                 # first boot: super admin + 110 departments + 44 agents + templates
bun run dev                     # http://localhost:3000
```

First login: `admin@bdtech360.com` / value of `ADMIN_PASSWORD` (must-change enforced).

Mini services (dev-only drivers; in production Cloud Scheduler replaces ai-ops and the relay runs beside the app):

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
npm run start
```

GitHub Actions validates the same npm/Node.js 22 path against disposable MySQL.

## 5. Production deployment ownership

Hostinger owns the production Node.js Web App, environment variables, filesystem, process lifecycle, HTTPS, domain, logs, and deployment from its configured GitHub integration. GitHub Actions owns CI validation only.

```text
Pull Request → GitHub Actions CI → merge to main
  → Hostinger pulls main → npm ci → npm run hostinger:build → npm run start
```

There is no production SSH, VPS, PM2, rsync, scp, or manual server-copy path. `scripts/deploy-hostinger.sh` is retained only as a fail-fast retirement notice.

Hostinger settings and environment requirements are documented in `docs/HOSTINGER_DEPLOYMENT_MATRIX.md` and `docs/HOSTINGER_ENVIRONMENT_VARIABLES.md`.

## 6. Payments & governance

- **Super Admin → Settings → Feature Management**: 13 switches that change *real backend behavior* (portal sessions, payments, invoices, blog, contact intake, comms channels, AI agents, n8n, maintenance mode).
- **Super Admin → Settings → Payment Gateways**: per-gateway ON/OFF + sandbox/production. Disabled gateways are rejected server-side and never printed as accepted on invoices.
- Stripe: real REST checkout + HMAC-verified webhook (see `PAYMENT.md`).

## 7. Repository contents

- `src/` — the complete application (public site, admin console, client portal, ~45 API route groups, AI agent engine, journey/CRM engine, ops loop, letterhead engine, security libs).
- `prisma/`, `db/` — schema + SQLite data.
- `public/` — brand assets (owner's original logo + company pad designs in `public/brand/`).
- `mini-services/` — ai-ops (:3031) + notify-relay (:3032).
- `deployment/` — Google Cloud Run alternative (cloudbuild, scheduler).
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
