# Merge fix for alaminiubateee969-cmd/tech360 @ main (d8c73b1)

**Problem (Hostinger build 01a175a3, 2026-10-26):** `npm install`
fails with `EJSONPARSE — Merge conflict detected in package.json`.
The bad merge (PR #39) committed unresolved conflict markers into
four files. The GitHub connection used to prepare this fix is
read-only (`push=false`), so this folder contains the resolved
files, verified but not pushed. A writer applies it in ~5 minutes.

## Files to replace (same paths in that repo)

| File | Conflict hunks | Resolution |
|---|---|---|
| `package.json` | 6 | HEAD side everywhere |
| `tsconfig.json` | 1 | HEAD side |
| `next.config.ts` | 1 | HEAD side |
| `prisma/schema.prisma` | 3 | HEAD side |

## Why HEAD (evidence, not preference)

- **Lockfile:** every one of the 83 resolved dependencies exists in
  that repo's `package-lock.json`; the incoming-only `bcryptjs`
  does not. `@prisma/client` resolves to the lockfile's 6.19.3.
- **Database:** HEAD schema is **MySQL, 73 models**. The incoming
  side is **SQLite, 123 models** — merging it would silently switch
  the production database engine. Never do that.
- **Safety:** incoming scripts include `prisma db push
  --accept-data-loss`; HEAD scripts use the guarded
  `scripts/prisma.mjs` wrapper, prestart env validation, typecheck
  and tests. HEAD contains no destructive command.
- **Config:** HEAD `next.config.ts` sets the canonical origin
  `https://bdtech360.com` + standalone output; HEAD `tsconfig`
  excludes `deployment/`, `mini-services/`, `n8n/` as production
  config intends.

## Resolved-file verification performed

- `package.json`: valid JSON; markers: 0; deps vs lockfile: NONE
  missing; dangerous scripts: none.
- `tsconfig.json`: valid JSON; markers: 0.
- `prisma/schema.prisma`: markers: 0; braces balanced (75/75);
  datasource `mysql`. (`prisma validate/generate` could not run in
  the preparing sandbox — engine binaries unreachable there; run
  them in step 3 below, where they must pass before merging.)
- `next.config.ts`: markers: 0; canonical origin + standalone.

## Apply (writer, in alaminiubateee969-cmd/tech360)

```bash
git checkout main && git pull
git checkout -b fix/merge-conflict-resolution
# copy the four files from this folder over the repo paths
node scripts/check-conflict-markers.mjs   # add the gate too, if absent:
                                           # engralaminn-collab/tech360 scripts/ + tests/
npm ci
npx prisma validate && npx prisma generate
npm run build
git add package.json tsconfig.json next.config.ts prisma/schema.prisma
git commit -m "Resolve committed merge conflicts (HEAD production line: MySQL schema, lockfile-consistent deps)"
git push origin fix/merge-conflict-resolution
# open PR into main, merge after CI passes, then redeploy on Hostinger
```

Rollback: the PR is a normal commit — revert it to restore
`d8c73b1` exactly. No migrations were added or changed by this fix;
the schema file returns to the pre-merge HEAD content.
