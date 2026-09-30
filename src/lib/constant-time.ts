import { timingSafeEqual } from 'crypto'

/**
 * Constant-time comparison for shared secrets and webhook signatures.
 *
 * `a === b` on a secret leaks its length and matching prefix through response
 * timing. auth.ts, portal.ts and newsletter.ts already compare this way; this
 * is the shared helper so every call site can.
 *
 * Deliberately dependency-free (no database import) so security-critical code
 * and its tests never pull the Prisma client in.
 *
 * Returns false for any missing value — callers must FAIL CLOSED.
 */
export function constantTimeEquals(
  a: string | null | undefined,
  b: string | null | undefined,
): boolean {
  if (!a || !b) return false
  const bufA = Buffer.from(a)
  const bufB = Buffer.from(b)
  if (bufA.length !== bufB.length) return false
  return timingSafeEqual(bufA, bufB)
}
