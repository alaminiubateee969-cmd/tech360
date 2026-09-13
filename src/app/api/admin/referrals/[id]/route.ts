import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { guard, isResponse } from '@/lib/api-guard'
import { readJson, sanitizeText, audit } from '@/lib/security'

export const dynamic = 'force-dynamic'

const STATUSES = ['REQUESTED', 'RECEIVED', 'CONVERTED', 'CLOSED']

// POST /api/admin/referrals/[id] — body { status, notes? }
// Tracks the real referral lifecycle: requested → received → converted/closed.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const g = await guard(req, { minRole: 'ADMIN' })
  if (isResponse(g)) return g
  const { id } = await params
  const raw = await readJson(req)
  const status = sanitizeText(raw.status, 20).toUpperCase()
  const notes = sanitizeText(raw.notes, 1000)

  if (!STATUSES.includes(status)) return Response.json({ error: `status must be one of ${STATUSES.join(', ')}` }, { status: 400 })

  const referral = await db.referral.findUnique({ where: { id: sanitizeText(id, 40) }, include: { client: { select: { clientId: true } } } })
  if (!referral) return Response.json({ error: 'Referral not found' }, { status: 404 })

  const updated = await db.referral.update({
    where: { id: referral.id },
    data: { status, ...(notes ? { notes: `CONVERTED: ${notes}` } : {}) },
  })

  await audit({
    actor: g.user.email, action: 'REFERRAL_STATUS_CHANGED', userId: g.user.id,
    clientId: referral.client.clientId,
    details: { referralId: referral.id, from: referral.status, to: status, referred: referral.name },
  })
  return Response.json({ ok: true, referral: updated })
}
