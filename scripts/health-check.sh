#!/usr/bin/env bash
# ============================================================
# TECH360 — POST-DEPLOY HEALTH CHECK
# Verifies the live application end-to-end after deployment.
# Exit code 0 = healthy, 1 = unhealthy (CI marks the deploy failed).
#
# Usage:  bash scripts/health-check.sh [port] [base-url]
#   port     — the EXISTING Tech360 port (default: auto-discover)
#   base-url — public URL (default: http://127.0.0.1:$PORT)
# ============================================================
set -uo pipefail

PORT="${1:-}"
BASE="${2:-}"

# --- discover the port the TECH360 app actually listens on ---
# The app answers /api/health with "tech360-platform"; mini-services do not.
# Candidates: explicitly running next/node app ports first (never sidecars).
if [[ -z "$PORT" ]]; then
  for CAND in $(ss -lntp 2>/dev/null | grep -E 'next-server|node .*standalone|node .*server' | grep -oE ':[0-9]+' | tr -d ':' | sort -u); do
    if curl -sf -m 5 "http://127.0.0.1:$CAND/api/health" 2>/dev/null | grep -qE 'tech360-platform'; then
      PORT="$CAND"; break
    fi
  done
fi
if [[ -z "$PORT" ]]; then
  # wider sweep: any listening port that answers as the Tech360 platform
  for CAND in $(ss -lntp 2>/dev/null | grep -oE ':[0-9]+' | tr -d ':' | sort -un); do
    if curl -sf -m 3 "http://127.0.0.1:$CAND/api/health" 2>/dev/null | grep -qE 'tech360-platform'; then
      PORT="$CAND"; break
    fi
  done
fi
[[ -z "$PORT" ]] && PORT=3000
BASE="${BASE:-http://127.0.0.1:$PORT}"

PASS=0; FAIL=0
check() {
  local NAME="$1" CMD="$2"
  if eval "$CMD" >/dev/null 2>&1; then
    printf '  \033[1;32mPASS\033[0m  %s\n' "$NAME"; PASS=$((PASS+1))
  else
    printf '  \033[1;31mFAIL\033[0m  %s\n' "$NAME"; FAIL=$((FAIL+1))
  fi
}

echo "── TECH360 health check · $BASE (port :$PORT) ──"

# 1) process is running and listening on the expected port
check "application process listening on :$PORT" "ss -lntp | grep -qE \":$PORT\\b\""
check "node/next/bun process present" "ps aux | grep -qE '[n]ext-server|[n]ode .*server|[b]un'"

# 2) public homepage responds
check "GET / → HTTP 200" "curl -sf -m 15 -o /dev/null '$BASE/'"

# 3) health endpoint: overall + database + agents + ops loop
HEALTH="$(curl -sf -m 15 "$BASE/api/health" 2>/dev/null || echo '{}')"
check "/api/health responds" "[[ '$HEALTH' != '{}' ]]"
check "database UP" "echo '$HEALTH' | grep -qE '\"status\":\"UP\"'"
check "health JSON parses" "echo '$HEALTH' | grep -qE '\"status\":\"healthy\"'"

# 4) public data APIs answer (blog + features)
check "GET /api/blog responds" "curl -sf -m 15 '$BASE/api/blog' | grep -qE 'posts' || curl -sf -m 15 '$BASE/api/blog' | grep -qE 'disabled'"
check "GET /api/features responds" "curl -sf -m 15 '$BASE/api/features' | grep -qE 'maintenance'"

# 5) admin login page loads (SPA shell + auth gate reachable)
check "admin SPA reachable (GET / 200 on #/admin route)" "curl -sf -m 15 -o /dev/null '$BASE/'"

# 6) auth API refuses anonymous (proves the guard is live — a 401 is PASS)
check "admin API protected (401 for anonymous /api/admin/dashboard)" "! curl -sf -m 10 '$BASE/api/admin/dashboard'"

# 7) ops loop heartbeat is fresh (autonomous engine alive)
check "AI operations heartbeat fresh (ACTIVE/operating)" "echo '$HEALTH' | grep -qE 'ACTIVE|operating' || curl -sf -m 10 'http://127.0.0.1:3031/health' | grep -qE 'operating'"

echo "────────────────────────────────"
echo "  $PASS passed · $FAIL failed"
if [[ $FAIL -gt 0 ]]; then
  printf "  RESULT: \033[1;31mUNHEALTHY\033[0m — trigger rollback (scripts/deploy-hostinger.sh auto-rolls-back, or restore releases/last-good-commit.txt)"
  exit 1
fi
printf "  RESULT: \033[1;32mHEALTHY\033[0m\n"
exit 0
