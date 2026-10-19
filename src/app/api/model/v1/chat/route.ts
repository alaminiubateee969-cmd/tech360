import { audit, apiError, readJson } from '@/lib/security'
import {
  authenticateModelRequest,
  enforceGatewayRateLimit,
  newModelCorrelationId,
  normaliseChatRequest,
  promptDigest,
} from '@/lib/model/gateway'
import { routeChat } from '@/lib/model/router'

export const dynamic = 'force-dynamic'

/**
 * POST /api/model/v1/chat
 *
 * PRIVATE model inference endpoint. It is authenticated with the model
 * API key (not a browser session), rate limited, and every call is
 * written to the audit trail. The route MUST be kept off the public
 * internet by the reverse proxy — see docs/deployment/DEPLOYMENT_GUIDE.md.
 */
export async function POST(req: Request) {
  const auth = authenticateModelRequest(req)
  if (!auth.ok) return apiError(auth.message, auth.status, auth.code)

  const limit = enforceGatewayRateLimit(req, auth.keyId)
  if (!limit.ok) {
    return Response.json(
      { error: 'Too many model requests', code: 'RATE_LIMITED', retryAfter: limit.retryAfter },
      { status: 429, headers: { 'Retry-After': String(limit.retryAfter) } },
    )
  }

  const body = await readJson(req)
  const normalised = normaliseChatRequest(body)
  if (!normalised.ok) return apiError(normalised.message, 400, 'INVALID_REQUEST')

  const correlationId = newModelCorrelationId()
  const started = Date.now()
  const result = await routeChat({
    ...normalised.value,
    correlationId,
  })

  await audit({
    actor: `model-gateway:${auth.keyId}`,
    action: 'MODEL_INFERENCE',
    entityType: 'ModelCall',
    entityId: correlationId,
    details: {
      provider: result.provider,
      model: result.model,
      ok: result.ok,
      durationMs: result.durationMs,
      firstTokenMs: result.firstTokenMs,
      tokensUsed: result.tokensUsed,
      messageCount: normalised.value.messages.length,
      promptDigest: promptDigest(normalised.value.messages.map((m) => m.content).join('\n')),
      errorCode: result.errorCode,
    },
    ip: req.headers.get('x-forwarded-for') ?? undefined,
    userAgent: req.headers.get('user-agent') ?? undefined,
  })

  if (!result.ok) {
    return Response.json(
      {
        error: 'The model could not serve this request',
        code: result.errorCode ?? 'PROVIDER_ERROR',
        correlationId,
        // The provider's raw message is intentionally not echoed to the client:
        // it can contain upstream URLs and internal hostnames.
        provider: result.provider,
      },
      { status: 503 },
    )
  }

  return Response.json({
    id: correlationId,
    provider: result.provider,
    model: result.model,
    content: result.content,
    finishReason: result.finishReason,
    usage: { totalTokens: result.tokensUsed },
    metrics: { durationMs: result.durationMs, firstTokenMs: result.firstTokenMs },
  })
}
