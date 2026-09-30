import { AI_WORKFORCE_MIN_ROLE } from '@/lib/ai-workforce-policy'
import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { guard, isResponse } from '@/lib/api-guard'
import { sanitizeText } from '@/lib/security'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const g = await guard(req, { minRole: AI_WORKFORCE_MIN_ROLE })
  if (isResponse(g)) return g
  const url = new URL(req.url)
  const status = sanitizeText(url.searchParams.get('status') ?? '', 20).toUpperCase()
  const q = sanitizeText(url.searchParams.get('q') ?? '', 100)
  const docs = await db.knowledgeDocument.findMany({
    where: {
      ...(status ? { status } : {}),
      ...(q ? { OR: [{ title: { contains: q } }, { extractedText: { contains: q } }] } : {}),
    },
    orderBy: { createdAt: 'desc' }, take: 200,
  })
  return Response.json({ docs })
}
