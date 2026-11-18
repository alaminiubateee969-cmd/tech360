import { NextRequest } from 'next/server'
import { guard, isResponse } from '@/lib/api-guard'
import { audit, readJson, sanitizeText } from '@/lib/security'
import { N8nWorkflowNotFoundError, requestN8nExecution } from '@/lib/n8n/adapter'
import { AI_WORKFORCE_MIN_ROLE } from '@/lib/ai-workforce-policy'
import { featureEnabled } from '@/lib/features'
import { redactSensitiveCrmData } from '@/lib/sensitive-redaction'
import { tenantFor, type GuardedUser } from '@/lib/automation/admin-shared'

export const dynamic = 'force-dynamic'

// SUPER ADMIN — request a manual n8n execution of a registered, enabled workflow.
// The response reports the REAL outcome: ACCEPTED (n8n took it; the final
// state arrives via the signed callback), FAILED, NOT_CONFIGURED or DISABLED.
export async function POST(req: NextRequest) {
  const g = await guard(req, { minRole: AI_WORKFORCE_MIN_ROLE, limit: { max: 20, windowMs: 60_000 } })
  if (isResponse(g)) return g
  if (!(await featureEnabled('n8n').catch(() => false))) {
    return Response.json({ error: 'n8n integration is currently disabled by Super Admin.', code: 'FEATURE_DISABLED' }, { status: 503 })
  }
  const user = g.user as GuardedUser
  const raw = await readJson(req)
  const workflowCode = sanitizeText(raw.workflowCode, 80)
  if (!workflowCode) return Response.json({ error: 'workflowCode is required', code: 'WORKFLOW_REQUIRED' }, { status: 400 })
  const payloadRaw = raw.payload && typeof raw.payload === 'object' && !Array.isArray(raw.payload) ? (raw.payload as Record<string, unknown>) : {}
  const payloadJson = JSON.stringify(payloadRaw)
  if (payloadJson.length > 20_000) return Response.json({ error: 'Payload too large (20 KB max).', code: 'PAYLOAD_TOO_LARGE' }, { status: 413 })
  const payload = JSON.parse(redactSensitiveCrmData(payloadJson).text) as Record<string, unknown>
  try {
    const execution = await requestN8nExecution({ tenantId: tenantFor(user), workflowCode, payload, requestedBy: user.email })
    await audit({ actor: user.email, action: 'N8N_EXECUTION_REQUESTED', userId: user.id, entityType: 'N8nExecution', entityId: execution.id, details: { workflowCode, status: execution.status, correlationId: execution.correlationId }, ip: g.ip })
    const ok = execution.status === 'ACCEPTED'
    return Response.json({
      ok,
      execution: { id: execution.id, correlationId: execution.correlationId, status: execution.status, attempts: execution.attempts, httpStatus: execution.httpStatus, error: execution.error },
      message: ok
        ? 'n8n accepted the request. The final result arrives through the signed callback.'
        : execution.error ?? `Execution ${execution.status.toLowerCase()}.`,
    }, { status: ok ? 202 : execution.status === 'FAILED' ? 502 : 409 })
  } catch (error) {
    if (error instanceof N8nWorkflowNotFoundError) return Response.json({ error: 'Workflow not found in the registry.', code: 'WORKFLOW_NOT_FOUND' }, { status: 404 })
    throw error
  }
}
