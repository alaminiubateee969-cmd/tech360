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
  if (handover.status !== 'RELEASED' && handover.status !== 'DOWNLOADED') {
    return Response.json({ error: 'This package has not been released yet.' }, { status: 403 })
  }

  const raw = await readJson(req)
  const passwordsChanged = raw.passwordsChanged === true
  const received = raw.received !== false
  const working = raw.working !== false
  const notes = sanitizeText(raw.notes, 2000)

  const result = await confirmDelivery(handover.project.clientId, { received, working, passwordsChanged, satisfied: undefined })
  await audit({ actor: `client:${handover.project.clientId}`, action: 'DELIVERY_CONFIRMED', clientId: handover.project.clientId, projectId: handover.projectId, details: { passwordsChanged, received, working, notes: notes.slice(0, 300) }, ip: clientIp(req) })
  return Response.json({ ok: true, delivery: { status: result.delivery.status }, message: passwordsChanged ? 'Thank you! Delivery confirmed and password change recorded. Your project is complete.' : 'Delivery recorded. Please remember to change your temporary passwords and confirm.' })
}
