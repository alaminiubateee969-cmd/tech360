import { NextRequest } from 'next/server'
import { guard, isResponse } from '@/lib/api-guard'
import { generateCeoReport } from '@/lib/reports'

export const dynamic = 'force-dynamic'
export async function GET(req: NextRequest) {
  const g = await guard(req)
  if (isResponse(g)) return g
  const report = await generateCeoReport(g.user.id)
  return Response.json({ report, generatedAt: new Date().toISOString() })
}
