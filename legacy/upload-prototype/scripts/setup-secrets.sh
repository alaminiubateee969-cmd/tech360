#!/bin/bash
set -euo pipefail
echo "=== Creating Google Secret Manager secrets for Tech360 ==="

create_secret() {
  local name=$1
  local value=$2
  gcloud secrets create "$name" --replication-policy="automatic" 2>/dev/null || true
  echo -n "$value" | gcloud secrets add-version "$name" --data-file=-
  echo "  ✓ $name"
}

create_secret "tech360-db-url" "mysql://USER:PASSWORD@127.0.0.1:3306/tech360_db"
create_secret "tech360-nextauth-secret" "CHANGE-ME-32-CHARS-RANDOM"
create_secret "tech360-jwt-secret" "CHANGE-ME-32-CHARS-RANDOM"
create_secret "tech360-openai-key" "sk-your-openai-key"
create_secret "tech360-resend-key" "re-your-resend-key"
create_secret "tech360-whatsapp-token" "your-whatsapp-access-token"
create_secret "tech360-whatsapp-phone" "your-phone-number-id"
create_secret "tech360-whatsapp-verify" "your-webhook-verify-token"
create_secret "tech360-redis-url" "redis://10.0.0.3:6379"

echo "=== All secrets created. Grant Cloud Run service account access: ==="
SVC_ACCOUNT=$(gcloud run services describe tech360 --region asia-southeast1 --format 'value(spec.template.spec.serviceAccountName)' 2>/dev/null || echo "")
if [ -n "$SVC_ACCOUNT" ]; then
  for secret in tech360-db-url tech360-nextauth-secret tech360-jwt-secret tech360-openai-key tech360-resend-key tech360-whatsapp-token tech360-whatsapp-phone tech360-whatsapp-verify tech360-redis-url; do
    gcloud secrets add-iam-policy-binding "$secret" --member "serviceAccount:$SVC_ACCOUNT" --role roles/secretmanager.secretAccessor 2>/dev/null || true
  done
  echo "  ✓ Granted access to $SVC_ACCOUNT"
fi
