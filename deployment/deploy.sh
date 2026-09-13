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

# 1b) ops secret for the autonomous loop (scheduler → /api/ops/cycle)
OPS_SECRET_VALUE="$(gcloud secrets versions access latest --secret=tech360-ops-secret 2>/dev/null || true)"
if [ -z "$OPS_SECRET_VALUE" ] || [ "$OPS_SECRET_VALUE" = "placeholder" ]; then
  echo "!! Generating + storing tech360-ops-secret (scheduler auth for the AI operations loop)"
  openssl rand -hex 24 | gcloud secrets create tech360-ops-secret --data-file=- 2>/dev/null || {
    echo "   (secret exists — update it manually if needed)"
  }
fi

# 2) build + push
gcloud builds submit --config deployment/cloudbuild.yaml --project "$PROJECT_ID"

# 3) domain mapping (bdtech360.com)
gcloud run domain-mappings create --service "$SVC" --domain bdtech360.com --region "$REGION" 2>/dev/null || true

# 4) Cloud Scheduler job — the production autonomy trigger.
#    POSTs https://bdtech360.com/api/ops/cycle every minute with the ops secret;
#    the endpoint throttles to one real cycle per 45s, so minute scheduling is safe.
OPS_SECRET_VALUE="$(gcloud secrets versions access latest --secret=tech360-ops-secret 2>/dev/null || echo placeholder)"
gcloud scheduler jobs create http tech360-ai-ops-cycle \
  --location "$REGION" \
  --schedule "* * * * *" \
  --uri "https://bdtech360.com/api/ops/cycle" \
  --http-method POST \
  --headers "x-ops-secret=$OPS_SECRET_VALUE" \
  --time-zone "Asia/Dhaka" \
  --attempt-deadline 300s 2>/dev/null || {
  echo "   scheduler job exists — updating it instead"
  gcloud scheduler jobs update http tech360-ai-ops-cycle \
    --location "$REGION" \
    --schedule "* * * * *" \
    --uri "https://bdtech360.com/api/ops/cycle" \
    --http-method POST \
    --headers "x-ops-secret=$OPS_SECRET_VALUE" \
    --time-zone "Asia/Dhaka" \
    --attempt-deadline 300s
}

echo "==> Done. Health check:"
echo "   https://bdtech360.com/api/health"
echo "==> Autonomy check (should return cycle state, not Unauthorized):"
echo "   curl -s https://bdtech360.com/api/ops/cycle -H \"x-ops-secret: <OPS_SECRET>\""
