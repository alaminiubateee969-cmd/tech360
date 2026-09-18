import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { guard, isResponse } from '@/lib/api-guard'

export const dynamic = 'force-dynamic'
export async function GET(req: NextRequest) {
  const g = await guard(req, { minRole: 'MANAGER' })
  if (isResponse(g)) return g
  const logs = await db.auditLog.findMany({ orderBy: { createdAt: 'desc' }, take: 50 })
  return Response.json({ logs })
}
