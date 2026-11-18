import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { apiError, clientIp, rateLimit, sanitizeText } from '@/lib/security'
import { resolveVisitorConversation } from '@/lib/webchat/visitor-auth'
import { serveChatAttachment } from '@/lib/webchat/attachments'

export const dynamic = 'force-dynamic'

// PUBLIC — a visitor downloads a file from THEIR conversation (signed session).
// Files attached to internal notes are never served to visitors.
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const rl = rateLimit(`chat-attachment-get:${clientIp(req)}`, 60, 60_000)
  if (!rl.ok) return apiError('Too many requests.', 429, 'RATE_LIMITED')
  try {
    const { id } = await params
    const fileId = sanitizeText(id, 40)
    const resolved = await resolveVisitorConversation(req, new URL(req.url).searchParams.get('anonId'))
    if (resolved instanceof Response) return resolved
    const visibleRef = await db.chatMessage.findFirst({
      where: { conversationId: resolved.conversation.id, attachmentId: fileId, internal: false },
      select: { id: true },
    })
    if (!visibleRef) return apiError('File not found.', 404, 'NOT_FOUND')
    const res = await serveChatAttachment(fileId, resolved.conversation.id)
    return res ?? apiError('File not found.', 404, 'NOT_FOUND')
  } catch {
    return apiError('Download failed.', 503, 'CHAT_DB_UNAVAILABLE')
  }
}
