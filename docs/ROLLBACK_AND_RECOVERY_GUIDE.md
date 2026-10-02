# Hostinger Deployment Recovery Guide

**Status:** this is a safety procedure, not evidence that Hostinger rollback or database restore has been configured or tested. Hostinger hPanel, deployment history, backup facilities, and restore access remain **NOT VERIFIED**.

## Before a production deployment that runs migrations

1. Record the GitHub repository, `main` branch, exact intended commit SHA, and the currently deployed commit shown in Hostinger.
2. Confirm the target is the Hostinger Node.js Web App using Node.js 22.x, npm, the Next.js `next` preset, and the repository root. Do not use the generic Website → Advanced → Git / `public_html` flow, Composer, PHP, SSH, PM2, rsync, or scp.
3. Have the database owner verify the Hostinger MySQL identity/version, the production `DATABASE_URL` configuration (without exposing its value), migration status, and current schema relative to the committed baseline.
4. Use Hostinger's documented/available backup process. Record the backup identifier and time, and verify restoration to an isolated MySQL instance before authorizing a migration. The Hostinger backup/restore procedure has not been verified by this repository audit.
5. Do not continue if the database is populated but its baseline/migration history is unresolved, if the backup cannot be restored, or if the rollback plan is ambiguous. Production migrations must use forward-only `prisma migrate deploy`; never run `db push`, `migrate dev`, or `migrate reset` against production.

## Application recovery

- Inspect the Hostinger deployment record and runtime/build logs for the failing and last known-good commit. Preserve logs and redact secrets/personal data.
- If Hostinger provides an appropriate tested redeploy/rollback action, use it only after confirming it restores a known-good application commit and does not delete or replace the MySQL database.
- Otherwise, prepare a reviewed Git revert on the fixed Arena repair branch and merge through the repository's normal review/CI process. Do not force-push or deploy from an unreviewed branch. A revert or redeploy does not automatically reverse a database migration.
- Verify the recovered Node.js process, actual platform port binding, homepage, `/api/health`, MySQL status, portal validation, protected API refusal, static assets, and HTTPS externally. Record the resulting commit and Hostinger logs.

## Database recovery

Database restoration is a separate, high-impact operator action. Restore a verified backup only with explicit database-owner approval after reviewing the recovery point and rows that may be lost. Test the restore against an isolated MySQL instance first. Never run an automatic database rollback or assume an application rollback undoes a successful migration.

No Hostinger deployment, production database migration, backup, restore, or rollback was performed during this audit.
