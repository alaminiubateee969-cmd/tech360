import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'

const health = readFileSync('src/app/api/health/route.ts', 'utf8')

describe('AI health contract', () => {
  it('reports provider configuration states without exposing credentials', () => {
    for (const state of ['CONFIGURED', 'NOT_CONFIGURED', 'MISCONFIGURED']) assert.equal(health.includes(state), true)
    assert.equal(health.includes('ZAI_API_KEY'), false)
    assert.equal(health.includes('DATABASE_URL'), true)
    assert.equal(health.includes('checks.aiProvider'), true)
  })
})
