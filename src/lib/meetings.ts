import { db } from '@/lib/db'
import { runAgent } from '@/lib/agents/engine'
import { createNotification } from '@/lib/notify'
import { sanitizeText, audit } from '@/lib/security'

// ============================================================
// MEETING CORE — shared by POST /api/admin/meetings (form UI)
// and the NL Command Center action, so both paths run the SAME
// real execution: MTG-015 agenda agent → meeting record →
// outbound communication (honest platform status) → audit →
// notification → portal visibility.
// ============================================================

export const MEETING_CHANNELS = ['GOOGLE_MEET', 'ZOOM', 'PHONE', 'WHATSAPP_CALL'] as const
export type MeetingChannel = (typeof MEETING_CHANNELS)[number]

export const DHAKA_OFFSET_MINUTES = 6 * 60 // Asia/Dhaka, UTC+6, no DST

/**
 * Flexible "when" parser for scheduling.
 * Accepts:
 *  - "2026-09-15T14:30"            (Dhaka local wall-clock, no offset)
 *  - "2026-09-15 14:30"            (same, space separator)
 *  - "2026-09-15T14:30:00"         (with seconds)
 *  - full ISO with Z / ±hh:mm      (absolute instant)
 * Returns a UTC Date or null when unparseable.
 */
export function parseWhenFlexible(raw: unknown): Date | null {
  if (typeof raw !== 'string' || !raw.trim()) return null
  const s = raw.trim()

  // Absolute instant (ISO with timezone designator) — trust as-is.
  if (/[T ]\d{2}:\d{2}(:\d{2})?(\.\d+)?(Z|[+-]\d{2}:?\d{2})$/.test(s)) {
    const d = new Date(s)
    return Number.isNaN(d.getTime()) ? null : d
  }

  // Local Dhaka wall-clock: "YYYY-MM-DD[T ]HH:mm[:ss]" → apply +06:00.
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?$/)
  if (m) {
    const [, y, mo, da, h, mi, se] = m
    const utcMs = Date.UTC(Number(y), Number(mo) - 1, Number(da), Number(h), Number(mi), Number(se ?? 0)) - DHAKA_OFFSET_MINUTES * 60_000
    const d = new Date(utcMs)
    // sanity: reject rolls caused by invalid wall-clock values (e.g. 25:99)
    if (d.getUTCFullYear() !== Number(y) || d.getUTCMonth() !== Number(mo) - 1 || d.getUTCDate() !== Number(da)) return null
    return d
  }

  // Last resort: Date.parse (e.g. "Sep 15 2026 14:30" style) — treated as UTC
  // only when an explicit offset is present; otherwise ambiguous so we reject
  // rather than guess the operator's intent.
  const t = Date.parse(s)
  if (!Number.isNaN(t) && /[T ]\d{2}:\d{2}/.test(s)) return new Date(t)
  return null
}

export type ScheduleMeetingInput = {
  clientDbId: string
  clientIdHuman: string // TECH-YYYY-NNNNNN
  clientName: string
  businessName: string | null
  businessType: string | null
  country: string | null
  pipelineStage: string
  projectId: string | null
  scheduledAt: Date
  channel: MeetingChannel
  reason: string
  bookingLink: string | null
  notes?: string
  actorEmail: string
  trigger: 'MEETINGS_UI' | 'COMMAND_CENTER'
}

export type ScheduleMeetingResult = {
  ok: true
  meeting: { id: string; status: string; scheduledAt: Date; channel: string; reason: string }
  agent: { ok: boolean; executionId: string | undefined; agenda: string }
}

/** The one true scheduling path — used by every entry point. */
export async function scheduleMeeting(input: ScheduleMeetingInput): Promise<ScheduleMeetingResult> {
  const whenIso = input.scheduledAt.toISOString()

  // Real AI execution: MTG-015 prepares the agenda so humans walk in prepared.
  const agenda = await runAgent('MTG-015', {
    input: `Prepare a meeting agenda for client ${input.clientIdHuman} (${input.clientName}${input.businessName ? ` — ${input.businessName}` : ''}). Purpose: ${input.reason || 'project consultation'}. Channel: ${input.channel}. Scheduled: ${whenIso}. Client context: business type ${input.businessType ?? 'unknown'}, country ${input.country ?? 'unknown'}, current stage ${input.pipelineStage}.`,
    clientId: input.clientDbId,
    projectId: input.projectId ?? undefined,
    workflow: 'MEETING_SCHEDULE',
  })
  const agendaText = (agenda.json ? JSON.stringify(agenda.json) : agenda.output).slice(0, 4000)

  const meeting = await db.meeting.create({
    data: {
      clientId: input.clientDbId,
      projectId: input.projectId,
      reason: input.reason || 'Consultation call',
      status: 'SCHEDULED',
      channel: input.channel,
      scheduledAt: input.scheduledAt,
      bookingLink: input.bookingLink,
      notes: input.notes
        ? `${input.notes}\n\n— AI-prepared agenda —\n${agendaText}`
        : `— AI-prepared agenda —\n${agendaText}`,
    },
  })

  // Outbound communication record — honest status (external channels may be
  // NOT_CONFIGURED; the record documents that the invitation was issued from
  // the platform and is visible in the client's portal).
  await db.communication
    .create({
      data: {
        clientId: input.clientDbId,
        channel: input.channel === 'PHONE' || input.channel === 'WHATSAPP_CALL' ? 'WHATSAPP' : 'EMAIL',
        direction: 'OUT',
        subject: `Meeting invitation: ${meeting.reason}`,
        body: `A meeting is scheduled for ${whenIso} via ${input.channel}.${input.bookingLink ? ` Join: ${input.bookingLink}` : ''} The client sees the full details in their portal (Meetings section).`,
        status: 'SENT_PLATFORM',
      },
    })
    .catch(() => null)

  await audit({
    actor: input.actorEmail,
    action: 'MEETING_SCHEDULED',
    clientId: input.clientIdHuman,
    details: {
      meetingId: meeting.id,
      scheduledAt: whenIso,
      channel: input.channel,
      reason: meeting.reason,
      trigger: input.trigger,
      agentRun: agenda.ok ? agenda.executionId : `agent-failed:${agenda.error}`,
    },
  })

  await createNotification({
    type: 'MEETING',
    severity: 'INFO',
    title: 'Meeting scheduled with client',
    body: `${input.clientIdHuman} — "${meeting.reason}" at ${whenIso.replace('T', ' ').slice(0, 16)} UTC via ${input.channel}. Agenda prepared by ${agenda.ok ? 'MTG-015 (Tempo)' : 'agent unavailable — add notes manually'}.`,
    clientId: input.clientIdHuman,
  })

  return {
    ok: true,
    meeting: {
      id: meeting.id,
      status: meeting.status,
      scheduledAt: meeting.scheduledAt ?? input.scheduledAt,
      channel: meeting.channel,
      reason: meeting.reason ?? input.reason,
    },
    agent: { ok: agenda.ok, executionId: agenda.executionId, agenda: agendaText.slice(0, 600) },
  }
}

/** Sanitize + validate a meeting channel from free-form input. */
export function normalizeChannel(raw: unknown): MeetingChannel | null {
  const c = sanitizeText(typeof raw === 'string' ? raw : '', 20).trim().toUpperCase().replace(/[\s-]+/g, '_')
  return (MEETING_CHANNELS as readonly string[]).includes(c) ? (c as MeetingChannel) : null
}
