import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'

// Provider/agent/operations diagnostics are operator-only: they live in the
// shared diagnostics module consumed by the authenticated /api/health/deep
// route. The public /api/health endpoint was deliberately minimised
// (commit 965a217 "security: minimize public health response").
const diagnostics = readFileSync('src/lib/health/ai-diagnostics.ts', 'utf8')
const deep = readFileSync('src/app/api/health/deep/route.ts', 'utf8')
const publicHealth = readFileSync('src/app/api/health/route.ts', 'utf8')

describe('AI health contract', () => {
  it('reports provider configuration states without exposing credentials', () => {
    for (const state of ['CONFIGURED', 'NOT_CONFIGURED', 'MISCONFIGURED']) assert.equal(diagnostics.includes(state), true)
    assert.equal(diagnostics.includes('ZAI_API_KEY'), false)
    assert.equal(diagnostics.includes('DATABASE_URL'), true)
    assert.equal(diagnostics.includes('checks.aiProvider'), true)
  })

  it('serves the diagnostics only from the authenticated deep health route', () => {
    assert.match(deep, /guard\(req, \{ minRole: AI_WORKFORCE_MIN_ROLE \}\)/)
    assert.match(deep, /collectAiPlatformDiagnostics\(\)/)
    assert.ok(deep.indexOf('guard(req') < deep.indexOf('collectAiPlatformDiagnostics()'), 'diagnostics must be collected after the guard')
  })

  it('keeps the public health endpoint minimal (no provider, agent or heartbeat disclosure)', () => {
    for (const term of ['provider-selection', 'ai-diagnostics', 'aiProvider', 'aiAgents', 'aiOperations', 'ops.heartbeat', 'channelStatuses']) {
      assert.equal(publicHealth.includes(term), false, `public /api/health must not reference ${term}`)
    }
  })
})
