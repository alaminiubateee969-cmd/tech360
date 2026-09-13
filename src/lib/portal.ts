import { createHmac, timingSafeEqual } from 'crypto'

// ------------------------------------------------------------
// Client Portal sessions — stateless signed token in HttpOnly cookie
// Auth: Client ID + matching email or WhatsApp on file.
// ------------------------------------------------------------
export const PORTAL_COOKIE = 't360_portal'
export const PORTAL_TTL_HOURS = 24

function portalSecret(): string {
  return process.env.PORTAL_SECRET ?? process.env.OPS_SECRET ?? process.env.SESSION_SECRET ?? 'tech360-portal-dev-secret'
}

export function signPortalToken(clientId: string): string {
  const expiry = Date.now() + PORTAL_TTL_HOURS * 3600 * 1000
  const payload = `${clientId}.${expiry}`
  const sig = createHmac('sha256', portalSecret()).update(payload).digest('hex')
  return `${payload}.${sig}`
}

export function verifyPortalToken(token: string | undefined | null): string | null {
  if (!token) return null
  const parts = token.split('.')
  if (parts.length !== 3) return null
  const [clientId, expiry, sig] = parts
  const expected = createHmac('sha256', portalSecret()).update(`${clientId}.${expiry}`).digest('hex')
  try {
    const a = Buffer.from(sig)
    const b = Buffer.from(expected)
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null
  } catch {
    return null
  }
  if (Number(expiry) < Date.now()) return null
  return clientId
}

/** Normalize contact for matching (email lower / phone digits) */
export function normalizeContact(input: string): { email?: string; phone?: string } {
  const s = input.trim().toLowerCase()
  if (s.includes('@')) return { email: s }
  const digits = s.replace(/[^\d]/g, '')
  if (digits.length >= 8) return { phone: digits }
  return {}
}
