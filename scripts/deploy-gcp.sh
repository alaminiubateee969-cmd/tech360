#!/bin/bash
set -euo pipefail
PROJECT_ID=${PROJECT_ID:-tech360-production}
REGION=${REGION:-asia-southeast1}
SERVICE=tech360
IMAGE="gcr.io/$PROJECT_ID/$SERVICE:latest"

echo "=== Tech360 Google Cloud Deployment ==="
echo "Project: $PROJECT_ID"
echo "Region: $REGION"
echo "Service: $SERVICE"

# Build and push
gcloud builds submit --config cloudbuild.yaml .

# Deploy to Cloud Run
gcloud run deploy $SERVICE \
  --image "$IMAGE" \
  --region "$REGION" \
  --platform managed \
  --port 3000 \
  --allow-unauthenticated \
  --memory 2Gi \
  --cpu 2 \
  --min-instances 1 \
  --max-instances 10

# Map custom domain
echo "=== Setting up custom domain bdtech360.com ==="
gcloud run domain-maps create $SERVICE --domain bdtech360.com --region $REGION 2>/dev/null || true

echo "=== Deployment complete ==="
echo "Service URL: https://$SERVICE-dot-$PROJECT_ID.$REGION.run.app"
echo "Custom domain: https://bdtech360.com (may take 15-30 min for DNS to propagate)"
