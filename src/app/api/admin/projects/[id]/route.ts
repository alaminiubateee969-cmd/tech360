import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { guard, isResponse } from '@/lib/api-guard'
import { sanitizeText } from '@/lib/security'
import { hasCapability } from '@/lib/access-policy'
import { projectRecordView } from '@/lib/admin-record-views'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const g = await guard(req, { minRole: 'MANAGER', capability: 'project.read' })
  if (isResponse(g)) return g
  const financeRead = hasCapability(g.user, 'finance.read')
  const privateWorkforceRead = g.user.role === 'SUPER_ADMIN'
  const { id } = await params
  const ref = sanitizeText(id, 40)
  const project = await db.project.findFirst({
    where: { OR: [{ id: ref }, { code: ref }] },
    include: {
      client: { select: { id: true, clientId: true, name: true, businessName: true, email: true, whatsapp: true, pipelineStage: true } },
      tasks: { orderBy: { order: 'asc' }, include: { agentJob: privateWorkforceRead ? { select: { id: true, agentCode: true, status: true, output: true, lastError: true, completedAt: true } } : false } },
      payments: financeRead ? { orderBy: { createdAt: 'desc' } } : false,
      invoices: financeRead ? { orderBy: { issuedAt: 'desc' } } : false,
      scopes: { orderBy: { version: 'desc' } },
      previews: { orderBy: { createdAt: 'desc' }, select: { id: true, token: true, version: true, status: true, viewCount: true, createdAt: true } },
      deliveries: true,
      handovers: true,
      reviews: true,
    },
  })
  if (!project) return Response.json({ error: 'Project not found' }, { status: 404 })
  // Relations also exposed top-level for console consumers (ProjectDetailResponse contract)
  const { tasks, payments, invoices, scopes, previews, deliveries, handovers, reviews, ...projectFields } = project
  return Response.json({
    access: { financeRead, privateWorkforceRead },
    project: { ...projectRecordView(projectFields, financeRead), tasks, payments: financeRead ? payments : null, scopes, previews, handovers },
    tasks,
    payments: financeRead ? payments : null,
    invoices: financeRead ? invoices : null,
    scopes,
    previews: previews as unknown as Array<{ id: string; token?: string | null; version?: number | null; status?: string | null; viewCount?: number | null }>,
    handovers,
    reviews,
    delivery: deliveries[0] ?? null,
  })
}
