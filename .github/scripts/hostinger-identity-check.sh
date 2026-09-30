#!/usr/bin/env bash
# ============================================================
# TECH360 — Hostinger deployment identity gate.
#
# Asserts that the configured GitHub Environment secrets point at the
# Tech360 production server and nothing else. If they disagree, the
# deployment stops here rather than silently shipping to another host.
#
# The expected host/port/user are NOT secrets — they are the published
# production identity supplied by the project owner. Keeping them in the
# repository is what makes the assertion meaningful: a changed secret is
# caught, instead of being trusted blindly.
#
# Nothing secret is ever printed. The SSH key is only checked for
# presence and shape, never echoed.
# ============================================================
set -euo pipefail

EXPECTED_HOST="189.49.97.102"
EXPECTED_PORT="65002"
EXPECTED_USER="u394009794"

fail=0
req() {
  local name="$1" value="$2"
  if [ -z "$value" ]; then
    echo "::error::secret $name is not set in the 'production' environment"
    fail=1
    return 1
  fi
  echo "✓ $name is set"
}

echo "── required deployment secrets ──"
req HOSTINGER_HOST      "${HOSTINGER_HOST:-}"     || true
req HOSTINGER_PORT      "${HOSTINGER_PORT:-}"     || true
req HOSTINGER_USER      "${HOSTINGER_USER:-}"     || true
req HOSTINGER_SSH_KEY   "${HOSTINGER_SSH_KEY:-}"  || true
req HOSTINGER_APP_DIR   "${HOSTINGER_APP_DIR:-}"  || true

echo
echo "── production identity ──"

if [ -n "${HOSTINGER_HOST:-}" ] && [ "$HOSTINGER_HOST" != "$EXPECTED_HOST" ]; then
  echo "::error::HOSTINGER_HOST does not match the expected Tech360 production host"
  echo "::error::refusing to deploy to an unexpected server"
  fail=1
elif [ -n "${HOSTINGER_HOST:-}" ]; then
  echo "✓ host matches the expected production host"
fi

if [ -n "${HOSTINGER_PORT:-}" ]; then
  if [ "$HOSTINGER_PORT" = "22" ]; then
    echo "::error::port 22 is not the Hostinger SSH port — refusing"
    fail=1
  elif [ "$HOSTINGER_PORT" != "$EXPECTED_PORT" ]; then
    echo "::error::HOSTINGER_PORT is not the expected Hostinger SSH port ($EXPECTED_PORT)"
    fail=1
  else
    echo "✓ port matches the expected Hostinger SSH port ($EXPECTED_PORT)"
  fi
fi

if [ -n "${HOSTINGER_USER:-}" ] && [ "$HOSTINGER_USER" != "$EXPECTED_USER" ]; then
  echo "::error::HOSTINGER_USER does not match the expected Hostinger account"
  fail=1
elif [ -n "${HOSTINGER_USER:-}" ]; then
  echo "✓ user matches the expected Hostinger account"
fi

# The application directory must be absolute and must never be guessed.
case "${HOSTINGER_APP_DIR:-}" in
  "") ;;
  /*) echo "✓ HOSTINGER_APP_DIR is an absolute path" ;;
  *)  echo "::error::HOSTINGER_APP_DIR must be an absolute path"; fail=1 ;;
esac
case "${HOSTINGER_APP_DIR:-}" in
  /|/root|/home|/tmp|/var|/usr|/etc)
    echo "::error::HOSTINGER_APP_DIR '$HOSTINGER_APP_DIR' is a system directory — refusing"
    fail=1 ;;
esac

# Shape-only validation of the key. Never printed, never logged.
if [ -n "${HOSTINGER_SSH_KEY:-}" ]; then
  if printf '%s' "$HOSTINGER_SSH_KEY" | grep -q 'BEGIN .*PRIVATE KEY'; then
    echo "✓ HOSTINGER_SSH_KEY looks like a PEM private key"
  else
    echo "::error::HOSTINGER_SSH_KEY is not a PEM private key (paste the whole file, including the BEGIN/END lines)"
    fail=1
  fi
fi

echo
if [ "$fail" -ne 0 ]; then
  echo "::error::DEPLOYMENT_BLOCKED — the Hostinger deployment identity is not verified"
  exit 1
fi
echo "identity verified — safe to open an SSH session"
