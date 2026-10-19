import { NextRequest } from 'next/server'
import { guard, isResponse } from '@/lib/api-guard'
import { hubStatus, routeToModel, MODEL_CATEGORIES, emptyMeasurements } from '@/lib/model/hub'
import { MODEL_CATALOG } from '@/lib/model/registry'

export const dynamic = 'force-dynamic'

/**
 * GET /api/admin/model-hub — the model hub.
 *
 * GET /api/admin/model-hub?route=1&taskType=reasoning&complexity=COMPLEX
 *   — the routing decision for a task, with the reasons for every
 *   contribution. An unmeasured model is reported as unmeasured.
 */
export async function GET(req: NextRequest) {
  const g = await guard(req, { minRole: 'SUPER_ADMIN' })
  if (isResponse(g)) return g

  const params = req.nextUrl.searchParams
  const status = await hubStatus()

  if (params.get('route') === '1') {
    const taskType = (params.get('taskType') ?? 'general') as (typeof MODEL_CATEGORIES)[number]
    const complexity = (params.get('complexity') ?? 'STANDARD') as 'SIMPLE' | 'STANDARD' | 'COMPLEX' | 'ENTERPRISE'
    const language = (params.get('language') ?? 'en') as 'en' | 'bn' | 'any'
    const maxLatencyMs = params.get('maxLatencyMs') ? Number(params.get('maxLatencyMs')) : undefined
    const minQuality = params.get('minQuality') ? Number(params.get('minQuality')) : undefined

    const decision = routeToModel(
      {
        taskType: MODEL_CATEGORIES.includes(taskType) ? taskType : 'general',
        complexity,
        language,
        contextCharacters: Number(params.get('context') ?? 4000),
        requiresStructuredOutput: params.get('structured') === '1',
        requiresToolSelection: params.get('tools') === '1',
        requiresGroundedAnswer: params.get('grounded') === '1',
        maxLatencyMs,
        minQuality,
        preferLowCost: params.get('lowCost') === '1',
      },
      emptyMeasurements(),
    )

    return Response.json({
      decision: {
        ok: decision.ok,
        reason: decision.reason,
        chain: decision.chain,
        selected: decision.selected
          ? {
              slug: decision.selected.descriptor.slug,
              upstreamModel: decision.selected.descriptor.upstreamModel,
              displayName: decision.selected.descriptor.displayName,
              parameters: decision.selected.descriptor.parameters,
              quantization: decision.selected.descriptor.quantization,
              ramFootprintMb: decision.selected.descriptor.ramFootprintMb,
              contextWindow: decision.selected.descriptor.contextWindow,
              languages: decision.selected.descriptor.languages,
              license: decision.selected.descriptor.license,
              licenseVerified: decision.selected.descriptor.licenseVerified,
              weightsVerified: decision.selected.descriptor.weightsVerified,
              score: decision.selected.score,
              reasons: decision.selected.reasons,
              installed: decision.selected.installed,
              measuredFirstTokenMs: decision.selected.measuredFirstTokenMs,
              measuredQuality: decision.selected.measuredQuality,
              measuredCostPer1k: decision.selected.measuredCostPer1k,
            }
          : null,
        candidates: decision.candidates.map((candidate) => ({
          slug: candidate.descriptor.slug,
          upstreamModel: candidate.descriptor.upstreamModel,
          score: candidate.score,
          reasons: candidate.reasons,
          installed: candidate.installed,
        })),
      },
      status,
    })
  }

  return Response.json({
    status,
    categories: MODEL_CATEGORIES,
    catalog: MODEL_CATALOG.map((entry) => ({
      slug: entry.slug,
      upstreamModel: entry.upstreamModel,
      displayName: entry.displayName,
      provider: entry.provider,
      purpose: entry.purpose,
      parameters: entry.parameters,
      quantization: entry.quantization,
      ramFootprintMb: entry.ramFootprintMb,
      contextWindow: entry.contextWindow,
      embeddingDimensions: entry.embeddingDimensions,
      license: entry.license,
      licenseVerified: entry.licenseVerified,
      weightsVerified: entry.weightsVerified,
      revision: entry.revision,
      weightChecksum: entry.weightChecksum,
      languages: entry.languages,
      acceptance: entry.acceptance,
      notes: entry.notes,
    })),
  })
}
