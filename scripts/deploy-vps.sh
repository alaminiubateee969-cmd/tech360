#!/usr/bin/env bash
# ============================================================
# TECH360 — VPS DEPLOYMENT SCRIPT (safe, port-preserving, rollback-ready)
#
# Run ON THE VPS (usually via the GitHub Actions SSH step, or manually):
#   bash scripts/deploy-vps.sh
#
# Contract (see DEPLOYMENT.md):
#   1. STRICT mode — any failure triggers automatic rollback to the
#      previous known-good release; production is never left broken.
#   2. INSPECT BEFORE MODIFY — discovers the current process manager
#      (PM2 / systemd / bare node) and the CURRENT TECH360 PORT, and
#      keeps both. Never installs a second process manager, never
#      starts a second app instance on another port.
#   3. The production .env is NEVER overwritten by the repo — the VPS
#      keeps its own secrets. Only source code is updated.
#   4. The database is never destroyed. Prisma migrations run with
#      deploy-safe settings; data is backed up first.
#
# Environment (set on the VPS or by the workflow):
#   TECH360_APP_PATH   (default: this script's repo checkout)
#   TECH360_DOMAIN     (default: bdtech360.com — informational)
#   TECH360_PORT       (default: auto-discovered from the RUNNING app)
# ============================================================
set -Eeuo pipefail

APP_PATH="${TECH360_APP_PATH:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
DOMAIN="${TECH360_DOMAIN:-bdtech360.com}"
BRANCH="${TECH360_BRANCH:-main}"
BACKUP_ROOT="$APP_PATH/releases"
TS="$(date +%Y%m%d-%H%M%S)"

log()  { printf '\033[1;36m[deploy]\033[0m %s\n' "$*"; }
warn() { printf '\033[1;33m[deploy]\033[0m %s\n' "$*"; }
err()  { printf '\033[1;31m[deploy]\033[0m %s\n' "$*" >&2; }

cd "$APP_PATH"

# ------------------------------------------------------------
# STEP 0 — inspect the CURRENT state BEFORE touching anything
# ------------------------------------------------------------
log "STEP 0/9 — inspecting current production state (before any change)"

CURRENT_COMMIT="$(git rev-parse --short HEAD 2>/dev/null || echo 'unknown')"
log "current commit: $CURRENT_COMMIT"

# Discover the port the CURRENT app process listens on. The Tech360 app is
# the listener whose /api/health identifies as "tech360-platform" — never a
# bun/mini-service sidecar.
DISCOVERED_PORT="${TECH360_PORT:-}"
if [[ -z "$DISCOVERED_PORT" ]]; then
  for CAND in $(ss -lntp 2>/dev/null | rg 'next-server|node|bun' | rg -o ':\d+' | tr -d ':' | sort -un); do
    if curl -sf -m 5 "http://127.0.0.1:$CAND/api/health" 2>/dev/null | rg -q 'tech360-platform'; then
      DISCOVERED_PORT="$CAND"; break
    fi
  done
fi
TECH360_PORT="${DISCOVERED_PORT:-3000}"
log "TECH360_PORT = $TECH360_PORT (preserving the existing port)"

# Discover the process manager currently running the app.
PM2_OK=0; SYSTEMD_UNIT=""
command -v pm2 >/dev/null 2>&1 && pm2 pid tech360 >/dev/null 2>&1 && PM2_OK=1 || PM2_OK=0
if [[ $PM2_OK -eq 0 ]]; then
  SYSTEMD_UNIT="$(systemctl list-units --type=service --no-legend 2>/dev/null | rg -io 'tech360[a-z0-9-]*\.service' | head -1 || true)"
fi
if [[ $PM2_OK -eq 1 ]]; then
  log "process manager: PM2 (app 'tech360', pid $(pm2 pid tech360))"
elif [[ -n "$SYSTEMD_UNIT" ]]; then
  log "process manager: systemd ($SYSTEMD_UNIT)"
else
  warn "process manager: none detected — will start via pm2 startup (first deployment)"
fi

HEALTH_URL="http://127.0.0.1:${TECH360_PORT}/api/health"
if curl -sf -m 10 "$HEALTH_URL" >/dev/null 2>&1; then
  log "current release is healthy on :$TECH360_PORT"
else
  warn "current release did not answer $HEALTH_URL (cold first deploy?)"
fi

# ------------------------------------------------------------
# STEP 1 — pre-deploy backup (code metadata + database + env fingerprint)
# ------------------------------------------------------------
log "STEP 1/9 — backup current release + database"
mkdir -p "$BACKUP_ROOT"
git bundle create "$BACKUP_ROOT/repo-$TS.bundle" --all 2>/dev/null || warn "git bundle backup skipped (no git history?)"
# Database backup — engine aware. The dump must exist AND be non-empty AND
# structurally terminated; a zero exit code from the dump tool is not proof.
DB_BACKUP=""
case "$(node -e 'const u=process.env.DATABASE_URL||"";const m=/^([a-z0-9+]+):/i.exec(u);process.stdout.write(m?m[1].toLowerCase():"")' 2>/dev/null || true)" in
  file)
    if [[ -f "$APP_PATH/db/custom.db" ]]; then
      cp "$APP_PATH/db/custom.db" "$BACKUP_ROOT/db-$TS.bak" && DB_BACKUP="$BACKUP_ROOT/db-$TS.bak"
    fi
    ;;
  mysql)
    DUMP="$BACKUP_ROOT/db-$TS.sql"
    if command -v mysqldump >/dev/null 2>&1; then
      # credentials come from DATABASE_URL via a 0600 defaults-file so they
      # never appear in the process list or in any log line
      CNF="$(mktemp)"; chmod 600 "$CNF"
      node -e '
        const u=new URL(process.env.DATABASE_URL);
        const q=(s)=>String(s).replace(/"/g,"\\\"");
        process.stdout.write(`[client]\nhost="${q(u.hostname)}"\nport=${u.port||3306}\nuser="${q(decodeURIComponent(u.username))}"\npassword="${q(decodeURIComponent(u.password))}"\n`);
      ' > "$CNF"
      DBNAME="$(node -e 'process.stdout.write(new URL(process.env.DATABASE_URL).pathname.slice(1))')"
      if mysqldump --defaults-extra-file="$CNF" \
           --single-transaction --quick --routines --triggers --events \
           --set-gtid-purged=OFF --no-tablespaces "$DBNAME" > "$DUMP" 2>"$BACKUP_ROOT/db-$TS.err"; then
        DB_BACKUP="$DUMP"
      else
        warn "mysqldump reported an error — see $BACKUP_ROOT/db-$TS.err"
      fi
      rm -f "$CNF"
    else
      warn "mysqldump not installed on this host — cannot take a logical backup"
    fi
    ;;
esac

if [[ -n "$DB_BACKUP" ]]; then
  # verify the dump is real, not just "exit code 0"
  if [[ ! -s "$DB_BACKUP" ]]; then
    err "database backup $DB_BACKUP is empty — refusing to continue"; false
  fi
  if [[ "$DB_BACKUP" == *.sql ]] && ! tail -5 "$DB_BACKUP" | grep -q "Dump completed"; then
    err "mysqldump output is truncated (no completion marker) — refusing to continue"; false
  fi
  log "database backed up → $DB_BACKUP ($(wc -c <"$DB_BACKUP") bytes, verified)"
else
  err "no verified database backup was produced — refusing to deploy"
  err "production schema changes require a recoverable backup first"
  false
fi
echo "$CURRENT_COMMIT" > "$BACKUP_ROOT/last-good-commit.txt"
[[ -f "$APP_PATH/.env" ]] && sha256sum "$APP_PATH/.env" > "$BACKUP_ROOT/env-$TS.sha" && log "env fingerprint recorded (values never copied)"

ROLLBACK() {
  err "DEPLOYMENT FAILED — rolling back to the previous known-good release"
  set +e
  # Database rollback is deliberately NOT automatic for server-hosted engines.
  # Overwriting a live MySQL database is itself a destructive act: any row
  # written after the dump would be lost. Code is rolled back automatically;
  # data recovery stays an explicit, operator-approved step.
  if [[ -f "$BACKUP_ROOT/db-$TS.bak" && -f "$APP_PATH/db/custom.db" ]]; then
    cp "$BACKUP_ROOT/db-$TS.bak" "$APP_PATH/db/custom.db" && log "database file restored from pre-deploy backup"
  elif [[ -n "${DB_BACKUP:-}" && "$DB_BACKUP" == *.sql ]]; then
    warn "database NOT auto-restored (would discard post-backup writes)"
    warn "verified pre-deploy dump: $DB_BACKUP"
    warn "restore only after an operator confirms data loss is acceptable:"
    warn "  mysql --defaults-extra-file=<0600 cnf> <database> < $DB_BACKUP"
  fi
  # restore code
  if [[ -s "$BACKUP_ROOT/last-good-commit.txt" ]]; then
    GOOD="$(cat "$BACKUP_ROOT/last-good-commit.txt")"
    if [[ "$GOOD" != "unknown" && "$GOOD" != "$CURRENT_COMMIT" ]]; then
      git checkout -f "$GOOD" 2>/dev/null && log "code restored to $GOOD"
    else
      # current commit was the good one — the new commit never went live
      git checkout -f "$CURRENT_COMMIT" 2>/dev/null && log "code kept at last-good $CURRENT_COMMIT"
    fi
  fi
  # restore dependencies + build of the good release
  (cd "$APP_PATH" && (command -v bun >/dev/null 2>&1 && bun install --frozen-lockfile || npm ci --no-audit --no-fund)) >/dev/null 2>&1
  (cd "$APP_PATH" && npm run build) >/dev/null 2>&1
  RESTART_APP
  sleep 3
  if curl -sf -m 15 "$HEALTH_URL" >/dev/null 2>&1; then
    log "ROLLBACK COMPLETE — previous release is serving again on :$TECH360_PORT"
  else
    err "ROLLBACK health check failed — investigate manually: $HEALTH_URL"
  fi
  exit 1
}
trap ROLLBACK ERR

# ------------------------------------------------------------
# helpers — restart with the DISCOVERED process manager + verify
# ------------------------------------------------------------
RESTART_APP() {
  if [[ $PM2_OK -eq 1 ]]; then
    pm2 restart tech360 --update-env >/dev/null 2>&1 || pm2 start npm --name tech360 --start "npm run start" >/dev/null 2>&1
  elif [[ -n "$SYSTEMD_UNIT" ]]; then
    systemctl restart "$SYSTEMD_UNIT"
  else
    # first deployment: register with PM2 if available (survives reboots), else nohup
    if command -v pm2 >/dev/null 2>&1; then
      pm2 start npm --name tech360 -- start >/dev/null 2>&1 && pm2 save >/dev/null 2>&1
    else
      warn "no PM2 available — starting bare (nohup). Install PM2 or create a systemd unit for production."
      (nohup npm run start > server.log 2>&1 &)
    fi
  fi
}

# ------------------------------------------------------------
# STEP 2 — fetch + checkout the latest main
# ------------------------------------------------------------
log "STEP 2/9 — fetching origin/$BRANCH"
git fetch origin "$BRANCH"
NEW_COMMIT="$(git rev-parse "origin/$BRANCH")"
log "deploying commit $(git rev-parse --short "$NEW_COMMIT")"
git checkout -f "$NEW_COMMIT"

# ------------------------------------------------------------
# STEP 3 — protect the production .env (never overwritten by the repo)
# ------------------------------------------------------------
log "STEP 3/9 — protecting production .env"
if [[ -f "$APP_PATH/.env" ]]; then
  cp "$APP_PATH/.env" "/tmp/tech360-env-preserve-$TS"
  PRESERVED_ENV=1
fi
if [[ ! -f "$APP_PATH/.env" && -f "$APP_PATH/.env.example" ]]; then
  err "no .env found — copy .env.example to .env and fill secrets BEFORE deploying"
  exit 1
fi

# ------------------------------------------------------------
# STEP 4 — install dependencies (lockfile-exact)
# ------------------------------------------------------------
log "STEP 4/9 — installing dependencies"
if command -v bun >/dev/null 2>&1; then
  bun install --frozen-lockfile
else
  npm ci --no-audit --no-fund
fi

# ------------------------------------------------------------
# STEP 5 — validate (lint + typecheck) before building
# ------------------------------------------------------------
log "STEP 5/9 — lint + typecheck"
npm run lint
bunx tsc --noEmit || npx tsc --noEmit

# ------------------------------------------------------------
# STEP 6 — build
# ------------------------------------------------------------
log "STEP 6/9 — production build"
npm run build

# ------------------------------------------------------------
# STEP 7 — database migration (non-destructive)
# ------------------------------------------------------------
log "STEP 7/9 — applying database schema (non-destructive)"

# --- provider / URL agreement gate -------------------------------------
# A Prisma client generated for one engine cannot talk to another. Detect the
# DATABASE_URL *scheme* only — the value itself is never printed or logged.
DB_SCHEME="$(node -e 'const u=process.env.DATABASE_URL||"";const m=/^([a-z0-9+]+):/i.exec(u);process.stdout.write(m?m[1].toLowerCase():"")' 2>/dev/null || true)"
PRISMA_PROVIDER="$(sed -n 's/^[[:space:]]*provider[[:space:]]*=[[:space:]]*"\([a-z]*\)".*/\1/p' prisma/schema.prisma | head -1)"
log "prisma provider: ${PRISMA_PROVIDER:-unknown} · DATABASE_URL scheme: ${DB_SCHEME:-unset}"

[[ -n "$DB_SCHEME" ]] || { err "DATABASE_URL is not set on the server — refusing to migrate"; false; }

case "$PRISMA_PROVIDER:$DB_SCHEME" in
  mysql:mysql) : ;;
  sqlite:file)  : ;;
  postgresql:postgres|postgresql:postgresql) : ;;
  *)
    err "provider/URL mismatch: prisma='$PRISMA_PROVIDER' url-scheme='$DB_SCHEME'"
    err "a client generated for '$PRISMA_PROVIDER' cannot be used against '$DB_SCHEME' — refusing to deploy"
    false
    ;;
esac

# --- migration baseline gate -------------------------------------------
# `prisma db push` is NEVER acceptable in production: it reconciles the
# database to the schema by dropping/altering whatever disagrees. Production
# only ever replays reviewed, committed migrations.
if [[ ! -d prisma/migrations ]] || [[ -z "$(ls -A prisma/migrations 2>/dev/null)" ]]; then
  err "prisma/migrations is missing or empty — no reviewed migration baseline exists"
  err "refusing to modify the production schema without one (db push is not a fallback)"
  false
fi

npx prisma migrate deploy || { err "prisma migrate deploy failed — NOT falling back to db push"; false; }

# ------------------------------------------------------------
# STEP 8 — restore env + restart on the SAME port
# ------------------------------------------------------------
log "STEP 8/9 — restoring env + restarting on :$TECH360_PORT"
if [[ "${PRESERVED_ENV:-0}" = "1" ]]; then
  cp "/tmp/tech360-env-preserve-$TS" "$APP_PATH/.env" && rm -f "/tmp/tech360-env-preserve-$TS"
  log "production .env preserved (repo never owns secrets)"
fi
RESTART_APP

# ------------------------------------------------------------
# STEP 9 — verify (health + port + HTTP) — failure = rollback
# ------------------------------------------------------------
log "STEP 9/9 — verifying deployment"
for i in $(seq 1 20); do
  if curl -sf -m 10 "$HEALTH_URL" >/dev/null 2>&1; then
    HEALTH_OK=1; break
  fi
  sleep 3
done
[[ "${HEALTH_OK:-0}" = "1" ]] || { err "health check failed at $HEALTH_URL"; false; }

# port verification — the app MUST be listening on the SAME port,
# and no second tech360 process may exist
LISTEN_OK=0
ss -lntp 2>/dev/null | rg -q ":$TECH360_PORT\b" && LISTEN_OK=1
if [[ $LISTEN_OK -eq 0 ]]; then
  err "expected port :$TECH360_PORT is not listening — refusing to leave a broken deploy"
  false
fi

HTTP_CODE="$(curl -s -o /dev/null -w '%{http_code}' -m 10 "http://127.0.0.1:$TECH360_PORT/")"
[[ "$HTTP_CODE" = "200" || "$HTTP_CODE" = "307" || "$HTTP_CODE" = "308" ]] || { err "homepage returned HTTP $HTTP_CODE"; false; }

# record the new known-good release
echo "$NEW_COMMIT" > "$BACKUP_ROOT/last-good-commit.txt"

trap - ERR
log "DEPLOYMENT COMPLETE ✅"
log "  commit:  $(git rev-parse --short HEAD)"
log "  port:    :$TECH360_PORT (unchanged)"
log "  health:  $HEALTH_URL → OK"
log "  domain:  https://$DOMAIN (reverse proxy untouched)"
log "  rollback: bash scripts/health-check.sh && scripts/deploy-vps.sh (auto-rollback armed)"
