import { randomBytes, scryptSync, timingSafeEqual, createHash } from 'crypto'
import { db } from '@/lib/db'
import { Session } from '@prisma/client'
import { cookies } from 'next/headers'
import { SESSION_COOKIE, SESSION_TTL_HOURS, CSRF_COOKIE, ROLE_RANK } from '@/lib/constants'

// ------------------------------------------------------------
// Password hashing — scrypt (no plaintext, constant-time compare)
// ------------------------------------------------------------
export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex')
  const hash = scryptSync(password, salt, 64).toString('hex')
  return `scrypt:${salt}:${hash}`
}

export function verifyPassword(password: string, stored: string): boolean {
  try {
    const [scheme, salt, hash] = stored.split(':')
    if (scheme !== 'scrypt' || !salt || !hash) return false
    const candidate = scryptSync(password, salt, 64)
    const expected = Buffer.from(hash, 'hex')
    return candidate.length === expected.length && timingSafeEqual(candidate, expected)
  } catch {
    return false
  }
}

export function sha256(input: string): string {
  return createHash('sha256').update(input).digest('hex')
}

// ------------------------------------------------------------
// Sessions — DB-backed, HttpOnly cookie, expiry, lockout
// ------------------------------------------------------------
export async function createSession(userId: string, ip?: string, userAgent?: string): Promise<Session> {
  const token = randomBytes(32).toString('hex')
  const expiresAt = new Date(Date.now() + SESSION_TTL_HOURS * 3600 * 1000)
  return db.session.create({
    data: { token, userId, expiresAt, ip: ip ?? null, userAgent: userAgent ?? null },
  })
}

export type SessionWithUser = Session & { user: { id: string; email: string; name: string | null; role: string; title: string | null; isActive: boolean; mustChangePassword: boolean; twoFactorEnabled: boolean } }

export async function getSession(token: string | undefined | null): Promise<SessionWithUser | null> {
  if (!token) return null
  const session = await db.session.findUnique({ where: { token }, include: { user: true } })
  if (!session) return null
  if (session.expiresAt < new Date()) {
    await db.session.delete({ where: { id: session.id } }).catch(() => null)
    return null
  }
  if (!session.user.isActive) return null
  return session
}

export async function destroySession(token: string | undefined | null): Promise<void> {
  if (!token) return
  await db.session.deleteMany({ where: { token } }).catch(() => null)
}

export async function currentUser(): Promise<SessionWithUser['user'] | null> {
  const store = await cookies()
  const session = await getSession(store.get(SESSION_COOKIE)?.value)
  return session?.user ?? null
}

export function sessionTokenFromCookieStore(store: { get: (n: string) => { value: string } | undefined }) {
  return store.get(SESSION_COOKIE)?.value
}

// ------------------------------------------------------------
// RBAC — ROLE_RANK lives in constants.ts (shared with the client nav)
// ------------------------------------------------------------

export function hasRole(user: { role: string } | null, minRole: string): boolean {
  if (!user) return false
  return (ROLE_RANK[user.role] ?? 0) >= (ROLE_RANK[minRole] ?? 0)
}

export function isSuperAdmin(user: { role: string } | null): boolean {
  return user?.role === 'SUPER_ADMIN'
}

// ------------------------------------------------------------
// CSRF — double-submit token validation for mutating requests
// ------------------------------------------------------------
export function makeCsrfToken(): string {
  return randomBytes(24).toString('hex')
}

export async function assertCsrf(req: Request): Promise<boolean> {
  const store = await cookies()
  const cookieToken = store.get(CSRF_COOKIE)?.value
  const headerToken = req.headers.get('x-csrf-token')
  if (!cookieToken || !headerToken) return false
  const a = Buffer.from(cookieToken)
  const b = Buffer.from(headerToken)
  return a.length === b.length && timingSafeEqual(a, b)
}
