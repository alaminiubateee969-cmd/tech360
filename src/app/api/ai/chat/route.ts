import { AI_WORKFORCE_MIN_ROLE } from '@/lib/ai-workforce-policy'
import { NextRequest } from 'next/server'
import { guard, isResponse } from '@/lib/api-guard'
import { readJson, sanitizeText, audit } from '@/lib/security'
import { newCorrelationId } from '@/lib/correlation'
import { routeChat } from '@/lib/model/router'
import { db } from '@/lib/db'
import { AI_CHAT_ANON_PREFIX } from '@/lib/chat'

export const dynamic = 'force-dynamic'

/**
 * POST /api/ai/chat
 *
 * A chat turn against the PRIVATE model service.
 *
 * The request is routed through the model router, so a local model is
 * preferred and the remote provider is only a last resort. The response
 * names the provider that answered.
 *
 * Unlike /api/model/v1/chat (the machine-to-machine private API), this
 * route uses the browser session, RBAC and CSRF, and it PERSISTS the
 * conversation so the admin console can show it.
 *
 * The persistence uses the real chat model: a `ChatConversation` for the
 * session and a `ChatMessage` per turn. The turn's sender is ADMIN for
 * the operator's question and SYSTEM for the model's answer.
 */
export async function POST(req: NextRequest) {
  const g = await guard(req, { minRole: AI_WORKFORCE_MIN_ROLE, limit: { max: 40, windowMs: 60_000 } })
  if (isResponse(g)) return g
  const raw = await readJson(req)

  const message = sanitizeText(raw.message, 8000)
  if (message.length < 1) {
    return Response.json({ error: 'message is required.', code: 'INVALID_REQUEST' }, { status: 400 })
  }
  const sessionId = sanitizeText(raw.sessionId ?? 'default', 80) || 'default'
  const model = sanitizeText(raw.model ?? '', 120) || undefined
  const system = sanitizeText(raw.system ?? '', 4000) || undefined

  const anonId = `${AI_CHAT_ANON_PREFIX}${sessionId}`

  // The console conversation for this session. It is created on demand and
  // reused, so the history below is this session's real history.
  const existing = await db.chatConversation.findFirst({
    where: { anonId },
    orderBy: { createdAt: 'desc' },
  })
  const conversation = existing ?? await db.chatConversation.create({
    data: {
      anonId,
      status: 'OPEN',
      subject: 'Console AI chat',
      visitorName: g.user.email,
    },
  })

  const history = await db.chatMessage.findMany({
    where: { conversationId: conversation.id },
    orderBy: { createdAt: 'asc' },
    take: 12,
    select: { sender: true, body: true },
  })

  const messages = [
    ...(system ? [{ role: 'system' as const, content: system }] : []),
    ...history.map((entry) => ({
      role: (entry.sender === 'ADMIN' ? 'user' : 'assistant') as 'user' | 'assistant',
      content: entry.body,
    })),
    { role: 'user' as const, content: message },
  ]

  const correlationId = newCorrelationId()
  const completion = await routeChat({ messages, model, correlationId, maxTokens: 1024 })

  await audit({
    actor: g.user.email,
    action: 'AI_CHAT',
    userId: g.user.id,
    entityId: correlationId,
    details: {
      provider: completion.provider,
      model: completion.model,
      ok: completion.ok,
      durationMs: completion.durationMs,
      tokensUsed: completion.tokensUsed,
      errorCode: completion.errorCode,
    },
  })

  if (!completion.ok) {
    return Response.json(
      {
        error: 'The model could not serve this request.',
        code: completion.errorCode ?? 'PROVIDER_ERROR',
        provider: completion.provider,
        correlationId,
      },
      { status: 503 },
    )
  }

  // Persist the turn. A persistence failure must not lose the answer the
  // operator already received, so it is reported rather than thrown.
  let persisted = true
  try {
    await db.chatMessage.createMany({
      data: [
        { conversationId: conversation.id, sender: 'ADMIN', body: message.slice(0, 8000) },
        { conversationId: conversation.id, sender: 'SYSTEM', body: completion.content.slice(0, 8000) },
      ],
    })
    await db.chatConversation.update({
      where: { id: conversation.id },
      data: {
        lastMessageAt: new Date(),
        lastMessagePreview: completion.content.slice(0, 120),
        lastSender: 'SYSTEM',
        unreadCount: 0,
      },
    })
  } catch {
    persisted = false
  }

  return Response.json({
    ok: true,
    sessionId,
    correlationId,
    provider: completion.provider,
    model: completion.model,
    content: completion.content,
    usage: { totalTokens: completion.tokensUsed },
    metrics: { durationMs: completion.durationMs, firstTokenMs: completion.firstTokenMs },
    persisted,
  })
}
