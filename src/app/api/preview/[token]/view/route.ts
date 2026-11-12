import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { sanitizeText, clientIp } from '@/lib/security'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const clean = sanitizeText(token, 64).replace(/[^a-f0-9]/gi, '')
  const preview = await db.preview.findUnique({ where: { token: clean } })
  if (!preview) return Response.json({ ok: false }, { status: 404 })
  const now = new Date()
  const terminal = preview.status === 'APPROVED' || preview.status === 'REVISION_REQUESTED'
  if (preview.status === 'EXPIRED' || (!terminal && preview.expiresAt && preview.expiresAt <= now)) {
    return Response.json({ ok: false, expired: true }, { status: 410 })
  }
  // A concurrent decision must never be overwritten by a view. In particular,
  // terminal revision and expired states are not reopened as VIEWED.
  const active = await db.preview.updateMany({
    where: { id: preview.id, status: { in: ['GENERATED', 'SENT', 'VIEWED'] }, OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] },
    data: { status: 'VIEWED', viewedAt: now, viewCount: { increment: 1 }, lastIp: clientIp(req) },
  })
  if (active.count === 0) {
    const terminalUpdate = await db.preview.updateMany({
      where: { id: preview.id, status: { in: ['APPROVED', 'REVISION_REQUESTED'] } },
      data: { viewedAt: now, viewCount: { increment: 1 }, lastIp: clientIp(req) },
    })
    if (terminalUpdate.count === 0) return Response.json({ ok: false, expired: true }, { status: 410 })
  }
  await db.previewEvent.create({ data: { previewId: preview.id, type: 'VIEWED', meta: JSON.stringify({ ip: clientIp(req) }) } })
  await db.trackingEvent.create({ data: { name: 'preview_view', clientId: preview.clientId, consent: true, meta: JSON.stringify({ token: clean.slice(0, 8) }) } }).catch(() => null)
  return Response.json({ ok: true })
}
