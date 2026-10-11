export const AGENT_JOB_STATES = [
  'QUEUED',
  'RUNNING',
  'RETRYING',
  'AWAITING_APPROVAL',
  'COMPLETED',
  'FAILED',
  'TIMED_OUT',
  'CANCELLED',
] as const

export type AgentJobState = (typeof AGENT_JOB_STATES)[number]

export const AGENT_JOB_APPROVAL_STATES = ['NOT_REQUIRED', 'PENDING', 'APPROVED', 'REJECTED'] as const
export type AgentJobApprovalState = (typeof AGENT_JOB_APPROVAL_STATES)[number]

export const AGENT_JOB_DEFAULT_MAX_ATTEMPTS = 3
export const AGENT_JOB_BASE_BACKOFF_MS = 5_000
export const AGENT_JOB_MAX_BACKOFF_MS = 5 * 60_000

/** Bounded exponential backoff. Attempt 1 waits 5s, attempt 2 waits 10s, etc. */
export function agentJobRetryDelayMs(attempt: number): number {
  const safeAttempt = Math.max(1, Math.floor(Number.isFinite(attempt) ? attempt : 1))
  return Math.min(AGENT_JOB_MAX_BACKOFF_MS, AGENT_JOB_BASE_BACKOFF_MS * 2 ** (safeAttempt - 1))
}

/** Only retry provider/network failures that are likely transient. */
export function isRetryableAgentJobFailure(status: string, error: string | null | undefined, attempts: number, maxAttempts: number): boolean {
  if (attempts >= maxAttempts) return false
  const normalizedStatus = status.toUpperCase()
  if (normalizedStatus === 'TIMEOUT') return true
  if (normalizedStatus !== 'FAILED') return false

  const message = error ?? ''
  if (/^PROVIDER_TIMEOUT\b/.test(message)) return true
  if (/^PROVIDER_ERROR: ZAI provider request could not be completed\b/.test(message)) return true
  if (/^TOOL_TEMPORARY_FAILURE\b/.test(message)) return true
  const httpStatus = message.match(/\bHTTP\s+(\d{3})\b/i)?.[1]
  if (httpStatus) {
    const code = Number(httpStatus)
    return [408, 409, 425, 429].includes(code) || (code >= 500 && code <= 599)
  }
  return /\b(?:ECONNRESET|ECONNREFUSED|ETIMEDOUT|EAI_AGAIN|socket hang up|temporarily unavailable)\b/i.test(message)
}

export function agentJobTerminalState(status: string, attempts: number, maxAttempts: number): 'FAILED' | 'TIMED_OUT' {
  return status.toUpperCase() === 'TIMEOUT' && attempts >= maxAttempts ? 'TIMED_OUT' : 'FAILED'
}
