# Rollback and Recovery Guide

1. Record current release, process manager, port and database checksum.
2. Create application Git bundle and transaction-consistent database backup.
3. Restore both to an isolated location and run database integrity plus application health checks.
4. Deploy only after restore evidence exists.
5. On failure, stop new release, restore prior commit/artifact and restart the discovered process manager.
6. Restore the database only when the reviewed migration requires it and authorization is explicit.
7. Run health, authentication, public, portal and data-integrity checks.
8. Record timestamps and evidence.

Hostinger owns deployment/runtime rollback facilities. This repository does not SSH into production or perform remote rollback; use a normal Git revert and Hostinger's deployment history after verifying the target configuration.
