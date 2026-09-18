import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { guard, isResponse } from '@/lib/api-guard'
import { sanitizeText } from '@/lib/security'
import { PIPELINE_STAGES } from '@/lib/constants'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const g = await guard(req, { minRole: 'STAFF' })
  if (isResponse(g)) return g
  const url = new URL(req.url)
  const query = sanitizeText(url.searchParams.get('query') ?? '', 100)
  const stage = sanitizeText(url.searchParams.get('stage') ?? '', 40).toUpperCase()
  const status = sanitizeText(url.searchParams.get('status') ?? '', 40).toUpperCase()
  const page = Math.max(1, Number(url.searchParams.get('page') ?? 1) || 1)
  const perPage = 20

  const where = {
    deletedAt: null,
    ...(stage && PIPELINE_STAGES.includes(stage as (typeof PIPELINE_STAGES)[number]) ? { pipelineStage: stage } : {}),
    ...(status ? { status } : {}),
    ...(query ? {
      OR: [
        { clientId: { contains: query } }, { name: { contains: query } },
        { businessName: { contains: query } }, { email: { contains: query } },
        { whatsapp: { contains: query } }, { businessType: { contains: query } },
      ],
    } : {}),
  }

  const [clients, total] = await Promise.all([
    db.client.findMany({
      where, orderBy: { updatedAt: 'desc' },
      skip: (page - 1) * perPage, take: perPage,
      select: {
        id: true, clientId: true, name: true, businessName: true, businessType: true,
        email: true, whatsapp: true, country: true, source: true, status: true,
        pipelineStage: true, score: true, createdAt: true, updatedAt: true,
      },
    }),
    db.client.count({ where }),
  ])
  return Response.json({ clients, total, page, perPage })
}
