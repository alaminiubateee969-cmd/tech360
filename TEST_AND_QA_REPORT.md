# Test and QA Report

**Continuation checkpoint:** 2026-09-30

## Authoritative CI evidence

GitHub Actions run **36629219425** on commit `f0f6f9c724bf86b6979b8200e3b622586044ac59` completed successfully in 1m37s.

Passed steps:

1. checkout;
2. tracked-file secret scan;
3. exact Bun lock installation;
4. Prisma client generation;
5. full ESLint;
6. full TypeScript check;
7. disposable SQLite schema creation (`db/validate.db`);
8. production standalone Next.js build.

Production deployment was correctly skipped because the validated ref was not `main`. No production infrastructure was changed.

Final GitHub Actions run **36629870815** on commit `5012df43ffe1e71f651e2821a0836febbc59cb91` passed exact dependency installation, Prisma generation, lint, full typecheck, all business-policy tests, read-only database verification, and the production build. The production deploy job was correctly skipped for the Arena branch.

## Local automated policy suite

Command: `npx tsx --test tests/**/*.test.ts`

Result: **10 passed, 0 failed** across three suites:

- RBAC hierarchy and anonymous denial;
- Super Administrator authority for pending approval decisions;
- handover release gate;
- handover full-payment gate;
- handover expiry gate;
- idempotent duplicate Stripe events;
- amount mismatch rejection;
- currency mismatch rejection;
- exact-match settlement decision;
- Stripe HMAC acceptance, tamper rejection and replay-window rejection.

The tested pure policies are used by the production webhook and handover routes, preventing tests from merely duplicating route logic.

## Database verification

Command: `python3 scripts/verify-database.py`

Result:

- integrity: `ok`;
- foreign-key violations: `0`;
- Prisma models: `43`;
- SQLite application tables: `43`;
- missing model tables: none;
- unexpected tables: none.

The script opens SQLite in read-only mode and does not change records.

## Local checks

- `npx eslint .`: PASS.
- `git diff --check`: PASS.
- secret-pattern scan: PASS.
- Prisma CDN TLS from this sandbox: BLOCKED before certificate validation; see `KNOWN_ISSUES_AND_BLOCKERS.md`.

## Coverage still required

The current suite is a meaningful first regression gate, not complete lifecycle certification. Still required:

- database-backed session and CSRF route tests;
- tenant/IDOR tests with two isolated portal clients;
- persisted proposal version and approval execution tests;
- failed settlement proving no project activation;
- complete isolated CRM → project → acceptance lifecycle;
- file upload/quarantine/access tests;
- provider sandbox acceptance tests;
- browser mobile/accessibility regression tests in maintained CI.

No production-data mutation was performed for testing.
