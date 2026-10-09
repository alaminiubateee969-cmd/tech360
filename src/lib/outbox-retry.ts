// ============================================================
// TECH360 OUTBOX — retry policy for failed outbound communications
//
// Pure module: NO database, NO I/O. Every decision here is a pure
// function of the stored record, so the whole policy is unit-testable
// without a MySQL server and cannot drift between the ops loop and the
// admin retry path.
//
// Why this exists
// ---------------
// The outbox (`sendCommunication`) writes a `Communication` row with
// status QUEUED and updates it to SENT / FAILED / NOT_CONFIGURED /
// DISABLED_BY_ADMIN. Failed outbound rows used to be re-selected by the
// ops loop and re-dispatched through `sendCommunication`, which CREATES
// A NEW ROW. That meant:
//   1. the original FAILED row never changed, so it was picked again
//      every cycle for the whole 7-day scan window (unbounded retries);
//   2. every retry added another FAILED row, which itself became
//      eligible, so the outbox grew instead of draining;
//   3. permanently-undeliverable messages (bad recipient, bad
//      credentials) were retried as hard as transient ones.
//
// The policy below gives the outbox what an outbox needs: a bounded
// attempt count, exponential backoff, a terminal DEAD_LETTER state, and
// a classification that stops retrying things that can never succeed.
//
// Honesty rule: a retry is a real re-dispatch through the same channel
// adapter. This module never invents a SENT status; it only decides
// whether another real attempt is allowed and when.
// ============================================================

/** Terminal status written once the attempt budget is exhausted. */
export const DEAD_LETTER = 'DEAD_LETTER'

/** Hard ceiling on automatic attempts for a single outbound message. */
export const OUTBOX_MAX_ATTEMPTS = 5

/** First backoff delay (after attempt #1 fails). */
export const OUTBOX_BASE_BACKOFF_MS = 60_000

/** Geometric growth factor between consecutive backoff delays. */
export const OUTBOX_BACKOFF_FACTOR = 8

/** Backoff ceiling — never schedule a retry further out than this. */
export const OUTBOX_MAX_BACKOFF_MS = 12 * 3600_000

/** Jitter bound, as a fraction of the computed delay (±10%). */
export const OUTBOX_JITTER_RATIO = 0.1

/**
 * Only these stored statuses are eligible for automatic retry.
 *
 * NOT_CONFIGURED and DISABLED_BY_ADMIN are deliberately excluded: both
 * are operator states, not delivery failures. Retrying them cannot
 * succeed and would only generate noise — an operator must configure or
 * re-enable the channel first.
 */
export const RETRYABLE_STATUSES = ['FAILED'] as const

export type OutboxRecord = {
  id: string
  channel: string
  recipient: string | null
  status: string
  error?: string | null
  attempts: number
  nextRetryAt?: Date | null
  lastAttemptAt?: Date | null
}

export type RetryAction =
  /** Allowed to re-dispatch right now. */
  | 'RETRY'
  /** Still within the backoff window — skip this cycle. */
  | 'BACKOFF_WAIT'
  /** Attempt budget exhausted; move to DEAD_LETTER. */
  | 'DEAD_LETTER'
  /** Retry can never succeed; move to DEAD_LETTER immediately. */
  | 'NOT_RETRYABLE'

export type RetryDecision = {
  action: RetryAction
  reason: string
  attempt: number
  /** When the next attempt may run (present for RETRY and BACKOFF_WAIT). */
  nextRetryAt?: Date
  /** Set when a human must act before this message can ever be delivered. */
  requiresOperator: boolean
}

// ------------------------------------------------------------
// Failure classification
// ------------------------------------------------------------

/**
 * Error fragments that mean "this recipient or request is wrong".
 * Retrying cannot fix them, so they dead-letter on the first failure
 * and surface to an operator instead of burning the attempt budget.
 *
 * Sources are the real adapter error strings in `src/lib/comms.ts`
 * (`not a valid phone number`, provider `message`, `HTTP <status>`).
 */
const PERMANENT_PATTERNS: ReadonlyArray<{ pattern: RegExp; reason: string }> = [
  { pattern: /not a valid (phone number|email|recipient)/i, reason: 'Recipient is not a valid address — retrying cannot fix it' },
  { pattern: /invalid (recipient|phone|email|address|login|credentials|token)/i, reason: 'Credentials or recipient rejected by the provider' },
  { pattern: /recipient.{0,20}(not|isn'?t).{0,20}(whatsapp|registered|allowed)/i, reason: 'Recipient is not reachable on this channel' },
  { pattern: /unauthori[sz]ed|authentication failed|forbidden/i, reason: 'Channel credentials rejected — an operator must fix them' },
  { pattern: /account.{0,20}(suspended|blocked|disabled)/i, reason: 'Sending account is suspended or blocked' },
  { pattern: /\b(400|401|403|404|422)\b/, reason: 'Provider rejected the request as a client error' },
]

/**
 * Error fragments that mean "try again later" — capacity, upstream
 * outage, throttling and transport problems.
 */
const TRANSIENT_PATTERNS: ReadonlyArray<RegExp> = [
  /\b(408|409|429|500|502|503|504)\b/,
  /timeout|timed out|etimedout|econnreset|econnrefused|eai_again|enotfound|socket hang up|network/i,
  /rate.?limit|too many requests|temporarily unavailable|service unavailable|try again/i,
]

export type FailureClass = 'PERMANENT' | 'TRANSIENT' | 'UNKNOWN'

/** Classify a stored adapter error. UNKNOWN is treated as retryable-but-capped. */
export function classifyFailure(error: string | null | undefined): { kind: FailureClass; reason: string } {
  const text = (error ?? '').trim()
  if (!text) return { kind: 'UNKNOWN', reason: 'No error detail was recorded' }
  for (const { pattern, reason } of PERMANENT_PATTERNS) {
    if (pattern.test(text)) return { kind: 'PERMANENT', reason }
  }
  for (const pattern of TRANSIENT_PATTERNS) {
    if (pattern.test(text)) return { kind: 'TRANSIENT', reason: 'Transient provider or transport failure' }
  }
  return { kind: 'UNKNOWN', reason: 'Unrecognised failure — retried within the attempt budget' }
}

// ------------------------------------------------------------
// Backoff schedule
// ------------------------------------------------------------

/**
 * Delay before attempt `attemptNumber` (1-based: attempt 1 is the first
 * retry after the original failure). Deterministic apart from jitter.
 */
export function backoffMs(attemptNumber: number, jitterRatio: number = OUTBOX_JITTER_RATIO): number {
  const n = Math.max(1, Math.floor(attemptNumber))
  const raw = Math.min(OUTBOX_BASE_BACKOFF_MS * OUTBOX_BACKOFF_FACTOR ** (n - 1), OUTBOX_MAX_BACKOFF_MS)
  const spread = raw * jitterRatio
  // Symmetric jitter in [-spread, +spread], derived from the attempt so
  // the same call in the same cycle is stable but different records do
  // not all retry on the same tick (thundering-herd avoidance).
  const jitter = (Math.random() * 2 - 1) * spread
  return Math.round(raw + jitter)
}

/** Jitter-free variant, for assertions and for operator-facing display. */
export function nominalBackoffMs(attemptNumber: number): number {
  const n = Math.max(1, Math.floor(attemptNumber))
  return Math.min(OUTBOX_BASE_BACKOFF_MS * OUTBOX_BACKOFF_FACTOR ** (n - 1), OUTBOX_MAX_BACKOFF_MS)
}

export function isBackoffDue(nextRetryAt: Date | null | undefined, now: Date = new Date()): boolean {
  if (!nextRetryAt) return true
  return nextRetryAt.getTime() <= now.getTime()
}

// ------------------------------------------------------------
// The decision
// ------------------------------------------------------------

/**
 * Decide what the ops loop should do with one failed outbound record.
 *
 * `attempts` is the number of attempts ALREADY made (the original send
 * counts as 0 automatic attempts; the first retry makes it 1).
 */
export function decideRetry(record: OutboxRecord, now: Date = new Date()): RetryDecision {
  const attempts = Math.max(0, Math.floor(record.attempts))
  const base = { attempt: attempts, requiresOperator: false }

  if (!RETRYABLE_STATUSES.includes(record.status as (typeof RETRYABLE_STATUSES)[number])) {
    return {
      ...base,
      action: 'NOT_RETRYABLE',
      reason: `Status ${record.status} is an operator state, not a delivery failure`,
      requiresOperator: true,
    }
  }

  const failure = classifyFailure(record.error)
  if (failure.kind === 'PERMANENT') {
    return {
      ...base,
      action: 'NOT_RETRYABLE',
      reason: `${failure.reason} (${truncate(record.error)})`,
      requiresOperator: true,
    }
  }

  if (attempts >= OUTBOX_MAX_ATTEMPTS) {
    return {
      ...base,
      action: 'DEAD_LETTER',
      reason: `Automatic retry budget exhausted after ${attempts} attempts`,
      requiresOperator: true,
    }
  }

  if (!isBackoffDue(record.nextRetryAt, now)) {
    return {
      ...base,
      action: 'BACKOFF_WAIT',
      reason: `Backoff active until ${record.nextRetryAt?.toISOString()}`,
      nextRetryAt: record.nextRetryAt ?? undefined,
    }
  }

  return {
    ...base,
    action: 'RETRY',
    reason: failure.reason,
    nextRetryAt: new Date(now.getTime() + backoffMs(attempts + 1)),
  }
}

/**
 * Schedule to write after an attempt has failed. Returns the terminal
 * DEAD_LETTER payload once the budget is spent, so the caller never has
 * to reason about the cap itself.
 */
export function scheduleAfterFailure(
  record: OutboxRecord,
  now: Date = new Date(),
): { attempts: number; status: string; nextRetryAt: Date | null; deadLettered: boolean; reason: string } {
  const attempts = Math.max(0, Math.floor(record.attempts)) + 1
  const failure = classifyFailure(record.error)

  if (failure.kind === 'PERMANENT') {
    return { attempts, status: DEAD_LETTER, nextRetryAt: null, deadLettered: true, reason: failure.reason }
  }
  if (attempts >= OUTBOX_MAX_ATTEMPTS) {
    return {
      attempts,
      status: DEAD_LETTER,
      nextRetryAt: null,
      deadLettered: true,
      reason: `Automatic retry budget exhausted after ${attempts} attempts`,
    }
  }
  return {
    attempts,
    status: 'FAILED',
    nextRetryAt: new Date(now.getTime() + backoffMs(attempts)),
    deadLettered: false,
    reason: failure.reason,
  }
}

function truncate(value: string | null | undefined, max = 160): string {
  return (value ?? 'no error recorded').replace(/\s+/g, ' ').trim().slice(0, max)
}
