import { NextRequest } from 'next/server'
import { apiError, clientIp, rateLimit, sanitizeText } from '@/lib/security'
import { resolveVisitorConversation } from '@/lib/webchat/visitor-auth'
import { SSE_HEADERS, sseStream, visitorDelta } from '@/lib/webchat/thread'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

// PUBLIC — Server-Sent Events for the visitor thread (signed session required).
// The database is the source of truth: each tick reads new visible messages,
// receipts and the team typing state, so it works across server instances.
// The stream ends after ~55s and EventSource reconnects with the last id.
export async function GET(req: NextRequest) {
  const rl = rateLimit(`chat-stream:${clientIp(req)}`, 30, 60_000)
  if (!rl.ok) return apiError('Too many requests.', 429, 'RATE_LIMITED')
  try {
    const url = new URL(req.url)
    const resolved = await resolveVisitorConversation(req, url.searchParams.get('anonId'))
    if (resolved instanceof Response) return resolved
    const conversationId = resolved.conversation.id
    let lastId: string | null = sanitizeText(url.searchParams.get('after') ?? req.headers.get('last-event-id') ?? '', 40) || null
    let lastStatus = ''
    let lastTyping = false
    let lastReceipts = ''
    const body = sseStream(req.signal, async (send) => {
      const delta = await visitorDelta(conversationId, lastId)
      if (!delta) { send('gone', {}); return false }
      if (delta.messages.length) {
        lastId = delta.messages[delta.messages.length - 1].id
        send('messages', { messages: delta.messages, lastId })
      }
      const status = JSON.stringify(delta.conversation)
      if (status !== lastStatus) { lastStatus = status; send('status', delta.conversation) }
      if (delta.typing.active !== lastTyping) { lastTyping = delta.typing.active; send('typing', delta.typing) }
      const receipts = JSON.stringify(delta.receipts)
      if (receipts !== lastReceipts) { lastReceipts = receipts; send('receipts', { receipts: delta.receipts }) }
      return true
    })
    return new Response(body, { headers: SSE_HEADERS })
  } catch {
    return apiError('Chat is temporarily unavailable.', 503, 'CHAT_DB_UNAVAILABLE')
  }
}
