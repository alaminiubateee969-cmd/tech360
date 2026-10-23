import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { readJson, sanitizeText, sanitizeEmail, rateLimit, clientIp, apiError, json } from '@/lib/security'
import { intakeLead } from '@/lib/journey'

export const dynamic = 'force-dynamic'

// PUBLIC — start (or resume) a chat conversation for an anonymous visitor.
// - Finds the visitor's latest OPEN conversation; creates one only if none exists
// - Links the conversation to a stable CRM Client ID (no duplicate CRM)
// - Persists visitor details honestly; never claims AI is ready unless provider is
// - Returns AI availability so the widget can remove the misleading promise
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
    const initialMessage = sanitizeText(raw.message ?? raw.initialMsg ?? '', 2000)

    if (anonId.length < 4) return apiError('Missing visitor identifier.', 400, 'BAD_ANON_ID')
    if (name.length < 1) return apiError('Name is required to start a chat.', 400, 'NAME_REQUIRED')

    // Surface AI availability honestly so the widget can show correct status
    let aiAvailable = false
    let aiDetail = 'AI assistant status checking…'
    try {
      const { getZaiProviderStatus } = await import('@/lib/ai-provider')
      const status = getZaiProviderStatus()
      aiAvailable = status.configured
      aiDetail = status.detail
    } catch {
      // status check never breaks session creation
    }

    // Resume the visitor's latest OPEN conversation if one exists
    const existing = await db.chatConversation.findFirst({
      where: { anonId, status: 'OPEN' },
      orderBy: { createdAt: 'desc' },
    })
    if (existing) {
      const patch: Record<string, unknown> = {}
      if (!existing.visitorName && name) patch.visitorName = name
      if (!existing.visitorEmail && email) patch.visitorEmail = email
      if (!existing.subject && subject) patch.subject = subject
      const conversation =
        Object.keys(patch).length > 0
          ? await db.chatConversation.update({ where: { id: existing.id }, data: patch })
          : existing

      // If existing conversation already linked to a Client, update missing CRM fields
      if (conversation.clientId && email) {
        const c = await db.client.findUnique({ where: { id: conversation.clientId }, select: { email: true } }).catch(() => null)
        if (c && !c.email) {
          await db.client.update({ where: { id: conversation.clientId }, data: { email } }).catch(() => null)
        }
      }

      // If existing conversation not yet linked, try to link now (same anon recovered)
      if (!conversation.clientId) {
        const linked = await linkConversationToClient(conversation, name, email, initialMessage)
        if (linked.clientRowId) {
          const updated = await db.chatConversation
            .update({ where: { id: conversation.id }, data: { clientId: linked.clientRowId } })
            .catch(() => conversation)
          // If initial message was supplied with the session start, persist it now and generate AI reply
          if (initialMessage && updated) {
            await persistInitialMessageAndReply(updated, name, email, initialMessage, anonId).catch(() => null)
          }
          return json({
            conversation: {
              id: updated.id,
              status: updated.status,
              visitorName: updated.visitorName,
              visitorEmail: updated.visitorEmail,
              lastMessageAt: updated.lastMessageAt,
              lastMessagePreview: updated.lastMessagePreview,
              unreadCount: updated.unreadCount,
              createdAt: updated.createdAt,
              clientId: linked.displayClientId ?? null,
            },
            ai: { available: aiAvailable, detail: aiDetail },
          })
        }
      }

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
          clientId: conversation.clientId ? (await resolveDisplayClientId(conversation.clientId)) : null,
        },
        ai: { available: aiAvailable, detail: aiDetail },
      })
    }

    // Create a new conversation and a linked CRM Client ID in one step
    const linkAttempt = await linkConversationToClient(null, name, email, initialMessage || subject || 'Website chat started')
    const conversation = await db.chatConversation.create({
      data: {
        anonId,
        status: 'OPEN',
        visitorName: name,
        visitorEmail: email || null,
        subject: subject || null,
        clientId: linkAttempt.clientRowId ?? null,
      },
    })

    // If caller supplied an initial message with the session request, persist it and generate AI reply now
    // This satisfies Requirement B.1: accept first message and answer contextually
    if (initialMessage) {
      await persistInitialMessageAndReply(conversation, name, email, initialMessage, anonId).catch(() => null)
      // Re-fetch conversation after possible updates
      const fresh = await db.chatConversation.findUnique({ where: { id: conversation.id } }).catch(() => conversation)
      if (fresh) {
        Object.assign(conversation, fresh)
      }
    }

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
          clientId: linkAttempt.displayClientId ?? null,
        },
        ai: { available: aiAvailable, detail: aiDetail },
      },
      201,
    )
  } catch {
    return apiError('Chat is temporarily unavailable — please try again shortly.', 503, 'CHAT_DB_UNAVAILABLE')
  }
}

async function resolveDisplayClientId(rowId: string): Promise<string | null> {
  try {
    const c = await db.client.findUnique({ where: { id: rowId }, select: { clientId: true } })
    return c?.clientId ?? null
  } catch {
    return null
  }
}

async function linkConversationToClient(
  conversation: { id: string } | null,
  name: string,
  email: string,
  initialMessage: string,
): Promise<{ clientRowId: string | null; displayClientId: string | null; visitorName?: string; visitorEmail?: string }> {
  // Check for existing client by email (raw dedupe, not verified identity — prevents duplicate WEB leads)
  if (email) {
    const byEmail = await db.client.findFirst({ where: { email, deletedAt: null }, select: { id: true, clientId: true } }).catch(() => null)
    if (byEmail) return { clientRowId: byEmail.id, displayClientId: byEmail.clientId }
  }
  // Create via existing intakeLead journey (reuses CRM, workflow, Client ID generation)
  try {
    const result = await intakeLead({
      source: 'WEBSITE',
      name: name || 'Website Visitor',
      email: email || undefined,
      message: `Website chat — ${name}: ${initialMessage.slice(0, 1500)}`,
    })
    return { clientRowId: result.clientRowId, displayClientId: result.clientId }
  } catch {
    // intakeLead may require consent or fail on duplicate — create minimal client directly
    try {
      const { nextClientId } = await import('@/lib/ids')
      const minimal = await db.client.create({
        data: {
          clientId: await nextClientId(),
          name: name || 'Website Visitor',
          email: email || null,
          source: 'WEB',
          status: 'LEAD',
          pipelineStage: 'NEW',
        },
      })
      await db.lead
        .create({
          data: {
            clientId: minimal.id,
            requirements: `Website chat: ${initialMessage.slice(0, 2000)}`,
            tracking: JSON.stringify({ source: 'WEB_CHAT' }),
          },
        })
        .catch(() => null)
      return { clientRowId: minimal.id, displayClientId: minimal.clientId }
    } catch {
      return { clientRowId: null, displayClientId: null }
    }
  }
}

async function persistInitialMessageAndReply(
  conversation: { id: string; clientId?: string | null },
  name: string,
  email: string,
  body: string,
  anonId: string,
): Promise<void> {
  // Create the initial VISITOR message
  const message = await db.chatMessage.create({
    data: { conversationId: conversation.id, sender: 'VISITOR', body: body.slice(0, 2000) },
  })
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

  // Log inbound communication
  await db.communication
    .create({
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
    })
    .catch(() => null)

  // Generate AI reply via orchestrator (honest — records provider failure if any)
  const { handleCustomerMessage } = await import('@/lib/chat-orchestrator')
  // Resolve display clientId for orchestrator (it needs clientId string for audit)
  const c = await db.client.findUnique({ where: { id: clientRowId }, select: { clientId: true } }).catch(() => null)
  await handleCustomerMessage({
    channel: 'WEB',
    conversationId: conversation.id,
    clientRowId,
    clientId: c?.clientId ?? clientRowId,
    visitorBody: body,
    visitorName: name,
    visitorEmail: email,
  }).catch(() => null)
}
