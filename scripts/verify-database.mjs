#!/usr/bin/env node
/**
 * TECH360 — read-only database integrity + Prisma coverage check.
 *
 * Engine aware: works against MySQL (production) and SQLite (legacy dev).
 * Performs NO writes and NO DDL. Safe to run against a live database.
 *
 * Verifies:
 *   - the connection works
 *   - every model in schema.prisma has a real table
 *   - no unexpected orphan tables (reported, not fatal)
 *   - foreign keys are declared (MySQL)
 *   - reports per-table row counts as migration evidence
 *
 * Never prints DATABASE_URL, credentials, or row contents.
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { PrismaClient } from '@prisma/client'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const schema = readFileSync(join(root, 'prisma', 'schema.prisma'), 'utf8')

const provider = /datasource\s+\w+\s*\{[^}]*?provider\s*=\s*"([a-z]+)"/s.exec(schema)?.[1] ?? 'unknown'
const url = process.env.DATABASE_URL ?? ''
const scheme = (/^([a-z0-9+]+):/i.exec(url)?.[1] ?? '').toLowerCase()

const ok = (m) => console.log(`  ✓ ${m}`)
const bad = (m) => { console.error(`  ✗ ${m}`); process.exitCode = 1 }

console.log(`prisma provider = ${provider} · DATABASE_URL scheme = ${scheme || '(unset)'}`)

if (!scheme) { console.error('FAIL: DATABASE_URL is not set'); process.exit(2) }

const agree =
  (provider === 'mysql' && scheme === 'mysql') ||
  (provider === 'sqlite' && scheme === 'file') ||
  (provider === 'postgresql' && (scheme === 'postgres' || scheme === 'postgresql'))
if (!agree) {
  console.error(`FAIL: provider '${provider}' cannot be used with a '${scheme}' URL`)
  process.exit(2)
}

// Models -> table names (honouring @@map)
const models = new Map()
for (const block of schema.split(/\n(?=model\s)/)) {
  const name = /^model\s+(\w+)\s*\{/.exec(block)?.[1]
  if (!name) continue
  const mapped = /@@map\("([^"]+)"\)/.exec(block)?.[1]
  models.set(name, mapped ?? name)
}

const db = new PrismaClient()
let failed = false

try {
  await db.$queryRawUnsafe('SELECT 1')
  ok('connection established')

  let tables = new Set()
  if (provider === 'mysql') {
    const rows = await db.$queryRawUnsafe(
      'SELECT TABLE_NAME AS n FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_TYPE = "BASE TABLE"',
    )
    tables = new Set(rows.map((r) => r.n))

    const [{ v }] = await db.$queryRawUnsafe('SELECT VERSION() AS v')
    ok(`server version ${v}`)

    const fks = await db.$queryRawUnsafe(
      'SELECT COUNT(*) AS c FROM information_schema.TABLE_CONSTRAINTS WHERE TABLE_SCHEMA = DATABASE() AND CONSTRAINT_TYPE = "FOREIGN KEY"',
    )
    ok(`${Number(fks[0].c)} foreign key constraints present`)

    const nonInno = await db.$queryRawUnsafe(
      'SELECT TABLE_NAME AS n, ENGINE AS e FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_TYPE = "BASE TABLE" AND ENGINE <> "InnoDB"',
    )
    if (nonInno.length) { bad(`non-InnoDB tables (no FK support): ${nonInno.map((r) => r.n).join(', ')}`); failed = true }
    else ok('all tables are InnoDB (foreign keys enforced)')
  } else {
    const rows = await db.$queryRawUnsafe(
      "SELECT name AS n FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'",
    )
    tables = new Set(rows.map((r) => r.n))
    const [{ r }] = await db.$queryRawUnsafe('PRAGMA integrity_check AS r')
    ok(`integrity_check = ${r ?? 'ok'}`)
  }

  const missing = [...models.entries()].filter(([, t]) => !tables.has(t))
  if (missing.length) {
    bad(`${missing.length} model(s) have no table: ${missing.map(([m]) => m).join(', ')}`)
    failed = true
  } else {
    ok(`all ${models.size} Prisma models have tables`)
  }

  const known = new Set([...models.values(), '_prisma_migrations'])
  const extra = [...tables].filter((t) => !known.has(t))
  if (extra.length) console.log(`  · ${extra.length} table(s) not in schema (left untouched): ${extra.join(', ')}`)

  // row counts — evidence that a migration preserved data
  let total = 0
  const counts = []
  for (const [model, table] of models) {
    if (!tables.has(table)) continue
    const q = provider === 'mysql' ? `SELECT COUNT(*) AS c FROM \`${table}\`` : `SELECT COUNT(*) AS c FROM "${table}"`
    try {
      const [{ c }] = await db.$queryRawUnsafe(q)
      const n = Number(c)
      total += n
      if (n > 0) counts.push(`${model}=${n}`)
    } catch { bad(`could not count rows in ${table}`); failed = true }
  }
  console.log(`  · rows: ${total} total${counts.length ? ` (${counts.join(', ')})` : ' (empty database)'}`)
} catch (e) {
  console.error(`FAIL: ${e instanceof Error ? e.message : String(e)}`)
  failed = true
} finally {
  await db.$disconnect()
}

if (failed || process.exitCode === 1) {
  console.error('database verification FAILED')
  process.exit(1)
}
console.log('database verification passed')
