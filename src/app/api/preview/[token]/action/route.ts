import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { sanitizeText, readJson, rateLimit, clientIp, audit, logError } from '@/lib/security'

export const dynamic = 'force-dynamic'

// Public client decision on an HTML preview: approve or request revision
export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const rl = rateLimit(`preview-action:${clientIp(req)}`, 10, 60_000)
  if (!rl.ok) return Response.json({ error: 'Too many requests' }, { status: 429 })
  const clean = sanitizeText(token, 64).replace(/[^a-f0-9]/gi, '')
  const preview = await db.preview.findUnique({ where: { token: clean }, include: { client: true } })
  if (!preview || !preview.client) return Response.json({ error: 'Preview not found' }, { status: 404 })

  const raw = await readJson(req)
  const decision = sanitizeText(raw.decision, 40).toUpperCase()
  const notes = sanitizeText(raw.notes, 4000)
  if (decision !== 'APPROVED' && decision !== 'REVISION_REQUESTED') {
    return Response.json({ error: 'decision must be APPROVED or REVISION_REQUESTED' }, { status: 400 })
  }

  try {
    if (decision === 'APPROVED') {
      await db.preview.update({ where: { id: preview.id }, data: { status: 'APPROVED', approvedAt: new Date() } })
      await db.previewEvent.create({ data: { previewId: preview.id, type: 'APPROVED' } })
      // Record client approval communication
      await db.communication.create({
        data: { clientId: preview.clientId, channel: 'PORTAL', direction: 'IN', sender: preview.client.name, body: 'HTML preview APPROVED by client', status: 'RECEIVED' },
      })
      await db.client.update({ where: { id: preview.clientId }, data: { pipelineStage: 'CLIENT_APPROVAL' } })
      await db.trackingEvent.create({ data: { name: 'approval', clientId: preview.clientId, consent: true, meta: '{"what":"preview"}' } }).catch(() => null)
      await audit({ actor: `client:${preview.client.clientId}`, action: 'PREVIEW_APPROVED', clientId: preview.clientId, ip: clientIp(req) })
      return Response.json({ ok: true, message: 'Approval recorded. Team Tech360 will continue with payment instructions.' })
    } else {
      if (notes.length < 5) return Response.json({ error: 'Please describe your change requests' }, { status: 400 })
      await db.preview.update({ where: { id: preview.id }, data: { status: 'REVISION_REQUESTED', revisionNotes: notes } })
      await db.previewEvent.create({ data: { previewId: preview.id, type: 'REVISION_REQUESTED', meta: JSON.stringify({ notes: notes.slice(0, 500) }) } })
      await db.communication.create({
        data: { clientId: preview.clientId, channel: 'PORTAL', direction: 'IN', sender: preview.client.name, body: `Preview revision requested: ${notes}`, status: 'RECEIVED' },
      })
      await audit({ actor: `client:${preview.client.clientId}`, action: 'PREVIEW_REVISION_REQUESTED', clientId: preview.clientId, details: { notes: notes.slice(0, 300) }, ip: clientIp(req) })
      return Response.json({ ok: true, message: 'Change request recorded. Team Tech360 will review and update the preview.' })
    }
  } catch (e) {
    await logError({ source: 'API', code: 'PREVIEW_ACTION_FAILED', message: e instanceof Error ? e.message : 'unknown', clientId: preview.clientId })
    return Response.json({ error: 'Could not record your response. Please contact info@bdtech360.com.' }, { status: 500 })
  }
}
