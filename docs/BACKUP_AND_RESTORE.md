# TECH360 — Database Backup and Restore

**Status: tooling implemented and unit/behaviour-tested. A real MySQL backup and a real restore
drill have NOT yet been executed against production — status is UNVERIFIED until an operator runs
the two commands in §6 and records the output.**

Last updated: 2026-10-24 · Owner: platform owner (Hostinger account holder)

---

## 1. Why this exists

The application previously reported backup state honestly but nothing created a backup. This
document defines the actual mechanism: two shell scripts, a host scheduler, a retention policy, an
optional off-server copy, and the evidence trail the Super Admin console reads.

The console **never** claims a backup ran unless the runner left a record (`last-run.json`). That is
deliberate: a configuration value is not evidence.

---

## 2. Components

| File | Purpose |
|---|---|
| `scripts/backup/mysql-backup.sh` | takes a consistent, compressed, checksummed dump; verifies it; applies retention; optional off-server copy; records evidence |
| `scripts/backup/mysql-restore-drill.sh` | restores the newest dump into an isolated `tech360_drill_*` database, compares it with production, records PASS/FAIL |
| `tests/backup-tooling.test.ts` | 15 behavioural tests of the wrapper (locking, secrets, integrity, retention, safety rails) using stubbed MySQL binaries |
| `GET /api/admin/backup` | Super Admin view: artefacts, last scheduled run, last drill, health verdict |
| `#/admin` → System → **Backup & Recovery** | the operator-facing panel |

---

## 3. What the backup script does

1. **Refuses to run** unless `DATABASE_URL` is a `mysql://` URL (a SQLite/preview configuration can
   never be mistaken for production).
2. **Refuses to write inside the web root** (`/public/`, `/.next/`).
3. Creates the target directory with mode `700`; files are `600`.
4. Takes a `flock` lock — a second concurrent run exits `75` instead of colliding.
5. Writes credentials to a mode-`600` temporary defaults file, **never** on the command line or in
   the environment used for the dump; the file is deleted on exit (including on failure).
6. Runs `mysqldump` with:
   `--single-transaction` (InnoDB consistent snapshot, writers not blocked),
   `--quick`, `--skip-lock-tables`, `--routines --triggers --events`,
   `--no-tablespaces`, `--set-gtid-purged=OFF`, `--default-character-set=utf8mb4`, `--hex-blob`,
   `--skip-add-locks`, `--complete-insert`.
7. Compresses with `gzip -9`, writes `SHA-256`, and only then verifies:
   gzip integrity **and** checksum **and** the `-- Dump completed` marker **and** that at least one
   `CREATE TABLE` is present. Any failure ⇒ exit `4` and status `FAILED`.
8. Applies retention (see §5).
9. Optionally copies off-server (see §4.3).
10. Writes `last-run.json` (mode `600`) with status, file, size, tables, checksum, duration,
    offsite result and retention counters.

**Exit codes:** `0` success · `2` configuration refused · `3` dump failed · `4` integrity failed ·
`5` off-server copy failed · `75` another run is already in progress.

**Consistency caveat:** `--single-transaction` guarantees a consistent snapshot for **InnoDB** tables.
The TECH360 schema is InnoDB, so this is sound. If a MyISAM/ARCHIVE table is ever added, that table is
not transaction-safe and the dump takes short table locks for it.

---

## 4. Hosting reality (Hostinger) and how to schedule this

### 4.1 What the application can prove

The application is a Node.js Web App on Hostinger. It has **no** scheduler of its own for shell
commands and no root access. The application therefore cannot start `mysqldump`; the backup must be
triggered by the host.

### 4.2 Recommended trigger: hPanel cron job

Hostinger's hPanel offers cron jobs (`Advanced → Cron Jobs`) for the hosting account/website. Configuration:

| Field | Value |
|---|---|
| Command | `bash /home/<ACCOUNT>/tech360/scripts/backup/mysql-backup.sh >> /home/<ACCOUNT>/tech360-backups/cron.log 2>&1` |
| Schedule | `15 2 * * *` (daily, 02:15 server time) |
| Environment | export `DATABASE_URL`, `TECH360_BACKUP_DIR` (see §4.4) |

Why 02:15: outside business hours (Dhaka business day starts ~09:00), and not on the hour, so a busy
host queue does not delay it. `flock` guarantees a delayed run can never overlap the next one.

> **Verified?** No. This repository cannot read the hPanel configuration. Whether a cron job exists,
> what command it runs, and whether it executes are all **UNVERIFIED** until an operator confirms it
> in hPanel and in `backup.log`.

### 4.3 Off-server copy

A backup on the same host is not disaster recovery. Configure one of:

```bash
# rclone remote (recommended: any S3/B2/Drive backend)
TECH360_BACKUP_OFFSITE="rclone:tech360-backups:mysql"

# or a second server over SSH with a pre-installed key
TECH360_BACKUP_OFFSITE="scp:backup@backup-host.example:/srv/tech360/backups"
```

If the client binary is missing the run still succeeds and records `offsite: NOT_AVAILABLE`; if the
copy **fails** the run exits `5` (the local backup is valid, but the job is not complete and the
console shows the failure).

### 4.4 Where to put the secrets

Never inline `DATABASE_URL` in a crontab that other users can read. Put the environment in a
mode-`600` file and source it from a small wrapper:

```bash
# /home/<ACCOUNT>/.tech360-backup.env   (chmod 600, never committed)
export DATABASE_URL='mysql://USER:PASSWORD@localhost:3306/DATABASE'
export TECH360_BACKUP_DIR='/home/<ACCOUNT>/tech360-backups'
export TECH360_BACKUP_OFFSITE='rclone:tech360-backups:mysql'
export TECH360_BACKUP_ALERT_WEBHOOK='https://...'   # optional
```

```bash
# /home/<ACCOUNT>/tech360-backup-cron.sh   (chmod 700)
#!/usr/bin/env bash
set -euo pipefail
set -a; . /home/<ACCOUNT>/.tech360-backup.env; set +a
exec bash /home/<ACCOUNT>/tech360/scripts/backup/mysql-backup.sh
```

Cron command: `bash /home/<ACCOUNT>/tech360-backup-cron.sh >> /home/<ACCOUNT>/tech360-backups/cron.log 2>&1`

`cron` also mails any output to the account's `MAILTO` address — a non-zero exit with the failure line
is the simplest alert. The optional `TECH360_BACKUP_ALERT_WEBHOOK` posts a small JSON payload
(`source`, `status`, `code`, `message`, `host`, `database`, `at`) and **never** includes credentials or
data.

### 4.5 If hPanel cron is not available

Fall back to either:

* a Hostinger-side scheduled task in the same account, or
* an external scheduler (GitHub Actions `schedule`, a monitoring service) that runs the same wrapper on
  a self-hosted runner with network access to the database. Do **not** put the database credentials in
  a public CI workflow.

Whatever the trigger, record it in `BACKUP_SCHEDULE` so the console shows the documented schedule
instead of a generic note.

---

## 5. Retention policy

| Tier | Default | Meaning |
|---|---|---|
| Daily | 7 | every backup younger than 7 days is kept |
| Weekly | 4 | for older files, the newest backup of each of the last 4 ISO weeks is kept |
| Monthly | 3 | likewise, the newest of each of the last 3 months |

Everything else (with its `.sha256`) is deleted and logged as `RETENTION_DELETE`. The file just
written is never pruned. Override with `TECH360_BACKUP_RETENTION_DAILY|WEEKLY|MONTHLY`.

`last-run.json`, `last-drill.json` and `cron.log` are never touched by retention.

---

## 6. The two operator commands (run these once now, then monthly)

### 6.1 Take and verify a real backup

```bash
set -a; . ~/.tech360-backup.env; set +a
bash scripts/backup/mysql-backup.sh
echo "exit=$?"
cat "$TECH360_BACKUP_DIR/last-run.json"
bash scripts/backup/mysql-backup.sh --verify-only "$TECH360_BACKUP_DIR/<file>.sql.gz"
```

Expected: exit `0`, `"status":"OK"`, a `.sql.gz` and its `.sha256`, and `VERIFY_OK`.

### 6.2 Monthly restore drill (isolated, never production)

```bash
bash scripts/backup/mysql-restore-drill.sh --target-database "tech360_drill_$(date +%Y%m%d)"
echo "exit=$?"
cat "$TECH360_BACKUP_DIR/last-drill.json"
```

Safety rails enforced by the script itself:

* the target database name **must** start with `tech360_drill_`;
* the target must differ from the database in `DATABASE_URL`;
* an existing target is refused unless `--reuse` is passed;
* production is only ever read (`SELECT`/`SHOW`);
* the scratch database is dropped at the end unless `--keep`.

The drill compares the table count and exact row counts for `User`, `Client`, `Project`, `Invoice`,
`Payment`, `ApprovalRequest` and `AiAgent`. Any mismatch fails the drill (`exit 4`).

A drill PASS writes `last-drill.json` and (when it can) the `Setting` row `backup.restore_test`, which
is what the console shows as "restore proven".

### 6.3 Evidence to record

Log the following in the operations log (never the credentials):

```
date:
backup file: <name>  size: <bytes>  sha256: <first 12 hex>
backup exit code: 0
drill target: tech360_drill_<date>
drill result: PASS  tables: <n>  mismatches: none
offsite: COPIED / NOT_CONFIGURED
```

---

## 7. Recovery procedure (real disaster)

1. **Stop writes**: Settings → Maintenance Mode on; disable `payments` and `client_portal`.
2. Confirm the failure is the database, not the app (`/api/health`).
3. Choose the newest backup whose `.sha256` verifies (`--verify-only`).
4. Restore to a **new** database first (e.g. `tech360_restore_<date>`), then point `DATABASE_URL` at it
   — never load a dump over a database you might still recover.
5. Run `npm run db:verify` and start the app; check `/api/health`, one admin login, one portal login.
6. Only after verification, retire the old database.
7. Record the timeline, the backup used, and the data-loss window (from the dump timestamp to the
   failure).

**RPO/RTO, honestly:** with a daily 02:15 backup the recovery point objective is up to ~24 h and the
recovery time objective depends on the restore duration measured in §6.2. Once the drill has been run
and timed, record the measured RTO here.

---

## 8. Limitations (read before claiming protection)

1. **Unverified in production** until §6.1 and §6.2 have been executed on the host with the real
   MySQL server and the output recorded.
2. The application cannot trigger or schedule the backup; it only reports on records the runner writes.
   If the host scheduler is not configured, no backup exists no matter what the console says (it will
   say `NO_ARTIFACTS` / `UNVERIFIED`).
3. Local backups share the host's failure domain. Off-server copy (§4.3) is what makes this disaster
   recovery rather than host-level rollback.
4. A backup is only proven by a restore. The console reports "restore proven" solely from a drill
   record.
5. Encryption at rest is the storage provider's responsibility; files are `600` and outside the web
   root. Add `age`/`gpg` at the off-server step if the storage provider is not trusted.
6. The dump contains personal data. Treat backup files as `CONFIDENTIAL` under the privacy policy,
   apply the retention limits to copies as well, and delete them when no longer required.
