#!/usr/bin/env bash
# ============================================================
# TECH360 — run a command on the Hostinger production server.
#
#   .github/scripts/hostinger-ssh.sh <<'EOF'
#   …remote script…
#   EOF
#
# Always uses:
#   BatchMode=yes                 no interactive prompts, fail fast
#   StrictHostKeyChecking=yes     host verification is never disabled
#   UserKnownHostsFile=<pinned>   only the key we pinned is trusted
#   -p $HOSTINGER_PORT            Hostinger's port, never 22
#
# Extra remote environment can be passed in REMOTE_ENV, e.g.
#   REMOTE_ENV="APP_DIR='/home/u.../app'"
# ============================================================
set -euo pipefail

: "${HOSTINGER_HOST:?HOSTINGER_HOST is required}"
: "${HOSTINGER_PORT:?HOSTINGER_PORT is required}"
: "${HOSTINGER_USER:?HOSTINGER_USER is required}"
: "${HOSTINGER_SSH_KEY_FILE:?run hostinger-ssh-setup.sh first}"
: "${HOSTINGER_KNOWN_HOSTS:?run hostinger-ssh-setup.sh first}"

exec ssh \
  -i "$HOSTINGER_SSH_KEY_FILE" \
  -p "$HOSTINGER_PORT" \
  -o BatchMode=yes \
  -o StrictHostKeyChecking=yes \
  -o UserKnownHostsFile="$HOSTINGER_KNOWN_HOSTS" \
  -o ConnectTimeout=20 \
  -o ServerAliveInterval=15 \
  "$HOSTINGER_USER@$HOSTINGER_HOST" \
  "${REMOTE_ENV:-} bash -s"
