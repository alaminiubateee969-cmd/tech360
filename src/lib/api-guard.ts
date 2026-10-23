import { cookies } from 'next/headers'
import { SESSION_COOKIE, CSRF_COOKIE } from '@/lib/constants'
import { getSession, assertCsrf, type SessionWithUser } from '@/lib/auth'
import { hasCapability, hasRole, isReadOnlyRole, type Capability } from '@/lib/access-policy'
import { rateLimit, clientIp, apiError, json } from '@/lib/security'

export type GuardedContext = {
  user: SessionWithUser['user']
  session: SessionWithUser
  ip: string
}

export type GuardResult = GuardedContext

export type GuardOptions = {
  minRole?: string // default ADMIN (unless capabilityOnly is true)
  capability?: Capability
  capabilityOnly?: boolean
  csrf?: boolean // default true for mutations
  skipCsrf?: boolean
  limit?: { max: number; windowMs: number }
  rateLimitPerMin?: number
}

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS'])

/**
 * Guard for admin API routes: session auth + RBAC + capability + AUDITOR read-only + CSRF + rate limit.
 * Returns either a GuardedContext or a Response to return immediately.
 */
export async function guard(req: Request, opts: GuardOptions = {}): Promise<GuardedContext | Response> {
  const ip = clientIp(req)
  const pathname = new URL(req.url).pathname
  const limiter = opts.limit ?? { max: opts.rateLimitPerMin ?? 120, windowMs: 60_000 }
  const rl = rateLimit(`api:${ip}:${pathname}`, limiter.max, limiter.windowMs)
  if (!rl.ok) return apiError('Too many requests', 429, 'RATE_LIMITED')

  const store = await cookies()
  const session = await getSession(store.get(SESSION_COOKIE)?.value)
  if (!session) return apiError('Authentication required', 401, 'UNAUTHENTICATED')

  if (session.user.mustChangePassword && !pathname.startsWith('/api/auth/')) {
    return apiError('Password change required before performing actions', 403, 'PASSWORD_CHANGE_REQUIRED')
  }

  const method = req.method.toUpperCase()
  const mutating = !SAFE_METHODS.has(method)

  if (mutating && isReadOnlyRole(session.user)) {
    return apiError('Forbidden (Auditor role is strictly read-only)', 403, 'AUDITOR_READ_ONLY')
  }

  if (opts.capability && !hasCapability(session.user, opts.capability)) {
    return apiError(`Forbidden (requires capability ${opts.capability})`, 403, 'FORBIDDEN')
  }

  if (!opts.capabilityOnly) {
    const minRole = opts.minRole ?? 'ADMIN'
    if (!hasRole(session.user, minRole)) {
      return apiError('Insufficient permissions', 403, 'FORBIDDEN')
    }
  }

  const requireCsrf = opts.skipCsrf ? false : (opts.csrf ?? true)
  if (mutating && requireCsrf) {
    const okCsrf = await assertCsrf(req)
    if (!okCsrf) {
      const headerToken = req.headers.get('x-csrf-token')
      const cookieToken = store.get(CSRF_COOKIE)?.value
      if (!headerToken || !cookieToken || headerToken !== cookieToken) {
        return apiError('CSRF validation failed', 403, 'CSRF')
      }
    }
  }

  return { user: session.user, session, ip }
}

export function isResponse(x: unknown): x is Response {
  return x instanceof Response
}

export function ok(data: unknown, status = 200) {
  return json(data, status)
}
