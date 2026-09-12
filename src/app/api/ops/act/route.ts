import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { runAgent, rememberMemory } from '@/lib/agents/engine'
import { sendCommunication } from '@/lib/comms'
import { readJson, sanitizeText, audit, rateLimit, clientIp, logError } from '@/lib/security'

export const dynamic = 'force-dynamic'

function authorized(req: NextRequest): boolean {
  const secret = process.env.OPS_SECRET
  return Boolean(secret) && req.headers.get('x-ops-secret') === secret
}

// ============================================================
// AI OPERATIONS ACT — actions executed BY the autonomous loop.
// Every action is real: agents run, messages attempt to send
// (honest NOT_CONFIGURED when credentials absent), alerts and
// tasks are written to the database, learning persists.
// ============================================================
export async function POST(req: NextRequest) {
  if (!authorized(req)) return Response.json({ error: 'Unauthorized' }, { status: 401 })
  const rl = rateLimit(`ops-act:${clientIp(req)}`, 120, 60_000)
  if (!rl.ok) return Response.json({ error: 'Too many requests' }, { status: 429 })

  const raw = await readJson(req)
  const action = sanitizeText(raw.action, 40).toUpperCase()
  const payload = (raw.payload ?? {}) as Record<string, unknown>

  try {
    switch (action) {
      case 'SCORE_LEAD': {
        const clientRowId = sanitizeText(payload.clientId, 40)
        const client = await db.client.findFirst({ where: { OR: [{ id: clientRowId }, { clientId: clientRowId }] }, include: { lead: true } })
        if (!client) return Response.json({ ok: false, error: 'Client not found' }, { status: 404 })
        const run = await runAgent('REV-002', {
          input: `Score this lead 0-100 for Tech360 (budget signal, clarity of requirements, business type fit, urgency).\nBusiness: ${client.businessName} (${client.businessType})\nSource: ${client.source}\nBudget: ${client.lead?.budgetRange ?? 'unknown'}\nProject type: ${client.lead?.projectType ?? 'unknown'}\nMessage: ${(client.lead?.requirements ?? '').slice(0, 600)}`,
          clientId: client.id, workflow: 'OPS_LEAD_SCORING', expectJson: true,
        })
        let score = 50
        if (run.ok && run.json) {
          const s = Number(run.json.urgency === 'high' ? 80 : run.json.urgency === 'medium' ? 55 : 40)
          const budget = String(run.json.budgetRange ?? '')
          score = Number.isFinite(s) ? s : 50
          if (/\d{3,}/.test(budget.replace(/\D/g, ''))) score += 10
          score = Math.max(0, Math.min(100, score))
        }
        await db.client.update({ where: { id: client.id }, data: { score } })
        return Response.json({ ok: true, action, score, agentRun: { ok: run.ok, executionId: run.executionId } })
      }

      case 'FOLLOWUP_LEAD': {
        const clientRowId = sanitizeText(payload.clientId, 40)
        const client = await db.client.findFirst({ where: { OR: [{ id: clientRowId }, { clientId: clientRowId }] } })
        if (!client) return Response.json({ ok: false, error: 'Client not found' }, { status: 404 })
        const run = await runAgent('COM-010', {
          input: `Write a short, warm follow-up message to ${client.name} (${client.businessName ?? 'business'}) who inquired about a ${client.businessType ?? 'software'} project with Tech360 and has been quiet for a while. Ask if they want to continue or have questions. Max 60 words. Sign "Team Tech360".`,
          clientId: client.id, workflow: 'OPS_FOLLOWUP',
        })
        let sendStatus = 'NOT_CONFIGURED'
        let commId: string | null = null
        if (run.ok && run.output) {
          if (client.whatsapp) {
            const { communicationId, result } = await sendCommunication({ clientId: client.id, channel: 'WHATSAPP', to: client.whatsapp, body: run.output, agentCode: 'OPS-CONDUCTOR' })
            sendStatus = result.status
            commId = communicationId
          } else if (client.email) {
            const { communicationId, result } = await sendCommunication({ clientId: client.id, channel: 'EMAIL', to: client.email, subject: 'Following up on your Tech360 project', body: run.output, agentCode: 'OPS-CONDUCTOR' })
            sendStatus = result.status
            commId = communicationId
          }
        }
        // create a human task so the follow-up is never lost even if channels are not configured
        const project = await db.project.findFirst({ where: { clientId: client.id }, orderBy: { createdAt: 'desc' } })
        if (project) {
          await db.projectTask.create({ data: { projectId: project.id, title: `Follow-up needed: ${client.clientId}`, description: `Automated follow-up attempt: ${sendStatus}. ${sendStatus === 'NOT_CONFIGURED' ? 'CONFIGURATION REQUIRED: no WhatsApp/Email credentials — contact client manually or configure channels.' : ''}`, priority: sendStatus === 'SENT' ? 'LOW' : 'HIGH', assigneeType: 'HUMAN' } })
        } else {
          await db.notification.create({ data: { type: 'LEAD', title: `Follow-up attempted: ${client.clientId}`, body: `Channel status: ${sendStatus}. ${sendStatus === 'NOT_CONFIGURED' ? 'Configuration required for automated follow-ups.' : ''}`, severity: sendStatus === 'SENT' ? 'INFO' : 'WARNING' } })
        }
        return Response.json({ ok: true, action, sendStatus, commId, agentRun: { ok: run.ok, executionId: run.executionId } })
      }

      case 'TRIAGE_ERROR': {
        const errorId = sanitizeText(payload.errorId, 40)
        const err = await db.errorLog.findUnique({ where: { id: errorId } })
        if (!err) return Response.json({ ok: false, error: 'Error not found' }, { status: 404 })
        const run = await runAgent('ERR-034', {
          input: `Triage this platform error: source=${err.source} code=${err.code ?? 'n/a'} message=${err.message}. Classify severity, propose remediation and whether auto-retry is safe.`,
          expectJson: true, workflow: 'OPS_ERROR_TRIAGE',
        })
        let severity = 'WARNING'
        let remediation = 'Manual review'
        if (run.ok && run.json) {
          const sev = String((run.json as Record<string, unknown>).severity ?? '').toUpperCase()
          if (['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].includes(sev)) severity = sev
          remediation = sanitizeText(String((run.json as Record<string, unknown>).remediation ?? remediation), 1000) || remediation
        }
        await db.notification.create({
          data: { type: 'ERROR', title: `Triaged: ${err.source} error`, body: `${severity} — ${remediation}`.slice(0, 300), severity: severity === 'CRITICAL' ? 'CRITICAL' : severity === 'HIGH' ? 'WARNING' : 'INFO' },
        })
        return Response.json({ ok: true, action, severity, remediation, agentRun: { ok: run.ok, executionId: run.executionId } })
      }

      case 'RETRY_COMM': {
        const commId = sanitizeText(payload.commId, 40)
        const comm = await db.communication.findUnique({ where: { id: commId } })
        if (!comm) return Response.json({ ok: false, error: 'Communication not found' }, { status: 404 })
        if (comm.direction !== 'OUT') return Response.json({ ok: false, error: 'Only outbound messages can be retried' }, { status: 400 })
        const { result } = await sendCommunication({
          clientId: comm.clientId ?? undefined, channel: comm.channel, to: comm.recipient ?? undefined,
          subject: comm.subject ?? undefined, body: comm.body, agentCode: 'OPS-CONDUCTOR',
        })
        return Response.json({ ok: result.status === 'SENT', action, status: result.status, error: result.error ?? null })
      }

      case 'ALERT': {
        const type = ['APPROVAL', 'ERROR', 'LEAD', 'PAYMENT', 'DELIVERY', 'SYSTEM'].includes(sanitizeText(payload.type, 20).toUpperCase()) ? sanitizeText(payload.type, 20).toUpperCase() : 'SYSTEM'
        const title = sanitizeText(payload.title, 200) || 'AI Operations alert'
        const body = sanitizeText(payload.body, 1000) || null
        const severity = ['INFO', 'WARNING', 'CRITICAL'].includes(sanitizeText(payload.severity, 10).toUpperCase()) ? sanitizeText(payload.severity, 10).toUpperCase() : 'INFO'
        await db.notification.create({ data: { type, title, body, severity } })
        return Response.json({ ok: true, action })
      }

      case 'RUN_AGENT': {
        const code = sanitizeText(payload.code, 20).toUpperCase()
        const input = sanitizeText(payload.input, 8000)
        if (!code || !input) return Response.json({ ok: false, error: 'code and input required' }, { status: 400 })
        const run = await runAgent(code, { input, expectJson: payload.expectJson === true, workflow: 'OPS_LOOP' })
        return Response.json({ ok: run.ok, action, output: run.output, json: run.json, executionId: run.executionId, status: run.status })
      }

      case 'LEARN': {
        const insight = sanitizeText(payload.insight, 2000)
        if (insight.length < 5) return Response.json({ ok: false, error: 'insight required' }, { status: 400 })
        await rememberMemory({ scope: 'LESSON', key: `ops:${new Date().toISOString().slice(0, 10)}:${Math.random().toString(36).slice(2, 7)}`, content: insight, importance: 6, agentCode: 'OPS-CONDUCTOR' })
        return Response.json({ ok: true, action })
      }

      case 'CREATE_TASK': {
        const clientRowId = sanitizeText(payload.clientId, 40)
        const title = sanitizeText(payload.title, 200)
        const client = clientRowId ? await db.client.findFirst({ where: { OR: [{ id: clientRowId }, { clientId: clientRowId }] } }) : null
        if (!client) return Response.json({ ok: false, error: 'Client not found' }, { status: 404 })
        const project = await db.project.findFirst({ where: { clientId: client.id }, orderBy: { createdAt: 'desc' } })
        if (!project) return Response.json({ ok: false, error: 'No project for client' }, { status: 400 })
        await db.projectTask.create({ data: { projectId: project.id, title: title || 'AI Operations task', description: sanitizeText(payload.description, 2000) || null, priority: 'MEDIUM', assigneeType: 'HUMAN' } })
        return Response.json({ ok: true, action })
      }

      case 'LOG_CYCLE': {
        // one automation log per loop cycle — the ops heartbeat in the automation trail
        await db.automationLog.create({
          data: {
            workflow: 'AI_OPS_LOOP', trigger: 'SCHEDULER', correlationId: sanitizeText(payload.correlationId, 60) || `ops-${Date.now()}`,
            status: 'SUCCESS', input: JSON.stringify({ cycle: payload.cycle ?? null }).slice(0, 2000),
            output: JSON.stringify(payload.summary ?? {}).slice(0, 4000),
            steps: JSON.stringify(payload.actions ?? []).slice(0, 8000),
            finishedAt: new Date(),
          },
        })
        await audit({ actor: 'ops:ai-operations', action: 'OPS_CYCLE', details: payload.summary ?? {} })
        return Response.json({ ok: true, action })
      }

      default:
        return Response.json({ ok: false, error: `Unknown action: ${action}` }, { status: 400 })
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'unknown'
    await logError({ source: 'AUTOMATION', code: 'OPS_ACTION_FAILED', message: `${action}: ${msg}`, workflow: 'AI_OPS_LOOP' })
    return Response.json({ ok: false, error: msg }, { status: 500 })
  }
}
