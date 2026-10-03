import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import path from 'node:path'

const validator = path.resolve(process.cwd(), 'scripts/validate-production-env.mjs')
const goodEnvironment: NodeJS.ProcessEnv = {
  CI: 'true',
  NODE_ENV: 'production',
  DATABASE_URL: 'mysql://ci_user:ci_password@127.0.0.1:3306/tech360_ci',
  APP_PUBLIC_URL: 'https://bdtech360.com',
  APP_ORIGIN: 'https://bdtech360.com',
  SESSION_SECRET: 'ci_session_secret_only_never_use_in_production_123456',
  PORTAL_SECRET: 'ci_portal_secret_only_never_use_in_production_234567',
  OPS_SECRET: 'ci_ops_secret_only_never_use_in_production_345678',
}

function validate(overrides: Record<string, string | undefined> = {}) {
  const env = { ...process.env, ...goodEnvironment, ...overrides }
  for (const [name, value] of Object.entries(overrides)) {
    if (value === undefined) delete env[name]
  }
  return spawnSync(process.execPath, [validator], { cwd: process.cwd(), env, encoding: 'utf8' })
}

test('.env.example lists variable names with empty values only', () => {
  const template = readFileSync(path.resolve(process.cwd(), '.env.example'), 'utf8')
  for (const line of template.split(/\r?\n/)) {
    const entry = line.trim()
    if (!entry || entry.startsWith('#')) continue
    assert.match(entry, /^[A-Z][A-Z0-9_]*=$/, 'template entries must contain a name and an empty value only')
  }
})

test('production runtime accepts a credentialed MySQL URL without printing values', () => {
  const databaseUrl = 'mysql://panel_user:panel_password@mysql.internal.example:3306/production_db'
  const result = validate({
    CI: undefined,
    GITHUB_ACTIONS: undefined,
    DATABASE_URL: databaseUrl,
  })
  const output = result.stdout + result.stderr
  assert.equal(result.status, 0, result.stderr)
  assert.match(result.stdout, /production environment checks passed/)
  assert.doesNotMatch(output, /panel_user|panel_password|mysql:\/\/|mysql\.internal\.example/)
  for (const name of ['SESSION_SECRET', 'PORTAL_SECRET', 'OPS_SECRET']) {
    const value = goodEnvironment[name]
    if (value) assert.equal(output.includes(value), false)
  }
})

test('production runtime rejects missing database names and non-MySQL URLs without echoing values', () => {
  const invalidUrls = [
    'mysql://db_user:db_password@db.example:3306/',
    'postgresql://db_user:db_password@db.example:5432/production_db',
  ]
  for (const databaseUrl of invalidUrls) {
    const result = validate({ DATABASE_URL: databaseUrl })
    const output = result.stdout + result.stderr
    assert.notEqual(result.status, 0)
    assert.match(output, /DATABASE_URL/)
    assert.equal(output.includes(databaseUrl), false)
    assert.doesNotMatch(output, /db_password|db\.example/)
  }
})

test('production runtime rejects weak secrets and non-canonical origins without echoing values', () => {
  const sentinel = 'DO_NOT_PRINT_THIS_SECRET_VALUE'
  const result = validate({
    SESSION_SECRET: sentinel,
    PORTAL_SECRET: undefined,
    APP_ORIGIN: 'http://bdtech360.com',
  })
  assert.notEqual(result.status, 0)
  const output = result.stdout + result.stderr
  assert.match(output, /SESSION_SECRET/)
  assert.match(output, /PORTAL_SECRET/)
  assert.match(output, /APP_ORIGIN/)
  assert.equal(output.includes(sentinel), false)
  assert.doesNotMatch(output, /ci_password|mysql:\/\//)
})

test('production runtime rejects reused signing secrets', () => {
  const shared = 'one_long_random_signing_secret_with_more_than_32_bytes'
  const result = validate({ SESSION_SECRET: shared, PORTAL_SECRET: shared })
  const output = result.stdout + result.stderr
  assert.notEqual(result.status, 0)
  assert.match(output, /must be distinct secrets/)
  assert.equal(output.includes(shared), false)
})
