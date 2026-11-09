#!/usr/bin/env node
/**
 * TECH360 — disposable, EMPTY database for the DB-backed test suites.
 *
 * `npm test` can run every pure test without a database, but three suites
 * (database-workflows, governance-db, governance-outbound-db) exercise real
 * Prisma transactions and therefore need a datasource. CI provides a fresh
 * disposable MySQL. Offline / air-gapped machines do not have MySQL, so this
 * script builds the equivalent from the SAME production schema:
 *
 *   prisma/schema.prisma -> .preview/schema.sqlite.prisma -> .preview/schema.sql
 *                        -> .preview/test.db  (96 tables, ZERO seeded rows)
 *
 * Zero rows matters: several suites create canonical Agent rows with unique
 * codes, so a seeded demo database would collide. The demo database at
 * .preview/demo.db is NEVER touched.
 *
 * Run the whole suite with:  npm run test:offline
 * Or just the DB suites with:
 *   PREVIEW_SQLITE_URL=file:$PWD/.preview/test.db \
 *   DATABASE_URL=file:$PWD/.preview/test.db NODE_ENV=test \
 *   npx tsx --test tests/database-workflows.test.ts tests/governance-db.test.ts tests/governance-outbound-db.test.ts
 *
 * This is development tooling only. src/lib/preview-db.ts still refuses the
 * preview adapter when NODE_ENV=production; production uses MySQL.
 */
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { DatabaseSync } from 'node:sqlite'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const WORK = join(ROOT, '.preview')
const DB_FILE = join(WORK, 'test.db')
const DATABASE_URL = `file:${DB_FILE}`
const skipGenerate = process.argv.includes('--skip-generate')
const keepData = process.argv.includes('--keep-data')

function run(cmd, cmdArgs, extraEnv = {}) {
  return execFileSync(cmd, cmdArgs, {
    cwd: ROOT,
    env: { ...process.env, ...extraEnv },
    stdio: ['ignore', 'pipe', 'pipe'],
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  })
}

// Node 22 marks node:sqlite experimental. It is a build tool, not app runtime;
// keep the console output clean without hiding genuine application warnings.
process.on('warning', (warning) => {
  if (warning.name === 'ExperimentalWarning' && /SQLite/i.test(warning.message)) return
  console.warn(warning)
})

mkdirSync(WORK, { recursive: true })

// ------------------------------------------------------------- 1. schema text
console.log('[1/4] converting the production MySQL schema to a SQLite datamodel')
const mysqlSchema = readFileSync(join(ROOT, 'prisma', 'schema.prisma'), 'utf8')
const sqliteSchema = mysqlSchema
  .replace('provider = "mysql"', 'provider = "sqlite"')
  .replace(/ @db\.[A-Za-z]+(\([^)]*\))?/g, '')
  .replace(
    'provider = "prisma-client-js"',
    'provider = "prisma-client-js"\n  engineType = "client"\n  previewFeatures = ["driverAdapters"]'
  )
const schemaPath = join(WORK, 'schema.sqlite.prisma')
writeFileSync(schemaPath, sqliteSchema)

// --------------------------------------------------------- 2. Prisma generate
if (skipGenerate) {
  console.log('[2/4] skipping client generation (--skip-generate)')
} else {
  console.log('[2/4] generating the Prisma Client (driver-adapter engine)')
  const engineStub = {
    PRISMA_SCHEMA_ENGINE_BINARY: '/bin/true',
    PRISMA_QUERY_ENGINE_LIBRARY: '/bin/true',
  }
  try {
    run('npx', ['prisma', 'generate', '--schema', schemaPath])
  } catch (error) {
    const text = `${error.stdout ?? ''}${error.stderr ?? ''}`
    if (!/binaries\.prisma\.sh|ENOTFOUND|ECONNRESET|socket/i.test(text)) {
      console.error(text)
      process.exit(1)
    }
    console.log('    engine download unavailable — retrying with offline engine stubs')
    run('npx', ['prisma', 'generate', '--schema', schemaPath], engineStub)
  }
}

// ------------------------------------------------------------------ 3. DDL
console.log('[3/4] generating CREATE TABLE / INDEX statements')
const ddlPath = join(WORK, 'schema.sql')
execFileSync(process.execPath, [join(ROOT, 'scripts', 'preview', 'gen-ddl.mjs'), schemaPath, ddlPath], {
  cwd: ROOT, stdio: ['ignore', 'ignore', 'inherit'],
})
const ddl = readFileSync(ddlPath, 'utf8')

// --------------------------------------------------------------- 4. database
console.log('[4/4] creating a fresh, empty test database')
if (!keepData && existsSync(DB_FILE)) rmSync(DB_FILE)
const sqlite = new DatabaseSync(DB_FILE)
sqlite.exec('PRAGMA foreign_keys = ON')
sqlite.exec(ddl)
const tables = sqlite.prepare("select count(*) as n from sqlite_master where type = 'table'").get()
const users = sqlite.prepare('select count(*) as n from "User"').get()
sqlite.close()

if (tables.n < 90) throw new Error(`expected at least 90 tables, got ${tables.n}`)
if (users.n !== 0) throw new Error('test database must be empty — refusing to seed demo data')
console.log(`    ${tables.n} tables, ${users.n} rows in ${DB_FILE}`)
console.log(`    PREVIEW_SQLITE_URL=${DATABASE_URL}`)
console.log('    Run: npm run test:offline')
