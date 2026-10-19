import { NextRequest } from 'next/server'
import { guard, isResponse } from '@/lib/api-guard'
import { graphStats, findEntities, neighbourhood, relationBetween } from '@/lib/knowledge/graph'
import { ACCESS_LEVELS, type AccessLevel } from '@/lib/rag/store'
import { audit } from '@/lib/security'

export const dynamic = 'force-dynamic'

/**
 * GET /api/admin/knowledge-graph — the knowledge graph.
 *
 * The graph is a SECOND INDEX over the same corpus as the RAG store,
 * not a second corpus. Every entity carries a source and an access
 * level, and the access filter is applied in the application.
 *
 * POST /api/admin/knowledge-graph — build the structural edges that
 * are true by construction (the organisation, the procedures, the
 * tools). The write is audited.
 */
export async function GET(req: NextRequest) {
  const g = await guard(req, { minRole: 'SUPER_ADMIN' })
  if (isResponse(g)) return g

  const params = req.nextUrl.searchParams
  const query = params.get('q')
  const key = params.get('key')
  const access = (params.get('access') ?? 'PUBLIC,INTERNAL,CONFIDENTIAL').split(',').filter((level) => ACCESS_LEVELS.includes(level as AccessLevel)) as AccessLevel[]
  const accessLevels = access.length > 0 ? access : (['PUBLIC', 'INTERNAL'] as AccessLevel[])

  const stats = await graphStats()

  if (key) {
    const [neighbours, relations] = await Promise.all([
      neighbourhood(key, { accessLevels, depth: 2, limit: 100 }),
      relationBetween(key, key, { accessLevels }),
    ])
    return Response.json({ entity: key, neighbours, relations, stats })
  }

  if (query) {
    const entities = await findEntities(query, { accessLevels, limit: 25 })
    return Response.json({ query, entities, stats })
  }

  return Response.json({ stats, accessLevels })
}

export async function POST(req: NextRequest) {
  const g = await guard(req, { minRole: 'SUPER_ADMIN' })
  if (isResponse(g)) return g

  const { buildStructuralGraph } = await import('@/lib/knowledge/graph')
  const result = await buildStructuralGraph({ assertedBy: g.user.email })
  await audit({
    actor: g.user.email,
    action: 'KNOWLEDGE_GRAPH_REBUILT',
    userId: g.user.id,
    entityType: 'KnowledgeEntity',
    entityId: 'structural',
    details: result,
  })
  const stats = await graphStats()
  return Response.json({ ...result, stats })
}
