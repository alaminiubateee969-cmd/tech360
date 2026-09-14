# TECH360 LLC — Enterprise Platform · Full Source Archive

Generated: 2026-09-14T08:34:57Z
Stack: Next.js 16 (App Router) · TypeScript 5 · Tailwind CSS 4 · shadcn/ui · Prisma + SQLite · z-ai-web-dev-sdk (server-side AI)

## What is inside (every project file)

- `src/` — the complete application: public website (single-route SPA, hash navigation), admin command center, client portal, ~40 API route groups, AI agent engine (44 agents), journey/CRM engine, ops loop, letterhead engine, security libs.
- `prisma/` — full database schema (38 models).
- `db/` — the SQLite database file with the live data.
- `public/` — all brand assets (including the owner-shared logo + company pad designs in `public/brand/`), site images, hero video.
- `mini-services/` — ai-ops (autonomous loop trigger, port 3031) and notify-relay (socket.io ping relay, port 3032). Install with `bun install` inside each.
- `deployment/` — Google Cloud Run deploy script, Cloud Scheduler setup, cloudbuild.yaml, scheduler docs.
- `n8n/` — 25 workflow definitions.
- `examples/` — websocket reference used by the relay.
- `tests/`, `.zscripts/`, `agent-ctx/` — sandbox tooling/scripts used during the build.
- `upload/` — the owner's original shared files (brand/logo/pad sources and build directives).
- Root configs: package.json, tsconfig.json, next.config.ts, eslint.config.mjs, tailwind.config.ts, postcss.config.mjs, components.json, Caddyfile, bun.lock, .env.example.
- `worklog.md` — the complete build/iteration log (9 autonomous rounds, honest QA state).
- `OFFICIAL-DOCUMENTS.md` — where the company pad is used.

## Run it

```bash
bun install
bun run db:push        # (re)create/align the SQLite schema
cp .env.example .env   # fill secrets (see comments inside)
bun run dev            # http://localhost:3000
```

Mini services (optional but recommended — they drive the autonomous ops loop + real-time notifications):

```bash
cd mini-services/ai-ops && bun install && bun run dev      # port 3031
cd mini-services/notify-relay && bun install && bun run dev # port 3032
```

Admin console: `/#/admin` (super admin). Client portal: `/#/portal`.

## Security notes

- The real `.env` is intentionally NOT in this archive — only `.env.example`.
- External channels (WhatsApp/SMTP/SMS/social) report NOT_CONFIGURED until credentials are provided; the platform never fakes a SENT status.
- Source delivery to CLIENTS remains gated by the two payment gates inside the platform itself. This archive is the OWNER's master copy.
