import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { canViewFinancialDashboard, hasRole } from '@/lib/access-policy'
import { guard, isResponse } from '@/lib/api-guard'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const g = await guard(req, { minRole: 'STAFF' })
  if (isResponse(g)) return g

  // Financial aggregates are restricted to the existing MANAGER+ hierarchy.
  // STAFF still sees operational totals, but never revenue/receivable values.
  const canViewFinancials = canViewFinancialDashboard(g.user)
  const now = new Date()
  const dayAgo = new Date(now.getTime() - 24 * 3600 * 1000)
  const weekAgo = new Date(now.getTime() - 7 * 24 * 3600 * 1000)
  const nextWeek = new Date(now.getTime() + 7 * 24 * 3600 * 1000)

  const [totalLeads, newLeads, newLeadsWeek, qualifiedLeads, clients, activeProjects, awaitingApprovalProjects,
    paymentPending, paidProjects, completedProjects, openTasks, unreadComms, failedAutomations,
    pendingAdminApprovals, unpaidProjects, outstandingProjects, paidAgg, pipeline, revenuePayments,
    recentLeads, recentAudit, failedComms, pendingPaymentVerifications, overdueTasks, upcomingDeadlines,
    pendingRefunds, approvedRefunds, emailQueued, emailSent, emailFailed, verifiedEmailIdentities,
    handoversAwaitingPayment, handoversAwaitingConfirmation,
  ] = await Promise.all([
    db.client.count({ where: { status: 'LEAD' } }),
    db.client.count({ where: { createdAt: { gte: dayAgo } } }),
    db.client.count({ where: { createdAt: { gte: weekAgo } } }),
    db.client.count({ where: { pipelineStage: { in: ['BUSINESS_IDENTIFIED', 'PLAN_RECOMMENDED', 'SCOPE_COLLECTION', 'SCOPE_REVIEW', 'FINAL_SCOPE'] } } }),
    db.client.count({ where: { status: { in: ['CLIENT', 'ACTIVE', 'COMPLETED'] } } }),
    db.project.count({ where: { status: { in: ['ACTIVE', 'DEVELOPMENT', 'TESTING', 'CLIENT_REVIEW', 'DELIVERY', 'HANDOVER'] } } }),
    db.approvalRequest.count({ where: { status: 'PENDING' } }),
    db.client.count({ where: { pipelineStage: 'PAYMENT_PENDING' } }),
    canViewFinancials ? db.project.count({ where: { paymentStatus: 'PAID' } }) : Promise.resolve(null),
    db.project.count({ where: { status: 'COMPLETED' } }),
    db.projectTask.count({ where: { status: { in: ['TODO', 'IN_PROGRESS', 'REVIEW', 'BLOCKED'] } } }),
    db.communication.count({ where: { direction: 'IN', status: 'RECEIVED' } }),
    db.automationLog.count({ where: { status: 'FAILED' } }),
    db.approvalRequest.count({ where: { status: 'PENDING' } }),
    canViewFinancials ? db.project.count({ where: { paymentStatus: { in: ['PENDING', 'PARTIAL'] } } }) : Promise.resolve(null),
    canViewFinancials
      ? db.project.findMany({ where: { paymentStatus: { in: ['PENDING', 'PARTIAL'] }, status: { not: 'CANCELLED' } }, select: { totalAmount: true, paidAmount: true } })
      : Promise.resolve([]),
    canViewFinancials
      ? db.payment.aggregate({ where: { status: 'PAID' }, _sum: { amount: true } })
      : Promise.resolve({ _sum: { amount: null } }),

    db.client.groupBy({ by: ['pipelineStage'], _count: true }),
    canViewFinancials
      ? db.payment.findMany({ where: { status: 'PAID', verifiedAt: { gte: new Date(now.getTime() - 180 * 24 * 3600 * 1000) } }, select: { amount: true, verifiedAt: true } })
      : Promise.resolve([]),
    db.client.findMany({ orderBy: { createdAt: 'desc' }, take: 8, select: { id: true, clientId: true, name: true, businessName: true, businessType: true, source: true, pipelineStage: true, createdAt: true } }),
    db.auditLog.findMany({ orderBy: { createdAt: 'desc' }, take: 10, select: { actor: true, action: true, clientId: true, createdAt: true } }),
    db.communication.count({ where: { status: 'FAILED' } }),
    canViewFinancials ? db.payment.count({ where: { status: 'PENDING' } }) : Promise.resolve(null),
    db.projectTask.count({ where: { status: { in: ['TODO', 'IN_PROGRESS', 'REVIEW', 'BLOCKED'] }, dueAt: { lt: now } } }),
    db.projectTask.count({ where: { status: { in: ['TODO', 'IN_PROGRESS', 'REVIEW', 'BLOCKED'] }, dueAt: { gte: now, lte: nextWeek } } }),
    canViewFinancials ? db.approvalRequest.count({ where: { type: 'REFUND', status: 'PENDING' } }) : Promise.resolve(null),
    canViewFinancials ? db.approvalRequest.count({ where: { type: 'REFUND', status: { in: ['APPROVED', 'EXECUTED'] } } }) : Promise.resolve(null),
    db.communication.count({ where: { channel: 'EMAIL', status: 'QUEUED' } }),
    db.communication.count({ where: { channel: 'EMAIL', status: 'SENT' } }),
    db.communication.count({ where: { channel: 'EMAIL', status: { in: ['FAILED', 'DEAD_LETTER'] } } }),
    db.clientIdentity.count({ where: { identityType: 'EMAIL' } }),
    db.handoverRecord.count({ where: { status: { in: ['PENDING_APPROVAL', 'PREPARED'] }, paymentVerifiedAt: null } }),
    db.handoverRecord.count({ where: { status: { in: ['RELEASED', 'DOWNLOADED'] } } }),
  ])

  const outstandingReceivables = canViewFinancials
    ? outstandingProjects.reduce((a, p) => a + Math.max(0, p.totalAmount - p.paidAmount), 0)
    : null

  const revenueMap = new Map<string, number>()
  for (const p of revenuePayments) {
    if (!p.verifiedAt) continue
    const key = p.verifiedAt.toISOString().slice(0, 7)
    revenueMap.set(key, (revenueMap.get(key) ?? 0) + p.amount)
  }
  const revenueByMonth = canViewFinancials ? [...Array(12)].map((_, i) => {
    const d = new Date(now)
    d.setMonth(d.getMonth() - (11 - i))
    const key = d.toISOString().slice(0, 7)
    return { month: key, paid: revenueMap.get(key) ?? 0 }
  }) : []

  // AI workforce roster for ADMIN and SUPER_ADMIN. Identity and status only:
  // system prompts, tool and data permissions, memory and run controls stay
  // SUPER_ADMIN-only (see src/lib/ai-workforce-policy.ts). STAFF and MANAGER
  // never receive this payload.
  const aiAgents = hasRole(g.user, 'ADMIN')
    ? await db.aiAgent.findMany({
        orderBy: [{ level: 'asc' }, { code: 'asc' }],
        select: {
          code: true, name: true, title: true, status: true, level: true, parentCode: true,
          requiresApproval: true, executionCount: true, successCount: true,
          department: { select: { code: true, name: true, category: true } },
        },
      })
    : null

  return Response.json({
    financialDataAvailable: canViewFinancials,
    aiAgents: aiAgents
      ? {
          total: aiAgents.length,
          active: aiAgents.filter((a) => a.status === 'ACTIVE').length,
          agents: aiAgents.map((a) => ({
            code: a.code,
            name: a.name,
            title: a.title,
            status: a.status,
            level: a.level,
            parentCode: a.parentCode,
            requiresApproval: a.requiresApproval,
            executions: a.executionCount,
            successRate: a.executionCount > 0 ? Math.round((a.successCount / a.executionCount) * 100) : null,
            deptCode: a.department?.code ?? null,
            deptName: a.department?.name ?? 'Unassigned',
            category: a.department?.category ?? 'OPERATIONS',
          })),
        }
      : null,
    stats: {
      totalLeads, newLeads, newLeadsWeek, qualifiedLeads, clients, activeProjects,
      projectsAwaitingApproval: awaitingApprovalProjects, paymentPending, paidProjects,
      unpaidProjects, outstandingReceivables, completedProjects, openTasks,
      unreadCommunications: unreadComms, failedAutomations,
      pendingAdminApprovals, failedCommunications: failedComms,
      totalPaidRevenue: canViewFinancials ? paidAgg._sum.amount ?? 0 : null,
      pendingPaymentVerifications, overdueTasks, upcomingDeadlines,
      pendingRefunds, approvedRefunds,
      emailQueued, emailSent, emailFailed, verifiedEmailIdentities,
      handoversAwaitingPayment, handoversAwaitingConfirmation,
    },
    pipeline: pipeline.map((p) => ({ stage: p.pipelineStage, count: p._count })),
    revenueByMonth,
    recentLeads,
    recentActivity: recentAudit,
  })
}
