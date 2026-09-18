import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { guard, isResponse } from '@/lib/api-guard'
import { sanitizeText } from '@/lib/security'
import { parseWhenFlexible, scheduleMeeting, normalizeChannel, MEETING_CHANNELS, type MeetingChannel } from '@/lib/meetings'

export const dynamic = 'force-dynamic'

// POST /api/admin/meetings — schedule a real meeting for a client.
// Runs the MTG-015 meeting agent to prepare a call agenda (real AI execution),
// writes the meeting record + outbound communication + audit + notification.
// Core execution lives in lib/meetings.ts (shared with the NL Command Center).
export async function POST(req: NextRequest) {
  const g = await guard(req, { minRole: 'STAFF' })
  if (isResponse(g)) return g

  const body = await req.json().catch(() => ({} as Record<string, unknown>))
  const clientId = sanitizeText(typeof body.clientId === 'string' ? body.clientId : '', 20).trim()
  const reason = sanitizeText(typeof body.reason === 'string' ? body.reason : '', 200).trim()
  const channelRaw = sanitizeText(typeof body.channel === 'string' ? body.channel : 'GOOGLE_MEET', 20).trim()
  const bookingLinkRaw = typeof body.bookingLink === 'string' ? body.bookingLink.trim() : ''
  const scheduledAt = parseWhenFlexible(body.scheduledAt)
  const notes = sanitizeText(typeof body.notes === 'string' ? body.notes : '', 1000).trim()

  if (!clientId) return Response.json({ error: 'Client ID is required.' }, { status: 400 })
  if (!scheduledAt) return Response.json({ error: 'A valid date and time is required.' }, { status: 400 })
  if (scheduledAt.getTime() < Date.now() - 5 * 60_000) return Response.json({ error: 'The meeting time must be in the future.' }, { status: 400 })
  if (scheduledAt.getTime() > Date.now() + 60 * 24 * 3600 * 1000) return Response.json({ error: 'The meeting must be within the next 60 days.' }, { status: 400 })
  const channel: MeetingChannel = normalizeChannel(channelRaw) ?? 'GOOGLE_MEET'
  if (!MEETING_CHANNELS.includes(channel)) return Response.json({ error: 'Unknown meeting channel.' }, { status: 400 })
  let bookingLink: string | null = null
  if (bookingLinkRaw) {
    if (!/^https?:\/\//i.test(bookingLinkRaw)) return Response.json({ error: 'Joining link must be a valid http(s) URL.' }, { status: 400 })
    bookingLink = bookingLinkRaw.slice(0, 500)
  }

  const client = await db.client.findFirst({ where: { clientId, deletedAt: null }, include: { lead: true, projects: { orderBy: { createdAt: 'desc' }, take: 1, select: { id: true, code: true, name: true } } } })
  if (!client) return Response.json({ error: 'Client not found.' }, { status: 404 })

  const result = await scheduleMeeting({
    clientDbId: client.id,
    clientIdHuman: client.clientId,
    clientName: client.name,
    businessName: client.businessName,
    businessType: client.businessType,
    country: client.country,
    pipelineStage: client.pipelineStage,
    projectId: client.projects[0]?.id ?? null,
    scheduledAt,
    channel,
    reason,
    bookingLink,
    notes: notes || undefined,
    actorEmail: g.user.email,
    trigger: 'MEETINGS_UI',
  })

  return Response.json(result)
}
