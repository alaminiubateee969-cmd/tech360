import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { guard, isResponse } from '@/lib/api-guard'
import { sanitizeText } from '@/lib/security'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const g = await guard(req, { minRole: 'MANAGER' })
  if (isResponse(g)) return g
  const { id } = await params
  const ref = sanitizeText(id, 40)
  const project = await db.project.findFirst({
    where: { OR: [{ id: ref }, { code: ref }] },
    include: {
      client: { select: { id: true, clientId: true, name: true, businessName: true, email: true, whatsapp: true, pipelineStage: true } },
      tasks: { orderBy: { order: 'asc' } },
      payments: { orderBy: { createdAt: 'desc' } },
      invoices: { orderBy: { issuedAt: 'desc' } },
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
    project: { ...projectFields, tasks, payments, scopes, previews, handovers },
    tasks,
    payments,
    invoices,
    scopes,
    previews: previews as unknown as Array<{ id: string; token?: string | null; version?: number | null; status?: string | null; viewCount?: number | null }>,
    handovers,
    reviews,
    delivery: deliveries[0] ?? null,
  })
}
