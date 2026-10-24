/**
 * TECH360 — production startup gate.
 *
 * Proves the production entry point refuses unsafe configuration and never
 * prints secret values. These tests run the real scripts
 * (scripts/start-production.mjs → scripts/validate-production-env.mjs) with
 * --check, so no server is started and no port is bound.
 *
 * What this does NOT prove: that Hostinger invokes this command. That is a
 * hosting-console fact recorded in docs/OPERATIONS_GUIDEBOOK.md §3 and remains
 * unverified until an operator confirms it in hPanel.
 */
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, it } from 'node:test'

const ROOT = join(__dirname, '..')

const SECRETS = {
  SESSION_SECRET: 'session-secret-value-0123456789abcdef',
  PORTAL_SECRET: 'portal-secret-value-0123456789abcdefg',
  OPS_SECRET: 'ops-secret-value-0123456789abcdefgh',
  IDENTITY_HASH_SECRET: 'identity-secret-value-0123456789abcd',
}

function validEnv(extra: Record<string, string | undefined> = {}): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    NODE_ENV: 'production',
    DATABASE_URL: 'mysql://tech360:dbpassword@db.internal:3306/tech360_prod',
    APP_PUBLIC_URL: 'https://bdtech360.com',
    APP_ORIGIN: 'https://bdtech360.com',
    ZAI_BASE_URL: 'https://ai.internal/v1',
    ZAI_API_KEY: 'zai-key-value',
    ...SECRETS,
  }
  // Remove anything that would leak in from the host environment.
  delete env.PREVIEW_SQLITE_URL
  for (const [key, value] of Object.entries(extra)) {
    if (value === undefined) delete env[key]
    else env[key] = value
  }
  return env
}

function check(env: NodeJS.ProcessEnv) {
  const res = spawnSync(process.execPath, ['scripts/start-production.mjs', '--check'], {
    cwd: ROOT,
    env,
    encoding: 'utf8',
    timeout: 60_000,
  })
  return { code: res.status ?? -1, out: `${res.stdout ?? ''}${res.stderr ?? ''}` }
}

describe('production startup — configuration gate', () => {
  it('passes with a complete production configuration', () => {
    const { code, out } = check(validEnv())
    assert.equal(code, 0, out)
    assert.match(out, /required production environment checks passed/)
    assert.match(out, /--check passed; the server was not started/)
  })

  it('never prints a secret value', () => {
    const { code, out } = check(validEnv())
    assert.equal(code, 0, out)
    for (const value of Object.values(SECRETS)) {
      assert.ok(!out.includes(value), 'a secret value was printed in the startup output')
    }
    assert.ok(!out.includes('dbpassword'), 'the database password was printed')
    assert.ok(!out.includes('zai-key-value'), 'the AI provider key was printed')
    // The summary is deliberately name-and-state only.
    assert.match(out, /SESSION_SECRET=set/)
    assert.match(out, /DATABASE_URL=set/)
  })

  it('refuses a missing required secret and does not start', () => {
    const { code, out } = check(validEnv({ SESSION_SECRET: undefined }))
    assert.equal(code, 1, out)
    assert.match(out, /SESSION_SECRET \(required\)/)
    assert.match(out, /NOT started/i)
  })

  it('refuses a short or weak secret', () => {
    const { code, out } = check(validEnv({ OPS_SECRET: 'short' }))
    assert.equal(code, 1, out)
    assert.match(out, /at least 32 characters/)
  })

  it('refuses identical secrets', () => {
    const shared = 'identical-secret-value-0123456789abcdef'
    const { code, out } = check(validEnv({ SESSION_SECRET: shared, PORTAL_SECRET: shared }))
    assert.equal(code, 1, out)
    assert.match(out, /must be distinct secrets/)
  })

  it('refuses a non-MySQL production database', () => {
    const { code, out } = check(validEnv({ DATABASE_URL: 'file:./dev.db' }))
    assert.equal(code, 1, out)
    assert.match(out, /DATABASE_URL \(invalid URL; expected mysql:\/\/\)|credentialed mysql/)
  })

  it('refuses a non-canonical public origin', () => {
    const { code, out } = check(validEnv({ APP_ORIGIN: 'https://staging.example.com' }))
    assert.equal(code, 1, out)
    assert.match(out, /APP_ORIGIN \(must be the canonical HTTPS origin/)
  })

  it('refuses preview-only SQLite configuration in production', () => {
    const { code, out } = check(validEnv({ PREVIEW_SQLITE_URL: 'file:/tmp/preview.db' }))
    assert.equal(code, 1, out)
    assert.match(out, /preview-only configuration is refused in production/)
    assert.match(out, /PREVIEW_SQLITE_URL/)
  })
})

describe('production startup — wiring', () => {
  it('npm start and prestart both go through the guarded entry point', () => {
    const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')) as {
      scripts: Record<string, string>
    }
    assert.match(pkg.scripts.start, /node scripts\/start-production\.mjs/)
    assert.match(pkg.scripts.prestart, /validate-production-env\.mjs/)
    assert.match(pkg.scripts['start:check'], /start-production\.mjs --check/)
  })

  it('the preview adapter is never statically imported by the application', () => {
    // A static import would pull @prisma/adapter-libsql into the production
    // bundle. It must stay a lazy, optional require behind PREVIEW_SQLITE_URL.
    const src = readFileSync(join(ROOT, 'src/lib/preview-db.ts'), 'utf8')
    assert.ok(!/^import .*@prisma\/adapter-libsql/m.test(src), 'the adapter must not be statically imported')
    assert.match(src, /eval\('require'\)|createRequire/, 'the adapter must be resolved lazily')
    assert.match(src, /NODE_ENV === 'production'/, 'the adapter must refuse production')
  })
})
