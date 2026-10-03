import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { guard, isResponse } from '@/lib/api-guard'
import { sanitizeText, audit } from '@/lib/security'
import { canTransitionCall, CALL_OUTCOMES, CALL_STATUSES, type CallStatus, type CallOutcome } from '@/lib/telephony'

export const dynamic = 'force-dynamic'

// PATCH /api/admin/telephony/calls/[id] — record what actually happened.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const g = await guard(req, { minRole: 'STAFF' })
  if (isResponse(g)) return g
  const { id } = await params

  const call = await db.callLog.findUnique({ where: { id: sanitizeText(id, 40) } })
  if (!call) return Response.json({ error: 'Call not found.' }, { status: 404 })

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>
  const statusRaw = sanitizeText(body.status ?? '', 24).toUpperCase()
  const outcomeRaw = sanitizeText(body.outcome ?? '', 24).toUpperCase()
  const notes = body.notes === undefined ? null : sanitizeText(body.notes, 2000)
  const durationRaw = Number(body.durationSec)

  const status = (CALL_STATUSES as readonly string[]).includes(statusRaw) ? (statusRaw as CallStatus) : null
  if (!status) return Response.json({ error: `A valid status is required (${CALL_STATUSES.join(', ')}).` }, { status: 400 })
  if (status !== call.status && !canTransitionCall(call.status as CallStatus, status)) {
    return Response.json({ error: `A call in state ${call.status} cannot move to ${status}.` }, { status: 409 })
  }
  const outcome = (CALL_OUTCOMES as readonly string[]).includes(outcomeRaw) ? (outcomeRaw as CallOutcome) : null
  if (outcomeRaw && !outcome) return Response.json({ error: `Unknown outcome. Use one of: ${CALL_OUTCOMES.join(', ')}.` }, { status: 400 })

  const terminal = ['COMPLETED', 'MISSED', 'FAILED'].includes(status)
  const updated = await db.callLog.update({
    where: { id: call.id },
    data: {
      status,
      ...(outcome ? { outcome } : {}),
      ...(notes !== null ? { notes } : {}),
      ...(Number.isFinite(durationRaw) && durationRaw >= 0 ? { durationSec: Math.min(24 * 3600, Math.round(durationRaw)) } : {}),
      ...(terminal && !call.endedAt ? { endedAt: new Date() } : {}),
    },
  })

  await audit({
    actor: g.user.email,
    action: 'CALL_UPDATED',
    userId: g.user.id,
    entityId: call.id,
    clientId: call.clientId ?? undefined,
    details: { from: call.status, to: status, outcome },
  })

  return Response.json({ call: updated })
}
