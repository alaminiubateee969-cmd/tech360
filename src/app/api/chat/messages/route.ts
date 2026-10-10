import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { sanitizeText, rateLimit, clientIp, apiError, json } from '@/lib/security'

export const dynamic = 'force-dynamic'

// PUBLIC — poll a visitor's thread. Per-visitor isolation: only the latest
// conversation for this anonId is ever returned. `after` enables incremental
// fetching (only messages newer than that message id).
export async function GET(req: NextRequest) {
  try {
    const ip = clientIp(req)
    const rl = rateLimit(`chat-messages:${ip}`, 60, 60_000)
    if (!rl.ok) return apiError('Too many requests.', 429, 'RATE_LIMITED')

    const url = new URL(req.url)
    const anonId = sanitizeText(url.searchParams.get('anonId') ?? '', 64)
    const after = sanitizeText(url.searchParams.get('after') ?? '', 40)
    if (anonId.length < 4) return apiError('Missing visitor identifier.', 400, 'BAD_ANON_ID')

    const conversation = await db.chatConversation.findFirst({
      where: { anonId },
      orderBy: { createdAt: 'desc' },
    })
    if (!conversation) {
      return json({ conversation: null, messages: [], latestId: null })
    }

    const messages = await db.chatMessage.findMany({
      where: { conversationId: conversation.id },
      orderBy: { createdAt: 'asc' },
      select: { id: true, sender: true, body: true, agentEmail: true, createdAt: true },
    })

    const afterIndex = after ? messages.findIndex((m) => m.id === after) : -1
    const visible = afterIndex >= 0 ? messages.slice(afterIndex + 1) : messages
    const latestId = messages.length > 0 ? messages[messages.length - 1].id : null

    return json({
      conversation: {
        id: conversation.id,
        status: conversation.status,
        unreadCount: conversation.unreadCount,
        visitorName: conversation.visitorName,
      },
      messages: visible,
      latestId,
    })
  } catch {
    // honest degradation: the thread history lives in the database — an
    // honest empty answer with the reason beats a crashed widget.
    return apiError('Chat is temporarily unavailable — please try again shortly.', 503, 'CHAT_DB_UNAVAILABLE')
  }
}
