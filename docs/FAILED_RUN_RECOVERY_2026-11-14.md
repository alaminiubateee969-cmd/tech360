# Failed-run and missing-file reconciliation — 2026-11-14

Audited baseline: `511cb6ec57d6f58df38d78e3d8759a8a62d03ab4` (PR #74 merge).
This is a source/history audit, **not production acceptance**. The production blockers in
`KNOWN_ISSUES_AND_BLOCKERS.md` still apply.

## Result

A failed Actions run is not necessarily a failed merge. The failed runs supplied by the owner
are historical: their commits are already ancestors of the baseline. Re-merging those branches
would not recover new application files. No application changes were needed or invented to
make this audit appear to repair something.

The wider search retrieved **416 Actions runs and 74 pull requests**:

- 242 successful runs, 147 failed runs, 27 cancelled runs.
- **171 of the 174 failed/cancelled runs have their exact head commit in the baseline history.**
- The other three runs are explicitly explained below; none contains an omitted application feature.
- 72 PRs report merged; two report closed (#9 and #43). PR state alone was not used as proof
  of whether source was retained.

The complete run IDs, URLs, SHAs, dispositions and PR inventory are in
[`failed-run-recovery-2026-11-14.json`](failed-run-recovery-2026-11-14.json).
This includes additional runs beyond the owner's list, rather than only its examples.

## Exceptions investigated (not silently discarded)

| Candidate | Evidence / outcome |
|---|---|
| `arena/ad2cfb88-tech360`, PR #71, runs `43073529776`, `43036356201`, `43034240194`, `43073577577`, `43073535206` | Exact commits integrated. REA Studio routes/services, reconstruction, teardown, evolution policy and approval-gated loop are present in `src/`. No lost feature found. |
| `arena/2a5dc330-tech360`, commit `29600d6` | Squashed into `286c433` (PR #15). Both commits have stable patch ID `a2fae0168d0b8f9f058b000e388f6e581c63fae2`. `.npmrc` includes dev build dependencies and `tw-animate-css` is a runtime dependency. No missing patch. |
| `arena/c73361e4-tech360`, PR #65 / `d3a4122` | Reverse merge of main into feature branch; the merge tree is identical to its first parent. Application work already integrated by PR #64. No additional files. |
| `arena/e1474e5a-tech360`, PR #63 / `2bf3027` | Reverse merge with a tree identical to its first parent. Application work already integrated by PR #62. No additional files. |
| Closed PR #43, `integration/tech360-merge` | Source history already joined. All 95 conflicted incoming versions are retained byte-for-byte under `legacy/integration/2026-10-28/`; all 95 blob hashes reverified. See `INTEGRATION_MERGE_RESOLUTION_2026-10-28.md` and its manifest for the 223 existing prototype counterparts and generated `next-env.d.ts`. The prototype's conflicting database/start configuration must not replace the maintained MySQL/Node app. |
| Closed PR #9, `fix/hostinger-main-auto-deploy`, failed run `36726232247`, SHA `10a1e6b` | Three unmerged commits alter only the retired SSH/VPS deployment workflow and script, switching them to Bun. Superseded by integrated `16d778a`, which explicitly makes Hostinger native Git the deployment owner. Current deployment remains Node 22/npm/MySQL. Re-enabling an obsolete second deployer is not a missing-feature repair. |
| Failed runs `37077483077`, `37077549998`, SHAs `f8a841a`, `af0be96` | Only `.github/workflows/tmp-engine-fetch.yml`; original commit explicitly says temporary/session-only/removed before merge. Diagnostic engine-transfer workflow, not an application deliverable. Not restored as a permanent workflow. |

Every remote branch tip was checked after fetching full history. Only the four tips described
above (`2a5dc330`, `c73361e4`, `e1474e5a`, and `fix/hostinger-main-auto-deploy`) were outside
the baseline ancestry. No branches were switched, deleted or closed during this audit.

## File and error verification

- `npm ci --no-audit --no-fund`: completed.
- ESLint and TypeScript: passed, including TypeScript with a generated **MySQL** Prisma client.
- Original full suite: **1,677 passed; zero failures, cancellations or skips** with the documented
  disposable SQLite adapter (no production database).
- Conflict-marker check: passed (1,606 baseline tracked files).
- All 20 industry asset payloads and all 35 service/platform/blueprint WebPs: present and valid.
- All 19 published migrations: intact and correctly ordered.
- Prisma/MySQL schema generation parity: passed; no drift across 101 models/tables,
  1,382 columns and 279 indexes.
- `npx next build --webpack`: passed with the production MySQL client. This verifies application
  compilation/prerendering, **not** the `migrate deploy` part of `npm run build` or a live deployment.
- The 95 archived PR #43 file hashes: passed.

Native Prisma engines were obtained from the same GitHub mirror documented in prior audits,
verified against its SHA-256 files, and installed only in ignored `node_modules`. The sandbox
cannot reach Prisma's normal binary host. No engine binaries, database files or dependency
changes were added to Git.

The term “brokerage files” does not identify a separate module here. Repository search found
brokerage business-model text in the real-estate/logistics payloads, not a broken brokerage
application. Those payloads are included in the passing type, test and asset gates. A specific
additional file or prior request can be reconciled if its path or source is provided.

## Added safeguards

`npm run check:recovery` is a **read-only**, offline Git-history/file-integrity gate. It verifies
all 174 failed/cancelled run dispositions, requires integrated replacement evidence for the
three documented exceptions, and checks the 95 preserved incoming blobs. Missing history or
files fail loudly. Use a full clone; a shallow clone must fetch history first. It deliberately
does not fetch, merge, deploy, mutate a database or contact any provider. It is not added to
shallow-checkout CI, and it does not pretend to certify future runs.

Six regression tests exercise successful ancestry, missing commits, unsupported dispositions,
duplicate IDs, unsubstantiated exceptions, and missing/changed archived files.

Existing main CI evidence: [run 43578332069](https://github.com/alaminiubateee969-cmd/tech360/actions/runs/43578332069).
Historical red runs remain red; their records do not turn green when later commits fix the code.

Final post-change verification: **1,683/1,683 tests passed**, zero failures/skips/cancellations;
lint and typecheck passed; standalone static/public asset copy verification passed.
