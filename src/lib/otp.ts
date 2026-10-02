import { createHmac, randomBytes, randomInt } from 'crypto'
import { constantTimeEquals } from '@/lib/constant-time'

// ============================================================
// Self-hosted one-time passcodes (no third-party API, no paid service).
//
// Stateless challenge/response, built on node:crypto only:
//   1. issueOtp()  -> { code, challenge }. The 6-digit code is sent to the
//      client's contact on file (email / WhatsApp / SMS); the signed
//      `challenge` goes back to the browser. The code is NOT in the challenge.
//   2. verifyOtp() -> recomputes the HMAC; constant-time compare.
//
// Properties: 10-minute expiry, bound to one Client ID + one channel,
// forged challenges rejected (HMAC), single-use + attempt-limited by the
// caller-supplied guards (see portal login route).
// ============================================================

export const OTP_TTL_MS = 10 * 60_000
export const OTP_MAX_ATTEMPTS = 5

export type OtpChannel = 'EMAIL' | 'WHATSAPP' | 'SMS'
export type OtpPayload = { sub: string; ch: OtpChannel; exp: number; n: string }

const b64 = (s: string) => Buffer.from(s, 'utf8').toString('base64url')
const unb64 = (s: string) => Buffer.from(s, 'base64url').toString('utf8')
const hmac = (secret: string, label: string, data: string) =>
  createHmac('sha256', secret).update(`${label}:${data}`).digest()

function deriveCode(secret: string, body: string): string {
  const n = hmac(secret, 'otp-code', body).readUInt32BE(0) % 1_000_000
  return String(n).padStart(6, '0')
}

export function issueOtp(secret: string, sub: string, ch: OtpChannel, now = Date.now()): { code: string; challenge: string } {
  if (!secret) throw new Error('OTP secret is required')
  const payload: OtpPayload = { sub, ch, exp: now + OTP_TTL_MS, n: randomBytes(9).toString('base64url') }
  const body = b64(JSON.stringify(payload))
  const sig = hmac(secret, 'otp-challenge', body).toString('base64url')
  return { code: deriveCode(secret, body), challenge: `${body}.${sig}` }
}

/** Returns the verified payload of a challenge, or null if forged/expired/malformed. */
export function readChallenge(secret: string, challenge: unknown, now = Date.now()): OtpPayload | null {
  if (!secret || typeof challenge !== 'string' || challenge.length > 600) return null
  const [body, sig, extra] = challenge.split('.')
  if (!body || !sig || extra !== undefined) return null
  const expected = hmac(secret, 'otp-challenge', body).toString('base64url')
  if (!constantTimeEquals(sig, expected)) return null
  try {
    const p = JSON.parse(unb64(body)) as OtpPayload
    if (typeof p.sub !== 'string' || typeof p.n !== 'string' || typeof p.exp !== 'number') return null
    if (!['EMAIL', 'WHATSAPP', 'SMS'].includes(p.ch)) return null
    if (p.exp < now) return null
    return p
  } catch {
    return null
  }
}

export function verifyOtp(secret: string, challenge: unknown, code: unknown, now = Date.now()): OtpPayload | null {
  const p = readChallenge(secret, challenge, now)
  if (!p || typeof code !== 'string' || !/^\d{6}$/.test(code.trim())) return null
  const body = (challenge as string).split('.')[0]
  return constantTimeEquals(code.trim(), deriveCode(secret, body)) ? p : null
}

/** a***@gmail.com / +88017****5678 — never echo the full contact back. */
export function maskContact(value: string): string {
  if (value.includes('@')) {
    const [u, d] = value.split('@')
    return `${u.slice(0, 1)}${'*'.repeat(Math.max(2, Math.min(u.length - 1, 6)))}@${d}`
  }
  const digits = value.replace(/[^\d]/g, '')
  return digits.length <= 6 ? '****' : `${digits.slice(0, 3)}${'*'.repeat(digits.length - 6)}${digits.slice(-3)}`
}

/** Random numeric code helper (unrelated to challenges) for other flows. */
export const randomCode = (len = 6) => Array.from({ length: len }, () => randomInt(0, 10)).join('')
