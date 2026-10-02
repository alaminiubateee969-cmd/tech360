#!/usr/bin/env bash
# TECH360 — retired deployment helper
#
# Production deployment is GitHub -> Hostinger Node.js Web App. This file is
# intentionally non-operational: it previously attempted SSH/PM2 deployment,
# which is not part of the supported Hostinger runtime and could create a
# second deployment path. Configure the Hostinger app in hPanel instead.
set -euo pipefail

cat >&2 <<'EOF'
ERROR: scripts/deploy-hostinger.sh is retired.
Configure the Hostinger Node.js Web App Git integration in hPanel:
  framework: Next.js (app type `next`)
  runtime:   Node.js 22.x; package manager: npm / package-lock.json
  build:     script `build` (npm run build)
  output:    .next; Hostinger's Next.js preset starts its bundled server
  entry:     leave empty (ignored for Next.js); verify runtime logs/port
Do not deploy this application through SSH, PM2, rsync, scp, or a VPS.
EOF
exit 1
