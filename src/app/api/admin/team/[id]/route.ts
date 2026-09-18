import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { hashPassword } from '@/lib/auth'
import { guard, isResponse } from '@/lib/api-guard'
import { readJson, audit } from '@/lib/security'
import { randomBytes } from 'crypto'

export const dynamic = 'force-dynamic'

// ============================================================
// TEAM MEMBER ACTIONS — SUPER_ADMIN only. Safety rails:
//   PATCH { role }               → change role (cannot demote the last SUPER_ADMIN)
//   PATCH { title }              → update job title
//   PATCH { isActive }           → enable/disable (cannot disable yourself)
//   PATCH { action: 'reset_password' } → new one-time password + forced change
// Secrets (hashes, TOTP seeds) are never returned.
// ============================================================

const VALID_ROLES = new Set(['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'STAFF'])

function generatePassword(): string {
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ'
  const lower = 'abcdefghijkmnopqrstuvwxyz'
  const digits = '23456789'
  const symbols = '!@#$%^&*'
  const all = upper + lower + digits + symbols
  const pick = (set: string) => set[randomBytes(1)[0] % set.length]
  const chars = [pick(upper), pick(lower), pick(digits), pick(symbols)]
  while (chars.length < 16) chars.push(pick(all))
  for (let i = chars.length - 1; i > 0; i--) {
    const j = randomBytes(1)[0] % (i + 1)
    ;[chars[i], chars[j]] = [chars[j], chars[i]]
  }
  return chars.join('')
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const g = await guard(req, { minRole: 'SUPER_ADMIN' })
  if (isResponse(g)) return g
  const { id } = await params
  const body = await readJson(req)

  const target = await db.user.findUnique({ where: { id } })
  if (!target) return Response.json({ error: 'User not found.' }, { status: 404 })

  // ---- role change ----
  if (typeof body.role === 'string') {
    if (!VALID_ROLES.has(body.role)) {
      return Response.json({ error: 'Role must be SUPER_ADMIN, ADMIN, MANAGER or STAFF.' }, { status: 400 })
    }
    if (target.role === 'SUPER_ADMIN' && body.role !== 'SUPER_ADMIN') {
      const superCount = await db.user.count({ where: { role: 'SUPER_ADMIN', isActive: true } })
      if (superCount <= 1) {
        return Response.json({ error: 'Cannot demote the last active SUPER_ADMIN.' }, { status: 409 })
      }
    }
    if (target.id === g.user.id && body.role !== 'SUPER_ADMIN') {
      return Response.json({ error: 'You cannot demote your own account.' }, { status: 409 })
    }
    await db.user.update({ where: { id }, data: { role: body.role } })
    await audit({
      userId: g.user.id, actor: g.user.email, action: 'TEAM_ROLE_CHANGED',
      entityType: 'User', entityId: id,
      details: { email: target.email, from: target.role, to: body.role }, ip: g.ip,
    })
    return Response.json({ ok: true })
  }

  // ---- title change ----
  if (typeof body.title === 'string') {
    const title = body.title.trim().slice(0, 80)
    await db.user.update({ where: { id }, data: { title: title || null } })
    await audit({
      userId: g.user.id, actor: g.user.email, action: 'TEAM_TITLE_CHANGED',
      entityType: 'User', entityId: id, details: { email: target.email, title }, ip: g.ip,
    })
    return Response.json({ ok: true })
  }

  // ---- enable / disable ----
  if (typeof body.isActive === 'boolean') {
    if (target.id === g.user.id && body.isActive === false) {
      return Response.json({ error: 'You cannot disable your own account.' }, { status: 409 })
    }
    if (target.role === 'SUPER_ADMIN' && body.isActive === false) {
      const superCount = await db.user.count({ where: { role: 'SUPER_ADMIN', isActive: true } })
      if (superCount <= 1) {
        return Response.json({ error: 'Cannot disable the last active SUPER_ADMIN.' }, { status: 409 })
      }
    }
    if (body.isActive === true) {
      await db.user.update({ where: { id }, data: { isActive: true, failedLogins: 0, lockedUntil: null } })
    } else {
      // disabling also revokes all active sessions
      await db.session.deleteMany({ where: { userId: id } })
      await db.user.update({ where: { id }, data: { isActive: false } })
    }
    await audit({
      userId: g.user.id, actor: g.user.email, action: body.isActive ? 'TEAM_USER_ENABLED' : 'TEAM_USER_DISABLED',
      entityType: 'User', entityId: id, details: { email: target.email }, ip: g.ip,
    })
    return Response.json({ ok: true })
  }

  // ---- admin-initiated password reset ----
  if (body.action === 'reset_password') {
    const tempPassword = generatePassword()
    await db.session.deleteMany({ where: { userId: id } }) // revoke sessions — forces re-login
    await db.user.update({
      where: { id },
      data: { passwordHash: hashPassword(tempPassword), mustChangePassword: true, failedLogins: 0, lockedUntil: null },
    })
    await audit({
      userId: g.user.id, actor: g.user.email, action: 'TEAM_PASSWORD_RESET',
      entityType: 'User', entityId: id, details: { email: target.email, mustChangePassword: true }, ip: g.ip,
    })
    return Response.json({ ok: true, tempPassword })
  }

  return Response.json({ error: 'No recognized action in request.' }, { status: 400 })
}
