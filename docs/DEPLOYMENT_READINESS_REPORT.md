# Deployment Readiness

Status: **DEPLOYMENT_BLOCKED**

## Passed source gates

- Exact Bun lock installation
- Prisma generation
- ESLint and full TypeScript validation
- Isolated database tests
- Read-only checked-in database integrity
- Standalone production build
- Secret-pattern scan

## Blocking infrastructure/database gates

- Production server identity and access not supplied or verified
- Application path/runtime/process manager unknown
- Production environment values not inspected
- DNS/TLS/firewall state not verified
- Production database identity unknown
- No verified production backup restore test
- Migration baseline not resolved against a restored production copy
- Monitoring and rollback not exercised on the actual target
- No explicit release authorization for a verified server

No production changes are permitted until these facts are available. See `DEPLOYMENT.md` and `DATABASE_SCHEMA_AND_MIGRATION_GUIDE.md`.
