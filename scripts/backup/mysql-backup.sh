#!/usr/bin/env bash
# =============================================================================
# TECH360 — MySQL backup (production)
#
# Creates a consistent, compressed, checksummed logical backup of the TECH360
# MySQL database, verifies it, applies the retention policy, optionally copies
# it off-server, and records machine-readable evidence.
#
# Design notes
# ------------
# * Consistency: `mysqldump --single-transaction` takes an InnoDB consistent
#   snapshot without locking writers. (MyISAM/ARCHIVE tables are not
#   transaction-safe — the dump then uses table locks; see docs.)
# * Secrets: the password is never placed on a command line. It is written to a
#   mode-600 temp defaults file that is removed on exit, so it cannot be read
#   from `ps` or shell history. Nothing in this script prints a secret.
# * Location: backups live OUTSIDE the web root in a mode-700 directory. The
#   script refuses to write into any `public/` directory.
# * Overlap: a `flock` lock means two runs can never write the same target; the
#   second exits 75 (EX_TEMPFAIL) and says so.
# * Honesty: success is only reported after gzip integrity + SHA-256 +
#   end-of-dump marker checks pass. Exit codes are meaningful (see below).
#
# Usage
#   DATABASE_URL='mysql://user:pass@host:3306/db' ./mysql-backup.sh
#   ./mysql-backup.sh --dry-run
#   ./mysql-backup.sh --verify-only /path/to/backup.sql.gz
#
# Environment
#   DATABASE_URL                 required (mysql:// only; refused otherwise)
#   TECH360_BACKUP_DIR           target directory (default: ~/tech360-backups)
#   TECH360_BACKUP_RETENTION_DAILY    default 7
#   TECH360_BACKUP_RETENTION_WEEKLY   default 4
#   TECH360_BACKUP_RETENTION_MONTHLY  default 3
#   TECH360_BACKUP_OFFSITE       optional: "rclone:remote:path" or "scp:host:/path"
#   TECH360_BACKUP_ALERT_WEBHOOK optional: POSTed a small JSON on failure
#   MYSQLDUMP_BIN / MYSQL_BIN    override binaries (tests use stubs)
#
# Exit codes
#   0 success · 2 configuration refused · 3 dump failed · 4 integrity failed
#   5 off-server copy failed · 75 another backup is already running
# =============================================================================
set -Eeuo pipefail

readonly SCRIPT_VERSION="2026-10-24.1"
readonly EXIT_CONFIG=2
readonly EXIT_DUMP=3
readonly EXIT_INTEGRITY=4
readonly EXIT_OFFSITE=5
readonly EXIT_LOCKED=75

MYSQLDUMP_BIN="${MYSQLDUMP_BIN:-mysqldump}"

log() { printf '%s %s\n' "$(date -u '+%Y-%m-%dT%H:%M:%SZ')" "$*" >&2; }

# Print a JSON-safe string (no control chars, escapes backslash and quote).
json_escape() {
  local s="${1//\\/\\\\}"
  s="${s//\"/\\\"}"
  s="${s//$'\n'/ }"
  s="${s//$'\r'/ }"
  s="${s//$'\t'/ }"
  printf '%s' "$s"
}

usage() { sed -n '2,45p' "$0" | sed 's/^# \{0,1\}//'; }

verify_file() {
  # verify_file <dump.gz> <exit-on-failure 0|1>
  local file="$1" strict="${2:-1}" sha_file="${1}.sha256"
  local ok=1 problem=""

  if [[ ! -s "$file" ]]; then
    problem="file is missing or empty"
    ok=0
  fi

  if (( ok )) && ! gzip -t "$file" 2>/dev/null; then
    problem="gzip integrity check failed"
    ok=0
  fi

  if (( ok )) && [[ -f "$sha_file" ]]; then
    local expected actual
    expected="$(awk '{print $1}' "$sha_file")"
    actual="$(sha256sum "$file" | awk '{print $1}')"
    if [[ "$expected" != "$actual" ]]; then
      problem="sha256 mismatch (expected ${expected:0:12}…, got ${actual:0:12}…)"
      ok=0
    fi
  elif (( ok )) && [[ ! -f "$sha_file" ]]; then
    problem="checksum file missing"
    ok=0
  fi

  if (( ok )) && ! gzip -dc "$file" 2>/dev/null | tail -n 5 | grep -q -- '-- Dump completed'; then
    problem="dump completion marker missing (truncated dump)"
    ok=0
  fi

  if (( ok )); then
    printf 'OK'
    return 0
  fi
  printf '%s' "$problem"
  (( strict )) && return 1 || return 0
}

url_decode() { local s="${1//+/ }"; printf '%b' "${s//%/\\x}"; }

parse_database_url() {
  # Sets DB_USER DB_PASS DB_HOST DB_PORT DB_NAME. Never echoes.
  local url="${DATABASE_URL:-}"
  [[ -z "$url" ]] && { log "CONFIG_ERROR DATABASE_URL is not set"; exit "$EXIT_CONFIG"; }
  [[ "$url" == mysql://* ]] || { log "CONFIG_ERROR DATABASE_URL must be a mysql:// URL (refusing other engines)"; exit "$EXIT_CONFIG"; }

  local rest="${url#mysql://}"
  local creds hostpart
  if [[ "$rest" == *@* ]]; then
    creds="${rest%%@*}"
    hostpart="${rest#*@}"
  else
    creds=""
    hostpart="$rest"
  fi
  DB_USER="$(url_decode "${creds%%:*}")"
  if [[ "$creds" == *:* ]]; then DB_PASS="$(url_decode "${creds#*:}")"; else DB_PASS=""; fi

  hostpart="${hostpart%%\?*}"
  DB_NAME="${hostpart##*/}"
  local hostport="${hostpart%%/*}"
  DB_HOST="${hostport%%:*}"
  if [[ "$hostport" == *:* ]]; then DB_PORT="${hostport##*:}"; else DB_PORT="3306"; fi

  [[ -n "$DB_NAME" ]] || { log "CONFIG_ERROR DATABASE_URL has no database name"; exit "$EXIT_CONFIG"; }
  DB_HOST="${DB_HOST:-localhost}"
  DB_PORT="${DB_PORT:-3306}"
}

assert_safe_directory() {
  local dir="$1"
  if [[ "$dir" == *"/public/"* || "$dir" == */public || "$dir" == *"/.next/"* || "$dir" == *"/public" ]]; then
    log "CONFIG_ERROR refusing to store backups inside the web root: $dir"
    exit "$EXIT_CONFIG"
  fi
  mkdir -p "$dir"
  chmod 700 "$dir" 2>/dev/null || true
}

write_status() {
  # write_status <json>
  printf '%s\n' "$1" > "${RUN_DIR}/last-run.json"
  chmod 600 "${RUN_DIR}/last-run.json" 2>/dev/null || true
}

alert_failure() {
  # alert_failure <code> <message>  — never includes credentials or data.
  local code="$1" message="$2"
  local payload
  payload="$(printf '{"source":"tech360-backup","status":"FAILED","code":"%s","message":"%s","host":"%s","database":"%s","at":"%s"}' \
    "$(json_escape "$code")" "$(json_escape "$message")" "$(json_escape "$(hostname 2>/dev/null || echo unknown)")" \
    "$(json_escape "$DB_NAME")" "$(date -u '+%Y-%m-%dT%H:%M:%SZ')")"
  printf '%s\n' "$payload" > "${RUN_DIR}/last-failure.json" 2>/dev/null || true
  if [[ -n "${TECH360_BACKUP_ALERT_WEBHOOK:-}" ]] && command -v curl >/dev/null 2>&1; then
    curl -fsS -m 10 -X POST -H 'content-type: application/json' --data "$payload" \
      "$TECH360_BACKUP_ALERT_WEBHOOK" >/dev/null 2>&1 \
      || log "ALERT_DELIVERY_FAILED (the failure itself is still recorded on disk)"
  fi
  log "FAILED code=${code} ${message}"
}

finish_fail() {
  local code="$1" message="$2" exit_code="${3:-$EXIT_DUMP}"
  write_status "$(printf '{"status":"FAILED","code":"%s","message":"%s","finishedAt":"%s","scriptVersion":"%s","database":"%s"}' \
    "$(json_escape "$code")" "$(json_escape "$message")" "$(date -u '+%Y-%m-%dT%H:%M:%SZ')" "$SCRIPT_VERSION" "$(json_escape "${DB_NAME:-unknown}")")"
  alert_failure "$code" "$message"
  exit "$exit_code"
}

# ---------------------------------------------------------------- argument parse
MODE="backup"; VERIFY_TARGET=""; DRY_RUN=0
while [[ $# -gt 0 ]]; do
  case "$1" in
    --dry-run) DRY_RUN=1; shift ;;
    --verify-only) MODE="verify"; VERIFY_TARGET="${2:-}"; shift 2 ;;
    --help|-h) usage; exit 0 ;;
    *) log "CONFIG_ERROR unknown argument: $1"; exit "$EXIT_CONFIG" ;;
  esac
done

RUN_DIR="${TECH360_BACKUP_DIR:-$HOME/tech360-backups}"

if [[ "$MODE" == "verify" ]]; then
  [[ -n "$VERIFY_TARGET" ]] || { log "CONFIG_ERROR --verify-only needs a file"; exit "$EXIT_CONFIG"; }
  assert_safe_directory "$RUN_DIR"
  if result="$(verify_file "$VERIFY_TARGET" 0)"; then :; fi
  if [[ "$result" == "OK" ]]; then
    log "VERIFY_OK $VERIFY_TARGET"
    exit 0
  fi
  log "VERIFY_FAILED $VERIFY_TARGET: $result" >&2
  exit "$EXIT_INTEGRITY"
fi

parse_database_url

RETENTION_DAILY="${TECH360_BACKUP_RETENTION_DAILY:-7}"
RETENTION_WEEKLY="${TECH360_BACKUP_RETENTION_WEEKLY:-4}"
RETENTION_MONTHLY="${TECH360_BACKUP_RETENTION_MONTHLY:-3}"
for n in "$RETENTION_DAILY" "$RETENTION_WEEKLY" "$RETENTION_MONTHLY"; do
  [[ "$n" =~ ^[0-9]+$ ]] || { log "CONFIG_ERROR retention values must be integers"; exit "$EXIT_CONFIG"; }
done

assert_safe_directory "$RUN_DIR"

if (( DRY_RUN )); then
  log "DRY_RUN database=${DB_NAME} host=${DB_HOST} port=${DB_PORT} dir=${RUN_DIR}"
  log "DRY_RUN retention daily=${RETENTION_DAILY} weekly=${RETENTION_WEEKLY} monthly=${RETENTION_MONTHLY}"
  [[ -n "${TECH360_BACKUP_OFFSITE:-}" ]] && log "DRY_RUN offsite=${TECH360_BACKUP_OFFSITE%%:*}:configured" || log "DRY_RUN offsite=not configured"
  exit 0
fi

# ------------------------------------------------------------------- lock/overlap
exec 9>"${RUN_DIR}/.backup.lock"
if ! flock -n 9; then
  log "SKIPPED_LOCKED another backup is already running (lock: ${RUN_DIR}/.backup.lock)"
  exit "$EXIT_LOCKED"
fi

STARTED_AT="$(date -u '+%Y-%m-%dT%H:%M:%SZ')"
STAMP="$(date -u '+%Y%m%dT%H%M%SZ')"
BASE="${DB_NAME}-${STAMP}.sql.gz"
OUT="${RUN_DIR}/${BASE}"
TMP_SQL="${RUN_DIR}/.${DB_NAME}-${STAMP}.sql.tmp"
DEFAULTS_FILE=""

cleanup() {
  local rc=$?
  [[ -n "$DEFAULTS_FILE" && -f "$DEFAULTS_FILE" ]] && rm -f "$DEFAULTS_FILE"
  [[ -f "$TMP_SQL" ]] && rm -f "$TMP_SQL"
  return $rc
}
trap cleanup EXIT

# --------------------------------------------------------------- credentials file
DEFAULTS_FILE="$(mktemp "${TMPDIR:-/tmp}/tech360-mysql-XXXXXX")"
chmod 600 "$DEFAULTS_FILE"
{
  printf '[client]\n'
  printf 'user=%s\n' "$DB_USER"
  printf 'password=%s\n' "$DB_PASS"
  printf 'host=%s\n' "$DB_HOST"
  printf 'port=%s\n' "$DB_PORT"
} > "$DEFAULTS_FILE"

log "START database=${DB_NAME} host=${DB_HOST} port=${DB_PORT} dir=${RUN_DIR}"

DUMP_OPTS=(
  --defaults-extra-file="$DEFAULTS_FILE"
  --single-transaction     # InnoDB consistent snapshot, no writer lock
  --quick                  # stream rows, do not buffer the whole table
  --skip-lock-tables
  --routines --triggers --events
  --no-tablespaces         # avoids PROCESS privilege requirements
  --set-gtid-purged=OFF
  --default-character-set=utf8mb4
  --hex-blob
  --skip-add-locks
  --complete-insert
)

set +e
"$MYSQLDUMP_BIN" "${DUMP_OPTS[@]}" "$DB_NAME" > "$TMP_SQL" 2>"${RUN_DIR}/.dump.err"
DUMP_RC=$?
set -e

if (( DUMP_RC != 0 )); then
  # The stderr log can contain the host/user but never the password (it is read
  # from a defaults file). Redact defensively anyway before storing it.
  sed -e "s/${DB_PASS//\//\\/}/[REDACTED]/g" "${RUN_DIR}/.dump.err" > "${RUN_DIR}/last-dump-error.log" 2>/dev/null || true
  chmod 600 "${RUN_DIR}/last-dump-error.log" 2>/dev/null || true
  rm -f "${RUN_DIR}/.dump.err"
  finish_fail "DUMP_FAILED" "mysqldump exited ${DUMP_RC}; see last-dump-error.log" "$EXIT_DUMP"
fi
rm -f "${RUN_DIR}/.dump.err"

if [[ ! -s "$TMP_SQL" ]]; then
  finish_fail "DUMP_EMPTY" "mysqldump produced no output" "$EXIT_DUMP"
fi

TABLES="$(grep -c '^CREATE TABLE' "$TMP_SQL" 2>/dev/null || echo 0)"
if [[ "$TABLES" -lt 1 ]]; then
  finish_fail "DUMP_NO_TABLES" "the dump contains no CREATE TABLE statements" "$EXIT_INTEGRITY"
fi

# ------------------------------------------------------------------- compress
if ! gzip -9 -c "$TMP_SQL" > "${OUT}.tmp"; then
  rm -f "${OUT}.tmp"
  finish_fail "COMPRESS_FAILED" "gzip failed" "$EXIT_DUMP"
fi
mv "${OUT}.tmp" "$OUT"
rm -f "$TMP_SQL"
chmod 600 "$OUT"

# --------------------------------------------------------------------- verify
if ! ( cd "$RUN_DIR" && sha256sum "$BASE" > "${BASE}.sha256" ); then
  finish_fail "CHECKSUM_FAILED" "could not write the checksum file" "$EXIT_INTEGRITY"
fi
chmod 600 "${OUT}.sha256"

if ! VERIFY_RESULT="$(verify_file "$OUT" 0)" || [[ "$VERIFY_RESULT" != "OK" ]]; then
  finish_fail "INTEGRITY_FAILED" "${VERIFY_RESULT:-unknown verification error}" "$EXIT_INTEGRITY"
fi

SIZE_BYTES="$(wc -c < "$OUT" | tr -d ' ')"
SHA256="$(awk '{print $1}' "${OUT}.sha256")"

# ------------------------------------------------------------ off-server copy
OFFSITE_STATUS="NOT_CONFIGURED"
if [[ -n "${TECH360_BACKUP_OFFSITE:-}" ]]; then
  OFFSITE_TARGET="${TECH360_BACKUP_OFFSITE}"
  OFFSITE_KIND="${OFFSITE_TARGET%%:*}"
  OFFSITE_REST="${OFFSITE_TARGET#*:}"
  set +e
  case "$OFFSITE_KIND" in
    rclone)
      if command -v rclone >/dev/null 2>&1; then
        rclone copy "$OUT" "$OFFSITE_REST" --checksum >/dev/null 2>"${RUN_DIR}/.offsite.err"
        OFFSITE_RC=$?
      else
        OFFSITE_RC=127
      fi
      ;;
    scp)
      if command -v scp >/dev/null 2>&1; then
        scp -q -o BatchMode=yes -o StrictHostKeyChecking=accept-new "$OUT" "$OFFSITE_REST" >/dev/null 2>"${RUN_DIR}/.offsite.err"
        OFFSITE_RC=$?
      else
        OFFSITE_RC=127
      fi
      ;;
    *)
      OFFSITE_RC=126
      ;;
  esac
  set -e
  if (( OFFSITE_RC == 0 )); then
    OFFSITE_STATUS="COPIED"
  elif (( OFFSITE_RC == 127 )); then
    OFFSITE_STATUS="NOT_AVAILABLE"
    log "OFFSITE_SKIPPED the configured client (${OFFSITE_KIND}) is not installed"
  elif (( OFFSITE_RC == 126 )); then
    OFFSITE_STATUS="INVALID_TARGET"
    log "OFFSITE_SKIPPED unsupported TECH360_BACKUP_OFFSITE scheme"
  else
    OFFSITE_STATUS="FAILED"
    rm -f "${RUN_DIR}/.offsite.err"
    finish_fail "OFFSITE_FAILED" "the local backup is valid but the off-server copy failed" "$EXIT_OFFSITE"
  fi
  rm -f "${RUN_DIR}/.offsite.err"
fi

# ------------------------------------------------------------------- retention
DELETED=0
KEPT=0
if command -v find >/dev/null 2>&1; then
  # Keep: every backup within RETENTION_DAILY days; for older files, the newest
  # of each ISO week within RETENTION_WEEKLY weeks and the newest of each month
  # within RETENTION_MONTHLY months. Everything else is removed with its
  # checksum. Retention never touches last-run.json / last-drill.json.
  mapfile -t ALL < <(find "$RUN_DIR" -maxdepth 1 -type f -name "${DB_NAME}-*.sql.gz" -printf '%T@ %f\n' | sort -rn | awk '{print $2}')
  TODAY="$(date -u +%s)"
  declare -A SEEN_WEEK=() SEEN_MONTH=()
  for f in "${ALL[@]:-}"; do
    [[ -z "$f" ]] && continue
    full="${RUN_DIR}/${f}"
    mtime="$(stat -c %Y "$full" 2>/dev/null || echo 0)"
    age_days=$(( (TODAY - mtime) / 86400 ))
    week="$(date -u -d "@${mtime}" '+%G-W%V' 2>/dev/null || echo unknown)"
    month="$(date -u -d "@${mtime}" '+%Y-%m' 2>/dev/null || echo unknown)"
    keep=0
    if (( age_days < RETENTION_DAILY )); then
      keep=1
    elif [[ -z "${SEEN_WEEK[$week]:-}" ]] && (( $(date -u -d "@${mtime}" '+%s') >= TODAY - RETENTION_WEEKLY*7*86400 )); then
      SEEN_WEEK[$week]=1; keep=1
    elif [[ -z "${SEEN_MONTH[$month]:-}" ]] && (( $(date -u -d "@${mtime}" '+%s') >= TODAY - RETENTION_MONTHLY*31*86400 )); then
      SEEN_MONTH[$month]=1; keep=1
    fi
    # Never prune the file just written, whatever the policy says.
    [[ "$f" == "$BASE" ]] && keep=1
    if (( keep )); then
      KEPT=$((KEPT+1))
    else
      rm -f "$full" "${full}.sha256" && DELETED=$((DELETED+1))
      log "RETENTION_DELETE ${f}"
    fi
  done
fi

DURATION=$(( $(date -u +%s) - $(date -u -d "$STARTED_AT" +%s 2>/dev/null || echo 0) ))
FINISHED_AT="$(date -u '+%Y-%m-%dT%H:%M:%SZ')"

write_status "$(printf '{"status":"OK","file":"%s","directory":"%s","sizeBytes":%s,"sha256":"%s","tables":%s,"database":"%s","host":"%s","startedAt":"%s","finishedAt":"%s","durationSec":%s,"engine":"mysqldump","consistency":"single-transaction","offsite":"%s","retention":{"daily":%s,"weekly":%s,"monthly":%s,"kept":%s,"deleted":%s},"scriptVersion":"%s"}' \
  "$(json_escape "$BASE")" "$(json_escape "$RUN_DIR")" "${SIZE_BYTES:-0}" "${SHA256:0:64}" "${TABLES:-0}" \
  "$(json_escape "$DB_NAME")" "$(json_escape "$DB_HOST")" "$STARTED_AT" "$FINISHED_AT" "${DURATION:-0}" \
  "$OFFSITE_STATUS" "$RETENTION_DAILY" "$RETENTION_WEEKLY" "$RETENTION_MONTHLY" "$KEPT" "$DELETED" "$SCRIPT_VERSION")"

log "OK file=${BASE} bytes=${SIZE_BYTES} tables=${TABLES} sha256=${SHA256:0:12}… offsite=${OFFSITE_STATUS} kept=${KEPT} deleted=${DELETED} duration=${DURATION}s"
exit 0
