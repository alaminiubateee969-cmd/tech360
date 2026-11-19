import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { pathToFileURL } from 'node:url'
import path from 'node:path'
import { describe, it } from 'node:test'

// Execute the real entrypoint, but intercept ALL child launches before import.
// Even the pre-fix failure demonstration cannot connect to a database, launch
// tests, generate a client or modify the offline DB. All URLs are synthetic.
const runner = pathToFileURL(path.resolve('scripts/test.mjs')).href
const probe = `
  import { createRequire, syncBuiltinESMExports } from 'node:module';
  const require = createRequire(import.meta.url);
  require('node:child_process').spawnSync = () => {
    console.log('AUDIT_TEST_CHILD_STARTED');
    return { status: 0 };
  };
  syncBuiltinESMExports();
  await import(${JSON.stringify(runner)});
`

function run(overrides: Record<string, string | undefined>) {
  const env: NodeJS.ProcessEnv = { ...process.env, NODE_ENV: 'test' }
  delete env.PREVIEW_SQLITE_URL
  for (const [name, value] of Object.entries(overrides)) {
    if (value === undefined) delete env[name]
    else env[name] = value
  }
  return spawnSync(process.execPath, ['--input-type=module', '-e', probe], { env, encoding: 'utf8' })
}

describe('test entrypoint refuses non-disposable databases before any child starts', () => {
  for (const [label, databaseUrl] of [
    ['production schema on loopback', 'mysql://synthetic_user:synthetic_password@127.0.0.1:3306/u394009794_bdtech360'],
    ['remote production host', 'mysql://synthetic_user:synthetic_password@db.example.invalid:3306/production'],
    ['remote host despite test schema name', 'mysql://synthetic_user:synthetic_password@db.example.invalid:3306/tech360_test'],
    ['production-like alternate test name', 'mysql://synthetic_user:synthetic_password@localhost:3306/tech360_test_backup'],
    ['encoded path escape', 'mysql://synthetic_user:synthetic_password@localhost:3306/tech360_test%2Fproduction'],
    ['unsupported MySQL scheme', 'mysqls://synthetic_user:synthetic_password@localhost:3306/tech360_test'],
    ['non-MySQL remote database', 'postgresql://synthetic_user:synthetic_password@db.example.invalid/production'],
  ]) {
    it(`blocks ${label} without printing credentials or starting tests`, () => {
      const result = run({ DATABASE_URL: databaseUrl })
      const output = result.stdout + result.stderr
      assert.notEqual(result.status, 0, output)
      assert.doesNotMatch(output, /AUDIT_TEST_CHILD_STARTED/)
      assert.match(output, /disposable|test database|DATABASE_URL/i)
      assert.doesNotMatch(output, /synthetic_user|synthetic_password|db\.example\.invalid|u394009794_bdtech360/)
    })
  }

  it('rejects production NODE_ENV even for a test-named schema', () => {
    const result = run({ NODE_ENV: 'production', DATABASE_URL: 'mysql://test:test@127.0.0.1/tech360_test' })
    assert.notEqual(result.status, 0)
    assert.doesNotMatch(result.stdout + result.stderr, /AUDIT_TEST_CHILD_STARTED/)
  })

  for (const host of ['127.0.0.1', 'localhost', '[::1]']) {
    for (const name of ['tech360_ci', 'tech360_test']) {
      it(`still permits disposable ${host}/${name}`, () => {
        const result = run({ DATABASE_URL: `mysql://test:test@${host}:3306/${name}` })
        assert.equal(result.status, 0, result.stderr)
        assert.match(result.stdout, /AUDIT_TEST_CHILD_STARTED/, 'the intercepted test child is reached')
      })
    }
  }

  it('still permits the offline path, without running setup in this safety probe', () => {
    const result = run({ DATABASE_URL: undefined })
    assert.equal(result.status, 0, result.stderr)
    assert.match(result.stdout, /AUDIT_TEST_CHILD_STARTED/)
  })
})
