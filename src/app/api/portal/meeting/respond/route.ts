import { NextRequest } from 'next/server'
import { cookies } from 'next/headers'
import { db } from '@/lib/db'
import { verifyPortalToken, PORTAL_COOKIE, portalGate } from "@/lib/portal"
import { sanitizeText, audit, rateLimit, clientIp } from '@/lib/security'
import { createNotification } from '@/lib/notify'

export const dynamic = 'force-dynamic'

// POST /api/portal/meeting/respond — the client answers a meeting invitation
// from their portal: confirm, decline, or request a new time. Every response
// updates the REAL meeting record, creates an inbound communication (visible
// in admin Communications), notifies the team, and is audited.
export async function POST(req: NextRequest) {
  const portalDisabled = await portalGate()
  if (portalDisabled) return portalDisabled
  const ip = clientIp(req)
  const rl = rateLimit(`portal-meeting:${ip}`, 20, 10 * 60_000)
  if (!rl.ok) return Response.json({ error: 'Too many responses in a short time. Please slow down.' }, { status: 429 })

  const store = await cookies()
  const clientId = verifyPortalToken(store.get(PORTAL_COOKIE)?.value)
  if (!clientId) return Response.json({ error: 'Session expired. Please sign in again.' }, { status: 401 })

  const body = await req.json().catch(() => ({} as Record<string, unknown>))
  const meetingId = typeof body.meetingId === 'string' ? body.meetingId : ''
  const action = typeof body.action === 'string' ? body.action.toUpperCase() : ''
  const message = sanitizeText(typeof body.message === 'string' ? body.message : '', 300).trim()

  if (!meetingId) return Response.json({ error: 'Missing meeting.' }, { status: 400 })
  if (!['CONFIRM', 'DECLINE', 'RESCHEDULE'].includes(action)) return Response.json({ error: 'Unknown response.' }, { status: 400 })

  const client = await db.client.findFirst({ where: { clientId, deletedAt: null } })
  if (!client) return Response.json({ error: 'Client not found.' }, { status: 404 })

  // Ownership enforced — the meeting must belong to this client.
  const meeting = await db.meeting.findFirst({ where: { id: meetingId, clientId: client.id } })
  if (!meeting) return Response.json({ error: 'Meeting not found.' }, { status: 404 })
  if (!['REQUESTED', 'SCHEDULED'].includes(meeting.status)) {
    return Response.json({ error: 'This meeting is no longer active (it was completed or cancelled).' }, { status: 409 })
  }

  const now = new Date()
  const update: { clientResponse: string; clientRespondedAt: Date; status?: string } = {
    clientResponse: action === 'CONFIRM' ? 'CONFIRMED' : action === 'DECLINE' ? 'DECLINED' : 'RESCHEDULE_REQUESTED',
    clientRespondedAt: now,
  }
  // CONFIRM promotes a REQUESTED meeting to SCHEDULED (the client agreed to the slot).
  // DECLINE moves the meeting to DECLINED. RESCHEDULE keeps it open for the team to re-propose.
  if (action === 'CONFIRM' && meeting.status === 'REQUESTED') update.status = 'SCHEDULED'
  if (action === 'DECLINE') update.status = 'DECLINED'

  await db.meeting.update({ where: { id: meeting.id }, data: update })

  const when = meeting.scheduledAt ? new Date(meeting.scheduledAt).toISOString().replace('T', ' ').slice(0, 16) + ' UTC' : 'a time to be confirmed'
  const actionLabel = action === 'CONFIRM' ? 'confirmed' : action === 'DECLINE' ? 'declined' : 'requested to reschedule'

  // Inbound communication — the team sees the response in the comms timeline.
  await db.communication
    .create({
      data: {
        clientId: client.id,
        channel: 'PORTAL',
        direction: 'IN',
        subject: `Meeting ${actionLabel} — ${meeting.reason ?? 'consultation'}`,
        body: `Client ${client.clientId} (${client.name}) ${actionLabel} the meeting scheduled for ${when}.${message ? ` Note: ${message}` : ''}`,
        status: 'RECEIVED',
      },
    })
    .catch(() => null)

  await audit({
    actor: `client:${client.clientId}`, action: 'MEETING_CLIENT_RESPONSE', clientId: client.clientId,
    details: { meetingId: meeting.id, action, message: message || 'none', previousStatus: meeting.status },
  })

  await createNotification({
    type: 'MEETING', severity: action === 'DECLINE' ? 'WARNING' : 'INFO',
    title: `Client ${actionLabel} a meeting`,
    body: `${client.clientId} · ${client.name} — "${meeting.reason ?? 'consultation'}" (${meeting.channel}, ${when}). ${message || 'No note given.'} Manage it in the client's Meetings tab.`.slice(0, 500),
    clientId: client.clientId,
  })

  return Response.json({
    ok: true,
    message: action === 'CONFIRM'
      ? 'Confirmed — your response is recorded. See you at the meeting.'
      : action === 'DECLINE'
        ? 'Recorded. Our team will reach out to re-plan.'
        : 'Request sent — our team will propose a new time and it will appear here.',
  })
}
