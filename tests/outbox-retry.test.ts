/**
 * TECH360 — outbox retry policy.
 *
 * Pure unit tests for src/lib/outbox-retry.ts: no database, no network, no
 * Prisma client, so they run in any environment. They pin the behaviour that
 * keeps the Communication outbox from retrying forever or duplicating rows:
 * bounded attempts, exponential backoff, terminal DEAD_LETTER, and permanent
 * failures that stop on the first attempt.
 */
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  DEAD_LETTER,
  OUTBOX_BASE_BACKOFF_MS,
  OUTBOX_MAX_ATTEMPTS,
  OUTBOX_MAX_BACKOFF_MS,
  backoffMs,
  classifyFailure,
  decideRetry,
  isBackoffDue,
  nominalBackoffMs,
  scheduleAfterFailure,
  type OutboxRecord,
} from '../src/lib/outbox-retry'

const NOW = new Date('2026-10-09T12:00:00.000Z')

function record(overrides: Partial<OutboxRecord> = {}): OutboxRecord {
  return {
    id: 'comm_1',
    channel: 'EMAIL',
    recipient: 'client@example.com',
    status: 'FAILED',
    error: 'connect ECONNREFUSED 127.0.0.1:587',
    attempts: 0,
    nextRetryAt: null,
    lastAttemptAt: null,
    ...overrides,
  }
}

describe('failure classification', () => {
  it('treats transport and provider outages as transient', () => {
    // These are the real error strings produced by src/lib/comms.ts adapters.
    assert.equal(classifyFailure('connect ECONNREFUSED 127.0.0.1:587').kind, 'TRANSIENT')
    assert.equal(classifyFailure('Greeting never received - try again').kind, 'TRANSIENT')
    assert.equal(classifyFailure('WhatsApp API HTTP 503').kind, 'TRANSIENT')
    assert.equal(classifyFailure('httpSMS API HTTP 429').kind, 'TRANSIENT')
    assert.equal(classifyFailure('The operation was aborted due to timeout').kind, 'TRANSIENT')
    assert.equal(classifyFailure('getaddrinfo ENOTFOUND smtp.hostinger.com').kind, 'TRANSIENT')
  })

  it('treats bad recipients and rejected credentials as permanent', () => {
    assert.equal(classifyFailure('Recipient is not a valid phone number').kind, 'PERMANENT')
    assert.equal(classifyFailure('Invalid login: 535 authentication failed').kind, 'PERMANENT')
    assert.equal(classifyFailure('WhatsApp API HTTP 400').kind, 'PERMANENT')
    assert.equal(classifyFailure('Unauthorized').kind, 'PERMANENT')
    assert.equal(classifyFailure('(650) 555-0100 is not a valid recipient').kind, 'PERMANENT')
  })

  it('reports unrecognised and missing errors as unknown, never as permanent', () => {
    assert.equal(classifyFailure('something odd happened at the provider').kind, 'UNKNOWN')
    assert.equal(classifyFailure(null).kind, 'UNKNOWN')
    assert.equal(classifyFailure('').kind, 'UNKNOWN')
  })
})

describe('backoff schedule', () => {
  it('grows geometrically from the base delay', () => {
    assert.equal(nominalBackoffMs(1), OUTBOX_BASE_BACKOFF_MS)
    assert.equal(nominalBackoffMs(2), OUTBOX_BASE_BACKOFF_MS * 8)
    assert.equal(nominalBackoffMs(3), OUTBOX_BASE_BACKOFF_MS * 64)
  })

  it('is strictly increasing up to the cap and never exceeds it', () => {
    const values = [1, 2, 3, 4, 5, 6, 20, 100].map((n) => nominalBackoffMs(n))
    for (let i = 1; i < 5; i++) assert.ok(values[i] > values[i - 1], `attempt ${i + 1} must back off longer`)
    for (const v of values) assert.ok(v <= OUTBOX_MAX_BACKOFF_MS, 'backoff exceeded its ceiling')
  })

  it('applies bounded jitter around the nominal delay', () => {
    for (let n = 1; n <= 4; n++) {
      for (let i = 0; i < 50; i++) {
        const delta = Math.abs(backoffMs(n, 0.1) - nominalBackoffMs(n))
        assert.ok(delta <= nominalBackoffMs(n) * 0.1 + 1, `attempt ${n} jitter out of bounds`)
      }
    }
  })

  it('never schedules a delay for an invalid attempt number', () => {
    assert.ok(nominalBackoffMs(0) > 0)
    assert.ok(nominalBackoffMs(-5) > 0)
  })
})

describe('backoff gating', () => {
  it('allows a retry when no deadline is recorded', () => {
    assert.equal(isBackoffDue(null, NOW), true)
    assert.equal(isBackoffDue(undefined, NOW), true)
  })

  it('waits while the deadline is in the future and releases once it passes', () => {
    const future = new Date(NOW.getTime() + 60_000)
    const past = new Date(NOW.getTime() - 1)
    assert.equal(isBackoffDue(future, NOW), false)
    assert.equal(isBackoffDue(past, NOW), true)
    assert.equal(isBackoffDue(NOW, NOW), true)
  })
})

describe('decideRetry', () => {
  it('retries a transient failure immediately when no backoff is pending', () => {
    const decision = decideRetry(record(), NOW)
    assert.equal(decision.action, 'RETRY')
    assert.equal(decision.requiresOperator, false)
    assert.ok(decision.nextRetryAt instanceof Date)
    assert.ok(decision.nextRetryAt!.getTime() > NOW.getTime())
  })

  it('refuses to retry before the backoff deadline', () => {
    const decision = decideRetry(record({ nextRetryAt: new Date(NOW.getTime() + 300_000) }), NOW)
    assert.equal(decision.action, 'BACKOFF_WAIT')
    assert.equal(decision.nextRetryAt?.toISOString(), new Date(NOW.getTime() + 300_000).toISOString())
  })

  it('dead-letters immediately on a permanent failure, at any attempt count', () => {
    for (const attempts of [0, 1, 3]) {
      const decision = decideRetry(record({ error: 'Recipient is not a valid phone number', attempts }), NOW)
      assert.equal(decision.action, 'NOT_RETRYABLE', `attempt ${attempts} should not be retried`)
      assert.equal(decision.requiresOperator, true)
    }
  })

  it('dead-letters once the attempt budget is exhausted', () => {
    const decision = decideRetry(record({ attempts: OUTBOX_MAX_ATTEMPTS }), NOW)
    assert.equal(decision.action, 'DEAD_LETTER')
    assert.equal(decision.requiresOperator, true)
  })

  it('still allows the final attempt at budget minus one', () => {
    const decision = decideRetry(record({ attempts: OUTBOX_MAX_ATTEMPTS - 1 }), NOW)
    assert.equal(decision.action, 'RETRY')
  })

  it('does not auto-retry operator states that are not delivery failures', () => {
    for (const status of ['NOT_CONFIGURED', 'DISABLED_BY_ADMIN', 'SENT', 'QUEUED', DEAD_LETTER]) {
      const decision = decideRetry(record({ status }), NOW)
      assert.equal(decision.action, 'NOT_RETRYABLE', `${status} must not be auto-retried`)
      assert.equal(decision.requiresOperator, true)
    }
  })
})

describe('scheduleAfterFailure', () => {
  it('keeps the row retryable with a future deadline under the budget', () => {
    const next = scheduleAfterFailure(record({ attempts: 0 }), NOW)
    assert.equal(next.status, 'FAILED')
    assert.equal(next.attempts, 1)
    assert.equal(next.deadLettered, false)
    assert.ok(next.nextRetryAt && next.nextRetryAt.getTime() > NOW.getTime())
  })

  it('increments the attempt count on every failure', () => {
    const attempts = [0, 1, 2, 3].map((a) => scheduleAfterFailure(record({ attempts: a }), NOW).attempts)
    assert.deepEqual(attempts, [1, 2, 3, 4])
  })

  it('terminates at the budget instead of scheduling another attempt', () => {
    const next = scheduleAfterFailure(record({ attempts: OUTBOX_MAX_ATTEMPTS - 1 }), NOW)
    assert.equal(next.status, DEAD_LETTER)
    assert.equal(next.attempts, OUTBOX_MAX_ATTEMPTS)
    assert.equal(next.deadLettered, true)
    assert.equal(next.nextRetryAt, null)
  })

  it('terminates on a permanent failure without consuming the budget', () => {
    const next = scheduleAfterFailure(record({ error: 'Invalid login: authentication failed', attempts: 0 }), NOW)
    assert.equal(next.status, DEAD_LETTER)
    assert.equal(next.deadLettered, true)
    assert.equal(next.attempts, 1)
  })

  it('cannot produce an unbounded retry chain', () => {
    // Simulate the full lifecycle of a message that never succeeds.
    let current = record({ attempts: 0 })
    let loops = 0
    let status = current.status
    while (status !== DEAD_LETTER && loops < 100) {
      const next = scheduleAfterFailure({ ...current, attempts: loops }, NOW)
      status = next.status
      current = { ...current, attempts: next.attempts }
      loops++
    }
    assert.equal(status, DEAD_LETTER, 'a permanently failing message must terminate')
    assert.ok(loops <= OUTBOX_MAX_ATTEMPTS, `terminated after ${loops} attempts, expected <= ${OUTBOX_MAX_ATTEMPTS}`)
  })
})
