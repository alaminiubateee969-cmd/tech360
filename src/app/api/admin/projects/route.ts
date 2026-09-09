import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { guard, isResponse } from '@/lib/api-guard'
import { sanitizeText } from '@/lib/security'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const g = await guard(req)
  if (isResponse(g)) return g
  const url = new URL(req.url)
  const status = sanitizeText(url.searchParams.get('status') ?? '', 30).toUpperCase()
  const projects = await db.project.findMany({
    where: status ? { status } : {},
    orderBy: { updatedAt: 'desc' }, take: 200,
    include: { client: { select: { clientId: true, name: true, businessName: true, pipelineStage: true } }, _count: { select: { tasks: true } } },
  })
  return Response.json({ projects })
}
