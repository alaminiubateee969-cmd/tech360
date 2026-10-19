/**
 * TECH360 — the whole-schema / whole-DDL parity guard.
 *
 * CI applies the committed migrations to a disposable MySQL and then runs
 * `prisma migrate diff --exit-code`. That is the authoritative drift check,
 * but it needs a database, so it can only run in CI.
 *
 * This suite is the same contract, checkable anywhere: it parses
 * `prisma/schema.prisma` and EVERY committed migration and fails on
 *   - a model with no table,
 *   - a column with no DDL,
 *   - a MySQL type that does not match the Prisma type and its native
 *     annotation (VARCHAR(191) / TEXT / LONGTEXT / LONGBLOB / INTEGER /
 *     DOUBLE / BOOLEAN / DATETIME(3)),
 *   - a native-annotated field that is missing from
 *     `scripts/mysql-schema-map.json` — the map is the contract against
 *     MySQL's silent VARCHAR(191) truncation, so every long field must be
 *     listed in it,
 *   - a schema that is out of sync with that map (the converter's own
 *     `--check`, run as a subprocess so the real script is the oracle).
 *
 * The `@@map` directive is honoured, so a model with a renamed physical
 * table is compared against the right one.
 */
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe, it } from 'node:test'

const ROOT = join(__dirname, '..')
const schemaSrc = readFileSync(join(ROOT, 'prisma/schema.prisma'), 'utf8')
const mapSrc = JSON.parse(readFileSync(join(ROOT, 'scripts/mysql-schema-map.json'), 'utf8')) as {
  LongText?: string[]
  Text?: string[]
  LongBlob?: string[]
}

type Column = { name: string; prismaType: string; nullable: boolean; native?: string }
type Model = { name: string; physical: string; columns: Column[] }

const SCALARS = ['String', 'Bytes', 'Int', 'Float', 'Boolean', 'DateTime'] as const

function parseSchema(): Model[] {
  const models: Model[] = []
  let current: Model | null = null
  for (const raw of schemaSrc.split('\n')) {
    const start = /^model\s+(\w+)\s*\{/.exec(raw)
    if (start) {
      current = { name: start[1], physical: start[1], columns: [] }
      models.push(current)
      continue
    }
    if (/^\}/.test(raw)) { current = null; continue }
    if (!current) continue
    const mapped = /@@map\("(\w+)"\)/.exec(raw)
    if (mapped) { current.physical = mapped[1]; continue }
    if (raw.trim().startsWith('//')) continue
    const field = /^(\s+)(\w+)(\s+)([A-Z]\w*)(\??)\s*(.*)$/.exec(raw)
    if (!field) continue
    const [, , name, , prismaType, optional, attrs] = field
    if (!(SCALARS as readonly string[]).includes(prismaType)) continue
    const native = /@db\.(LongText|Text|LongBlob)/.exec(attrs)?.[1]
    current.columns.push({ name, prismaType, nullable: optional === '?', native })
  }
  return models
}

function parseDdl(): Map<string, Map<string, string>> {
  const tables = new Map<string, Map<string, string>>()
  const dirs = readdirSync(join(ROOT, 'prisma/migrations')).filter((d) => /^\d+_/.test(d)).sort()
  for (const dir of dirs) {
    const sql = readFileSync(join(ROOT, 'prisma/migrations', dir, 'migration.sql'), 'utf8')
    for (const statement of sql.split(';')) {
      const create = /CREATE TABLE(?: IF NOT EXISTS)?\s+`?(\w+)`?\s*\(([\s\S]*)\)/i.exec(statement)
      if (create) {
        const table = create[1]
        if (!tables.has(table)) tables.set(table, new Map())
        for (const line of create[2].split('\n')) {
          const column = /^\s*`(\w+)`\s+([A-Z]+(?:\(\d+(?:,\d+)?\))?)/i.exec(line)
          if (column) tables.get(table)!.set(column[1], column[2].toUpperCase())
        }
        continue
      }
      const alter = /ALTER TABLE\s+`?(\w+)`?/i.exec(statement)
      if (!alter) continue
      const table = alter[1]
      if (!tables.has(table)) tables.set(table, new Map())
      for (const column of statement.matchAll(/(?:ADD|MODIFY) COLUMN\s+`?(\w+)`?\s+([A-Z]+(?:\(\d+(?:,\d+)?\))?)/gi)) {
        tables.get(table)!.set(column[1], column[2].toUpperCase())
      }
    }
  }
  return tables
}

/** The MySQL type Prisma produces for a column. */
function expectedType(column: Column): string {
  switch (column.prismaType) {
    case 'String':
      if (column.native === 'LongText') return 'LONGTEXT'
      if (column.native === 'Text') return 'TEXT'
      if (column.native === 'LongBlob') return 'LONGBLOB'
      return 'VARCHAR(191)'
    case 'Bytes':
      return column.native === 'LongBlob' ? 'LONGBLOB' : 'VARBINARY(191)'
    case 'Int':
      return 'INTEGER'
    case 'Float':
      return 'DOUBLE'
    case 'Boolean':
      return 'BOOLEAN'
    case 'DateTime':
      return 'DATETIME(3)'
    default:
      return 'VARCHAR(191)'
  }
}

/**
 * Compare the DDL type with the type Prisma expects.
 *
 * A DDL type that is NARROWER than the expectation is accepted: the
 * `@@map`ed identity tables use `VARCHAR(16)` for an enum and
 * `CHAR(64)` for a SHA-256 hex, which is stricter, not a truncation
 * risk, and `prisma migrate diff` accepts it. A DIFFERENT base type,
 * or a WIDER length, is drift and fails.
 */
function typeMismatch(expected: string, actual: string): string | null {
  // VARCHAR, CHAR and VARBINARY are the same family for this check: a
  // fixed-length CHAR(64) is how the SHA-256 hash columns are declared.
  const family = (t: string) => {
    const base = t.replace(/\(.*\)$/, '')
    return base === 'CHAR' || base === 'VARCHAR' || base === 'VARBINARY' ? 'STRING' : base
  }
  const length = (t: string) => {
    const m = /\((\d+)\)/.exec(t)
    return m ? Number(m[1]) : null
  }
  if (family(expected) !== family(actual)) return `expected ${expected}, DDL has ${actual}`
  const e = length(expected)
  const a = length(actual)
  if (e !== null && a !== null && a > e) return `expected ${expected}, DDL has ${actual} — the DDL is wider`
  if (e === null && a !== null && family(expected) === 'STRING' && a > 191) {
    return `expected ${expected}, DDL has ${actual} — wider than the 191-character index limit`
  }
  return null
}

const models = parseSchema()
const tables = parseDdl()

describe('schema ↔ migration DDL parity (the whole schema)', () => {
  it('declares every model as a table', () => {
    const missing = models.filter((model) => !tables.has(model.physical)).map((model) => `${model.name} → ${model.physical}`)
    assert.deepEqual(missing, [], `models with no table in the migrations: ${missing.join(', ')}`)
  })

  it('creates every declared column with the right MySQL type', () => {
    const problems: string[] = []
    for (const model of models) {
      const table = tables.get(model.physical)
      if (!table) continue
      for (const column of model.columns) {
        const actual = table.get(column.name)
        if (!actual) { problems.push(`${model.name}.${column.name} — no DDL`); continue }
        const mismatch = typeMismatch(expectedType(column), actual)
        if (mismatch) problems.push(`${model.name}.${column.name} — ${mismatch}`)
      }
    }
    assert.deepEqual(problems, [], `schema/DDL type mismatches:\n  ${problems.join('\n  ')}`)
  })

  it('has no DDL column that the schema does not declare', () => {
    const schemaColumns = new Set<string>()
    for (const model of models) for (const column of model.columns) schemaColumns.add(`${model.physical}.${column.name}`)
    const orphans: string[] = []
    for (const [table, columns] of tables) {
      for (const column of columns.keys()) {
        if (!schemaColumns.has(`${table}.${column}`)) orphans.push(`${table}.${column}`)
      }
    }
    assert.deepEqual(orphans, [], `DDL columns the schema does not declare: ${orphans.join(', ')}`)
  })
})

describe('the MySQL native-type map is the complete source of truth', () => {
  it('lists every natively-annotated field in scripts/mysql-schema-map.json', () => {
    const listed = new Set<string>()
    for (const kind of ['LongText', 'Text', 'LongBlob'] as const) {
      for (const key of mapSrc[kind] ?? []) listed.add(key)
    }
    const unlisted: string[] = []
    for (const model of models) {
      for (const column of model.columns) {
        if (!column.native) continue
        const key = `${model.name}.${column.name}`
        if (!listed.has(key)) unlisted.push(`${key} (@db.${column.native})`)
      }
    }
    assert.deepEqual(
      unlisted,
      [],
      `natively-annotated fields missing from the map — MySQL would truncate them to VARCHAR(191):\n  ${unlisted.join('\n  ')}`,
    )
  })

  it('lists nothing in the map that the schema does not declare', () => {
    const declared = new Set<string>()
    for (const model of models) for (const column of model.columns) declared.add(`${model.name}.${column.name}`)
    const stale: string[] = []
    for (const kind of ['LongText', 'Text', 'LongBlob'] as const) {
      for (const key of mapSrc[kind] ?? []) {
        if (!declared.has(key)) stale.push(`${key} (${kind})`)
      }
    }
    assert.deepEqual(stale, [], `the map refers to fields the schema does not declare: ${stale.join(', ')}`)
  })

  it('keeps prisma/schema.prisma in sync with the map (the converter check)', () => {
    // The real script is the oracle here — not a re-implementation of it.
    const output = execFileSync('node', ['scripts/convert-schema-to-mysql.mjs', '--check'], {
      cwd: ROOT,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    assert.match(output, /schema in sync/)
  })
})

describe('the schema uses only the attributes this codebase uses', () => {
  /**
   * `prisma validate` is the authority on the schema, but it needs the
   * Prisma engine binary, which is not downloadable in every environment.
   * This is the local half of that guard: it catches a mistyped or
   * unexpected attribute before CI does.
   *
   * It earned its place: `@updated(now())` on a single `AiMemory.updatedAt`
   * — one model out of thirty-four — was enough to fail `prisma validate`
   * in CI and to mask every later step in the job.
   */
  const ALLOWED = new Set(['id', 'unique', 'default', 'relation', 'updatedAt', 'map', 'db', 'ignore', 'index'])

  it('uses no attribute outside the allowed set', () => {
    const used = new Set<string>()
    for (const raw of schemaSrc.split('\n')) {
      const line = raw.trim()
      if (!line || line.startsWith('//')) continue
      // `@@index` and `@id` are the same attribute name with a different
      // scope, so the leading '@' is stripped before the comparison.
      for (const attribute of line.match(/@@?[a-zA-Z]+/g) ?? []) used.add(attribute.replace(/^@+/, ''))
    }
    const unexpected = [...used].filter((attribute) => !ALLOWED.has(attribute)).sort()
    assert.deepEqual(
      unexpected,
      [],
      `unexpected schema attribute(s): ${unexpected.map((a) => `@${a}`).join(', ')} — check the spelling and the Prisma version`,
    )
  })

  it('gives every updatedAt field a known timestamp attribute', () => {
    const deviations: string[] = []
    for (const model of models) {
      const body = schemaSrc.split(`model ${model.name} {`)[1]?.split('\n}')[0] ?? ''
      const match = /^\s*updatedAt\s+DateTime\??\s*(.*)$/m.exec(body)
      if (!match) continue
      const attrs = match[1].trim()
      const known = /@updatedAt\b/.test(attrs) || /@default\(now\(\)\)/.test(attrs)
      if (!known) deviations.push(`${model.name}.updatedAt — ${attrs || 'no attribute'}`)
    }
    assert.deepEqual(
      deviations,
      [],
      `updatedAt fields that do not use @updatedAt or @default(now()):\n  ${deviations.join('\n  ')}`,
    )
  })
})
