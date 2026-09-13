import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { guard, isResponse } from '@/lib/api-guard'
import { sanitizeText } from '@/lib/security'

export const dynamic = 'force-dynamic'

// GET /api/admin/reports/[id] — one archived report, full content
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const g = await guard(req, { minRole: 'MANAGER' })
  if (isResponse(g)) return g
  const { id } = await params
  const report = await db.ceoReport.findUnique({ where: { id: sanitizeText(id, 40) } })
  if (!report) return Response.json({ error: 'Report not found' }, { status: 404 })
  return Response.json({ report })
}
