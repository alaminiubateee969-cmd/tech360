// ============================================================
// TECH360 — automation action handlers
// ============================================================
// Each handler performs one real side effect and reports exactly what
// happened. "Not configured", "no consent" and "no target" are FAILED (not
// retryable) — never silently SUCCEEDED. Handlers are idempotent per
// `idempotencyKey` (run id + action index) so a retry cannot duplicate a send.
// ============================================================

import { db } from '@/lib/db'
import { PIPELINE_STAGES } from '@/lib/constants'
import { DEFAULT_TENANT_ID } from '@/lib/tenancy'
import type { ActionOutcome } from '@/lib/automation/engine'
import type { RuleAction } from '@/lib/automation/catalog'

export type ActionContext = {
  tenantId: string
  runId: string
  ruleKey: string
  actionIndex: number
  idempotencyKey: string
  event: { type: string; source: string; subjectType: string | null; subjectId: string | null; payload: Record<string, unknown> }
  approvalId: string | null
}

const fail = (detail: string, retryable = false): ActionOutcome => ({ status: 'FAILED', detail, retryable })
const ok = (detail: string, output?: Record<string, unknown>): ActionOutcome => ({ status: 'SUCCEEDED', detail, ...(output ? { output } : {}) })

async function conversationFor(ctx: ActionContext) {
  const id = ctx.event.subjectType === 'ChatConversation' ? ctx.event.subjectId : (typeof ctx.event.payload.conversationId === 'string' ? ctx.event.payload.conversationId : null)
  if (!id) return null
  const { getConversationForTenant } = await import('@/lib/webchat/inbox-service')
  return getConversationForTenant(id, ctx.tenantId)
}

async function clientFor(ctx: ActionContext) {
  // CRM customer records exist in the primary workspace only; another tenant's
  // automation must never read or message them (fail closed → action FAILED).
  if (ctx.tenantId !== DEFAULT_TENANT_ID) return null
  const fromPayload = typeof ctx.event.payload.clientRowId === 'string' ? ctx.event.payload.clientRowId : null
  const fromSubject = ctx.event.subjectType === 'Client' ? ctx.event.subjectId : null
  let id = fromPayload || fromSubject
  if (!id) {
    const conv = await conversationFor(ctx)
    id = conv?.clientId ?? null
  }
  if (!id) return null
  const client = await db.client.findUnique({ where: { id }, include: { lead: true } })
  return client && !client.deletedAt ? client : null
}

const automationActor = (ctx: ActionContext) => ({ kind: 'AUTOMATION' as const, ruleKey: ctx.ruleKey, runId: ctx.runId })

export async function executeAction(action: RuleAction, ctx: ActionContext): Promise<ActionOutcome> {
  const p = action.params ?? {}
  switch (action.type) {
    case 'CRM_UPDATE_LEAD': {
      const client = await clientFor(ctx)
      if (!client) return fail('No CRM record is linked to this event')
      const updates: string[] = []
      const stage = typeof p.pipelineStage === 'string' ? p.pipelineStage : null
      if (stage) {
        const order = PIPELINE_STAGES as readonly string[]
        if (order.indexOf(stage) > order.indexOf(client.pipelineStage)) {
          await db.client.update({ where: { id: client.id }, data: { pipelineStage: stage } })
          updates.push(`pipeline ${client.pipelineStage} → ${stage}`)
        } else {
          updates.push(`pipeline left at ${client.pipelineStage} (automation never moves a record backwards)`)
        }
      }
      if (typeof p.interest === 'string' && p.interest) {
        if (client.lead) await db.lead.update({ where: { id: client.lead.id }, data: { interest: p.interest } })
        else await db.lead.create({ data: { clientId: client.id, interest: p.interest, sourceDetails: `AUTOMATION:${ctx.ruleKey}` } })
        updates.push('lead interest updated')
      }
      return ok(`${client.clientId}: ${updates.join('; ') || 'nothing to change'}`)
    }

    case 'ASSIGN_CONVERSATION': {
      const conv = await conversationFor(ctx)
      if (!conv) return fail('No conversation is linked to this event')
      let assigneeId: string | null = conv.assignedToId
      if (typeof p.assigneeEmail === 'string' && p.assigneeEmail) {
        const user = await db.user.findFirst({ where: { email: p.assigneeEmail.toLowerCase(), isActive: true, tenantId: ctx.tenantId }, select: { id: true } })
        if (!user) return fail(`No active team member ${p.assigneeEmail} in this tenant`)
        assigneeId = user.id
      }
      const { assignConversation } = await import('@/lib/webchat/inbox-service')
      const r = await assignConversation({ conversation: conv, assigneeId, team: typeof p.team === 'string' ? (p.team as 'SUPPORT') : undefined, actor: automationActor(ctx) })
      return ok(r.changed ? 'Conversation assignment updated' : 'Assignment already matched; nothing changed')
    }

    case 'SET_PRIORITY': {
      const conv = await conversationFor(ctx)
      if (!conv) return fail('No conversation is linked to this event')
      const { setConversationPriority } = await import('@/lib/webchat/inbox-service')
      const r = await setConversationPriority({ conversation: conv, priority: String(p.priority) as 'HIGH', actor: automationActor(ctx) })
      return ok(r.changed ? `Priority set to ${p.priority}` : `Priority already ${p.priority}`)
    }

    case 'ESCALATE_CONVERSATION':
    case 'CREATE_SUPPORT_TICKET': {
      const conv = await conversationFor(ctx)
      if (!conv) return fail('No conversation is linked to this event')
      const { transitionConversation } = await import('@/lib/webchat/inbox-service')
      const reason = action.type === 'CREATE_SUPPORT_TICKET' ? `Support ticket (${String(p.category)})` : String(p.reason ?? 'Escalated by automation')
      if (conv.inboxState !== 'ESCALATED' && conv.inboxState !== 'RESOLVED') {
        await transitionConversation({ conversation: conv, to: 'ESCALATED', actor: automationActor(ctx), reason, depth: Number(ctx.event.payload._depth ?? 0) })
      }
      if (action.type === 'CREATE_SUPPORT_TICKET') {
        if (!conv.clientId) return fail('Escalated, but no CRM record is linked so no ticket task could be created')
        const { createHumanTask } = await import('@/lib/journey')
        const taskId = await createHumanTask({ clientRowId: conv.clientId, title: `Support ticket (${String(p.category)}) — WebChat`, description: `Opened by automation ${ctx.ruleKey} for conversation ${conv.id}.`, link: 'chat', priority: 'HIGH' })
        return ok(`Escalated and ticket task ${taskId ?? '(notification)'} created`, { taskId })
      }
      return ok(conv.inboxState === 'ESCALATED' ? 'Already escalated; nothing changed' : 'Conversation escalated')
    }

    case 'CREATE_TASK': {
      const client = await clientFor(ctx)
      if (!client) return fail('A task needs a linked CRM record')
      const { createHumanTask } = await import('@/lib/journey')
      const taskId = await createHumanTask({ clientRowId: client.id, title: String(p.title), description: `Created by automation ${ctx.ruleKey} (run ${ctx.runId}).`, priority: (p.priority as 'LOW' | 'MEDIUM' | 'HIGH') ?? 'MEDIUM' })
      return ok(`Task created for ${client.clientId}`, { taskId })
    }

    case 'NOTIFY_TEAM': {
      const row = await db.notification.create({
        data: { type: 'SYSTEM', title: String(p.title).slice(0, 200), body: `Automation ${ctx.ruleKey} · ${ctx.event.type}`.slice(0, 500), severity: (p.severity as string) ?? 'INFO', link: 'automation' },
      })
      return ok('Team notification stored', { notificationId: row.id })
    }

    case 'SEND_APPROVED_REPLY': {
      const conv = await conversationFor(ctx)
      if (!conv) return fail('No conversation is linked to this event')
      const { automationReply } = await import('@/lib/webchat/inbox-service')
      const r = await automationReply({ conversation: conv, text: String(p.text), ruleKey: ctx.ruleKey, idempotencyKey: ctx.idempotencyKey })
      return ok(r.duplicate ? 'Template already posted on an earlier attempt' : 'Approved template posted to WebChat', { messageId: r.message.id })
    }

    case 'SEND_EMAIL':
    case 'SEND_WHATSAPP': {
      const channel = action.type === 'SEND_EMAIL' ? 'EMAIL' : 'WHATSAPP'
      const client = await clientFor(ctx)
      if (!client) return fail('No CRM record is linked to this event')
      const to = channel === 'EMAIL' ? client.email : client.whatsapp
      if (!to) return fail(`${client.clientId} has no ${channel === 'EMAIL' ? 'email address' : 'WhatsApp number'} on file`)
      const { loadCommState } = await import('@/lib/conversation-state')
      const state = await loadCommState(client.id, client.clientId).catch(() => null)
      if (!state) return fail('Communication state could not be verified; send suppressed', true)
      if (state.optedOut) return fail(`${client.clientId} opted out of messages; nothing was sent`)
      const prior = await db.communication.findFirst({ where: { workflowId: ctx.idempotencyKey, status: { in: ['SENT', 'DELIVERED', 'READ', 'SENT_PLATFORM'] } }, select: { id: true } })
      if (prior) return ok('Already sent on an earlier attempt', { communicationId: prior.id })
      const { sendCommunication } = await import('@/lib/comms')
      const sent = await sendCommunication({
        clientId: client.id,
        channel,
        to,
        subject: channel === 'EMAIL' ? String(p.subject) : undefined,
        body: String(p.text),
        agentCode: 'AUTOMATION_ENGINE',
        workflowId: ctx.idempotencyKey,
        approvalId: ctx.approvalId ?? undefined,
      })
      if (sent.result.ok) return ok(`${channel} accepted by provider (${sent.result.status})`, { communicationId: sent.communicationId })
      const retryable = sent.result.status === 'FAILED'
      return fail(`${channel} not sent: ${sent.result.status}${sent.result.error ? ` — ${sent.result.error}` : ''}`, retryable)
    }

    case 'SCHEDULE_FOLLOW_UP': {
      const minutes = Number(p.delayMinutes)
      const { emitAutomationEvent } = await import('@/lib/automation/engine')
      const r = await emitAutomationEvent({
        tenantId: ctx.tenantId,
        type: 'FOLLOW_UP_DUE',
        source: 'SCHEDULER',
        subjectType: ctx.event.subjectType,
        subjectId: ctx.event.subjectId,
        payload: { ...ctx.event.payload, note: typeof p.note === 'string' ? p.note : null, scheduledBy: ctx.ruleKey },
        dedupeKey: `followup:${ctx.idempotencyKey}`,
        availableAt: new Date(Date.now() + minutes * 60_000),
        depth: Number(ctx.event.payload._depth ?? 0) + 1,
      }, { process: minutes === 0 })
      return ok(`Follow-up scheduled for ${r.event.availableAt.toISOString()}`, { eventId: r.event.id })
    }

    case 'REQUEST_APPROVAL': {
      // The engine blocks the whole run until a matching approval exists, so reaching here means it was granted.
      if (!ctx.approvalId) return fail('No approval is attached to this run')
      return ok(`Approval ${ctx.approvalId} granted`)
    }

    case 'UPDATE_PROJECT_STATUS': {
      if (!ctx.approvalId) return fail('Project status changes require an approval')
      const projectId = ctx.event.subjectType === 'Project' ? ctx.event.subjectId : (typeof ctx.event.payload.projectId === 'string' ? ctx.event.payload.projectId : null)
      if (!projectId) return fail('No project is linked to this event')
      if (ctx.tenantId !== DEFAULT_TENANT_ID) return fail('Projects are only available in the default tenant')
      const project = await db.project.findUnique({ where: { id: projectId }, select: { id: true, status: true } })
      if (!project) return fail('Project not found')
      if (project.status === p.status) return ok(`Project already ${project.status}`)
      await db.project.update({ where: { id: project.id }, data: { status: String(p.status) } })
      return ok(`Project ${project.status} → ${p.status}`)
    }

    case 'N8N_EXECUTE': {
      const { requestN8nExecution, N8nWorkflowNotFoundError } = await import('@/lib/n8n/adapter')
      try {
        const exec = await requestN8nExecution({
          tenantId: ctx.tenantId,
          workflowCode: String(p.workflowCode),
          payload: { trigger: ctx.event.type, subjectType: ctx.event.subjectType, subjectId: ctx.event.subjectId, data: ctx.event.payload },
          automationRunId: ctx.runId,
          requestedBy: `automation:${ctx.ruleKey}`,
        })
        if (exec.status === 'ACCEPTED') return { status: 'WAITING', detail: `n8n accepted execution ${exec.correlationId}; waiting for its callback`, output: { correlationId: exec.correlationId } }
        if (exec.status === 'NOT_CONFIGURED' || exec.status === 'DISABLED') return fail(exec.error ?? exec.status)
        return fail(exec.error ?? 'n8n request failed', true)
      } catch (error) {
        if (error instanceof N8nWorkflowNotFoundError) return fail(error.message)
        throw error
      }
    }

    default:
      return fail(`Action ${(action as { type: string }).type} has no executor`)
  }
}
