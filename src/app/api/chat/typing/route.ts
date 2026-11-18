import { NextRequest } from 'next/server'
import { apiError, clientIp, json, rateLimit } from '@/lib/security'
import { resolveVisitorConversation } from '@/lib/webchat/visitor-auth'
import { setTyping } from '@/lib/webchat/inbox-service'

export const dynamic = 'force-dynamic'

// PUBLIC — visitor typing indicator (signed session required). Expires after TYPING_TTL_MS.
export async function POST(req: NextRequest) {
  const rl = rateLimit(`chat-typing:${clientIp(req)}`, 40, 60_000)
  if (!rl.ok) return apiError('Too many requests.', 429, 'RATE_LIMITED')
  try {
    const raw = await req.json().catch(() => ({})) as Record<string, unknown>
    const resolved = await resolveVisitorConversation(req, raw.anonId, { requireOpen: true })
    if (resolved instanceof Response) return resolved
    await setTyping(resolved.conversation.id, 'VISITOR', raw.typing === true)
    return json({ ok: true })
  } catch {
    return apiError('Chat is temporarily unavailable.', 503, 'CHAT_DB_UNAVAILABLE')
  }
}
