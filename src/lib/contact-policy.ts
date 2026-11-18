export type WelcomeChannel = 'WHATSAPP' | 'EMAIL' | 'SMS' | null

/** Bump when the corresponding consent copy or processing purpose changes. */
export const CONTACT_CONSENT_VERSION = 'contact-v3-2026-10-28'
export const MARKETING_CONSENT_VERSION = 'marketing-v1-2026-10-23'

export function hasExplicitContactConsent(value: unknown): boolean {
  return value === true
}

export function hasExplicitMarketingConsent(value: unknown): boolean {
  return value === true
}

/** Accept only a bounded opaque idempotency key; clients generate UUIDs. */
export function isValidClientRequestId(value: unknown): value is string {
  return typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9._-]{15,63}$/.test(value)
}

/**
 * Exact session-request replays may recover a lost Set-Cookie response. Treat
 * absent and blank contact addresses as the same value; anonymous CHAT-first
 * sessions intentionally store `null` while their retry sends an empty string.
 */
export function chatReplayContactMatches(storedEmail: string | null | undefined, requestedEmail: string | null | undefined): boolean {
  const normalize = (value: string | null | undefined) => value?.trim().toLowerCase() ?? ''
  return normalize(storedEmail) === normalize(requestedEmail)
}

/**
 * Inbound messages receive a reply on their original channel; website leads use only their chosen method.
 *
 * SMS is a first-class entry channel of the client journey (the pipeline
 * starts from "the first SMS"), so an SMS lead is answered on SMS.
 */
export function selectWelcomeChannel(source: string, preferredContact?: string | null): WelcomeChannel {
  const inbound = source.trim().toUpperCase()
  if (inbound.includes('WHATSAPP')) return 'WHATSAPP'
  if (inbound.includes('EMAIL')) return 'EMAIL'
  if (inbound.includes('SMS')) return 'SMS'
  const preference = preferredContact?.trim().toLowerCase()
  if (preference === 'whatsapp') return 'WHATSAPP'
  if (preference === 'email') return 'EMAIL'
  if (preference === 'sms') return 'SMS'
  // A "phone" preference means a call, and unknown preferences need a
  // human; they must not silently fall back to a different, unselected
  // channel.
  return null
}
