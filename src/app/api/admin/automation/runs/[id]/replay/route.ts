import { NextRequest } from 'next/server'
import { guard, isResponse } from '@/lib/api-guard'
import { audit, sanitizeText } from '@/lib/security'
import { replayAutomationRun } from '@/lib/automation/engine'
import { tenantFor, type GuardedUser } from '@/lib/automation/admin-shared'

export const dynamic = 'force-dynamic'

const REPLAY_ERRORS: Record<string, { status: number; message: string }> = {
  NOT_FOUND: { status: 404, message: 'Run not found' },
  RUN_STILL_ACTIVE: { status: 409, message: 'This run is still in progress — wait until it finishes before replaying.' },
  RULE_NOT_FOUND: { status: 404, message: 'The rule for this run no longer exists.' },
  RULE_DISABLED: { status: 409, message: 'The rule is disabled — enable it before replaying.' },
}

// ADMIN — manual replay: a NEW run against the rule's current version. The
// original run is never mutated. Approval policy and idempotency still apply.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const g = await guard(req, { minRole: 'ADMIN', capability: 'crm.write', limit: { max: 20, windowMs: 60_000 } })
  if (isResponse(g)) return g
  const user = g.user as GuardedUser
  const { id } = await params
  const runId = sanitizeText(id, 40)
  const r = await replayAutomationRun(runId, { email: user.email, tenantId: tenantFor(user) })
  if (!r.ok) {
    const e = REPLAY_ERRORS[r.code] ?? { status: 400, message: 'Replay refused.' }
    return Response.json({ error: e.message, code: r.code }, { status: e.status })
  }
  await audit({ actor: user.email, action: 'AUTOMATION_RUN_REPLAYED', userId: user.id, entityType: 'AutomationRun', entityId: runId, details: { replayRunId: r.runId, status: r.status }, ip: g.ip })
  return Response.json({ ok: true, runId: r.runId, status: r.status })
}
