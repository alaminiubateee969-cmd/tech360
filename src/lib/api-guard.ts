import { cookies } from 'next/headers'
import { db } from '@/lib/db'
import { SESSION_COOKIE, CSRF_COOKIE } from '@/lib/constants'
import { getSession, hasRole, assertCsrf, type SessionWithUser } from '@/lib/auth'
import { rateLimit, clientIp, apiError, json } from '@/lib/security'

export type GuardedContext = {
  user: SessionWithUser['user']
  session: SessionWithUser
  ip: string
}

export type GuardOptions = {
  minRole?: string // default ADMIN
  csrf?: boolean // default true for mutations
  limit?: { max: number; windowMs: number }
}

/**
 * Guard for admin API routes: session auth + RBAC + CSRF + rate limit.
 * Returns either a context or a Response to return immediately.
 */
export async function guard(req: Request, opts: GuardOptions = {}): Promise<GuardedContext | Response> {
  const ip = clientIp(req)
  const limiter = opts.limit ?? { max: 120, windowMs: 60_000 }
  const rl = rateLimit(`api:${ip}:${new URL(req.url).pathname}`, limiter.max, limiter.windowMs)
  if (!rl.ok) return apiError('Too many requests', 429, 'RATE_LIMITED')

  const store = await cookies()
  const session = await getSession(store.get(SESSION_COOKIE)?.value)
  if (!session) return apiError('Authentication required', 401, 'UNAUTHENTICATED')
  if (!hasRole(session.user, opts.minRole ?? 'ADMIN')) {
    return apiError('Insufficient permissions', 403, 'FORBIDDEN')
  }
  const method = req.method.toUpperCase()
  const mutating = method !== 'GET' && method !== 'HEAD'
  if (mutating && (opts.csrf ?? true)) {
    const ok = await assertCsrf(req)
    if (!ok) {
      const headerToken = req.headers.get('x-csrf-token')
      const cookieToken = store.get(CSRF_COOKIE)?.value
      // double-submit: accept header matching cookie (also allow same value supplied only in header when cookie exists)
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
