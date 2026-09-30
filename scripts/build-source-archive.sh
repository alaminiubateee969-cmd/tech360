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
# Archive README (informational header written into the zip listing) —
# the repo README.md itself is included AS-IS (full local-setup + CI/CD docs)
cat > /tmp/tech360-archive-README.md <<EOF
# TECH360 LLC — Enterprise Platform · Full Source Archive

Generated: ${STAMP}
See README.md (included) for full setup, environment, deployment, rollback docs.
This archive = every project file: src, prisma, db, public, mini-services,
deployment, n8n, scripts (Hostinger deploy + health-check + archive builder),
.github/workflows (CI/CD), examples, tests, .zscripts, agent-ctx, upload,
DEPLOYMENT.md, SECURITY.md, PAYMENT.md, OFFICIAL-DOCUMENTS.md, worklog.md,
.env.example (placeholders only — the real .env is NEVER in the archive).
EOF

# Do NOT clobber the repo README — it is the source of truth for setup/CI/CD.
# (Previously this script overwrote README.md; the repo README is now included as-is.)

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
  scripts .github \
  package.json tsconfig.json next.config.ts eslint.config.mjs tailwind.config.ts \
  postcss.config.mjs components.json Caddyfile bun.lock .gitignore \
  .env.example README.md OFFICIAL-DOCUMENTS.md COVERAGE-AUDIT.md DEPLOYMENT.md SECURITY.md PAYMENT.md worklog.md \
  -x "upload/extract/*" "mini-services/*/node_modules/*" "*.log" "db/*.journal" ".DS_Store" ".zscripts/*.png" "tool-results/*"

FILES=$(unzip -l "$OUT" | tail -1 | awk '{print $2}')
SIZE=$(du -h "$OUT" | cut -f1)
echo "{\"file\":\"downloads/tech360-platform-full-source.zip\",\"files\":$FILES,\"size\":\"$SIZE\",\"generated\":\"$STAMP\"}" > "$OUT_DIR/archive-meta.json"
echo "Archive built: $OUT ($FILES files, $SIZE)"
