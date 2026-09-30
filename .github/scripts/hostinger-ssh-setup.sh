#!/usr/bin/env bash
# ============================================================
# TECH360 — Hostinger deployment SSH setup (GitHub Actions runner side)
#
# Creates ~/.ssh, writes the deploy key, and pins the Hostinger host key.
# Sourced/called by every job that needs to reach the Hostinger server.
#
# Contract:
#   - ~/.ssh is ALWAYS created before anything is written into it
#     (the previous implementation ran `install … ~/.ssh/id_tech360` on a
#      runner where ~/.ssh did not exist, which is the failure this fixes)
#   - the key is refused if empty
#   - CRLF is normalised (GitHub secret editors often introduce it)
#   - key mode 600, directory mode 700
#   - host key is pinned via ssh-keyscan into a dedicated known_hosts file;
#     host verification is NEVER disabled
#   - the Hostinger SSH port is used verbatim — there is no port 22 fallback
#
# Required env:
#   HOSTINGER_HOST, HOSTINGER_PORT, HOSTINGER_SSH_KEY
#
# Exports (via $GITHUB_ENV when available):
#   HOSTINGER_SSH_KEY_FILE, HOSTINGER_KNOWN_HOSTS, HOSTINGER_SSH_OK
# ============================================================
set -euo pipefail

KEY_FILE="$HOME/.ssh/id_hostinger_tech360"
KNOWN_HOSTS="$HOME/.ssh/known_hosts_hostinger_tech360"

[ -n "${HOSTINGER_SSH_KEY:-}" ] || { echo "::error::HOSTINGER_SSH_KEY is empty or unset"; exit 1; }
[ -n "${HOSTINGER_HOST:-}" ]    || { echo "::error::HOSTINGER_HOST is empty or unset"; exit 1; }
[ -n "${HOSTINGER_PORT:-}" ]    || { echo "::error::HOSTINGER_PORT is empty or unset"; exit 1; }

if [ "$HOSTINGER_PORT" = "22" ]; then
  echo "::error::port 22 is not the Hostinger SSH port — refusing to continue"
  exit 1
fi

# 1. the directory must exist BEFORE the key is written
mkdir -p "$HOME/.ssh"
chmod 700 "$HOME/.ssh"

# 2. write the key (CR stripped), then lock it down
printf '%s\n' "$HOSTINGER_SSH_KEY" | tr -d '\r' > "$KEY_FILE"
chmod 600 "$KEY_FILE"

if [ ! -s "$KEY_FILE" ]; then
  echo "::error::deployment key is empty after write"
  rm -f "$KEY_FILE"
  exit 1
fi
if ! grep -q 'BEGIN .*PRIVATE KEY' "$KEY_FILE"; then
  echo "::error::HOSTINGER_SSH_KEY does not look like a PEM private key"
  rm -f "$KEY_FILE"
  exit 1
fi
echo "✓ deploy key written to ${KEY_FILE##*/} (mode 600)"

# 3. pin the host key — strict verification, never accept-new
: > "$KNOWN_HOSTS"
chmod 600 "$KNOWN_HOSTS"
ssh-keyscan -T 20 -p "$HOSTINGER_PORT" "$HOSTINGER_HOST" >> "$KNOWN_HOSTS" 2>/dev/null || true
if [ ! -s "$KNOWN_HOSTS" ]; then
  echo "::error::could not fetch the Hostinger host key on port $HOSTINGER_PORT"
  echo "::error::the server is unreachable, or the port is wrong — refusing to deploy"
  rm -f "$KEY_FILE"
  exit 1
fi
echo "✓ host key pinned ($(wc -l < "$KNOWN_HOSTS") entries)"

if [ -n "${GITHUB_ENV:-}" ]; then
  {
    echo "HOSTINGER_SSH_KEY_FILE=$KEY_FILE"
    echo "HOSTINGER_KNOWN_HOSTS=$KNOWN_HOSTS"
  } >> "$GITHUB_ENV"
fi
