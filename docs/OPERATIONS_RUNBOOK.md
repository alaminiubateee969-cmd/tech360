# TECH360 Operations Runbook

## Repository/runtime standard

The application uses Node.js 22.x, npm (`package-lock.json`), Next.js standalone output, Prisma, and MySQL. GitHub Actions validates changes against disposable MySQL; it never uses production credentials.

## Routine validation

```bash
npm ci --no-audit --no-fund
npx prisma generate
npm run lint
npm run typecheck
npm test
npm run db:verify
npm run build
```

`npm run db:verify` is read-only and requires a reachable MySQL `DATABASE_URL`. Use a disposable/development database locally. Never point tests, schema generation, or CI at production.

After a successful standalone build, verify `.next/standalone/server.js`, `.next/standalone/.next/static`, and `.next/standalone/public` exist. For a local production smoke test use `npm run start`, not `npm run dev`; supply a temporary local `PORT` only for that local test. Do not guess Hostinger's port.

## Incident priorities

1. Preserve evidence and correlation IDs; redact credentials and personal data from notes.
2. Stop unsafe external sends or settlement paths through governance switches.
3. Do not delete audit/error records.
4. Verify the current GitHub commit, Hostinger build/runtime logs, database status, and backup state independently.
5. Roll back only through the reviewed recovery procedure; never reset production data.

## Integration activation

Environment-variable presence is not proof. Enable one provider at a time only after its signed/sandbox acceptance test. Never print credentials.

## Production checks

The intended runtime is a Hostinger **Node.js Web App** connected to `main`, using the Next.js `next` preset, Node.js 22.x, npm, hPanel build script `build` (`npm run build`), and output `.next`. Hostinger's documented Next.js preset starts its bundled standalone server; the repository's `npm run start` is for CI/manual smoke checks, not an assumed hPanel command. Verify the actual hPanel settings, managed start behavior, port binding, production database connection, domain routing, and live status directly. A Composer deployment or “publishing completed” message is not evidence of a Next.js runtime.

See [`DEPLOYMENT.md`](../DEPLOYMENT.md), [`HOSTINGER_DEPLOYMENT.md`](./HOSTINGER_DEPLOYMENT.md), and [`HOSTINGER_ENVIRONMENT_VARIABLES.md`](./HOSTINGER_ENVIRONMENT_VARIABLES.md). Do not mark production verified until `/`, `/api/health`, the protected API routes, HTTPS, MySQL, and Hostinger runtime logs have been checked.
