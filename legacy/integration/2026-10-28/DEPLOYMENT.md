# BDTECH360 — Deployment Guide

## Prerequisites
- Node.js 20+
- MySQL 8+ (production) or SQLite (sandbox)
- Redis 7+ (optional, in-memory fallback available)
- n8n (for automation workflows)

## 1. Configure Environment
```bash
cp .env.example .env
# Edit .env with your real values
```

## 2. Switch to MySQL (production)
```bash
bash scripts/switch-to-mysql.sh
# This changes prisma/schema.prisma from sqlite to mysql
```

## 3. Setup Database
```bash
# Create MySQL database
mysql -u root -p -e "CREATE DATABASE db_bdtech; CREATE USER 'user_bdtech'@'127.0.0.1' IDENTIFIED BY 'YOUR_PASSWORD'; GRANT ALL ON db_bdtech.* TO 'user_bdtech'@'127.0.0.1';"

# Push schema
npx prisma db push --accept-data-loss

# Seed data
npx tsx prisma/seed.ts
npx tsx scripts/generate_ai_workforce.ts
npx tsx scripts/generate_phase7.ts
npx tsx scripts/seed_content.ts
```

## 4. Build
```bash
npm run build
```

## 5. Start Production Server (Port 3021)
```bash
NODE_ENV=production PORT=3021 npm run start
```

## 6. Google Cloud Deployment
```bash
# Set up secrets
bash scripts/setup-secrets.sh

# Deploy to Cloud Run
bash scripts/deploy-gcp.sh
```

## 7. Import n8n Workflows
```bash
n8n import --input=n8n/01-lead-intake.json
# Repeat for all 12 workflows
```

## 8. Configure Webhooks
- WhatsApp: https://bdtech360.com/api/webhooks/whatsapp
- Facebook: https://bdtech360.com/api/webhooks/facebook
- Instagram: https://bdtech360.com/api/webhooks/instagram

## 9. Verify
```bash
bash scripts/test-e2e.sh
```
