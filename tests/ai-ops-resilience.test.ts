import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { finishCycle, isTransientRunError, resolveAgentTimeoutMs, resolveOpsIntervalSec, tryStartCycle, withTimeout, RunTimeoutError } from '../src/lib/agents/resilience'

describe('AI execution resilience', () => {
  it('bounds timeout and interval configuration', () => {
    assert.equal(resolveAgentTimeoutMs({ AGENT_RUN_TIMEOUT_MS: '1' }), 5000)
    assert.equal(resolveAgentTimeoutMs({ AGENT_RUN_TIMEOUT_MS: '999999' }), 300000)
    assert.equal(resolveOpsIntervalSec({ OPS_INTERVAL_SEC: '1' }), 30)
    assert.equal(resolveOpsIntervalSec({ OPS_INTERVAL_SEC: '120' }), 120)
  })

  it('aborts timed work and reports a timeout', async () => {
    await assert.rejects(withTimeout(() => new Promise<never>(() => undefined), 5), RunTimeoutError)
  })

  it('detects retryable provider failures but not validation failures', () => {
    assert.equal(isTransientRunError({ status: 429 }), true)
    assert.equal(isTransientRunError({ status: 503 }), true)
    assert.equal(isTransientRunError({ code: 'PROVIDER_TIMEOUT' }), true)
    assert.equal(isTransientRunError({ code: 'PROVIDER_ERROR' }), true)
    assert.equal(isTransientRunError({ code: 'PROVIDER_ERROR', status: 400 }), false)
    assert.equal(isTransientRunError(new Error('invalid provider response')), false)
  })

  it('prevents overlapping cycles and reports duration', () => {
    const now = new Date('2026-01-01T00:01:00.000Z')
    assert.equal(tryStartCycle(new Date('2026-01-01T00:00:30.000Z'), now, 45000), false)
    assert.equal(tryStartCycle(new Date('2026-01-01T00:00:00.000Z'), now, 45000), true)
    assert.deepEqual(finishCycle(new Date('2026-01-01T00:00:00.000Z'), now), { durationMs: 60000, finishedAt: now.toISOString() })
  })
})
