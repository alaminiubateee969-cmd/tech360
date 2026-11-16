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

That policy is now enforced in code. `scripts/check-migration-immutability.mjs`
(`npm run migrations:check`, a CI gate) compares `prisma/migrations` with
`prisma/migration-manifest.json` and fails if a published migration is renamed,
deleted or edited, or if a new migration would sort *before* a published one.
New migrations must therefore sort last: `9_commerce_invoices_sequences` sorts
after every digit-only prefix (`"94_x" < "9_commerce_x"`, because `"4" < "_"`),
so the next generation is `v2_…`, then `v3_…`. Add a migration, then publish it
deliberately with `npm run migrations:publish`.

### Automatic reconciliation in the build (2026-11-12)

Hostinger's build is the only place migrations run, and the failed row can sit
under the *old* name (`13_post_review_grid`), which the doctor refuses to
resolve because that directory no longer exists. `npm run build` therefore runs
`scripts/prisma-migration-reconcile.mjs` between `prisma generate` and
`prisma migrate deploy`. It acts **only** when a `13_post_review_grid` /
`93_post_review_grid` row is failed, and decides from `information_schema`:

| Observed `PostReview` | Action |
|---|---|
| table + foreign key present | stale row rolled back, `93_post_review_grid` recorded applied |
| absent | row rolled back; `migrate deploy` applies `93_post_review_grid` |
| table without its FK, `SocialPost` present, no orphaned reviews | runs the migration's own `ADD CONSTRAINT`, then records applied |
| table without its FK, **empty**, FK cannot be added | drops the empty table, rolls back; deploy re-creates it |
| anything else (unexpected columns, orphaned rows) | **refuses**, changes nothing, build fails with the reason |

It never deletes a history row and never drops a table holding data. Failed
rows of any other migration are untouched and still need the manual procedure
below. `--dry-run` prints the plan only; `TECH360_MIGRATION_RECONCILE=off`
disables it. Covered by `tests/migration-reconcile.test.ts`.

### Recovery procedure

**Step 0 — backup.** hPanel → Databases (export), or hPanel → Backups.

**Step 1 — inspect (read-only), on the server, with the pinned Prisma:**

```bash
node scripts/prisma-migration-doctor.mjs          # add --json for machine-readable output
```

`scripts/prisma-migration-doctor.mjs` selects only from `_prisma_migrations` and
`information_schema`; it writes nothing. For every failed row it prints the
migration name, whether that name still exists in `prisma/migrations` (Prisma
resolves **by name**), which objects the migration creates that are present or
**MISSING** in the database, and a verdict:

| Verdict | Meaning | Direction to resolve |
|---|---|---|
| end state IS in place | every object the migration creates exists | `--applied` |
| nothing usable was applied | none of them exists | `--rolled-back` |
| PARTIALLY applied | some exist — MySQL DDL is not transactional | reconcile by hand first |
| cannot be verified | the SQL has no verifiable DDL, or the name is gone | inspect by hand |

No SSH or Prisma access? The same evidence is one command away as SQL for
phpMyAdmin — `node scripts/prisma-migration-doctor.mjs --sql` prints the
equivalent read-only queries. Read the `logs` tail: `Table 'PostReview' already
exists` means the first statement failed and nothing was applied.

**Step 2 — resolve the record**, using the verdict from Step 1. The doctor runs
the resolution for you, through `scripts/prisma.mjs` (engine repair, pinned
Prisma 6.19.3), after re-checking the state on the database:

```bash
node scripts/prisma-migration-doctor.mjs --resolve 93_post_review_grid --as applied     --confirm
node scripts/prisma-migration-doctor.mjs --resolve 93_post_review_grid --as rolled-back --confirm
```

Equivalent hand-run form, if the doctor cannot reach the database. Note that
`migrate resolve` needs the migration **directory** to exist; a name that was
renamed away from the codebase cannot be resolved until it is restored.

```bash
node scripts/prisma.mjs migrate resolve --applied     <name>   # end state in place
node scripts/prisma.mjs migrate resolve --rolled-back <name>   # nothing applied
```

| Actual state | Action |
|---|---|
| The migration's end state is fully in place | `--as applied` |
| Nothing (or nothing usable) was applied | `--as rolled-back` (the next `migrate deploy` re-applies it) |
| Partially applied | Reconcile by hand first — complete the missing statements or remove the partial objects (restore from backup if unsure) — then resolve per the row above, with `--force` only because you checked by hand |
| A stale failed row under an old migration name that is no longer in the codebase | Restore that directory from the commit that published it, then resolve it; do not invent objects |

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
- Never rename, delete or edit a migration that has been published; add a new
  one (`npm run migrations:publish` publishes it). CI enforces this.

## 6. Related documents

- [`DEPLOYMENT.md`](../DEPLOYMENT.md) — intended production path and external verification
- [`HOSTINGER_DEPLOYMENT.md`](./HOSTINGER_DEPLOYMENT.md) — hPanel settings, evidence requirements, Prisma `EACCES` root cause
- [`HOSTINGER_ENVIRONMENT_VARIABLES.md`](./HOSTINGER_ENVIRONMENT_VARIABLES.md) — environment variable inventory
- [`deployment/ROLLBACK_GUIDE.md`](./deployment/ROLLBACK_GUIDE.md) — §6, when a migration itself failed
- [`DATABASE_SCHEMA_AND_MIGRATION_GUIDE.md`](../DATABASE_SCHEMA_AND_MIGRATION_GUIDE.md) — baseline and `migrate resolve` policy
