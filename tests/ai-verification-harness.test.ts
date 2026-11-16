import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'

test('AI verification command executes the current engine and emits honest code-only evidence', { timeout: 90000 }, () => {
  const dir = mkdtempSync(join(tmpdir(), 'tech360-ai-verification-'))
  try {
    const reportPath = join(dir, 'report.json')
    const result = spawnSync(process.execPath, ['--import', 'tsx', 'scripts/verify-ai-production.ts', '--out', reportPath], {
      encoding: 'utf8', timeout: 80000,
      env: { ...process.env, PREVIEW_SQLITE_URL: 'file:must-not-be-opened.db', OPENROUTER_API_KEY: 'test-only-host-env-must-be-ignored' },
      maxBuffer: 4 * 1024 * 1024,
    })
    assert.equal(result.status, 0, result.stdout + result.stderr)
    const report = JSON.parse(readFileSync(reportPath, 'utf8'))
    assert.equal(report.evidenceLevel, 'CODE_VERIFIED')
    assert.equal(report.summary.failed, 0)
    assert.ok(report.summary.checks >= 66)
    assert.equal(report.summary.passed, report.summary.checks)
    assert.equal(report.summary.agentsExecutableEndToEnd, 44)
    assert.ok(report.agents.every((agent: { allChecksPass: boolean }) => agent.allChecksPass))
    assert.deepEqual(report.failures, [])
    assert.ok(report.notVerifiableHere.includes('real MySQL persistence'))
    assert.ok(report.notVerifiableHere.includes('Hostinger deployment'))
    assert.doesNotMatch(JSON.stringify(report), /test-only-host-env-must-be-ignored/)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})
