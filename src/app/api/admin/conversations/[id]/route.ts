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

  return Response.json({
    conversation: {
      id: conversation.id,
      anonId: conversation.anonId,
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
        unreadCount: 0,
      },
    })
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
    await db.chatConversation.update({ where: { id: conversationId }, data: { lastMessageAt: now, lastMessagePreview: sys.body.slice(0, 120) } })
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
    await db.chatConversation.update({ where: { id: conversationId }, data: { lastMessageAt: now, lastMessagePreview: sys.body.slice(0, 120) } })
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
    // CRITICAL: requirements must be built from the VISITOR's own messages
    // (joined, asc) + subject — never from lastMessagePreview, which may hold
    // the admin's reply.
    const visitorMessages = await db.chatMessage.findMany({
      where: { conversationId, sender: 'VISITOR' },
      orderBy: { createdAt: 'asc' },
      select: { body: true },
    })
    const parts: string[] = []
    if (conversation.subject) parts.push(`Subject: ${conversation.subject}`)
    for (const m of visitorMessages) parts.push(m.body)
    const requirements = parts.join('\n\n').slice(0, 2000) || 'Live chat conversation (no visitor messages).'

    const clientId = await nextClientId()
    const client = await db.client.create({
      data: {
        clientId,
        name: conversation.visitorName || 'Chat visitor',
        email: conversation.visitorEmail || null,
        source: 'WEBSITE',
        status: 'LEAD',
        pipelineStage: 'NEW',
        preferredContact: 'CHAT',
      },
    })
    await db.lead.create({
      data: {
        clientId: client.id,
        requirements,
        projectType: null,
        sourceDetails: 'LIVE_CHAT',
        tracking: JSON.stringify({ conversationId }),
      },
    })

    // keep the conversation record in sync with the details used on the client
    await db.chatConversation.update({
      where: { id: conversationId },
      data: conversation.visitorName ? {} : { visitorName: 'Chat visitor' },
    })

    await audit({
      actor: g.user.email,
      action: 'CHAT_CONVERTED_TO_LEAD',
      userId: g.user.id,
      entityType: 'ChatConversation',
      entityId: conversationId,
      clientId,
      details: { leadClientId: clientId, visitorMessages: visitorMessages.length },
      ip: g.ip,
    })
    return Response.json({ ok: true, clientId })
  }

  return Response.json({ error: 'Unknown action — use reply, close, reopen or convert-to-lead.' }, { status: 400 })
}
