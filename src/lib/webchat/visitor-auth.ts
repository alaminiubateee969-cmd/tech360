// ============================================================
// TECH360 — visitor conversation resolution (signed session)
// ============================================================
// A visitor can only ever reach the most recent conversation of their own
// anonymous id AND only when the request carries the signed HttpOnly chat
// session cookie bound to that id. The conversation row then defines the
// tenant — a visitor never chooses a tenant.
// ============================================================

import type { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { CHAT_SESSION_COOKIE, chatSessionCookieIsValid } from '@/lib/chat-session'
import { apiError, sanitizeText } from '@/lib/security'
import type { Conversation } from '@/lib/webchat/inbox-service'

export async function resolveVisitorConversation(
  req: NextRequest,
  anonIdRaw: unknown,
  opts: { requireOpen?: boolean } = {},
): Promise<{ conversation: Conversation; anonId: string } | Response> {
  const anonId = sanitizeText(anonIdRaw, 64)
  if (anonId.length < 4) return apiError('Missing visitor identifier.', 400, 'BAD_ANON_ID')
  const conversation = await db.chatConversation.findFirst({ where: { anonId }, orderBy: { createdAt: 'desc' } })
  if (!conversation || !conversation.contactConsentAt) return apiError('No conversation found — start one first.', 404, 'NO_CONVERSATION')
  if (!chatSessionCookieIsValid(req.cookies.get(CHAT_SESSION_COOKIE)?.value, anonId)) {
    return apiError('This chat session cannot be verified in this browser.', 401, 'CHAT_SESSION_REQUIRED')
  }
  if (opts.requireOpen && conversation.status !== 'OPEN') return apiError('This conversation is closed.', 409, 'CONVERSATION_CLOSED')
  return { conversation, anonId }
}

/** Visitor messages per conversation inside the burst window (DB-counted, multi-instance safe). */
export async function visitorBurstExceeded(conversationId: string, limit: number, windowMs: number): Promise<boolean> {
  const since = new Date(Date.now() - windowMs)
  const count = await db.chatMessage.count({ where: { conversationId, sender: 'VISITOR', createdAt: { gte: since } } })
  return count >= limit
}
