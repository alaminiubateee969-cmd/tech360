#!/usr/bin/env node
/**
 * TECH360 — offline preview database builder (development only).
 *
 * Builds a throwaway SQLite database plus a matching Prisma Client so the whole
 * product (public website, client portal, Super Admin console) can be reviewed
 * on a machine with no MySQL server:
 *
 *   1. prisma/schema.prisma            -> .preview/schema.sqlite.prisma
 *      (provider sqlite, MySQL @db.* annotations stripped, engineType "client")
 *   2. prisma generate into node_modules/@prisma/client (pure-JS driver adapter,
 *      no native query engine required)
 *   3. schema -> CREATE TABLE/INDEX DDL -> .preview/demo.db
 *   4. the real production seed (prisma/seed.ts) re-pointed at the preview client
 *   5. the fictional demo dataset (scripts/preview/seed-demo.ts)
 *
 * Nothing here is production storage. src/lib/preview-db.ts refuses
 * PREVIEW_SQLITE_URL when NODE_ENV=production.
 *
 * Usage:
 *   npm i --no-save @prisma/adapter-libsql@6.19.3 @libsql/client@0.15.15
 *   node scripts/preview/setup.mjs [--skip-generate] [--keep-data]
 *
 * The adapter packages must match @prisma/client (6.19.3); 7.x renames the
 * PrismaLibSQL export and preview mode fails to construct the adapter.
 *
 * Then:
 *   PREVIEW_SQLITE_URL=file:$PWD/.preview/demo.db PORTAL_OTP=off npm run dev
 */
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const WORK = join(ROOT, '.preview')
const DB_FILE = join(WORK, 'demo.db')
const DATABASE_URL = `file:${DB_FILE}`
const args = process.argv.slice(2)
const skipGenerate = args.includes('--skip-generate')
const keepData = args.includes('--keep-data')

function log(step, message) {
  console.log(`\n[${step}] ${message}`)
}

function run(cmd, cmdArgs, extraEnv = {}) {
  return execFileSync(cmd, cmdArgs, {
    cwd: ROOT,
    env: { ...process.env, ...extraEnv },
    stdio: ['ignore', 'pipe', 'pipe'],
    encoding: 'utf8',
    // Prisma query logging in development is verbose; allow a large buffer.
    maxBuffer: 64 * 1024 * 1024,
  })
}

// ---------------------------------------------------------------- 0. adapter
try {
  await import('@prisma/adapter-libsql')
  await import('@libsql/client')
} catch {
  console.error(
    'Preview mode needs two optional packages. Install them with:\n\n' +
      '  npm i --no-save @prisma/adapter-libsql@6.19.3 @libsql/client@0.15.15\n',
  )
  process.exit(1)
}

mkdirSync(WORK, { recursive: true })

// ------------------------------------------------------- 1. schema conversion
log('1/5', 'converting the MySQL schema to SQLite')
let schema = readFileSync(join(ROOT, 'prisma', 'schema.prisma'), 'utf8')
schema = schema
  .replace('provider = "mysql"', 'provider = "sqlite"')
  // SQLite has no native MySQL types. @db.Char(64) and friends must go too,
  // otherwise Prisma rejects the datamodel ("Native type Char is not supported").
  .replace(/ @db\.[A-Za-z]+(\([^)]*\))?/g, '')
  .replace(
    'provider = "prisma-client-js"',
    'provider = "prisma-client-js"\n  engineType = "client"\n  previewFeatures = ["driverAdapters"]',
  )
const schemaPath = join(WORK, 'schema.sqlite.prisma')
writeFileSync(schemaPath, schema)
console.log(`    ${schemaPath}`)

// --------------------------------------------------------- 2. Prisma generate
if (skipGenerate) {
  log('2/5', 'skipping client generation (--skip-generate)')
} else {
  log('2/5', 'generating the Prisma Client (driver-adapter engine)')
  // Blocked network to binaries.prisma.sh (air-gapped sandboxes): the client
  // engine type needs no native binary, so stub the engine paths and retry.
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
  console.log('    node_modules/@prisma/client regenerated for preview use')
}

// --------------------------------------------------------------- 3. database
if (!keepData && existsSync(DB_FILE)) rmSync(DB_FILE)
log('3/5', 'creating the preview database')
run(process.execPath, [join(ROOT, 'scripts', 'preview', 'gen-ddl.mjs'), schemaPath, join(WORK, 'schema.sql')])
const ddl = readFileSync(join(WORK, 'schema.sql'), 'utf8')
const { createClient } = await import('@libsql/client')
const client = createClient({ url: DATABASE_URL })
for (const statement of ddl.split(/;\s*\n/)) {
  const sql = statement.trim()
  if (sql) await client.execute(sql.endsWith(';') ? sql : `${sql};`)
}
const tables = await client.execute("select count(*) as n from sqlite_master where type='table'")
console.log(`    ${tables.rows[0].n} tables created in ${DB_FILE}`)

// ------------------------------------------------------------------- 4. seed
log('4/5', 'running the production seed (prisma/seed.ts) against the preview client')
const seedSource = readFileSync(join(ROOT, 'prisma', 'seed.ts'), 'utf8')
const previewSeed = seedSource
  .replace("import { PrismaClient } from '@prisma/client'\n", '')
  .replace('const db = new PrismaClient()', "import { db } from '../src/lib/db'")
const previewSeedPath = join(WORK, 'seed.ts')
writeFileSync(previewSeedPath, previewSeed)
run(
  'npx',
  ['tsx', previewSeedPath],
  {
    PREVIEW_SQLITE_URL: DATABASE_URL,
    DATABASE_URL,
    // 'test' keeps Prisma's per-query logging off so seeding stays readable.
    NODE_ENV: 'test',
    ADMIN_EMAIL: process.env.ADMIN_EMAIL || 'admin@tech360.local',
    ADMIN_PASSWORD: process.env.ADMIN_PASSWORD || 'Tech360-Demo-2026!',
  },
)

// -------------------------------------------------------------- 5. demo data
log('5/5', 'loading the demo CRM dataset')
run('npx', ['tsx', join(ROOT, 'scripts', 'preview', 'seed-demo.ts')], {
  PREVIEW_SQLITE_URL: DATABASE_URL,
  NODE_ENV: 'test',
})

// Demo convenience: the production seed forces a password change on first
// login. A review/demo database has no operator to perform it, so clear the
// flag here. This runs against the throwaway file only.
const adminEmail = process.env.ADMIN_EMAIL || 'admin@tech360.local'
await client.execute({
  sql: 'UPDATE `User` SET mustChangePassword = 0 WHERE email = ?',
  args: [adminEmail],
})

const counts = await client.execute(
  "select (select count(*) from `Client`) c, (select count(*) from `Project`) p, (select count(*) from `Invoice`) i, (select count(*) from `AiAgent`) a",
)
console.log('    rows:', JSON.stringify(counts.rows[0]))

console.log(`
Preview database ready.

  Start the app:
    PREVIEW_SQLITE_URL=file:$PWD/.preview/demo.db PORTAL_OTP=off npm run dev

  Super Admin console:  http://localhost:3000/#/admin
    admin@tech360.local      / Tech360-Demo-2026!
    manager@tech360.local    / Tech360-Demo-2026!
    sales@tech360.local      / Tech360-Demo-2026!

  Client portal:        http://localhost:3000/#/portal
    Client IDs: TECH-2026-000101 … TECH-2026-000106
    (production always requires a one-time code; PORTAL_OTP=off in the
     start command above enables the development contact-match step, so any
     contact value on the record works. Without it sign-in fails closed 503.)

  Preview storage only — never point a production deployment at this file.
`)
