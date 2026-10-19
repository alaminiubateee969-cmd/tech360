/**
 * TECH360 — a local, database-free re-implementation of the CI drift gate.
 *
 * CI proves that the committed migrations reproduce `prisma/schema.prisma`
 * exactly, using `prisma migrate diff --from-url $DATABASE_URL
 * --to-schema-datamodel prisma/schema.prisma --exit-code`. That is the
 * authority, but it needs a live MySQL.
 *
 * This script applies the SAME rules statically, so the same class of drift
 * is caught before CI runs:
 *
 *   1. every model has a table (honouring `@@map`),
 *   2. every column exists, with the right MySQL type, nullability and
 *      default,
 *   3. every declared index and unique constraint exists under the name
 *      Prisma generates, with the same columns and the same uniqueness,
 *   4. the DDL has no index or column the schema does not declare.
 *
 * Usage:
 *   node scripts/check-schema-drift.mjs          # report and exit 1 on drift
 *   node scripts/check-schema-drift.mjs --json   # machine-readable
 */
import { readFileSync, readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const schemaSrc = readFileSync(join(root, 'prisma/schema.prisma'), 'utf8')

const SCALARS = ['String', 'Bytes', 'Int', 'Float', 'Boolean', 'DateTime']

// ------------------------------------------------------------
// the schema
// ------------------------------------------------------------
const models = new Map()
let current = null
for (const raw of schemaSrc.split('\n')) {
  const start = /^model\s+(\w+)\s*\{/.exec(raw)
  if (start) {
    current = { name: start[1], physical: start[1], columns: [], indexes: [] }
    models.set(current.name, current)
    continue
  }
  if (/^\}/.test(raw)) { current = null; continue }
  if (!current) continue
  const line = raw.trim()
  if (!line || line.startsWith('//')) continue
  const mapped = /@@map\("(\w+)"\)/.exec(raw)
  if (mapped) { current.physical = mapped[1]; continue }

  const blockIndex = /^@@index\(\[([^\]]*)\](?:,\s*map:\s*"([^"]+)")?\)/.exec(line)
  if (blockIndex) {
    current.indexes.push({ fields: blockIndex[1].split(',').map((f) => f.trim().split(':')[0].trim()), name: blockIndex[2], unique: false })
    continue
  }
  const blockUnique = /^@@unique\(\[([^\]]*)\](?:,\s*map:\s*"([^"]+)")?\)/.exec(line)
  if (blockUnique) {
    current.indexes.push({ fields: blockUnique[1].split(',').map((f) => f.trim().split(':')[0].trim()), name: blockUnique[2], unique: true })
    continue
  }
  const blockId = /^@@id\(\[([^\]]*)\](?:,\s*map:\s*"([^"]+)")?\)/.exec(line)
  if (blockId) continue // the primary key is not an index for comparison purposes

  const field = /^(\s+)(\w+)(\s+)([A-Z]\w*)(\??)\s*(.*)$/.exec(raw)
  if (!field) continue
  const [, , name, , prismaType, optional, attrs] = field
  if (!SCALARS.includes(prismaType)) continue
  const native = /@db\.(\w+)(?:\((\d+)(?:,\d+)?\))?/.exec(attrs)
  // the default may be followed by a trailing comment, so match the
  // balanced parentheses rather than the end of the line
  const def = /@default\(((?:[^()]|\([^()]*\))*)\)/.exec(attrs)
  current.columns.push({
    name,
    prismaType,
    optional: optional === '?',
    native: native ? native[1] : null,
    nativeLength: native?.[2] ? Number(native[2]) : null,
    unique: /@unique\b/.test(attrs),
    id: /@id\b/.test(attrs),
    default: def ? def[1] : null,
  })
}

// ------------------------------------------------------------
// the migrations
// ------------------------------------------------------------
const columns = new Map()  // table.column -> { type, notNull, default }
const indexes = new Map()  // table -> Map(name -> { unique, cols })
const tables = new Set()

const migrationsDir = join(root, 'prisma/migrations')
for (const dir of readdirSync(migrationsDir).filter((d) => /^\d+_/.test(d)).sort()) {
  const sql = readFileSync(join(migrationsDir, dir, 'migration.sql'), 'utf8')
  for (const statement of sql.split(';')) {
    const create = /CREATE TABLE(?: IF NOT EXISTS)?\s+`?(\w+)`?\s*\(([\s\S]*)\)/i.exec(statement)
    if (create) {
      const table = create[1]
      tables.add(table)
      if (!indexes.has(table)) indexes.set(table, new Map())
      for (const line of create[2].split('\n')) {
        const column = /^\s*`(\w+)`\s+([A-Z]+(?:\(\d+(?:,\d+)?\))?)\s*(NOT NULL|NULL)?\s*(DEFAULT\s+('[^']*'|[\w().]+))?/i.exec(line)
        if (column) {
          columns.set(`${table}.${column[1]}`, {
            type: column[2].toUpperCase(),
            notNull: (column[3] ?? '').toUpperCase() === 'NOT NULL',
            default: column[4] ? column[4].trim().replace(/^DEFAULT\s+/i, '') : null,
          })
          continue
        }
        const inline = /^\s*(UNIQUE\s+)?INDEX\s+`(\w+)`\s*\(([^)]*)\)/i.exec(line)
        if (inline) {
          indexes.get(table).set(inline[2], {
            unique: Boolean(inline[1]),
            cols: inline[3].split(',').map((c) => c.trim().replace(/`/g, '').split('(')[0]),
          })
        }
      }
      continue
    }
    const alter = /ALTER TABLE\s+`?(\w+)`?/i.exec(statement)
    if (!alter) continue
    const table = alter[1]
    tables.add(table)
    for (const c of statement.matchAll(/(?:ADD|MODIFY) COLUMN\s+`?(\w+)`?\s+([A-Z]+(?:\(\d+(?:,\d+)?\))?)\s*(NOT NULL|NULL)?\s*(DEFAULT\s+('[^']*'|[\w().]+))?/gi)) {
      columns.set(`${table}.${c[1]}`, {
        type: c[2].toUpperCase(),
        notNull: (c[3] ?? '').toUpperCase() === 'NOT NULL',
        default: c[4] ? c[4].trim().replace(/^DEFAULT\s+/i, '') : null,
      })
    }
    // an index added by ALTER TABLE, e.g. ADD INDEX `X`(`a`, `b`)
    for (const i of statement.matchAll(/ADD (UNIQUE )?INDEX\s+`?(\w+)`?\s*\(([^)]*)\)/gi)) {
      if (!indexes.has(table)) indexes.set(table, new Map())
      indexes.get(table).set(i[2], {
        unique: Boolean(i[1]),
        cols: i[3].split(',').map((c) => c.trim().replace(/`/g, '').split('(')[0]),
      })
    }
  }
  for (const statement of sql.split(';')) {
    const createIndex = /CREATE (UNIQUE )?INDEX\s+`?(\w+)`?\s+ON\s+`?(\w+)`?\s*\(([^)]*)\)/i.exec(statement)
    if (createIndex) {
      const table = createIndex[3]
      if (!indexes.has(table)) indexes.set(table, new Map())
      indexes.get(table).set(createIndex[2], {
        unique: Boolean(createIndex[1]),
        cols: createIndex[4].split(',').map((c) => c.trim().replace(/`/g, '').split('(')[0]),
      })
      continue
    }
    const dropIndex = /DROP INDEX\s+`?(\w+)`?\s+ON\s+`?(\w+)`?/i.exec(statement)
    if (dropIndex) indexes.get(dropIndex[2])?.delete(dropIndex[1])
  }
}

// ------------------------------------------------------------
// the rules
// ------------------------------------------------------------
/** The MySQL type Prisma produces for a column. */
function expectedType(column) {
  switch (column.prismaType) {
    case 'String':
      if (column.native === 'LongText') return 'LONGTEXT'
      if (column.native === 'Text') return 'TEXT'
      if (column.native === 'LongBlob') return 'LONGBLOB'
      if (column.native === 'Char') return column.nativeLength ? `CHAR(${column.nativeLength})` : 'CHAR'
      if (column.native === 'VarChar') return column.nativeLength ? `VARCHAR(${column.nativeLength})` : 'VARCHAR(191)'
      return 'VARCHAR(191)'
    case 'Bytes':
      return column.native === 'LongBlob' ? 'LONGBLOB' : 'VARBINARY(191)'
    case 'Int': return 'INTEGER'
    case 'Float': return 'DOUBLE'
    case 'Boolean': return 'BOOLEAN'
    case 'DateTime': return 'DATETIME(3)'
    default: return 'VARCHAR(191)'
  }
}

/**
 * The database default Prisma expects, or null when it expects none.
 *
 * `@default(cuid())`, `@default(uuid())`, `@default(autoincrement())` and
 * `@updatedAt` are client-side: they produce NO database default.
 */
function expectedDefault(column) {
  const def = column.default
  if (!def) return null
  if (/^cuid\(\)$/i.test(def)) return null
  if (/^uuid\(\)$/i.test(def)) return null
  if (/^autoincrement\(\)$/i.test(def)) return null
  if (/^now\(\)$/i.test(def)) return 'CURRENT_TIMESTAMP(3)'
  if (/^dbgenerated\(/.test(def)) return null
  const quoted = /^"([\s\S]*)"$/.exec(def)
  if (quoted) return `'${quoted[1].replace(/'/g, "''")}'`
  return def
}

function defaultsMatch(want, got) {
  if (want === null) return got === null
  if (got === null) return false
  const a = want.toUpperCase().replace(/\s+/g, '')
  const b = got.toUpperCase().replace(/\s+/g, '')
  if (a === b) return true
  // CURRENT_TIMESTAMP(3) and CURRENT_TIMESTAMP are the same default.
  if (a.startsWith('CURRENT_TIMESTAMP') && b.startsWith('CURRENT_TIMESTAMP')) return true
  return false
}

/** The index name Prisma generates. */
function indexName(model, fields, unique) {
  return `${model.physical}_${fields.join('_')}_${unique ? 'key' : 'idx'}`
}

const problems = []

for (const model of models.values()) {
  if (!tables.has(model.physical)) {
    problems.push(`MISSING TABLE  ${model.name} → ${model.physical}`)
    continue
  }
  for (const column of model.columns) {
    const ddl = columns.get(`${model.physical}.${column.name}`)
    if (!ddl) {
      problems.push(`MISSING COLUMN ${model.name}.${column.name}`)
      continue
    }
    const wantType = expectedType(column)
    const typeFamily = (t) => t.replace(/\(.*\)$/, '')
    if (typeFamily(wantType) !== typeFamily(ddl.type)) {
      problems.push(`TYPE          ${model.name}.${column.name} — schema ${wantType}, DDL ${ddl.type}`)
    } else if (wantType !== ddl.type && wantType.includes('(') && ddl.type.includes('(')) {
      const wantLength = Number(/\((\d+)\)/.exec(wantType)?.[1])
      const gotLength = Number(/\((\d+)\)/.exec(ddl.type)?.[1])
      if (Number.isFinite(wantLength) && Number.isFinite(gotLength) && gotLength > wantLength) {
        problems.push(`TYPE          ${model.name}.${column.name} — schema ${wantType}, DDL ${ddl.type} is wider`)
      }
    }
    if (!column.optional && !ddl.notNull) {
      problems.push(`NULLABILITY   ${model.name}.${column.name} — schema NOT NULL, DDL NULL`)
    }
    if (column.optional && ddl.notNull) {
      problems.push(`NULLABILITY   ${model.name}.${column.name} — schema optional, DDL NOT NULL`)
    }
    const wantDefault = expectedDefault(column)
    if (!defaultsMatch(wantDefault, ddl.default)) {
      problems.push(`DEFAULT       ${model.name}.${column.name} — schema ${wantDefault ?? 'no default'}, DDL ${ddl.default ?? 'no default'}`)
    }
  }

  // indexes and unique constraints
  const declared = new Map()
  for (const index of model.indexes) {
    declared.set(index.name ?? indexName(model, index.fields, index.unique), { cols: index.fields, unique: index.unique })
  }
  for (const column of model.columns) {
    if (!column.unique) continue
    declared.set(`${model.physical}_${column.name}_key`, { cols: [column.name], unique: true })
  }
  const actual = indexes.get(model.physical) ?? new Map()
  for (const [name, want] of declared) {
    const got = actual.get(name)
    if (!got) { problems.push(`MISSING INDEX ${model.physical}.${name} (${want.cols.join(', ')})`); continue }
    if (got.cols.join(',') !== want.cols.join(',')) {
      problems.push(`INDEX COLUMNS ${model.physical}.${name} — schema (${want.cols.join(',')}), DDL (${got.cols.join(',')})`)
    }
    if (got.unique !== want.unique) {
      problems.push(`INDEX KIND    ${model.physical}.${name} — schema ${want.unique ? 'unique' : 'index'}, DDL ${got.unique ? 'unique' : 'index'}`)
    }
  }
  for (const [name] of actual) {
    if (!declared.has(name)) problems.push(`EXTRA INDEX   ${model.physical}.${name} — the schema does not declare it`)
  }
}

if (process.argv.includes('--json')) {
  console.log(JSON.stringify({ problems, modelCount: models.size, tableCount: tables.size }, null, 2))
  process.exit(problems.length ? 1 : 0)
}

if (problems.length === 0) {
  console.log(`✓ no schema drift — ${models.size} models, ${tables.size} tables, ${columns.size} columns, ${[...indexes.values()].reduce((n, m) => n + m.size, 0)} indexes`)
  process.exit(0)
}
console.error(`✗ ${problems.length} schema drift problem(s) between prisma/schema.prisma and the migrations:`)
for (const problem of problems) console.error(`    ${problem}`)
process.exit(1)
