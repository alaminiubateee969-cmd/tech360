# Hostinger SSH recovery runbook

**Scope: recovery and inspection only.** The supported production path remains the
Hostinger Node.js Web App Git integration configured in hPanel (see
[`DEPLOYMENT.md`](../DEPLOYMENT.md) and [`HOSTINGER_DEPLOYMENT.md`](./HOSTINGER_DEPLOYMENT.md)).
Use SSH when a deploy is blocked, a migration must be inspected or resolved, or
the built-in pipeline needs evidence from the server itself.

Everything below was validated on the production account (Hostinger shared
hosting, CloudLinux, hPanel) on 2026-11-09 during the `93_post_review_grid`
P3009 incident. Never paste passwords, secrets, or connection strings into
commits, tickets, logs, or chat.

---

## 1. SSH shell and Node.js

Hostinger does **not** put Node.js on the default SSH `PATH`, and `nvm` is not
installed. The managed runtimes live under `/opt/alt/`:

```bash
export PATH=/opt/alt/alt-nodejs22/root/usr/bin:$PATH
node -v && npm -v     # expect v22.x — package.json requires >=22.0.0 <23
```

If that path is missing, locate the runtime first — do not guess:

```bash
ls -d /opt/alt/alt-nodejs*/root/usr/bin 2>/dev/null
ls -la ~/nodejs /opt/nodejs 2>/dev/null
```

Use Node 22 specifically. `~/nodejs` (a common hPanel convention) did not exist
on the account observed; `/opt/alt/alt-nodejs22/root/usr/bin` did.

## 2. Know which directory you are in

| Path | What it is | Use it? |
|---|---|---|
| `~/domains/<domain>/hbuilds/source/repository` | The full git clone | **Yes — work here** |
| `~/domains/<domain>/hbuilds/versions/<uuid>/nodejs` | A publish snapshot of one build | No — copies can be incomplete |
| `~/domains/<domain>/hbuilds/current` | Symlink to the active `versions/<uuid>` | Read-only reference |
| `~/domains/<domain>/public_html` | Web docroot | Never — it is not the app root |

An incomplete `versions/<uuid>/nodejs` tree was observed missing
`package-lock.json` and `scripts/prisma.mjs` (both are committed to the
repository), which breaks `npm ci` and `npm run build` in confusing ways. If a
build fails with `MODULE_NOT_FOUND … scripts/prisma.mjs` or `npm ci` claims
there is no lockfile, you are in a partial snapshot — switch to
`hbuilds/source/repository`.

```bash
cd ~/domains/<domain>/hbuilds/source/repository
ls package.json package-lock.json scripts/prisma.mjs   # all three must exist
git log --oneline -1                                    # know what is deployed
```

## 3. Environment variables

hPanel → Node.js Web App → Environment Variables are injected into the managed
runtime only. **They are not visible in an SSH shell.** Before running anything
that needs the database, load a `.env` from the app root (values copied from
hPanel; the MySQL endpoint must match hPanel → Databases exactly):

```bash
set -a; source .env; set +a
node -e 'const u=new URL(process.env.DATABASE_URL||"");console.log("DB:",u.protocol,u.hostname,u.pathname.slice(1),"user:",u.username)'
```

Keep `.env` out of git and `chmod 600`. Do not print or paste its contents.

## 4. Command rules

- **Never run bare `npx prisma …` on the server.** With no local install, `npx`
  downloads the latest prerelease CLI (observed: `prisma@8.0.0-rc.33`), whose
  commands differ (`migrate deploy` → `prisma db migrate`) and which lacks this
  repository's Prisma engine repair. It will either refuse the command or run a
  different Prisma than production expects.
- **Never run bare `next build`.** Use the npm scripts.
- **Always use the wrapper** `node scripts/prisma.mjs <args>` (or the npm
  aliases that call it). The wrapper restores executable bits on Prisma engine
  binaries — the documented Hostinger `EACCES` fix (see
  [`HOSTINGER_DEPLOYMENT.md`](./HOSTINGER_DEPLOYMENT.md) § "Prisma engine
  EACCES") — and executes the pinned Prisma 6.19.3 CLI.

Standard sequence in `hbuilds/source/repository`:

```bash
npm ci --no-audit --no-fund          # requires the committed package-lock.json
node scripts/prisma.mjs migrate status   # read-only: applied / pending / failed
node scripts/prisma.mjs migrate deploy   # forward-only; applies pending migrations
npm run build                            # generate + migrate deploy + next build + standalone copies
```

`npm run build` runs `prisma migrate deploy` against whatever `DATABASE_URL`
points at. Confirm the database identity and a recoverable backup first.

## 5. P3009 — a failed migration blocks all deploys

Prisma records every attempt in `_prisma_migrations`. While any row is marked
failed, `migrate deploy` refuses to run **any** migration (error `P3009`) and
every build dies before `next build`. `migrate resolve` is the supported way to
settle the record. **`migrate resolve` runs no SQL** — it only records the
decision.

### Incident note (2026-11-09)

`93_post_review_grid` was renamed from `13_post_review_grid` to fix
lexicographic apply order on fresh databases (Prisma applies migrations in
directory-name order; `13_…` sorted before `2_social_marketing`, so the
`PostReview` FK to `SocialPost` failed on new databases). A rename is invisible
to `_prisma_migrations`, which tracks migrations **by name**: databases already
migrated under the old name re-attempted the migration from scratch, hit
`CREATE TABLE PostReview` (table exists), and got a permanent failed row.

Policy consequence: **renaming a published migration is a breaking change for
every already-migrated database.** Prefer additive follow-up migrations. If a
rename must ship, run the resolution procedure below against each migrated
database as part of the rollout.

### Recovery procedure

**Step 0 — backup.** hPanel → Databases (export), or hPanel → Backups.

**Step 1 — inspect (read-only).** In phpMyAdmin or the `mysql` CLI against the
application database:

```sql
SELECT migration_name, started_at, finished_at, rolled_back_at,
       applied_steps_count, LEFT(logs, 800) AS logs
FROM _prisma_migrations
WHERE migration_name LIKE '%post_review%';

SHOW CREATE TABLE `PostReview`;
SELECT COUNT(*) FROM `PostReview`;
```

Note whether the failed row's `logs` show the first statement failing
(`Table 'PostReview' already exists` — nothing new applied), whether a row for
an older migration name is also present, and whether the table exists in the
migration's intended end state (including its foreign key).

**Step 2 — resolve the record**, matching what Step 1 showed:

| Actual state | Command |
|---|---|
| The migration's end state is fully in place | `node scripts/prisma.mjs migrate resolve --applied <name>` |
| Nothing (or nothing usable) was applied | `node scripts/prisma.mjs migrate resolve --rolled-back <name>` |
| Partially applied | Reconcile by hand first — complete the missing statements or remove the partial objects (restore from backup if unsure) — then resolve per the row above |
| A stale row under an old migration name is also failed | Resolve that row too (`--rolled-back` if the name is gone from the codebase) |

**Step 3 — redeploy and verify.**

```bash
node scripts/prisma.mjs migrate status    # must show no failed/pending rows
```

Then trigger a new deployment (hPanel → Node.js → Deployments) and verify from
outside:

```bash
curl -sS -D - https://bdtech360.com/api/health
```

Require HTTP 200 with `checks.database.status: "UP"`. See
[`DEPLOYMENT.md`](../DEPLOYMENT.md) for the full external checklist.

### Hard rules

- Never edit `_prisma_migrations` by hand — use `migrate resolve`.
- Never run `prisma db push`, `migrate reset`, or `migrate dev` against
  production. (`docs/deployment/ROLLBACK_GUIDE.md` §6 has the data-safety
  rationale.)
- Never delete a failed row to "unblock" a deploy; resolve it.

## 6. Related documents

- [`DEPLOYMENT.md`](../DEPLOYMENT.md) — intended production path and external verification
- [`HOSTINGER_DEPLOYMENT.md`](./HOSTINGER_DEPLOYMENT.md) — hPanel settings, evidence requirements, Prisma `EACCES` root cause
- [`HOSTINGER_ENVIRONMENT_VARIABLES.md`](./HOSTINGER_ENVIRONMENT_VARIABLES.md) — environment variable inventory
- [`deployment/ROLLBACK_GUIDE.md`](./deployment/ROLLBACK_GUIDE.md) — §6, when a migration itself failed
- [`DATABASE_SCHEMA_AND_MIGRATION_GUIDE.md`](../DATABASE_SCHEMA_AND_MIGRATION_GUIDE.md) — baseline and `migrate resolve` policy
