import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { readJson, sanitizeText, sanitizeEmail, rateLimit, clientIp, apiError, json } from '@/lib/security'
import { intakeLead } from '@/lib/journey'

export const dynamic = 'force-dynamic'

const MAX_BODY = 2000

// PUBLIC — visitor sends a message into their OPEN conversation.
// - Persists the VISITOR message honestly (does not claim sent unless DB ok)
// - Ensures a CRM Client ID exists and is linked to the conversation
// - Generates a contextual AI response via the orchestrator (or honest fallback)
// - Persists inbound + outbound against same client + conversation
// - Never claims AI responded unless the AI operation succeeded
// - Preserves visitor isolation: only this anonId's OPEN conversation is used
export async function POST(req: NextRequest) {
  try {
    const ip = clientIp(req)
    const rl = rateLimit(`chat-message:${ip}`, 20, 60_000)
    if (!rl.ok) return apiError('You are sending messages too quickly — please wait a moment.', 429, 'RATE_LIMITED')

    const raw = await readJson(req)
    const anonId = sanitizeText(raw.anonId, 64)
    const body = sanitizeText(raw.body, MAX_BODY)
    const name = sanitizeText(raw.name, 80)
    const email = sanitizeEmail(raw.email)

    if (anonId.length < 4) return apiError('Missing visitor identifier.', 400, 'BAD_ANON_ID')
    if (body.length < 1) return apiError('Message body is required.', 400, 'BODY_REQUIRED')
    if (body.length > MAX_BODY) return apiError('Message is too long (2000 characters max).', 400, 'BODY_TOO_LONG')

    let conversation = await db.chatConversation.findFirst({
      where: { anonId, status: 'OPEN' },
      orderBy: { createdAt: 'desc' },
    })
    if (!conversation) {
      return apiError('No open conversation — start one first.', 404, 'NO_OPEN_CONVERSATION')
    }

    // Ensure CRM Client ID: create or reuse via normalized email/phone if present,
    // otherwise create a stable CRM lead for this anon visitor.
    if (!conversation.clientId) {
      const linked = await ensureClientForConversation(conversation, name, email, anonId, body)
      if (linked.clientRowId) {
        conversation = await db.chatConversation.update({
          where: { id: conversation.id },
          data: { clientId: linked.clientRowId, visitorName: linked.visitorName ?? conversation.visitorName, visitorEmail: linked.visitorEmail ?? conversation.visitorEmail },
        })
      }
    } else {
      // If clientId already linked, still enrich missing visitor details
      const patch: Record<string, unknown> = {}
      if (!conversation.visitorName && name) patch.visitorName = name
      if (!conversation.visitorEmail && email) patch.visitorEmail = email
      if (Object.keys(patch).length) {
        await db.chatConversation.update({ where: { id: conversation.id }, data: patch }).catch(() => null)
      }
      // Also save supplied email to Client CRM if not yet known
      if (email && conversation.clientId) {
        const c = await db.client.findUnique({ where: { id: conversation.clientId }, select: { email: true } })
        if (c && !c.email) {
          await db.client.update({ where: { id: conversation.clientId }, data: { email } }).catch(() => null)
        }
      }
    }

    const message = await db.chatMessage.create({
      data: { conversationId: conversation.id, sender: 'VISITOR', body },
    })

    await db.chatConversation.update({
      where: { id: conversation.id },
      data: {
        lastMessageAt: new Date(),
        lastMessagePreview: body.slice(0, 120),
        lastSender: 'VISITOR',
        unreadCount: { increment: 1 },
        ...(!conversation.visitorName && name ? { visitorName: name } : {}),
        ...(!conversation.visitorEmail && email ? { visitorEmail: email } : {}),
      },
    })

    if (conversation.clientId) {
      db.communication
        .create({
          data: {
            clientId: conversation.clientId,
            channel: 'WEB',
            direction: 'IN',
            sender: email || conversation.visitorEmail || name || conversation.visitorName || anonId,
            recipient: 'TECH360 Live Chat',
            subject: conversation.subject,
            body,
            status: 'RECEIVED',
            providerMessageId: `chatmsg:${message.id}`,
            metadata: JSON.stringify({ conversationId: conversation.id, source: 'LIVE_CHAT' }),
          },
        })
        .catch(() => null)
    }

    db.trackingEvent
      .create({
        data: {
          name: 'lead',
          path: '/chat',
          anonId,
          consent: false,
          meta: JSON.stringify({ source: 'live_chat', conversationId: conversation.id }),
        },
      })
      .catch(() => null)

    // --- Generate AI response via orchestrator (honest, never fake) ---
    let orchestratorResult: {
      ok: boolean
      reply: string
      wasAiGenerated: boolean
      error?: string
      escalated?: boolean
      clientId?: string
    } | null = null

    if (conversation.clientId) {
      try {
        const { handleCustomerMessage } = await import('@/lib/chat-orchestrator')
        const result = await handleCustomerMessage({
          channel: 'WEB',
          conversationId: conversation.id,
          clientRowId: conversation.clientId,
          clientId: conversation.clientId, // will be refreshed inside
          visitorBody: body,
          visitorName: name || conversation.visitorName,
          visitorEmail: email || conversation.visitorEmail,
        })
        orchestratorResult = result
        // The orchestrator already persisted the reply as ChatMessage + Communication
        // We return the visitor message + the assistant reply together so the widget
        // does not need to wait for the next poll cycle.
        const latestMessages = await db.chatMessage.findMany({
          where: { conversationId: conversation.id },
          orderBy: { createdAt: 'asc' },
          select: { id: true, sender: true, body: true, agentEmail: true, createdAt: true },
        })
        return json(
          {
            message: { id: message.id, sender: message.sender, body: message.body, createdAt: message.createdAt },
            reply: result.ok
              ? { body: result.reply, wasAiGenerated: result.wasAiGenerated, escalated: result.escalated ?? false, error: result.error ?? null }
              : null,
            conversation: { id: conversation.id, clientId: result.clientId, status: 'OPEN' },
            messages: latestMessages.map((m) => ({ id: m.id, sender: m.sender, body: m.body, agentEmail: m.agentEmail, createdAt: m.createdAt.toISOString() })),
          },
          201,
        )
      } catch (e) {
        // Orchestrator threw — do not claim AI replied; return honest error status
        const errMsg = e instanceof Error ? e.message : String(e)
        const { logError } = await import('@/lib/security')
        await logError({ source: 'CHAT_MESSAGE', code: 'ORCHESTRATOR_FAILED', message: errMsg, workflow: 'CHAT' }).catch(() => null)
        // Still return the visitor message; the client can retry
        return json(
          {
            message: { id: message.id, sender: message.sender, body: message.body, createdAt: message.createdAt },
            reply: null,
            error: 'Your message was saved. Our assistant is temporarily unavailable — please try again or email info@bdtech360.com.',
            code: 'AI_UNAVAILABLE',
          },
          201,
        )
      }
    }

    // No clientId could be established (should not happen — honest fallback)
    return json({ message: { id: message.id, sender: message.sender, body: message.body, createdAt: message.createdAt }, reply: null }, 201)
  } catch {
    return apiError('Chat is temporarily unavailable — your message was not delivered. Please try again shortly.', 503, 'CHAT_DB_UNAVAILABLE')
  }
}

/**
 * Ensure a CRM Client exists for this anonymous web conversation.
 * Uses the existing intakeLead / identity system — no duplicate CRM.
 * Dedupes by normalized email when supplied; otherwise creates a WEB lead
 * with the anonId as tracking reference (stable Client ID per anon visitor).
 */
async function ensureClientForConversation(
  conversation: { id: string; anonId: string; visitorName?: string | null; visitorEmail?: string | null },
  suppliedName: string,
  suppliedEmail: string,
  anonId: string,
  firstMessage: string,
): Promise<{ clientRowId: string | null; visitorName?: string | null; visitorEmail?: string | null }> {
  // If email supplied and matches an existing client via verified identity lookup,
  // intakeLead's verified path will handle dedup; but WEB anon has no verified identity.
  // So we first check for an existing chat conversation from same anonId that already linked a client.
  const prior = await db.chatConversation.findFirst({
    where: { anonId: conversation.anonId, clientId: { not: null } },
    orderBy: { createdAt: 'desc' },
    select: { clientId: true },
  })
  if (prior?.clientId) {
    const existing = await db.client.findUnique({ where: { id: prior.clientId }, select: { id: true } })
    if (existing) return { clientRowId: existing.id }
  }

  // Check by supplied email as raw dedupe (not verified, but prevents duplicate
  // WEB leads for same email; verified identity linkage happens when email OTP later)
  if (suppliedEmail) {
    const byEmail = await db.client.findFirst({
      where: { email: suppliedEmail, deletedAt: null },
      select: { id: true, name: true, email: true },
      orderBy: { createdAt: 'desc' },
    })
    if (byEmail) {
      return { clientRowId: byEmail.id, visitorName: byEmail.name, visitorEmail: byEmail.email }
    }
  }

  // Create a new WEB lead via the existing journey intakeLead (preserves CRM + lifecycle)
  try {
    const name = suppliedName || conversation.visitorName || 'Website Visitor'
    const result = await intakeLead({
      source: 'WEBSITE',
      name,
      email: suppliedEmail || undefined,
      message: `Website chat first message (anon ${anonId.slice(0, 8)}…): ${firstMessage.slice(0, 2000)}`,
    })
    return { clientRowId: result.clientRowId, visitorName: name, visitorEmail: suppliedEmail || null }
  } catch {
    // intakeLead failed (e.g., contact consent missing) — still create a minimal client row directly
    // so the conversation is not orphaned; this preserves the Client ID contract
    try {
      const { nextClientId } = await import('@/lib/ids')
      const minimal = await db.client.create({
        data: {
          clientId: await nextClientId(),
          name: suppliedName || conversation.visitorName || 'Website Visitor',
          email: suppliedEmail || null,
          source: 'WEB',
          status: 'LEAD',
          pipelineStage: 'NEW',
        },
      })
      await db.lead
        .create({
          data: {
            clientId: minimal.id,
            requirements: `Website chat (anon ${anonId.slice(0, 8)}…): ${firstMessage.slice(0, 2000)}`,
            tracking: JSON.stringify({ anonId }),
          },
        })
        .catch(() => null)
      return { clientRowId: minimal.id, visitorName: minimal.name, visitorEmail: minimal.email }
    } catch {
      return { clientRowId: null }
    }
  }
}
