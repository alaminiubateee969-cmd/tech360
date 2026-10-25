import { AI_OPERATOR_MIN_ROLE } from '@/lib/ai-workforce-policy'
import { guard, isResponse } from '@/lib/api-guard'
import { readJson, sanitizeText } from '@/lib/security'
import { AgentJobDecisionConflict, AgentJobInputError, decideAgentJob } from '@/lib/agents/jobs'
import { NextRequest } from 'next/server'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const g = await guard(req, { minRole: AI_OPERATOR_MIN_ROLE })
  if (isResponse(g)) return g
  const { id } = await params
  const raw = await readJson(req).catch(() => ({} as Record<string, unknown>))
  const decision = String(raw.decision ?? '').toUpperCase()
  if (decision !== 'APPROVE' && decision !== 'REJECT') return Response.json({ error: 'Decision must be APPROVE or REJECT.' }, { status: 400 })

  try {
    const job = await decideAgentJob({
      id: sanitizeText(id, 64),
      decision,
      actorId: g.user.id,
      note: sanitizeText(raw.note, 2000),
    })
    return Response.json({ ok: true, job: { id: job.id, status: job.status, approvalState: job.approvalState } })
  } catch (error) {
    if (error instanceof AgentJobDecisionConflict) return Response.json({ error: error.message }, { status: 409 })
    if (error instanceof AgentJobInputError) return Response.json({ error: error.message }, { status: 404 })
    return Response.json({ error: 'Agent job decision could not be recorded.' }, { status: 500 })
  }
}
