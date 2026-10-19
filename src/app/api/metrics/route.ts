import { AI_WORKFORCE_MIN_ROLE } from '@/lib/ai-workforce-policy'
import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { guard, isResponse } from '@/lib/api-guard'
import { sanitizeText } from '@/lib/security'
import { summariseRegistry } from '@/lib/skills/registry'
import { knowledgeCorpusStats } from '@/lib/rag/pipeline'
import { LOGICAL_AGENT_CATALOGUE } from '@/lib/agents/catalogue'
import { CORE_AGENTS, DEPARTMENTS } from '@/lib/agents/registry'

export const dynamic = 'force-dynamic'

/**
 * GET /api/metrics
 *
 * Operational metrics for the private AI platform. Every number here is
 * read from the live database or the live catalogue — nothing is
 * estimated, and nothing is hard-coded.
 */
export async function GET(req: NextRequest) {
  const g = await guard(req, { minRole: AI_WORKFORCE_MIN_ROLE })
  if (isResponse(g)) return g
  const url = new URL(req.url)
  const hours = Math.max(1, Math.min(720, Math.floor(Number(url.searchParams.get('hours') ?? 24) || 24)))
  const since = new Date(Date.now() - hours * 3_600_000)

  const [
    agentExecutions,
    agentFailures,
    skillRuns,
    skillFailures,
    queuedTasks,
    runningTasks,
    failedTasks,
    pendingApprovals,
    auditEvents,
    errors,
    corpus,
  ] = await Promise.all([
    db.aiAgentExecution.count({ where: { createdAt: { gte: since } } }),
    db.aiAgentExecution.count({ where: { createdAt: { gte: since }, status: { in: ['FAILED', 'TIMEOUT'] } } }),
    db.skillRun.count({ where: { createdAt: { gte: since } } }),
    db.skillRun.count({ where: { createdAt: { gte: since }, status: 'FAILED' } }),
    db.agentJob.count({ where: { status: { in: ['QUEUED', 'RETRYING'] } } }),
    db.agentJob.count({ where: { status: 'RUNNING' } }),
    db.agentJob.count({ where: { status: { in: ['FAILED', 'TIMED_OUT'] } } }),
    db.approvalRequest.count({ where: { status: 'PENDING' } }),
    db.auditLog.count({ where: { createdAt: { gte: since } } }),
    db.errorLog.count({ where: { createdAt: { gte: since } } }),
    knowledgeCorpusStats(),
  ])

  const skillSummary = summariseRegistry()

  return Response.json({
    windowHours: hours,
    generatedAt: new Date().toISOString(),
    agents: {
      executable: CORE_AGENTS.length,
      logicalRegistered: LOGICAL_AGENT_CATALOGUE.length,
      departments: DEPARTMENTS.length,
      executions: agentExecutions,
      failures: agentFailures,
      successRate: agentExecutions > 0 ? Math.round(((agentExecutions - agentFailures) / agentExecutions) * 1000) / 10 : null,
    },
    skills: {
      registered: skillSummary.registered,
      implemented: skillSummary.implemented,
      tested: skillSummary.tested,
      enabled: skillSummary.enabled,
      operational: skillSummary.operational,
      handlers: skillSummary.handlers,
      runs: skillRuns,
      failures: skillFailures,
    },
    tasks: {
      queued: queuedTasks,
      running: runningTasks,
      failed: failedTasks,
    },
    approvals: { pending: pendingApprovals },
    knowledge: corpus,
    platform: {
      auditEvents,
      errors,
    },
  })
}
