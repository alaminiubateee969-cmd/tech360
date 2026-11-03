#!/usr/bin/env node
/**
 * TECH360 — one test command for every environment.
 *
 * CI provides a disposable MySQL `DATABASE_URL` (see .github/workflows/ci.yml).
 * An offline developer machine usually has neither MySQL nor the generated
 * MySQL Prisma engine. In that case this wrapper builds a fresh, EMPTY SQLite
 * database from the SAME production schema and points the preview adapter at
 * it, so the DB-backed suites still run real transactions instead of failing
 * or being silently skipped.
 *
 * Rules:
 *  - If DATABASE_URL is a MySQL URL: env is passed through untouched (CI path).
 *  - Otherwise, if the optional preview adapter packages are installed: build
 *    .preview/test.db and set PREVIEW_SQLITE_URL / DATABASE_URL / NODE_ENV=test.
 *  - Otherwise: print a clear instruction and run the pure suites anyway.
 *
 * Nothing here writes to .preview/demo.db, to a production database, or to any
 * remote service. `npm run test:offline` forces the offline path explicitly.
 */
import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const TEST_GLOB = 'tests/**/*.test.ts'
const TEST_COMMAND = `npx tsx --test --experimental-test-module-mocks ${TEST_GLOB}`
const env = { ...process.env }
const mysqlConfigured = /^mysql(?:\+|s)?:\/\//i.test(env.DATABASE_URL ?? '')

function adapterInstalled() {
  return existsSync(join(ROOT, 'node_modules', '@prisma', 'adapter-libsql')) &&
    existsSync(join(ROOT, 'node_modules', '@libsql', 'client'))
}

function run(argv, options = {}) {
  const result = spawnSync(argv[0], argv.slice(1), {
    cwd: ROOT, stdio: 'inherit', env, ...options,
  })
  if (result.error) throw result.error
  return result.status ?? 1
}

if (mysqlConfigured) {
  console.log('[test] MySQL DATABASE_URL detected — using the CI/production path unchanged.')
} else if (adapterInstalled()) {
  console.log('[test] No MySQL detected — building a fresh, empty offline test database.')
  const setup = run([process.execPath, 'scripts/preview/setup-test-db.mjs'])
  if (setup !== 0) {
    console.error('[test] offline database setup failed')
    process.exit(setup)
  }
  const url = `file:${join(ROOT, '.preview', 'test.db')}`
  env.PREVIEW_SQLITE_URL = url
  env.DATABASE_URL = url
  env.NODE_ENV = 'test'
  console.log(`[test] offline mode: ${url} (demo.db is untouched)`)
} else {
  console.warn(
    '[test] No MySQL and no preview adapter. DB-backed suites need either a MySQL\n' +
    '       DATABASE_URL or: npm i --no-save @prisma/adapter-libsql@6.19.3 @libsql/client@0.15.15\n' +
    '       then npm run test:offline'
  )
}

// `sh -c` expands the test glob exactly as the original npm script did.
const status = run(['sh', '-c', TEST_COMMAND])
process.exit(status)
