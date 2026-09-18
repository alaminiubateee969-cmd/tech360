import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { guard, isResponse } from '@/lib/api-guard'
import { sanitizeText, audit } from '@/lib/security'
import { createNotification } from '@/lib/notify'

export const dynamic = 'force-dynamic'

const RESCHEDULABLE = ['REQUESTED', 'SCHEDULED', 'DECLINED']

// PATCH /api/admin/meetings/[id] — manage an existing meeting:
//   { action: 'COMPLETE' | 'CANCEL' | 'RESCHEDULE', notes?, scheduledAt? }
// Every transition updates the real record, is audited, and (when it affects
// the client) creates a communication + notification.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const g = await guard(req, { minRole: 'STAFF' })
  if (isResponse(g)) return g

  const { id } = await params
  const meeting = await db.meeting.findUnique({ where: { id }, include: { client: { select: { id: true, clientId: true, name: true } } } })
  if (!meeting) return Response.json({ error: 'Meeting not found.' }, { status: 404 })

  const body = await req.json().catch(() => ({} as Record<string, unknown>))
  const action = typeof body.action === 'string' ? body.action.toUpperCase() : ''
  const notes = sanitizeText(typeof body.notes === 'string' ? body.notes : '', 1000).trim()
  const scheduledAt = typeof body.scheduledAt === 'string' && body.scheduledAt.trim() ? new Date(body.scheduledAt) : null
  if (scheduledAt && Number.isNaN(scheduledAt.getTime())) return Response.json({ error: 'Invalid new time.' }, { status: 400 })

  const whenLabel = (m: { scheduledAt: Date | null }) => (m.scheduledAt ? m.scheduledAt.toISOString().replace('T', ' ').slice(0, 16) + ' UTC' : 'a time to be confirmed')

  if (action === 'COMPLETE') {
    if (meeting.status === 'COMPLETED') return Response.json({ error: 'This meeting is already completed.' }, { status: 409 })
    const finalNotes = notes || meeting.notes || ''
    await db.meeting.update({
      where: { id: meeting.id },
      data: { status: 'COMPLETED', notes: finalNotes.slice(0, 4000) },
    })
    await audit({ actor: g.user.email, action: 'MEETING_COMPLETED', clientId: meeting.client.clientId, details: { meetingId: meeting.id, notesLen: finalNotes.length } })
    return Response.json({ ok: true, status: 'COMPLETED' })
  }

  if (action === 'CANCEL') {
    if (meeting.status === 'COMPLETED') return Response.json({ error: 'Completed meetings cannot be cancelled.' }, { status: 409 })
    await db.meeting.update({
      where: { id: meeting.id },
      data: { status: 'CANCELLED', notes: notes ? `${meeting.notes ? meeting.notes + '\n' : ''}Cancelled: ${notes}`.slice(0, 4000) : meeting.notes },
    })
    await db.communication
      .create({
        data: {
          clientId: meeting.client.id, channel: 'PORTAL', direction: 'OUT',
          subject: `Meeting cancelled: ${meeting.reason ?? 'consultation'}`,
          body: `The meeting scheduled for ${whenLabel(meeting)} was cancelled by Tech360.${notes ? ` Reason: ${notes}` : ''}`,
          status: 'SENT_PLATFORM',
        },
      })
      .catch(() => null)
    await audit({ actor: g.user.email, action: 'MEETING_CANCELLED', clientId: meeting.client.clientId, details: { meetingId: meeting.id, notes: notes || 'none' } })
    await createNotification({
      type: 'MEETING', severity: 'WARNING',
      title: 'Meeting cancelled',
      body: `${meeting.client.clientId} — "${meeting.reason ?? 'consultation'}" (${whenLabel(meeting)}) was cancelled. The client sees this in their portal. Re-schedule from the client's Meetings tab if needed.`,
      clientId: meeting.client.clientId,
    })
    return Response.json({ ok: true, status: 'CANCELLED' })
  }

  if (action === 'RESCHEDULE') {
    if (!RESCHEDULABLE.includes(meeting.status)) return Response.json({ error: 'This meeting can no longer be rescheduled.' }, { status: 409 })
    if (!scheduledAt) return Response.json({ error: 'A new date and time is required to reschedule.' }, { status: 400 })
    if (scheduledAt.getTime() < Date.now() - 5 * 60_000) return Response.json({ error: 'The new time must be in the future.' }, { status: 400 })
    await db.meeting.update({
      where: { id: meeting.id },
      data: {
        status: 'SCHEDULED',
        scheduledAt,
        clientResponse: null,
        clientRespondedAt: null,
        notes: notes ? `${meeting.notes ? meeting.notes + '\n' : ''}Rescheduled: ${notes}`.slice(0, 4000) : meeting.notes,
      },
    })
    await db.communication
      .create({
        data: {
          clientId: meeting.client.id, channel: 'PORTAL', direction: 'OUT',
          subject: `Meeting moved: ${meeting.reason ?? 'consultation'}`,
          body: `The meeting was moved to ${scheduledAt.toISOString().replace('T', ' ').slice(0, 16)} UTC. The client is asked to confirm the new time in their portal.`,
          status: 'SENT_PLATFORM',
        },
      })
      .catch(() => null)
    await audit({ actor: g.user.email, action: 'MEETING_RESCHEDULED', clientId: meeting.client.clientId, details: { meetingId: meeting.id, from: meeting.scheduledAt?.toISOString() ?? null, to: scheduledAt.toISOString() } })
    await createNotification({
      type: 'MEETING', severity: 'INFO',
      title: 'Meeting rescheduled',
      body: `${meeting.client.clientId} — "${meeting.reason ?? 'consultation'}" moved to ${scheduledAt.toISOString().replace('T', ' ').slice(0, 16)} UTC. Awaiting the client's confirmation in the portal.`,
      clientId: meeting.client.clientId,
    })
    return Response.json({ ok: true, status: 'SCHEDULED', scheduledAt })
  }

  return Response.json({ error: 'Unknown action. Use COMPLETE, CANCEL or RESCHEDULE.' }, { status: 400 })
}
