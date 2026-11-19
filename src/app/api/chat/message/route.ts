import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { sanitizeText, rateLimit, clientIp, apiError, json } from '@/lib/security'
import { CHAT_SESSION_COOKIE, chatSessionCookieIsValid } from '@/lib/chat-session'
import { ensureChatClient, extractEmail } from '@/lib/chat-onboarding'
import { isValidClientRequestId } from '@/lib/contact-policy'
import { sanitizeEmail } from '@/lib/security'
import { redactSensitiveCrmData } from '@/lib/sensitive-redaction'
import { screenVisitorMessage, toVisitorMessage, VISITOR_BURST_LIMIT, VISITOR_BURST_WINDOW_MS, VISITOR_VISIBLE_WHERE } from '@/lib/webchat/policy'
import { visitorBurstExceeded } from '@/lib/webchat/visitor-auth'

export const dynamic = 'force-dynamic'

const MAX_BODY = 2000

function isUniqueConflict(error: unknown): boolean {
  return Boolean(error && typeof error === 'object' && 'code' in error && (error as { code?: unknown }).code === 'P2002')
}

async function visibleThread(conversationId: string) {
  const rows = await db.chatMessage.findMany({
    where: { conversationId, ...VISITOR_VISIBLE_WHERE },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
  })
  return rows.map(toVisitorMessage)
}

async function threadResponse(input: {
  conversationId: string
  anonId: string
  messageId: string
  duplicate?: boolean
}) {
  const messages = await visibleThread(input.conversationId)
  const message = messages.find((item) => item.id === input.messageId)
  return json({
    message: message ?? null,
    reply: null,
    duplicate: input.duplicate ?? false,
    messages,
  }, input.duplicate ? 200 : 201)
}

/** Post-persist hooks: rules triage + automation event. Never affects the visitor's response. */
async function afterVisitorMessage(conversation: { id: string; tenantId: string; clientId: string | null }, messageId: string, channelBody: string) {
  try {
    const { triageConversation } = await import('@/lib/ai-support/assist')
    const triage = await triageConversation(conversation.id)
    const { emitAutomationEvent } = await import('@/lib/automation/engine')
    await emitAutomationEvent({
      tenantId: conversation.tenantId,
      type: 'WEBCHAT_MESSAGE_RECEIVED',
      source: 'WEBCHAT',
      subjectType: 'ChatConversation',
      subjectId: conversation.id,
      payload: {
        conversationId: conversation.id,
        clientRowId: conversation.clientId,
        messageId,
        body: channelBody.slice(0, 500),
        intent: triage?.intent ?? null,
        language: triage?.language ?? null,
        priority: triage?.priority ?? null,
      },
      dedupeKey: `webchat_msg:${messageId}`,
    })
  } catch (error) {
    const { logError } = await import('@/lib/security')
    await logError({ source: 'CHAT_MESSAGE', code: 'POST_MESSAGE_HOOK_FAILED', message: error instanceof Error ? error.message : String(error) }).catch(() => null)
  }
}

// PUBLIC — visitor sends a message into their consented OPEN conversation.
// Request IDs make client retries idempotent; a signed HttpOnly cookie protects
// conversation reads and writes. Unverified emails never select another CRM row.
export async function POST(req: NextRequest) {
  try {
    const ip = clientIp(req)
    const rl = rateLimit(`chat-message:${ip}`, 20, 60_000)
    if (!rl.ok) return apiError('You are sending messages too quickly — please wait a moment.', 429, 'RATE_LIMITED')

    const raw = await req.json().catch(() => ({})) as Record<string, unknown>
    const anonId = sanitizeText(raw.anonId, 64)
    const requestId = sanitizeText(raw.requestId, 64)
    const body = redactSensitiveCrmData(sanitizeText(raw.body, MAX_BODY)).text
    const name = sanitizeText(raw.name, 80)

    if (anonId.length < 4) return apiError('Missing visitor identifier.', 400, 'BAD_ANON_ID')
    if (!isValidClientRequestId(requestId)) return apiError('A valid message request id is required.', 400, 'BAD_REQUEST_ID')
    if (body.length < 1) return apiError('Message body is required.', 400, 'BODY_REQUIRED')

    const duplicate = await db.chatMessage.findUnique({
      where: { clientRequestId: requestId },
      select: { id: true, conversationId: true },
    })
    if (duplicate) {
      const priorConversation = await db.chatConversation.findUnique({ where: { id: duplicate.conversationId } })
      if (!priorConversation || priorConversation.anonId !== anonId) {
        return apiError('This request id is already bound to another chat.', 409, 'REQUEST_ID_CONFLICT')
      }
      if (!priorConversation.contactConsentAt) return apiError('Please restart chat and accept the contact/privacy notice.', 403, 'CONSENT_REQUIRED')
      if (!chatSessionCookieIsValid(req.cookies.get(CHAT_SESSION_COOKIE)?.value, anonId)) {
        return apiError('This chat session cannot be verified in this browser. Please contact support.', 401, 'CHAT_SESSION_REQUIRED')
      }
      return threadResponse({ conversationId: priorConversation.id, anonId, messageId: duplicate.id, duplicate: true })
    }

    let conversation = await db.chatConversation.findFirst({
      where: { anonId, status: 'OPEN' },
      orderBy: { createdAt: 'desc' },
    })
    if (!conversation) return apiError('No open conversation — start one first.', 404, 'NO_OPEN_CONVERSATION')
    if (!conversation.contactConsentAt) return apiError('Please restart chat and accept the contact/privacy notice.', 403, 'CONSENT_REQUIRED')
    if (!chatSessionCookieIsValid(req.cookies.get(CHAT_SESSION_COOKIE)?.value, anonId)) {
      return apiError('This chat session cannot be verified in this browser. Please contact support.', 401, 'CHAT_SESSION_REQUIRED')
    }

    const screened = screenVisitorMessage(body)
    if (!screened.ok) return apiError(screened.reason, 422, screened.code)
    if (await visitorBurstExceeded(conversation.id, VISITOR_BURST_LIMIT, VISITOR_BURST_WINDOW_MS)) {
      return apiError('You are sending messages too quickly — please wait a moment.', 429, 'RATE_LIMITED')
    }

    // Preserve the validated consent timestamp across conversation updates.
    const contactConsentAt = conversation.contactConsentAt

    let identityReviewRequired = false
    if (!conversation.clientId) {
      // If the visitor's message itself contains an email, capture it so the Client ID can be auto-created now.
      const emailed = extractEmail(body)
      if (emailed && !conversation.visitorEmail) {
        try {
          conversation = await db.chatConversation.update({ where: { id: conversation.id }, data: { visitorEmail: sanitizeEmail(emailed) ?? emailed } })
        } catch {}
      }
      const linked = await ensureChatClient({
        conversationId: conversation.id,
        anonId,
        name: name || conversation.visitorName || 'Website Visitor',
        email: conversation.visitorEmail ?? '',
        firstMessage: body,
        contactConsentAt,
      })
      identityReviewRequired = linked.identityReviewRequired
      if (linked.clientRowId) {
        conversation = await db.chatConversation.update({
          where: { id: conversation.id },
          data: { clientId: linked.clientRowId, visitorName: conversation.visitorName ?? (name || null), visitorEmail: linked.clientRowId ? (sanitizeEmail(extractEmail(body) ?? conversation.visitorEmail ?? '') ?? conversation.visitorEmail) : conversation.visitorEmail },
        })
      }
    } else if (!conversation.visitorName && name) {
      conversation = await db.chatConversation.update({ where: { id: conversation.id }, data: { visitorName: name } })
    }
    // Keep conversation email in sync when visitor sends a new email in any message after linking
    if (conversation.clientId) {
      const maybeEmail = extractEmail(body)
      if (maybeEmail && maybeEmail !== conversation.visitorEmail) {
        const clean = sanitizeEmail(maybeEmail)
        if (clean) {
          try {
            await db.chatConversation.update({ where: { id: conversation.id }, data: { visitorEmail: clean } })
            conversation.visitorEmail = clean
            // Also keep CRM email updated (non-verified contact field)
            await db.client.update({ where: { id: conversation.clientId }, data: { email: clean } }).catch(() => null)
          } catch {}
        }
      }
    }

    let message
    try {
      message = await db.chatMessage.create({
        data: { clientRequestId: requestId, conversationId: conversation.id, sender: 'VISITOR', body },
      })
    } catch (error) {
      if (!isUniqueConflict(error)) throw error
      const repeated = await db.chatMessage.findUnique({ where: { clientRequestId: requestId }, select: { id: true, conversationId: true } })
      if (!repeated || repeated.conversationId !== conversation.id) {
        return apiError('This request id is already bound to another message.', 409, 'REQUEST_ID_CONFLICT')
      }
      return threadResponse({ conversationId: conversation.id, anonId, messageId: repeated.id, duplicate: true })
    }

    await db.chatConversation.update({
      where: { id: conversation.id },
      data: {
        lastMessageAt: new Date(),
        lastMessagePreview: body.slice(0, 120),
        lastSender: 'VISITOR',
        unreadCount: { increment: 1 },
        visitorTypingAt: null,
        // A visitor reply re-opens a resolved thread so it returns to the working queues.
        ...(conversation.inboxState === 'RESOLVED' ? { inboxState: 'OPEN', resolvedAt: null, resolvedBy: null } : {}),
      },
    })
    await afterVisitorMessage(conversation, message.id, body)

    if (conversation.clientId) {
      await db.communication.create({
        data: {
          clientId: conversation.clientId,
          channel: 'WEB',
          direction: 'IN',
          sender: conversation.visitorEmail || name || conversation.visitorName || anonId,
          recipient: 'TECH360 Live Chat',
          subject: conversation.subject,
          body,
          status: 'RECEIVED',
          providerMessageId: `chatmsg:${message.id}`,
          metadata: JSON.stringify({ conversationId: conversation.id, source: 'LIVE_CHAT' }),
        },
      }).catch(() => null)
    }

    await db.trackingEvent.create({
      data: {
        name: 'lead',
        path: '/chat',
        anonId,
        consent: false,
        meta: JSON.stringify({ source: 'live_chat', conversationId: conversation.id }),
      },
    }).catch(() => null)

    if (!conversation.clientId) {
      // A consented conversation always receives a prospect Client ID at
      // session start, so this is an exceptional state (CRM write failed).
      // The visitor's message is already saved; do not claim an AI reply.
      return json({
        message: toVisitorMessage(message),
        reply: null,
        identityReviewRequired,
        code: 'CRM_LINK_PENDING',
        notice: 'Your message is saved. Our team can already read it in the chat inbox; a Client ID will be attached for you shortly.',
      }, 201)
    }

    try {
      const { handleCustomerMessage } = await import('@/lib/chat-orchestrator')
      const client = await db.client.findUnique({ where: { id: conversation.clientId }, select: { clientId: true } })
      const result = await handleCustomerMessage({
        channel: 'WEB',
        conversationId: conversation.id,
        clientRowId: conversation.clientId,
        clientId: client?.clientId ?? conversation.clientId,
        visitorBody: body,
        visitorName: name || conversation.visitorName,
        visitorEmail: conversation.visitorEmail,
      })
      const latestMessages = await visibleThread(conversation.id)
      return json({
        message: toVisitorMessage(message),
        reply: result.ok
          ? { body: result.reply, wasAiGenerated: result.wasAiGenerated, escalated: result.escalated ?? false, error: result.error ?? null }
          : null,
        conversation: { id: conversation.id, clientId: result.clientId, status: 'OPEN' },
        messages: latestMessages,
      }, 201)
    } catch (error) {
      // Honest fallback: the visitor message is already saved. We do not claim an AI reply
      // was generated; the response carries AI_UNAVAILABLE and no reply body.
      const { logError } = await import('@/lib/security')
      await logError({
        source: 'CHAT_MESSAGE',
        code: 'ORCHESTRATOR_FAILED',
        message: error instanceof Error ? error.message : String(error),
        workflow: 'CHAT',
      }).catch(() => null)
      return json({
        message: toVisitorMessage(message),
        reply: null,
        error: 'Your message was saved. Our assistant is temporarily unavailable — please try again or email info@bdtech360.com.',
        code: 'AI_UNAVAILABLE',
      }, 201)
    }
  } catch {
    return apiError('Chat is temporarily unavailable — please try again shortly.', 503, 'CHAT_DB_UNAVAILABLE')
  }
}
