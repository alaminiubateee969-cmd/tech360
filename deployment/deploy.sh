#!/usr/bin/env bash
# TECH360 — Google Cloud deployment helper
# Prereq: gcloud authenticated, project selected, Artifact Registry repo "platform" created.
set -euo pipefail

PROJECT_ID="${1:?Usage: ./deploy.sh PROJECT_ID [REGION]}"
REGION="${2:-us-central1}"
AR="$REGION-docker.pkg.dev/$PROJECT_ID/tech360/platform"
SVC="tech360-platform"

echo "==> Deploying TECH360 to $REGION (project $PROJECT_ID)"

# 1) secrets check (create placeholders if missing — set real values yourself)
for s in tech360-database-url tech360-admin-email tech360-admin-password tech360-n8n-secret; do
  gcloud secrets describe "$s" >/dev/null 2>&1 || {
    echo "!! Secret $s missing. Creating placeholder — set the real value:"
    echo "   gcloud secrets versions add $s --data-file=-"
    echo "placeholder" | gcloud secrets create "$s" --data-file=-
  }
done

# 2) build + push
gcloud builds submit --config deployment/cloudbuild.yaml --project "$PROJECT_ID"

# 3) domain mapping (bdtech360.com)
gcloud run domain-mappings create --service "$SVC" --domain bdtech360.com --region "$REGION" 2>/dev/null || true

echo "==> Done. Health check:"
echo "   https://bdtech360.com/api/health"
