/**
 * TECH360 — migration parity + safety guard for the outbox retry columns.
 *
 * `prisma migrate deploy` against a disposable MySQL database is the
 * authoritative drift check and runs in CI. This suite is the fast local half:
 * it parses `prisma/schema.prisma` and the hand-written
 * `3_outbox_retry_integrity/migration.sql` and fails on a missing column, a
 * wrong MySQL type, a wrong nullability, a missing index — and on any
 * destructive statement, which must never appear in a migration that touches a
 * table holding real customer communication history.
 */
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe, it } from 'node:test'

const ROOT = join(__dirname, '..')
const schema = readFileSync(join(ROOT, 'prisma/schema.prisma'), 'utf8')
const MIGRATION_DIR = join(ROOT, 'prisma/migrations/3_outbox_retry_integrity')
const migration = readFileSync(join(MIGRATION_DIR, 'migration.sql'), 'utf8')
const initMigration = readFileSync(join(ROOT, 'prisma/migrations/0_init/migration.sql'), 'utf8')

type Field = { name: string; prismaType: string; nullable: boolean; native?: string; default?: string }

function modelBody(modelName: string): string {
  const match = new RegExp(`model ${modelName} \\{([\\s\\S]*?)\\n\\}`).exec(schema)
  assert.ok(match, `model ${modelName} not found in schema.prisma`)
  return match[1]
}

function parseModel(modelName: string): Field[] {
  const fields: Field[] = []
  for (const raw of modelBody(modelName).split('\n')) {
    const line = raw.trim()
    if (!line || line.startsWith('//') || line.startsWith('@@')) continue
    const m = /^(\w+)\s+(\w+)(\[\])?(\?)?(\s+@.*)?$/.exec(line)
    if (!m) continue
    const [, name, prismaType, array, optional, attrs = ''] = m
    if (array) continue
    fields.push({
      name,
      prismaType,
      nullable: Boolean(optional),
      native: /@db\.(\w+)/.exec(attrs)?.[1],
      default: /@default\(([^)]*)\)/.exec(attrs)?.[1],
    })
  }
  return fields
}

function mysqlType(f: Field): string {
  switch (f.prismaType) {
    case 'String':
      if (f.native === 'LongText') return 'LONGTEXT'
      if (f.native === 'Text') return 'TEXT'
      return 'VARCHAR(191)'
    case 'Int':
      return 'INTEGER'
    case 'Boolean':
      return 'BOOLEAN'
    case 'DateTime':
      return 'DATETIME(3)'
    default:
      throw new Error(`unmapped Prisma type ${f.prismaType}`)
  }
}

/** Columns the outbox migration is responsible for adding. */
const NEW_COLUMNS = ['attempts', 'lastAttemptAt', 'nextRetryAt']

function addedColumn(name: string): string {
  const m = new RegExp('ADD COLUMN `' + name + '`([^,;\\n]*(?:\\n(?!\\s*ADD|\\s*CREATE)[^,;\\n]*)*)', 'i').exec(migration)
  assert.ok(m, `${name} is not added by the migration`)
  return m[1]
}

describe('outbox migration: new columns match schema.prisma', () => {
  const fields = parseModel('Communication')

  it('declares all three outbox columns in the schema', () => {
    for (const name of NEW_COLUMNS) {
      assert.ok(fields.some((f) => f.name === name), `Communication.${name} is missing from schema.prisma`)
    }
  })

  for (const name of NEW_COLUMNS) {
    it(`${name} has the correct MySQL type and nullability`, () => {
      const field = fields.find((f) => f.name === name)!
      const sql = addedColumn(name)
      const type = /^\s*([A-Z0-9()]+)/i.exec(sql)?.[1]
      assert.equal(type?.toUpperCase(), mysqlType(field), `Communication.${name} type mismatch`)
      const isNotNull = / NOT NULL/i.test(sql)
      assert.equal(isNotNull, !field.nullable, `Communication.${name} nullability mismatch`)
    })
  }

  it('gives attempts a safe NOT NULL default so existing rows stay valid', () => {
    const field = fields.find((f) => f.name === 'attempts')!
    assert.equal(field.default, '0')
    assert.match(addedColumn('attempts'), /NOT NULL DEFAULT 0/i)
  })

  it('leaves the retry timestamps nullable so existing rows need no backfill', () => {
    assert.doesNotMatch(addedColumn('lastAttemptAt'), /NOT NULL/i)
    assert.doesNotMatch(addedColumn('nextRetryAt'), /NOT NULL/i)
  })
})

describe('outbox migration: indexes match @@index', () => {
  const indexes = [...modelBody('Communication').matchAll(/@@index\(\[([^\]]+)\]\)/g)].map((m) =>
    m[1].split(',').map((s) => s.trim().replace(/[?()]/g, '')),
  )

  it('declares the retry lookup index in the schema', () => {
    assert.ok(
      indexes.some((cols) => cols.join(',') === 'status,nextRetryAt'),
      'Communication is missing @@index([status, nextRetryAt]) — the ops scan would table-scan the outbox',
    )
  })

  it('creates that index in the migration with the exact Prisma index name', () => {
    assert.match(migration, /ADD INDEX `Communication_status_nextRetryAt_idx`\(`status`,\s*`nextRetryAt`\)/)
  })

  it('covers every Communication index across the migration history', () => {
    const allMigrations = readdirSync(join(ROOT, 'prisma/migrations'))
      .filter((d) => d !== 'migration_lock.toml')
      .map((d) => readFileSync(join(ROOT, 'prisma/migrations', d, 'migration.sql'), 'utf8'))
      .join('\n')
    for (const cols of indexes) {
      const name = `Communication_${cols.join('_')}_idx`
      assert.ok(
        allMigrations.includes(name),
        `@@index([${cols.join(', ')}]) has no migration creating \`${name}\``,
      )
    }
  })

  it('still creates the pre-existing Communication indexes in the baseline', () => {
    for (const name of ['Communication_clientId_channel_idx', 'Communication_status_idx', 'Communication_channel_direction_idx']) {
      assert.ok(initMigration.includes(name), `${name} missing from 0_init`)
    }
  })
})

describe('outbox migration: non-destructive', () => {
  it('contains no destructive statement', () => {
    const destructive = [
      /\bDROP\s+TABLE\b/i,
      /\bDROP\s+COLUMN\b/i,
      /\bTRUNCATE\b/i,
      /\bDELETE\s+FROM\b/i,
      /\bUPDATE\b[^;]*\bSET\b/i,
      /\bALTER\s+COLUMN\b[^;]*\bDROP\b/i,
      /\bDROP\s+INDEX\b/i,
    ]
    for (const pattern of destructive) {
      assert.doesNotMatch(migration, pattern, `migration contains a destructive statement: ${pattern}`)
    }
  })

  it('only adds to the table it targets', () => {
    assert.equal((migration.match(/ALTER TABLE `Communication`/g) ?? []).length, 1)
    assert.doesNotMatch(migration, /ALTER TABLE `(?!Communication)/)
    assert.doesNotMatch(migration, /CREATE TABLE/i)
  })

  it('targets MySQL syntax consistent with the rest of the history', () => {
    assert.match(migration, /DATETIME\(3\)/)
    assert.doesNotMatch(migration, /TIMESTAMP WITH TIME ZONE|SERIAL|AUTOINCREMENT/i)
  })
})
