# Google Cloud Deployment Readiness Architecture (Non-Automatic Reference Blueprint)

> **CRITICAL PRODUCTION PROTECTION RULE**
> The active production environment for `https://bdtech360.com` runs on Hostinger Node.js Web App infrastructure (`scripts/start-production.mjs` + `scripts/validate-production-env.mjs`).
> Legacy files under `deployment/` (`deployment/Dockerfile`, `deployment/cloudbuild.yaml`, `deployment/deploy.sh`, `deployment/backup.sh`) intentionally fail-closed (verified by `tests/retired-deployment-paths.mjs`) to prevent an unauthorized automatic migration away from Hostinger.
> Any cutover to Google Cloud Run requires explicit Super Admin authorization, database migration validation, DNS cutover window, and rollback verification.

---

## 1. Target Google Cloud Architecture

| Component | GCP Service | Purpose |
|---|---|---|
| Application Compute | **Cloud Run** (`tech360-web`) | Stateless Next.js 16 standalone container (`0.0.0.0:8080`, min-instances: 1, max-instances: 20) |
| Relational Database | **Cloud SQL for MySQL 8.0** | Primary relational datastore (`243` native MySQL type annotations in `prisma/schema.prisma`, HA regional instance, automated daily point-in-time recovery) |
| Secrets Management | **Google Secret Manager** | Stores `DATABASE_URL`, `SESSION_SECRET`, `PORTAL_SECRET`, `OPS_SECRET`, `IDENTITY_HASH_SECRET`, `OPENAI_API_KEY`, `GEMINI_API_KEY`, `GROQ_API_KEY`, `OPENROUTER_API_KEY`, `N8N_WEBHOOK_SECRET`, `WHATSAPP_ACCESS_TOKEN`, `SMTP_PASS` |
| Object Storage | **Cloud Storage (GCS)** | Private bucket (`tech360-private-artifacts`) for malware-scanned client uploads, generated PDFs, and source-code handover archives |
| Container Registry | **Artifact Registry** | Regional Docker repository (`us-central1-docker.pkg.dev/<PROJECT_ID>/tech360/web`) |
| CI/CD Pipeline | **Cloud Build** | Runs `npm run schema:check`, `npm run migrations:check`, `npm run lint`, `npm run typecheck`, `npm run test:offline`, `npm run verify:ai`, and builds the standalone image |
| Scheduled Jobs | **Cloud Scheduler** | Triggers `/api/ops/heartbeat` (every 5m), `/api/ops/cycle` (every 15m), and `/api/ops/scan` (hourly) using `x-ops-secret` from Secret Manager |
| Observability | **Cloud Logging & Cloud Monitoring** | Structured JSON audit/error logs (`AuditLog`, `ErrorLog`) and uptime probes against `/api/health` and `/api/ready` |

---

## 2. Reference Multi-Stage Container Specification (For Authorized Staging/Cutover Only)

```dockerfile
FROM node:22-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json ./
COPY prisma ./prisma/
COPY scripts ./scripts/
RUN npm ci --no-audit --no-fund
COPY . .
RUN npx prisma generate && npm run build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=8080
ENV HOSTNAME=0.0.0.0
COPY --from=builder /app/package.json /app/package-lock.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/scripts ./scripts
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- http://127.0.0.1:8080/api/health || exit 1
CMD ["npm", "run", "start"]
```

---

## 3. Backup, Cutover & Rollback Procedure

1. **Pre-Cutover Backup**:
   - Execute logical MySQL dump (`mysqldump --single-transaction --routines --triggers`) and verify checksum before applying any forward-only migration (`npx prisma migrate deploy`).
2. **Health & Readiness Gate**:
   - Verify `GET /api/health` and `GET /api/ready` return HTTP 200 and confirm database, Prisma, and AI provider configuration states (`HEALTHY` / `CONFIGURED` / `NOT_CONFIGURED`).
3. **Instant Rollback**:
   - **Cloud Run**: `gcloud run services update-traffic tech360-web --to-revisions=<PREVIOUS_REVISION>=100 --region=us-central1`
   - **Hostinger**: `git revert <COMMIT_SHA> && npm ci --no-audit --no-fund && npm run build`
