import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { sanitizeText, clientIp, audit } from '@/lib/security'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const clean = sanitizeText(token, 64).replace(/[^a-f0-9]/gi, '')
  const preview = await db.preview.findUnique({ where: { token: clean } })
  if (!preview) return Response.json({ ok: false }, { status: 404 })
  // expiry guard: expired previews no longer track views (terminal states keep their record)
  const terminal = preview.status === 'APPROVED' || preview.status === 'REVISION_REQUESTED' || preview.status === 'EXPIRED'
  if (!terminal && preview.expiresAt && preview.expiresAt.getTime() < Date.now()) {
    await db.preview.update({ where: { id: preview.id }, data: { status: 'EXPIRED' } })
    await db.previewEvent.create({ data: { previewId: preview.id, type: 'EXPIRED' } })
    return Response.json({ ok: false, expired: true }, { status: 410 })
  }
  await db.preview.update({
    where: { id: preview.id },
    data: { status: preview.status === 'APPROVED' ? 'APPROVED' : 'VIEWED', viewedAt: new Date(), viewCount: { increment: 1 }, lastIp: clientIp(req) },
  })
  await db.previewEvent.create({ data: { previewId: preview.id, type: 'VIEWED', meta: JSON.stringify({ ip: clientIp(req) }) } })
  await db.trackingEvent.create({ data: { name: 'preview_view', clientId: preview.clientId, consent: true, meta: JSON.stringify({ token: clean.slice(0, 8) }) } }).catch(() => null)
  return Response.json({ ok: true })
}
