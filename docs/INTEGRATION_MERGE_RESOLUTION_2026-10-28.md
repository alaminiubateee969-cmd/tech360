# Merge resolution — PR #43 (`integration/tech360-merge` → `main`)

Date: 2026-10-28
Status: **resolved, non-destructive**. Every incoming file is retained; no production contract changed.
Machine-readable record: [`docs/integration-merge-manifest.json`](./integration-merge-manifest.json)

---

## 1. What this merge actually was

PR #43 reported 24 conflicting files. The real shape of the merge is different:

| Fact | Value |
|---|---|
| Merge base between `integration/tech360-merge` and `main` | **none** — unrelated histories |
| Actual add/add conflicts produced by git | **95** |
| Files the incoming branch adds that `main` lacked | 224 |
| …of those, byte-identical to a copy already in `main` | 223 (all under `legacy/upload-prototype/`) |
| Incoming files with no counterpart in `main` | 1 (`next-env.d.ts`, generated and gitignored) |

`main` and the incoming branch are **two parallel builds of TECH360**, not a branch that
drifted from `main`. That is why the count kept changing: GitHub shows the files it could
pair up, git finds 95 real conflicts once the histories are merged.

The incoming tree also carries a **second application** — `prisma/schema.prisma` there is
2,046 lines with 140 model/enum declarations (91 of them `AIAgent`, `AIWorkflow`,
`AIRAGDocument`, `AIMCPServer`, … style), against `main`'s 1,779-line, 75-declaration
schema (`AiAgent`, `AgentJob`, `ChatMessage`, `GeneratedApp`, `MediaJob`, …).

## 2. Why the incoming configuration could not be taken live

Three incoming files are mutually destructive with the production deployment. These are
the same three findings the automated review flagged, and the evidence is in the branch
itself:

1. **`prisma/schema.prisma` — `provider = "sqlite"`, while the same branch's
   `prisma/migrations/migration_lock.toml` says `provider = "mysql"`, its
   `0_init/migration.sql` is MySQL DDL (`CREATE TABLE \`User\` … VARCHAR(191)`), and
   `.github/workflows/ci.yml` supplies a `mysql://` `DATABASE_URL`.
   The incoming branch is internally inconsistent: its schema and its migrations describe
   **different databases**. Taken live, `prisma generate` would emit a client for tables
   the migrations never create, and `prisma migrate deploy` would drift or fail.
   It also drops two migrations `main` has: `2_social_marketing` and
   `12_factory_scope_binding`.
2. **`package.json` → `start`** — replaced the Node.js
   `scripts/start-production.mjs` preflight wrapper with
   `bun .next/standalone/server.js`. Bun is neither a dependency nor installed by CI, so
   `npm start` would stop working on the documented Node.js 22 host, and the production
   environment preflight would be bypassed.
3. **`package.json` → `build`** — dropped `node scripts/prisma.mjs generate` and
   `node scripts/prisma.mjs migrate deploy` from the build. The documented Hostinger flow
   runs `npm run build`, so a fresh deployment would never create its tables and later
   deployments would never apply committed migrations.

Taking the incoming side of those files would have replaced the production database
contract with the prototype's, for no functional gain (the migration history in the
incoming branch is an older snapshot of `main`'s own).

## 3. What was done

The merge was performed with `--allow-unrelated-histories` and every conflict was
resolved **without discarding anything**:

* **Live paths keep the maintained version.** All 95 conflicted files keep the `main`
  version at their real path, so the MySQL datasource, the Node.js start wrapper, the
  build-time migration deploy, the `next.config.ts` redirects/security headers and the
  lazy Prisma client are unchanged. `git diff` against `main` for these paths is empty.
* **Every incoming version is preserved verbatim** under
  `legacy/integration/2026-10-28/<original path>` — all 95 files, hash-identical to the
  source branch (verified blob-by-blob; see `byteIdenticalToIncoming` in the manifest).
  `legacy/**` is already excluded from `tsconfig.json` and `eslint.config.mjs`, so the
  preserved tree is inert: it cannot affect typecheck, lint or the Next.js build.
* **The 224 incoming-only files are already in `main`.** 223 are byte-identical copies
  under `legacy/upload-prototype/` (no duplication was added); the remaining one,
  `next-env.d.ts`, is generated and gitignored.

Net effect on the working tree: **95 files added under `legacy/integration/2026-10-28/`,
0 files changed, 0 files deleted.** Both histories are now joined, so PR #43's branch is
no longer conflicting.

## 4. Verification

| Check | Result |
|---|---|
| `git diff --diff-filter=D main` | 0 deletions |
| Preserved files vs source branch | 95/95 hash-identical, 0 mismatches |
| `npm run check:conflicts` | pass — 1,227 tracked files scanned |
| `npm run typecheck` (`tsc --noEmit`) | pass |
| `npm run lint` | pass |
| `npm run schema:check` | pass — `provider=mysql`, 178 native type annotations |
| `tests/schema-ddl-parity.test.ts` + `tests/migration-parity.test.ts` | pass — 23/23 |
| `npm test` | 1,038 / 1,041 pass |

The three failing tests are `tests/database-workflows.test.ts`, `tests/governance-db.test.ts`
and `tests/governance-outbound-db.test.ts`. They fail in this sandbox with
`@prisma/client did not initialize yet` because `prisma generate` needs
`binaries.prisma.sh`, which is unreachable here. **The same three fail identically on an
unmodified `main` checkout**, so they are environmental, not caused by this merge; CI
generates the client before running them. `npm run build` was likewise not run locally for
the same reason and is left to CI.

## 5. Follow-ups (decisions, not blockers)

1. **The AI*\* schema set.** The preserved schema in
   `legacy/integration/2026-10-28/prisma/schema.prisma` contains domain models `main` does
   not have. Adopting them is a schema-design decision, not a merge: it requires the
   models to be authored against `main`'s MySQL schema and a new migration generated from
   it (`npm run schema:check` and `tests/migration-parity.test.ts` enforce the pairing).
   Do **not** copy that file over `prisma/schema.prisma`.
2. **Flipping any single file.** Each preserved copy is a drop-in replacement at its
   original path; `cp legacy/integration/2026-10-28/<path> <path>` restores the incoming
   version for one file if that is ever wanted. Re-run the checks above afterwards.
3. **Pruning.** Once the AI\* model question is settled, the
   `legacy/integration/2026-10-28/` tree can be deleted in a single commit; it exists only
   so that nothing from the incoming branch is lost.
