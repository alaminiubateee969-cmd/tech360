#!/usr/bin/env bash
# TECH360 — external or explicit-port production health check
#
# Usage:
#   bash scripts/health-check.sh https://bdtech360.com
#   PORT="$PORT" bash scripts/health-check.sh   # local/host-side only
#
# No port is guessed. For Hostinger, use the platform-supplied PORT if running
# on the app host, or pass the public HTTPS base URL from an external client.
set -Eeuo pipefail

BASE="${1:-${TECH360_BASE_URL:-}}"
if [[ -z "$BASE" && -n "${PORT:-}" ]]; then
  BASE="http://127.0.0.1:${PORT}"
fi
if [[ -z "$BASE" ]]; then
  echo "Usage: $0 <https://application.example> (or set the platform-supplied PORT for a local check)" >&2
  exit 2
fi
BASE="${BASE%/}"

TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT
PASS=0
FAIL=0

# Curl/grep failures are captured so every route is reported; the accumulated
# FAIL count at the end still forces a nonzero exit for any failed check.

# Homepage
home_status="$(curl -sS --connect-timeout 10 --max-time 30 -o "$TMP_DIR/home.html" -w '%{http_code}' "$BASE/" 2>/dev/null || true)"
if [[ "$home_status" == 200 ]]; then
  printf '  PASS  homepage (HTTP 200)\n'
  PASS=$((PASS + 1))
else
  printf '  FAIL  homepage (expected HTTP 200, received %s)\n' "${home_status:-no response}"
  FAIL=$((FAIL + 1))
fi

# Health: status, dynamic package version, and a real MySQL connection.
health_status="$(curl -sS --connect-timeout 10 --max-time 30 -o "$TMP_DIR/health.json" -w '%{http_code}' "$BASE/api/health" 2>/dev/null || true)"
if [[ "$health_status" == 200 ]]; then
  if node - "$TMP_DIR/health.json" "${EXPECTED_VERSION:-}" <<'NODE'
const fs = require('node:fs');
const health = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const expectedVersion = process.argv[3];
if (health.status !== 'healthy') throw new Error(`health status is ${health.status}`);
if (health.app !== 'tech360-platform') throw new Error(`unexpected app ${health.app}`);
if (expectedVersion && health.version !== expectedVersion) throw new Error(`version ${health.version} != expected ${expectedVersion}`);
if (health.checks?.database?.status !== 'UP') throw new Error(`database status is ${health.checks?.database?.status}`);
if (!/MySQL/i.test(health.checks.database.detail ?? '')) throw new Error('health does not identify MySQL');
NODE
  then
    printf '  PASS  health/version/MySQL (HTTP 200)\n'
    PASS=$((PASS + 1))
  else
    printf '  FAIL  health JSON did not prove healthy app/version/MySQL\n'
    FAIL=$((FAIL + 1))
  fi
else
  printf '  FAIL  health endpoint (expected HTTP 200, received %s)\n' "${health_status:-no response}"
  FAIL=$((FAIL + 1))
fi

# Route contract checks: validation response for an empty login and an
# authentication refusal for an unauthenticated privileged admin route.
portal_status="$(curl -sS --connect-timeout 10 --max-time 30 -o "$TMP_DIR/portal.json" -w '%{http_code}' \
  -X POST -H 'content-type: application/json' --data '{}' "$BASE/api/portal/login" 2>/dev/null || true)"
if [[ "$portal_status" == 400 ]]; then
  printf '  PASS  portal login rejects missing fields (HTTP 400)\n'
  PASS=$((PASS + 1))
else
  printf '  FAIL  portal login (expected HTTP 400, received %s)\n' "${portal_status:-no response}"
  FAIL=$((FAIL + 1))
fi

admin_status="$(curl -sS --connect-timeout 10 --max-time 30 -o "$TMP_DIR/admin.json" -w '%{http_code}' \
  -X POST -H 'content-type: application/json' --data '{}' "$BASE/api/admin/seo/audit" 2>/dev/null || true)"
if [[ "$admin_status" == 401 ]]; then
  printf '  PASS  protected SEO route refuses anonymous request (HTTP 401)\n'
  PASS=$((PASS + 1))
else
  printf '  FAIL  protected SEO route (expected HTTP 401, received %s)\n' "${admin_status:-no response}"
  FAIL=$((FAIL + 1))
fi

# Verify at least one built Next static asset, not only a proxy/placeholder page.
asset_path="$(grep -oE '/_next/static/[^" ]+' "$TMP_DIR/home.html" | head -1 || true)"
if [[ -n "$asset_path" ]]; then
  asset_status="$(curl -sS --connect-timeout 10 --max-time 30 -o /dev/null -w '%{http_code}' "$BASE$asset_path" 2>/dev/null || true)"
  if [[ "$asset_status" == 200 ]]; then
    printf '  PASS  built Next.js static asset (HTTP 200)\n'
    PASS=$((PASS + 1))
  else
    printf '  FAIL  static asset (expected HTTP 200, received %s)\n' "${asset_status:-no response}"
    FAIL=$((FAIL + 1))
  fi
else
  printf '  FAIL  no Next.js static asset URL found in homepage HTML\n'
  FAIL=$((FAIL + 1))
fi

printf '\n%s passed · %s failed · target %s\n' "$PASS" "$FAIL" "$BASE"
if (( FAIL > 0 )); then
  exit 1
fi
