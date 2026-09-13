import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { rateLimit, clientIp } from '@/lib/security'

export const dynamic = 'force-dynamic'

function authorized(req: NextRequest): boolean {
  const secret = process.env.OPS_SECRET
  return Boolean(secret) && req.headers.get('x-ops-secret') === secret
}

// AI Operations scan: everything the autonomous loop needs to decide.
// Real database queries — no fabrication.
export async function GET(req: NextRequest) {
  if (!authorized(req)) return Response.json({ error: 'Unauthorized' }, { status: 401 })
  const rl = rateLimit(`ops-scan:${clientIp(req)}`, 120, 60_000)
  if (!rl.ok) return Response.json({ error: 'Too many requests' }, { status: 429 })

  const now = Date.now()
  const overdueMs = 48 * 3600 * 1000 // 48h without activity before CLIENT_APPROVAL
  const dayAgo = new Date(now - 24 * 3600 * 1000)

  const [unscoredLeads, activeClients, retryableComms, failedAutomations, unresolvedErrors, staleApprovals, expiringPreviews, execToday, agentStats] = await Promise.all([
    db.client.findMany({ where: { score: 0, deletedAt: null }, select: { id: true, clientId: true, name: true, businessName: true, businessType: true, source: true, lead: { select: { requirements: true, budgetRange: true, projectType: true } } }, take: 10 }),
    db.client.findMany({
      where: { deletedAt: null, pipelineStage: { in: ['NEW', 'CONTACTED', 'BUSINESS_IDENTIFIED', 'PLAN_RECOMMENDED', 'SCOPE_COLLECTION', 'SCOPE_REVIEW', 'FINAL_SCOPE'] }, updatedAt: { lt: new Date(now - overdueMs) } },
      select: { id: true, clientId: true, name: true, whatsapp: true, email: true, pipelineStage: true, updatedAt: true },
      take: 10,
    }),
    db.communication.findMany({ where: { status: 'FAILED', direction: 'OUT', createdAt: { gte: new Date(now - 7 * 24 * 3600 * 1000) } }, orderBy: { createdAt: 'asc' }, take: 10, select: { id: true, clientId: true, channel: true, recipient: true, body: true, subject: true, error: true } }),
    db.automationLog.findMany({ where: { status: 'FAILED', startedAt: { gte: new Date(now - 24 * 3600 * 1000) } }, orderBy: { startedAt: 'desc' }, take: 10, select: { id: true, workflow: true, error: true, correlationId: true, clientId: true } }),
    db.errorLog.findMany({ where: { resolved: false, createdAt: { gte: new Date(now - 24 * 3600 * 1000) } }, orderBy: { createdAt: 'desc' }, take: 10, select: { id: true, source: true, code: true, message: true, correlationId: true } }),
    db.approvalRequest.findMany({ where: { status: 'PENDING', createdAt: { lt: new Date(now - 12 * 3600 * 1000) } }, take: 10, select: { id: true, type: true, title: true, clientId: true, createdAt: true } }),
    // security: previews past expiry that are still active → must be marked EXPIRED + alert
    db.preview.findMany({ where: { status: { in: ['GENERATED', 'SENT', 'VIEWED'] }, expiresAt: { lt: new Date(now) } }, take: 10, select: { id: true, token: true, clientId: true, status: true, expiresAt: true, version: true } }),
    db.aiAgentExecution.count({ where: { createdAt: { gte: dayAgo } } }),
    db.aiAgent.aggregate({ _count: true, _sum: { executionCount: true, successCount: true, failureCount: true } }),
  ])

  return Response.json({
    ts: new Date().toISOString(),
    unscoredLeads,
    overdueLeads: activeClients,
    retryableComms,
    failedAutomations,
    unresolvedErrors,
    staleApprovals,
    expiredPreviews: expiringPreviews,
    context: {
      agentExecutions24h: execToday,
      agents: agentStats._count,
      totalExecutions: agentStats._sum.executionCount ?? 0,
      totalSuccesses: agentStats._sum.successCount ?? 0,
      totalFailures: agentStats._sum.failureCount ?? 0,
    },
  })
}
