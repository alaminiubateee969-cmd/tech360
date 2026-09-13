import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { guard, isResponse } from '@/lib/api-guard'
import { sanitizeText, audit } from '@/lib/security'
import { runAgent } from '@/lib/agents/engine'
import { createNotification } from '@/lib/notify'

export const dynamic = 'force-dynamic'

const CHANNELS = ['GOOGLE_MEET', 'ZOOM', 'PHONE', 'WHATSAPP_CALL']

function parseWhen(raw: unknown): Date | null {
  if (typeof raw !== 'string' || !raw.trim()) return null
  const d = new Date(raw)
  return Number.isNaN(d.getTime()) ? null : d
}

// POST /api/admin/meetings — schedule a real meeting for a client.
// Runs the MTG-015 meeting agent to prepare a call agenda (real AI execution),
// writes the meeting record + outbound communication + audit + notification.
export async function POST(req: NextRequest) {
  const g = await guard(req, { minRole: 'ADMIN' })
  if (isResponse(g)) return g

  const body = await req.json().catch(() => ({} as Record<string, unknown>))
  const clientId = sanitizeText(typeof body.clientId === 'string' ? body.clientId : '', 20).trim()
  const reason = sanitizeText(typeof body.reason === 'string' ? body.reason : '', 200).trim()
  const channel = sanitizeText(typeof body.channel === 'string' ? body.channel.toUpperCase() : 'GOOGLE_MEET', 20).trim()
  const bookingLinkRaw = typeof body.bookingLink === 'string' ? body.bookingLink.trim() : ''
  const scheduledAt = parseWhen(body.scheduledAt)
  const notes = sanitizeText(typeof body.notes === 'string' ? body.notes : '', 1000).trim()

  if (!clientId) return Response.json({ error: 'Client ID is required.' }, { status: 400 })
  if (!scheduledAt) return Response.json({ error: 'A valid date and time is required.' }, { status: 400 })
  if (scheduledAt.getTime() < Date.now() - 5 * 60_000) return Response.json({ error: 'The meeting time must be in the future.' }, { status: 400 })
  if (!CHANNELS.includes(channel)) return Response.json({ error: 'Unknown meeting channel.' }, { status: 400 })
  let bookingLink: string | null = null
  if (bookingLinkRaw) {
    if (!/^https?:\/\//i.test(bookingLinkRaw)) return Response.json({ error: 'Joining link must be a valid http(s) URL.' }, { status: 400 })
    bookingLink = bookingLinkRaw.slice(0, 500)
  }

  const client = await db.client.findFirst({ where: { clientId, deletedAt: null }, include: { lead: true, projects: { orderBy: { createdAt: 'desc' }, take: 1, select: { id: true, code: true, name: true } } } })
  if (!client) return Response.json({ error: 'Client not found.' }, { status: 404 })

  // Real AI execution: MTG-015 prepares the agenda so humans walk in prepared.
  const whenIso = scheduledAt.toISOString()
  const agenda = await runAgent('MTG-015', {
    input: `Prepare a meeting agenda for client ${client.clientId} (${client.name}${client.businessName ? ` — ${client.businessName}` : ''}). Purpose: ${reason || 'project consultation'}. Channel: ${channel}. Scheduled: ${whenIso}. Client context: business type ${client.businessType ?? 'unknown'}, country ${client.country ?? 'unknown'}, current stage ${client.pipelineStage}.`,
    clientId: client.id,
    projectId: client.projects[0]?.id,
    workflow: 'MEETING_SCHEDULE',
  })
  const agendaText = (agenda.json ? JSON.stringify(agenda.json) : agenda.output).slice(0, 4000)

  const meeting = await db.meeting.create({
    data: {
      clientId: client.id,
      projectId: client.projects[0]?.id ?? null,
      reason: reason || 'Consultation call',
      status: 'SCHEDULED',
      channel,
      scheduledAt,
      bookingLink,
      notes: notes ? `${notes}\n\n— AI-prepared agenda —\n${agendaText}` : `— AI-prepared agenda —\n${agendaText}`,
    },
  })

  // Outbound communication record — honest status (channels may be NOT_CONFIGURED,
  // the record still documents that the invitation was issued from the platform).
  await db.communication
    .create({
      data: {
        clientId: client.id,
        channel: channel === 'PHONE' || channel === 'WHATSAPP_CALL' ? 'WHATSAPP' : 'EMAIL',
        direction: 'OUT',
        subject: `Meeting invitation: ${meeting.reason}`,
        body: `A meeting is scheduled for ${whenIso} via ${channel}.${bookingLink ? ` Join: ${bookingLink}` : ''} The client sees the full details in their portal (Meetings section).`,
        status: 'SENT_PLATFORM',
      },
    })
    .catch(() => null)

  await audit({
    actor: g.user.email, action: 'MEETING_SCHEDULED', clientId: client.clientId,
    details: { meetingId: meeting.id, scheduledAt: whenIso, channel, reason: meeting.reason, agentRun: agenda.ok ? agenda.executionId : `agent-failed:${agenda.error}` },
  })

  await createNotification({
    type: 'MEETING', severity: 'INFO',
    title: 'Meeting scheduled with client',
    body: `${client.clientId} · ${client.name} — "${meeting.reason}" at ${whenIso.replace('T', ' ').slice(0, 16)} UTC via ${channel}. Agenda prepared by ${agenda.ok ? 'MTG-015 (Tempo)' : 'agent unavailable — add notes manually'}.`,
    clientId: client.clientId,
  })

  return Response.json({
    ok: true,
    meeting: { id: meeting.id, status: meeting.status, scheduledAt: meeting.scheduledAt, channel: meeting.channel, reason: meeting.reason },
    agent: { ok: agenda.ok, executionId: agenda.executionId, agenda: agendaText.slice(0, 600) },
  })
}
