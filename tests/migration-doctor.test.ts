/**
 * Guards for the migration-safety tooling that exists because of the
 * `93_post_review_grid` P3009 incident (docs/HOSTINGER_SSH_RECOVERY.md §5):
 *
 *  - scripts/check-migration-immutability.mjs — published migrations cannot be
 *    renamed, deleted or edited, and a new migration must sort after them
 *    (Prisma applies migrations in directory-name order, as plain strings).
 *  - scripts/prisma-migration-doctor.mjs — read-only inspection of failed
 *    migration rows, so `migrate resolve` is chosen from evidence, not a guess.
 */
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { describe, it } from 'node:test'

const ROOT = path.resolve(process.cwd())
const GUARD = path.join(ROOT, 'scripts/check-migration-immutability.mjs')
const DOCTOR = path.join(ROOT, 'scripts/prisma-migration-doctor.mjs')

type DoctorModule = {
  parseMigrationObjects(sql: string): { objects: Array<{ kind: string; table?: string; name?: string }>; opaque: string[] }
  classify(findings: Array<{ present: boolean }>): string
  splitStatements(sql: string): string[]
  migrationsOnDisk(dir?: string): string[]
  inspect(prisma: unknown): Promise<{
    database: string | null
    rows: Array<{ name: string; state: string }>
    failed: Array<{
      name: string
      onDisk: boolean
      verdict: string
      findings: Array<{ kind: string; table?: string; name?: string; present: boolean }>
      opaque: string[]
    }>
    pending: string[]
    onDisk: string[]
    appliedCount: number
  }>
  formatReport(report: unknown): string
}

/**
 * A stand-in for PrismaClient that answers the doctor's queries from a fixed
 * picture of the database, and records what was asked. The live queries cannot
 * run in this sandbox (no MySQL), so this is what proves the inspection logic:
 * the exact SQL shape, the bound parameters, the state normalisation and the
 * verdict per failed row.
 */
function fakeClient(rows: Array<Record<string, unknown>>, present: Record<string, boolean>) {
  const calls: Array<{ sql: string; params: unknown[] }> = []
  const client = {
    async $queryRawUnsafe(sql: string, ...params: unknown[]) {
      calls.push({ sql, params })
      if (/FROM _prisma_migrations/.test(sql)) return rows
      if (/SELECT DATABASE\(\)/.test(sql)) return [{ name: 'tech360' }]
      const table = String(params[0])
      const name = params[1] === undefined ? table : String(params[1])
      const exists = present[`${table}.${name}`] ?? present[table] ?? false
      return [{ n: BigInt(exists ? 1 : 0) }]
    },
    async $disconnect() {},
  }
  return { client, calls }
}

const failedRow = (name: string) => ({
  migration_name: name,
  started_at: new Date('2026-11-09T14:00:00Z'),
  finished_at: null,
  rolled_back_at: null,
  applied_steps_count: 0,
  logs: "Table 'PostReview' already exists",
})

async function doctor(): Promise<DoctorModule> {
  // Non-literal specifier: the module is a .mjs script, not part of the TS graph.
  const specifier = pathToFileURL(DOCTOR).href
  return (await import(specifier)) as DoctorModule
}

function run(script: string, args: string[], env: NodeJS.ProcessEnv = process.env) {
  return spawnSync(process.execPath, [script, ...args], { encoding: 'utf8', env })
}

function fixture(migrations: Record<string, string>): string {
  const root = mkdtempSync(path.join(tmpdir(), 'mig-'))
  for (const [name, sql] of Object.entries(migrations)) {
    const dir = path.join(root, 'prisma', 'migrations', name)
    mkdirSync(dir, { recursive: true })
    writeFileSync(path.join(dir, 'migration.sql'), sql)
  }
  const published = run(GUARD, ['--root', root, '--update'])
  assert.equal(published.status, 0, published.stderr)
  return root
}

function publish(root: string) {
  return run(GUARD, ['--root', root, '--update'])
}

function check(root: string) {
  return run(GUARD, ['--root', root])
}

describe('migration immutability gate', () => {
  it('passes on this repository', () => {
    const result = run(GUARD, [])
    assert.equal(result.status, 0, result.stderr)
    assert.match(result.stdout, /passed/)
    const manifest = JSON.parse(readFileSync(path.join(ROOT, 'prisma/migration-manifest.json'), 'utf8'))
    assert.ok(Object.keys(manifest.migrations).includes('93_post_review_grid'), 'the incident migration is recorded')
  })

  it('fails when a published migration is renamed', () => {
    const root = fixture({ '1_first': 'CREATE TABLE `A` (`id` INT);\n', '9_commerce': 'CREATE TABLE `B` (`id` INT);\n' })
    renameSync(path.join(root, 'prisma/migrations/9_commerce'), path.join(root, 'prisma/migrations/v2_commerce'))

    const result = check(root)
    assert.equal(result.status, 1)
    assert.match(result.stderr, /published migration "9_commerce" is MISSING/)
    assert.match(result.stderr, /BY NAME|by name|_prisma_migrations/)
  })

  it('fails when a published migration is edited', () => {
    const root = fixture({ '1_first': 'CREATE TABLE `A` (`id` INT);\n' })
    writeFileSync(path.join(root, 'prisma/migrations/1_first/migration.sql'), 'CREATE TABLE `A` (`id` BIGINT);\n')

    const result = check(root)
    assert.equal(result.status, 1)
    assert.match(result.stderr, /was EDITED/)
  })

  it('refuses --update while a published migration is inconsistent', () => {
    const root = fixture({ '1_first': 'CREATE TABLE `A` (`id` INT);\n' })
    writeFileSync(path.join(root, 'prisma/migrations/1_first/migration.sql'), 'CREATE TABLE `A` (`id` BIGINT);\n')
    mkdirSync(path.join(root, 'prisma/migrations/v2_late'))
    writeFileSync(path.join(root, 'prisma/migrations/v2_late/migration.sql'), 'CREATE TABLE `C` (`id` INT);\n')

    const result = publish(root)
    assert.equal(result.status, 1)
    assert.match(result.stderr, /refusing to update/)
    const manifest = JSON.parse(readFileSync(path.join(root, 'prisma/migration-manifest.json'), 'utf8'))
    assert.ok(!('v2_late' in manifest.migrations), 'nothing was published')
  })

  it('rejects a new migration that sorts before a published one, and names a valid prefix', () => {
    const root = fixture({ '1_first': 'CREATE TABLE `A` (`id` INT);\n', '9_commerce': 'CREATE TABLE `B` (`id` INT);\n' })
    // "94_x" < "9_commerce" because "4" < "_": digit prefixes cannot sort last here.
    mkdirSync(path.join(root, 'prisma/migrations/94_late'))
    writeFileSync(path.join(root, 'prisma/migrations/94_late/migration.sql'), 'CREATE TABLE `C` (`id` INT);\n')

    const rejected = check(root)
    assert.equal(rejected.status, 1)
    assert.match(rejected.stderr, /sorts BEFORE the published migration "9_commerce"/)
    assert.match(rejected.stderr, /Rename it to e\.g\. "v2_late"/)
  })

  it('accepts a correctly ordered new migration once it is published', () => {
    const root = fixture({ '1_first': 'CREATE TABLE `A` (`id` INT);\n', '9_commerce': 'CREATE TABLE `B` (`id` INT);\n' })
    mkdirSync(path.join(root, 'prisma/migrations/v2_late'))
    writeFileSync(path.join(root, 'prisma/migrations/v2_late/migration.sql'), 'CREATE TABLE `C` (`id` INT);\n')

    const unpublished = check(root)
    assert.equal(unpublished.status, 1)
    assert.match(unpublished.stderr, /is not recorded in prisma\/migration-manifest\.json/)

    const published = publish(root)
    assert.equal(published.status, 0, published.stderr)
    assert.equal(check(root).status, 0)
  })
})

describe('prisma migration doctor', () => {
  it('reads the incident migration as one table plus one foreign key', async () => {
    const { parseMigrationObjects } = await doctor()
    const sql = readFileSync(path.join(ROOT, 'prisma/migrations/93_post_review_grid/migration.sql'), 'utf8')
    const parsed = parseMigrationObjects(sql)

    assert.deepEqual(parsed.opaque, [])
    assert.deepEqual(parsed.objects, [
      { kind: 'table', table: 'PostReview' },
      { kind: 'constraint', table: 'PostReview', name: 'PostReview_postId_fkey' },
    ])
  })

  it('classifies the observed end state without guessing', async () => {
    const { classify } = await doctor()
    assert.equal(classify([{ present: true }, { present: true }]), 'applied')
    assert.equal(classify([{ present: false }, { present: false }]), 'not-applied')
    assert.equal(classify([{ present: true }, { present: false }]), 'partial')
    assert.equal(classify([]), 'unknown')
  })

  it('ignores SQL comments and session plumbing when parsing', async () => {
    const { parseMigrationObjects } = await doctor()
    const parsed = parseMigrationObjects(
      [
        '-- CreateTable',
        'CREATE TABLE `X` (`id` VARCHAR(191) NOT NULL);',
        'SET @fk := 1;',
        'ALTER TABLE `X` ADD CONSTRAINT `X_y_fkey` FOREIGN KEY (`y`) REFERENCES `Y`(`id`);',
      ].join('\n'),
    )
    assert.deepEqual(parsed.objects, [
      { kind: 'table', table: 'X' },
      { kind: 'constraint', table: 'X', name: 'X_y_fkey' },
    ])
  })

  it('inspects a failed PostReview row and reports the end state as in place', async () => {
    const { inspect, formatReport } = await doctor()
    const { client, calls } = fakeClient([failedRow('93_post_review_grid')], {
      PostReview: true,
      'PostReview.PostReview_postId_fkey': true,
    })

    const report = await inspect(client)
    assert.equal(report.failed.length, 1)
    assert.equal(report.failed[0].name, '93_post_review_grid')
    assert.equal(report.failed[0].onDisk, true)
    assert.equal(report.failed[0].verdict, 'applied')
    // Only the one row exists on this fake database, so every other committed
    // migration is genuinely pending — the incident migration is not.
    assert.ok(!report.pending.includes('93_post_review_grid'))
    assert.equal(report.pending.length, report.onDisk.length - 1)
    assert.equal(report.database, 'tech360')

    const tableQuery = calls.find((call) => /information_schema\.TABLES/.test(call.sql))
    assert.deepEqual(tableQuery?.params, ['PostReview'])
    const fkQuery = calls.find((call) => /information_schema\.TABLE_CONSTRAINTS/.test(call.sql))
    assert.deepEqual(fkQuery?.params, ['PostReview', 'PostReview_postId_fkey'])

    const text = formatReport(report)
    assert.match(text, /end state IS in place/)
    assert.match(text, /--resolve 93_post_review_grid --as applied --confirm/)
    assert.match(text, /Table 'PostReview' already exists/)
  })

  it('reports a half-applied row as partial instead of choosing a direction', async () => {
    const { inspect, formatReport } = await doctor()
    const { client } = fakeClient([failedRow('93_post_review_grid')], {
      PostReview: true,
      'PostReview.PostReview_postId_fkey': false,
    })

    const report = await inspect(client)
    assert.equal(report.failed[0].verdict, 'partial')
    for (const finding of report.failed[0].findings) {
      assert.ok(finding.kind === 'table' || finding.kind === 'constraint')
    }
    const text = formatReport(report)
    assert.match(text, /PARTIALLY applied/)
    assert.doesNotMatch(text, /--as applied/)
  })

  it('flags a failed row whose migration name is no longer in the repository', async () => {
    const { inspect, formatReport } = await doctor()
    const { client } = fakeClient([failedRow('13_post_review_grid')], {})

    const report = await inspect(client)
    assert.equal(report.failed[0].onDisk, false)
    assert.equal(report.failed[0].verdict, 'unknown')
    const text = formatReport(report)
    assert.match(text, /not in prisma\/migrations/)
    assert.match(text, /resolves migrations by name/i)
  })

  it('explains an empty migration history instead of crashing', async () => {
    const { inspect } = await doctor()
    const client = {
      async $queryRawUnsafe() {
        throw new Error("Raw query failed. Code: `1146`. Message: `Table 'u394009794_bdtech360._prisma_migrations' doesn't exist`")
      },
      async $disconnect() {},
    }
    await assert.rejects(() => inspect(client), /has never been migrated with Prisma/)
  })

  it('prints inspection SQL without needing a database', () => {
    const env = { ...process.env }
    delete env.DATABASE_URL
    const result = run(DOCTOR, ['--sql'], env)
    assert.equal(result.status, 0, result.stderr)
    assert.match(result.stdout, /FROM _prisma_migrations/)
    assert.match(result.stdout, /PostReview_postId_fkey/)
  })

  it('refuses to write anything without --confirm', () => {
    const env = { ...process.env, DATABASE_URL: 'mysql://user:pass@127.0.0.1:3306/tech360' }
    const result = run(DOCTOR, ['--resolve', '93_post_review_grid', '--as', 'applied'], env)
    assert.equal(result.status, 2)
    assert.match(result.stderr, /without --confirm/)
  })

  it('refuses a migration name that is not in the repository', () => {
    const env = { ...process.env, DATABASE_URL: 'mysql://user:pass@127.0.0.1:3306/tech360' }
    const result = run(DOCTOR, ['--resolve', '13_post_review_grid', '--as', 'applied', '--confirm'], env)
    assert.equal(result.status, 2)
    assert.match(result.stderr, /not in prisma\/migrations/)
  })

  it('refuses to inspect a non-MySQL database', () => {
    const env = { ...process.env, DATABASE_URL: 'file:./.preview/test.db' }
    const result = run(DOCTOR, [], env)
    assert.equal(result.status, 2)
    assert.match(result.stderr, /only inspects MySQL/)
  })
})
