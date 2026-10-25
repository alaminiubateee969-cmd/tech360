#!/bin/bash
set -uo pipefail
BASE_URL=${BASE_URL:-http://localhost:3000}
PASS=0
FAIL=0

test_endpoint() {
  local name=$1
  local url=$2
  local expected=$3
  local code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 "$url")
  if [ "$code" = "$expected" ]; then
    echo "  ✓ $name → $code"
    PASS=$((PASS + 1))
  else
    echo "  ✗ $name → $code (expected $expected)"
    FAIL=$((FAIL + 1))
  fi
}

echo "=== Tech360 E2E Test Suite ==="
echo ""
echo "--- Public APIs (expect 200) ---"
test_endpoint "Home page" "$BASE_URL/" "200"
test_endpoint "AI Workforce Stats" "$BASE_URL/api/ai-workforce/stats" "200"
test_endpoint "AI Workforce Departments" "$BASE_URL/api/ai-workforce/departments" "200"
test_endpoint "AI Workforce Agents" "$BASE_URL/api/ai-workforce/agents?pageSize=5" "200"
test_endpoint "AI Workforce Skills" "$BASE_URL/api/ai-workforce/skills?pageSize=5" "200"
test_endpoint "AI Workforce SOPs" "$BASE_URL/api/ai-workforce/sops" "200"
test_endpoint "Blog List" "$BASE_URL/api/blog" "200"
test_endpoint "Public Reviews" "$BASE_URL/api/reviews/public" "200"

echo ""
echo "--- Protected APIs (expect 401 without auth) ---"
test_endpoint "Settings (no auth)" "$BASE_URL/api/settings" "401"
test_endpoint "CRM (no auth)" "$BASE_URL/api/crm" "401"
test_endpoint "Files (no auth)" "$BASE_URL/api/files" "401"
test_endpoint "Super Admin (no auth)" "$BASE_URL/api/super-admin/command-center" "401"

echo ""
echo "=== Results: $PASS passed, $FAIL failed ==="
exit $FAIL
