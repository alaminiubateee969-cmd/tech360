import { AI_WORKFORCE_MIN_ROLE } from '@/lib/ai-workforce-policy'
import { featureEnabled } from '@/lib/features'
import { guard, isResponse } from '@/lib/api-guard'
import { readJson, sanitizeText } from '@/lib/security'
import { AgentJobIdempotencyConflict, AgentJobInputError, enqueueAgentJob } from '@/lib/agents/jobs'
import { NextRequest } from 'next/server'

export const dynamic = 'force-dynamic'

/** Queue a durable, idempotent inference request. This does not itself perform external actions. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const g = await guard(req, { minRole: AI_WORKFORCE_MIN_ROLE })
  if (isResponse(g)) return g
  if (!(await featureEnabled('ai_agents'))) {
    return Response.json({ error: 'AI agent execution is currently disabled by Super Admin.' }, { status: 503 })
  }

  const { code } = await params
  const raw = await readJson(req).catch(() => ({} as Record<string, unknown>))
  const input = sanitizeText(raw.input, 12_000)
  if (input.length < 3) return Response.json({ error: 'Input must contain at least 3 characters.' }, { status: 400 })

  const idempotencyKey = sanitizeText(req.headers.get('idempotency-key') ?? String(raw.idempotencyKey ?? ''), 191)
  if (!idempotencyKey) return Response.json({ error: 'Idempotency-Key header is required.' }, { status: 400 })

  const clientId = raw.clientId ? sanitizeText(raw.clientId, 64) : null
  const projectId = raw.projectId ? sanitizeText(raw.projectId, 64) : null
  if (raw.clientId && !clientId) return Response.json({ error: 'Invalid client ID.' }, { status: 400 })
  if (raw.projectId && !projectId) return Response.json({ error: 'Invalid project ID.' }, { status: 400 })

  try {
    const result = await enqueueAgentJob({
      agentCode: sanitizeText(code, 20).toUpperCase(),
      idempotencyKey,
      input,
      expectJson: raw.expectJson === true,
      clientId,
      projectId,
      workflow: 'MANUAL_ADMIN_DURABLE',
      contextNote: `Durable inference requested by authorized admin user ${g.user.id}.`,
      requestedBy: g.user.id,
    })
    return Response.json({
      ok: true,
      created: result.created,
      job: {
        id: result.job.id,
        status: result.job.status,
        approvalState: result.job.approvalState,
        correlationId: result.job.correlationId,
        agentCode: result.job.agentCode,
        createdAt: result.job.createdAt,
      },
      message: result.created ? 'Durable inference job persisted.' : 'Existing idempotent job returned.',
    }, { status: result.created ? 202 : 200 })
  } catch (error) {
    if (error instanceof AgentJobIdempotencyConflict) return Response.json({ error: error.message }, { status: 409 })
    if (error instanceof AgentJobInputError) return Response.json({ error: error.message }, { status: 400 })
    return Response.json({ error: 'Agent job could not be queued.' }, { status: 500 })
  }
}
