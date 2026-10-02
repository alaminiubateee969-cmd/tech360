#!/usr/bin/env bash
# ------------------------------------------------------------
# TECH360 LLC — project source archive builder
# Defaults to the git-ignored archives/ folder and refuses the repository's
# public/ web root. Local databases, owner uploads, env files/secrets, dependencies
# installs, build output, caches and logs are deliberately excluded.
# ------------------------------------------------------------
set -Eeuo pipefail

ROOT="$(git rev-parse --show-toplevel)"
cd "$ROOT"

OUT_DIR="${ARCHIVE_OUT_DIR:-archives}"
mkdir -p "$OUT_DIR"
OUT_DIR="$(cd "$OUT_DIR" && pwd -P)"
PUBLIC_DIR="$(cd "$ROOT/public" && pwd -P)"
if [[ "$OUT_DIR" == "$PUBLIC_DIR" || "$OUT_DIR" == "$PUBLIC_DIR/"* ]]; then
  echo "ERROR: refusing to write a source archive under the web-served public/ directory" >&2
  exit 2
fi

OUT="$OUT_DIR/tech360-platform-full-source.zip"
STAMP="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT
ZIP_TMP="$TMP_DIR/tech360-platform-full-source.zip"

cat > "$TMP_DIR/ARCHIVE-README.md" <<'EOF'
# TECH360 source archive

This is a source snapshot, not a deployment mechanism. The documented
Hostinger target is a Node.js Web App using the Next.js `next` preset, Node.js
22.x, npm, build script `build` (`npm run build`), and output `.next`.
Hostinger's preset starts its bundled standalone server; repository `npm run
start` is for CI/manual smoke tests only. Verify the actual hPanel/runtime
configuration and review production database migration/backup prerequisites.

The archive contains source, the MySQL Prisma schema/migrations, npm lockfile,
public assets, workflows, tests, and project docs. It excludes local databases,
owner uploads, environment files (including .env.example), node_modules, build
output, caches, and logs. Inspect before distribution; never place it under
public/ or another web-served directory.
EOF

zip -r -q "$ZIP_TMP" \
  src prisma public deployment docs n8n examples tests .zscripts agent-ctx mini-services \
  scripts .github \
  package.json package-lock.json prisma.config.ts tsconfig.json next.config.ts \
  eslint.config.mjs tailwind.config.ts postcss.config.mjs components.json Caddyfile \
  bun.lock .gitignore README.md OFFICIAL-DOCUMENTS.md COVERAGE-AUDIT.md \
  DEPLOYMENT.md SECURITY.md PAYMENT.md MASTER_PROJECT_AUDIT.md REQUIREMENTS_REGISTER.md \
  TEST_AND_QA_REPORT.md KNOWN_ISSUES_AND_BLOCKERS.md worklog.md \
  -x ".env" ".env.*" "*/.env" "*/.env.*" \
  "db/*" "*/db/*" "upload/*" "*/upload/*" \
  "public/downloads/*" "public/uploads/*" \
  "node_modules/*" "*/node_modules/*" ".next/*" "*/.next/*" \
  "archives/*" "*/archives/*" "coverage/*" "dist/*" "build/*" \
  "*.db" "*.sqlite" "*.sqlite3" "*.journal" "*.log" "*.pem" "*.key" \
  ".DS_Store" ".zscripts/*.png" "tool-results/*"

# Add an archive-specific readme without writing to or overwriting a tracked file.
zip -j -q "$ZIP_TMP" "$TMP_DIR/ARCHIVE-README.md"

# Fail closed if an excluded class accidentally entered the archive. Store the
# listing first so grep -q cannot trigger SIGPIPE through a pipefail-enabled pipe.
LISTING="$TMP_DIR/archive-list.txt"
unzip -Z1 "$ZIP_TMP" > "$LISTING"
if grep -Eq '(^|/)\.env($|\.)|(^|/)(db|upload|node_modules|\.next|archives)/|(^|/)public/(downloads|uploads)/|\.(db|sqlite|sqlite3|journal|pem|key)$' "$LISTING"; then
  echo "ERROR: archive contains a path that must be excluded" >&2
  exit 1
fi

for required in \
  ARCHIVE-README.md README.md OFFICIAL-DOCUMENTS.md package.json package-lock.json \
  prisma.config.ts prisma/schema.prisma prisma/migrations/0_init/migration.sql \
  src/app/api/health/route.ts; do
  if ! grep -Fxq "$required" "$LISTING"; then
    echo "ERROR: required source entry missing from archive: $required" >&2
    exit 1
  fi
done

if ! unzip -p "$ZIP_TMP" README.md | cmp -s - "$ROOT/README.md"; then
  echo "ERROR: archived README differs from the repository README" >&2
  exit 1
fi

ENTRIES="$(wc -l < "$LISTING" | tr -d '[:space:]')"
FILES="$(awk 'substr($0, length($0), 1) != "/" { count++ } END { print count + 0 }' "$LISTING")"
SIZE="$(du -h "$ZIP_TMP" | awk '{print $1}')"
# Publish only after the archive has passed its path/content checks.
mv -f "$ZIP_TMP" "$OUT"
printf '{"file":"%s","files":%s,"entries":%s,"size":"%s","generated":"%s"}\n' \
  "$OUT" "$FILES" "$ENTRIES" "$SIZE" "$STAMP" > "$TMP_DIR/archive-meta.json"
mv -f "$TMP_DIR/archive-meta.json" "$OUT_DIR/archive-meta.json"
echo "Archive built: $OUT ($FILES regular files, $ENTRIES total entries, $SIZE)"
