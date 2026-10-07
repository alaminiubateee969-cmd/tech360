import { NextRequest } from 'next/server'
import { AI_WORKFORCE_MIN_ROLE } from '@/lib/ai-workforce-policy'
import { guard, isResponse } from '@/lib/api-guard'
import { audit } from '@/lib/security'
import { ensureAgentRegistry, getBootstrapReport } from '@/lib/agents/bootstrap'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const guarded = await guard(req, { minRole: AI_WORKFORCE_MIN_ROLE })
  if (isResponse(guarded)) return guarded
  return Response.json(await getBootstrapReport())
}

export async function POST(req: NextRequest) {
  const guarded = await guard(req, { minRole: AI_WORKFORCE_MIN_ROLE })
  if (isResponse(guarded)) return guarded
  await ensureAgentRegistry()
  const report = await getBootstrapReport()
  await audit({
    actor: guarded.user.email,
    action: 'AI_AGENT_REGISTRY_BOOTSTRAP',
    userId: guarded.user.id,
    details: report,
  })
  return Response.json(report, { status: report.healthy ? 200 : 503 })
}
