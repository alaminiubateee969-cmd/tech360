import { AI_WORKFORCE_MIN_ROLE } from '@/lib/ai-workforce-policy'
import { NextRequest } from 'next/server'
import { guard, isResponse } from '@/lib/api-guard'
import { readJson, sanitizeText, audit } from '@/lib/security'
import { newCorrelationId } from '@/lib/correlation'
import { routeChat } from '@/lib/model/router'
import { db } from '@/lib/db'

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

  const history = await db.chatMessage.findMany({
    where: { sessionId },
    orderBy: { createdAt: 'asc' },
    take: 12,
    select: { role: true, content: true },
  })

  const messages = [
    ...(system ? [{ role: 'system' as const, content: system }] : []),
    ...history.map((entry) => ({ role: entry.role as 'user' | 'assistant', content: entry.content })),
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

  await db.chatMessage.create({
    data: { sessionId, role: 'user', content: message },
  })
  await db.chatMessage.create({
    data: { sessionId, role: 'assistant', content: completion.content },
  })

  return Response.json({
    ok: true,
    sessionId,
    correlationId,
    provider: completion.provider,
    model: completion.model,
    content: completion.content,
    usage: { totalTokens: completion.tokensUsed },
    metrics: { durationMs: completion.durationMs, firstTokenMs: completion.firstTokenMs },
  })
}
