import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { resolveBuildIdentity } from '../scripts/build-identity.mjs'

test('build identity follows actual Git HEAD and records dirty source, not caller overrides', () => {
  const cwd = mkdtempSync(join(tmpdir(), 'tech360-build-identity-'))
  const git = (...args: string[]) => execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim()
  try {
    git('init')
    writeFileSync(join(cwd, 'source.txt'), 'original\n')
    git('add', 'source.txt')
    git('-c', 'user.name=Test', '-c', 'user.email=test@example.invalid', '-c', 'commit.gpgsign=false', 'commit', '-m', 'fixture')
    const sha = git('rev-parse', 'HEAD')
    assert.deepEqual(resolveBuildIdentity({ cwd, env: { TECH360_BUILD_SHA: 'f'.repeat(40) } }), { commit: sha, sourceState: 'clean' })
    writeFileSync(join(cwd, 'source.txt'), 'changed\n')
    assert.deepEqual(resolveBuildIdentity({ cwd, env: {} }), { commit: sha, sourceState: 'dirty' })
  } finally {
    rmSync(cwd, { recursive: true, force: true })
  }
})

test('archive builds accept only a full SHA, never arbitrary configuration or secret values', () => {
  const cwd = mkdtempSync(join(tmpdir(), 'tech360-archive-'))
  try {
    assert.deepEqual(resolveBuildIdentity({ cwd, env: { TECH360_BUILD_SHA: 'A'.repeat(40) } }), { commit: 'a'.repeat(40), sourceState: 'unknown' })
    for (const value of [undefined, '', '63fb0ce', 'mysql://private:secret@db/app', 'secret-value', 'z'.repeat(40)]) {
      assert.deepEqual(resolveBuildIdentity({ cwd, env: { TECH360_BUILD_SHA: value } }), { commit: 'unknown', sourceState: 'unknown' })
    }
  } finally {
    rmSync(cwd, { recursive: true, force: true })
  }
})

test('health route embeds release metadata and production retains frame protection', async () => {
  const { readFileSync } = await import('node:fs')
  const health = readFileSync('src/app/api/health/route.ts', 'utf8')
  assert.match(health, /commit: process\.env\.TECH360_BUILD_SHA/)
  assert.match(health, /sourceState: process\.env\.TECH360_BUILD_SOURCE_STATE/)
  const config = (await import('../next.config')).default
  assert.match(String(config.env?.TECH360_BUILD_SHA), /^[a-f0-9]{40}$/)
  const rules = await config.headers!()
  assert.ok(rules.some(rule => rule.headers.some(header => header.key === 'X-Frame-Options' && header.value === 'SAMEORIGIN')))
})
