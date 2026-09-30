#!/usr/bin/env bash
# ============================================================
# TECH360 — Hostinger preflight, executed ON the Hostinger server.
#
# STRICTLY READ-ONLY. Creates nothing, installs nothing, restarts nothing,
# and never touches the database. Its only job is to prove the deployment
# target is what we think it is, before anything is changed.
#
# Never prints: passwords, DATABASE_URL, private keys, tokens.
# Prints only: presence, scheme, host and port — the facts needed to decide
# whether it is safe to deploy.
#
# Expects APP_DIR to be exported by the caller.
# Exit 0 = safe to proceed, non-zero = DEPLOYMENT_BLOCKED.
# ============================================================
set -uo pipefail

FAIL=0
note() { printf '  %s\n' "$*"; }
bad()  { printf '  !! %s\n' "$*"; FAIL=1; }
sec()  { printf '\n── %s %s\n' "$1" "$(printf '─%.0s' $(seq 1 $((40 - ${#1}))))"; }

sec "identity"
note "hostname : $(hostname 2>/dev/null || echo '?')"
note "user     : $(id -un 2>/dev/null) (uid $(id -u 2>/dev/null))"
note "home     : $HOME"
note "kernel   : $(uname -srm 2>/dev/null || echo '?')"
note "shell    : ${SHELL:-?}"

sec "runtime discovery"
# Discover what Hostinger ACTUALLY provides. No assumption of systemd,
# nginx, pm2, Docker or supervisor — we report only what exists.
for b in node npm npx bun yarn pnpm git curl wget rsync tar \
         mysql mysqldump php composer \
         pm2 passenger systemctl supervisorctl docker apache2 httpd nginx caddy; do
  p="$(command -v "$b" 2>/dev/null)"
  [ -n "$p" ] && printf '  %-12s %s\n' "$b" "$p"
done
note "node     : $(node -v 2>/dev/null || echo '— not installed')"
note "npm      : $(npm -v 2>/dev/null || echo '— not installed')"
note "bun      : $(bun -v 2>/dev/null || echo '— not installed')"
note "php      : $(php -v 2>/dev/null | head -1 || echo '— not installed')"

if ! command -v node >/dev/null 2>&1; then
  bad "Node.js is not available — a Next.js app cannot run on this plan as-is"
fi
command -v git  >/dev/null 2>&1 || bad "git is not available (required to deploy a commit)"
command -v curl >/dev/null 2>&1 || bad "curl is not available (required for health checks)"

sec "process manager / listeners"
if command -v pm2 >/dev/null 2>&1; then
  note "pm2 processes:"; pm2 list 2>/dev/null | head -15
elif command -v systemctl >/dev/null 2>&1 && systemctl --user list-units >/dev/null 2>&1; then
  note "systemd user units:"; systemctl --user list-units --type=service --no-legend 2>/dev/null | head -10
else
  note "no pm2 / systemd — Hostinger likely manages the app itself (Node.js selector / Passenger)"
fi
(ss -lntp 2>/dev/null || netstat -lntp 2>/dev/null || echo '  (no socket tool available)') | head -15

sec "application directory"
if [ -z "${APP_DIR:-}" ]; then
  bad "HOSTINGER_APP_DIR was not provided — refusing to guess a directory"
elif [ ! -d "$APP_DIR" ]; then
  bad "HOSTINGER_APP_DIR '$APP_DIR' does not exist on the server"
  bad "refusing to create an arbitrary directory and deploy into it"
else
  note "path     : $APP_DIR"
  note "perms    : $(stat -c '%U:%G %a' "$APP_DIR" 2>/dev/null || echo '?')"
  note "writable : $([ -w "$APP_DIR" ] && echo yes || echo NO)"
  [ -w "$APP_DIR" ] || bad "application directory is not writable by $(id -un)"

  sec "git repository validation"
  if ! git -C "$APP_DIR" rev-parse --git-dir >/dev/null 2>&1; then
    bad "$APP_DIR is not a git repository"
  else
    ORIGIN="$(git -C "$APP_DIR" remote get-url origin 2>/dev/null || echo '')"
    note "origin   : ${ORIGIN:-<none>}"
    note "branch   : $(git -C "$APP_DIR" rev-parse --abbrev-ref HEAD 2>/dev/null || echo '?')"
    note "commit   : $(git -C "$APP_DIR" rev-parse --short HEAD 2>/dev/null || echo '?')"
    note "dirty    : $(test -n "$(git -C "$APP_DIR" status --porcelain 2>/dev/null)" && echo 'YES - local changes present' || echo 'no')"
    case "$ORIGIN" in
      *alaminiubateee969-cmd/tech360*) note "repository matches alaminiubateee969-cmd/tech360 ✓" ;;
      "") bad "no git origin configured — cannot confirm this is the Tech360 repository" ;;
      *)  bad "origin is NOT alaminiubateee969-cmd/tech360 — refusing to deploy over another repository" ;;
    esac
  fi

  sec "expected application files"
  for f in package.json prisma/schema.prisma scripts/deploy-hostinger.sh scripts/health-check.sh; do
    if [ -e "$APP_DIR/$f" ]; then note "have     : $f"; else bad "missing  : $f"; fi
  done
  if [ -d "$APP_DIR/prisma/migrations" ] && [ -n "$(ls -A "$APP_DIR/prisma/migrations" 2>/dev/null)" ]; then
    note "have     : prisma/migrations ($(ls -1 "$APP_DIR/prisma/migrations" | wc -l) migration(s))"
  else
    note "absent   : prisma/migrations (will arrive with this deployment)"
  fi

  sec "production environment"
  ENV_FILE="$APP_DIR/.env"
  if [ ! -f "$ENV_FILE" ]; then
    bad "$APP_DIR/.env is missing — production configuration lives on the server only"
  else
    note "env      : present (mode $(stat -c '%a' "$ENV_FILE" 2>/dev/null))"
    case "$(stat -c '%a' "$ENV_FILE" 2>/dev/null)" in
      600|400) : ;;
      *) note "warning  : .env is more permissive than 600" ;;
    esac
    # Report presence only — never the value.
    for k in DATABASE_URL APP_PUBLIC_URL APP_ORIGIN NODE_ENV SESSION_SECRET OPS_SECRET PORTAL_SECRET; do
      if grep -q "^${k}=" "$ENV_FILE" 2>/dev/null; then note "set      : $k"; else bad "not set  : $k (required)"; fi
    done

    sec "database discovery (scheme/host/port only — no credentials)"
    # The MySQL host is DISCOVERED from the server's own configuration.
    # It is never assumed to be the SSH IP, localhost, 127.0.0.1 or 3306.
    RAW="$(grep -m1 '^DATABASE_URL=' "$ENV_FILE" 2>/dev/null | cut -d= -f2- | tr -d '"'"'"'')"
    if [ -z "$RAW" ]; then
      bad "DATABASE_URL is not set — cannot determine the production database"
    else
      DB_SCHEME="${RAW%%:*}"
      REST="${RAW#*://}"
      HOSTPORT="${REST#*@}"; HOSTPORT="${HOSTPORT%%/*}"
      DB_HOST="${HOSTPORT%%:*}"
      DB_PORT="${HOSTPORT#*:}"; [ "$DB_PORT" = "$DB_HOST" ] && DB_PORT="(default)"
      DB_NAME="${REST#*/}"; DB_NAME="${DB_NAME%%\?*}"
      note "scheme   : $DB_SCHEME"
      note "db host  : $DB_HOST"
      note "db port  : $DB_PORT"
      note "db name  : $DB_NAME"
      [ "$DB_SCHEME" = "mysql" ] || bad "DATABASE_URL scheme is '$DB_SCHEME' but the Prisma provider is mysql"

      if command -v mysql >/dev/null 2>&1; then
        sec "database connectivity (read-only)"
        CNF="$(mktemp)"; chmod 600 "$CNF"
        USERPASS="${REST%%@*}"
        DB_USER="${USERPASS%%:*}"; DB_PASS="${USERPASS#*:}"
        printf '[client]\nhost=%s\nuser=%s\npassword="%s"\n' \
          "$DB_HOST" "$DB_USER" "$DB_PASS" > "$CNF"
        [ "$DB_PORT" != "(default)" ] && printf 'port=%s\n' "$DB_PORT" >> "$CNF"
        if mysql --defaults-extra-file="$CNF" -N -B -e "SELECT 1" >/dev/null 2>&1; then
          note "connect  : OK"
          note "version  : $(mysql --defaults-extra-file="$CNF" -N -B -e 'SELECT VERSION()' 2>/dev/null)"
          note "tables   : $(mysql --defaults-extra-file="$CNF" -N -B -e "SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA='$DB_NAME'" 2>/dev/null)"
          note "size MB  : $(mysql --defaults-extra-file="$CNF" -N -B -e "SELECT IFNULL(ROUND(SUM(data_length+index_length)/1024/1024,2),0) FROM information_schema.TABLES WHERE TABLE_SCHEMA='$DB_NAME'" 2>/dev/null)"
          note "prisma migration table: $(mysql --defaults-extra-file="$CNF" -N -B -e "SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA='$DB_NAME' AND TABLE_NAME='_prisma_migrations'" 2>/dev/null)"
          note "existing tables:"
          mysql --defaults-extra-file="$CNF" -N -B -e "SELECT CONCAT('    ',TABLE_NAME,' (',TABLE_ROWS,' rows est.)') FROM information_schema.TABLES WHERE TABLE_SCHEMA='$DB_NAME' ORDER BY TABLE_NAME" 2>/dev/null | head -60
        else
          bad "cannot connect to MySQL with the configured DATABASE_URL"
        fi
        rm -f "$CNF"
      else
        note "mysql client not installed — connectivity not verified from the shell"
        note "(the application still connects through Prisma)"
      fi
    fi
  fi

  sec "capacity"
  df -h "$APP_DIR" 2>/dev/null | tail -1 | sed 's/^/  /'
  note "inodes   : $(df -i "$APP_DIR" 2>/dev/null | tail -1 | awk '{print $5" used"}')"
fi

sec "result"
if [ "$FAIL" -eq 0 ]; then
  echo "  HOSTINGER_SSH_OK=true"
  echo "  preflight PASSED — nothing on the server was modified"
  exit 0
fi
echo "  HOSTINGER_SSH_OK=false"
echo "  preflight FAILED — DEPLOYMENT_BLOCKED (nothing was modified)"
exit 1
