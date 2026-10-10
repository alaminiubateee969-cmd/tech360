import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { readJson, sanitizeText, sanitizeEmail, rateLimit, clientIp, apiError, json } from '@/lib/security'

export const dynamic = 'force-dynamic'

const MAX_BODY = 2000

// PUBLIC — visitor sends a message into their OPEN conversation.
// Creates the VISITOR message, updates the conversation preview and flags it
// unread for the admin console, and records a 'lead' tracking event.
export async function POST(req: NextRequest) {
  try {
    const ip = clientIp(req)
    const rl = rateLimit(`chat-message:${ip}`, 20, 60_000)
    if (!rl.ok) return apiError('You are sending messages too quickly — please wait a moment.', 429, 'RATE_LIMITED')

    const raw = await readJson(req)
    const anonId = sanitizeText(raw.anonId, 64)
    const body = sanitizeText(raw.body, MAX_BODY)
    // optional enrichment from the widget when the visitor gave details later
    const name = sanitizeText(raw.name, 80)
    const email = sanitizeEmail(raw.email)

    if (anonId.length < 4) return apiError('Missing visitor identifier.', 400, 'BAD_ANON_ID')
    if (body.length < 1) return apiError('Message body is required.', 400, 'BODY_REQUIRED')
    if (body.length > MAX_BODY) return apiError('Message is too long (2000 characters max).', 400, 'BODY_TOO_LONG')

    const conversation = await db.chatConversation.findFirst({
      where: { anonId, status: 'OPEN' },
      orderBy: { createdAt: 'desc' },
    })
    if (!conversation) {
      return apiError('No open conversation — start one first.', 404, 'NO_OPEN_CONVERSATION')
    }

    const message = await db.chatMessage.create({
      data: { conversationId: conversation.id, sender: 'VISITOR', body },
    })

    await db.chatConversation.update({
      where: { id: conversation.id },
      data: {
        lastMessageAt: new Date(),
        lastMessagePreview: body.slice(0, 120),
        lastSender: 'VISITOR',
        unreadCount: { increment: 1 },
        ...(!conversation.visitorName && name ? { visitorName: name } : {}),
        ...(!conversation.visitorEmail && email ? { visitorEmail: email } : {}),
      },
    })

    // first meaningful visitor message counts as a live-chat lead signal
    db.trackingEvent.create({
      data: {
        name: 'lead',
        path: '/chat',
        anonId,
        consent: false,
        meta: JSON.stringify({ source: 'live_chat', conversationId: conversation.id }),
      },
    }).catch(() => null)

    return json({ message: { id: message.id, sender: message.sender, body: message.body, createdAt: message.createdAt } }, 201)
  } catch {
    // honest degradation: a message that could not be persisted was NOT
    // delivered — say so instead of pretending the widget is healthy.
    return apiError('Chat is temporarily unavailable — your message was not delivered. Please try again shortly.', 503, 'CHAT_DB_UNAVAILABLE')
  }
}
