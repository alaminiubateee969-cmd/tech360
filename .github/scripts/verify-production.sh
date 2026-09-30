#!/usr/bin/env bash
# ============================================================
# TECH360 — production verification over real HTTPS.
#
# A deployment is NOT successful because SSH worked, because a process
# restarted, or because a script exited 0. It is successful only when the
# public site answers over HTTPS and the health endpoint identifies itself
# as this application with its database up.
# ============================================================
set -uo pipefail

SITE="${TECH360_SITE_URL:-https://bdtech360.com/}"
HEALTH="${TECH360_HEALTH_URL:-https://bdtech360.com/api/health}"
fail=0

echo "── TLS ──"
if curl -sS --max-time 30 -o /dev/null -w 'tls verify result: %{ssl_verify_result}\n' "$SITE" 2>&1; then
  echo "✓ TLS certificate chain validates"
else
  echo "::error::TLS verification failed for $SITE"
  fail=1
fi

echo
echo "── $SITE ──"
code="$(curl -sS -o /tmp/site.html -w '%{http_code}' --max-time 30 "$SITE" 2>/dev/null || echo 000)"
echo "HTTP $code"
if [ "$code" != "200" ]; then
  echo "::error::$SITE returned HTTP $code (expected 200)"
  head -c 400 /tmp/site.html 2>/dev/null
  fail=1
else
  echo "✓ site responds 200"
fi

echo
echo "── $HEALTH ──"
hcode="$(curl -sS -o /tmp/health.json -w '%{http_code}' --max-time 30 "$HEALTH" 2>/dev/null || echo 000)"
echo "HTTP $hcode"
cat /tmp/health.json 2>/dev/null; echo

if [ "$hcode" != "200" ]; then
  echo "::error::$HEALTH returned HTTP $hcode (expected 200)"
  fail=1
fi

# identity — must be THIS application, not some other app on the domain
if grep -q 'tech360-platform' /tmp/health.json 2>/dev/null; then
  echo "✓ health endpoint identifies as tech360-platform"
else
  echo "::error::health endpoint did not identify as tech360-platform"
  fail=1
fi

# database — a 200 with a DOWN database is not a successful deployment
if grep -q '"status":"healthy"' /tmp/health.json 2>/dev/null; then
  echo "✓ application reports healthy"
else
  echo "::error::application did not report status=healthy"
  fail=1
fi
if grep -qE '"database":\{"status":"UP"' /tmp/health.json 2>/dev/null; then
  echo "✓ database connection is UP"
else
  echo "::error::health endpoint does not report the database as UP"
  fail=1
fi

echo
if [ "$fail" -ne 0 ]; then
  echo "::error::production verification FAILED"
  exit 1
fi
echo "production verification PASSED"
