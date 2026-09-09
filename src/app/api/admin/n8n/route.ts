import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { guard, isResponse } from '@/lib/api-guard'

export const dynamic = 'force-dynamic'
export async function GET(req: NextRequest) {
  const g = await guard(req)
  if (isResponse(g)) return g
  const workflows = await db.n8nWorkflow.findMany({ orderBy: { code: 'asc' } })
  return Response.json({ workflows })
}
