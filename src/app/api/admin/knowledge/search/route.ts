import { NextRequest } from 'next/server'
import { guard, isResponse } from '@/lib/api-guard'
import { readJson, sanitizeText } from '@/lib/security'
import { searchKnowledge } from '@/lib/agents/engine'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const g = await guard(req)
  if (isResponse(g)) return g
  const raw = await readJson(req)
  const query = sanitizeText(raw.query, 300)
  if (query.length < 2) return Response.json({ error: 'query required' }, { status: 400 })
  const results = await searchKnowledge(query, 10)
  return Response.json({
    results: results.map((r) => ({
      title: r.doc.title, score: r.score, classification: r.doc.classification,
      status: r.doc.status, excerpt: (r.doc.extractedText ?? '').slice(0, 400),
    })),
  })
}
