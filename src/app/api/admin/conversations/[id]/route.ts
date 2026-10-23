import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { guard, isResponse } from '@/lib/api-guard'
import { readJson, sanitizeText, audit } from '@/lib/security'
import { nextClientId } from '@/lib/ids'

export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ id: string }> }

// ADMIN — open a conversation: full thread (asc) + reset unreadCount to 0.
export async function GET(req: NextRequest, { params }: Ctx) {
  const g = await guard(req, { minRole: 'STAFF' })
  if (isResponse(g)) return g
  const { id } = await params
  const conversationId = sanitizeText(id, 40)

  const conversation = await db.chatConversation.findUnique({
    where: { id: conversationId },
    include: { _count: { select: { messages: true } } },
  })
  if (!conversation) return Response.json({ error: 'Conversation not found' }, { status: 404 })

  const messages = await db.chatMessage.findMany({
    where: { conversationId },
    orderBy: { createdAt: 'asc' },
  })

  if (conversation.unreadCount > 0) {
    await db.chatConversation.update({ where: { id: conversationId }, data: { unreadCount: 0 } })
    conversation.unreadCount = 0
  }

  let linkedClientId: string | null = null
  if (conversation.clientId) {
    const linked = await db.client.findUnique({
      where: { id: conversation.clientId },
      select: { clientId: true, mergedIntoId: true },
    })
    if (linked?.mergedIntoId) {
      const mergedTarget = await db.client.findUnique({
        where: { id: linked.mergedIntoId },
        select: { clientId: true },
      })
      linkedClientId = mergedTarget?.clientId ?? linked.clientId
    } else {
      linkedClientId = linked?.clientId ?? null
    }
  }

  return Response.json({
    conversation: {
      id: conversation.id,
      anonId: conversation.anonId,
      clientId: linkedClientId,
      status: conversation.status,
      visitorName: conversation.visitorName,
      visitorEmail: conversation.visitorEmail,
      visitorPhone: conversation.visitorPhone,
      subject: conversation.subject,
      lastMessagePreview: conversation.lastMessagePreview,
      lastMessageAt: conversation.lastMessageAt,
      unreadCount: conversation.unreadCount,
      createdAt: conversation.createdAt,
      updatedAt: conversation.updatedAt,
      messageCount: conversation._count.messages,
    },
    messages: messages.map((m) => ({
      id: m.id,
      sender: m.sender,
      body: m.body,
      agentEmail: m.agentEmail,
      createdAt: m.createdAt,
    })),
  })
}

// ADMIN — actions on a conversation: reply | close | reopen | convert-to-lead.
export async function POST(req: NextRequest, { params }: Ctx) {
  const g = await guard(req, { minRole: 'STAFF' })
  if (isResponse(g)) return g
  const { id } = await params
  const conversationId = sanitizeText(id, 40)
  const raw = await readJson(req)
  const action = sanitizeText(raw.action, 40).toLowerCase()
  const body = sanitizeText(raw.body, 4000)

  const conversation = await db.chatConversation.findUnique({ where: { id: conversationId } })
  if (!conversation) return Response.json({ error: 'Conversation not found' }, { status: 404 })

  // ---------------- reply ----------------
  if (action === 'reply') {
    if (body.length < 1) return Response.json({ error: 'Reply body is required.' }, { status: 400 })
    if (body.length > 4000) return Response.json({ error: 'Reply is too long (4000 characters max).' }, { status: 400 })
    if (conversation.status !== 'OPEN') {
      return Response.json({ error: 'This conversation is closed — reopen it to reply.' }, { status: 400 })
    }
    const message = await db.chatMessage.create({
      data: { conversationId, sender: 'ADMIN', body, agentEmail: g.user.email },
    })
    await db.chatConversation.update({
      where: { id: conversationId },
      data: {
        lastMessageAt: new Date(),
        lastMessagePreview: body.slice(0, 120),
        lastSender: 'ADMIN',
        unreadCount: 0,
      },
    })
    if (conversation.clientId) {
      await db.communication.create({
        data: {
          clientId: conversation.clientId,
          channel: 'WEB',
          direction: 'OUT',
          sender: g.user.email,
          recipient: conversation.visitorEmail ?? conversation.visitorName ?? conversation.anonId,
          subject: conversation.subject,
          body,
          status: 'SENT',
          providerMessageId: `chatmsg:${message.id}`,
          metadata: JSON.stringify({ conversationId, source: 'LIVE_CHAT' }),
        },
      }).catch(() => null)
    }
    await audit({
      actor: g.user.email,
      action: 'CHAT_REPLY',
      userId: g.user.id,
      entityType: 'ChatConversation',
      entityId: conversationId,
      details: { messageId: message.id, length: body.length },
      ip: g.ip,
    })
    return Response.json({
      ok: true,
      message: { id: message.id, sender: message.sender, body: message.body, agentEmail: message.agentEmail, createdAt: message.createdAt },
    })
  }

  // ---------------- close ----------------
  if (action === 'close') {
    const now = new Date()
    await db.chatConversation.update({ where: { id: conversationId }, data: { status: 'CLOSED' } })
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
    await db.chatConversation.update({ where: { id: conversationId }, data: { status: 'OPEN' } })
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
    const allMessages = await db.chatMessage.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'asc' },
      select: { id: true, sender: true, body: true, agentEmail: true, createdAt: true },
    })
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
      // Mirror transcript into unified CRM Communications timeline
      for (const m of allMessages) {
        if (m.sender !== 'VISITOR' && m.sender !== 'ADMIN') continue
        await tx.communication.create({
          data: {
            clientId: created.id,
            channel: 'WEB',
            direction: m.sender === 'VISITOR' ? 'IN' : 'OUT',
            sender: m.sender === 'VISITOR' ? (conversation.visitorEmail ?? conversation.visitorName ?? conversation.anonId) : (m.agentEmail ?? g.user.email),
            recipient: m.sender === 'VISITOR' ? 'TECH360 Live Chat' : (conversation.visitorEmail ?? conversation.visitorName ?? conversation.anonId),
            subject: conversation.subject,
            body: m.body,
            status: m.sender === 'VISITOR' ? 'RECEIVED' : 'SENT',
            providerMessageId: `chatmsg:${m.id}`,
            metadata: JSON.stringify({ conversationId, source: 'LIVE_CHAT' }),
            createdAt: m.createdAt,
          },
        })
      }
      return created
    })

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

  return Response.json({ error: 'Unknown action — use reply, close, reopen or convert-to-lead.' }, { status: 400 })
}
