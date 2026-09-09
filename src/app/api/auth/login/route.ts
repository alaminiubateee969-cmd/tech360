import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { verifyPassword, createSession, makeCsrfToken } from '@/lib/auth'
import { SESSION_COOKIE, CSRF_COOKIE, SESSION_TTL_HOURS } from '@/lib/constants'
import { rateLimit, clientIp, readJson, audit, logError, sanitizeText, sanitizeEmail } from '@/lib/security'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const ip = clientIp(req)
  const rl = rateLimit(`login:${ip}`, 10, 5 * 60_000)
  if (!rl.ok) {
    await logError({ source: 'AUTH', code: 'LOGIN_RATE_LIMIT', message: `Rate-limited login from ${ip}` })
    return Response.json({ error: 'Too many attempts. Try again in a few minutes.' }, { status: 429 })
  }

  const body = await readJson(req)
  const email = sanitizeEmail(body.email)
  const password = typeof body.password === 'string' ? body.password : ''
  if (!email || !password) return Response.json({ error: 'Email and password required' }, { status: 400 })

  const user = await db.user.findUnique({ where: { email } })
  if (!user) {
    await audit({ actor: email, action: 'LOGIN_FAILED', details: { reason: 'unknown email' }, ip })
    return Response.json({ error: 'Invalid email or password' }, { status: 401 })
  }
  if (user.lockedUntil && user.lockedUntil > new Date()) {
    return Response.json({ error: 'Account temporarily locked. Try again later.' }, { status: 423 })
  }
  if (!user.isActive) {
    return Response.json({ error: 'Account disabled' }, { status: 403 })
  }
  if (!verifyPassword(password, user.passwordHash)) {
    const failed = user.failedLogins + 1
    await db.user.update({
      where: { id: user.id },
      data: { failedLogins: failed, lockedUntil: failed >= 5 ? new Date(Date.now() + 15 * 60_000) : null },
    })
    await audit({ actor: email, action: 'LOGIN_FAILED', details: { attempt: failed }, ip })
    return Response.json({ error: 'Invalid email or password' }, { status: 401 })
  }

  const session = await createSession(user.id, ip, req.headers.get('user-agent') ?? undefined)
  await db.user.update({ where: { id: user.id }, data: { failedLogins: 0, lockedUntil: null, lastLoginAt: new Date() } })
  await audit({ actor: email, action: 'LOGIN_SUCCESS', userId: user.id, ip, userAgent: req.headers.get('user-agent') ?? undefined })

  const csrf = makeCsrfToken()
  const res = Response.json({
    ok: true,
    user: { email: user.email, name: user.name, role: user.role, mustChangePassword: user.mustChangePassword },
  })
  const secure = process.env.NODE_ENV === 'production'
  res.headers.append('Set-Cookie', `${SESSION_COOKIE}=${session.token}; Path=/; HttpOnly; SameSite=Lax${secure ? '; Secure' : ''}; Max-Age=${SESSION_TTL_HOURS * 3600}`)
  res.headers.append('Set-Cookie', `${CSRF_COOKIE}=${csrf}; Path=/; SameSite=Lax${secure ? '; Secure' : ''}; Max-Age=${SESSION_TTL_HOURS * 3600}`)
  return res
}
