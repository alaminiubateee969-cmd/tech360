import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { verifyPassword, hashPassword } from '@/lib/auth'
import { guard, isResponse } from '@/lib/api-guard'
import { readJson, audit, rateLimit } from '@/lib/security'
import { cookies } from 'next/headers'
import { SESSION_COOKIE } from '@/lib/constants'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const rl = rateLimit(`chpwd:${req.headers.get('x-real-ip') ?? 'unknown'}`, 10, 60_000)
  if (!rl.ok) return Response.json({ error: 'Too many requests' }, { status: 429 })
  const store = await cookies()
  const g = await guard(req, { csrf: true, minRole: 'STAFF' })
  if (isResponse(g)) return g

  const body = await readJson(req)
  const currentPassword = String(body.currentPassword ?? '')
  const newPassword = String(body.newPassword ?? '')
  if (newPassword.length < 10) return Response.json({ error: 'New password must be at least 10 characters' }, { status: 400 })
  if (!/[A-Z]/.test(newPassword) || !/[a-z]/.test(newPassword) || !/\d/.test(newPassword)) {
    return Response.json({ error: 'Password needs uppercase, lowercase and a digit' }, { status: 400 })
  }
  const user = await db.user.findUnique({ where: { id: g.user.id } })
  if (!user || !verifyPassword(currentPassword, user.passwordHash)) {
    return Response.json({ error: 'Current password is incorrect' }, { status: 401 })
  }
  await db.user.update({ where: { id: user.id }, data: { passwordHash: hashPassword(newPassword), mustChangePassword: false } })
  await audit({ actor: user.email, action: 'PASSWORD_CHANGED', userId: user.id })
  return Response.json({ ok: true })
}
