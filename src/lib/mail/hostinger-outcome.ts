// ============================================================
// TECH360 — Hostinger Mail API send-outcome classification (pure)
//
// Decides what a failed send means for the outbox:
//
//   ACCEPTED       HTTP 204 — the provider accepted the message and saved
//                  a copy to Sent. This is PROVIDER ACCEPTANCE, not
//                  confirmed delivery to the recipient.
//   NOT_PROCESSED  The request never reached a state where the provider
//                  could have sent the message (429 rate limit, 503,
//                  connection refused, DNS failure). Safe to retry.
//   REJECTED       The provider refused the request (4xx: bad token,
//                  forbidden mailbox, validation). Retrying cannot help.
//   AMBIGUOUS      The outcome is unknown: 500/502/504, timeouts, resets,
//                  or any failure after the request may have been sent.
//                  Automatic retry could DUPLICATE a customer email, so
//                  the outbox parks it for operator reconciliation.
//
// The error text produced here is stored in Communication.error and is
// classified again by src/lib/outbox-retry.ts. It contains the HTTP
// status and the provider's machine-readable code only; it never
// contains the recipient, the message body or the credential.
// ============================================================

export type HostingerSendClassification = 'ACCEPTED' | 'NOT_PROCESSED' | 'REJECTED' | 'AMBIGUOUS'

export type HostingerFailureInput = {
  httpStatus?: number
  /** Provider machine-readable code (e.g. ERR_RATE_LIMIT). Sanitized before use. */
  apiCode?: string
  /** Node/axios transport code (e.g. ECONNREFUSED, ECONNABORTED). */
  networkCode?: string
  /** True once the request was handed to the transport. */
  requestSent: boolean
}

export type HostingerFailureClassification = {
  classification: Exclude<HostingerSendClassification, 'ACCEPTED'>
  /** Safe, value-free error text for Communication.error. */
  error: string
}

const PRE_SEND_NETWORK_CODES = new Set(['ECONNREFUSED', 'ENOTFOUND', 'EAI_AGAIN', 'ENETUNREACH', 'EHOSTUNREACH'])
const AMBIGUOUS_NETWORK_CODES = new Set(['ECONNABORTED', 'ETIMEDOUT', 'ECONNRESET', 'EPIPE', 'ERR_CANCELED'])

export const AMBIGUOUS_OUTCOME_PREFIX = 'AMBIGUOUS_PROVIDER_OUTCOME'

/** Hostinger codes are SCREAMING_SNAKE (e.g. ERR_RATE_LIMIT). Anything else is replaced, never echoed. */
function safeCode(code: string | undefined): string {
  if (!code) return 'NO_CODE'
  return /^[A-Z][A-Z0-9_]{2,63}$/.test(code) ? code : 'UNRECOGNIZED'
}

/** Classify a failed Hostinger Mail API send. Pure: no I/O, no secrets. */
export function classifyHostingerSendFailure(input: HostingerFailureInput): HostingerFailureClassification {
  const code = safeCode(input.apiCode)
  const status = input.httpStatus

  if (typeof status === 'number') {
    if (status === 429) {
      return { classification: 'NOT_PROCESSED', error: `Hostinger Mail API HTTP 429 (${code}): rate limit reached — retry later` }
    }
    if (status === 503) {
      return { classification: 'NOT_PROCESSED', error: `Hostinger Mail API HTTP 503 (${code}): service unavailable — retry later` }
    }
    if (status === 401 || status === 403) {
      return { classification: 'REJECTED', error: `Hostinger Mail API HTTP ${status} (${code}): unauthorized or forbidden for this mailbox — an operator must fix credentials` }
    }
    if (status >= 400 && status < 500) {
      return { classification: 'REJECTED', error: `Hostinger Mail API HTTP ${status} (${code}): request rejected by provider validation` }
    }
    // 500, 502, 504 and any other 5xx: the provider may have accepted the message.
    return {
      classification: 'AMBIGUOUS',
      error: `${AMBIGUOUS_OUTCOME_PREFIX}: Hostinger Mail API HTTP ${status} (${code}). The message may already have been accepted; verify the Sent folder before any manual retry.`,
    }
  }

  const netCode = safeCode(input.networkCode)
  if (input.networkCode && PRE_SEND_NETWORK_CODES.has(input.networkCode)) {
    return { classification: 'NOT_PROCESSED', error: `Hostinger Mail API network failure before the request was sent (${netCode}) — retry later` }
  }
  if (input.networkCode && AMBIGUOUS_NETWORK_CODES.has(input.networkCode)) {
    return {
      classification: 'AMBIGUOUS',
      error: `${AMBIGUOUS_OUTCOME_PREFIX}: Hostinger Mail API request timed out or was reset (${netCode}). The message may already have been accepted; verify the Sent folder before any manual retry.`,
    }
  }

  if (!input.requestSent) {
    return { classification: 'NOT_PROCESSED', error: 'Hostinger Mail API client error before the request was sent — retry later' }
  }
  return {
    classification: 'AMBIGUOUS',
    error: `${AMBIGUOUS_OUTCOME_PREFIX}: Hostinger Mail API returned no usable response. The message may already have been accepted; verify the Sent folder before any manual retry.`,
  }
}

/** Map an SDK/axios thrown value to the failure input. Reads only status, code and transport code. */
export function hostingerFailureInputFromError(error: unknown, requestSent: boolean): HostingerFailureInput {
  const e = (error ?? {}) as {
    code?: unknown
    response?: { status?: unknown; data?: unknown }
  }
  const status = typeof e.response?.status === 'number' ? e.response.status : undefined
  const data = e.response?.data as { code?: unknown } | undefined
  const apiCode = typeof data?.code === 'string' ? data.code : undefined
  const networkCode = typeof e.code === 'string' && status === undefined ? e.code : undefined
  return { httpStatus: status, apiCode, networkCode, requestSent }
}
