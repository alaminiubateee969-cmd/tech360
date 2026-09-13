import { db } from '@/lib/db'
import { runAgent, rememberMemory } from '@/lib/agents/engine'
import { sendCommunication } from '@/lib/comms'
import { sanitizeText, audit, logError } from '@/lib/security'

// ============================================================
// AI OPERATIONS ACTIONS — every action the autonomous loop can
// execute. Real work only: agents run, messages attempt to send
// (honest NOT_CONFIGURED when credentials absent), alerts and
// tasks are written to the database, learning persists.
// Shared by /api/ops/act (HTTP, loop service) and the in-process
// production cycle (src/lib/ops-loop.ts) — single source of truth.
// ============================================================

export type OpsAction = string
export type OpsPayload = Record<string, unknown>
export type OpsActionResult = { ok: boolean; status: number; data: Record<string, unknown> }

async function ok(data: Record<string, unknown>): Promise<OpsActionResult> {
  return { ok: true, status: 200, data }
}

async function fail(status: number, error: string): Promise<OpsActionResult> {
  return { ok: false, status, data: { error } }
}

export async function executeOpsAction(action: string, payload: OpsPayload): Promise<OpsActionResult> {
  try {
    switch (action.toUpperCase()) {
      case 'SCORE_LEAD': {
        const clientRowId = sanitizeText(payload.clientId, 40)
        const client = await db.client.findFirst({ where: { OR: [{ id: clientRowId }, { clientId: clientRowId }] }, include: { lead: true } })
        if (!client) return fail(404, 'Client not found')
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
        return ok({ action: 'SCORE_LEAD', score, agentRun: { ok: run.ok, executionId: run.executionId } })
      }

      case 'FOLLOWUP_LEAD': {
        const clientRowId = sanitizeText(payload.clientId, 40)
        const client = await db.client.findFirst({ where: { OR: [{ id: clientRowId }, { clientId: clientRowId }] } })
        if (!client) return fail(404, 'Client not found')
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
        return ok({ action: 'FOLLOWUP_LEAD', sendStatus, commId, agentRun: { ok: run.ok, executionId: run.executionId } })
      }

      case 'TRIAGE_ERROR': {
        const errorId = sanitizeText(payload.errorId, 40)
        const err = await db.errorLog.findUnique({ where: { id: errorId } })
        if (!err) return fail(404, 'Error not found')
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
        return ok({ action: 'TRIAGE_ERROR', severity, remediation, agentRun: { ok: run.ok, executionId: run.executionId } })
      }

      case 'RETRY_COMM': {
        const commId = sanitizeText(payload.commId, 40)
        const comm = await db.communication.findUnique({ where: { id: commId } })
        if (!comm) return fail(404, 'Communication not found')
        if (comm.direction !== 'OUT') return fail(400, 'Only outbound messages can be retried')
        const { result } = await sendCommunication({
          clientId: comm.clientId ?? undefined, channel: comm.channel, to: comm.recipient ?? undefined,
          subject: comm.subject ?? undefined, body: comm.body, agentCode: 'OPS-CONDUCTOR',
        })
        return { ok: result.status === 'SENT', status: 200, data: { action: 'RETRY_COMM', status: result.status, error: result.error ?? null } }
      }

      case 'EXPIRE_PREVIEWS': {
        const ids = Array.isArray(payload.previewIds) ? payload.previewIds.map((x: unknown) => sanitizeText(String(x), 40)).filter(Boolean) : []
        if (!ids.length) return ok({ action: 'EXPIRE_PREVIEWS', expired: 0 })
        const res = await db.preview.updateMany({ where: { id: { in: ids }, status: { in: ['GENERATED', 'SENT', 'VIEWED'] } }, data: { status: 'EXPIRED' } })
        for (const id of ids) {
          await db.previewEvent.create({ data: { previewId: id, type: 'EXPIRED', meta: JSON.stringify({ by: 'ai-operations' }) } }).catch(() => null)
        }
        await db.notification.create({
          data: {
            type: 'SYSTEM', severity: 'WARNING',
            title: `${res.count} preview link${res.count === 1 ? '' : 's'} expired`,
            body: 'Tokenized preview links passed their security TTL and were marked EXPIRED by AI Operations. Issue a fresh preview if the client still needs one.',
            link: 'projects',
          },
        })
        return ok({ action: 'EXPIRE_PREVIEWS', expired: res.count })
      }

      case 'PUBLISH_DUE_BLOG_POSTS': {
        // scheduled content goes live exactly when authored — no manual step
        const due = await db.blogPost.findMany({ where: { status: 'SCHEDULED', publishedAt: { lte: new Date() } }, select: { id: true, slug: true, title: true } })
        if (!due.length) return ok({ action: 'PUBLISH_DUE_BLOG_POSTS', published: 0 })
        await db.blogPost.updateMany({ where: { id: { in: due.map((p) => p.id) } }, data: { status: 'PUBLISHED' } })
        await db.notification.create({
          data: {
            type: 'SYSTEM', severity: 'INFO',
            title: `${due.length} scheduled post${due.length === 1 ? '' : 's'} published`,
            body: `Went live automatically at its scheduled time: ${due.map((p) => p.title).join(', ').slice(0, 250)}.`,
            link: 'blog-studio',
          },
        })
        return ok({ action: 'PUBLISH_DUE_BLOG_POSTS', published: due.length, slugs: due.map((p) => p.slug) })
      }

      case 'ALERT': {
        const type = ['APPROVAL', 'ERROR', 'LEAD', 'PAYMENT', 'DELIVERY', 'REVIEW', 'REFERRAL', 'SYSTEM'].includes(sanitizeText(payload.type, 20).toUpperCase()) ? sanitizeText(payload.type, 20).toUpperCase() : 'SYSTEM'
        const title = sanitizeText(payload.title, 200) || 'AI Operations alert'
        const body = sanitizeText(payload.body, 1000) || null
        const severity = ['INFO', 'WARNING', 'CRITICAL'].includes(sanitizeText(payload.severity, 10).toUpperCase()) ? sanitizeText(payload.severity, 10).toUpperCase() : 'INFO'
        await db.notification.create({ data: { type, title, body, severity } })
        return ok({ action: 'ALERT' })
      }

      case 'RUN_AGENT': {
        const code = sanitizeText(payload.code, 20).toUpperCase()
        const input = sanitizeText(payload.input, 8000)
        if (!code || !input) return fail(400, 'code and input required')
        const run = await runAgent(code, { input, expectJson: payload.expectJson === true, workflow: 'OPS_LOOP' })
        return { ok: run.ok, status: 200, data: { action: 'RUN_AGENT', output: run.output, json: run.json, executionId: run.executionId, status: run.status } }
      }

      case 'LEARN': {
        const insight = sanitizeText(payload.insight, 2000)
        if (insight.length < 5) return fail(400, 'insight required')
        await rememberMemory({ scope: 'LESSON', key: `ops:${new Date().toISOString().slice(0, 10)}:${Math.random().toString(36).slice(2, 7)}`, content: insight, importance: 6, agentCode: 'OPS-CONDUCTOR' })
        return ok({ action: 'LEARN' })
      }

      case 'CREATE_TASK': {
        const clientRowId = sanitizeText(payload.clientId, 40)
        const title = sanitizeText(payload.title, 200)
        const client = clientRowId ? await db.client.findFirst({ where: { OR: [{ id: clientRowId }, { clientId: clientRowId }] } }) : null
        if (!client) return fail(404, 'Client not found')
        const project = await db.project.findFirst({ where: { clientId: client.id }, orderBy: { createdAt: 'desc' } })
        if (!project) return fail(400, 'No project for client')
        await db.projectTask.create({ data: { projectId: project.id, title: title || 'AI Operations task', description: sanitizeText(payload.description, 2000) || null, priority: 'MEDIUM', assigneeType: 'HUMAN' } })
        return ok({ action: 'CREATE_TASK' })
      }

      case 'LOG_CYCLE': {
        // one automation log per loop cycle — the ops heartbeat in the automation trail
        await db.automationLog.create({
          data: {
            workflow: 'AI_OPS_LOOP', trigger: sanitizeText(payload.trigger, 20) || 'SCHEDULER', correlationId: sanitizeText(payload.correlationId, 60) || `ops-${Date.now()}`,
            status: 'SUCCESS', input: JSON.stringify({ cycle: payload.cycle ?? null }).slice(0, 2000),
            output: JSON.stringify(payload.summary ?? {}).slice(0, 4000),
            steps: JSON.stringify(payload.actions ?? []).slice(0, 8000),
            finishedAt: new Date(),
          },
        })
        await audit({ actor: 'ops:ai-operations', action: 'OPS_CYCLE', details: payload.summary ?? {} })
        return ok({ action: 'LOG_CYCLE' })
      }

      default:
        return fail(400, `Unknown action: ${action}`)
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'unknown'
    await logError({ source: 'AUTOMATION', code: 'OPS_ACTION_FAILED', message: `${action}: ${msg}`, workflow: 'AI_OPS_LOOP' })
    return fail(500, msg)
  }
}
