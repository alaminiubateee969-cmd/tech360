# Tech360 + AI Workforce — Production Deployment

This document describes how to run the Tech360 platform in production on
`bdtech360.com` (port 3021) with real MySQL, Redis, OpenAI, Resend, and
file storage. The codebase is identical between sandbox and production —
the only differences are the environment variables and the Prisma
provider line.

## 1. Prerequisites

- **Node.js 20+** and **Bun 1.3+**
- **MySQL 8.0+** (production database)
- **Redis 7+** (real queue + cache; the in-memory fallback does NOT
  persist across restarts)
- **Nginx** (reverse proxy + TLS)
- **systemd** (process supervision)
- **certbot** (Let's Encrypt TLS cert)

## 2. Environment variables

Copy `.env.example` to `.env` and fill in real values. Every key is
documented inline. Critical values:

| Key | Purpose |
|-----|---------|
| `DATABASE_URL` | MySQL connection string. Schema is switched to `mysql` provider via `scripts/switch-to-mysql.sh`. |
| `NEXTAUTH_URL` | Public base URL (`https://bdtech360.com`). |
| `NEXTAUTH_SECRET` / `JWT_SECRET` | Random 32-char secrets. Generate with `openssl rand -hex 32`. |
| `OPENAI_API_KEY` | When set, the LLM executor and RAG indexer use real OpenAI. When unset, they fall back to z-ai-web-dev-sdk (sandbox). |
| `AI_MODEL` | Default OpenAI chat model (`gpt-4o-mini`). |
| `REDIS_URL` | When set, the queue and any cache use real Redis. When unset, an in-memory Map fallback is used (single-process only). |
| `UPLOAD_DIR` | Writable directory for uploaded files. Created if missing. |
| `EMAIL_FROM` / `RESEND_API_KEY` | When set, transactional email uses Resend. When unset, emails are logged to the `EmailLog` table and console. |
| `LOG_LEVEL` | `error` (prod), `debug` (sandbox). |

## 3. Database setup (MySQL)

```bash
mysql -u root -p <<'SQL'
CREATE DATABASE db_bdtech CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'user_bdtech'@'127.0.0.1' IDENTIFIED BY 'Alo_BDT_2026!';
GRANT ALL ON db_bdtech.* TO 'user_bdtech'@'127.0.0.1';
FLUSH PRIVILEGES;
SQL
```

## 4. Switch schema to MySQL and push

The sandbox ships with `provider = "sqlite"`. Switch to MySQL before
pushing the schema:

```bash
./scripts/switch-to-mysql.sh    # edits prisma/schema.prisma in place
bun run db:push                 # creates all tables in MySQL
```

`switch-to-mysql.sh` leaves a backup at `prisma/schema.prisma.bak`.

## 5. Seed (real data)

```bash
bunx tsx prisma/seed.ts                    # CRM + users + social posts
bunx tsx scripts/generate_ai_workforce.ts  # 2,000 agents, 50k prompts, ...
bunx tsx scripts/seed_rag.ts               # Tech360 knowledge base
```

The seed creates an admin user:

- Email: `admin@bdtech360.com`
- Password: `admin123` (bcrypt-hashed in DB) — **change immediately in
  production** via the Settings page or the `/api/auth/register` route.

## 6. Build and start

```bash
bun run build                              # produces .next/standalone
NODE_ENV=production PORT=3021 bun run start
```

The app listens on `127.0.0.1:3021` (loopback only — Nginx fronts it).

## 7. Background worker

Long-running jobs (queued agent executions, workflows, email sends,
RAG re-indexing) are processed by a separate worker process:

```bash
bun run scripts/worker.ts
```

Run it as its own systemd unit so it survives app restarts and can be
scaled independently.

## 8. Nginx reverse proxy

```nginx
server {
    listen 80;
    server_name bdtech360.com www.bdtech360.com;
    return 301 https://bdtech360.com$request_uri;
}

server {
    listen 443 ssl http2;
    server_name bdtech360.com;

    ssl_certificate     /etc/letsencrypt/live/bdtech360.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/bdtech360.com/privkey.pem;

    client_max_body_size 100M;  # for file uploads

    location / {
        proxy_pass         http://127.0.0.1:3021;
        proxy_http_version 1.1;
        proxy_set_header   Host              $host;
        proxy_set_header   X-Real-IP         $remote_addr;
        proxy_set_header   X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto $scheme;
        proxy_set_header   Upgrade           $http_upgrade;
        proxy_set_header   Connection        "upgrade";
        proxy_read_timeout 600s;
    }
}
```

Issue a cert with `certbot --nginx -d bdtech360.com -d www.bdtech360.com`.

## 9. systemd units

`/etc/systemd/system/tech360.service`:

```ini
[Unit]
Description=Tech360 Next.js app
After=network.target mysql.service redis.service

[Service]
Type=simple
User=aloedu
WorkingDirectory=/home/aloedu/tech360
EnvironmentFile=/home/aloedu/tech360/.env
ExecStart=/home/aloedu/.bun/bin/bun .next/standalone/server.js
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
```

`/etc/systemd/system/tech360-worker.service`:

```ini
[Unit]
Description=Tech360 background worker
After=network.target mysql.service redis.service

[Service]
Type=simple
User=aloedu
WorkingDirectory=/home/aloedu/tech360
EnvironmentFile=/home/aloedu/tech360/.env
ExecStart=/home/aloedu/.bun/bin/bun run scripts/worker.ts
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
```

Enable and start: `systemctl enable --now tech360 tech360-worker`.

## 10. One-shot deploy

```bash
./scripts/deploy.sh
```

This script pulls latest code, installs deps, switches to MySQL, pushes
schema, re-seeds, builds, and restarts both systemd services.

## 11. Sandbox vs production — at a glance

| Capability | Sandbox (no keys) | Production (real keys) |
|------------|-------------------|------------------------|
| Database | SQLite (`file:./db/custom.db`) | MySQL 8 |
| Auth | bcrypt + JWT (same code) | bcrypt + JWT (same code) |
| LLM | z-ai-web-dev-sdk → deterministic fallback | OpenAI (`gpt-4o-mini`) |
| Embeddings / RAG | keyword search (no API key) | OpenAI `text-embedding-3-small` cosine similarity |
| Email | logged to `EmailLog` + console | Resend real send |
| Queue | in-memory Map (single process) | Redis (ioredis) |
| File storage | `./storage/uploads/` | `UPLOAD_DIR` (writable) |

The code path is identical — only the env vars decide which branch is
taken at runtime.
