import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { guard, isResponse } from '@/lib/api-guard'
import { AI_OPERATOR_MIN_ROLE } from '@/lib/ai-workforce-policy'
import { n8nPublicStatus } from '@/lib/n8n/adapter'
import { featureEnabled } from '@/lib/features'
import { tenantFor, type GuardedUser } from '@/lib/automation/admin-shared'

export const dynamic = 'force-dynamic'

// ADMIN — n8n control-plane status: configuration state (variable NAMES only,
// never values), last live connection test, registry and recent executions.
export async function GET(req: NextRequest) {
  const g = await guard(req, { minRole: AI_OPERATOR_MIN_ROLE })
  if (isResponse(g)) return g
  const tenantId = tenantFor(g.user as GuardedUser)
  const [status, enabledBySuperAdmin, workflows, executions, grouped] = await Promise.all([
    n8nPublicStatus(),
    featureEnabled('n8n').catch(() => false),
    db.n8nWorkflow.findMany({
      where: { tenantId },
      orderBy: { code: 'asc' },
      select: { id: true, code: true, name: true, category: true, trigger: true, status: true, enabled: true, webhookPath: true, credentialRefs: true, timeoutMs: true, lastRunAt: true, lastRunStatus: true },
    }),
    db.n8nExecution.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: { id: true, workflowCode: true, correlationId: true, status: true, attempts: true, httpStatus: true, error: true, automationRunId: true, requestedBy: true, callbackReceivedAt: true, finishedAt: true, createdAt: true },
    }),
    db.n8nExecution.groupBy({ by: ['status'], where: { tenantId }, _count: { _all: true } }),
  ])
  return Response.json({
    status: { ...status, featureEnabled: enabledBySuperAdmin },
    workflows: workflows.map((w) => {
      let credentialRefs: string[] = []
      try { credentialRefs = w.credentialRefs ? (JSON.parse(w.credentialRefs) as unknown[]).filter((x): x is string => typeof x === 'string') : [] } catch { credentialRefs = [] }
      return { ...w, credentialRefs }
    }),
    executions,
    executionCounts: Object.fromEntries(grouped.map((x) => [x.status, x._count._all])),
  })
}
