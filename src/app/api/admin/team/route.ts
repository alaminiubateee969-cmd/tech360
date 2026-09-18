import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { hashPassword } from '@/lib/auth'
import { guard, isResponse } from '@/lib/api-guard'
import { readJson, audit, logError, sanitizeText } from '@/lib/security'
import { randomBytes } from 'crypto'

export const dynamic = 'force-dynamic'

// ============================================================
// TEAM MANAGEMENT — SUPER_ADMIN only.
//   GET  /api/admin/team        → list console users
//   POST /api/admin/team        → create user (must set password on first login)
// The list never exposes hashes or 2FA secrets — only safe fields.
// ============================================================

const VALID_ROLES = new Set(['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'STAFF'])

export async function GET(req: NextRequest) {
  const g = await guard(req, { minRole: 'ADMIN' })
  if (isResponse(g)) return g
  const users = await db.user.findMany({
    orderBy: [{ isActive: 'desc' }, { createdAt: 'asc' }],
    select: {
      id: true, email: true, name: true, role: true, title: true,
      isActive: true, mustChangePassword: true, twoFactorEnabled: true,
      lastLoginAt: true, failedLogins: true, lockedUntil: true, createdAt: true,
    },
  })
  return Response.json({ users })
}

function generatePassword(): string {
  // 16 chars, mixed classes, no ambiguous look-alikes
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ'
  const lower = 'abcdefghijkmnopqrstuvwxyz'
  const digits = '23456789'
  const symbols = '!@#$%^&*'
  const all = upper + lower + digits + symbols
  const pick = (set: string) => set[randomBytes(1)[0] % set.length]
  const chars = [pick(upper), pick(lower), pick(digits), pick(symbols)]
  while (chars.length < 16) chars.push(pick(all))
  // Fisher-Yates shuffle with crypto randomness
  for (let i = chars.length - 1; i > 0; i--) {
    const j = randomBytes(1)[0] % (i + 1)
    ;[chars[i], chars[j]] = [chars[j], chars[i]]
  }
  return chars.join('')
}

export async function POST(req: NextRequest) {
  const g = await guard(req, { minRole: 'SUPER_ADMIN' })
  if (isResponse(g)) return g

  const body = await readJson(req)
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
  const name = sanitizeText(typeof body.name === 'string' ? body.name : '', 80)
  const role = typeof body.role === 'string' ? body.role : ''
  const title = sanitizeText(typeof body.title === 'string' ? body.title : '', 80)

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return Response.json({ error: 'A valid email is required.' }, { status: 400 })
  }
  if (!VALID_ROLES.has(role)) {
    return Response.json({ error: 'Role must be SUPER_ADMIN, ADMIN, MANAGER or STAFF.' }, { status: 400 })
  }

  const existing = await db.user.findUnique({ where: { email } })
  if (existing) return Response.json({ error: 'A user with that email already exists.' }, { status: 409 })

  const tempPassword = generatePassword()
  const user = await db.user.create({
    data: {
      email,
      name: name || null,
      role,
      title: title || null,
      passwordHash: hashPassword(tempPassword),
      mustChangePassword: true, // forced rotation on first login
    },
    select: { id: true, email: true, role: true },
  })

  await audit({
    userId: g.user.id,
    actor: g.user.email,
    action: 'TEAM_USER_CREATED',
    entityType: 'User',
    entityId: user.id,
    details: { email, role, mustChangePassword: true },
    ip: g.ip,
  })

  return Response.json({
    ok: true,
    user,
    // one-time temp password — shown once in the UI, never stored in plaintext
    tempPassword,
  })
}
