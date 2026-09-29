# TECH360 Operations Runbook

## Routine validation

```bash
bun install --frozen-lockfile
bunx prisma generate
bun run lint
bun run typecheck
bun run test
bun run db:verify
bun run build
```

Tests use disposable databases in CI. Never point test commands at production.

## Incident priorities

1. Preserve evidence and correlation IDs.
2. Stop unsafe external sends or settlement paths through governance switches.
3. Do not delete audit/error records.
4. Verify database integrity and current release.
5. Roll back only through the reviewed recovery procedure.

## Integration activation

Environment-variable presence is not proof. Enable one provider at a time only after its signed/sandbox acceptance test. Never print credentials.

## Production

Use `scripts/health-check.sh` only after discovering the real app port and server. Follow `DEPLOYMENT.md`; production remains blocked until `docs/DEPLOYMENT_READINESS_REPORT.md` gates pass.
