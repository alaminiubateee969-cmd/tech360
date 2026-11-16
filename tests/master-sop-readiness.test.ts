import assert from 'node:assert/strict'
import { execFileSync, spawnSync } from 'node:child_process'
import { describe, it } from 'node:test'

const runJson = () => JSON.parse(execFileSync(process.execPath, ['scripts/master-sop-readiness.mjs', '--json'], { encoding: 'utf8' })) as {
  verdict: string
  checks: Array<{ id: string; status: string; evidence: string }>
  safety: string
  repository: { head: string }
}

describe('Master SOP production-readiness evidence collector', () => {
  it('reports critical external evidence as blocked instead of declaring production ready', () => {
    const report = runJson()
    assert.equal(report.verdict, 'NOT_PRODUCTION_READY_BLOCKED')
    assert.match(report.repository.head, /^[0-9a-f]{40}$/)
    assert.equal(report.checks.find(check => check.id === 'ACC-01')?.status, 'BLOCKED')
    assert.equal(report.checks.find(check => check.id === 'DB-02')?.status, 'BLOCKED')
    assert.equal(report.checks.find(check => check.id === 'INT-01')?.status, 'BLOCKED')
  })

  it('emits names and evidence only, never environment secret values', () => {
    const sentinel = 'must-never-appear-in-readiness-output'
    const output = execFileSync(process.execPath, ['scripts/master-sop-readiness.mjs', '--json'], {
      encoding: 'utf8',
      env: { ...process.env, SESSION_SECRET: sentinel, DATABASE_URL: `mysql://user:${sentinel}@db/prod` },
    })
    assert.doesNotMatch(output, new RegExp(sentinel))
    assert.match(output, /Secret values are never inspected or emitted/)
  })

  it('fails the strict release gate while blockers remain', () => {
    const processResult = spawnSync(process.execPath, ['scripts/master-sop-readiness.mjs', '--strict'], { encoding: 'utf8' })
    assert.equal(processResult.status, 2)
    assert.match(processResult.stdout, /NOT_PRODUCTION_READY_BLOCKED/)
  })
})
