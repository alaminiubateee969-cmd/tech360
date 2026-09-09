import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { intakeLead, detectBusiness, recommendPlan, askScopeQuestions, submitScope, generatePreview, requestPayment, activateProject, clientScopeDecision, verifyPayment, prepareHandover } from '@/lib/journey'
import { sanitizeText, rateLimit, clientIp, logError, audit, readJson } from '@/lib/security'

export const dynamic = 'force-dynamic'

// n8n automation bridge: automation.bdtech360.com → platform journey engine
// Authenticated via N8N_WEBHOOK_SECRET header. Every action runs the REAL
// journey functions and is logged to automation_logs.
export async function POST(req: NextRequest) {
  const ip = clientIp(req)
  const rl = rateLimit(`n8n:${ip}`, 120, 60_000)
  if (!rl.ok) return Response.json({ ok: false, error: 'Rate limited' }, { status: 429 })

  const secret = process.env.N8N_WEBHOOK_SECRET
  if (secret && req.headers.get('x-n8n-secret') !== secret) {
    return Response.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
  }

  const raw = await readJson(req)
  const workflow = sanitizeText(raw.workflow, 60).toUpperCase()
  const action = sanitizeText(raw.action, 60).toUpperCase() || workflow
  const clientRef = sanitizeText(raw.clientId, 40)

  try {
    const log = await db.automationLog.create({ data: { workflow: `N8N:${workflow || action}`, trigger: 'WEBHOOK', correlationId: `n8n-${Date.now()}`, status: 'RUNNING', input: JSON.stringify(raw).slice(0, 4000) } })

    const findClient = async () => {
      const c = await db.client.findFirst({ where: { OR: [{ id: clientRef }, { clientId: clientRef }] } })
      if (!c) throw new Error(`Client ${clientRef} not found`)
      return c
    }

    let result: unknown = null
    switch (action) {
      case 'LEAD_INTAKE': case 'INTAKE': {
        result = await intakeLead({
          source: sanitizeText(raw.source, 20).toUpperCase() || 'N8N',
          name: sanitizeText(raw.name, 200), businessName: sanitizeText(raw.businessName, 200),
          email: sanitizeText(raw.email, 320), whatsapp: sanitizeText(raw.whatsapp, 32),
          country: sanitizeText(raw.country, 80), message: sanitizeText(raw.message, 8000) || 'n8n lead',
        })
        break
      }
      case 'DETECT_BUSINESS': case 'BUSINESS_DETECTION': {
        const c = await findClient()
        result = await detectBusiness(c.id, sanitizeText(raw.message, 4000))
        break
      }
      case 'RECOMMEND_PLAN': case 'PLAN_RECOMMENDATION': {
        const c = await findClient()
        result = await recommendPlan(c.id)
        break
      }
      case 'ASK_SCOPE_QUESTIONS': case 'SCOPE_COLLECTION': {
        const c = await findClient()
        result = await askScopeQuestions(c.id)
        break
      }
      case 'SUBMIT_SCOPE': case 'AI_SCOPE_REVIEW': case 'SCOPE_REVIEW': {
        const c = await findClient()
        result = await submitScope(c.id, sanitizeText(raw.scopeText ?? raw.scope, 12000))
        break
      }
      case 'CLIENT_SCOPE_DECISION': {
        const c = await findClient()
        result = await clientScopeDecision(c.id, (sanitizeText(raw.decision, 40).toUpperCase() || 'APPROVED') as 'APPROVED' | 'REVISION_REQUESTED' | 'CLARIFICATION_REQUESTED', sanitizeText(raw.notes, 4000))
        break
      }
      case 'GENERATE_PREVIEW': case 'HTML_PREVIEW': {
        const c = await findClient()
        result = await generatePreview(c.id)
        break
      }
      case 'REQUEST_PAYMENT': {
        const c = await findClient()
        result = await requestPayment(c.id, 'n8n')
        break
      }
      case 'RECORD_PAYMENT': {
        const c = await findClient()
        const { recordPayment } = await import('@/lib/journey')
        result = await recordPayment(c.id, { amount: Number(raw.amount) || 0, method: sanitizeText(raw.method, 40), transactionId: sanitizeText(raw.transactionId, 80), milestone: sanitizeText(raw.milestone, 60), notes: sanitizeText(raw.notes, 1000) })
        break
      }
      case 'VERIFY_PAYMENT': {
        const paymentId = sanitizeText(raw.paymentId, 40)
        result = await verifyPayment(paymentId, 'n8n-automation')
        break
      }
      case 'START_PROJECT': case 'PROJECT_START': {
        const c = await findClient()
        result = await activateProject(c.id, sanitizeText(raw.projectId, 40) || undefined)
        break
      }
      case 'PREPARE_HANDOVER': case 'SOURCE_HANDOVER': {
        const c = await findClient()
        result = await prepareHandover(c.id, sanitizeText(raw.projectId, 40), 'n8n')
        break
      }
      default: {
        await db.automationLog.update({ where: { id: log.id }, data: { status: 'FAILED', error: `Unknown action ${action}`, finishedAt: new Date() } })
        return Response.json({ ok: false, error: `Unknown action: ${action}` }, { status: 400 })
      }
    }

    await db.automationLog.update({ where: { id: log.id }, data: { status: 'SUCCESS', output: JSON.stringify(result).slice(0, 6000), finishedAt: new Date(), clientId: (result as { clientRowId?: string })?.clientRowId ?? (result as { clientId?: string })?.clientId ?? null } })
    return Response.json({ ok: true, action, result })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'unknown'
    await logError({ source: 'WEBHOOK', code: 'N8N_ACTION_FAILED', message: `${action}: ${msg}`, workflow: `N8N:${workflow}` })
    return Response.json({ ok: false, action, error: msg }, { status: 500 })
  }
}
