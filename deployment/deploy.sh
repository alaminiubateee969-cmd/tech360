#!/usr/bin/env bash
# RETIRED: this repository has one supported production path — Hostinger's
# Node.js Web App Git integration. This script previously provisioned Cloud Run,
# created placeholder secrets, configured domain mappings, and scheduled jobs.
# Running it could deploy a second app against the production domain.
set -euo pipefail

cat >&2 <<'EOF'
ERROR: deployment/deploy.sh is retired and cannot deploy Tech360.

Do not use Google Cloud Run, Cloud Build, gcloud secrets, Cloud Scheduler,
SSH, PM2, rsync, or manual file-copy deployment for bdtech360.com.
Configure/review the Hostinger Node.js Web App using docs/HOSTINGER_DEPLOYMENT.md.
Hostinger settings, production database state, and live runtime remain NOT VERIFIED.
EOF
exit 1
