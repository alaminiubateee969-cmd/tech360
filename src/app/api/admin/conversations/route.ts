import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { guard, isResponse } from '@/lib/api-guard'
import { sanitizeText } from '@/lib/security'

export const dynamic = 'force-dynamic'

// ADMIN — list live chat conversations (latest 100 by activity).
// ?status=OPEN|CLOSED filters the list; tab counts for both statuses are
// always included so the UI can show live counts without extra requests.
export async function GET(req: NextRequest) {
  const g = await guard(req)
  if (isResponse(g)) return g

  const url = new URL(req.url)
  const status = sanitizeText(url.searchParams.get('status') ?? 'OPEN', 20).toUpperCase()
  const where = status === 'CLOSED' ? { status: 'CLOSED' } : { status: 'OPEN' }

  const [conversations, openCount, closedCount] = await Promise.all([
    db.chatConversation.findMany({
      where,
      orderBy: { lastMessageAt: 'desc' },
      take: 100,
      include: { _count: { select: { messages: true } } },
    }),
    db.chatConversation.count({ where: { status: 'OPEN' } }),
    db.chatConversation.count({ where: { status: 'CLOSED' } }),
  ])

  // agentEmail of the last admin reply per conversation (single grouped query)
  const ids = conversations.map((c) => c.id)
  const adminMessages = ids.length
    ? await db.chatMessage.findMany({
        where: { conversationId: { in: ids }, sender: 'ADMIN' },
        orderBy: { createdAt: 'asc' },
        select: { conversationId: true, agentEmail: true },
      })
    : []
  const lastAgentByConversation = new Map<string, string>()
  for (const m of adminMessages) {
    if (m.agentEmail) lastAgentByConversation.set(m.conversationId, m.agentEmail)
  }

  return Response.json({
    conversations: conversations.map((c) => ({
      id: c.id,
      anonId: c.anonId,
      status: c.status,
      visitorName: c.visitorName,
      visitorEmail: c.visitorEmail,
      visitorPhone: c.visitorPhone,
      subject: c.subject,
      lastMessagePreview: c.lastMessagePreview,
      lastMessageAt: c.lastMessageAt,
      unreadCount: c.unreadCount,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
      messageCount: c._count.messages,
      lastAgentEmail: lastAgentByConversation.get(c.id) ?? null,
    })),
    counts: { OPEN: openCount, CLOSED: closedCount },
  })
}
