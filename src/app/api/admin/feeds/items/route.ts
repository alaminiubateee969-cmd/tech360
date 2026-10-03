import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { guard, isResponse } from '@/lib/api-guard'
import { sanitizeText } from '@/lib/security'

export const dynamic = 'force-dynamic'

// GET /api/admin/feeds/items?sourceId=&q= — ingested signals, newest first.
export async function GET(req: NextRequest) {
  const g = await guard(req, { minRole: 'STAFF' })
  if (isResponse(g)) return g

  const url = new URL(req.url)
  const sourceId = sanitizeText(url.searchParams.get('sourceId') ?? '', 40)
  const q = sanitizeText(url.searchParams.get('q') ?? '', 80)

  const items = await db.feedItem.findMany({
    where: { ...(sourceId ? { sourceId } : {}), ...(q ? { title: { contains: q } } : {}) },
    orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }],
    take: 200,
  })
  type SourceRef = { id: string; name: string; category: string }
  const sources: SourceRef[] = await db.feedSource.findMany({ select: { id: true, name: true, category: true } })
  const nameById = new Map<string, SourceRef>(sources.map((s) => [s.id, s]))

  return Response.json({
    items: items.map((i) => ({
      ...i,
      tags: safeTags(i.tags),
      sourceName: nameById.get(i.sourceId)?.name ?? 'Unknown source',
      sourceCategory: nameById.get(i.sourceId)?.category ?? 'INDUSTRY',
    })),
    total: items.length,
  })
}

function safeTags(raw: string): string[] {
  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.filter((t): t is string => typeof t === 'string') : []
  } catch {
    return []
  }
}
