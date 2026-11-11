import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { readJson, sanitizeText, sanitizeEmail, rateLimit, clientIp, apiError, json, logError } from '@/lib/security'
import { CONTACT_CONSENT_VERSION, hasExplicitContactConsent, isValidClientRequestId } from '@/lib/contact-policy'
import { CHAT_SESSION_COOKIE, ChatSessionConfigError, chatSessionCookieIsValid, withChatSessionCookie } from '@/lib/chat-session'
import { ensureChatClient } from '@/lib/chat-onboarding'
import { redactSensitiveCrmData } from '@/lib/sensitive-redaction'
import { toE164 } from '@/lib/phone'

export const dynamic = 'force-dynamic'

const MAX_BODY = 2000

function isUniqueConflict(error: unknown): boolean {
  return Boolean(error && typeof error === 'object' && 'code' in error && (error as { code?: unknown }).code === 'P2002')
}

function responseWithCookie(payload: unknown, status: number, anonId: string): Response {
  return withChatSessionCookie(json(payload, status), anonId)
}

function publicConversation(conversation: {
  id: string
  status: string
  visitorName: string | null
  visitorEmail: string | null
  lastMessageAt: Date
  lastMessagePreview: string | null
  unreadCount: number
  createdAt: Date
  clientId: string | null
}, displayClientId: string | null) {
  return {
    id: conversation.id,
    status: conversation.status,
    visitorName: conversation.visitorName,
    visitorEmail: conversation.visitorEmail,
    lastMessageAt: conversation.lastMessageAt,
    lastMessagePreview: conversation.lastMessagePreview,
    unreadCount: conversation.unreadCount,
    createdAt: conversation.createdAt,
    clientId: displayClientId,
  }
}

// PUBLIC — start or resume a persisted, consented chat session.
// A signed HttpOnly cookie now gates reads/writes for consented conversations;
// historical unconsented conversations are hidden and safely re-onboarded.
export async function POST(req: NextRequest) {
  try {
    const ip = clientIp(req)
    const rl = rateLimit(`chat-session:${ip}`, 10, 60_000)
    if (!rl.ok) return apiError('Too many requests — please wait a moment and try again.', 429, 'RATE_LIMITED')

    const raw = await readJson(req)
    const anonId = sanitizeText(raw.anonId, 64)
    const requestId = sanitizeText(raw.requestId, 64)
    const name = sanitizeText(raw.name, 80)
    const emailInput = sanitizeText(raw.email, 320)
    const email = sanitizeEmail(emailInput)
    const phoneInput = sanitizeText(raw.phone, 32)
    const phone = phoneInput ? toE164(phoneInput) : null
    const preferredContact = sanitizeText(raw.preferredContact, 16).toUpperCase() === 'SMS' ? 'SMS' : 'Email'
    const subject = redactSensitiveCrmData(sanitizeText(raw.subject, 120)).text
    const initialMessage = redactSensitiveCrmData(sanitizeText(raw.message ?? raw.initialMsg ?? '', MAX_BODY)).text

    if (anonId.length < 4) return apiError('Missing visitor identifier.', 400, 'BAD_ANON_ID')
    if (!isValidClientRequestId(requestId)) return apiError('A valid session request id is required.', 400, 'BAD_REQUEST_ID')
    // Email is optional for SMS-first (the webchat agent's first SMS asks for it, and the Client ID is auto-created once email is received),
    // and required when Email is selected as the first reply channel.
    if (emailInput && !email) return apiError('Enter a valid email address.', 400, 'EMAIL_INVALID')
    if (preferredContact === 'Email' && !email) {
      return apiError('Email is required when email is selected as the first reply channel.', 400, 'EMAIL_REQUIRED')
    }
    if (phoneInput && !phone) return apiError('Enter a valid phone number, such as +8801XXXXXXXXX.', 400, 'PHONE_INVALID')
    if (preferredContact === 'SMS' && !phone) return apiError('A valid phone number is required when SMS is selected.', 400, 'PHONE_REQUIRED')
    if (!hasExplicitContactConsent(raw.contactConsent)) {
      return apiError('Please agree to the Privacy Policy so we can store and respond to your enquiry.', 400, 'CONSENT_REQUIRED')
    }

    const now = new Date()
    const requestCookie = req.cookies.get(CHAT_SESSION_COOKIE)?.value
    const hasValidCookie = chatSessionCookieIsValid(requestCookie, anonId)

    // Resolve an exact retry before searching by anonymous id. The same random
    // request id may re-issue a lost cookie, but cannot be reused for another id/email.
    const priorMessage = await db.chatMessage.findUnique({
      where: { clientRequestId: requestId },
      select: { conversationId: true },
    })
    let conversation = priorMessage
      ? await db.chatConversation.findUnique({ where: { id: priorMessage.conversationId } })
      : null
    if (!conversation) {
      conversation = await db.chatConversation.findUnique({ where: { clientRequestId: requestId } })
    }
    if (conversation && conversation.anonId !== anonId) {
      return apiError('This request id is already bound to another chat.', 409, 'REQUEST_ID_CONFLICT')
    }

    // Surface AI availability honestly so the widget can show correct status.
    let aiAvailable = false
    let aiDetail = 'AI assistant status checking…'
    try {
      const { getAgentProviderStatus } = await import('@/lib/agents/provider-selection')
      const status = getAgentProviderStatus()
      aiAvailable = status.configured
      aiDetail = status.detail
    } catch {
      // Status checks never block a persisted intake.
    }

    if (!conversation) {
      conversation = await db.chatConversation.findFirst({
        where: { anonId, status: 'OPEN' },
        orderBy: { createdAt: 'desc' },
      })
    }

    if (conversation?.contactConsentAt && !hasValidCookie) {
      // A request-id replay is a narrow recovery case: the id is a random,
      // one-use client value and the supplied normalized address must still match.
      const isExactReplay = conversation.clientRequestId === requestId || Boolean(priorMessage)
      if (!isExactReplay || conversation.visitorEmail !== email) {
        return apiError('This chat session cannot be verified in this browser. Please use the contact form or contact support.', 401, 'CHAT_SESSION_REQUIRED')
      }
    }

    if (!conversation) {
      try {
        conversation = await db.chatConversation.create({
          data: {
            anonId,
            clientRequestId: requestId,
            status: 'OPEN',
            visitorName: name || null,
            visitorEmail: email,
            visitorPhone: phone,
            subject: subject || null,
            contactConsentAt: now,
            consentVersion: CONTACT_CONSENT_VERSION,
          },
        })
      } catch (error) {
        if (!isUniqueConflict(error)) throw error
        conversation = await db.chatConversation.findUnique({ where: { clientRequestId: requestId } })
        if (!conversation || conversation.anonId !== anonId) {
          return apiError('This chat request is already being processed. Retry shortly.', 409, 'SESSION_IN_PROGRESS')
        }
      }
    }

    const isLegacyConversation = !conversation.contactConsentAt
    const patch: Record<string, unknown> = {}
    if (!conversation.visitorName && name) patch.visitorName = name
    if (!conversation.visitorEmail && email) patch.visitorEmail = email
    if (!conversation.visitorPhone && phone) patch.visitorPhone = phone
    if (!conversation.subject && subject) patch.subject = subject
    if (isLegacyConversation) {
      // Old conversations could have been linked by an unverified email. Break
      // that association before exposing the thread or generating new context.
      patch.clientId = null
      patch.contactConsentAt = now
      patch.consentVersion = CONTACT_CONSENT_VERSION
    }
    if (!conversation.clientRequestId) patch.clientRequestId = requestId
    if (Object.keys(patch).length > 0) {
      conversation = await db.chatConversation.update({ where: { id: conversation.id }, data: patch })
    }

    let identityReviewRequired = false
    let emailRequired = false
    let displayClientId: string | null = null
    let emailDeliveryStatus: 'ACCEPTED_BY_PROVIDER' | 'NOT_CONFIRMED' | null = null
    let linkedContactDeliveryStatus: { channel: string; status: string; ok: boolean } | null = null
    if (conversation.clientId) {
      displayClientId = await resolveDisplayClientId(conversation.clientId)
    } else {
      const linked = await ensureChatClient({
        conversationId: conversation.id,
        anonId,
        name: name || conversation.visitorName || 'Website Visitor',
        email,
        phone: phone || undefined,
        preferredContact,
        firstMessage: initialMessage || subject || 'Website chat started',
        contactConsentAt: conversation.contactConsentAt ?? now,
      })
      identityReviewRequired = linked.identityReviewRequired
      emailRequired = Boolean((linked as { emailRequired?: boolean }).emailRequired)
      linkedContactDeliveryStatus = linked.contactDeliveryStatus
      if (linked.emailDeliveryStatus) {
        emailDeliveryStatus = linked.emailDeliveryStatus === 'SENT' ? 'ACCEPTED_BY_PROVIDER' : 'NOT_CONFIRMED'
      }
      if (linked.clientRowId) {
        conversation = await db.chatConversation.update({
          where: { id: conversation.id },
          data: { clientId: linked.clientRowId },
        })
        displayClientId = linked.displayClientId
      } else if (emailRequired) {
        // First contact without email: queue the webchat agent's first SMS asking for email.
        // This stays visible in webchat; if an SMS gateway is configured and phone was supplied we also dispatch it as SMS.
        try {
          const { EMAIL_GATE_PROMPT } = await import('@/lib/chat-onboarding')
          const existingPrompt = await db.chatMessage.findFirst({
            where: { conversationId: conversation.id, sender: 'ADMIN', body: EMAIL_GATE_PROMPT },
            select: { id: true },
          })
          if (!existingPrompt) {
            await db.chatMessage.create({
              data: { conversationId: conversation.id, sender: 'ADMIN', body: EMAIL_GATE_PROMPT },
            })
            await db.chatConversation.update({
              where: { id: conversation.id },
              data: { lastMessageAt: new Date(), lastMessagePreview: EMAIL_GATE_PROMPT.slice(0, 120), lastSender: 'ADMIN' },
            }).catch(() => null)
            // Best-effort SMS for SMS-first: send the same prompt as an actual SMS if a phone was supplied and gateway is configured.
            if (phone) {
              try {
                const { sendCommunication } = await import('@/lib/comms')
                await sendCommunication({
                  channel: 'SMS',
                  to: phone,
                  body: EMAIL_GATE_PROMPT,
                  agentCode: 'EMAIL-GATE',
                  // no clientId yet — this is the provisioning SMS before Client ID exists; comms layer supports null clientId for this case
                  clientId: null as unknown as string,
                } as never).catch(() => null)
              } catch {}
            }
          }
        } catch {}
      }
    }

    if (initialMessage) {
      await persistInitialMessageAndReply(conversation, name, email, initialMessage, anonId, requestId).catch(() => null)
      conversation = await db.chatConversation.findUnique({ where: { id: conversation.id } }) ?? conversation
    }

    return responseWithCookie({
      conversation: publicConversation(conversation, displayClientId),
      ai: { available: aiAvailable, detail: aiDetail },
      identityReviewRequired,
      emailRequired,
      emailDeliveryStatus,
      contactDeliveryStatus: linkedContactDeliveryStatus,
      ...(identityReviewRequired
        ? { notice: `Your message is saved, but no Client ID was issued because the email needs safe ownership review. Use conversation reference ${conversation.id} when contacting info@bdtech360.com; this reference is not an authentication secret.` }
        : emailRequired
          ? { notice: `Thanks for contacting TECH360. Please share your email address — once received, your Client ID will be created automatically and the first SMS will follow on your chosen channel.` }
          : {}),
    }, 201, anonId)
  } catch (error) {
    if (error instanceof ChatSessionConfigError) {
      await logError({
        source: 'CHAT_SESSION',
        code: 'CHAT_SESSION_MISCONFIGURED',
        message: error.message,
        workflow: 'CHAT',
      }).catch(() => null)
      return apiError('Live chat session configuration is incomplete — please email info@bdtech360.com.', 503, 'CHAT_SESSION_MISCONFIGURED')
    }
    return apiError('Chat is temporarily unavailable — please try again shortly.', 503, 'CHAT_DB_UNAVAILABLE')
  }
}

async function resolveDisplayClientId(rowId: string): Promise<string | null> {
  try {
    const client = await db.client.findUnique({ where: { id: rowId }, select: { clientId: true, deletedAt: true } })
    return client && !client.deletedAt ? client.clientId : null
  } catch {
    return null
  }
}

async function persistInitialMessageAndReply(
  conversation: { id: string; clientId?: string | null },
  name: string,
  email: string,
  body: string,
  anonId: string,
  requestId: string,
): Promise<void> {
  const prior = await db.chatMessage.findUnique({
    where: { clientRequestId: requestId },
    select: { id: true, conversationId: true },
  })
  if (prior) return

  let message
  try {
    message = await db.chatMessage.create({
      data: { clientRequestId: requestId, conversationId: conversation.id, sender: 'VISITOR', body: body.slice(0, MAX_BODY) },
    })
  } catch (error) {
    if (isUniqueConflict(error)) return
    throw error
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

  const clientRowId = conversation.clientId
  if (!clientRowId) return

  await db.communication.create({
    data: {
      clientId: clientRowId,
      channel: 'WEB',
      direction: 'IN',
      sender: email || name || anonId,
      recipient: 'TECH360 Live Chat',
      body,
      status: 'RECEIVED',
      providerMessageId: `chatmsg:${message.id}`,
    },
  }).catch(() => null)

  const { handleCustomerMessage } = await import('@/lib/chat-orchestrator')
  const client = await db.client.findUnique({ where: { id: clientRowId }, select: { clientId: true } }).catch(() => null)
  await handleCustomerMessage({
    channel: 'WEB',
    conversationId: conversation.id,
    clientRowId,
    clientId: client?.clientId ?? clientRowId,
    visitorBody: body,
    visitorName: name,
    visitorEmail: email,
  }).catch(() => null)
}
