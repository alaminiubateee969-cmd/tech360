# Database Migration Plan

See root [`DATABASE_SCHEMA_AND_MIGRATION_GUIDE.md`](../DATABASE_SCHEMA_AND_MIGRATION_GUIDE.md).

Current state: 43 Prisma models match 43 checked-in SQLite tables at table coverage level; integrity is `ok` with zero foreign-key violations. A normal migration history is absent. Production baseline resolution remains blocked until an authorized production backup is restored and tested in isolation. Reset and `db push --accept-data-loss` are prohibited in production.
