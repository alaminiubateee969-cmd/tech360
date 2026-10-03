/**
 * TECH360 — migration parity guard for the AI Software Factory tables.
 *
 * CI applies the committed MySQL migrations to a disposable database and then
 * runs `prisma migrate diff --exit-code`, which is the authoritative drift
 * check. This suite is the fast, local half of that guard: it parses
 * `prisma/schema.prisma` and the hand-written migration and fails on a missing
 * column, a wrong MySQL type, a wrong nullability or a missing index — the
 * exact mistakes that would show up as schema drift.
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, it } from 'node:test'

const ROOT = join(__dirname, '..')
const schema = readFileSync(join(ROOT, 'prisma/schema.prisma'), 'utf8')
const migration = readFileSync(join(ROOT, 'prisma/migrations/1_ai_software_factory/migration.sql'), 'utf8')

const MODELS = ['GeneratedApp', 'GeneratedAppFile', 'GeneratedAppEvent', 'MediaJob', 'MediaShot', 'FeedSource', 'FeedItem', 'CallLog']

type Field = { name: string; prismaType: string; nullable: boolean; native?: string; default?: string }

function parseModel(modelName: string): Field[] {
  const match = new RegExp(`model ${modelName} \\{([\\s\\S]*?)\\n\\}`).exec(schema)
  assert.ok(match, `model ${modelName} not found in schema.prisma`)
  const body = match[1]
  const fields: Field[] = []
  for (const raw of body.split('\n')) {
    const line = raw.trim()
    if (!line || line.startsWith('//') || line.startsWith('@@')) continue
    const m = /^(\w+)\s+(\w+)(\[\])?(\?)?(\s+@.*)?$/.exec(line)
    if (!m) continue
    const [, name, prismaType, array, optional, attrs = ''] = m
    if (array) continue // no list fields in these models
    const native = /@db\.(\w+)/.exec(attrs)?.[1]
    const def = /@default\(([^)]*)\)/.exec(attrs)?.[1]
    fields.push({ name, prismaType, nullable: Boolean(optional), native, default: def })
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

function tableSql(model: string): string {
  const m = new RegExp(`CREATE TABLE \`${model}\` \\(([\\s\\S]*?)\\n\\) DEFAULT CHARACTER SET`, 'i').exec(migration)
  assert.ok(m, `no CREATE TABLE for ${model} in the migration`)
  return m[1]
}

describe('migration parity: every new model exists', () => {
  it('declares all eight factory/media/feed/telephony tables', () => {
    for (const model of MODELS) {
      assert.ok(new RegExp(`CREATE TABLE \`${model}\``).test(migration), `missing CREATE TABLE ${model}`)
    }
  })

  it('creates them in utf8mb4 so identifiers and Bangla text survive', () => {
    const charsets = migration.match(/DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci/g) ?? []
    assert.equal(charsets.length, MODELS.length)
  })
})

describe('migration parity: columns match schema.prisma', () => {
  for (const model of MODELS) {
    it(`${model} columns, types and nullability`, () => {
      const sql = tableSql(model)
      for (const field of parseModel(model)) {
        const col = new RegExp('`' + field.name + '`\\s+([A-Z0-9()]+)', 'i').exec(sql)
        assert.ok(col, `${model}.${field.name} is missing from the migration`)
        assert.equal(col[1].toUpperCase(), mysqlType(field), `${model}.${field.name} type mismatch`)
        if (field.name === 'id') continue // primary key is always NOT NULL
        const line = new RegExp('`' + field.name + '`([^,\\n]*)').exec(sql)
        const isNotNull = / NOT NULL/.test(line?.[1] ?? '')
        assert.equal(isNotNull, !field.nullable, `${model}.${field.name} nullability mismatch`)
      }
    })
  }

  it('maps the primary key of every table', () => {
    for (const model of MODELS) {
      const sql = tableSql(model)
      assert.match(sql, /PRIMARY KEY \(`id`\)/, `${model} is missing PRIMARY KEY (id)`)
    }
  })
})

describe('migration parity: indexes match @@index / @@unique', () => {
  const expected: Array<[string, string]> = [
    ['GeneratedApp', 'GeneratedApp_code_key'],
    ['GeneratedApp', 'GeneratedApp_status_idx'],
    ['GeneratedApp', 'GeneratedApp_vertical_idx'],
    ['GeneratedApp', 'GeneratedApp_clientId_idx'],
    ['GeneratedAppFile', 'GeneratedAppFile_appId_path_key'],
    ['GeneratedAppFile', 'GeneratedAppFile_appId_idx'],
    ['GeneratedAppEvent', 'GeneratedAppEvent_appId_idx'],
    ['MediaJob', 'MediaJob_code_key'],
    ['MediaJob', 'MediaJob_status_idx'],
    ['MediaJob', 'MediaJob_kind_idx'],
    ['MediaJob', 'MediaJob_clientId_idx'],
    ['MediaShot', 'MediaShot_jobId_idx'],
    ['FeedSource', 'FeedSource_status_idx'],
    ['FeedItem', 'FeedItem_sourceId_guid_key'],
    ['FeedItem', 'FeedItem_sourceId_idx'],
    ['CallLog', 'CallLog_clientId_idx'],
    ['CallLog', 'CallLog_status_idx'],
  ]

  it('creates every declared index with Prisma’s naming convention', () => {
    for (const [model, index] of expected) {
      assert.ok(migration.includes(`\`${index}\``), `missing index ${index} (${model})`)
    }
  })

  it('keeps unique indexes unique', () => {
    for (const [, index] of expected.filter(([, i]) => i.endsWith('_key'))) {
      assert.ok(new RegExp(`UNIQUE INDEX \`${index}\``).test(migration), `${index} must be UNIQUE`)
    }
  })
})

describe('migration parity: table names use the exact model names Prisma expects', () => {
  it('has no table that the schema does not declare', () => {
    const created = [...migration.matchAll(/CREATE TABLE `(\w+)`/g)].map((m) => m[1])
    assert.deepEqual([...created].sort(), [...MODELS].sort())
  })
})
