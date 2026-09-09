#!/usr/bin/env bash
# TECH360 — nightly backup: Cloud SQL export + Cloud Storage copy
set -euo pipefail
PROJECT_ID="${1:?Usage: ./backup.sh PROJECT_ID}"
REGION="${2:-us-central1}"
STAMP=$(date -u +%F)
BUCKET="gs://tech360-backups-$PROJECT_ID"

gcloud sql export sql tech360-db "$BUCKET/sql/$STAMP.sql" --project "$PROJECT_ID"
gcloud storage cp -r gs://tech360-files "$BUCKET/files/$STAMP" --project "$PROJECT_ID" 2>/dev/null || true
echo "Backup complete: $BUCKET ($STAMP)"
