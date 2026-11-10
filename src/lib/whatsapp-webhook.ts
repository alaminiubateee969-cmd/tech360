import { constantTimeEquals } from '@/lib/constant-time'

/**
 * WhatsApp Cloud API webhook subscription handshake (GET).
 *
 * Meta calls this once when the webhook URL is saved in the app dashboard
 * and re-checks it whenever the callback URL or verify token changes:
 *
 *   GET /api/webhooks/whatsapp
 *     ?hub.mode=subscribe
 *     &hub.verify_token=<the value configured in Meta>
 *     &hub.challenge=<opaque nonce Meta expects echoed back>
 *
 * The verify token is a shared secret: anyone who can guess it can complete
 * this handshake. Comparing it with `===` leaks its length and matching
 * prefix through response timing, so this module uses the repository's
 * shared constant-time comparison. That helper lives in `@/lib/constant-time`
 * precisely so security code and its tests never pull in the Prisma client.
 *
 * Deliberately dependency-free and pure so it can be unit tested without a
 * database, network or the generated Prisma client.
 *
 * FAIL CLOSED: an unset/empty expected token, a wrong mode, or a missing
 * challenge all deny the handshake.
 */
export type WhatsAppHandshakeInput = {
  mode: string | null | undefined
  token: string | null | undefined
  challenge: string | null | undefined
  expected: string | null | undefined
}

export type WhatsAppHandshakeResult =
  | { ok: true; challenge: string }
  | { ok: false; reason: 'NOT_CONFIGURED' | 'WRONG_MODE' | 'MISSING_CHALLENGE' | 'INVALID_TOKEN' }

export function verifyWhatsAppHandshake(input: WhatsAppHandshakeInput): WhatsAppHandshakeResult {
  // An unset verify token must never authorize a handshake: `constantTimeEquals`
  // returns false for empty values, but the distinct reason makes the
  // misconfiguration visible in logs instead of looking like a wrong guess.
  if (!input.expected) return { ok: false, reason: 'NOT_CONFIGURED' }
  if (input.mode !== 'subscribe') return { ok: false, reason: 'WRONG_MODE' }
  if (!constantTimeEquals(input.token, input.expected)) return { ok: false, reason: 'INVALID_TOKEN' }
  if (!input.challenge) return { ok: false, reason: 'MISSING_CHALLENGE' }
  return { ok: true, challenge: input.challenge }
}
