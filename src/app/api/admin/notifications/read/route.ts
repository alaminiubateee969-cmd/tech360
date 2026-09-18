import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { guard, isResponse } from '@/lib/api-guard'
import { readJson, sanitizeText, audit } from '@/lib/security'

export const dynamic = 'force-dynamic'

// Mark notifications read: POST /api/admin/notifications/read
// body { id?: string } marks one · { all: true } marks every unread row.
// Both paths are audited — clearing the feed is an operator action.
export async function POST(req: NextRequest) {
  const g = await guard(req, { minRole: 'STAFF' })
  if (isResponse(g)) return g
  const raw = await readJson(req)
  const id = sanitizeText(raw.id, 40)
  const all = raw.all === true

  if (!id && !all) {
    return Response.json({ error: 'id or all:true required' }, { status: 400 })
  }

  if (all) {
    const res = await db.notification.updateMany({ where: { read: false }, data: { read: true } })
    await audit({ actor: `user:${g.user.email}`, action: 'NOTIFICATIONS_READ_ALL', details: { count: res.count } })
    return Response.json({ ok: true, updated: res.count })
  }

  const notification = await db.notification.findUnique({ where: { id } })
  if (!notification) return Response.json({ error: 'Notification not found' }, { status: 404 })
  await db.notification.update({ where: { id }, data: { read: true } })
  await audit({ actor: `user:${g.user.email}`, action: 'NOTIFICATION_READ', details: { id, title: notification.title.slice(0, 100) } })
  return Response.json({ ok: true, updated: 1 })
}
