# DEPLOYMENT — TECH360 → VPS (GitHub Actions)

This is the **VPS deployment path** (the original Google Cloud Run path stays in `deployment/` — both are supported; pick one).

```
Developer / AI Builder
  → git push origin main
  → GitHub Actions (.github/workflows/deploy-production.yml)
      → CI: secret scan → bun install → prisma generate → lint → tsc → build
      → Deploy: SSH to VPS → scripts/deploy-vps.sh
          → inspect current state → backup → fetch → install → build → migrate
          → restart THE EXISTING process → verify port + health
      → health-check.sh (7-point live verification)
  → LIVE TECH360 on the existing domain + existing port
```

---

## 1. Inspect the VPS BEFORE the first deploy (the script does this too)

```bash
ssh your-vps
ss -lntp                      # what listens where — find the CURRENT Tech360 port
ps aux | rg 'node|next|bun'   # how the app runs today
pm2 list                      # PM2? (script preserves + reuses it)
systemctl list-units --type=service | rg -i tech360   # systemd? (script preserves + reuses it)
node -v && npm -v
```

**Rules baked into the deploy script:**

- The **existing port is preserved** (`TECH360_PORT` auto-discovered; only pin it in secrets if you must).
- The **existing process manager is preserved** (PM2 app `tech360`, or the systemd unit, or bare node on first deploy).
- The **production `.env` is never touched** — GitHub updates source only; the VPS owns its secrets.
- The **database is never destroyed** — backed up before every deploy, restored on rollback.
- **One instance only** — never starts a second Tech360 process.

## 2. One-time setup on the VPS

```bash
# 1. code
git clone https://github.com/<owner>/tech360-platform.git ~/tech360 && cd ~/tech360

# 2. production env (stays on the VPS forever — never commit it)
cp .env.example .env && nano .env
#    DATABASE_URL, SESSION_SECRET, OPS_SECRET, PORTAL_SECRET, NOTIFY_RELAY_TOKEN,
#    APP_PUBLIC_URL=https://bdtech360.com, ADMIN_PASSWORD, + any channel/gateway creds

# 3. first boot
bun install          # or: npm ci
bun run db:push
bun run db:seed      # super admin + departments + agents + templates
npm run build

# 4. process manager — EITHER:
pm2 start npm --name tech360 -- start && pm2 save && pm2 startup
#    OR create a systemd unit (see §5) if systemd is your standard

# 5. reverse proxy — keep the EXISTING one
#    nginx/Apache/cPanel already points at 127.0.0.1:<CURRENT_PORT> — leave it.
#    Only add a proxy rule if none exists (see §6). SSL stays on the proxy.
```

## 3. One-time setup on GitHub

1. **Repository** — push the complete source (this repo) to `main`.
2. **Environment** — Settings → Environments → `New environment` → name it **`production`** (optionally restrict to the `main` branch).
3. **Secrets** (Settings → Secrets and variables → Actions, or environment-level):

| Secret | Value |
|---|---|
| `VPS_HOST` | server IP/hostname |
| `VPS_USER` | SSH user that owns the app directory |
| `VPS_SSH_KEY` | **private** deploy key (`ssh-keygen -t ed25519 -f tech360-deploy`; public part → VPS `~/.ssh/authorized_keys`) |
| `VPS_PORT` | SSH port (usually 22) |
| `VPS_APP_PATH` | e.g. `/home/deploy/tech360` |
| `TECH360_DOMAIN` | e.g. `bdtech360.com` (informational) |
| `TECH360_PORT` | **optional** — pin only if auto-discovery is unsuitable |

4. Push to `main` (or run the workflow manually — it has `workflow_dispatch`). Every future push deploys automatically.

## 4. What the deploy script does (and when it rolls back)

`scripts/deploy-vps.sh` steps: inspect → backup (git bundle + `db/custom.db` + env fingerprint) → fetch + checkout → **preserve `.env`** → `bun install --frozen-lockfile` → lint + typecheck → `npm run build` → `prisma migrate deploy` → restart existing process → verify (health 200, port listening, homepage 200).

**Any step fails ⇒ automatic rollback:** code restored to `releases/last-good-commit.txt`, database restored from the pre-deploy backup, dependencies + build rebuilt, process restarted, health re-verified. Production is never left broken.

`scripts/health-check.sh` verifies: port listening, process present, homepage 200, `/api/health` healthy + DB UP, public APIs responding, admin API correctly refusing anonymous access (401 = pass), ops-loop heartbeat fresh. Non-zero exit = CI marks the deploy failed.

## 5. systemd unit (only if systemd is your standard)

```ini
# /etc/systemd/system/tech360.service
[Unit]
Description=TECH360 platform
After=network.target

[Service]
Type=simple
User=deploy
WorkingDirectory=/home/deploy/tech360
EnvironmentFile=/home/deploy/tech360/.env
ExecStart=/usr/bin/npm run start
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

The deploy script detects the running unit by name (`tech360*.service`) and uses `systemctl restart` — no PM2 is installed on systemd boxes.

## 6. Reverse proxy (only if none exists)

nginx example — **keep your current virtual host as-is**; only create one if the domain doesn't route yet:

```nginx
server {
  server_name bdtech360.com www.bdtech360.com;
  location / {
    proxy_pass http://127.0.0.1:3000;      # ← the CURRENT Tech360 port
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;  # websocket (notify-relay path if proxied)
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
  }
  # SSL: certbot --nginx -d bdtech360.com -d www.bdtech360.com
}
```

## 7. Rollback by hand (if ever needed)

```bash
cd ~/tech360
git checkout $(cat releases/last-good-commit.txt)   # or any prior commit
bash scripts/deploy-vps.sh                          # rebuild + restart + verify
# DB restore: cp releases/db-<timestamp>.bak db/custom.db  (restart after)
```

## 8. Cloud Run alternative

See `deployment/` (cloudbuild.yaml, deploy.sh, scheduler.md — Cloud Scheduler replaces the ai-ops mini-service with `OPS_SECRET`-authenticated POSTs to `/api/ops/cycle`). Choose this path if you prefer managed infrastructure; the VPS path above is the GitHub-Actions-native route.
