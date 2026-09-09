import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { guard, isResponse } from '@/lib/api-guard'
import { runAgent } from '@/lib/agents/engine'
import { newCorrelationId, audit } from '@/lib/security'
import { PIPELINE_STAGES } from '@/lib/constants'

export const dynamic = 'force-dynamic'

// ============================================================
// NL COMMAND CENTER — Oracle agent translates natural language
// into ONE real action, executed server-side with RBAC + audit.
// No fabricated data: results come from live database queries.
// ============================================================

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
- search_knowledge {query:string} — search knowledge base
- search_memory {query:string} — search AI memory
- none — ask a short clarifying question`

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

  const [newLeads, pendingApprovals, unpaid, failedComms] = await Promise.all([
    db.client.count({ where: { createdAt: { gte: new Date(Date.now() - 24 * 3600 * 1000) } } }),
    db.approvalRequest.count({ where: { status: 'PENDING' } }),
    db.project.count({ where: { paymentStatus: { in: ['PENDING', 'PARTIAL'] } } }),
    db.communication.count({ where: { status: 'FAILED' } }),
  ])
  const contextNote = `LIVE CONTEXT (real numbers): new leads (24h)=${newLeads}, pending approvals=${pendingApprovals}, unpaid projects=${unpaid}, failed comms=${failedComms}. Current date: ${new Date().toISOString().slice(0, 10)}.\n\nCONVERSATION:\n${recent}\n\n${CAPABILITIES}`

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
