import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import {
  intakeLead,
  detectBusiness,
  recommendPlan,
  askScopeQuestions,
  submitScope,
  generatePreview,
  requestPayment,
  activateProject,
  clientScopeDecision,
  verifyPayment,
  prepareHandover,
  createHumanTask,
  requestReviewAndReferral,
} from '@/lib/journey'
import { generateCeoReport } from '@/lib/reports'
import { createNotification } from '@/lib/notify'
import { sanitizeText, rateLimit, clientIp, logError, audit, readJson, constantTimeEquals } from '@/lib/security'

export const dynamic = 'force-dynamic'

function asRecord(v: unknown): Record<string, unknown> {
  return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {}
}

// n8n automation bridge: automation.bdtech360.com → platform journey engine
// Authenticated via N8N_WEBHOOK_SECRET header. Every action runs the REAL
// journey functions and is logged to automation_logs.
export async function POST(req: NextRequest) {
  const ip = clientIp(req)
  const rl = rateLimit(`n8n:${ip}`, 120, 60_000)
  if (!rl.ok) return Response.json({ ok: false, error: 'Rate limited' }, { status: 429 })

  // FAIL CLOSED. This endpoint can reach VERIFY_PAYMENT, RECORD_PAYMENT,
  // START_PROJECT, CLIENT_SCOPE_DECISION and PREPARE_HANDOVER.
  const secret = process.env.N8N_WEBHOOK_SECRET
  if (!secret) {
    await logError({ source: 'WEBHOOK', code: 'N8N_SECRET_MISSING', message: 'n8n webhook rejected: N8N_WEBHOOK_SECRET is not configured' })
    return Response.json({ ok: false, error: 'Webhook not configured' }, { status: 503 })
  }
  if (!constantTimeEquals(req.headers.get('x-n8n-secret'), secret)) {
    return Response.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
  }

  const raw = await readJson(req)
  const nested = asRecord(raw.payload)
  const workflow = sanitizeText(raw.workflow, 60).toUpperCase()
  const candidateAction = sanitizeText(raw.action, 60).toUpperCase()
  const action =
    candidateAction && candidateAction !== 'UNDEFINED' && candidateAction !== 'NULL'
      ? candidateAction
      : workflow
  const rawClientRef = sanitizeText(raw.clientId ?? nested.clientId, 40)
  const clientRef =
    rawClientRef && rawClientRef.toLowerCase() !== 'undefined' && rawClientRef.toLowerCase() !== 'null'
      ? rawClientRef
      : ''

  try {
    const log = await db.automationLog.create({
      data: {
        workflow: `N8N:${workflow || action}`,
        trigger: 'WEBHOOK',
        correlationId: `n8n-${Date.now()}`,
        status: 'RUNNING',
        steps: '[]',
        input: JSON.stringify(raw).slice(0, 4000),
      },
    })

    const findClient = async () => {
      if (!clientRef) throw new Error('clientId is required for this workflow action')
      const c = await db.client.findFirst({ where: { OR: [{ id: clientRef }, { clientId: clientRef }] } })
      if (!c) throw new Error(`Client ${clientRef} not found`)
      return c
    }

    const pickField = (key: string, maxLen = 400): string =>
      sanitizeText(raw[key] ?? nested[key], maxLen)

    let result: unknown = null
    switch (action) {
      case 'LEAD_INTAKE':
      case 'INTAKE':
      case 'WHATSAPP_IN':
      case 'SOCIAL_INBOX': {
        const defaultSource =
          action === 'WHATSAPP_IN' ? 'WHATSAPP' : action === 'SOCIAL_INBOX' ? 'FACEBOOK' : 'N8N'
        result = await intakeLead({
          source: pickField('source', 20).toUpperCase() || defaultSource,
          name: pickField('name', 200),
          businessName: pickField('businessName', 200),
          email: pickField('email', 320),
          whatsapp: pickField('whatsapp', 32) || pickField('phone', 32),
          country: pickField('country', 80),
          message: pickField('message', 8000) || `Inbound ${defaultSource.toLowerCase()} message via n8n`,
        })
        break
      }
      case 'DETECT_BUSINESS':
      case 'BUSINESS_DETECTION': {
        const c = await findClient()
        result = await detectBusiness(c.id, pickField('message', 4000))
        break
      }
      case 'RECOMMEND_PLAN':
      case 'PLAN_RECOMMENDATION': {
        const c = await findClient()
        result = await recommendPlan(c.id)
        break
      }
      case 'ASK_SCOPE_QUESTIONS':
      case 'SCOPE_COLLECTION': {
        const c = await findClient()
        result = await askScopeQuestions(c.id)
        break
      }
      case 'SUBMIT_SCOPE':
      case 'AI_SCOPE_REVIEW':
      case 'SCOPE_REVIEW': {
        const c = await findClient()
        result = await submitScope(c.id, pickField('scopeText', 12000) || pickField('scope', 12000))
        break
      }
      case 'FINAL_SCOPE': {
        // Governed: never bypasses human approval. Ensures a draft scope exists and
        // surfaces its pending FINAL_SCOPE_SEND human approval status.
        const c = await findClient()
        const latestScope = await db.scopeOfWork.findFirst({
          where: { clientId: c.id },
          orderBy: { version: 'desc' },
        })
        const pendingApproval = await db.approvalRequest.findFirst({
          where: { clientId: c.id, type: 'FINAL_SCOPE_SEND', status: 'PENDING' },
          orderBy: { createdAt: 'desc' },
        })
        result = {
          governed: true,
          requiresHumanApproval: true,
          scopeId: latestScope?.id ?? null,
          version: latestScope?.version ?? null,
          approvalId: pendingApproval?.id ?? null,
          status: pendingApproval ? 'AWAITING_HUMAN_APPROVAL' : (latestScope?.status ?? 'NO_SCOPE_DRAFT'),
        }
        break
      }
      case 'ADMIN_APPROVAL': {
        // Non-negotiable rule: automation NEVER auto-approves human approval gates.
        await audit({
          actor: 'automation:n8n',
          action: 'N8N_ADMIN_APPROVAL_REFUSED',
          clientId: clientRef || undefined,
          details: { reason: 'Human operator approval cannot be completed by n8n automation' },
        })
        await db.automationLog.update({
          where: { id: log.id },
          data: { status: 'FAILED', error: 'Human approval required; automation cannot approve', finishedAt: new Date() },
        })
        return Response.json(
          { ok: false, governed: true, error: 'Human approval is required in the admin console; automation cannot approve.' },
          { status: 403 },
        )
      }
      case 'CLIENT_SCOPE_DECISION': {
        const c = await findClient()
        result = await clientScopeDecision(
          c.id,
          pickField('decision', 40).toUpperCase() as
            | 'APPROVED'
            | 'REVISION_REQUESTED'
            | 'CLARIFICATION_REQUESTED',
          pickField('notes', 4000),
        )
        break
      }
      case 'MEETING':
      case 'REQUEST_MEETING': {
        const c = await findClient()
        const taskId = await createHumanTask({
          clientRowId: c.id,
          title: `Schedule requested consultation with ${c.name} (${c.clientId})`,
          description: pickField('notes', 2000) || pickField('message', 2000) || 'Meeting coordination triggered via W12.',
          priority: 'HIGH',
        })
        result = { queued: true, humanTaskId: taskId, clientId: c.clientId }
        break
      }
      case 'GENERATE_PREVIEW':
      case 'HTML_PREVIEW': {
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
        result = await recordPayment(c.id, {
          amount: Number(raw.amount ?? nested.amount) || 0,
          method: pickField('method', 40),
          transactionId: pickField('transactionId', 80),
          milestone: pickField('milestone', 60),
          notes: pickField('notes', 1000),
        })
        break
      }
      case 'VERIFY_PAYMENT': {
        const paymentId = pickField('paymentId', 40)
        // Automation may not verify a payment. The governance boundary refuses it.
        result = await verifyPayment(paymentId, { type: 'AUTOMATION', id: 'n8n' })
        break
      }
      case 'START_PROJECT':
      case 'PROJECT_START': {
        const c = await findClient()
        result = await activateProject(c.id, pickField('projectId', 40) || undefined)
        break
      }
      case 'PROJECT_UPDATES': {
        const c = await findClient()
        const latestProject = await db.project.findFirst({
          where: { clientId: c.id },
          orderBy: { createdAt: 'desc' },
          include: { tasks: true },
        })
        const doneCount = latestProject ? latestProject.tasks.filter((t) => t.status === 'DONE').length : 0
        const totalCount = latestProject ? latestProject.tasks.length : 0
        await audit({
          actor: 'automation:n8n',
          action: 'PROJECT_PROGRESS_CHECKED',
          clientId: c.clientId,
          projectId: latestProject?.id,
          details: { doneCount, totalCount },
        })
        result = {
          clientId: c.clientId,
          projectId: latestProject?.id ?? null,
          status: latestProject?.status ?? 'NO_PROJECT',
          completedTasks: doneCount,
          totalTasks: totalCount,
        }
        break
      }
      case 'DELIVERY': {
        const c = await findClient()
        const projectId =
          pickField('projectId', 40) ||
          (await db.project.findFirst({ where: { clientId: c.id }, orderBy: { createdAt: 'desc' }, select: { id: true } }))?.id ||
          ''
        if (!projectId) throw new Error(`No project found for client ${c.clientId}`)
        result = await prepareHandover(c.id, projectId, 'n8n:W19_DELIVERY')
        break
      }
      case 'PREPARE_HANDOVER':
      case 'SOURCE_HANDOVER': {
        const c = await findClient()
        result = await prepareHandover(c.id, pickField('projectId', 40), 'n8n')
        break
      }
      case 'PASSWORD_CHANGE': {
        // Security: never mutates credentials over a webhook. Records the post-handover
        // credential-rotation reminder task on the client record.
        const c = await findClient()
        await audit({
          actor: 'automation:n8n',
          action: 'POST_HANDOVER_CREDENTIAL_REMINDER',
          clientId: c.clientId,
          details: { workflow: 'W21_PASSWORD_CHANGE' },
        })
        result = { reminded: true, credentialMutated: false, clientId: c.clientId }
        break
      }
      case 'REVIEW_REQUEST':
      case 'REFERRAL_REQUEST': {
        const c = await findClient()
        result = await requestReviewAndReferral(c.id)
        break
      }
      case 'CEO_REPORT': {
        const admin = await db.user.findFirst({
          where: { role: { in: ['SUPER_ADMIN', 'ADMIN'] }, isActive: true },
          orderBy: { createdAt: 'asc' },
          select: { id: true },
        })
        result = await generateCeoReport(admin?.id ?? 'system:n8n', 'SCHEDULED')
        break
      }
      case 'ERROR_MONITORING': {
        const unresolvedCount = await db.errorLog.count({ where: { resolved: false } })
        const recent = await db.errorLog.findMany({
          where: { resolved: false },
          orderBy: { createdAt: 'desc' },
          take: 5,
          select: { id: true, source: true, code: true, message: true, createdAt: true },
        })
        if (unresolvedCount > 0) {
          await createNotification({
            type: 'ERROR',
            severity: 'WARNING',
            title: `n8n W25: ${unresolvedCount} unresolved platform error(s)`,
            body: recent.map((r) => `[${r.source}] ${r.code ?? 'ERR'}: ${r.message.slice(0, 80)}`).join(' | ').slice(0, 300),
          }).catch(() => null)
        }
        result = { unresolvedCount, recent }
        break
      }
      default: {
        await db.automationLog.update({
          where: { id: log.id },
          data: { status: 'FAILED', error: `Unknown action ${action}`, finishedAt: new Date() },
        })
        return Response.json({ ok: false, error: `Unknown action: ${action}` }, { status: 400 })
      }
    }

    await db.automationLog.update({
      where: { id: log.id },
      data: {
        status: 'SUCCESS',
        output: JSON.stringify(result).slice(0, 6000),
        finishedAt: new Date(),
        clientId:
          (result as { clientRowId?: string })?.clientRowId ??
          (result as { clientId?: string })?.clientId ??
          null,
      },
    })
    return Response.json({ ok: true, action, result })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'unknown'
    await logError({ source: 'WEBHOOK', code: 'N8N_ACTION_FAILED', message: `${action}: ${msg}`, workflow: `N8N:${workflow}` })
    return Response.json({ ok: false, action, error: msg }, { status: 500 })
  }
}
