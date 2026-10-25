# Tech360 Platform — Installer Guide

This guide walks you through installing Tech360 from scratch on a fresh Linux server (Ubuntu 22.04 LTS recommended) or Google Cloud Run.

> **TL;DR** for Google Cloud deployments: skip to [DEPLOYMENT.md](./DEPLOYMENT.md). This guide is for self-hosted or local-development installs.

---

## 1. Prerequisites

| Component | Version | Notes |
|-----------|---------|-------|
| Node.js | 20.x LTS | Use [nvm](https://github.com/nvm-sh/nvm) to install |
| Bun | 1.3+ | Required for the dev server in sandbox; `npm` works for production |
| MySQL | 8.0+ | Production database. SQLite works for local dev only |
| Redis | 7+ | Optional — in-memory fallback used if unset |
| n8n | 1.x | Optional but recommended for workflow automation |
| OpenSSL | any | For generating secrets |

Verify:

```bash
node --version    # v20.x
mysql --version   # 8.x
redis-cli --version  # 7.x (optional)
```

---

## 2. Clone & install dependencies

```bash
git clone https://github.com/your-org/tech360.git
cd tech360
npm ci
```

---

## 3. Configure `.env`

```bash
cp .env.example .env
```

Edit `.env` and fill in real values. The minimum to start:

- `DATABASE_URL` — your MySQL connection string
- `NEXTAUTH_SECRET` and `JWT_SECRET` — generate with `openssl rand -hex 32`
- `NEXTAUTH_URL` — `http://localhost:3000` for dev, your real domain for prod
- `TECH360_API_KEY` — a long random string used by n8n to call back into Tech360

```bash
# Generate secrets
openssl rand -hex 32  # use for NEXTAUTH_SECRET
openssl rand -hex 32  # use for JWT_SECRET
openssl rand -hex 24  # use for TECH360_API_KEY
```

---

## 4. Switch the Prisma provider to MySQL

The sandbox ships with `provider = "sqlite"`. For production, switch to MySQL:

```bash
# Option A: use the helper script
bash scripts/switch-to-mysql.sh

# Option B: edit manually
sed -i 's/provider = "sqlite"/provider = "mysql"/' prisma/schema.prisma
```

---

## 5. Create the database & user

```bash
mysql -u root -p <<'SQL'
CREATE DATABASE tech360_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'tech360_user'@'127.0.0.1' IDENTIFIED BY 'YOUR_STRONG_PASSWORD';
GRANT ALL ON tech360_db.* TO 'tech360_user'@'127.0.0.1';
FLUSH PRIVILEGES;
SQL
```

Update `DATABASE_URL` in `.env` to match.

---

## 6. Push the schema

```bash
npx prisma db push
```

This creates all tables. (For production migrations with version control, use `npx prisma migrate dev` instead.)

---

## 7. Seed the database

```bash
npx tsx prisma/seed.ts                    # Core data: users, leads, projects, AI workforce
npx tsx scripts/generate_ai_workforce.ts  # AI agents, departments, skills, prompts
npx tsx scripts/seed_content.ts           # Legal pages, blog posts, public reviews
```

**Default logins** (after `prisma/seed.ts`):

| Email | Password | Role |
|-------|----------|------|
| admin@bdtech360.com | admin123 | SUPER_ADMIN |
| manager@bdtech360.com | manager123 | MANAGER |
| staff@bdtech360.com | staff123 | STAFF |

> ⚠️ **Change these passwords immediately after first login.**

---

## 8. Build the app

```bash
npm run build
```

This produces a standalone build in `.next/standalone/`.

---

## 9. Start the server

```bash
npm start
# OR, for the standalone build:
NODE_ENV=production node .next/standalone/server.js
```

Visit `http://localhost:3000`. You should see the Tech360 public site.

---

## 10. Import n8n workflows

If you want the automation layer (lead intake, WhatsApp inbound, scope generation, etc.):

```bash
# Install n8n
npm install -g n8n

# Start n8n
n8n start

# In a separate terminal, import the 12 production workflows:
for f in n8n/*.json; do
  n8n import --input="$f"
done
```

Open `http://localhost:5678`, activate each workflow, and configure the credentials:
- **HTTP Header Auth** — name: `Tech360 API`, value: your `TECH360_API_KEY`
- **WhatsApp Cloud API** — bearer token from your `WHATSAPP_ACCESS_TOKEN`
- **IMAP** — your inbound email credentials

---

## 11. Configure external webhooks

Update each external service to point to your n8n instance:

| Service | Webhook URL |
|---------|-------------|
| WhatsApp Cloud API | `https://n8n.yourdomain.com/webhook/whatsapp` |
| Facebook Messenger | `https://n8n.yourdomain.com/webhook/facebook` |
| Instagram | `https://n8n.yourdomain.com/webhook/instagram` |
| LinkedIn | `https://n8n.yourdomain.com/webhook/linkedin` |
| X (Twitter) | `https://n8n.yourdomain.com/webhook/x` |
| Stripe | `https://n8n.yourdomain.com/webhook/stripe` |
| Tech360 (internal) | `https://n8n.yourdomain.com/webhook/tech360/lead` |

---

## 12. Set up the custom domain

For production:

1. Point `bdtech360.com` and `n8n.bdtech360.com` A/AAAA records to your server.
2. Configure TLS (Let's Encrypt via certbot, or Cloud Run managed certs).
3. Update `NEXTAUTH_URL` and `TECH360_API_URL` in `.env` to `https://bdtech360.com`.
4. Update `N8N_WEBHOOK_URL` to `https://n8n.bdtech360.com`.
5. Restart the server.

---

## 13. Verify

Run the end-to-end test script:

```bash
bash scripts/test-e2e.sh
```

Expected: all tests pass. If any fail, check `/home/z/my-project/dev.log` for stack traces.

---

## Troubleshooting

### `PrismaClientInitializationError: Database connection failed`
- Verify `DATABASE_URL` is correct.
- Verify MySQL is running: `mysql -u tech360_user -p tech360_db -h 127.0.0.1`.
- Verify the schema was pushed: `npx prisma db push`.

### `NextAuth error: JWT_SECRET is not set`
- Verify `NEXTAUTH_SECRET` and `JWT_SECRET` are set in `.env`.
- Restart the server after editing `.env`.

### n8n workflows show "credential not configured"
- Open the workflow in n8n, click each red node, and select the right credential.

### WhatsApp webhooks return 403
- Verify `WHATSAPP_APP_SECRET` matches the App Secret in your Meta App dashboard.
- Verify the webhook verify token matches `WHATSAPP_WEBHOOK_VERIFY_TOKEN`.

---

## Next steps

- [DEPLOYMENT.md](./DEPLOYMENT.md) — Google Cloud Run production deployment
- [PRODUCTION.md](./PRODUCTION.md) — Operation playbook
- `n8n/README.md` — Workflow-by-workflow documentation
