import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { guard, isResponse } from '@/lib/api-guard'
import { runAgent } from '@/lib/agents/engine'
import { newCorrelationId, audit, sanitizeText } from '@/lib/security'
import { PIPELINE_STAGES } from '@/lib/constants'
import { parseWhenFlexible, scheduleMeeting, rescheduleMeeting, cancelMeeting, normalizeChannel } from '@/lib/meetings'

export const dynamic = 'force-dynamic'

// ============================================================
// NL COMMAND CENTER — Oracle agent translates natural language
// into ONE real action, executed server-side with RBAC + audit.
// No fabricated data: results come from live database queries.
// ============================================================

const TZ = 'Asia/Dhaka'

const CAPABILITIES = `Available actions (choose exactly ONE):
- show_new_leads {days?:number} — leads created in last N days (default 1/today)
- show_leads — all open leads
- show_stage {stage:string} — clients at a specific pipeline stage (one of ${PIPELINE_STAGES.slice(0, 10).join(', ')}…${PIPELINE_STAGES.slice(-3).join(', ')})
- show_unpaid — projects with unpaid/partial payment status
- show_pending_payments — payment records pending verification
- show_pending_approvals — admin approval queue
- show_failed_comms — failed communications
- show_failed_automations — failed automation runs
- show_meetings — requested/scheduled meetings
- show_clients {query?:string} — client list, optional search
- show_projects {status?:string} — projects, optional status filter
- show_ready_delivery — projects in delivery/handover stages
- show_agent_executions {agentCode?:string} — recent AI agent runs
- ceo_report — generate today's CEO report (AI over live data)
- generate_final_scope {clientId:string} — run Final Scope agent for a client (approval still required before sending)
- create_followup {clientId:string, note?:string} — create follow-up task for a client
- schedule_meeting {clientId:string, when:string, channel?:string, reason?:string} — schedule a real client meeting. Resolve relative dates ("next Tuesday 3pm") YOURSELF using the current Dhaka date/time in the context and output when as "YYYY-MM-DDTHH:mm" in Asia/Dhaka local time. channel: GOOGLE_MEET (default) | ZOOM | PHONE | WHATSAPP_CALL. Use the client's reference ID (e.g. TECH-2026-000001) from the CLIENT DIRECTORY in the context.
- reschedule_meeting {clientId:string, when:string, meetingId?:string} — MOVE an existing upcoming meeting to a new time. Match the client (reference ID) and pick the meeting from the UPCOMING MEETINGS directory in the context (pass its meetingId); if the client has several, pick the one the admin most likely means (earliest unless they name a reason). Resolve the new "when" exactly like schedule_meeting ("YYYY-MM-DDTHH:mm" Dhaka). Only REQUESTED/SCHEDULED meetings can be moved.
- cancel_meeting {clientId:string, meetingId?:string, reason?:string} — CANCEL an upcoming meeting for a client. Pick the meeting from the UPCOMING MEETINGS directory (pass its meetingId; if several, the earliest unless the admin names one). reason: short honest note why (e.g. "client asked to postpone", "team conflict"). Only REQUESTED/SCHEDULED meetings can be cancelled; completed meeting history is immutable.
- search_knowledge {query:string} — search knowledge base
- search_memory {query:string} — search AI memory
- none — ask a short clarifying question (use when the client or time is ambiguous)`

export async function POST(req: NextRequest) {
  const g = await guard(req, { minRole: 'ADMIN', limit: { max: 30, windowMs: 60_000 } })
  if (isResponse(g)) return g
  const correlationId = newCorrelationId()

  let body: { sessionId?: string; message?: string } = {}
  try { body = await req.json() } catch { /* ignore */ }
  const message = String(body.message ?? '').slice(0, 2000).trim()
  const sessionId = String(body.sessionId ?? '').slice(0, 80) || 'default'
  if (!message) return Response.json({ error: 'Message required' }, { status: 400 })

  await db.agentMessage.create({ data: { sessionId, userId: g.user.id, role: 'user', content: message } })

  const history = await db.agentMessage.findMany({ where: { sessionId }, orderBy: { createdAt: 'asc' }, take: 20 })
  const recent = history.slice(-8).map((m) => `${m.role === 'user' ? 'Admin' : 'Oracle'}: ${m.content}`).join('\n')

  const [newLeads, pendingApprovals, unpaid, failedComms, clientDir, upcomingMeetings] = await Promise.all([
    db.client.count({ where: { createdAt: { gte: new Date(Date.now() - 24 * 3600 * 1000) } } }),
    db.approvalRequest.count({ where: { status: 'PENDING' } }),
    db.project.count({ where: { paymentStatus: { in: ['PENDING', 'PARTIAL'] } } }),
    db.communication.count({ where: { status: 'FAILED' } }),
    db.client.findMany({ where: { deletedAt: null }, orderBy: { updatedAt: 'desc' }, take: 12, select: { clientId: true, name: true, businessName: true, pipelineStage: true } }),
    db.meeting.findMany({ where: { status: { in: ['REQUESTED', 'SCHEDULED'] } }, orderBy: { scheduledAt: 'asc' }, take: 10, select: { id: true, reason: true, channel: true, scheduledAt: true, status: true, client: { select: { clientId: true, name: true } } } }),
  ])

  // Dhaka "now" with weekday so the Oracle can resolve relative dates
  // ("next Tuesday 3pm") deterministically server-side.
  const now = new Date()
  const dhakaNow = new Intl.DateTimeFormat('en-GB', { timeZone: TZ, dateStyle: 'full', timeStyle: 'short', hour12: false }).format(now)
  const clientDirectory = clientDir.map((c) => `${c.clientId} (${c.name}${c.businessName ? ` — ${c.businessName}` : ''}, stage ${c.pipelineStage})`).join('; ')
  const meetingDirectory = upcomingMeetings
    .map((m) => `meetingId=${m.id} · ${m.client.clientId} (${m.client.name}) · ${m.reason} · ${m.channel} · ${m.scheduledAt ? m.scheduledAt.toISOString() : 'REQUESTED (no time yet)'} · ${m.status}`)
    .join('\n')

  const contextNote = `LIVE CONTEXT (real numbers): new leads (24h)=${newLeads}, pending approvals=${pendingApprovals}, unpaid projects=${unpaid}, failed comms=${failedComms}.
CURRENT DATE/TIME (Asia/Dhaka, resolve all relative dates against this): ${dhakaNow}.
CLIENT DIRECTORY (use these reference IDs for scheduling/scope/follow-ups): ${clientDirectory || 'none yet'}.
UPCOMING MEETINGS (for reschedule_meeting — pass meetingId; REQUESTED means the client asked but no time is set):
${meetingDirectory || 'none'}.

CONVERSATION:
${recent}

${CAPABILITIES}`

  const run = await runAgent('CMD-040', {
    input: message,
    expectJson: true,
    workflow: 'COMMAND_CENTER',
    contextNote,
  })

  let action = 'none'
  let params: Record<string, unknown> = {}
  let reply = 'I could not process that command. Please try rephrasing.'
  if (run.ok && run.json) {
    action = String(run.json.action ?? 'none')
    params = (run.json.params ?? {}) as Record<string, unknown>
    reply = String(run.json.say ?? '')
  } else if (run.ok && run.output) {
    reply = run.output
  } else if (run.error) {
    reply = `Command agent failed: ${run.error}`
  }

  let data: Record<string, unknown> | Array<Record<string, unknown>> | { report: string } | null = null
  let dataKind = ''
  try {
    switch (action) {
      case 'show_new_leads': {
        const days = Number(params.days ?? 1) || 1
        const since = new Date(Date.now() - days * 24 * 3600 * 1000)
        const rows = await db.client.findMany({ where: { createdAt: { gte: since } }, orderBy: { createdAt: 'desc' }, take: 50, select: { clientId: true, name: true, businessName: true, businessType: true, source: true, pipelineStage: true, createdAt: true } })
        data = rows
        dataKind = 'clients'
        if (!reply) reply = `${rows.length} new lead(s) in the last ${days} day(s).`
        break
      }
      case 'show_leads': {
        const rows = await db.client.findMany({ where: { status: { in: ['LEAD', 'CLIENT'] } }, orderBy: { updatedAt: 'desc' }, take: 100, select: { clientId: true, name: true, businessName: true, businessType: true, source: true, pipelineStage: true, createdAt: true } })
        data = rows
        dataKind = 'clients'
        if (!reply) reply = `${rows.length} open lead(s).`
        break
      }
      case 'show_stage': {
        const stage = String(params.stage ?? '').toUpperCase()
        if (!PIPELINE_STAGES.includes(stage as (typeof PIPELINE_STAGES)[number])) {
          reply = `Unknown stage "${stage}". Valid: ${PIPELINE_STAGES.join(', ')}`
          break
        }
        const rows = await db.client.findMany({ where: { pipelineStage: stage }, orderBy: { updatedAt: 'desc' }, take: 100, select: { clientId: true, name: true, businessName: true, pipelineStage: true, updatedAt: true } })
        data = rows
        dataKind = 'clients'
        if (!reply) reply = `${rows.length} client(s) at stage ${stage}.`
        break
      }
      case 'show_unpaid': {
        const rows = await db.project.findMany({ where: { paymentStatus: { in: ['PENDING', 'PARTIAL'] } }, orderBy: { updatedAt: 'desc' }, take: 100, include: { client: { select: { clientId: true, name: true } } } })
        data = rows
        dataKind = 'projects'
        if (!reply) reply = `${rows.length} project(s) with outstanding payment.`
        break
      }
      case 'show_pending_payments': {
        const rows = await db.payment.findMany({ where: { status: 'PENDING' }, orderBy: { createdAt: 'desc' }, take: 100, include: { client: { select: { clientId: true, name: true } } } })
        data = rows
        dataKind = 'payments'
        if (!reply) reply = `${rows.length} payment record(s) awaiting verification.`
        break
      }
      case 'show_pending_approvals': {
        const rows = await db.approvalRequest.findMany({ where: { status: 'PENDING' }, orderBy: { createdAt: 'desc' }, take: 100 })
        data = rows
        dataKind = 'approvals'
        if (!reply) reply = `${rows.length} pending approval(s).`
        break
      }
      case 'show_failed_comms': {
        const rows = await db.communication.findMany({ where: { status: 'FAILED' }, orderBy: { createdAt: 'desc' }, take: 100, select: { channel: true, recipient: true, status: true, error: true, createdAt: true } })
        data = rows
        dataKind = 'communications'
        if (!reply) reply = `${rows.length} failed communication(s).`
        break
      }
      case 'show_failed_automations': {
        const rows = await db.automationLog.findMany({ where: { status: 'FAILED' }, orderBy: { startedAt: 'desc' }, take: 100, select: { workflow: true, error: true, correlationId: true, startedAt: true } })
        data = rows
        dataKind = 'automations'
        if (!reply) reply = `${rows.length} failed automation run(s).`
        break
      }
      case 'show_meetings': {
        const rows = await db.meeting.findMany({ where: { status: { in: ['REQUESTED', 'SCHEDULED'] } }, orderBy: { createdAt: 'desc' }, take: 100, include: { client: { select: { clientId: true, name: true } } } })
        data = rows
        dataKind = 'meetings'
        if (!reply) reply = `${rows.length} meeting request(s).`
        break
      }
      case 'show_clients': {
        const q = String(params.query ?? '')
        const rows = await db.client.findMany({
          where: q ? { OR: [{ clientId: { contains: q } }, { name: { contains: q } }, { businessName: { contains: q } }, { email: { contains: q } }, { whatsapp: { contains: q } }] } : {},
          orderBy: { updatedAt: 'desc' }, take: 50,
          select: { clientId: true, name: true, businessName: true, businessType: true, pipelineStage: true, status: true },
        })
        data = rows
        dataKind = 'clients'
        if (!reply) reply = `${rows.length} matching client(s).`
        break
      }
      case 'show_projects': {
        const status = String(params.status ?? '')
        const rows = await db.project.findMany({
          where: status ? { status: status.toUpperCase() } : {},
          orderBy: { updatedAt: 'desc' }, take: 100,
          include: { client: { select: { clientId: true, name: true } } },
        })
        data = rows
        dataKind = 'projects'
        if (!reply) reply = `${rows.length} project(s)${status ? ` with status ${status}` : ''}.`
        break
      }
      case 'show_ready_delivery': {
        const rows = await db.client.findMany({ where: { pipelineStage: { in: ['DELIVERY', 'HANDOVER', 'FINAL_PAYMENT', 'CLIENT_REVIEW'] } }, include: { projects: { select: { code: true, name: true, status: true, paymentStatus: true } } } })
        data = rows
        dataKind = 'clients'
        if (!reply) reply = `${rows.length} client(s) in delivery/handover stages.`
        break
      }
      case 'show_agent_executions': {
        const agentCode = String(params.agentCode ?? '')
        const rows = await db.aiAgentExecution.findMany({
          where: agentCode ? { agentCode } : {},
          orderBy: { createdAt: 'desc' }, take: 50,
          select: { agentCode: true, status: true, workflow: true, tokensUsed: true, durationMs: true, error: true, createdAt: true },
        })
        data = rows
        dataKind = 'executions'
        if (!reply) reply = `${rows.length} recent agent execution(s).`
        break
      }
      case 'ceo_report': {
        const { generateCeoReport } = await import('@/lib/reports')
        const report = await generateCeoReport(g.user.id)
        data = { report }
        dataKind = 'report'
        reply = 'CEO daily report generated from live data.'
        break
      }
      case 'generate_final_scope': {
        const clientId = String(params.clientId ?? '')
        const client = await db.client.findFirst({ where: { OR: [{ id: clientId }, { clientId }] }, include: { lead: true, scopes: true } })
        if (!client) { reply = `Client ${clientId} not found.`; break }
        const run2 = await runAgent('SCP-008', {
          input: `Business type: ${client.businessType}\nPlan: ${client.lead?.interest ?? ''}\nRequirements: ${client.lead?.requirements ?? ''}`,
          clientId: client.id, workflow: 'SCOPE_DRAFT', expectJson: true,
        })
        if (run2.ok && run2.json) {
          const version = client.scopes.length + 1
          const scope = await db.scopeOfWork.create({
            data: { clientId: client.id, version, status: 'AWAITING_ADMIN_APPROVAL', summary: String(run2.json.summary ?? ''), content: JSON.stringify(run2.json), generatedBy: 'SCP-008' },
          })
          await db.approvalRequest.create({
            data: { type: 'FINAL_SCOPE_SEND', title: `Approve Final Scope for ${client.clientId}`, clientId: client.id, agentCode: 'SCP-008', payload: JSON.stringify({ scopeId: scope.id }), risk: 'MEDIUM', requestedBy: 'CMD-040' },
          })
          data = { scopeId: scope.id, version }
          dataKind = 'scope'
          reply = `Draft Final Scope v${version} generated for ${client.clientId} and queued for your approval. It will NOT be sent until you approve.`
        } else {
          reply = `Scope generation failed: ${run2.error ?? 'unknown error'}`
        }
        break
      }
      case 'create_followup': {
        const clientId = String(params.clientId ?? '')
        const client = await db.client.findFirst({ where: { OR: [{ id: clientId }, { clientId }] }, include: { projects: true } })
        if (!client) { reply = `Client ${clientId} not found.`; break }
        const project = client.projects[0]
        if (!project) { reply = `Client ${client.clientId} has no project to attach a follow-up task.`; break }
        const task = await db.projectTask.create({
          data: { projectId: project.id, title: `Follow-up: ${client.clientId}`, description: String(params.note ?? 'Follow up with client (created via Command Center).'), priority: 'HIGH', assigneeType: 'HUMAN' },
        })
        data = { taskId: task.id }
        dataKind = 'task'
        reply = `Follow-up task created for ${client.clientId}.`
        break
      }
      case 'schedule_meeting': {
        // NL entry point to the REAL scheduling pipeline (MTG-015 agenda agent
        // → meeting record → outbound comm → notification). Validates strictly:
        // client must exist, time must parse and be in the future (≤60d).
        const clientIdParam = sanitizeText(String(params.clientId ?? ''), 40).trim()
        const whenRaw = String(params.when ?? '').trim()
        const channel = normalizeChannel(params.channel ?? 'GOOGLE_MEET') ?? 'GOOGLE_MEET'
        const reason = sanitizeText(String(params.reason ?? ''), 200).trim()

        if (!clientIdParam || !whenRaw) {
          reply = 'To schedule a meeting I need a client reference and a time — e.g. "schedule a call with TECH-2026-000001 next Tuesday 3pm".'
          break
        }
        const client = await db.client.findFirst({
          where: { OR: [{ clientId: clientIdParam }, { name: { contains: clientIdParam } }, { businessName: { contains: clientIdParam } }] , deletedAt: null },
          include: { projects: { orderBy: { createdAt: 'desc' }, take: 1, select: { id: true } } },
        })
        if (!client) { reply = `I could not find a client matching "${clientIdParam}". Use show_clients to list references first.`; break }

        const scheduledAt = parseWhenFlexible(whenRaw)
        if (!scheduledAt) { reply = `I could not read the meeting time "${whenRaw}". Please give a date and time, e.g. "next Tuesday 3pm" or "2026-09-15T14:30".`; break }
        if (scheduledAt.getTime() < Date.now() - 5 * 60_000) { reply = `The requested time (${whenRaw}) is in the past. Pick a future time.`; break }
        if (scheduledAt.getTime() > Date.now() + 60 * 24 * 3600 * 1000) { reply = 'Meetings can be scheduled at most 60 days ahead. Pick a nearer date.'; break }

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
          reason: reason || 'Consultation call',
          bookingLink: null,
          actorEmail: g.user.email,
          trigger: 'COMMAND_CENTER',
        })

        data = {
          meetingId: result.meeting.id,
          clientId: client.clientId,
          clientName: client.name,
          reason: result.meeting.reason,
          channel: result.meeting.channel,
          scheduledAt: result.meeting.scheduledAt,
          status: result.meeting.status,
          agentOk: result.agent.ok,
          agentExecutionId: result.agent.executionId ?? null,
        }
        dataKind = 'meeting'
        reply = result.agent.ok
          ? `Meeting scheduled with **${client.clientId}** (${client.name}) — **${result.meeting.reason}** at ${result.meeting.scheduledAt.toISOString().replace('T', ' ').slice(0, 16)} UTC via ${result.meeting.channel}. The MTG-015 (Tempo) agent prepared the agenda, the invitation is recorded, and the client sees it in their portal now.`
          : `Meeting scheduled with **${client.clientId}** at ${result.meeting.scheduledAt.toISOString().replace('T', ' ').slice(0, 16)} UTC — but the agenda agent was unavailable, so add notes manually in the client's Meetings tab.`
        break
      }
      case 'reschedule_meeting': {
        // NL entry point to the REAL rescheduling pipeline (MTG-015 refreshed
        // agenda → meeting update → honest comm → notification). Strict
        // validation: client + meeting must exist, new time must parse and be
        // future (≤60d), only REQUESTED/SCHEDULED meetings can move.
        const clientIdParam = sanitizeText(String(params.clientId ?? ''), 40).trim()
        const whenRaw = String(params.when ?? '').trim()
        const meetingIdParam = sanitizeText(String(params.meetingId ?? params.id ?? ''), 40).trim()

        if (!clientIdParam || !whenRaw) {
          reply = 'To move a meeting I need a client reference and the new time — e.g. "move TECH-2026-000001\'s call to Thursday 4pm".'
          break
        }
        const client = await db.client.findFirst({
          where: { OR: [{ clientId: clientIdParam }, { name: { contains: clientIdParam } }, { businessName: { contains: clientIdParam } }], deletedAt: null },
        })
        if (!client) { reply = `I could not find a client matching "${clientIdParam}". Use show_clients to list references first.`; break }

        const newScheduledAt = parseWhenFlexible(whenRaw)
        if (!newScheduledAt) { reply = `I could not read the new meeting time "${whenRaw}". Please give a date and time, e.g. "tomorrow 10am" or "2026-09-15T14:30".`; break }
        if (newScheduledAt.getTime() < Date.now() - 5 * 60_000) { reply = `The requested time (${whenRaw}) is in the past. Pick a future time.`; break }
        if (newScheduledAt.getTime() > Date.now() + 60 * 24 * 3600 * 1000) { reply = 'Meetings can be moved at most 60 days ahead. Pick a nearer date.'; break }

        // Resolve the target meeting: explicit meetingId if the Oracle passed
        // one, else the client's nearest upcoming REQUESTED/SCHEDULED meeting.
        const target = meetingIdParam
          ? await db.meeting.findFirst({ where: { id: meetingIdParam, clientId: client.id }, orderBy: { scheduledAt: 'asc' } })
          : await db.meeting.findFirst({ where: { clientId: client.id, status: { in: ['REQUESTED', 'SCHEDULED'] } }, orderBy: [{ scheduledAt: 'asc' }] })
        if (!target) {
          reply = `${client.clientId} has no upcoming meeting to move. Use schedule_meeting to create one instead.`
          break
        }

        let result
        try {
          result = await rescheduleMeeting({
            clientDbId: client.id,
            clientIdHuman: client.clientId,
            clientName: client.name,
            businessName: client.businessName,
            businessType: client.businessType,
            country: client.country,
            pipelineStage: client.pipelineStage,
            meetingId: target.id,
            newScheduledAt,
            actorEmail: g.user.email,
            trigger: 'COMMAND_CENTER',
          })
        } catch (e) {
          const code = e instanceof Error ? e.message : 'UNKNOWN'
          reply = code === 'MEETING_NOT_FOUND'
            ? `That meeting no longer exists for ${client.clientId}. Use show_meetings to see current ones.`
            : code === 'MEETING_COMPLETED' || code === 'MEETING_CANCELLED'
              ? `That meeting is already ${code.replace('MEETING_', '').toLowerCase()} — only upcoming meetings can be moved.`
              : `Rescheduling failed: ${code}`
          break
        }

        const fmtUtc = (d: Date) => d.toISOString().replace('T', ' ').slice(0, 16)
        data = {
          meetingId: result.meeting.id,
          clientId: client.clientId,
          clientName: client.name,
          reason: result.meeting.reason,
          channel: result.meeting.channel,
          scheduledAt: result.meeting.scheduledAt,
          previousScheduledAt: result.meeting.previousScheduledAt,
          status: result.meeting.status,
          agentOk: result.agent.ok,
          agentExecutionId: result.agent.executionId ?? null,
        }
        dataKind = 'meeting_reschedule'
        reply = result.agent.ok
          ? `Meeting moved for **${client.clientId}** (${client.name}) — **${result.meeting.reason}** now at ${fmtUtc(result.meeting.scheduledAt)} UTC (was ${fmtUtc(result.meeting.previousScheduledAt)} UTC) via ${result.meeting.channel}. MTG-015 (Tempo) refreshed the agenda, the change is recorded, and the client sees the new time in their portal.`
          : `Meeting moved for **${client.clientId}** to ${fmtUtc(result.meeting.scheduledAt)} UTC — but the agenda agent was unavailable, so the original notes were kept. Update them in the client's Meetings tab if needed.`
        break
      }
      case 'cancel_meeting': {
        // NL entry point to the REAL cancellation pipeline (record →
        // CANCELLED with provenance → honest comm → notification).
        // No agenda agent run (an agenda for a meeting that will not
        // happen is wasted compute). Only REQUESTED/SCHEDULED can be
        // cancelled; completed history is immutable.
        const clientIdParam = sanitizeText(String(params.clientId ?? ''), 40).trim()
        const meetingIdParam = sanitizeText(String(params.meetingId ?? params.id ?? ''), 40).trim()
        const cancelReasonRaw = sanitizeText(String(params.reason ?? ''), 500).trim()

        if (!clientIdParam) {
          reply = 'To cancel a meeting I need a client reference — e.g. "cancel TECH-2026-000001\'s meeting on Thursday".'
          break
        }
        const client = await db.client.findFirst({
          where: { OR: [{ clientId: clientIdParam }, { name: { contains: clientIdParam } }, { businessName: { contains: clientIdParam } }] , deletedAt: null },
        })
        if (!client) { reply = `I could not find a client matching "${clientIdParam}". Use show_clients to list references first.`; break }

        const target = meetingIdParam
          ? await db.meeting.findFirst({ where: { id: meetingIdParam, clientId: client.id }, orderBy: { scheduledAt: 'asc' } })
          : await db.meeting.findFirst({ where: { clientId: client.id, status: { in: ['REQUESTED', 'SCHEDULED'] } }, orderBy: [{ scheduledAt: 'asc' }] })
        if (!target) {
          reply = `${client.clientId} has no upcoming meeting to cancel. Use schedule_meeting to create one instead.`
          break
        }

        let result
        try {
          result = await cancelMeeting({
            clientDbId: client.id,
            clientIdHuman: client.clientId,
            meetingId: target.id,
            reason: cancelReasonRaw || undefined,
            actorEmail: g.user.email,
            trigger: 'COMMAND_CENTER',
          })
        } catch (e) {
          const code = e instanceof Error ? e.message : 'UNKNOWN'
          reply = code === 'MEETING_NOT_FOUND'
            ? `That meeting no longer exists for ${client.clientId}. Use show_meetings to see current ones.`
            : code === 'MEETING_COMPLETED'
              ? 'That meeting is already completed — meeting history is immutable and cannot be cancelled.'
              : code === 'MEETING_ALREADY_CANCELLED'
                ? 'That meeting was already cancelled earlier.'
                : `Cancellation failed: ${code}`
          break
        }

        const fmtUtc = (d: Date | null) => (d ? d.toISOString().replace('T', ' ').slice(0, 16) : 'unscheduled')
        data = {
          meetingId: result.meeting.id,
          clientId: client.clientId,
          clientName: client.name,
          reason: result.meeting.reason,
          channel: result.meeting.channel,
          wasScheduledAt: result.meeting.scheduledAt,
          status: result.meeting.status,
          cancelReason: result.meeting.cancelReason,
          cancelledBy: g.user.email,
        }
        dataKind = 'meeting_cancel'
        reply = `Meeting cancelled for **${client.clientId}** (${client.name}) — **${result.meeting.reason}** (was ${fmtUtc(result.meeting.scheduledAt)} UTC via ${result.meeting.channel}). Reason on record: ${result.meeting.cancelReason}. The client sees the cancellation in their portal and can request a new time anytime.`
        break
      }
      case 'search_knowledge': {
        const q = String(params.query ?? '')
        const { searchKnowledge } = await import('@/lib/agents/engine')
        const results = await searchKnowledge(q, 5)
        const rows = results.map((r) => ({ title: r.doc.title, score: r.score, classification: r.doc.classification }))
        data = rows
        dataKind = 'knowledge'
        if (!reply) reply = `${rows.length} knowledge result(s) for "${q}".`
        break
      }
      case 'search_memory': {
        const q = String(params.query ?? '')
        const mems = await db.aiMemory.findMany({ where: { OR: [{ key: { contains: q } }, { content: { contains: q } }] }, take: 10, orderBy: { importance: 'desc' } })
        data = mems.map((m) => ({ scope: m.scope, key: m.key, content: m.content.slice(0, 200) }))
        dataKind = 'memory'
        if (!reply) reply = `${mems.length} memory record(s) for "${q}".`
        break
      }
      default:
        break
    }
  } catch (e) {
    reply += `\n(Action execution error: ${e instanceof Error ? e.message : String(e)})`
  }

  await db.agentMessage.create({
    data: { sessionId, userId: g.user.id, role: 'assistant', content: reply, meta: JSON.stringify({ action, params, dataKind }) },
  })
  await audit({ actor: g.user.email, action: 'COMMAND_EXECUTED', userId: g.user.id, details: { action, params, correlationId } })

  return Response.json({ reply, action, params, data, dataKind, executionId: run.executionId, status: run.status })
}
