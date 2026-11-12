#!/usr/bin/env node
/**
 * TECH360 — build-time reconciliation of the `post_review_grid` P3009 incident.
 *
 * WHY THIS EXISTS
 * ---------------
 * `13_post_review_grid` was renamed to `93_post_review_grid`
 * (docs/HOSTINGER_SSH_RECOVERY.md §5). Prisma tracks migrations BY NAME, so a
 * production database can be left with a FAILED `_prisma_migrations` row under
 * either name. While that row exists `prisma migrate deploy` refuses to run
 * (P3009) and `npm run build` dies before `next build` — on every deploy,
 * forever, because Hostinger's build is the only place the migration runs and
 * nobody has a shell on it.
 *
 * `scripts/prisma-migration-doctor.mjs` can diagnose this but cannot settle a
 * row whose name is no longer in prisma/migrations (`13_…`), and it needs SSH.
 * This script performs the SAME evidence-based decision the runbook asks a
 * human to make, for THIS ONE known migration only, as part of the build.
 *
 * SCOPE AND SAFETY
 * ----------------
 *  - Acts only when a row named `13_post_review_grid` or `93_post_review_grid`
 *    is in the failed state. A healthy database is never touched. A failed row
 *    under any other name is left alone (the build then fails with P3009 and
 *    the doctor hint, exactly as before).
 *  - The decision is read from the database (information_schema), never
 *    guessed:
 *      PostReview complete (table + FK)  → record 93_ as applied
 *      PostReview absent                 → roll the row back; deploy re-applies
 *      PostReview without its FK         → finish the migration's own second
 *                                          statement (ADD CONSTRAINT) when
 *                                          `SocialPost` exists and no review
 *                                          is orphaned; otherwise, if the
 *                                          table is EMPTY, drop it so deploy
 *                                          re-creates it; otherwise REFUSE.
 *      PostReview with unexpected shape  → REFUSE.
 *  - It never deletes a `_prisma_migrations` row, never drops a table that
 *    holds data, never runs `db push` / `migrate reset`.
 *  - History rows are settled through `prisma migrate resolve`. Only if the
 *    CLI leaves a stale row failed is Prisma's own statement issued directly
 *    (`UPDATE _prisma_migrations SET rolled_back_at = NOW(3) …`).
 *  - Idempotent: a second run finds nothing failed and does nothing.
 *  - Opt out with TECH360_MIGRATION_RECONCILE=off.
 *
 * USAGE
 *   node scripts/prisma-migration-reconcile.mjs            # act (used by npm run build)
 *   node scripts/prisma-migration-reconcile.mjs --dry-run  # print the plan, write nothing
 */
import { spawnSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const SCRIPT_PATH = fileURLToPath(import.meta.url)
const ROOT = path.resolve(path.dirname(SCRIPT_PATH), '..')
const PRISMA_WRAPPER = path.join(ROOT, 'scripts', 'prisma.mjs')

export const INCIDENT = Object.freeze({
  /** Every name this one migration has ever been published under. */
  names: ['13_post_review_grid', '93_post_review_grid'],
  /** The name that exists in prisma/migrations today. */
  current: '93_post_review_grid',
  table: 'PostReview',
  parent: 'SocialPost',
  constraint: 'PostReview_postId_fkey',
  columns: ['id', 'postId', 'rating', 'comment', 'reviewer', 'createdAt'],
  addConstraintSql:
    'ALTER TABLE `PostReview` ADD CONSTRAINT `PostReview_postId_fkey` FOREIGN KEY (`postId`) ' +
    'REFERENCES `SocialPost`(`id`) ON DELETE CASCADE ON UPDATE CASCADE',
})

const log = (...args) => console.log('[migration-reconcile]', ...args)

function stateOf(row) {
  if (row.rolled_back_at) return 'rolled-back'
  if (row.finished_at) return 'applied'
  return 'failed'
}

const count = (rows) => Number(rows?.[0]?.n ?? 0)

/** Read-only: everything `plan()` needs. Returns null if never migrated. */
export async function observe(db) {
  let history
  try {
    history = await db.query(
      'SELECT migration_name, finished_at, rolled_back_at, logs FROM _prisma_migrations ORDER BY started_at, migration_name',
    )
  } catch (error) {
    const message = String(error instanceof Error ? error.message : error)
    if (/doesn't exist|does not exist|1146|P2021/i.test(message)) return null
    throw error
  }
  const rows = history.map((row) => ({
    name: String(row.migration_name),
    state: stateOf(row),
    logs: row.logs == null ? '' : String(row.logs),
  }))

  const tableSql =
    'SELECT COUNT(*) AS n FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?'
  const tableExists = count(await db.query(tableSql, INCIDENT.table)) > 0
  const parentExists = count(await db.query(tableSql, INCIDENT.parent)) > 0

  let columns = []
  let hasConstraint = false
  let rowCount = 0
  let orphanCount = 0
  if (tableExists) {
    columns = (
      await db.query(
        'SELECT COLUMN_NAME AS name FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?',
        INCIDENT.table,
      )
    ).map((row) => String(row.name))
    hasConstraint =
      count(
        await db.query(
          'SELECT COUNT(*) AS n FROM information_schema.TABLE_CONSTRAINTS ' +
            "WHERE CONSTRAINT_SCHEMA = DATABASE() AND TABLE_NAME = ? AND CONSTRAINT_NAME = ? AND CONSTRAINT_TYPE = 'FOREIGN KEY'",
          INCIDENT.table,
          INCIDENT.constraint,
        ),
      ) > 0
    rowCount = count(await db.query('SELECT COUNT(*) AS n FROM `PostReview`'))
    if (parentExists && rowCount > 0) {
      orphanCount = count(
        await db.query(
          'SELECT COUNT(*) AS n FROM `PostReview` r LEFT JOIN `SocialPost` s ON s.`id` = r.`postId` WHERE s.`id` IS NULL',
        ),
      )
    }
  }

  return { rows, tableExists, parentExists, columns, hasConstraint, rowCount, orphanCount }
}

/**
 * Pure decision. Returns { actions, refuse, summary }.
 * Action types: add-constraint | drop-empty-table | roll-back <name> | mark-applied <name>
 */
export function plan(observation) {
  const family = observation.rows.filter((row) => INCIDENT.names.includes(row.name))
  const failed = family.filter((row) => row.state === 'failed')
  const failedNames = [...new Set(failed.map((row) => row.name))]
  if (!failed.length) return { actions: [], refuse: null, summary: 'no failed post_review_grid row — nothing to do' }

  const currentApplied = family.some((row) => row.name === INCIDENT.current && row.state === 'applied')
  const rollBack = (names) => names.map((name) => ({ type: 'roll-back', name }))
  const settleAsComplete = () =>
    currentApplied
      ? rollBack(failedNames)
      : [
          // `migrate resolve --applied` settles a failed row of the SAME name itself.
          ...rollBack(failedNames.filter((name) => name !== INCIDENT.current)),
          { type: 'mark-applied', name: INCIDENT.current },
        ]

  if (!observation.tableExists) {
    return {
      actions: rollBack(failedNames),
      refuse: null,
      summary: `\`${INCIDENT.table}\` does not exist: nothing was applied → roll back; migrate deploy applies ${INCIDENT.current}`,
    }
  }

  const missingColumns = INCIDENT.columns.filter((column) => !observation.columns.includes(column))
  if (missingColumns.length) {
    return {
      actions: [],
      summary: 'unexpected table shape',
      refuse:
        `\`${INCIDENT.table}\` exists but lacks column(s) ${missingColumns.join(', ')} — it is not the table ` +
        'this migration creates. Inspect by hand (docs/HOSTINGER_SSH_RECOVERY.md §5).',
    }
  }

  if (observation.hasConstraint) {
    return {
      actions: settleAsComplete(),
      refuse: null,
      summary: `\`${INCIDENT.table}\` and its foreign key are in place → record ${INCIDENT.current} as applied`,
    }
  }

  if (observation.parentExists && observation.orphanCount === 0) {
    return {
      actions: [{ type: 'add-constraint' }, ...settleAsComplete()],
      refuse: null,
      summary:
        `\`${INCIDENT.table}\` exists without \`${INCIDENT.constraint}\` (half-applied) → run the migration's ` +
        `remaining statement, then record ${INCIDENT.current} as applied`,
    }
  }

  if (observation.rowCount === 0) {
    return {
      actions: [{ type: 'drop-empty-table' }, ...rollBack(failedNames)],
      refuse: null,
      summary:
        `\`${INCIDENT.table}\` is an EMPTY half-applied table and its foreign key cannot be added yet → ` +
        `drop it and roll back; migrate deploy re-creates it from ${INCIDENT.current}`,
    }
  }

  return {
    actions: [],
    summary: 'half-applied table holds data',
    refuse: observation.parentExists
      ? `\`${INCIDENT.table}\` has ${observation.orphanCount} review(s) whose post no longer exists, so its foreign ` +
        'key cannot be added. Remove or repair those rows by hand, then redeploy.'
      : `\`${INCIDENT.table}\` holds ${observation.rowCount} row(s) but \`${INCIDENT.parent}\` does not exist. ` +
        'Inspect by hand (docs/HOSTINGER_SSH_RECOVERY.md §5).',
  }
}

/** Apply a plan. `runPrisma(args)` must return the CLI exit status. */
export async function execute(actions, db, runPrisma) {
  for (const action of actions) {
    if (action.type === 'add-constraint') {
      log(`running: ${INCIDENT.addConstraintSql}`)
      await db.exec(INCIDENT.addConstraintSql)
    } else if (action.type === 'drop-empty-table') {
      // Re-check emptiness immediately before dropping: never drop data.
      if (count(await db.query('SELECT COUNT(*) AS n FROM `PostReview`')) !== 0) {
        throw new Error(`\`${INCIDENT.table}\` is no longer empty — refusing to drop it`)
      }
      log('running: DROP TABLE `PostReview`  (verified empty, half-applied)')
      await db.exec('DROP TABLE `PostReview`')
    } else if (action.type === 'roll-back') {
      log(`settling ${action.name} as rolled back`)
      const status = await runPrisma(['migrate', 'resolve', '--rolled-back', action.name])
      const still = await db.query(
        'SELECT COUNT(*) AS n FROM _prisma_migrations WHERE migration_name = ? AND finished_at IS NULL AND rolled_back_at IS NULL',
        action.name,
      )
      if (count(still) > 0) {
        // The CLI could not settle it (e.g. the name is gone from the repo).
        // Issue the statement `migrate resolve --rolled-back` itself issues.
        log(`prisma migrate resolve exited ${status} and left the row failed; marking it rolled back directly`)
        await db.exec(
          'UPDATE _prisma_migrations SET rolled_back_at = NOW(3) WHERE migration_name = ? AND finished_at IS NULL AND rolled_back_at IS NULL',
          action.name,
        )
      }
    } else if (action.type === 'mark-applied') {
      log(`recording ${action.name} as applied`)
      const status = await runPrisma(['migrate', 'resolve', '--applied', action.name])
      if (status !== 0) throw new Error(`prisma migrate resolve --applied ${action.name} exited with ${status}`)
    } else {
      throw new Error(`unknown action ${action.type}`)
    }
  }
}

export async function reconcile(db, runPrisma, { dryRun = false } = {}) {
  const observation = await observe(db)
  if (!observation) {
    log('no _prisma_migrations table yet (fresh database) — nothing to reconcile')
    return 0
  }
  const decision = plan(observation)
  if (!decision.actions.length && !decision.refuse) {
    log(decision.summary)
    return 0
  }
  const failed = observation.rows.filter((row) => row.state === 'failed' && INCIDENT.names.includes(row.name))
  for (const row of failed) {
    const tail = row.logs.split('\n').filter(Boolean).slice(-2).join(' | ')
    log(`found FAILED history row: ${row.name}${tail ? ` — ${tail.slice(0, 300)}` : ''}`)
  }
  log(
    `observed: ${INCIDENT.table} ${observation.tableExists ? 'exists' : 'absent'}` +
      (observation.tableExists
        ? `, foreign key ${observation.hasConstraint ? 'present' : 'MISSING'}, ${observation.rowCount} row(s)`
        : '') +
      `, ${INCIDENT.parent} ${observation.parentExists ? 'exists' : 'absent'}`,
  )
  if (decision.refuse) {
    console.error(`[migration-reconcile] REFUSING to act: ${decision.refuse}`)
    console.error('[migration-reconcile] Nothing was changed. Run: node scripts/prisma-migration-doctor.mjs')
    return 1
  }
  log(`decision: ${decision.summary}`)
  for (const action of decision.actions) log(`  plan: ${action.type}${action.name ? ` ${action.name}` : ''}`)
  if (dryRun) {
    log('--dry-run: nothing was written')
    return 0
  }

  await execute(decision.actions, db, runPrisma)

  const after = await observe(db)
  const remaining = after.rows.filter((row) => row.state === 'failed' && INCIDENT.names.includes(row.name))
  if (remaining.length) {
    console.error(`[migration-reconcile] ${remaining.map((row) => row.name).join(', ')} is still recorded as failed.`)
    return 1
  }
  log('post_review_grid history is settled; continuing with prisma migrate deploy')
  return 0
}

async function main() {
  const dryRun = process.argv.includes('--dry-run')
  const url = process.env.DATABASE_URL ?? ''
  if (/^(off|0|false|no)$/i.test(process.env.TECH360_MIGRATION_RECONCILE ?? '')) {
    log('disabled by TECH360_MIGRATION_RECONCILE — skipping')
    return 0
  }
  if (!/^mysql:\/\//i.test(url)) {
    log('DATABASE_URL is not a MySQL URL — skipping (only the production engine is reconciled)')
    return 0
  }

  let prisma
  try {
    const { PrismaClient } = await import('@prisma/client')
    prisma = new PrismaClient()
    await prisma.$queryRawUnsafe('SELECT 1')
  } catch (error) {
    // Not this script's failure to report: `migrate deploy` runs next and
    // fails loudly with the real connection / client error.
    log(`could not open the database (${String(error instanceof Error ? error.message : error).split('\n').pop()}) — skipping`)
    await prisma?.$disconnect().catch(() => {})
    return 0
  }

  const db = {
    query: (sql, ...params) => prisma.$queryRawUnsafe(sql, ...params),
    exec: (sql, ...params) => prisma.$executeRawUnsafe(sql, ...params),
  }
  const runPrisma = (args) =>
    spawnSync(process.execPath, [PRISMA_WRAPPER, ...args], { stdio: 'inherit', cwd: ROOT }).status ?? 1

  try {
    return await reconcile(db, runPrisma, { dryRun })
  } finally {
    await prisma.$disconnect().catch(() => {})
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(SCRIPT_PATH)) {
  try {
    process.exitCode = await main()
  } catch (error) {
    console.error(`[migration-reconcile] ${error instanceof Error ? error.message : String(error)}`)
    console.error('[migration-reconcile] Run: node scripts/prisma-migration-doctor.mjs   (docs/HOSTINGER_SSH_RECOVERY.md §5)')
    process.exitCode = 1
  }
}
