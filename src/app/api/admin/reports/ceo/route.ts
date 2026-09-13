import { NextRequest } from 'next/server'
import { guard, isResponse } from '@/lib/api-guard'
import { generateCeoReport } from '@/lib/reports'

export const dynamic = 'force-dynamic'
export const maxDuration = 120

// POST /api/admin/reports/ceo — generate NOW from live data.
// The report is persisted to the CeoReport archive (trigger MANUAL)
// so the executive trail keeps every briefing the AI workforce issued.
export async function POST(req: NextRequest) {
  const g = await guard(req, { minRole: 'MANAGER' })
  if (isResponse(g)) return g
  const result = await generateCeoReport(g.user.id, 'MANUAL')
  return Response.json({ report: result.content, id: result.id, agentRuns: result.agentRuns, durationMs: result.durationMs, generatedAt: result.generatedAt })
}

// Back-compat: GET behaves like POST (admin-triggered generation)
export async function GET(req: NextRequest) {
  const g = await guard(req, { minRole: 'MANAGER' })
  if (isResponse(g)) return g
  const result = await generateCeoReport(g.user.id, 'MANUAL')
  return Response.json({ report: result.content, id: result.id, agentRuns: result.agentRuns, durationMs: result.durationMs, generatedAt: result.generatedAt })
}
