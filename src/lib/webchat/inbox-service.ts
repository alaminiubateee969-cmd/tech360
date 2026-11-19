// ============================================================
// TECH360 — WebChat inbox service (single implementation)
// ============================================================
// Every conversation operation used by the operator console, the visitor
// routes and the automation engine goes through this module, so assignment,
// escalation, notes, replies and state changes behave identically wherever
// they start. Each operation persists, writes an operator-visible timeline
// event, audits the actor and emits an automation event.
// ============================================================

import { createHash } from 'node:crypto'
import { db } from '@/lib/db'
import { audit } from '@/lib/security'
import { DEFAULT_TENANT_ID } from '@/lib/tenancy'
import { canTransition, isPriority, isTeam, type InboxState, type Priority, type Team } from '@/lib/webchat/policy'

export type Actor =
  | { kind: 'USER'; id: string; email: string; ip?: string }
  | { kind: 'AUTOMATION'; ruleKey: string; runId: string }
  | { kind: 'VISITOR'; anonId: string }

export type Conversation = NonNullable<Awaited<ReturnType<typeof db.chatConversation.findUnique>>>

export class InboxError extends Error {
  readonly code: string
  readonly status: number
  constructor(code: string, message: string, status = 400) {
    super(message)
    this.name = 'InboxError'
    this.code = code
    this.status = status
  }
}

function actorLabel(actor: Actor): string {
  if (actor.kind === 'USER') return actor.email
  if (actor.kind === 'AUTOMATION') return `automation:${actor.ruleKey}`
  return 'visitor'
}

function isUniqueConflict(error: unknown): boolean {
  return Boolean(error && typeof error === 'object' && 'code' in error && (error as { code?: unknown }).code === 'P2002')
}

/** Tenant-scoped lookup. Another tenant's id is indistinguishable from a missing id. */
export async function getConversationForTenant(id: string, tenantId: string): Promise<Conversation | null> {
  const row = await db.chatConversation.findUnique({ where: { id } })
  if (!row) return null
  return (row.tenantId || DEFAULT_TENANT_ID) === tenantId ? row : null
}

async function timelineEvent(conversationId: string, body: string, opts: { internal: boolean; touch?: boolean }) {
  const msg = await db.chatMessage.create({
    data: { conversationId, sender: 'SYSTEM', kind: 'EVENT', internal: opts.internal, body: body.slice(0, 1000) },
  })
  if (opts.touch) {
    await db.chatConversation.update({
      where: { id: conversationId },
      data: { lastMessageAt: new Date(), lastMessagePreview: body.slice(0, 120), lastSender: 'SYSTEM' },
    })
  }
  return msg
}

async function emit(conversation: Conversation, type: Parameters<typeof import('@/lib/automation/engine').emitAutomationEvent>[0]['type'], payload: Record<string, unknown>, dedupeKey: string, depth = 0) {
  const { emitAutomationEvent } = await import('@/lib/automation/engine')
  await emitAutomationEvent({
    tenantId: conversation.tenantId || DEFAULT_TENANT_ID,
    type,
    source: 'WEBCHAT',
    subjectType: 'ChatConversation',
    subjectId: conversation.id,
    payload: { conversationId: conversation.id, clientRowId: conversation.clientId, ...payload },
    dedupeKey,
    depth,
  }).catch(() => null)
}

async function linkedClient(conversation: Conversation) {
  if (!conversation.clientId) return null
  const c = await db.client.findUnique({ where: { id: conversation.clientId }, select: { id: true, clientId: true, deletedAt: true } }).catch(() => null)
  return c && !c.deletedAt ? c : null
}

async function setTakeover(conversation: Conversation, on: boolean) {
  const client = await linkedClient(conversation)
  if (!client) return
  const { setHumanTakeover } = await import('@/lib/conversation-state')
  await setHumanTakeover(client.id, client.clientId, on).catch(() => null)
}

// ------------------------------------------------------------
// Assignment / transfer / priority
// ------------------------------------------------------------
export async function assignConversation(input: {
  conversation: Conversation
  assigneeId: string | null
  team?: Team | null
  actor: Actor
  depth?: number
}) {
  const { conversation, actor } = input
  if (input.team !== undefined && input.team !== null && !isTeam(input.team)) throw new InboxError('BAD_TEAM', 'Unknown team.')
  let assignee: { id: string; email: string } | null = null
  if (input.assigneeId) {
    const user = await db.user.findUnique({ where: { id: input.assigneeId }, select: { id: true, email: true, isActive: true, tenantId: true } })
    if (!user || !user.isActive || (user.tenantId || DEFAULT_TENANT_ID) !== (conversation.tenantId || DEFAULT_TENANT_ID)) {
      throw new InboxError('ASSIGNEE_NOT_FOUND', 'That team member does not exist or is inactive.', 404)
    }
    assignee = { id: user.id, email: user.email }
  }
  const team = input.team === undefined ? conversation.team : input.team
  if (assignee?.id === conversation.assignedToId && team === conversation.team) {
    return { changed: false, conversation }
  }
  const updated = await db.chatConversation.update({
    where: { id: conversation.id },
    data: {
      assignedToId: assignee?.id ?? null,
      assignedToEmail: assignee?.email ?? null,
      assignedAt: assignee ? new Date() : null,
      team: team ?? null,
    },
  })
  const parts = [
    assignee ? `Assigned to ${assignee.email}` : 'Unassigned',
    team && team !== conversation.team ? `team ${team}` : null,
  ].filter(Boolean)
  await timelineEvent(conversation.id, `${parts.join(' · ')} by ${actorLabel(actor)}`, { internal: true })
  if (actor.kind === 'USER') {
    await audit({ actor: actor.email, action: conversation.assignedToId && assignee ? 'CHAT_TRANSFERRED' : 'CHAT_ASSIGNED', userId: actor.id, entityType: 'ChatConversation', entityId: conversation.id, details: { from: conversation.assignedToEmail, to: assignee?.email ?? null, team }, ip: actor.ip })
  }
  return { changed: true, conversation: updated }
}

export async function setConversationPriority(input: { conversation: Conversation; priority: Priority; actor: Actor }) {
  if (!isPriority(input.priority)) throw new InboxError('BAD_PRIORITY', 'Unknown priority.')
  if (input.conversation.priority === input.priority) return { changed: false, conversation: input.conversation }
  const updated = await db.chatConversation.update({ where: { id: input.conversation.id }, data: { priority: input.priority } })
  await timelineEvent(input.conversation.id, `Priority ${input.conversation.priority} → ${input.priority} by ${actorLabel(input.actor)}`, { internal: true })
  if (input.actor.kind === 'USER') {
    await audit({ actor: input.actor.email, action: 'CHAT_PRIORITY_SET', userId: input.actor.id, entityType: 'ChatConversation', entityId: input.conversation.id, details: { from: input.conversation.priority, to: input.priority }, ip: input.actor.ip })
  }
  return { changed: true, conversation: updated }
}

// ------------------------------------------------------------
// Inbox state (OPEN | PENDING | ESCALATED | RESOLVED)
// ------------------------------------------------------------
export async function transitionConversation(input: {
  conversation: Conversation
  to: InboxState
  actor: Actor
  reason?: string
  depth?: number
}) {
  const { conversation, to, actor } = input
  if (!canTransition(conversation.inboxState, to)) {
    throw new InboxError('INVALID_TRANSITION', `A ${conversation.inboxState.toLowerCase()} conversation cannot move to ${to.toLowerCase()}.`, 409)
  }
  const now = new Date()
  const data: Record<string, unknown> = { inboxState: to }
  if (to === 'ESCALATED') {
    data.escalatedAt = now
    data.escalationReason = (input.reason || 'Escalated').slice(0, 1000)
    if (conversation.priority === 'LOW' || conversation.priority === 'NORMAL') data.priority = 'HIGH'
  }
  if (to === 'RESOLVED') { data.resolvedAt = now; data.resolvedBy = actorLabel(actor) }
  if (to === 'OPEN' && conversation.inboxState === 'RESOLVED') { data.resolvedAt = null; data.resolvedBy = null }

  // Conditional write: a concurrent transition cannot be silently overwritten.
  const moved = await db.chatConversation.updateMany({ where: { id: conversation.id, inboxState: conversation.inboxState }, data })
  if (moved.count === 0) throw new InboxError('CONFLICT', 'The conversation changed meanwhile. Refresh and try again.', 409)
  const updated = await db.chatConversation.findUniqueOrThrow({ where: { id: conversation.id } })

  const visitorText = to === 'ESCALATED'
    ? 'Your conversation has been passed to a TECH360 team member. Automated replies are paused.'
    : to === 'RESOLVED'
      ? 'This conversation was marked as resolved. Reply here any time if you need more help.'
      : null
  await timelineEvent(conversation.id, `State ${conversation.inboxState} → ${to} by ${actorLabel(actor)}${input.reason ? ` — ${input.reason}` : ''}`, { internal: true })
  if (visitorText) await timelineEvent(conversation.id, visitorText, { internal: false, touch: true })
  if (to === 'ESCALATED') await setTakeover(conversation, true)

  if (actor.kind === 'USER') {
    await audit({ actor: actor.email, action: `CHAT_STATE_${to}`, userId: actor.id, entityType: 'ChatConversation', entityId: conversation.id, details: { from: conversation.inboxState, to, reason: input.reason ?? null }, ip: actor.ip })
  }
  const depth = (input.depth ?? 0) + (actor.kind === 'AUTOMATION' ? 1 : 0)
  await emit(updated, 'CONVERSATION_STATUS_CHANGED', { from: conversation.inboxState, to, actor: actorLabel(actor) }, `conv_state:${conversation.id}:${to}:${now.getTime()}`, depth)
  if (to === 'ESCALATED') {
    await emit(updated, 'CONVERSATION_ESCALATED', { reason: input.reason ?? null, priority: updated.priority, actor: actorLabel(actor) }, `conv_escalated:${conversation.id}:${now.getTime()}`, depth)
  }
  return { changed: true, conversation: updated }
}

// ------------------------------------------------------------
// Notes and replies
// ------------------------------------------------------------
export async function addInternalNote(input: { conversation: Conversation; body: string; actor: Extract<Actor, { kind: 'USER' }> }) {
  const body = input.body.trim()
  if (!body) throw new InboxError('BODY_REQUIRED', 'Note text is required.')
  if (body.length > 4000) throw new InboxError('BODY_TOO_LONG', 'Notes are limited to 4000 characters.')
  const note = await db.chatMessage.create({
    data: { conversationId: input.conversation.id, sender: 'ADMIN', kind: 'NOTE', internal: true, body, agentEmail: input.actor.email },
  })
  await audit({ actor: input.actor.email, action: 'CHAT_NOTE_ADDED', userId: input.actor.id, entityType: 'ChatConversation', entityId: input.conversation.id, details: { messageId: note.id, length: body.length }, ip: input.actor.ip })
  return note
}

/**
 * Human operator reply. Idempotent per requestId: a retried submit returns the
 * original message instead of sending twice.
 */
/** Create a message once per client request id; a concurrent duplicate returns the stored row. */
async function createOnce<T>(requestId: string | null, create: () => Promise<T>): Promise<{ message: T; duplicate: false } | { message: Awaited<ReturnType<typeof db.chatMessage.findUniqueOrThrow>>; duplicate: true }> {
  try {
    return { message: await create(), duplicate: false }
  } catch (error) {
    if (!isUniqueConflict(error) || !requestId) throw error
    return { message: await db.chatMessage.findUniqueOrThrow({ where: { clientRequestId: requestId } }), duplicate: true }
  }
}

export async function operatorReply(input: {
  conversation: Conversation
  body: string
  requestId: string | null
  actor: Extract<Actor, { kind: 'USER' }>
  attachment?: { id: string; name: string; mime: string; size: number } | null
}) {
  const { conversation, actor } = input
  const body = input.body.trim()
  if (!body && !input.attachment) throw new InboxError('BODY_REQUIRED', 'Reply body is required.')
  if (body.length > 4000) throw new InboxError('BODY_TOO_LONG', 'Reply is too long (4000 characters max).')
  if (conversation.status !== 'OPEN') throw new InboxError('CONVERSATION_CLOSED', 'The visitor closed this conversation — reopen it to reply.', 409)
  if (conversation.inboxState === 'RESOLVED') throw new InboxError('CONVERSATION_RESOLVED', 'This conversation is resolved — reopen it to reply.', 409)

  if (input.requestId) {
    const prior = await db.chatMessage.findUnique({ where: { clientRequestId: input.requestId } })
    if (prior) {
      if (prior.conversationId !== conversation.id) throw new InboxError('REQUEST_ID_CONFLICT', 'This request id belongs to another conversation.', 409)
      return { message: prior, duplicate: true }
    }
  }
  const att = input.attachment ?? null
  const created = await createOnce(input.requestId, () => db.chatMessage.create({
    data: {
      conversationId: conversation.id,
      clientRequestId: input.requestId,
      sender: 'ADMIN',
      body: body || `Shared a file: ${att?.name ?? 'attachment'}`,
      agentEmail: actor.email,
      aiGenerated: false,
      deliveryStatus: 'SENT',
      attachmentId: att?.id ?? null, attachmentName: att?.name ?? null, attachmentMime: att?.mime ?? null, attachmentSize: att?.size ?? null,
    },
  }))
  if (created.duplicate) return created
  const message = created.message
  await db.chatConversation.update({
    where: { id: conversation.id },
    data: {
      lastMessageAt: new Date(),
      lastMessagePreview: message.body.slice(0, 120),
      lastSender: 'ADMIN',
      unreadCount: 0,
      agentTypingAt: null,
      ...(conversation.firstResponseAt ? {} : { firstResponseAt: new Date() }),
      ...(conversation.assignedToId ? {} : { assignedToId: actor.id, assignedToEmail: actor.email, assignedAt: new Date() }),
    },
  })
  if (conversation.clientId) {
    await db.communication.create({
      data: {
        clientId: conversation.clientId,
        channel: 'WEB',
        direction: 'OUT',
        sender: actor.email,
        recipient: conversation.visitorEmail ?? conversation.visitorName ?? conversation.anonId,
        subject: conversation.subject,
        body: message.body,
        status: 'SENT',
        providerMessageId: `chatmsg:${message.id}`,
        metadata: JSON.stringify({ conversationId: conversation.id, source: 'LIVE_CHAT', author: 'HUMAN' }),
      },
    }).catch(() => null)
  }
  // A human reply claims the conversation so the AI never talks over a colleague.
  await setTakeover(conversation, true)
  await audit({ actor: actor.email, action: 'CHAT_REPLY', userId: actor.id, entityType: 'ChatConversation', entityId: conversation.id, details: { messageId: message.id, length: body.length, attachment: Boolean(input.attachment) }, ip: actor.ip })
  return { message, duplicate: false }
}

/** Automation-posted reply from an operator-approved template. Idempotent per run step. */
export async function automationReply(input: { conversation: Conversation; text: string; ruleKey: string; idempotencyKey: string }) {
  const requestId = `auto_${createHash('sha256').update(input.idempotencyKey).digest('hex').slice(0, 40)}`
  const prior = await db.chatMessage.findUnique({ where: { clientRequestId: requestId } })
  if (prior) return { message: prior, duplicate: true }
  if (input.conversation.status !== 'OPEN') throw new InboxError('CONVERSATION_CLOSED', 'The conversation is closed; the template was not posted.', 409)
  const message = await db.chatMessage.create({
    data: {
      conversationId: input.conversation.id,
      clientRequestId: requestId,
      sender: 'ADMIN',
      body: input.text.slice(0, 1000),
      agentEmail: `automation:${input.ruleKey}`,
      aiGenerated: false,
    },
  })
  await db.chatConversation.update({ where: { id: input.conversation.id }, data: { lastMessageAt: new Date(), lastMessagePreview: message.body.slice(0, 120), lastSender: 'ADMIN' } })
  if (input.conversation.clientId) {
    await db.communication.create({
      data: {
        clientId: input.conversation.clientId, channel: 'WEB', direction: 'OUT', sender: `automation:${input.ruleKey}`,
        recipient: input.conversation.visitorEmail ?? input.conversation.visitorName ?? input.conversation.anonId,
        body: message.body, status: 'SENT', providerMessageId: `chatmsg:${message.id}`, workflowId: input.idempotencyKey.slice(0, 190),
        metadata: JSON.stringify({ conversationId: input.conversation.id, source: 'AUTOMATION', author: 'TEMPLATE' }),
      },
    }).catch(() => null)
  }
  return { message, duplicate: false }
}

// ------------------------------------------------------------
// Visitor-initiated operations
// ------------------------------------------------------------
export async function visitorRequestHuman(conversation: Conversation, note?: string) {
  if (conversation.status !== 'OPEN') throw new InboxError('CONVERSATION_CLOSED', 'This conversation is closed. Start a new one to reach the team.', 409)
  if (conversation.humanRequestedAt && conversation.inboxState === 'ESCALATED') return { changed: false, conversation }
  await db.chatConversation.update({ where: { id: conversation.id }, data: { humanRequestedAt: new Date() } })
  const fresh = await db.chatConversation.findUniqueOrThrow({ where: { id: conversation.id } })
  let result: { changed: boolean; conversation: Conversation } = { changed: true, conversation: fresh }
  if (fresh.inboxState !== 'ESCALATED') {
    result = await transitionConversation({ conversation: fresh, to: 'ESCALATED', actor: { kind: 'VISITOR', anonId: conversation.anonId }, reason: note ? `Visitor asked for a human: ${note.slice(0, 200)}` : 'Visitor asked for a human' })
  } else {
    await setTakeover(fresh, true)
  }
  await emit(result.conversation, 'HUMAN_REQUESTED', { note: note?.slice(0, 300) ?? null }, `human_requested:${conversation.id}:${Date.now()}`)
  const { createNotification } = await import('@/lib/notify')
  await createNotification({ type: 'LEAD', title: 'Visitor asked for a human in WebChat', body: `${conversation.visitorName || 'A visitor'} is waiting for a team member.`, severity: 'WARNING', link: 'chat' })
  return result
}

export async function visitorCloseConversation(conversation: Conversation) {
  if (conversation.status === 'CLOSED') return { changed: false, conversation }
  const updated = await db.chatConversation.update({ where: { id: conversation.id }, data: { status: 'CLOSED', closedAt: new Date(), closedBy: 'VISITOR', visitorTypingAt: null } })
  await timelineEvent(conversation.id, 'The visitor ended this conversation.', { internal: false, touch: true })
  return { changed: true, conversation: updated }
}

export async function visitorReopenConversation(conversation: Conversation) {
  if (conversation.status === 'OPEN') return { changed: false, conversation }
  // A visitor may reopen only their own conversation closed by themselves; operator-closed threads stay closed.
  if (conversation.closedBy && conversation.closedBy !== 'VISITOR') {
    throw new InboxError('CLOSED_BY_TEAM', 'This conversation was closed by our team. Please start a new conversation.', 409)
  }
  const updated = await db.chatConversation.update({
    where: { id: conversation.id },
    data: { status: 'OPEN', closedAt: null, closedBy: null, ...(conversation.inboxState === 'RESOLVED' ? { inboxState: 'OPEN', resolvedAt: null, resolvedBy: null } : {}) },
  })
  await timelineEvent(conversation.id, 'The visitor reopened this conversation.', { internal: false, touch: true })
  return { changed: true, conversation: updated }
}

// ------------------------------------------------------------
// Delivery / read / typing
// ------------------------------------------------------------
/** Mark team/AI messages as DELIVERED once the visitor's browser has fetched them. */
export async function markDeliveredToVisitor(conversationId: string, upToIds: string[]) {
  if (upToIds.length === 0) return 0
  const r = await db.chatMessage.updateMany({
    where: { conversationId, id: { in: upToIds }, sender: { in: ['ADMIN', 'SYSTEM'] }, internal: false, deliveryStatus: 'SENT' },
    data: { deliveryStatus: 'DELIVERED', deliveredAt: new Date() },
  })
  return r.count
}

/** The visitor had the thread open and focused: everything from the team is READ. */
export async function markReadByVisitor(conversationId: string) {
  const now = new Date()
  const r = await db.chatMessage.updateMany({
    where: { conversationId, sender: { in: ['ADMIN', 'SYSTEM'] }, internal: false, deliveryStatus: { in: ['SENT', 'DELIVERED'] } },
    data: { deliveryStatus: 'READ', readAt: now },
  })
  await db.chatConversation.update({ where: { id: conversationId }, data: { visitorReadAt: now } })
  return r.count
}

/** An operator opened the thread: visitor messages are READ by the team. */
export async function markReadByTeam(conversationId: string) {
  const now = new Date()
  const r = await db.chatMessage.updateMany({
    where: { conversationId, sender: 'VISITOR', deliveryStatus: { in: ['SENT', 'DELIVERED'] } },
    data: { deliveryStatus: 'READ', readAt: now },
  })
  return r.count
}

export async function setTyping(conversationId: string, who: 'VISITOR' | 'AGENT', typing: boolean, agentName?: string) {
  await db.chatConversation.update({
    where: { id: conversationId },
    data: who === 'VISITOR'
      ? { visitorTypingAt: typing ? new Date() : null }
      : { agentTypingAt: typing ? new Date() : null, agentTypingName: typing ? (agentName ?? 'TECH360 team').slice(0, 80) : null },
  })
}
