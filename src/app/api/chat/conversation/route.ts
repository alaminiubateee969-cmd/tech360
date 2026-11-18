import { NextRequest } from 'next/server'
import { apiError, clientIp, json, rateLimit, sanitizeText } from '@/lib/security'
import { resolveVisitorConversation } from '@/lib/webchat/visitor-auth'
import { InboxError, markReadByVisitor, visitorCloseConversation, visitorReopenConversation, visitorRequestHuman } from '@/lib/webchat/inbox-service'

export const dynamic = 'force-dynamic'

// PUBLIC — visitor conversation actions: request-human | close | reopen | read.
// Every action requires the signed chat session cookie bound to the anon id.
export async function POST(req: NextRequest) {
  const rl = rateLimit(`chat-conversation:${clientIp(req)}`, 30, 60_000)
  if (!rl.ok) return apiError('Too many requests.', 429, 'RATE_LIMITED')
  try {
    const raw = await req.json().catch(() => ({})) as Record<string, unknown>
    const action = sanitizeText(raw.action, 20).toLowerCase()
    const resolved = await resolveVisitorConversation(req, raw.anonId)
    if (resolved instanceof Response) return resolved
    const { conversation } = resolved

    if (action === 'read') {
      const count = conversation.status === 'OPEN' ? await markReadByVisitor(conversation.id) : 0
      return json({ ok: true, marked: count })
    }
    if (action === 'request-human') {
      const r = await visitorRequestHuman(conversation, sanitizeText(raw.note, 300) || undefined)
      return json({ ok: true, changed: r.changed, inboxState: r.conversation.inboxState })
    }
    if (action === 'close') {
      const r = await visitorCloseConversation(conversation)
      return json({ ok: true, changed: r.changed, status: r.conversation.status })
    }
    if (action === 'reopen') {
      const r = await visitorReopenConversation(conversation)
      return json({ ok: true, changed: r.changed, status: r.conversation.status })
    }
    return apiError('Unknown action — use request-human, close, reopen or read.', 400, 'BAD_ACTION')
  } catch (error) {
    if (error instanceof InboxError) return apiError(error.message, error.status, error.code)
    return apiError('Chat is temporarily unavailable.', 503, 'CHAT_DB_UNAVAILABLE')
  }
}
