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
 *  - Reject production NODE_ENV, remote/unknown database targets and ambiguous
 *    MySQL/preview combinations BEFORE setup or a child process can run.
 *  - MySQL is allowed only on loopback with schema tech360_ci/tech360_test.
 *    Those names are reserved for disposable test data, not real records.
 *  - Otherwise, if the optional preview adapter packages are installed: build
 *    .preview/test.db and set PREVIEW_SQLITE_URL / DATABASE_URL / NODE_ENV=test.
 *  - Otherwise: print a clear instruction and run the pure suites anyway.
 *
 * Nothing here writes to .preview/demo.db or an arbitrary DATABASE_URL. Never
 * bypass the guard by running DB-mutating suites against production directly.
 * `npm run test:offline` forces the offline path explicitly.
 */
import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const TEST_GLOB = 'tests/**/*.test.ts'
const TEST_COMMAND = `npx tsx --test --experimental-test-module-mocks ${TEST_GLOB}`
const env = { ...process.env }
const mysqlConfigured = /^mysql:\/\//i.test(env.DATABASE_URL?.trim() ?? '')

function databaseSafetyIssue() {
  if (env.NODE_ENV === 'production') return 'Tests refuse NODE_ENV=production; use a disposable test database in test mode.'
  const value = env.DATABASE_URL?.trim()
  if (!value || value.startsWith('file:')) return null // offline path replaces this with .preview/test.db
  let url
  try { url = new URL(value) } catch { return 'DATABASE_URL is invalid; tests require a disposable loopback MySQL test database or offline mode.' }
  if (url.protocol !== 'mysql:') return 'DATABASE_URL must use mysql:// for a disposable test database, or use offline mode.'
  const host = url.hostname.toLowerCase()
  let schema
  try { schema = decodeURIComponent(url.pathname.slice(1)) } catch { return 'DATABASE_URL has an invalid test database name.' }
  if (!['localhost', '127.0.0.1', '[::1]'].includes(host) || !['tech360_ci', 'tech360_test'].includes(schema)) {
    return 'DATABASE_URL is not a disposable test database: only loopback tech360_ci/tech360_test schemas are permitted.'
  }
  if ([...url.searchParams.keys()].some((key) => ['socket', 'unix_socket', 'host', 'database', 'dbname'].includes(key.toLowerCase()))) {
    return 'DATABASE_URL routing overrides are not permitted for disposable test databases.'
  }
  if (env.PREVIEW_SQLITE_URL?.trim()) return 'Do not mix MySQL DATABASE_URL with PREVIEW_SQLITE_URL; select one disposable test database.'
  return null
}

const safetyIssue = databaseSafetyIssue()
if (safetyIssue) {
  // Variable/policy names only. Never log a rejected URL or parser exception:
  // both may contain credentials or production host/schema information.
  console.error(`[test] ${safetyIssue}`)
  process.exit(1)
}

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
  env.NODE_ENV = 'test'
  console.log('[test] Disposable loopback MySQL test database accepted.')
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
