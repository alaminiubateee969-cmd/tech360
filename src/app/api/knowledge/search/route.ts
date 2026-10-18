import { AI_WORKFORCE_MIN_ROLE } from '@/lib/ai-workforce-policy'
import { NextRequest } from 'next/server'
import { guard, isResponse } from '@/lib/api-guard'
import { readJson, sanitizeText } from '@/lib/security'
import { answerWithEvidence, retrieveContext } from '@/lib/rag/pipeline'
import { isAccessLevel, type AccessLevel } from '@/lib/rag/store'
import { searchKnowledgeRanked } from '@/lib/knowledge-search'

export const dynamic = 'force-dynamic'

/**
 * POST /api/knowledge/search
 *
 * Two honest retrieval modes:
 *
 *   mode "vector" (default) — semantic retrieval over the private
 *     vector index. Every hit carries its source document, chunk index,
 *     score and access level. Results are filtered by the CALLER's
 *     access levels, so a caller can never retrieve a chunk above their
 *     clearance.
 *
 *   mode "lexical" — the pre-existing keyword + AI re-ranking search
 *     over KnowledgeDocument rows.
 *
 *   mode "grounded" — retrieval plus a generated answer that is bound
 *     to the retrieved evidence and abstains when the evidence is
 *     missing.
 */
export async function POST(req: NextRequest) {
  const g = await guard(req, { minRole: AI_WORKFORCE_MIN_ROLE })
  if (isResponse(g)) return g
  const raw = await readJson(req)

  const query = sanitizeText(raw.query, 300)
  if (query.length < 2) {
    return Response.json({ error: 'query is required.', code: 'INVALID_REQUEST' }, { status: 400 })
  }
  const mode = sanitizeText(raw.mode ?? 'vector', 20).toLowerCase()
  const limit = Math.max(1, Math.min(20, Math.floor(Number(raw.limit ?? 6) || 6)))

  // The caller's clearance. A caller may narrow it, never widen it.
  const requested = Array.isArray(raw.accessLevels)
    ? (raw.accessLevels as string[]).map((l) => sanitizeText(l, 20).toUpperCase())
    : []
  const accessLevels: AccessLevel[] = requested.filter(isAccessLevel)
  if (accessLevels.length === 0) accessLevels.push('PUBLIC', 'INTERNAL')

  if (mode === 'lexical') {
    const { results, agent } = await searchKnowledgeRanked(query, limit)
    return Response.json({ mode: 'lexical', results, agent, aiRanked: results.some((r) => r.rankedBy === 'AI') })
  }

  if (mode === 'grounded') {
    const answer = await answerWithEvidence({ query, accessLevels, limit })
    return Response.json({ mode: 'grounded', ...answer })
  }

  if (mode !== 'vector') {
    return Response.json(
      { error: `Unsupported mode "${mode}". Use vector, lexical or grounded.`, code: 'INVALID_REQUEST' },
      { status: 400 },
    )
  }

  const retrieval = await retrieveContext({ query, accessLevels, limit })
  return Response.json({
    mode: 'vector',
    ...retrieval,
    accessLevels,
  })
}
