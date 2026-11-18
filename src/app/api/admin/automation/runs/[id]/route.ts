import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { guard, isResponse } from '@/lib/api-guard'
import { sanitizeText } from '@/lib/security'
import { safeParse, serializeRun, tenantFor, type GuardedUser } from '@/lib/automation/admin-shared'

export const dynamic = 'force-dynamic'

// ADMIN — one run: step log, triggering event, approval and n8n executions.
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const g = await guard(req, { minRole: 'ADMIN' })
  if (isResponse(g)) return g
  const tenantId = tenantFor(g.user as GuardedUser)
  const { id } = await params
  const run = await db.automationRun.findFirst({ where: { id: sanitizeText(id, 40), tenantId } })
  if (!run) return Response.json({ error: 'Run not found', code: 'NOT_FOUND' }, { status: 404 })
  const [rule, event, approval, executions, replays] = await Promise.all([
    db.automationRule.findFirst({ where: { id: run.ruleId, tenantId }, select: { id: true, name: true, key: true, version: true, status: true } }),
    db.automationEvent.findFirst({ where: { id: run.eventId, tenantId } }),
    run.approvalId ? db.approvalRequest.findUnique({ where: { id: run.approvalId }, select: { id: true, status: true, title: true, decidedBy: true, decisionNote: true, createdAt: true, executedAt: true } }) : Promise.resolve(null),
    db.n8nExecution.findMany({ where: { tenantId, automationRunId: run.id }, orderBy: { createdAt: 'desc' }, select: { id: true, workflowCode: true, correlationId: true, status: true, attempts: true, httpStatus: true, error: true, createdAt: true, finishedAt: true } }),
    db.automationRun.findMany({ where: { tenantId, replayOfId: run.id }, orderBy: { createdAt: 'desc' }, select: { id: true, status: true, createdAt: true, triggeredBy: true } }),
  ])
  return Response.json({
    run: serializeRun(run, rule?.name),
    rule,
    event: event ? { id: event.id, type: event.type, source: event.source, subjectType: event.subjectType, subjectId: event.subjectId, payload: safeParse<unknown>(event.payload, null), status: event.status, createdAt: event.createdAt, error: event.error } : null,
    approval,
    n8nExecutions: executions,
    replays,
  })
}
