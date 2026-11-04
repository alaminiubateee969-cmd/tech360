import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { sanitizeText, rateLimit, clientIp, apiError, json } from '@/lib/security'
import { CHAT_SESSION_COOKIE, chatSessionCookieIsValid } from '@/lib/chat-session'
import { ensureChatClient, extractEmail, EMAIL_GATE_PROMPT } from '@/lib/chat-onboarding'
import { isValidClientRequestId } from '@/lib/contact-policy'
import { sanitizeEmail } from '@/lib/security'

export const dynamic = 'force-dynamic'

const MAX_BODY = 2000

function isUniqueConflict(error: unknown): boolean {
  return Boolean(error && typeof error === 'object' && 'code' in error && (error as { code?: unknown }).code === 'P2002')
}

async function threadResponse(input: {
  conversationId: string
  anonId: string
  messageId: string
  duplicate?: boolean
}) {
  const messages = await db.chatMessage.findMany({
    where: { conversationId: input.conversationId },
    orderBy: { createdAt: 'asc' },
    select: { id: true, sender: true, body: true, agentEmail: true, createdAt: true },
  })
  const message = messages.find((item) => item.id === input.messageId)
  return json({
    message: message
      ? { id: message.id, sender: message.sender, body: message.body, createdAt: message.createdAt }
      : null,
    reply: null,
    duplicate: input.duplicate ?? false,
    messages: messages.map((item) => ({
      id: item.id,
      sender: item.sender,
      body: item.body,
      agentEmail: item.agentEmail,
      createdAt: item.createdAt.toISOString(),
    })),
  }, input.duplicate ? 200 : 201)
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
    const body = sanitizeText(raw.body, MAX_BODY)
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

    // Preserve the validated consent timestamp across conversation updates.
    const contactConsentAt = conversation.contactConsentAt

    let identityReviewRequired = false
    let emailRequired = false
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
      emailRequired = Boolean((linked as { emailRequired?: boolean }).emailRequired)
      if (linked.clientRowId) {
        conversation = await db.chatConversation.update({
          where: { id: conversation.id },
          data: { clientId: linked.clientRowId, visitorName: conversation.visitorName ?? (name || null), visitorEmail: linked.clientRowId ? (sanitizeEmail(extractEmail(body) ?? conversation.visitorEmail ?? '') ?? conversation.visitorEmail) : conversation.visitorEmail },
        })
      } else if (emailRequired) {
        // Still no email — queue a follow-up prompt in webchat (and rely on the prior first SMS already sent from session).
        // Do not spam: create one prompt per inbound that still lacks email.
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
      },
    })

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
      // Email-gated: no Client ID yet — the first SMS already asked for email. Return the same prompt as a visible reply.
      if (emailRequired) {
        const promptMsg = await db.chatMessage.create({
          data: { conversationId: conversation.id, sender: 'ADMIN', body: EMAIL_GATE_PROMPT },
        }).catch(() => null)
        if (promptMsg) {
          await db.chatConversation.update({
            where: { id: conversation.id },
            data: { lastMessageAt: new Date(), lastMessagePreview: EMAIL_GATE_PROMPT.slice(0, 120), lastSender: 'ADMIN' },
          }).catch(() => null)
        }
        const latestMessages = await db.chatMessage.findMany({
          where: { conversationId: conversation.id },
          orderBy: { createdAt: 'asc' },
          select: { id: true, sender: true, body: true, agentEmail: true, createdAt: true },
        })
        return json({
          message: { id: message.id, sender: message.sender, body: message.body, createdAt: message.createdAt },
          reply: { body: EMAIL_GATE_PROMPT, wasAiGenerated: false, escalated: false, error: null },
          identityReviewRequired,
          emailRequired: true,
          notice: 'Please share your email address — your Client ID will be created automatically once received.',
          messages: latestMessages.map((item) => ({ id: item.id, sender: item.sender, body: item.body, agentEmail: item.agentEmail, createdAt: item.createdAt.toISOString() })),
        }, 201)
      }
      return json({
        message: { id: message.id, sender: message.sender, body: message.body, createdAt: message.createdAt },
        reply: null,
        identityReviewRequired,
        notice: identityReviewRequired
          ? 'Your message is saved, but we could not safely match this email to an existing Client ID. Please use the Client Portal or contact info@bdtech360.com for verification.'
          : 'Your message is saved. CRM matching is still being checked; please try again shortly if you do not receive a reply.',
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
      const latestMessages = await db.chatMessage.findMany({
        where: { conversationId: conversation.id },
        orderBy: { createdAt: 'asc' },
        select: { id: true, sender: true, body: true, agentEmail: true, createdAt: true },
      })
      return json({
        message: { id: message.id, sender: message.sender, body: message.body, createdAt: message.createdAt },
        reply: result.ok
          ? { body: result.reply, wasAiGenerated: result.wasAiGenerated, escalated: result.escalated ?? false, error: result.error ?? null }
          : null,
        conversation: { id: conversation.id, clientId: result.clientId, status: 'OPEN' },
        messages: latestMessages.map((item) => ({ id: item.id, sender: item.sender, body: item.body, agentEmail: item.agentEmail, createdAt: item.createdAt.toISOString() })),
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
        message: { id: message.id, sender: message.sender, body: message.body, createdAt: message.createdAt },
        reply: null,
        error: 'Your message was saved. Our assistant is temporarily unavailable — please try again or email info@bdtech360.com.',
        code: 'AI_UNAVAILABLE',
      }, 201)
    }
  } catch {
    return apiError('Chat is temporarily unavailable — please try again shortly.', 503, 'CHAT_DB_UNAVAILABLE')
  }
}
