import { featureEnabled } from "@/lib/features"
import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { guard, isResponse } from '@/lib/api-guard'

export const dynamic = 'force-dynamic'
export async function GET(req: NextRequest) {
  // feature-gate: n8n switch (Super Admin)
  if (!(await featureEnabled('n8n'))) {
    return Response.json({ error: 'n8n integration is currently disabled by Super Admin.' }, { status: 503 })
  }
  const g = await guard(req)
  if (isResponse(g)) return g
  const workflows = await db.n8nWorkflow.findMany({ orderBy: { code: 'asc' } })
  return Response.json({ workflows })
}
