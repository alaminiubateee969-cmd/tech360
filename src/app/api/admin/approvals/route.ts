import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { guard, isResponse } from '@/lib/api-guard'
import { sanitizeText } from '@/lib/security'
import { hasCapability } from '@/lib/access-policy'
import { approvalReadWhere, approvalReadSelect, approvalRecordView } from '@/lib/admin-record-views'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const g = await guard(req, { minRole: 'MANAGER', capability: 'crm.read' })
  if (isResponse(g)) return g
  const detailsRead = g.user.role === 'SUPER_ADMIN'
  const financeRead = hasCapability(g.user, 'finance.read')
  const url = new URL(req.url)
  const status = sanitizeText(url.searchParams.get('status') ?? 'PENDING', 20).toUpperCase()
  const clientId = sanitizeText(url.searchParams.get('clientId') ?? '', 40)
  const approvals = await db.approvalRequest.findMany({
    where: {
      ...approvalReadWhere(detailsRead, financeRead),
      ...(status === 'ALL' ? {} : { status }),
      ...(clientId ? { client: { OR: [{ id: clientId }, { clientId }] } } : {}),
    },
    orderBy: { createdAt: 'desc' },
    take: 100,
    select: { ...approvalReadSelect(detailsRead), client: { select: { clientId: true, name: true, businessName: true, pipelineStage: true } } },
  })
  return Response.json({ access: { detailsRead, visibility: detailsRead ? 'ALL' : 'PERMITTED_STATUS_ONLY' }, approvals: approvals.map((approval) => approvalRecordView(approval, detailsRead)) })
}
