import assert from 'node:assert/strict'
import { afterEach, describe, it } from 'node:test'
import { attachPreviewAdapter, isPreviewMode, previewDatabaseUrl } from '../src/lib/preview-db'

// Next declares NODE_ENV readonly for application code. These configuration
// probes intentionally vary a local test process's environment and restore it.
const env: Record<string, string | undefined> = process.env
const names = ['NODE_ENV', 'DATABASE_URL', 'PREVIEW_SQLITE_URL'] as const
const original = new Map(names.map((name) => [name, env[name]]))
afterEach(() => {
  for (const name of names) {
    const value = original.get(name)
    if (value === undefined) delete env[name]
    else env[name] = value
  }
})

// Configuration checks only: no adapter is ever created, no file is opened and
// every hostname/credential here is synthetic. Failure output must be redacted.
describe('preview database cannot silently replace a configured production datasource', () => {
  it('leaves an ordinary MySQL process unchanged when preview was not requested', () => {
    env.NODE_ENV = 'development'
    process.env.DATABASE_URL = 'mysql://synthetic_user:synthetic_password@db.example.invalid/production'
    delete process.env.PREVIEW_SQLITE_URL
    assert.equal(previewDatabaseUrl(), null)
    assert.equal(attachPreviewAdapter(), undefined)
    assert.equal(isPreviewMode(), false)
  })

  for (const primary of [
    'mysql://synthetic_user:synthetic_password@127.0.0.1/tech360_test',
    'mysql://synthetic_user:synthetic_password@db.example.invalid/production',
    'postgresql://synthetic_user:synthetic_password@db.example.invalid/production',
  ]) {
    it(`rejects a conflicting ${new URL(primary).protocol} datasource before optional-adapter resolution`, () => {
      env.NODE_ENV = 'development'
      process.env.DATABASE_URL = primary
      process.env.PREVIEW_SQLITE_URL = 'file:/synthetic-never-opened/.preview/test.db'
      assert.throws(() => previewDatabaseUrl(), (error: Error) => {
        assert.match(error.message, /DATABASE_URL.*(?:conflict|file)|conflict.*DATABASE_URL/i)
        assert.doesNotMatch(error.message, /synthetic_user|synthetic_password|db\.example\.invalid/)
        return true
      })
    })
  }

  it('accepts an explicitly matched throwaway file without touching it', () => {
    env.NODE_ENV = 'test'
    process.env.DATABASE_URL = 'file:/synthetic-never-opened/.preview/test.db'
    process.env.PREVIEW_SQLITE_URL = ' file:/synthetic-never-opened/.preview/test.db '
    assert.equal(previewDatabaseUrl(), process.env.DATABASE_URL)
    assert.equal(isPreviewMode(), true)
  })

  it('accepts preview-only file configuration when no primary datasource is configured', () => {
    env.NODE_ENV = 'development'
    delete process.env.DATABASE_URL
    process.env.PREVIEW_SQLITE_URL = 'file:/synthetic-never-opened/.preview/demo.db'
    assert.equal(previewDatabaseUrl(), process.env.PREVIEW_SQLITE_URL)
  })

  it('rejects an invalid preview protocol without printing its embedded credentials', () => {
    env.NODE_ENV = 'development'
    delete process.env.DATABASE_URL
    process.env.PREVIEW_SQLITE_URL = 'https://synthetic_user:synthetic_password@db.example.invalid/private'
    assert.throws(() => attachPreviewAdapter(), (error: Error) => {
      assert.match(error.message, /PREVIEW_SQLITE_URL.*file:/)
      assert.doesNotMatch(error.message, /synthetic_user|synthetic_password|db\.example\.invalid|\/private/)
      return true
    })
  })

  it('continues to refuse the optional adapter in production before resolving packages', () => {
    env.NODE_ENV = 'production'
    delete process.env.DATABASE_URL
    process.env.PREVIEW_SQLITE_URL = 'file:/synthetic-never-opened/.preview/test.db'
    assert.throws(() => attachPreviewAdapter(), /development-only.*refused in production/)
  })
})
