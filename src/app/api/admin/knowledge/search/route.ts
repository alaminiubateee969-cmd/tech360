import { NextRequest } from 'next/server'
import { guard, isResponse } from '@/lib/api-guard'
import { readJson, sanitizeText } from '@/lib/security'
import { searchKnowledgeRanked } from '@/lib/knowledge-search'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const g = await guard(req, { minRole: 'MANAGER' })
  if (isResponse(g)) return g
  const raw = await readJson(req)
  const query = sanitizeText(raw.query, 300)
  if (query.length < 2) return Response.json({ error: 'query required' }, { status: 400 })
  const { results, agent } = await searchKnowledgeRanked(query, 8)
  return Response.json({
    results,
    agent,
    aiRanked: results.some((r) => r.rankedBy === 'AI'),
  })
}
