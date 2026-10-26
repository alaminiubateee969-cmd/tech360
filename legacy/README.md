# legacy/ — quarantined, **not part of the shipped platform**

Nothing in this directory is compiled, linted, type-checked, tested or deployed.
`tsconfig.json` and `eslint.config.mjs` exclude `legacy/**`; Next.js only builds
`src/app`, and no file in the shipped platform imports anything from here.

## What is `legacy/upload-prototype/`?

It is a **second, self-contained application** that arrived as
`upload/tech360-production-final` and was merged into `main` by PR #39
(merge commit `d8c73b1`). Its merge conflicts were committed **unresolved** —
`package.json` contained `<<<<<<<` markers and was not valid JSON, so the
repository could not install, build, test or run at all.

The shipped platform is the TECH360 LLC Enterprise Platform that lives in
`src/app`, `src/components/{site,admin}`, `src/lib`, `prisma/`, `tests/` and
`docs/`. The prototype is a different product generation ("BDTECH360"): its own
`page.tsx`, its own `layout.tsx`, NextAuth + bcrypt auth, and its own Prisma
models.

### Evidence that it was never wired in

| Check | Result |
|---|---|
| Imports from shipped code into these files | **0** (AST-level scan of all 826 canonical files) |
| TypeScript errors in shipped code | **0** |
| TypeScript errors in this prototype against the shipped schema | **471 in 94 files** |
| Prisma models it queries (`Agent`, `Visitor`, `NLCommand`, `FileItem`, `AIDepartment`, `AIAgent`, …) present in `prisma/schema.prisma` | **No** |
| Dependencies it needs (`next-auth`, `bcryptjs`) present in `package-lock.json` | **No** |
| Route/auth model compatible with the shipped scrypt session auth | **No** — parallel stack |

Keeping it on the build path made the whole repository unbuildable while adding
zero behaviour, so it was moved here (history preserved with `git mv`) instead
of being deleted.

## Resurrecting it

It needs to become its own branch again — it cannot coexist with the shipped app
in one Next.js tree, because both claim `/` (`src/app/page.tsx`), the root layout,
the Prisma schema, and the authentication stack.

1. Cut a branch from the merge commit `d8c73b1` (it contains this tree in place).
2. Add its dependencies (`next-auth`, `bcryptjs`) and restore its Prisma models.
3. Resolve `/`, the root layout and the schema in favour of exactly one app.

Deleted-from-build but preserved here: 223 files under `src/app`, `src/components`,
`src/lib`, `scripts`, `n8n`, `public/images/*-v2.png`, and the prototype's own
`Dockerfile`, `Dockerfile.n8n`, `cloudbuild.yaml`, `.gcloudignore`,
`FINAL_BUILD_REPORT.md`, `INSTALL.md`, `PRODUCTION.md`, `TEST_REPORT.md`,
`DATABASE_SETUP.md`.

Those root-level deployment files were also deliberately kept out of the build
path: `README.md` and `docs/OPERATIONS_GUIDEBOOK.md` state that the Cloud Run /
Cloud Build / Dockerfile deployment path is **retired** in favour of Hostinger,
so restoring them at the repository root would have re-introduced the second
deployment path the project had already removed.
