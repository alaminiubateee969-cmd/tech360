#!/usr/bin/env bash
# ------------------------------------------------------------
# TECH360 LLC — Full project source archive builder
# Packages EVERY project file (code, schema, db, assets,
# deployment, automation, docs) into a single zip served at
# /downloads/tech360-platform-full-source.zip
# Excludes only: build artifacts, caches, logs, node_modules,
# and the real .env (secrets) — a safe .env.example is included.
# ------------------------------------------------------------
set -euo pipefail
cd "$(dirname "$0")/.."

OUT_DIR="public/downloads"
OUT="$OUT_DIR/tech360-platform-full-source.zip"
STAMP="$(date -u +%Y-%m-%dT%H:%M:%SZ)"

mkdir -p "$OUT_DIR"
rm -f "$OUT"

# Archive README lives at archive root
cat > /tmp/tech360-archive-README.md <<EOF
# TECH360 LLC — Enterprise Platform · Full Source Archive

Generated: ${STAMP}
Stack: Next.js 16 (App Router) · TypeScript 5 · Tailwind CSS 4 · shadcn/ui · Prisma + SQLite · z-ai-web-dev-sdk (server-side AI)

## What is inside (every project file)

- \`src/\` — the complete application: public website (single-route SPA, hash navigation), admin command center, client portal, ~40 API route groups, AI agent engine (44 agents), journey/CRM engine, ops loop, letterhead engine, security libs.
- \`prisma/\` — full database schema (38 models).
- \`db/\` — the SQLite database file with the live data.
- \`public/\` — all brand assets (including the owner-shared logo + company pad designs in \`public/brand/\`), site images, hero video.
- \`mini-services/\` — ai-ops (autonomous loop trigger, port 3031) and notify-relay (socket.io ping relay, port 3032). Install with \`bun install\` inside each.
- \`deployment/\` — Google Cloud Run deploy script, Cloud Scheduler setup, cloudbuild.yaml, scheduler docs.
- \`n8n/\` — 25 workflow definitions.
- \`examples/\` — websocket reference used by the relay.
- \`tests/\`, \`.zscripts/\`, \`agent-ctx/\` — sandbox tooling/scripts used during the build.
- \`upload/\` — the owner's original shared files (brand/logo/pad sources and build directives).
- Root configs: package.json, tsconfig.json, next.config.ts, eslint.config.mjs, tailwind.config.ts, postcss.config.mjs, components.json, Caddyfile, bun.lock, .env.example.
- \`worklog.md\` — the complete build/iteration log (9 autonomous rounds, honest QA state).
- \`OFFICIAL-DOCUMENTS.md\` — where the company pad is used.

## Run it

\`\`\`bash
bun install
bun run db:push        # (re)create/align the SQLite schema
cp .env.example .env   # fill secrets (see comments inside)
bun run dev            # http://localhost:3000
\`\`\`

Mini services (optional but recommended — they drive the autonomous ops loop + real-time notifications):

\`\`\`bash
cd mini-services/ai-ops && bun install && bun run dev      # port 3031
cd mini-services/notify-relay && bun install && bun run dev # port 3032
\`\`\`

Admin console: \`/#/admin\` (super admin). Client portal: \`/#/portal\`.

## Security notes

- The real \`.env\` is intentionally NOT in this archive — only \`.env.example\`.
- External channels (WhatsApp/SMTP/SMS/social) report NOT_CONFIGURED until credentials are provided; the platform never fakes a SENT status.
- Source delivery to CLIENTS remains gated by the two payment gates inside the platform itself. This archive is the OWNER's master copy.
EOF

cp /tmp/tech360-archive-README.md README.md

# Document where the official company pad is used
cat > OFFICIAL-DOCUMENTS.md <<'EOF'
# Official documents that print on the TECH360 company pad

The company pad (owner-shared letterhead design, preserved in `public/brand/`)
is applied by `src/lib/letterhead.ts` — the single letterhead engine:

1. **SOW / Project Preview** (client-facing, pre-payment gate) — `/api/preview/[token]`
   Logo + TECH360 wordmark + CONNECT·INNOVATE·GROW tagline + Web|Cloud|AI|Data|Tech
   services line, document meta bar (client ref / version / issued / status),
   faint TECH360 watermark, signature blocks, labeled footer
   (Address · Phone · Website · Email).
2. **Official Invoice** (admin) — `/api/admin/invoices/[number]`
   Full tax invoice on the pad: bill-to block, totals with paid-to-date balance,
   line item, payment instructions. Linked from Payments → Invoices rows.
3. **Handover & Acceptance Certificate** (client-facing) — `/api/handover/[token]/download?format=html`
   Release record + payment verification + client responsibilities + signatures.
4. **Legal policies** (public, print) — every `#/legal/*` page prints with the
   pad letterhead (logo, legal identity, brand rule) via print-only blocks.
EOF

zip -r -q "$OUT" \
  src prisma db public deployment n8n examples tests .zscripts agent-ctx upload mini-services \
  package.json tsconfig.json next.config.ts eslint.config.mjs tailwind.config.ts \
  postcss.config.mjs components.json Caddyfile bun.lock .gitignore \
  .env.example README.md OFFICIAL-DOCUMENTS.md worklog.md \
  -x "upload/extract/*" "mini-services/*/node_modules/*" "*.log" "db/*.journal" ".DS_Store"

FILES=$(unzip -l "$OUT" | tail -1 | awk '{print $2}')
SIZE=$(du -h "$OUT" | cut -f1)
echo "{\"file\":\"downloads/tech360-platform-full-source.zip\",\"files\":$FILES,\"size\":\"$SIZE\",\"generated\":\"$STAMP\"}" > "$OUT_DIR/archive-meta.json"
echo "Archive built: $OUT ($FILES files, $SIZE)"
