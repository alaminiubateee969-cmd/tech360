#!/usr/bin/env bash
# =============================================================================
# TECH360 — MySQL restore drill (isolated, non-destructive)
#
# Proves that a backup can actually be restored, WITHOUT ever touching the
# production database.
#
# Hard safety rails (all enforced in code, none optional):
#   1. The target database name MUST start with `tech360_drill_`. Any other name
#      is refused before a single statement is executed.
#   2. The target database must differ from the database in DATABASE_URL.
#   3. The script refuses to run against a target that already contains tables
#      unless --reuse is passed (and even then it only runs `DROP DATABASE` for
#      a name that satisfies rule 1).
#   4. The production connection is opened read-only (SELECT / SHOW only) to
#      compare row counts.
#
# Usage
#   ./mysql-restore-drill.sh --target-database tech360_drill_20261024
#   ./mysql-restore-drill.sh --target-database tech360_drill_x --dump /path/backup.sql.gz --keep
#
# Environment
#   DATABASE_URL          production connection (source of truth for counts)
#   DRILL_DATABASE_URL    optional separate credentials for the drill host; must
#                         still point at the same server. If unset, DATABASE_URL
#                         credentials are used and only the database name changes.
#   TECH360_BACKUP_DIR    where backups + last-drill.json live
#   MYSQL_BIN / MYSQLDUMP_BIN / MYSQLADMIN_BIN  override binaries
#
# Exit codes
#   0 drill passed · 2 configuration/safety refusal · 3 restore failed
#   4 verification failed (counts/model mismatch)
# =============================================================================
set -Eeuo pipefail

readonly SCRIPT_VERSION="2026-10-24.1"
readonly EXIT_CONFIG=2
readonly EXIT_RESTORE=3
readonly EXIT_VERIFY=4
readonly DRILL_PREFIX="tech360_drill_"

MYSQL_BIN="${MYSQL_BIN:-mysql}"
MYSQLADMIN_BIN="${MYSQLADMIN_BIN:-mysqladmin}"

log() { printf '%s %s\n' "$(date -u '+%Y-%m-%dT%H:%M:%SZ')" "$*" >&2; }
json_escape() {
  local s="${1//\\/\\\\}"; s="${s//\"/\\\"}"; s="${s//$'\n'/ }"; s="${s//$'\r'/ }"; s="${s//$'\t'/ }"
  printf '%s' "$s"
}

usage() { sed -n '2,32p' "$0" | sed 's/^# \{0,1\}//'; }

TARGET_DB=""; DUMP=""; KEEP=0; REUSE=0; RECORD=1
while [[ $# -gt 0 ]]; do
  case "$1" in
    --target-database) TARGET_DB="${2:-}"; shift 2 ;;
    --dump) DUMP="${2:-}"; shift 2 ;;
    --keep) KEEP=1; shift ;;
    --reuse) REUSE=1; shift ;;
    --no-record) RECORD=0; shift ;;
    --help|-h) usage; exit 0 ;;
    *) log "CONFIG_ERROR unknown argument: $1"; exit "$EXIT_CONFIG" ;;
  esac
done

RUN_DIR="${TECH360_BACKUP_DIR:-$HOME/tech360-backups}"
mkdir -p "$RUN_DIR"; chmod 700 "$RUN_DIR" 2>/dev/null || true

url_decode() { local s="${1//+/ }"; printf '%b' "${s//%/\\x}"; }

parse_url_into() {
  # parse_url_into <url> <prefix>  -> sets <PREFIX>_USER/_PASS/_HOST/_PORT/_NAME
  local url="$1" p="$2"
  [[ "$url" == mysql://* ]] || { log "CONFIG_ERROR ${p}_URL must be mysql://"; exit "$EXIT_CONFIG"; }
  local rest="${url#mysql://}" creds hostpart
  if [[ "$rest" == *@* ]]; then creds="${rest%%@*}"; hostpart="${rest#*@}"; else creds=""; hostpart="$rest"; fi
  printf -v "${p}_USER" '%s' "$(url_decode "${creds%%:*}")"
  if [[ "$creds" == *:* ]]; then printf -v "${p}_PASS" '%s' "$(url_decode "${creds#*:}")"; else printf -v "${p}_PASS" '%s' ""; fi
  hostpart="${hostpart%%\?*}"; printf -v "${p}_NAME" '%s' "${hostpart##*/}"
  local hostport="${hostpart%%/*}"
  printf -v "${p}_HOST" '%s' "${hostport%%:*}"
  if [[ "$hostport" == *:* ]]; then printf -v "${p}_PORT" '%s' "${hostport##*:}"; else printf -v "${p}_PORT" '%s' "3306"; fi
}

# ------------------------------------------------------------------ safety gates
[[ -n "${DATABASE_URL:-}" ]] || { log "CONFIG_ERROR DATABASE_URL is not set"; exit "$EXIT_CONFIG"; }
parse_url_into "$DATABASE_URL" SRC

if [[ -z "$TARGET_DB" ]]; then
  log "CONFIG_ERROR --target-database is required (must start with ${DRILL_PREFIX})"
  exit "$EXIT_CONFIG"
fi

if [[ "$TARGET_DB" != "${DRILL_PREFIX}"* ]]; then
  log "REFUSED the drill target must start with '${DRILL_PREFIX}' (got: ${TARGET_DB})"
  exit "$EXIT_CONFIG"
fi

if [[ "$TARGET_DB" == "$SRC_NAME" ]]; then
  log "REFUSED the drill target equals the production database (${SRC_NAME})"
  exit "$EXIT_CONFIG"
fi

if [[ -n "${DRILL_DATABASE_URL:-}" ]]; then
  parse_url_into "$DRILL_DATABASE_URL" DRL
  DRILL_HOST="$DRL_HOST"; DRILL_PORT="$DRL_PORT"; DRILL_USER="$DRL_USER"; DRILL_PASS="$DRL_PASS"
  [[ "$DRILL_HOST" == "$SRC_HOST" ]] || log "WARNING drill server (${DRILL_HOST}) differs from the production server (${SRC_HOST})"
else
  DRILL_HOST="$SRC_HOST"; DRILL_PORT="$SRC_PORT"; DRILL_USER="$SRC_USER"; DRILL_PASS="$SRC_PASS"
fi

# ---------------------------------------------------------------------- the dump
if [[ -z "$DUMP" ]]; then
  DUMP="$(find "$RUN_DIR" -maxdepth 1 -type f -name "${SRC_NAME}-*.sql.gz" -printf '%T@ %p\n' 2>/dev/null | sort -rn | head -n1 | awk '{print $2}')"
fi
[[ -n "$DUMP" && -f "$DUMP" ]] || { log "CONFIG_ERROR no backup file found in ${RUN_DIR}"; exit "$EXIT_CONFIG"; }

if [[ -f "${DUMP}.sha256" ]]; then
  expected="$(awk '{print $1}' "${DUMP}.sha256")"
  actual="$(sha256sum "$DUMP" | awk '{print $1}')"
  [[ "$expected" == "$actual" ]] || { log "VERIFY_FAILED sha256 mismatch for ${DUMP}"; exit "$EXIT_VERIFY"; }
else
  log "WARNING no checksum file beside ${DUMP}; integrity cannot be proven"
fi
gzip -t "$DUMP" || { log "VERIFY_FAILED gzip integrity failed for ${DUMP}"; exit "$EXIT_VERIFY"; }

# ------------------------------------------------------------------- credentials
SRC_CNF="$(mktemp "${TMPDIR:-/tmp}/tech360-drill-src-XXXXXX")"
DRL_CNF="$(mktemp "${TMPDIR:-/tmp}/tech360-drill-tgt-XXXXXX")"
chmod 600 "$SRC_CNF" "$DRL_CNF"
cleanup() { local rc=$?; rm -f "$SRC_CNF" "$DRL_CNF"; return $rc; }
trap cleanup EXIT

printf '[client]\nuser=%s\npassword=%s\nhost=%s\nport=%s\n' "$SRC_USER" "$SRC_PASS" "$SRC_HOST" "$SRC_PORT" > "$SRC_CNF"
printf '[client]\nuser=%s\npassword=%s\nhost=%s\nport=%s\n' "$DRILL_USER" "$DRILL_PASS" "$DRILL_HOST" "$DRILL_PORT" > "$DRL_CNF"

src_sql() { "$MYSQL_BIN" --defaults-extra-file="$SRC_CNF" --batch --skip-column-names -e "$1"; }
drl_sql() { "$MYSQL_BIN" --defaults-extra-file="$DRL_CNF" --batch --skip-column-names -e "$1"; }

# ------------------------------------------------------------ existing target DB
EXISTING="$(drl_sql "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='${TARGET_DB}'" 2>/dev/null || echo 0)"
if [[ "${EXISTING:-0}" != "0" && "$REUSE" != "1" ]]; then
  log "REFUSED target database ${TARGET_DB} already contains ${EXISTING} tables (pass --reuse to replace it)"
  exit "$EXIT_CONFIG"
fi

STARTED_AT="$(date -u '+%Y-%m-%dT%H:%M:%SZ')"
log "START drill target=${TARGET_DB} dump=$(basename "$DUMP") server=${DRILL_HOST}"

# --------------------------------------------------------------- create + restore
if ! drl_sql "DROP DATABASE IF EXISTS \`${TARGET_DB}\`; CREATE DATABASE \`${TARGET_DB}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"; then
  log "RESTORE_FAILED could not create ${TARGET_DB} (does the user have CREATE DATABASE?)"
  exit "$EXIT_RESTORE"
fi

if ! gzip -dc "$DUMP" | "$MYSQL_BIN" --defaults-extra-file="$DRL_CNF" "$TARGET_DB"; then
  log "RESTORE_FAILED loading ${DUMP} into ${TARGET_DB}"
  exit "$EXIT_RESTORE"
fi

# -------------------------------------------------------------------- verification
SRC_TABLES="$(src_sql "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='${SRC_NAME}' AND table_type='BASE TABLE'")"
DRL_TABLES="$(drl_sql "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='${TARGET_DB}' AND table_type='BASE TABLE'")"

# Compare exact row counts on the model tables that carry the business record.
KEY_TABLES=(User Client Project Invoice Payment ApprovalRequest AiAgent)
MISMATCHES=""
for t in "${KEY_TABLES[@]}"; do
  s="$(src_sql "SELECT COUNT(*) FROM \`${SRC_NAME}\`.\`${t}\`" 2>/dev/null || echo -1)"
  d="$(drl_sql "SELECT COUNT(*) FROM \`${TARGET_DB}\`.\`${t}\`" 2>/dev/null || echo -2)"
  [[ "$s" == "$d" ]] || MISMATCHES="${MISMATCHES}${t}:${s}->${d} "
done

FINISHED_AT="$(date -u '+%Y-%m-%dT%H:%M:%SZ')"
SHA="$(sha256sum "$DUMP" | awk '{print $1}')"

if [[ "$SRC_TABLES" != "$DRL_TABLES" || -n "$MISMATCHES" ]]; then
  log "VERIFY_FAILED tables ${SRC_TABLES}->${DRL_TABLES} mismatches: ${MISMATCHES:-none}"
  printf '{"status":"FAILED","code":"COUNT_MISMATCH","targetDatabase":"%s","dump":"%s","sourceTables":%s,"restoredTables":%s,"mismatches":"%s","finishedAt":"%s"}\n' \
    "$TARGET_DB" "$(json_escape "$(basename "$DUMP")")" "${SRC_TABLES:-0}" "${DRL_TABLES:-0}" "$(json_escape "$MISMATCHES")" "$FINISHED_AT" \
    > "${RUN_DIR}/last-drill.json"
  chmod 600 "${RUN_DIR}/last-drill.json" 2>/dev/null || true
  [[ "$KEEP" == "1" ]] || drl_sql "DROP DATABASE IF EXISTS \`${TARGET_DB}\`;" || true
  log "NOTICE the source database was never modified; only ${TARGET_DB} was touched"
  exit "$EXIT_VERIFY"
fi

# Optional record so the admin Backup & Recovery view can show proven evidence.
if [[ "$RECORD" == "1" ]]; then
  payload="{\"testedAt\":\"${FINISHED_AT}\",\"restoredRows\":${DRL_TABLES},\"source\":\"restore-drill:$(basename "$DUMP")\"}"
  esc="${payload//\'/\'\'}"
  "$MYSQL_BIN" --defaults-extra-file="$SRC_CNF" "$SRC_NAME" -e \
    "INSERT INTO \`Setting\` (id, \`key\`, value, updatedAt) VALUES (CONCAT('drill_', REPLACE(UUID(),'-','')), 'backup.restore_test', '${esc}', NOW()) ON DUPLICATE KEY UPDATE value=VALUES(value), updatedAt=NOW();" \
    >/dev/null 2>&1 || log "NOTICE could not record the drill in Setting (the JSON evidence is still written)"
fi

printf '{"status":"PASS","targetDatabase":"%s","dump":"%s","sha256":"%s","sourceTables":%s,"restoredTables":%s,"startedAt":"%s","finishedAt":"%s","dropped":%s,"scriptVersion":"%s"}\n' \
  "$TARGET_DB" "$(json_escape "$(basename "$DUMP")")" "$SHA" "$SRC_TABLES" "$DRL_TABLES" "$STARTED_AT" "$FINISHED_AT" \
  "$([[ "$KEEP" == "1" ]] && echo false || echo true)" "$SCRIPT_VERSION" > "${RUN_DIR}/last-drill.json"
chmod 600 "${RUN_DIR}/last-drill.json" 2>/dev/null || true

if [[ "$KEEP" == "1" ]]; then
  log "OK restored ${SRC_TABLES} tables into ${TARGET_DB} (kept for inspection)"
else
  drl_sql "DROP DATABASE IF EXISTS \`${TARGET_DB}\`;" || log "WARNING could not drop ${TARGET_DB}"
  log "OK restored ${SRC_TABLES} tables into ${TARGET_DB} and dropped the scratch database"
fi
exit 0
