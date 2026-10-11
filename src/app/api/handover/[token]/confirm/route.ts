import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { sanitizeText, readJson, rateLimit, clientIp, audit } from '@/lib/security'
import { confirmDelivery } from '@/lib/journey'

export const dynamic = 'force-dynamic'

// Client confirms delivery + password change after handover
export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const rl = rateLimit(`handover-confirm:${clientIp(req)}`, 10, 60_000)
  if (!rl.ok) return Response.json({ error: 'Too many requests' }, { status: 429 })
  const clean = sanitizeText(token, 64).replace(/[^a-f0-9]/gi, '')
  const handover = await db.handoverRecord.findUnique({ where: { packageToken: clean }, include: { project: true } })
  if (!handover) return Response.json({ error: 'Package not found' }, { status: 404 })
  if (handover.expiryAt && handover.expiryAt < new Date()) {
    return Response.json({ error: 'This handover link has expired. Contact TECH360 support.' }, { status: 410 })
  }
  if (handover.status === 'CONFIRMED') {
    return Response.json({ ok: true, accepted: true, idempotent: true, message: 'Your delivery acceptance and password-change response are already recorded.' })
  }
  if (handover.status !== 'DOWNLOADED') {
    return Response.json({ error: 'Download the approved project package before confirming receipt or function.' }, { status: 403 })
  }

  const raw = await readJson(req)
  if (typeof raw.received !== 'boolean' || typeof raw.working !== 'boolean' || typeof raw.passwordsChanged !== 'boolean') {
    return Response.json({ error: 'Explicit receipt, working-condition, and password-change answers are required.' }, { status: 400 })
  }
  const passwordsChanged = raw.passwordsChanged
  const received = raw.received
  const working = raw.working
  const notes = sanitizeText(raw.notes, 2000)

  const result = await confirmDelivery(handover.project.clientId, { received, working, passwordsChanged, notes }, handover.projectId)
  await audit({
    actor: `client:${handover.project.clientId}`,
    action: result.accepted ? 'DELIVERY_ACCEPTED' : 'DELIVERY_ISSUE_REPORTED',
    clientId: handover.project.clientId,
    projectId: handover.projectId,
    details: { passwordsChanged, received, working, code: result.code, notes: notes.slice(0, 300) },
    ip: clientIp(req),
  })
  return Response.json({
    ok: true,
    accepted: result.accepted,
    delivery: { status: result.delivery.status },
    message: result.accepted
      ? passwordsChanged
        ? 'Delivery acceptance recorded and password change confirmed. Support will separately verify the source package before closure.'
        : 'Delivery acceptance recorded. Please change temporary passwords; project closure remains pending.'
      : 'Delivery issue recorded. A support follow-up has been created, and the project remains open.',
  })
}
