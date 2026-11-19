import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { verifyPassword, createSession, makeCsrfToken } from '@/lib/auth'
import { verifyTotp } from '@/lib/totp'
import { SESSION_COOKIE, CSRF_COOKIE, SESSION_TTL_HOURS } from '@/lib/constants'
import { rateLimit, clientIp, readJson, audit, logError, sanitizeEmail } from '@/lib/security'
import { isDatabaseUnavailable } from '@/lib/database-errors'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    return await signIn(req)
  } catch (error) {
    const unavailable = isDatabaseUnavailable(error)
    const code = unavailable ? 'DATABASE_UNAVAILABLE' : 'LOGIN_FAILED'
    // Error messages can contain connection URLs or submitted credentials.
    // Log only a fixed diagnostic code, and do not call the DB-backed logger
    // while the dependency that stores its logs may itself be unavailable.
    console.error(`[auth/login] ${code}`)
    return Response.json({
      error: unavailable
        ? 'Sign-in is temporarily unavailable. Please try again shortly.'
        : 'Unable to sign in. Please try again later.',
      code,
    }, {
      status: unavailable ? 503 : 500,
      headers: { 'Cache-Control': 'no-store', ...(unavailable ? { 'Retry-After': '30' } : {}) },
    })
  }
}

async function signIn(req: NextRequest) {
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

  // ---- TOTP second factor (only when enrolled) ----
  if (user.twoFactorEnabled) {
    // A damaged/incomplete enrollment must not silently turn MFA into a
    // password-only login. An operator must repair the enrollment first.
    if (!user.twoFactorSecret) {
      console.error('[auth/login] TOTP_UNAVAILABLE')
      return Response.json({
        error: 'Two-factor verification is unavailable. Please contact support.',
        code: 'TOTP_UNAVAILABLE',
      }, { status: 503, headers: { 'Cache-Control': 'no-store' } })
    }
    const code = typeof body.totp === 'string' ? body.totp.trim() : ''
    if (!code) {
      // Password correct but second factor missing — ask for it WITHOUT creating a session.
      await audit({ actor: email, action: 'LOGIN_2FA_CHALLENGE', ip })
      return Response.json({ error: 'Two-factor code required', code: 'TOTP_REQUIRED' }, { status: 401 })
    }
    if (!verifyTotp(user.twoFactorSecret, code)) {
      const failed = user.failedLogins + 1
      await db.user.update({
        where: { id: user.id },
        data: { failedLogins: failed, lockedUntil: failed >= 5 ? new Date(Date.now() + 15 * 60_000) : null },
      })
      await audit({ actor: email, action: 'LOGIN_2FA_FAILED', details: { attempt: failed }, ip })
      return Response.json({ error: 'Invalid two-factor code', code: 'TOTP_INVALID' }, { status: 401 })
    }
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
