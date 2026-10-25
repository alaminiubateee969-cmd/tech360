#!/usr/bin/env bash
# One-shot production deploy for Tech360 on bdtech360.com.
# Run as the deploy user (e.g. aloedu) from the project root.
set -euo pipefail
cd "$(dirname "$0")/.."

echo "==> [1/7] Pulling latest code"
git pull --ff-only

echo "==> [2/7] Installing dependencies"
bun install --frozen-lockfile

echo "==> [3/7] Switching Prisma provider to MySQL"
if rg -q 'provider = "sqlite"' prisma/schema.prisma; then
  ./scripts/switch-to-mysql.sh
fi

echo "==> [4/7] Pushing schema to MySQL"
bun run db:push

echo "==> [5/7] Seeding (idempotent)"
bunx tsx prisma/seed.ts || true
bunx tsx scripts/seed_rag.ts || true

echo "==> [6/7] Building Next.js standalone"
bun run build

echo "==> [7/7] Restarting services"
sudo systemctl restart tech360.service
sudo systemctl restart tech360-worker.service

echo "Deploy complete. Health check:"
sleep 3
curl -fsS "http://127.0.0.1:${PORT:-3021}/api/ai-workforce/stats" | head -c 200
echo
