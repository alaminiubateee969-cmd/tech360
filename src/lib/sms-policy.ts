/**
 * Deterministic SMS opt-out command detection. Keep this separate from AI
 * classification: opt-out must be handled before any automated reply.
 * START is intentionally not an opt-in command; renewed consent must follow
 * the documented consent flow rather than a keyword silently reversing STOP.
 */
const SMS_OPTOUT_KEYWORDS = new Set([
  'STOP',
  'STOPALL',
  'STOP ALL',
  'UNSUBSCRIBE',
  'CANCEL',
  'END',
  'QUIT',
])

export function isSmsOptOutKeyword(message: string): boolean {
  const normalized = message
    .normalize('NFKC')
    .trim()
    .replace(/[.!?]+$/g, '')
    .replace(/\s+/g, ' ')
    .toUpperCase()
  return SMS_OPTOUT_KEYWORDS.has(normalized)
}
