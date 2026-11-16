/**
 * Build-time reconciliation of the `post_review_grid` P3009 incident
 * (scripts/prisma-migration-reconcile.mjs, docs/HOSTINGER_SSH_RECOVERY.md §5).
 *
 * The script runs inside `npm run build` against production, so every branch
 * of its decision is pinned here against a stateful fake database.
 */
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { describe, it } from 'node:test'

const ROOT = path.resolve(process.cwd())
const SCRIPT = path.join(ROOT, 'scripts/prisma-migration-reconcile.mjs')

type Row = { migration_name: string; finished_at: Date | null; rolled_back_at: Date | null; logs: string | null }
type Db = { query(sql: string, ...params: unknown[]): Promise<Array<Record<string, unknown>>>; exec(sql: string, ...params: unknown[]): Promise<number> }
type Mod = {
  reconcile(db: Db, runPrisma: (args: string[]) => number, options?: { dryRun?: boolean }): Promise<number>
}

const load = async () => (await import(pathToFileURL(SCRIPT).href)) as Mod

const applied = (name: string): Row => ({ migration_name: name, finished_at: new Date(), rolled_back_at: null, logs: null })
const failed = (name: string): Row => ({
  migration_name: name, finished_at: null, rolled_back_at: null, logs: "Table 'PostReview' already exists",
})

function fake(initial: {
  rows: Row[] | null
  table?: boolean
  fk?: boolean
  parent?: boolean
  rowCount?: number
  orphans?: number
  columns?: string[]
  cliKnowsOldName?: boolean
}) {
  const state = {
    rows: initial.rows,
    table: initial.table ?? false,
    fk: initial.fk ?? false,
    parent: initial.parent ?? true,
    rowCount: initial.rowCount ?? 0,
    orphans: initial.orphans ?? 0,
    columns: initial.columns ?? ['id', 'postId', 'rating', 'comment', 'reviewer', 'createdAt'],
  }
  const writes: string[] = []
  const cli: string[] = []
  const isFailed = (row: Row) => !row.finished_at && !row.rolled_back_at

  const db: Db = {
    async query(sql, ...params) {
      if (/FROM _prisma_migrations ORDER BY/.test(sql)) {
        if (!state.rows) throw new Error("Code: `1146`. Table 'db._prisma_migrations' doesn't exist")
        return state.rows.map((row) => ({ ...row }))
      }
      if (/COUNT\(\*\) AS n FROM _prisma_migrations/.test(sql)) {
        return [{ n: BigInt(state.rows!.filter((row) => row.migration_name === params[0] && isFailed(row)).length) }]
      }
      if (/information_schema\.TABLES/.test(sql)) {
        return [{ n: BigInt((params[0] === 'PostReview' ? state.table : state.parent) ? 1 : 0) }]
      }
      if (/information_schema\.COLUMNS/.test(sql)) return state.columns.map((name) => ({ name }))
      if (/information_schema\.TABLE_CONSTRAINTS/.test(sql)) return [{ n: BigInt(state.fk ? 1 : 0) }]
      if (/LEFT JOIN `SocialPost`/.test(sql)) return [{ n: BigInt(state.orphans) }]
      if (/COUNT\(\*\) AS n FROM `PostReview`/.test(sql)) return [{ n: BigInt(state.rowCount) }]
      throw new Error(`unexpected query: ${sql}`)
    },
    async exec(sql, ...params) {
      writes.push(sql)
      if (/^ALTER TABLE `PostReview` ADD CONSTRAINT/.test(sql)) state.fk = true
      else if (/^DROP TABLE `PostReview`$/.test(sql)) state.table = false
      else if (/^UPDATE _prisma_migrations SET rolled_back_at/.test(sql)) {
        for (const row of state.rows!) if (row.migration_name === params[0] && isFailed(row)) row.rolled_back_at = new Date()
      } else throw new Error(`unexpected write: ${sql}`)
      return 1
    },
  }

  const runPrisma = (args: string[]) => {
    cli.push(args.join(' '))
    const name = args[3]
    if (args[2] === '--rolled-back') {
      if (name === '13_post_review_grid' && initial.cliKnowsOldName === false) return 1
      for (const row of state.rows!) if (row.migration_name === name && isFailed(row)) row.rolled_back_at = new Date()
      return 0
    }
    // --applied: Prisma rolls back a failed row of the same name, then inserts.
    if (state.rows!.some((row) => row.migration_name === name && row.finished_at && !row.rolled_back_at)) return 1
    for (const row of state.rows!) if (row.migration_name === name && isFailed(row)) row.rolled_back_at = new Date()
    state.rows!.push(applied(name))
    return 0
  }

  const failedNames = () => state.rows!.filter(isFailed).map((row) => row.migration_name)
  const isApplied = (name: string) => state.rows!.some((row) => row.migration_name === name && !!row.finished_at && !row.rolled_back_at)
  return { db, runPrisma, state, writes, cli, failedNames, isApplied }
}

describe('prisma-migration-reconcile (post_review_grid P3009)', () => {
  it('does nothing on a healthy database', async () => {
    const { reconcile } = await load()
    const f = fake({ rows: [applied('0_init'), applied('93_post_review_grid')], table: true, fk: true })
    assert.equal(await reconcile(f.db, f.runPrisma), 0)
    assert.deepEqual(f.writes, [])
    assert.deepEqual(f.cli, [])
  })

  it('does nothing on a database that was never migrated', async () => {
    const { reconcile } = await load()
    const f = fake({ rows: null })
    assert.equal(await reconcile(f.db, f.runPrisma), 0)
    assert.deepEqual(f.cli, [])
  })

  it('never touches a failed row of an unrelated migration', async () => {
    const { reconcile } = await load()
    const f = fake({ rows: [applied('0_init'), failed('15_document_branding_and_storage')] })
    assert.equal(await reconcile(f.db, f.runPrisma), 0)
    assert.deepEqual(f.writes, [])
    assert.deepEqual(f.cli, [])
    assert.deepEqual(f.failedNames(), ['15_document_branding_and_storage'])
  })

  it('stale 13_ failed row, table complete → 13_ rolled back, 93_ recorded applied, no DDL', async () => {
    const { reconcile } = await load()
    const f = fake({ rows: [applied('0_init'), failed('13_post_review_grid')], table: true, fk: true, rowCount: 4 })
    assert.equal(await reconcile(f.db, f.runPrisma), 0)
    assert.deepEqual(f.failedNames(), [])
    assert.ok(f.isApplied('93_post_review_grid'))
    assert.deepEqual(f.writes, [])
    assert.equal(f.state.table, true)
  })

  it('falls back to Prisma’s own UPDATE when the CLI cannot settle the removed name', async () => {
    const { reconcile } = await load()
    const f = fake({
      rows: [applied('0_init'), failed('13_post_review_grid')], table: true, fk: true, cliKnowsOldName: false,
    })
    assert.equal(await reconcile(f.db, f.runPrisma), 0)
    assert.deepEqual(f.failedNames(), [])
    assert.equal(f.writes.length, 1)
    assert.match(f.writes[0], /^UPDATE _prisma_migrations SET rolled_back_at = NOW\(3\) WHERE migration_name = \?/)
    assert.doesNotMatch(f.writes[0], /DELETE/i)
    assert.ok(f.isApplied('93_post_review_grid'))
  })

  it('13_ applied + 93_ failed on "already exists" → 93_ recorded applied', async () => {
    const { reconcile } = await load()
    const f = fake({ rows: [applied('13_post_review_grid'), failed('93_post_review_grid')], table: true, fk: true, rowCount: 2 })
    assert.equal(await reconcile(f.db, f.runPrisma), 0)
    assert.deepEqual(f.cli, ['migrate resolve --applied 93_post_review_grid'])
    assert.deepEqual(f.failedNames(), [])
    assert.ok(f.isApplied('93_post_review_grid'))
    assert.deepEqual(f.writes, [])
  })

  it('table absent → rolled back only, so migrate deploy re-applies 93_', async () => {
    const { reconcile } = await load()
    const f = fake({ rows: [applied('0_init'), failed('13_post_review_grid')], table: false })
    assert.equal(await reconcile(f.db, f.runPrisma), 0)
    assert.deepEqual(f.cli, ['migrate resolve --rolled-back 13_post_review_grid'])
    assert.ok(!f.isApplied('93_post_review_grid'))
    assert.deepEqual(f.writes, [])
  })

  it('half-applied with data → adds the missing foreign key, keeps every row', async () => {
    const { reconcile } = await load()
    const f = fake({ rows: [failed('13_post_review_grid')], table: true, fk: false, parent: true, rowCount: 3 })
    assert.equal(await reconcile(f.db, f.runPrisma), 0)
    assert.equal(f.writes.length, 1)
    assert.match(f.writes[0], /ADD CONSTRAINT `PostReview_postId_fkey`.*ON DELETE CASCADE ON UPDATE CASCADE$/)
    assert.equal(f.state.table, true)
    assert.ok(f.isApplied('93_post_review_grid'))
    assert.deepEqual(f.failedNames(), [])
  })

  it('the foreign key statement is byte-identical to the published migration', async () => {
    const { INCIDENT } = (await import(pathToFileURL(SCRIPT).href)) as { INCIDENT: { addConstraintSql: string } }
    const sql = readFileSync(path.join(ROOT, 'prisma/migrations/93_post_review_grid/migration.sql'), 'utf8')
    assert.ok(sql.includes(`${INCIDENT.addConstraintSql};`))
  })

  it('half-applied, EMPTY, parent table missing → drops the empty table and rolls back', async () => {
    const { reconcile } = await load()
    const f = fake({ rows: [failed('13_post_review_grid')], table: true, fk: false, parent: false, rowCount: 0 })
    assert.equal(await reconcile(f.db, f.runPrisma), 0)
    assert.deepEqual(f.writes, ['DROP TABLE `PostReview`'])
    assert.ok(!f.isApplied('93_post_review_grid'))
    assert.deepEqual(f.failedNames(), [])
  })

  it('REFUSES when the half-applied table holds orphaned reviews', async () => {
    const { reconcile } = await load()
    const f = fake({ rows: [failed('93_post_review_grid')], table: true, fk: false, parent: true, rowCount: 5, orphans: 2 })
    assert.equal(await reconcile(f.db, f.runPrisma), 1)
    assert.deepEqual(f.writes, [])
    assert.deepEqual(f.cli, [])
    assert.equal(f.state.table, true)
  })

  it('REFUSES when PostReview is not the table the migration creates', async () => {
    const { reconcile } = await load()
    const f = fake({ rows: [failed('93_post_review_grid')], table: true, fk: false, columns: ['id', 'body'] })
    assert.equal(await reconcile(f.db, f.runPrisma), 1)
    assert.deepEqual(f.writes, [])
    assert.deepEqual(f.cli, [])
  })

  it('--dry-run plans but writes nothing', async () => {
    const { reconcile } = await load()
    const f = fake({ rows: [failed('13_post_review_grid')], table: true, fk: false, parent: false, rowCount: 0 })
    assert.equal(await reconcile(f.db, f.runPrisma, { dryRun: true }), 0)
    assert.deepEqual(f.writes, [])
    assert.deepEqual(f.cli, [])
  })

  it('is idempotent', async () => {
    const { reconcile } = await load()
    const f = fake({ rows: [failed('13_post_review_grid')], table: true, fk: true })
    assert.equal(await reconcile(f.db, f.runPrisma), 0)
    const cliCalls = f.cli.length
    assert.equal(await reconcile(f.db, f.runPrisma), 0)
    assert.equal(f.cli.length, cliCalls)
  })

  it('skips without a MySQL DATABASE_URL and is wired into the build before migrate deploy', () => {
    const result = spawnSync(process.execPath, [SCRIPT], {
      encoding: 'utf8', env: { ...process.env, DATABASE_URL: 'file:./.preview/test.db' },
    })
    assert.equal(result.status, 0, result.stderr)
    assert.match(result.stdout, /skipping/)
    const build = JSON.parse(readFileSync(path.join(ROOT, 'package.json'), 'utf8')).scripts.build as string
    assert.ok(build.indexOf('prisma-migration-reconcile.mjs') > build.indexOf('prisma.mjs generate'))
    assert.ok(build.indexOf('prisma-migration-reconcile.mjs') < build.indexOf('migrate deploy'))
  })
})
