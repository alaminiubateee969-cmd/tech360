#!/usr/bin/env bash
# RETIRED: this legacy Cloud SQL/Cloud Storage helper does not back up the
# current Hostinger MySQL database and previously suppressed file-copy errors.
# It must not be treated as a successful production backup procedure.
set -euo pipefail

cat >&2 <<'EOF'
ERROR: deployment/backup.sh is retired; it does not back up Hostinger production.

Do not use this script as evidence of a production backup. Have the authorized
Hostinger database owner confirm the available backup/restore controls, take a
backup using the verified provider workflow, and test restoring it in isolation.
EOF
exit 1
