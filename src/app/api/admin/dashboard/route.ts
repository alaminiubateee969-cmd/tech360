import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { guard, isResponse } from '@/lib/api-guard'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const g = await guard(req)
  if (isResponse(g)) return g

  const dayAgo = new Date(Date.now() - 24 * 3600 * 1000)
  const weekAgo = new Date(Date.now() - 7 * 24 * 3600 * 1000)

  const [totalLeads, newLeads, newLeadsWeek, qualifiedLeads, clients, activeProjects, awaitingApprovalProjects,
    paymentPending, paidProjects, completedProjects, openTasks, unreadComms, failedAutomations,
    pendingAdminApprovals, unpaidProjects, outstandingProjects, paidAgg, pipeline, revenuePayments,
    recentLeads, recentAudit, failedComms,
  ] = await Promise.all([
    db.client.count({ where: { status: 'LEAD' } }),
    db.client.count({ where: { createdAt: { gte: dayAgo } } }),
    db.client.count({ where: { createdAt: { gte: weekAgo } } }),
    db.client.count({ where: { pipelineStage: { in: ['BUSINESS_IDENTIFIED', 'PLAN_RECOMMENDED', 'SCOPE_COLLECTION', 'SCOPE_REVIEW', 'FINAL_SCOPE'] } } }),
    db.client.count({ where: { status: { in: ['CLIENT', 'ACTIVE', 'COMPLETED'] } } }),
    db.project.count({ where: { status: { in: ['ACTIVE', 'DEVELOPMENT', 'TESTING', 'CLIENT_REVIEW', 'DELIVERY', 'HANDOVER'] } } }),
    db.approvalRequest.count({ where: { status: 'PENDING' } }),
    db.client.count({ where: { pipelineStage: 'PAYMENT_PENDING' } }),
    db.project.count({ where: { paymentStatus: 'PAID' } }),
    db.project.count({ where: { status: 'COMPLETED' } }),
    db.projectTask.count({ where: { status: { in: ['TODO', 'IN_PROGRESS', 'REVIEW', 'BLOCKED'] } } }),
    db.communication.count({ where: { direction: 'IN', status: 'RECEIVED' } }),
    db.automationLog.count({ where: { status: 'FAILED' } }),
    db.approvalRequest.count({ where: { status: 'PENDING' } }),
    db.project.count({ where: { paymentStatus: { in: ['PENDING', 'PARTIAL'] } } }),
    db.project.findMany({ where: { paymentStatus: { in: ['PENDING', 'PARTIAL'] }, status: { not: 'CANCELLED' } }, select: { totalAmount: true, paidAmount: true } }),
    db.payment.aggregate({ where: { status: 'PAID' }, _sum: { amount: true } }),
    db.client.groupBy({ by: ['pipelineStage'], _count: true }),
    db.payment.findMany({ where: { status: 'PAID', verifiedAt: { gte: new Date(Date.now() - 180 * 24 * 3600 * 1000) } }, select: { amount: true, verifiedAt: true } }),
    db.client.findMany({ orderBy: { createdAt: 'desc' }, take: 8, select: { id: true, clientId: true, name: true, businessName: true, businessType: true, source: true, pipelineStage: true, createdAt: true } }),
    db.auditLog.findMany({ orderBy: { createdAt: 'desc' }, take: 10, select: { actor: true, action: true, clientId: true, createdAt: true } }),
    db.communication.count({ where: { status: 'FAILED' } }),
  ])

  const outstandingReceivables = outstandingProjects.reduce((a, p) => a + Math.max(0, p.totalAmount - p.paidAmount), 0)

  const revenueMap = new Map<string, number>()
  for (const p of revenuePayments) {
    if (!p.verifiedAt) continue
    const key = p.verifiedAt.toISOString().slice(0, 7)
    revenueMap.set(key, (revenueMap.get(key) ?? 0) + p.amount)
  }
  const revenueByMonth = [...Array(12)].map((_, i) => {
    const d = new Date()
    d.setMonth(d.getMonth() - (11 - i))
    const key = d.toISOString().slice(0, 7)
    return { month: key, paid: revenueMap.get(key) ?? 0 }
  })

  return Response.json({
    stats: {
      totalLeads, newLeads, newLeadsWeek, qualifiedLeads, clients, activeProjects,
      projectsAwaitingApproval: awaitingApprovalProjects, paymentPending, paidProjects,
      unpaidProjects, outstandingReceivables, completedProjects, openTasks,
      unreadCommunications: unreadComms, failedAutomations,
      pendingAdminApprovals, failedCommunications: failedComms,
      totalPaidRevenue: paidAgg._sum.amount ?? 0,
    },
    pipeline: pipeline.map((p) => ({ stage: p.pipelineStage, count: p._count })),
    revenueByMonth,
    recentLeads,
    recentActivity: recentAudit,
  })
}
