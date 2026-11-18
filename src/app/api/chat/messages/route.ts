import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { sanitizeText, rateLimit, clientIp, apiError, json } from '@/lib/security'
import { CHAT_SESSION_COOKIE, chatSessionCookieIsValid } from '@/lib/chat-session'
import { getAgentProviderStatus } from '@/lib/agents/provider-selection'
import { visitorDelta } from '@/lib/webchat/thread'
import { markReadByVisitor } from '@/lib/webchat/inbox-service'
import { VISITOR_VISIBLE_WHERE } from '@/lib/webchat/policy'

export const dynamic = 'force-dynamic'

// PUBLIC — poll a visitor's thread. New consented conversations require the
// signed HttpOnly session cookie; legacy unconsented threads are not disclosed.
export async function GET(req: NextRequest) {
  try {
    const ip = clientIp(req)
    const rl = rateLimit(`chat-messages:${ip}`, 60, 60_000)
    if (!rl.ok) return apiError('Too many requests.', 429, 'RATE_LIMITED')

    const url = new URL(req.url)
    const anonId = sanitizeText(url.searchParams.get('anonId') ?? '', 64)
    const after = sanitizeText(url.searchParams.get('after') ?? '', 40)
    if (anonId.length < 4) return apiError('Missing visitor identifier.', 400, 'BAD_ANON_ID')

    const aiStatus = getAgentProviderStatus()
    const ai = { available: aiStatus.configured, detail: aiStatus.detail }

    const conversation = await db.chatConversation.findFirst({
      where: { anonId },
      orderBy: { createdAt: 'desc' },
    })
    if (!conversation) return json({ conversation: null, messages: [], latestId: null, ai })

    // Do not expose historical threads or CRM links whose original public
    // session had no recorded contact consent. The current start form can
    // re-consent and safely re-onboard without reusing an unverified link.
    if (!conversation.contactConsentAt) {
      return json({ conversation: null, messages: [], latestId: null, needsConsent: true, ai })
    }
    if (!chatSessionCookieIsValid(req.cookies.get(CHAT_SESSION_COOKIE)?.value, anonId)) {
      return apiError('This chat session cannot be verified in this browser.', 401, 'CHAT_SESSION_REQUIRED')
    }

    const [delta, linkedClient] = await Promise.all([
      visitorDelta(conversation.id, after || null),
      conversation.clientId
        ? db.client.findUnique({ where: { id: conversation.clientId }, select: { clientId: true, deletedAt: true } })
        : Promise.resolve(null),
    ])
    // `read=1` is sent only while the visitor has the thread open and focused.
    if (url.searchParams.get('read') === '1' && conversation.status === 'OPEN') {
      await markReadByVisitor(conversation.id).catch(() => 0)
    }
    const latest = await db.chatMessage.findFirst({
      where: { conversationId: conversation.id, ...VISITOR_VISIBLE_WHERE },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      select: { id: true },
    })
    const latestId = latest?.id ?? null
    const displayClientId = linkedClient && !linkedClient.deletedAt ? linkedClient.clientId : null

    return json({
      conversation: {
        id: conversation.id,
        status: conversation.status,
        unreadCount: conversation.unreadCount,
        visitorName: conversation.visitorName,
        clientId: displayClientId,
        inboxState: delta?.conversation.inboxState ?? conversation.inboxState,
        humanRequested: delta?.conversation.humanRequested ?? false,
        closedBy: delta?.conversation.closedBy ?? null,
      },
      // Internal notes are excluded at query level (VISITOR_VISIBLE_WHERE).
      messages: delta?.messages ?? [],
      receipts: delta?.receipts ?? [],
      typing: delta?.typing ?? { active: false, name: null },
      latestId,
      ai,
    })
  } catch {
    return apiError('Chat is temporarily unavailable — please try again shortly.', 503, 'CHAT_DB_UNAVAILABLE')
  }
}
