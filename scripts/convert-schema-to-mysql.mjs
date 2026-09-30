#!/usr/bin/env node
/**
 * TECH360 — SQLite -> MySQL Prisma schema converter.
 *
 * Deterministic and idempotent. Applies scripts/mysql-schema-map.json to
 * prisma/schema.prisma:
 *
 *   1. datasource provider  "sqlite" -> "mysql"
 *   2. adds explicit MySQL native types (@db.Text / @db.LongText / @db.LongBlob)
 *      to every field that can exceed Prisma's MySQL default of VARCHAR(191).
 *
 * Why (2) is mandatory: on MySQL, `String` becomes VARCHAR(191). Any value
 * longer than that is rejected in STRICT mode or silently truncated otherwise.
 * SQLite has no such limit, so the SQLite schema hides the problem entirely.
 *
 * Usage:
 *   node scripts/convert-schema-to-mysql.mjs            # write
 *   node scripts/convert-schema-to-mysql.mjs --check    # verify, exit 1 on drift
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const schemaPath = join(root, 'prisma', 'schema.prisma')
const mapPath = join(root, 'scripts', 'mysql-schema-map.json')
const check = process.argv.includes('--check')

const map = JSON.parse(readFileSync(mapPath, 'utf8'))
const native = new Map()
for (const kind of ['LongText', 'Text', 'LongBlob']) {
  for (const key of map[kind] ?? []) native.set(key, `@db.${kind}`)
}

const src = readFileSync(schemaPath, 'utf8')
const lines = src.split('\n')
const out = []
const applied = new Set()
let model = null
let inDatasource = false

for (const raw of lines) {
  let line = raw

  if (/^datasource\s+\w+\s*\{/.test(line)) inDatasource = true
  else if (inDatasource && /^\}/.test(line)) inDatasource = false

  if (inDatasource && /^\s*provider\s*=/.test(line)) {
    line = line.replace(/"(sqlite|mysql)"/, '"mysql"')
    out.push(line)
    continue
  }

  const modelMatch = /^model\s+(\w+)\s*\{/.exec(line)
  if (modelMatch) model = modelMatch[1]
  else if (/^\}/.test(line)) model = null

  if (model) {
    const field = /^(\s+)(\w+)(\s+)(String|Bytes)(\??)(\s*)(.*)$/.exec(line)
    if (field) {
      const [, indent, name, gap, type, opt, , rest] = field
      const want = native.get(`${model}.${name}`)
      if (want) {
        // split trailing "// comment" off the attribute section
        const ci = rest.indexOf('//')
        let attrs = (ci === -1 ? rest : rest.slice(0, ci)).trimEnd()
        const comment = ci === -1 ? '' : rest.slice(ci)
        // idempotent: drop any previously-applied @db.* for this field
        attrs = attrs.replace(/\s*@db\.\w+(\([^)]*\))?/g, '').trimEnd()

        // MySQL rejects literal DEFAULTs on BLOB/TEXT/JSON columns (errno 1101),
        // so a text column simply cannot carry one.
        //
        // The expression form MySQL 8.0.13+ accepts, `DEFAULT (_utf8mb4'{}')`,
        // does apply cleanly — verified in CI — but Prisma cannot read
        // expression defaults back during introspection (prisma/prisma#2600).
        // The diff therefore re-emits the same ALTER forever, so the schema is
        // permanently "drifted" and no migration can ever be proven correct.
        //
        // We drop the database-level default instead. The value is supplied at
        // the (few) call sites that previously relied on it, which keeps the
        // stored value identical while working on MySQL 5.7, 8.x and MariaDB
        // alike, with zero drift.
        if (want === '@db.Text' || want === '@db.LongText') {
          attrs = attrs.replace(/\s*@default\((?:"(?:[^"\\]|\\.)*"|[^)]*)\)/g, '').trimEnd()
        }

        attrs = attrs ? `${attrs} ${want}` : want
        line = `${indent}${name}${gap}${type}${opt} ${attrs}${comment ? ' ' + comment : ''}`
        applied.add(`${model}.${name}`)
      }
    }
  }
  out.push(line)
}

const result = out.join('\n')
const missing = [...native.keys()].filter((k) => !applied.has(k))
if (missing.length) {
  console.error(`✗ mapping refers to ${missing.length} field(s) not found in schema:`)
  for (const m of missing) console.error(`    ${m}`)
  process.exit(1)
}

if (check) {
  if (result !== src) {
    console.error('✗ prisma/schema.prisma is out of sync with scripts/mysql-schema-map.json')
    console.error('  run: node scripts/convert-schema-to-mysql.mjs')
    process.exit(1)
  }
  console.log(`✓ schema in sync — provider=mysql, ${applied.size} native type annotations`)
  process.exit(0)
}

writeFileSync(schemaPath, result)
console.log(`✓ provider=mysql, applied ${applied.size} native type annotations`)
