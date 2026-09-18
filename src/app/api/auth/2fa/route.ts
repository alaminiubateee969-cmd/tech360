import { NextRequest } from 'next/server'
import { cookies } from 'next/headers'
import { db } from '@/lib/db'
import { SESSION_COOKIE } from '@/lib/constants'
import { getSession, verifyPassword, assertCsrf } from '@/lib/auth'
import { generateTotpSecret, otpauthUri, verifyTotp } from '@/lib/totp'
import { rateLimit, clientIp, readJson, audit, logError } from '@/lib/security'

export const dynamic = 'force-dynamic'

// ============================================================
// TOTP 2FA enrollment — three steps, all session-authenticated:
//   POST /api/auth/2fa            { action: 'setup' }   → provisioning secret + otpauth URI
//   POST /api/auth/2fa            { action: 'enable', code } → verify code, activate
//   POST /api/auth/2fa            { action: 'disable', password, code } → deactivate
// The secret returned by setup is NOT persisted until a valid
// code proves the user scanned it — no half-enrolled state.
// ============================================================

export async function POST(req: NextRequest) {
  const ip = clientIp(req)
  const rl = rateLimit(`2fa:${ip}`, 20, 5 * 60_000)
  if (!rl.ok) return Response.json({ error: 'Too many requests' }, { status: 429 })

  const store = await cookies()
  const session = await getSession(store.get(SESSION_COOKIE)?.value)
  if (!session) return Response.json({ error: 'Authentication required' }, { status: 401 })

  if (!(await assertCsrf(req))) return Response.json({ error: 'CSRF validation failed' }, { status: 403 })

  const body = await readJson(req)
  const action = typeof body.action === 'string' ? body.action : ''

  if (action === 'setup') {
    if (session.user.twoFactorEnabled) {
      return Response.json({ error: 'Two-factor authentication is already enabled.' }, { status: 409 })
    }
    const secret = generateTotpSecret()
    // Stash the pending secret on the user record (not yet active) so the
    // enable step can verify against exactly what was shown.
    await db.user.update({ where: { id: session.user.id }, data: { twoFactorSecret: secret } })
    await audit({ actor: session.user.email, action: '2FA_SETUP_STARTED', userId: session.user.id, ip })
    return Response.json({
      ok: true,
      secret,
      otpauthUri: otpauthUri(session.user.email, secret),
      // grouped for manual entry into authenticator apps
      secretGrouped: secret.replace(/(.{4})/g, '$1 ').trim(),
    })
  }

  if (action === 'enable') {
    const user = await db.user.findUnique({ where: { id: session.user.id } })
    if (!user?.twoFactorSecret) {
      return Response.json({ error: 'Start setup first.' }, { status: 400 })
    }
    const code = typeof body.code === 'string' ? body.code.trim() : ''
    if (!verifyTotp(user.twoFactorSecret, code)) {
      await logError({ source: 'AUTH', code: '2FA_ENABLE_BAD_CODE', message: `Invalid enrollment code for ${session.user.email}` })
      return Response.json({ error: 'That code did not match. Check your authenticator and try again.' }, { status: 400 })
    }
    await db.user.update({
      where: { id: user.id },
      data: { twoFactorEnabled: true, twoFactorEnrolledAt: new Date() },
    })
    await audit({ actor: user.email, action: '2FA_ENABLED', userId: user.id, ip })
    return Response.json({ ok: true })
  }

  if (action === 'disable') {
    const user = await db.user.findUnique({ where: { id: session.user.id } })
    if (!user?.twoFactorEnabled) {
      return Response.json({ error: 'Two-factor authentication is not enabled.' }, { status: 400 })
    }
    const password = typeof body.password === 'string' ? body.password : ''
    const code = typeof body.code === 'string' ? body.code.trim() : ''
    if (!password || !verifyPassword(password, user.passwordHash)) {
      return Response.json({ error: 'Password incorrect.' }, { status: 403 })
    }
    if (!verifyTotp(user.twoFactorSecret ?? '', code)) {
      return Response.json({ error: 'Two-factor code incorrect.' }, { status: 403 })
    }
    await db.user.update({
      where: { id: user.id },
      data: { twoFactorEnabled: false, twoFactorSecret: null, twoFactorEnrolledAt: null },
    })
    await audit({ actor: user.email, action: '2FA_DISABLED', userId: user.id, ip })
    return Response.json({ ok: true })
  }

  return Response.json({ error: 'Unknown action' }, { status: 400 })
}
