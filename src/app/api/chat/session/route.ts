import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { readJson, sanitizeText, sanitizeEmail, rateLimit, clientIp, apiError, json } from '@/lib/security'

export const dynamic = 'force-dynamic'

// PUBLIC — start (or resume) a chat conversation for an anonymous visitor.
// Finds the visitor's latest OPEN conversation; creates one only if none exists.
export async function POST(req: NextRequest) {
  try {
    const ip = clientIp(req)
    const rl = rateLimit(`chat-session:${ip}`, 10, 60_000)
    if (!rl.ok) return apiError('Too many requests — please wait a moment and try again.', 429, 'RATE_LIMITED')

    const raw = await readJson(req)
    const anonId = sanitizeText(raw.anonId, 64)
    const name = sanitizeText(raw.name, 80)
    const email = sanitizeEmail(raw.email)
    const subject = sanitizeText(raw.subject, 120)

    if (anonId.length < 4) return apiError('Missing visitor identifier.', 400, 'BAD_ANON_ID')
    if (name.length < 1) return apiError('Name is required to start a chat.', 400, 'NAME_REQUIRED')

    // Resume the visitor's latest OPEN conversation if one exists — the widget
    // only ever holds one open thread per browser.
    const existing = await db.chatConversation.findFirst({
      where: { anonId, status: 'OPEN' },
      orderBy: { createdAt: 'desc' },
    })
    if (existing) {
      // fill in visitor details that were missing on first contact
      const patch: Record<string, unknown> = {}
      if (!existing.visitorName && name) patch.visitorName = name
      if (!existing.visitorEmail && email) patch.visitorEmail = email
      if (!existing.subject && subject) patch.subject = subject
      const conversation = Object.keys(patch).length
        ? await db.chatConversation.update({ where: { id: existing.id }, data: patch })
        : existing
      return json({
        conversation: {
          id: conversation.id,
          status: conversation.status,
          visitorName: conversation.visitorName,
          visitorEmail: conversation.visitorEmail,
          lastMessageAt: conversation.lastMessageAt,
          lastMessagePreview: conversation.lastMessagePreview,
          unreadCount: conversation.unreadCount,
          createdAt: conversation.createdAt,
        },
      })
    }

    const conversation = await db.chatConversation.create({
      data: {
        anonId,
        status: 'OPEN',
        visitorName: name,
        visitorEmail: email || null,
        subject: subject || null,
      },
    })

    return json(
      {
        conversation: {
          id: conversation.id,
          status: conversation.status,
          visitorName: conversation.visitorName,
          visitorEmail: conversation.visitorEmail,
          lastMessageAt: conversation.lastMessageAt,
          lastMessagePreview: conversation.lastMessagePreview,
          unreadCount: conversation.unreadCount,
          createdAt: conversation.createdAt,
        },
      },
      201,
    )
  } catch {
    // honest degradation: chat state lives in the database — if it cannot be
    // reached, say so instead of crashing the visitor's widget.
    return apiError('Chat is temporarily unavailable — please try again shortly.', 503, 'CHAT_DB_UNAVAILABLE')
  }
}
