import { AI_WORKFORCE_MIN_ROLE } from '@/lib/ai-workforce-policy'
import { NextRequest } from 'next/server'
import { guard, isResponse } from '@/lib/api-guard'
import { modelServiceStatus, listLocalModels } from '@/lib/model/router'
import { getAgentProviderStatus } from '@/lib/agents/provider-selection'

export const dynamic = 'force-dynamic'

/**
 * GET /api/models
 *
 * The model registry. It reports three DIFFERENT things and never
 * conflates them:
 *   catalogue — the models the platform is prepared to run
 *   installed — the models actually present on the local model server
 *   providers — the configuration state of every model backend
 *
 * A catalogue entry is a plan; an installed model is a fact.
 */
export async function GET(req: NextRequest) {
  const g = await guard(req, { minRole: AI_WORKFORCE_MIN_ROLE })
  if (isResponse(g)) return g

  const status = modelServiceStatus()
  const installed = await listLocalModels()

  return Response.json({
    service: status.state,
    detail: status.detail,
    gateway: status.gateway,
    agentProvider: getAgentProviderStatus(),
    providers: status.providers.map((provider) => ({
      kind: provider.kind,
      state: provider.state,
      detail: provider.detail,
      privateOnly: provider.privateOnly,
      baseUrl: provider.baseUrl,
      chatModel: provider.chatModel,
      embeddingModel: provider.embeddingModel,
    })),
    catalogue: status.catalog,
    installed: installed.ok ? installed.models : [],
    installedError: installed.ok ? null : installed.error,
    counts: {
      catalogue: status.catalog.length,
      installed: installed.ok ? installed.models.length : 0,
    },
  })
}
