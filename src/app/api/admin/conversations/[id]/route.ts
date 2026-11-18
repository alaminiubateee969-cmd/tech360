import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { guard, isResponse } from '@/lib/api-guard'
import { readJson, sanitizeText, audit } from '@/lib/security'
import { nextClientId } from '@/lib/ids'
import { hasCapability } from '@/lib/access-policy'
import { DEFAULT_TENANT_ID, tenantOf } from '@/lib/tenancy'
import { VISITOR_VISIBLE_WHERE, toOperatorMessage, isPriority, isTeam } from '@/lib/webchat/policy'
import {
  addInternalNote,
  assignConversation,
  getConversationForTenant,
  InboxError,
  markReadByTeam,
  operatorReply,
  setConversationPriority,
  setTyping,
  transitionConversation,
} from '@/lib/webchat/inbox-service'

export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ id: string }> }

type GuardUser = { id: string; email: string; role: string; tenantId?: string }

/** CRM profile + activity timeline for the linked customer (follows merge pointers). */
async function crmProfile(clientRowId: string | null) {
  if (!clientRowId) return null
  let client = await db.client.findUnique({ where: { id: clientRowId }, include: { lead: true } })
  if (client?.mergedIntoId) {
    const target = await db.client.findUnique({ where: { id: client.mergedIntoId }, include: { lead: true } })
    if (target) client = target
  }
  if (!client || client.deletedAt) return null
  const [communications, audits, otherConversations, projects] = await Promise.all([
    db.communication.findMany({
      where: { clientId: client.id },
      orderBy: { createdAt: 'desc' },
      take: 25,
      select: { id: true, channel: true, direction: true, status: true, subject: true, body: true, createdAt: true, agentCode: true },
    }),
    db.auditLog.findMany({
      where: { OR: [{ clientId: client.clientId }, { entityType: 'Client', entityId: client.id }] },
      orderBy: { createdAt: 'desc' },
      take: 15,
      select: { id: true, action: true, actor: true, createdAt: true },
    }),
    db.chatConversation.findMany({
      where: { clientId: client.id },
      orderBy: { lastMessageAt: 'desc' },
      take: 10,
      select: { id: true, status: true, inboxState: true, lastMessageAt: true, subject: true },
    }),
    db.project.findMany({ where: { clientId: client.id }, select: { id: true, name: true, status: true }, take: 5 }).catch(() => []),
  ])
  const timeline = [
    ...communications.map((c) => ({ at: c.createdAt, kind: 'COMMUNICATION', title: `${c.channel} ${c.direction === 'IN' ? 'received' : 'sent'} · ${c.status}`, detail: (c.subject || c.body).slice(0, 160) })),
    ...audits.map((a) => ({ at: a.createdAt, kind: 'ACTIVITY', title: a.action, detail: a.actor })),
  ].sort((a, b) => b.at.getTime() - a.at.getTime()).slice(0, 30)
  return {
    rowId: client.id,
    clientId: client.clientId,
    name: client.name,
    businessName: client.businessName,
    businessType: client.businessType,
    email: client.email,
    phone: client.phone,
    whatsapp: client.whatsapp,
    status: client.status,
    pipelineStage: client.pipelineStage,
    source: client.source,
    createdAt: client.createdAt,
    lead: client.lead ? { requirements: client.lead.requirements, interest: client.lead.interest, budgetRange: client.lead.budgetRange, sourceDetails: client.lead.sourceDetails } : null,
    conversations: otherConversations,
    projects,
    timeline,
  }
}

// ADMIN — open a conversation: full operator thread (incl. internal notes),
// CRM profile + timeline; resets unreadCount and marks visitor messages READ.
export async function GET(req: NextRequest, { params }: Ctx) {
  const g = await guard(req, { minRole: 'STAFF', capability: 'crm.read' })
  if (isResponse(g)) return g
  const { id } = await params
  const conversationId = sanitizeText(id, 40)
  const tenantId = tenantOf(g.user as GuardUser)

  const scoped = await getConversationForTenant(conversationId, tenantId)
  if (!scoped) return Response.json({ error: 'Conversation not found', code: 'NOT_FOUND' }, { status: 404 })
  const conversation = await db.chatConversation.findUniqueOrThrow({
    where: { id: conversationId },
    include: { _count: { select: { messages: true } } },
  })

  const messages = await db.chatMessage.findMany({
    where: { conversationId },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
  })

  if (conversation.unreadCount > 0) {
    await db.chatConversation.update({ where: { id: conversationId }, data: { unreadCount: 0 } })
    conversation.unreadCount = 0
  }
  await markReadByTeam(conversationId).catch(() => 0)

  const profile = await crmProfile(conversation.clientId)

  return Response.json({
    conversation: {
      id: conversation.id,
      anonId: conversation.anonId,
      clientId: profile?.clientId ?? null,
      status: conversation.status,
      inboxState: conversation.inboxState,
      priority: conversation.priority,
      team: conversation.team,
      assignedToId: conversation.assignedToId,
      assignedToEmail: conversation.assignedToEmail,
      escalatedAt: conversation.escalatedAt,
      escalationReason: conversation.escalationReason,
      humanRequested: Boolean(conversation.humanRequestedAt),
      resolvedAt: conversation.resolvedAt,
      firstResponseAt: conversation.firstResponseAt,
      aiLanguage: conversation.aiLanguage,
      aiIntent: conversation.aiIntent,
      aiBusinessType: conversation.aiBusinessType,
      aiSummary: conversation.aiSummary,
      visitorName: conversation.visitorName,
      visitorEmail: conversation.visitorEmail,
      visitorPhone: conversation.visitorPhone,
      subject: conversation.subject,
      lastMessagePreview: conversation.lastMessagePreview,
      lastMessageAt: conversation.lastMessageAt,
      lastSender: conversation.lastSender,
      unreadCount: conversation.unreadCount,
      createdAt: conversation.createdAt,
      updatedAt: conversation.updatedAt,
      messageCount: conversation._count.messages,
    },
    messages: messages.map(toOperatorMessage),
    crm: profile,
  })
}

const ACTION_CAPABILITY: Record<string, 'comms.send' | 'crm.write'> = {
  reply: 'comms.send', note: 'comms.send', typing: 'comms.send', assign: 'comms.send', transfer: 'comms.send',
  priority: 'comms.send', escalate: 'comms.send', pending: 'comms.send', resolve: 'comms.send', reopen: 'comms.send',
  close: 'comms.send', takeover: 'comms.send', release: 'comms.send', suggest: 'comms.send', triage: 'comms.send',
  'convert-to-lead': 'crm.write', 'link-client': 'crm.write',
}

// ADMIN — actions on a conversation:
// reply | note | typing | assign | transfer | priority | escalate | pending | resolve | reopen |
// close | takeover | release | suggest | triage | convert-to-lead | link-client
export async function POST(req: NextRequest, { params }: Ctx) {
  const g = await guard(req, { minRole: 'STAFF' })
  if (isResponse(g)) return g
  const { id } = await params
  const conversationId = sanitizeText(id, 40)
  const raw = await readJson(req)
  const action = sanitizeText(raw.action, 40).toLowerCase()
  const body = sanitizeText(raw.body, 4000)
  const user = g.user as GuardUser
  const tenantId = tenantOf(user)

  const capability = ACTION_CAPABILITY[action]
  if (!capability) return Response.json({ error: 'Unknown action.', code: 'BAD_ACTION' }, { status: 400 })
  if (!hasCapability(user, capability)) return Response.json({ error: `Forbidden (requires capability ${capability})`, code: 'FORBIDDEN' }, { status: 403 })

  const conversation = await getConversationForTenant(conversationId, tenantId)
  if (!conversation) return Response.json({ error: 'Conversation not found', code: 'NOT_FOUND' }, { status: 404 })
  const actor = { kind: 'USER' as const, id: user.id, email: user.email, ip: g.ip }

  try {
    // ---------------- reply (idempotent per requestId; delegated to the inbox service) ----------------
    if (action === 'reply') {
      const requestId = sanitizeText(raw.requestId, 64) || null
      const attachment = raw.attachment && typeof raw.attachment === 'object' ? raw.attachment as Record<string, unknown> : null
      let attachmentRef: { id: string; name: string; mime: string; size: number } | null = null
      if (attachment?.id) {
        const file = await db.fileRecord.findUnique({ where: { id: sanitizeText(attachment.id, 40) } })
        if (!file || file.relatedType !== 'CHAT_ATTACHMENT' || file.relatedId !== conversation.id || file.scanStatus !== 'CLEAN') {
          return Response.json({ error: 'Attachment not found for this conversation.', code: 'ATTACHMENT_NOT_FOUND' }, { status: 404 })
        }
        attachmentRef = { id: file.id, name: file.originalName, mime: file.mimeType, size: file.size }
      }
      const r = await operatorReply({ conversation, body, requestId, actor, attachment: attachmentRef })
      return Response.json({ ok: true, duplicate: r.duplicate, message: toOperatorMessage(r.message) })
    }
    if (action === 'note') {
      const note = await addInternalNote({ conversation, body, actor })
      return Response.json({ ok: true, message: toOperatorMessage(note) })
    }
    if (action === 'typing') {
      await setTyping(conversation.id, 'AGENT', raw.typing === true, user.email.split('@')[0])
      return Response.json({ ok: true })
    }
    if (action === 'assign' || action === 'transfer') {
      const target = sanitizeText(raw.assigneeId, 40)
      const assigneeId = target === 'me' ? user.id : target || null
      const teamRaw = raw.team === undefined ? undefined : sanitizeText(raw.team, 20).toUpperCase()
      if (teamRaw && !isTeam(teamRaw)) return Response.json({ error: 'Unknown team.', code: 'BAD_TEAM' }, { status: 400 })
      const r = await assignConversation({ conversation, assigneeId, team: teamRaw === undefined ? undefined : (teamRaw || null) as never, actor })
      return Response.json({ ok: true, changed: r.changed, assignedToId: r.conversation.assignedToId, assignedToEmail: r.conversation.assignedToEmail, team: r.conversation.team })
    }
    if (action === 'priority') {
      const priority = sanitizeText(raw.priority, 10).toUpperCase()
      if (!isPriority(priority)) return Response.json({ error: 'Unknown priority.', code: 'BAD_PRIORITY' }, { status: 400 })
      const r = await setConversationPriority({ conversation, priority, actor })
      return Response.json({ ok: true, changed: r.changed, priority: r.conversation.priority })
    }
    if (action === 'escalate' || action === 'pending' || action === 'resolve' || (action === 'reopen' && conversation.inboxState === 'RESOLVED' && conversation.status === 'OPEN')) {
      const to = action === 'escalate' ? 'ESCALATED' : action === 'pending' ? 'PENDING' : action === 'resolve' ? 'RESOLVED' : 'OPEN'
      const r = await transitionConversation({ conversation, to, actor, reason: body || undefined })
      return Response.json({ ok: true, inboxState: r.conversation.inboxState, priority: r.conversation.priority })
    }
    if (action === 'suggest') {
      const { suggestReplies } = await import('@/lib/ai-support/assist')
      const result = await suggestReplies(conversation.id, tenantId)
      await audit({ actor: user.email, action: 'CHAT_AI_SUGGEST', userId: user.id, entityType: 'ChatConversation', entityId: conversation.id, details: { status: result.status }, ip: g.ip })
      return Response.json({ ok: true, result })
    }
    if (action === 'triage') {
      const { triageConversation } = await import('@/lib/ai-support/assist')
      const triage = await triageConversation(conversation.id)
      return Response.json({ ok: true, triage })
    }
  } catch (error) {
    if (error instanceof InboxError) return Response.json({ error: error.message, code: error.code }, { status: error.status })
    throw error
  }

  // ---------------- takeover / release ----------------
  if (action === 'takeover' || action === 'release') {
    if (!conversation.clientId) {
      return Response.json({ error: 'This conversation has no linked Client ID yet — reply once to link it.' }, { status: 400 })
    }
    const linkedClient = await db.client.findUnique({
      where: { id: conversation.clientId },
      select: { id: true, clientId: true, deletedAt: true },
    })
    if (!linkedClient || linkedClient.deletedAt) {
      return Response.json({ error: 'Linked client record is not available.' }, { status: 400 })
    }
    const { setHumanTakeover } = await import('@/lib/conversation-state')
    const takeOver = action === 'takeover'
    await setHumanTakeover(linkedClient.id, linkedClient.clientId, takeOver)
    const sys = await db.chatMessage.create({
      data: {
        conversationId,
        sender: 'SYSTEM',
        body: takeOver
          ? `A TECH360 team member has joined this conversation. Automated replies are paused until the team releases it.`
          : `Automated assistant replies are enabled again for this conversation.`,
      },
    })
    await db.chatConversation.update({
      where: { id: conversationId },
      data: { lastMessageAt: new Date(), lastMessagePreview: sys.body.slice(0, 120), lastSender: 'SYSTEM' },
    })
    await audit({
      actor: g.user.email,
      action: takeOver ? 'CHAT_TAKEOVER' : 'CHAT_TAKEOVER_RELEASED',
      userId: g.user.id,
      entityType: 'ChatConversation',
      entityId: conversationId,
      ip: g.ip,
    })
    return Response.json({ ok: true, humanTakeover: takeOver, messageId: sys.id })
  }

  // ---------------- close ----------------
  if (action === 'close') {
    const now = new Date()
    await db.chatConversation.update({ where: { id: conversationId }, data: { status: 'CLOSED', closedAt: now, closedBy: g.user.email, agentTypingAt: null } })
    if (conversation.clientId) {
      const linked = await db.client.findUnique({
        where: { id: conversation.clientId },
        select: { id: true, clientId: true },
      }).catch(() => null)
      if (linked) {
        const { setClosed } = await import('@/lib/conversation-state')
        await setClosed(linked.id, linked.clientId, true).catch(() => null)
      }
    }
    const sys = await db.chatMessage.create({
      data: { conversationId, sender: 'SYSTEM', body: `Conversation closed by ${g.user.email}` },
    })
    await db.chatConversation.update({ where: { id: conversationId }, data: { lastMessageAt: now, lastMessagePreview: sys.body.slice(0, 120), lastSender: 'SYSTEM' } })
    await audit({
      actor: g.user.email,
      action: 'CHAT_CLOSED',
      userId: g.user.id,
      entityType: 'ChatConversation',
      entityId: conversationId,
      ip: g.ip,
    })
    return Response.json({ ok: true, status: 'CLOSED', messageId: sys.id })
  }

  // ---------------- reopen ----------------
  if (action === 'reopen') {
    const now = new Date()
    if (conversation.status === 'OPEN') {
      return Response.json({ error: 'This conversation is already open.', code: 'ALREADY_OPEN' }, { status: 409 })
    }
    await db.chatConversation.update({ where: { id: conversationId }, data: { status: 'OPEN', closedAt: null, closedBy: null, ...(conversation.inboxState === 'RESOLVED' ? { inboxState: 'OPEN', resolvedAt: null, resolvedBy: null } : {}) } })
    const sys = await db.chatMessage.create({
      data: { conversationId, sender: 'SYSTEM', body: `Conversation reopened by ${g.user.email}` },
    })
    await db.chatConversation.update({ where: { id: conversationId }, data: { lastMessageAt: now, lastMessagePreview: sys.body.slice(0, 120), lastSender: 'SYSTEM' } })
    await audit({
      actor: g.user.email,
      action: 'CHAT_REOPENED',
      userId: g.user.id,
      entityType: 'ChatConversation',
      entityId: conversationId,
      ip: g.ip,
    })
    return Response.json({ ok: true, status: 'OPEN', messageId: sys.id })
  }

  // ---------------- convert-to-lead ----------------
  if (action === 'convert-to-lead') {
    // CRM customer records exist in the primary workspace only; never create a
    // default-tenant client from another tenant's conversation.
    if (tenantId !== DEFAULT_TENANT_ID) {
      return Response.json({ error: 'CRM records are available in the primary workspace only.', code: 'CRM_TENANT_UNSUPPORTED' }, { status: 409 })
    }
    // Idempotency: if this conversation was already converted to a CRM client,
    // follow any merge pointer and return the existing canonical TECH-YYYY-NNNNNN ID
    // instead of creating a duplicate Client record.
    if (conversation.clientId) {
      const existing = await db.client.findUnique({
        where: { id: conversation.clientId },
        select: { id: true, clientId: true, mergedIntoId: true },
      })
      if (existing) {
        if (existing.mergedIntoId) {
          const merged = await db.client.findUnique({
            where: { id: existing.mergedIntoId },
            select: { clientId: true },
          })
          if (merged) {
            return Response.json({ ok: true, clientId: merged.clientId, alreadyConverted: true })
          }
        }
        return Response.json({ ok: true, clientId: existing.clientId, alreadyConverted: true })
      }
    }

    // CRITICAL: requirements must be built from the VISITOR's own messages
    // (joined, asc) + subject — never from lastMessagePreview, which may hold
    // the admin's reply.
    // A typed chat email/phone is unverified, so it is never auto-linked. When it
    // matches a live CRM record the operator must confirm: link to that record
    // (action link-client) or explicitly create a separate lead (createNew).
    if (raw.createNew !== true) {
      const candidates = await duplicateCandidates(conversation)
      if (candidates.length > 0) {
        return Response.json({
          error: 'This visitor may already be a customer. Link the conversation to the existing record or create a separate lead.',
          code: 'POSSIBLE_DUPLICATE',
          candidates,
        }, { status: 409 })
      }
    }

    // Transcript = visitor-facing messages only (never internal notes or events).
    const allMessages = await transcriptMessages(conversationId)
    const visitorMessages = allMessages.filter((m) => m.sender === 'VISITOR')
    const parts: string[] = []
    if (conversation.subject) parts.push(`Subject: ${conversation.subject}`)
    for (const m of visitorMessages) parts.push(m.body)
    const requirements = parts.join('\n\n').slice(0, 2000) || 'Live chat conversation (no visitor messages).'

    const clientId = await nextClientId()
    const client = await db.$transaction(async (tx) => {
      const created = await tx.client.create({
        data: {
          clientId,
          name: conversation.visitorName || 'Chat visitor',
          email: conversation.visitorEmail || null,
          phone: conversation.visitorPhone || null,
          whatsapp: conversation.visitorPhone || null,
          source: 'WEBSITE',
          status: 'LEAD',
          pipelineStage: 'NEW',
          preferredContact: 'CHAT',
        },
      })
      await tx.lead.create({
        data: {
          clientId: created.id,
          requirements,
          projectType: null,
          sourceDetails: 'LIVE_CHAT',
          tracking: JSON.stringify({ conversationId }),
        },
      })
      await tx.chatConversation.update({
        where: { id: conversationId },
        data: {
          clientId: created.id,
          ...(conversation.visitorName ? {} : { visitorName: 'Chat visitor' }),
        },
      })
      await mirrorTranscript(tx, { clientRowId: created.id, conversation, messages: allMessages, fallbackAgent: g.user.email })
      return created
    })
    const { emitLeadCreated } = await import('@/lib/automation/domain-events')
    await emitLeadCreated({ clientRowId: client.id, clientId: client.clientId, leadSource: 'WEBSITE', channelSource: 'LIVE_CHAT', createdBy: g.user.email })

    await audit({
      actor: g.user.email,
      action: 'CHAT_CONVERTED_TO_LEAD',
      userId: g.user.id,
      entityType: 'ChatConversation',
      entityId: conversationId,
      clientId: client.clientId,
      details: { leadClientId: client.clientId, visitorMessages: visitorMessages.length },
      ip: g.ip,
    })
    return Response.json({ ok: true, clientId: client.clientId, alreadyConverted: false })
  }

  // ---------------- link-client (operator-confirmed identity match) ----------------
  if (action === 'link-client') {
    if (conversation.clientId) {
      return Response.json({ error: 'This conversation is already linked to a CRM record.', code: 'ALREADY_LINKED' }, { status: 409 })
    }
    const targetId = sanitizeText(raw.clientRowId, 40)
    let target = targetId ? await db.client.findUnique({ where: { id: targetId }, select: { id: true, clientId: true, mergedIntoId: true, deletedAt: true } }) : null
    if (target?.mergedIntoId) target = await db.client.findUnique({ where: { id: target.mergedIntoId }, select: { id: true, clientId: true, mergedIntoId: true, deletedAt: true } })
    // CRM records belong to the default tenant; other tenants cannot link to them.
    if (!target || target.deletedAt || tenantId !== DEFAULT_TENANT_ID) {
      return Response.json({ error: 'CRM record not found.', code: 'CLIENT_NOT_FOUND' }, { status: 404 })
    }
    const linkedClient = target
    const messages = await transcriptMessages(conversationId)
    const linked = await db.$transaction(async (tx) => {
      // Guard against a concurrent link/convert: only link while still unlinked.
      const res = await tx.chatConversation.updateMany({ where: { id: conversationId, clientId: null }, data: { clientId: linkedClient.id } })
      if (res.count === 0) return false
      await mirrorTranscript(tx, { clientRowId: linkedClient.id, conversation, messages, fallbackAgent: g.user.email })
      await tx.chatMessage.create({
        data: { conversationId, sender: 'SYSTEM', kind: 'EVENT', internal: true, body: `Linked to CRM record ${linkedClient.clientId} by ${g.user.email}`, agentEmail: g.user.email },
      })
      return true
    })
    if (!linked) return Response.json({ error: 'This conversation was linked by someone else just now.', code: 'ALREADY_LINKED' }, { status: 409 })
    await audit({
      actor: g.user.email,
      action: 'CHAT_LINKED_TO_CLIENT',
      userId: g.user.id,
      entityType: 'ChatConversation',
      entityId: conversationId,
      clientId: linkedClient.clientId,
      details: { clientRowId: linkedClient.id, messagesMirrored: messages.length },
      ip: g.ip,
    })
    return Response.json({ ok: true, clientId: linkedClient.clientId, linked: true })
  }

  return Response.json({ error: 'Unknown action.', code: 'BAD_ACTION' }, { status: 400 })
}

type ConversationRow = NonNullable<Awaited<ReturnType<typeof getConversationForTenant>>>
type TranscriptMessage = { id: string; sender: string; body: string; agentEmail: string | null; aiGenerated: boolean; createdAt: Date }
type Tx = Parameters<Parameters<typeof db.$transaction>[0]>[0]

/** Visitor-facing transcript only: excludes internal notes and EVENT rows. */
function transcriptMessages(conversationId: string): Promise<TranscriptMessage[]> {
  return db.chatMessage.findMany({
    where: { conversationId, ...VISITOR_VISIBLE_WHERE, kind: 'MESSAGE' },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    select: { id: true, sender: true, body: true, agentEmail: true, aiGenerated: true, createdAt: true },
  })
}

/** Mirror chat messages into the CRM Communications timeline (idempotent per message). */
async function mirrorTranscript(tx: Tx, input: { clientRowId: string; conversation: ConversationRow; messages: TranscriptMessage[]; fallbackAgent: string }) {
  const visitor = input.conversation.visitorEmail ?? input.conversation.visitorName ?? input.conversation.anonId
  const keys = input.messages.map((m) => `chatmsg:${m.id}`)
  const existing = new Set(
    (await tx.communication.findMany({ where: { clientId: input.clientRowId, providerMessageId: { in: keys } }, select: { providerMessageId: true } }))
      .map((c) => c.providerMessageId),
  )
  for (const m of input.messages) {
    if (m.sender !== 'VISITOR' && m.sender !== 'ADMIN') continue
    if (existing.has(`chatmsg:${m.id}`)) continue
    const fromVisitor = m.sender === 'VISITOR'
    await tx.communication.create({
      data: {
        clientId: input.clientRowId,
        channel: 'WEB',
        direction: fromVisitor ? 'IN' : 'OUT',
        sender: fromVisitor ? visitor : (m.aiGenerated ? 'TECH360 AI assistant' : (m.agentEmail ?? input.fallbackAgent)),
        recipient: fromVisitor ? 'TECH360 Live Chat' : visitor,
        subject: input.conversation.subject,
        body: m.body,
        status: fromVisitor ? 'RECEIVED' : 'SENT',
        providerMessageId: `chatmsg:${m.id}`,
        metadata: JSON.stringify({ conversationId: input.conversation.id, source: 'LIVE_CHAT', author: fromVisitor ? 'VISITOR' : m.aiGenerated ? 'AI' : 'HUMAN' }),
        createdAt: m.createdAt,
      },
    })
  }
}

/** Live CRM records whose stored email/phone exactly matches the visitor's typed details. */
async function duplicateCandidates(conversation: ConversationRow) {
  const email = conversation.visitorEmail?.trim().toLowerCase() || null
  const phone = conversation.visitorPhone?.replace(/[^\d+]/g, '') || null
  const or: Array<Record<string, string>> = []
  if (email) or.push({ email })
  if (phone && phone.replace(/\D/g, '').length >= 8) or.push({ phone }, { whatsapp: phone })
  if (or.length === 0) return []
  const rows = await db.client.findMany({
    where: { deletedAt: null, mergedIntoId: null, OR: or },
    select: { id: true, clientId: true, name: true, businessName: true, email: true, phone: true, whatsapp: true, status: true, createdAt: true },
    orderBy: { createdAt: 'asc' },
    take: 5,
  })
  return rows.map((c) => ({
    rowId: c.id,
    clientId: c.clientId,
    name: c.name,
    businessName: c.businessName,
    status: c.status,
    matchedOn: [
      email && c.email?.toLowerCase() === email ? 'email' : null,
      phone && (c.phone === phone || c.whatsapp === phone) ? 'phone' : null,
    ].filter(Boolean) as string[],
  }))
}
