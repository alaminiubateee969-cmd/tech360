#!/usr/bin/env node
/**
 * TECH360 — production migration doctor (P3009 recovery).
 *
 * WHY THIS EXISTS
 * ---------------
 * `prisma migrate deploy` is the first half of `npm run build`. When ONE row in
 * `_prisma_migrations` is recorded as failed, Prisma refuses to apply *any*
 * migration (error P3009) and the build dies before `next build` — the exact
 * incident described in docs/HOSTINGER_SSH_RECOVERY.md §5, where
 * `93_post_review_grid` failed on databases that already had `PostReview`
 * (the migration had been renamed from `13_post_review_grid`, and Prisma
 * tracks migrations by NAME).
 *
 * The supported recovery is `prisma migrate resolve --applied|--rolled-back`,
 * which only rewrites the history row and runs no SQL. Choosing the right flag
 * requires knowing what the failed migration actually left behind, so this
 * script answers that question from the database itself, then prints — or, on
 * explicit request, runs — the exact resolve command.
 *
 * SAFETY
 * ------
 *  - Default mode is READ-ONLY: SELECTs against information_schema plus
 *    `_prisma_migrations`. Nothing is written.
 *  - `--resolve` refuses to act unless the row really is failed, the migration
 *    still exists in prisma/migrations (Prisma resolves by name), and the
 *    observed database state matches the direction you asked for. `--force`
 *    overrides only the last check, loudly.
 *  - `--confirm` is required to write anything at all.
 *  - It never deletes a `_prisma_migrations` row, never runs `db push`,
 *    `migrate reset` or `migrate dev`, and never edits migration SQL.
 *  - MySQL only: that is the production engine (prisma/schema.prisma).
 *
 * USAGE
 *   node scripts/prisma-migration-doctor.mjs                  # read-only report
 *   node scripts/prisma-migration-doctor.mjs --json           # same, machine-readable
 *   node scripts/prisma-migration-doctor.mjs --sql            # SQL for phpMyAdmin (no DB access)
 *   node scripts/prisma-migration-doctor.mjs --resolve 93_post_review_grid --as applied --confirm
 *   node scripts/prisma-migration-doctor.mjs --resolve 93_post_review_grid --as rolled-back --confirm
 *
 * Requires DATABASE_URL (MySQL) for everything except `--sql`.
 */
import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const SCRIPT_PATH = fileURLToPath(import.meta.url)
const ROOT = path.resolve(path.dirname(SCRIPT_PATH), '..')
const MIGRATIONS_DIR = path.join(ROOT, 'prisma', 'migrations')
const PRISMA_WRAPPER = path.join(ROOT, 'scripts', 'prisma.mjs')

// ---------------------------------------------------------------- pure logic

/** Strip `--` comments and split a migration into statements. */
export function splitStatements(sql) {
  return sql
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .split('\n')
    .map((line) => line.replace(/--.*$/, ''))
    .join('\n')
    .split(/;\s*(?:\n|$)/)
    .map((statement) => statement.trim())
    .filter(Boolean)
}

/**
 * Every object a migration creates, so its end state can be verified against
 * the live database. Anything this does not recognise is reported as opaque
 * (never silently assumed).
 */
export function parseMigrationObjects(sql) {
  const objects = []
  const opaque = []
  for (const statement of splitStatements(sql)) {
    const s = statement.replace(/\s+/g, ' ').trim()
    if (!s) continue
    if (/^(SET|PREPARE|EXECUTE|DEALLOCATE|SELECT)\b/i.test(s)) continue // session plumbing / guards
    let m
    if ((m = /^CREATE TABLE (?:IF NOT EXISTS )?`([^`]+)`/i.exec(s))) {
      objects.push({ kind: 'table', table: m[1] })
      continue
    }
    if ((m = /^ALTER TABLE `([^`]+)` ADD CONSTRAINT `([^`]+)`/i.exec(s))) {
      objects.push({ kind: 'constraint', table: m[1], name: m[2] })
      continue
    }
    if ((m = /^ALTER TABLE `([^`]+)` ADD COLUMN `([^`]+)`/i.exec(s))) {
      objects.push({ kind: 'column', table: m[1], name: m[2] })
      continue
    }
    if ((m = /^ALTER TABLE `([^`]+)` ADD (?:UNIQUE )?(?:INDEX|KEY) `([^`]+)`/i.exec(s))) {
      objects.push({ kind: 'index', table: m[1], name: m[2] })
      continue
    }
    if ((m = /^CREATE (?:UNIQUE )?INDEX `([^`]+)` ON `([^`]+)`/i.exec(s))) {
      objects.push({ kind: 'index', table: m[2], name: m[1] })
      continue
    }
    if (/^CREATE (?:UNIQUE )?INDEX |^ALTER TABLE |^CREATE TABLE /i.test(s)) {
      opaque.push(s.slice(0, 160)) // DDL we cannot verify — needs a human
      continue
    }
    if (/^(INSERT|UPDATE|DELETE|REPLACE)\b/i.test(s)) continue // data changes are out of scope
    opaque.push(s.slice(0, 160))
  }
  return { objects, opaque }
}

/**
 * Classify what the database shows for a failed migration.
 *  applied     — every tracked object exists (the end state is in place)
 *  not-applied — none of them exists (nothing usable was applied)
 *  partial     — some do (MySQL DDL is not transactional): reconcile by hand
 *  unknown     — nothing verifiable (no DDL parsed, or all checks failed)
 */
export function classify(findings) {
  if (!findings.length) return 'unknown'
  const present = findings.filter((finding) => finding.present).length
  if (present === findings.length) return 'applied'
  if (present === 0) return 'not-applied'
  return 'partial'
}

export function resolveArgv(name, direction) {
  return [
    process.execPath,
    PRISMA_WRAPPER,
    'migrate',
    'resolve',
    direction === 'applied' ? '--applied' : '--rolled-back',
    name,
  ]
}

// ------------------------------------------------------------- reading disk

export function migrationsOnDisk(dir = MIGRATIONS_DIR) {
  if (!existsSync(dir)) return []
  return readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort()
}

export function readMigrationSql(name, dir = MIGRATIONS_DIR) {
  const file = path.join(dir, name, 'migration.sql')
  return existsSync(file) ? readFileSync(file, 'utf8') : null
}

// ------------------------------------------------------------ reading MySQL

export function assertMysqlUrl(url) {
  if (!url) {
    throw new Error(
      'DATABASE_URL is not set. Load the application env first (see docs/HOSTINGER_SSH_RECOVERY.md §3), ' +
        'or use --sql to print the inspection SQL for phpMyAdmin.',
    )
  }
  if (!/^mysql:\/\//i.test(url)) {
    throw new Error(
      `DATABASE_URL is not a MySQL URL (${String(url).split(':')[0]}:…). This doctor only inspects MySQL, ` +
        'the engine production runs.',
    )
  }
}

const EXISTENCE_SQL = {
  table: 'SELECT COUNT(*) AS n FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?',
  constraint:
    'SELECT COUNT(*) AS n FROM information_schema.TABLE_CONSTRAINTS ' +
    'WHERE CONSTRAINT_SCHEMA = DATABASE() AND TABLE_NAME = ? AND CONSTRAINT_NAME = ?',
  index:
    'SELECT COUNT(*) AS n FROM information_schema.STATISTICS ' +
    'WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND INDEX_NAME = ?',
  column:
    'SELECT COUNT(*) AS n FROM information_schema.COLUMNS ' +
    'WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?',
}

async function withClient(fn) {
  const { PrismaClient } = await import('@prisma/client')
  const prisma = new PrismaClient()
  try {
    return await fn(prisma)
  } finally {
    await prisma.$disconnect().catch(() => {})
  }
}

export async function inspect(prisma) {
  let rows
  try {
    rows = await prisma.$queryRawUnsafe(
      'SELECT migration_name, started_at, finished_at, rolled_back_at, applied_steps_count, logs ' +
        'FROM _prisma_migrations ORDER BY started_at, migration_name',
    )
  } catch (error) {
    const message = String(error instanceof Error ? error.message : error)
    if (/doesn't exist|does not exist|1146|P2021|P2010/i.test(message)) {
      throw new Error(
        'this database has no _prisma_migrations table, so it has never been migrated with Prisma. ' +
          'There is no failed migration to resolve — run `node scripts/prisma.mjs migrate deploy` against it.',
      )
    }
    throw error
  }
  const normalised = rows.map((row) => ({
    name: String(row.migration_name),
    startedAt: row.started_at,
    finishedAt: row.finished_at,
    rolledBackAt: row.rolled_back_at,
    appliedSteps: Number(row.applied_steps_count ?? 0),
    logs: row.logs == null ? '' : String(row.logs),
    state: row.rolled_back_at
      ? 'rolled-back'
      : row.finished_at
        ? 'applied'
        : 'failed',
  }))

  const onDisk = migrationsOnDisk()
  const diskSet = new Set(onDisk)

  for (const row of normalised) {
    if (row.state !== 'failed') continue
    row.onDisk = diskSet.has(row.name)
    const sql = row.onDisk ? readMigrationSql(row.name) : null
    row.findings = []
    row.opaque = []
    if (sql) {
      const parsed = parseMigrationObjects(sql)
      row.opaque = parsed.opaque
      for (const object of parsed.objects) {
        const params = object.kind === 'table' ? [object.table] : [object.table, object.name]
        const result = await prisma.$queryRawUnsafe(EXISTENCE_SQL[object.kind], ...params)
        row.findings.push({ ...object, present: Number(result[0]?.n ?? 0) > 0 })
      }
    }
    row.verdict = row.onDisk ? classify(row.findings) : 'unknown'
  }

  const applied = new Set(normalised.filter((row) => row.state === 'applied').map((row) => row.name))
  return {
    database: (await prisma.$queryRawUnsafe('SELECT DATABASE() AS name'))[0]?.name ?? null,
    rows: normalised,
    failed: normalised.filter((row) => row.state === 'failed'),
    pending: onDisk.filter((name) => !normalised.some((row) => row.name === name)),
    unknownOnDatabase: normalised.filter((row) => !diskSet.has(row.name)),
    appliedCount: applied.size,
    onDisk,
  }
}

// ------------------------------------------------------------------ output

const VERDICT_TEXT = {
  applied: 'end state IS in place → resolve as --applied',
  'not-applied': 'nothing usable was applied → resolve as --rolled-back',
  partial: 'PARTIALLY applied → reconcile by hand first (complete or revert), then resolve',
  unknown: 'cannot be verified automatically → inspect by hand before choosing a direction',
}

function describeObject(object) {
  return object.kind === 'table' ? `table \`${object.table}\`` : `${object.kind} \`${object.name}\` on \`${object.table}\``
}

export function formatReport(report) {
  const lines = []
  lines.push('TECH360 — Prisma migration doctor (read-only)')
  lines.push(`  database:      ${report.database ?? '(unknown)'}`)
  lines.push(`  on disk:       ${report.onDisk.length} migration(s)`)
  lines.push(`  recorded:      ${report.rows.length} row(s), ${report.appliedCount} applied`)
  lines.push(`  pending:       ${report.pending.length ? report.pending.join(', ') : 'none'}`)

  if (!report.failed.length) {
    lines.push('')
    lines.push('  No failed migration rows. If `prisma migrate deploy` still reports P3009, confirm')
    lines.push('  DATABASE_URL points at the database Prisma actually inspected.')
    return lines.join('\n')
  }

  lines.push('')
  lines.push(`  ${report.failed.length} FAILED migration row(s) — \`prisma migrate deploy\` refuses to run (P3009):`)
  for (const row of report.failed) {
    lines.push('')
    lines.push(`  ▸ ${row.name}`)
    lines.push(`      state:          failed (started ${row.startedAt ?? '?'}, applied steps ${row.appliedSteps})`)
    if (!row.onDisk) {
      lines.push('      on disk:        NO — this name is not in prisma/migrations (renamed or deleted).')
      lines.push('      Prisma resolves migrations by name, so the directory that was published under this')
      lines.push('      name must be restored before `migrate resolve` can settle the row.')
    } else {
      lines.push('      on disk:        yes')
      if (!row.findings.length) {
        lines.push('      verified:       nothing to verify (no DDL parsed from migration.sql)')
      } else {
        for (const finding of row.findings) {
          lines.push(`      ${finding.present ? 'present ' : 'MISSING '}  ${describeObject(finding)}`)
        }
        if (row.opaque.length) {
          lines.push(`      unchecked:      ${row.opaque.length} statement(s) this doctor does not verify`)
          for (const statement of row.opaque) lines.push(`                      ${statement}`)
        }
      }
      lines.push(`      verdict:        ${VERDICT_TEXT[row.verdict]}`)
      if (row.verdict !== 'partial' && row.verdict !== 'unknown') {
        const direction = row.verdict === 'applied' ? 'applied' : 'rolled-back'
        lines.push('      next:           node scripts/prisma-migration-doctor.mjs \\')
        lines.push(`                        --resolve ${row.name} --as ${direction} --confirm`)
      }
    }
    const logTail = row.logs.split('\n').filter(Boolean).slice(-6).join('\n        ')
    if (logTail) {
      lines.push('      logs (tail):')
      lines.push(`        ${logTail}`)
    }
  }

  if (report.unknownOnDatabase.length) {
    lines.push('')
    lines.push('  Rows recorded on the database whose migration no longer exists in the repo:')
    for (const row of report.unknownOnDatabase) lines.push(`    • ${row.name} (${row.state})`)
    lines.push('  Keep them: they describe what this database actually ran. Never hand-delete them.')
  }

  lines.push('')
  lines.push('  Nothing was written. `migrate resolve` runs NO SQL — it only settles the history row.')
  lines.push('  Runbook: docs/HOSTINGER_SSH_RECOVERY.md §5')
  return lines.join('\n')
}

export function inspectionSql() {
  return [
    '-- Read-only inspection for a P3009 (failed migration) incident.',
    '-- Run in phpMyAdmin or the mysql CLI against the APPLICATION database.',
    'SELECT migration_name, started_at, finished_at, rolled_back_at,',
    '       applied_steps_count, LEFT(logs, 800) AS logs',
    'FROM _prisma_migrations',
    'WHERE finished_at IS NULL AND rolled_back_at IS NULL;',
    '',
    '-- Prove whether the failed migration left its end state in place,',
    '-- e.g. for 93_post_review_grid:',
    "SHOW CREATE TABLE `PostReview`;",
    'SELECT COUNT(*) FROM `PostReview`;',
    "SELECT CONSTRAINT_NAME, TABLE_NAME FROM information_schema.TABLE_CONSTRAINTS",
    "WHERE CONSTRAINT_SCHEMA = DATABASE() AND CONSTRAINT_NAME = 'PostReview_postId_fkey';",
    '',
    '-- Every row this database has recorded (names are what Prisma matches on):',
    'SELECT migration_name, finished_at, rolled_back_at',
    'FROM _prisma_migrations ORDER BY started_at;',
  ].join('\n')
}

// -------------------------------------------------------------------- main

function parseArgs(argv) {
  const options = { mode: 'inspect', json: false, sql: false, resolve: null, as: null, confirm: false, force: false }
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    if (arg === '--json') options.json = true
    else if (arg === '--sql') options.sql = true
    else if (arg === '--confirm') options.confirm = true
    else if (arg === '--force') options.force = true
    else if (arg === '--resolve') {
      options.resolve = argv[++i] ?? null
      options.mode = 'resolve'
    } else if (arg === '--as') {
      options.as = argv[++i] ?? null
    } else if (arg === '--help' || arg === '-h') {
      options.help = true
    } else {
      throw new Error(`unknown argument: ${arg}`)
    }
  }
  return options
}

const HELP = `TECH360 — Prisma migration doctor (P3009 recovery)

  node scripts/prisma-migration-doctor.mjs [--json]     read-only report
  node scripts/prisma-migration-doctor.mjs --sql        inspection SQL for phpMyAdmin
  node scripts/prisma-migration-doctor.mjs --resolve <name> --as applied|rolled-back [--confirm] [--force]

  --confirm  required to write to _prisma_migrations (via prisma migrate resolve)
  --force    resolve even when the observed database state disagrees (loud, never silent)
  --json     machine-readable report (inspect mode)

  Resolve runs NO SQL: it only records --applied or --rolled-back in the history.
  Runbook: docs/HOSTINGER_SSH_RECOVERY.md §5
`

async function run(options) {
  if (options.sql) {
    console.log(inspectionSql())
    return 0
  }

  assertMysqlUrl(process.env.DATABASE_URL)

  if (options.mode === 'resolve') {
    const { resolve, as, confirm, force } = options
    if (!resolve) throw new Error('--resolve needs a migration name')
    if (as !== 'applied' && as !== 'rolled-back') throw new Error('--as must be "applied" or "rolled-back"')
    if (!confirm) {
      console.error('refusing to write without --confirm (inspect first: run this script with no arguments).')
      return 2
    }
    if (!migrationsOnDisk().includes(resolve)) {
      console.error(
        `refusing: "${resolve}" is not in prisma/migrations. Prisma resolves migrations BY NAME, so the\n` +
          'directory published under that name must be restored first. See docs/HOSTINGER_SSH_RECOVERY.md §5.',
      )
      return 2
    }

    const report = await withClient(inspect)
    const row = report.failed.find((candidate) => candidate.name === resolve)
    if (!row) {
      console.error(`refusing: "${resolve}" is not in a failed state on this database (nothing to resolve).`)
      return 2
    }
    const expected = as === 'applied' ? 'applied' : 'not-applied'
    if (row.verdict !== expected) {
      const message =
        `observed state for "${resolve}" is "${row.verdict}" but you asked to resolve it as ${as} ` +
        `(expected "${expected}").`
      if (!force) {
        console.error(
          `refusing: ${message}\n` +
            'Pass --force only after reconciling the schema by hand and understanding that the history\n' +
            'row will then claim more (or less) than the database actually contains.',
        )
        return 2
      }
      console.warn(`WARNING: ${message} — continuing because --force was passed.`)
    }

    console.log(`> node scripts/prisma.mjs migrate resolve ${as === 'applied' ? '--applied' : '--rolled-back'} ${resolve}`)
    const result = spawnSync(process.execPath, resolveArgv(resolve, as).slice(1), { stdio: 'inherit', cwd: ROOT })
    if (result.status !== 0) {
      console.error(`prisma migrate resolve exited with ${result.status ?? 'no status'}`)
      return result.status ?? 1
    }

    const after = await withClient(inspect)
    console.log('')
    console.log(`remaining failed rows: ${after.failed.length}`)
    if (after.failed.length) {
      console.log(`next: node scripts/prisma-migration-doctor.mjs --resolve ${after.failed[0].name} --as <applied|rolled-back> --confirm`)
    } else {
      console.log(`pending migrations now: ${after.pending.length ? after.pending.join(', ') : 'none'}`)
      console.log('next: node scripts/prisma.mjs migrate deploy   (then npm run build / redeploy)')
    }
    return 0
  }

  const report = await withClient(inspect)
  console.log(options.json ? JSON.stringify(report, null, 2) : formatReport(report))
  return report.failed.length ? 1 : 0
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(SCRIPT_PATH)) {
  let options
  try {
    options = parseArgs(process.argv.slice(2))
    if (options.help) {
      console.log(HELP)
      process.exitCode = 0
    } else {
      process.exitCode = await run(options)
    }
  } catch (error) {
    console.error(`prisma-migration-doctor: ${error instanceof Error ? error.message : String(error)}`)
    process.exitCode = 2
  }
}
