#!/usr/bin/env node
/**
 * TECH360 — published-migration immutability + ordering gate.
 *
 * WHY THIS EXISTS (verified incident, docs/HOSTINGER_SSH_RECOVERY.md §5)
 * ---------------------------------------------------------------------
 * `13_post_review_grid` was renamed to `93_post_review_grid` so that it would
 * sort AFTER `2_social_marketing` on a fresh database (its foreign key needs
 * `SocialPost`). The rename fixed new databases and wedged every database that
 * had already migrated under the old name:
 *
 *   - `_prisma_migrations` tracks migrations BY NAME, so the new name was
 *     simply "pending" and was re-attempted from scratch;
 *   - the re-attempt hit `CREATE TABLE PostReview` (already exists), failed,
 *     and left a permanent failed row;
 *   - `prisma migrate deploy` then refuses to run ANYTHING (error P3009) and
 *     every build dies before `next build`.
 *
 * Two invariants therefore have to be enforced by the repository, not by
 * discipline:
 *
 *   1. A migration that has ever been committed is IMMUTABLE. Renaming,
 *      deleting or editing it is a breaking change for every database that
 *      already applied it. `prisma/migration-manifest.json` records every
 *      published migration name (and the sha256 of its SQL); this script fails
 *      if a recorded migration is missing, rewritten, or re-ordered.
 *   2. A NEW migration must sort AFTER every published one. Prisma applies
 *      migrations in directory-name order, so `13_x` sorts before `2_y` and a
 *      fresh database sees a different order than a migrated one. New
 *      migrations must use a zero-padded / timestamp prefix.
 *
 * Usage:
 *   node scripts/check-migration-immutability.mjs            # verify (CI)
 *   node scripts/check-migration-immutability.mjs --update   # publish new ones
 *   node scripts/check-migration-immutability.mjs --root DIR # test fixtures
 *
 * `--update` only ever ADDS; it refuses to rewrite or drop an existing entry,
 * because that is the operation that caused the incident.
 */
import { createHash } from 'node:crypto'
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const MANIFEST_RELPATH = path.join('prisma', 'migration-manifest.json')

/**
 * Every migration name that has ever been published, in Prisma's apply order.
 * Prisma sorts the directory names as plain strings, so the comparison below is
 * a plain string comparison too — NOT a numeric one. Legacy names in this repo
 * (0_init, 1_ai_software_factory, … 9_commerce_invoices_sequences) are not
 * zero-padded, which means no digit-only prefix can ever sort after
 * "9_commerce_invoices_sequences" ("99_x" < "9_commerce_x" because "9" < "_").
 * New migrations therefore use a generation prefix that sorts last: v2_, v3_ …
 */

/** A name that Prisma would apply after `current` (see the note above). */
export function suggestName(current, maxPublished, published = []) {
  if (!maxPublished || current > maxPublished) return current
  const slug = current.replace(/^[0-9]+_/, '').replace(/[^a-z0-9]+/gi, '_').replace(/^_+|_+$/g, '') || 'change'
  const generations = [...new Set([maxPublished, ...published])]
    .map((name) => /^v(\d+)_/.exec(name)?.[1])
    .filter(Boolean)
    .map(Number)
  const next = generations.length ? Math.max(...generations) + 1 : 2
  return `v${next}_${slug}`
}

/** Line endings are normalised so a Windows checkout cannot fake a rewrite. */
export function checksum(sql) {
  return createHash('sha256').update(sql.replace(/\r\n/g, '\n')).digest('hex')
}

export function listMigrations(migrationsDir) {
  if (!existsSync(migrationsDir)) return []
  return readdirSync(migrationsDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort()
}

export function describe(migrationsDir, name) {
  const sqlPath = path.join(migrationsDir, name, 'migration.sql')
  const sql = existsSync(sqlPath) ? readFileSync(sqlPath, 'utf8') : ''
  return { name, sql, sha256: checksum(sql), hasSql: existsSync(sqlPath) }
}

function readManifest(manifestPath) {
  if (!existsSync(manifestPath)) return { migrations: {} }
  const parsed = JSON.parse(readFileSync(manifestPath, 'utf8'))
  return { migrations: parsed.migrations ?? {} }
}

function writeManifest(manifestPath, manifest) {
  const sorted = Object.fromEntries(
    Object.entries(manifest.migrations).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)),
  )
  const body = {
    $comment:
      'Published Prisma migrations are immutable: renaming, deleting or editing one is a breaking change for every database that already applied it (see docs/HOSTINGER_SSH_RECOVERY.md §5). Add new migrations with `npm run migrations:publish`; the name must sort AFTER every entry here as a plain string (Prisma applies migrations in directory-name order). Digit-only prefixes cannot do that while 9_commerce_invoices_sequences exists, so new migrations use v2_, v3_, …',
    migrations: sorted,
  }
  writeFileSync(manifestPath, `${JSON.stringify(body, null, 2)}\n`)
}

function main(argv) {
  const rootArg = argv.indexOf('--root')
  const root = rootArg >= 0 ? path.resolve(argv[rootArg + 1]) : process.cwd()
  const update = argv.includes('--update')
  const migrationsDir = path.join(root, 'prisma', 'migrations')
  const manifestPath = path.join(root, MANIFEST_RELPATH)

  if (!existsSync(migrationsDir)) {
    console.error(`check-migration-immutability: no migrations directory at ${migrationsDir}`)
    return 2
  }

  const onDisk = listMigrations(migrationsDir).map((name) => describe(migrationsDir, name))
  const byName = new Map(onDisk.map((m) => [m.name, m]))
  const manifest = readManifest(manifestPath)
  const published = Object.keys(manifest.migrations)
  const problems = []

  // Invariant 1 — a published migration must still exist with identical SQL.
  for (const name of published) {
    const current = byName.get(name)
    if (!current) {
      problems.push(
        `published migration "${name}" is MISSING from prisma/migrations — it was renamed or deleted.\n` +
          `    Every database that already applied "${name}" records that exact name in _prisma_migrations.\n` +
          `    Restore the directory, or ship an additive follow-up migration instead (see\n` +
          `    docs/HOSTINGER_SSH_RECOVERY.md §5 "Policy consequence"). Never resolve this with a rename.`,
      )
      continue
    }
    if (current.sha256 !== manifest.migrations[name]) {
      problems.push(
        `published migration "${name}" was EDITED (sha256 ${current.sha256.slice(0, 12)}… ≠ recorded ${String(manifest.migrations[name]).slice(0, 12)}…).\n` +
          `    Apply the change as a new, additive migration instead. Editing a migration that a database\n` +
          `    already applied makes that database's history and the code disagree.`,
      )
    }
  }

  // Invariant 2 — anything new must sort after everything already published.
  const newestPublished = published.length ? [...published].sort().at(-1) : null
  const unpublished = onDisk.filter((m) => !(m.name in manifest.migrations))

  if (update) {
    if (problems.length) {
      report(problems)
      console.error('\nrefusing to update prisma/migration-manifest.json while published migrations are inconsistent.')
      return 1
    }
    for (const migration of unpublished) {
      if (!migration.hasSql || migration.sql.trim() === '') {
        problems.push(`new migration "${migration.name}" has no migration.sql content — nothing to publish.`)
        continue
      }
      if (newestPublished && migration.name <= newestPublished) {
        problems.push(
          `new migration "${migration.name}" sorts BEFORE the published migration "${newestPublished}".\n` +
            `    Prisma applies migrations in directory-name order (a plain string sort), so a fresh\n` +
            `    database would run "${migration.name}" before "${newestPublished}" while databases\n` +
            `    migrated earlier ran it after. Rename it to e.g. "${suggestName(migration.name, newestPublished, published)}"\n` +
            '    (prefixes that sort last: v2_, v3_, …), then run npm run migrations:publish.',
        )
        continue
      }
      manifest.migrations[migration.name] = migration.sha256
    }
    if (problems.length) {
      report(problems)
      return 1
    }
    writeManifest(manifestPath, manifest)
    console.log(
      `check-migration-immutability: published ${unpublished.length} new migration(s); ` +
        `${Object.keys(manifest.migrations).length} total recorded in ${MANIFEST_RELPATH}`,
    )
    return 0
  }

  for (const migration of unpublished) {
    // A migration being added and published in the same PR is normal; CI runs
    // this gate before the build, so CI passes --update's result. Failing here
    // is what makes "publish" a deliberate step rather than an afterthought.
    if (newestPublished && migration.name <= newestPublished) {
      problems.push(
        `unpublished migration "${migration.name}" sorts BEFORE the published migration "${newestPublished}".\n` +
          `    Rename it to e.g. "${suggestName(migration.name, newestPublished, published)}" (a prefix that sorts last),\n` +
          '    then run npm run migrations:publish.',
      )
    } else {
      problems.push(
        `migration "${migration.name}" is not recorded in ${MANIFEST_RELPATH}.\n` +
          `    Publish it deliberately: npm run migrations:publish`,
      )
    }
  }

  if (problems.length) {
    report(problems)
    return 1
  }

  console.log(
    `check-migration-immutability: passed — ${published.length} published migration(s) unchanged, ` +
      `${onDisk.length} on disk, none out of order.`,
  )
  return 0
}

function report(problems) {
  console.error('check-migration-immutability: FAILED')
  for (const problem of problems) console.error(`  • ${problem}`)
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = main(process.argv.slice(2))
}
