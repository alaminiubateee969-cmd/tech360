# Rollback and Recovery Guide

1. Record current release, process manager, port and database checksum.
2. Create application Git bundle and transaction-consistent database backup.
3. Restore both to an isolated location and run database integrity plus application health checks.
4. Deploy only after restore evidence exists.
5. On failure, stop new release, restore prior commit/artifact and restart the discovered process manager.
6. Restore the database only when the reviewed migration requires it and authorization is explicit.
7. Run health, authentication, public, portal and data-integrity checks.
8. Record timestamps and evidence.

`scripts/deploy-hostinger.sh` contains an automatic error trap, but it is not considered verified on production until tested against the actual target.
