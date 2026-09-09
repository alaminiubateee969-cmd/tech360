import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { guard, isResponse } from '@/lib/api-guard'
import { sanitizeText } from '@/lib/security'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const g = await guard(req)
  if (isResponse(g)) return g
  const url = new URL(req.url)
  const status = sanitizeText(url.searchParams.get('status') ?? 'PENDING', 20).toUpperCase()
  const clientId = sanitizeText(url.searchParams.get('clientId') ?? '', 40)
  const approvals = await db.approvalRequest.findMany({
    where: {
      ...(status === 'ALL' ? {} : { status }),
      ...(clientId ? { client: { OR: [{ id: clientId }, { clientId }] } } : {}),
    },
    orderBy: { createdAt: 'desc' },
    take: 100,
    include: { client: { select: { clientId: true, name: true, businessName: true, pipelineStage: true } } },
  })
  return Response.json({ approvals })
}
