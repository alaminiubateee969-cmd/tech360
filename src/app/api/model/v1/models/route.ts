import { authenticateModelRequest, enforceGatewayRateLimit } from '@/lib/model/gateway'
import { listLocalModels, modelServiceStatus } from '@/lib/model/router'
import { apiError } from '@/lib/security'

export const dynamic = 'force-dynamic'

/**
 * GET /api/model/v1/models
 *
 * Reports the model catalogue the platform is prepared to run, and which
 * of those models are ACTUALLY installed on the local model server. The
 * two are reported separately: a catalogue entry is a plan, an installed
 * model is a fact.
 */
export async function GET(req: Request) {
  const auth = authenticateModelRequest(req)
  if (!auth.ok) return apiError(auth.message, auth.status, auth.code)

  const limit = enforceGatewayRateLimit(req, auth.keyId)
  if (!limit.ok) {
    return Response.json(
      { error: 'Too many model requests', code: 'RATE_LIMITED', retryAfter: limit.retryAfter },
      { status: 429, headers: { 'Retry-After': String(limit.retryAfter) } },
    )
  }

  const status = modelServiceStatus()
  const installed = await listLocalModels()

  return Response.json({
    service: status.state,
    detail: status.detail,
    gateway: status.gateway,
    providers: status.providers.map((p) => ({
      kind: p.kind,
      state: p.state,
      detail: p.detail,
      privateOnly: p.privateOnly,
      baseUrl: p.baseUrl,
      chatModel: p.chatModel,
      embeddingModel: p.embeddingModel,
    })),
    catalogue: status.catalog,
    installed: installed.ok ? installed.models : [],
    installedError: installed.ok ? null : installed.error,
  })
}
