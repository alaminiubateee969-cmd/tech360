import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  agentJobRetryDelayMs,
  agentJobTerminalState,
  isRetryableAgentJobFailure,
} from '../src/lib/agents/job-policy'

describe('durable AgentJob retry policy', () => {
  it('uses bounded exponential backoff', () => {
    assert.equal(agentJobRetryDelayMs(1), 5_000)
    assert.equal(agentJobRetryDelayMs(2), 10_000)
    assert.equal(agentJobRetryDelayMs(10), 5 * 60_000)
  })

  it('retries only transient provider failures within the attempt budget', () => {
    assert.equal(isRetryableAgentJobFailure('TIMEOUT', 'PROVIDER_TIMEOUT: timed out', 1, 3), true)
    assert.equal(isRetryableAgentJobFailure('FAILED', 'PROVIDER_ERROR: ZAI provider returned HTTP 503: unavailable', 1, 3), true)
    assert.equal(isRetryableAgentJobFailure('FAILED', 'PROVIDER_NOT_CONFIGURED: missing credentials', 1, 3), false)
    assert.equal(isRetryableAgentJobFailure('FAILED', 'Daily quota exceeded', 1, 3), false)
    assert.equal(isRetryableAgentJobFailure('TIMEOUT', 'PROVIDER_TIMEOUT: timed out', 3, 3), false)
  })

  it('does not label a textual provider failure as a timeout', () => {
    assert.equal(agentJobTerminalState('FAILED', 3, 3), 'FAILED')
    assert.equal(agentJobTerminalState('TIMEOUT', 3, 3), 'TIMED_OUT')
  })
})
