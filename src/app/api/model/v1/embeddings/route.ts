import { audit, apiError, readJson } from '@/lib/security'
import {
  authenticateModelRequest,
  enforceGatewayRateLimit,
  newModelCorrelationId,
  promptDigest,
} from '@/lib/model/gateway'
import { routeEmbed } from '@/lib/model/router'

export const dynamic = 'force-dynamic'

/**
 * POST /api/model/v1/embeddings
 *
 * PRIVATE embedding endpoint. Same authentication, rate limiting and
 * audit rules as /api/model/v1/chat.
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
  const input = body.input
  const inputs: string[] =
    typeof input === 'string'
      ? [input]
      : Array.isArray(input)
        ? input.filter((v): v is string => typeof v === 'string')
        : []
  if (inputs.length === 0) return apiError('input must be a string or an array of strings', 400, 'INVALID_REQUEST')
  if (inputs.length > 64) return apiError('at most 64 inputs may be embedded in one request', 400, 'INVALID_REQUEST')
  if (inputs.some((v) => v.length > 16_000)) {
    return apiError('each input may contain at most 16000 characters', 400, 'INVALID_REQUEST')
  }

  const correlationId = newModelCorrelationId()
  const result = await routeEmbed({
    input: inputs.length === 1 ? inputs[0] : inputs,
    model: typeof body.model === 'string' ? body.model : undefined,
    correlationId,
  })

  await audit({
    actor: `model-gateway:${auth.keyId}`,
    action: 'MODEL_EMBEDDING',
    entityType: 'ModelCall',
    entityId: correlationId,
    details: {
      provider: result.provider,
      model: result.model,
      ok: result.ok,
      durationMs: result.durationMs,
      dimensions: result.dimensions,
      inputCount: inputs.length,
      promptDigest: promptDigest(inputs.join('\n')),
      errorCode: result.errorCode,
    },
    ip: req.headers.get('x-forwarded-for') ?? undefined,
    userAgent: req.headers.get('user-agent') ?? undefined,
  })

  if (!result.ok) {
    return Response.json(
      {
        error: 'The embedding model could not serve this request',
        code: result.errorCode ?? 'PROVIDER_ERROR',
        correlationId,
        provider: result.provider,
      },
      { status: 503 },
    )
  }

  return Response.json({
    id: correlationId,
    provider: result.provider,
    model: result.model,
    data: result.vectors.map((embedding, index) => ({ index, embedding })),
    dimensions: result.dimensions,
    metrics: { durationMs: result.durationMs },
  })
}
