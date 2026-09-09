import { db } from '@/lib/db'
import { runAgent } from '@/lib/agents/engine'
import { audit } from '@/lib/security'

// ============================================================
// CEO DAILY REPORT — generated from live CRM data by the Pulse
// agent, with a deterministic fallback if the model is offline.
// ============================================================

export async function generateCeoReport(userId: string) {
  const [leads24h, totalClients, activeProjects, pendingApprovals, pendingPayments, unpaidProjects, failedAutomations, failedComms, agents, execToday, pipeline, payments] = await Promise.all([
    db.client.count({ where: { createdAt: { gte: new Date(Date.now() - 24 * 3600 * 1000) } } }),
    db.client.count(),
    db.project.count({ where: { status: { in: ['ACTIVE', 'DEVELOPMENT', 'TESTING', 'CLIENT_REVIEW', 'DELIVERY', 'HANDOVER'] } } }),
    db.approvalRequest.count({ where: { status: 'PENDING' } }),
    db.payment.count({ where: { status: 'PENDING' } }),
    db.project.count({ where: { paymentStatus: { in: ['PENDING', 'PARTIAL'] } } }),
    db.automationLog.count({ where: { status: 'FAILED' } }),
    db.communication.count({ where: { status: 'FAILED' } }),
    db.aiAgent.count({ where: { status: 'ACTIVE' } }),
    db.aiAgentExecution.count({ where: { createdAt: { gte: new Date(Date.now() - 24 * 3600 * 1000) } } }),
    db.client.groupBy({ by: ['pipelineStage'], _count: true }),
    db.payment.aggregate({ where: { status: 'PAID' }, _sum: { amount: true } }),
  ])
  const paidTotal = payments._sum.amount ?? 0
  const summary = `DAILY CEO REPORT — ${new Date().toDateString()}\n\nHEADLINES\n• New leads (24h): ${leads24h}\n• Total clients: ${totalClients}\n• Active projects: ${activeProjects}\n• Pending approvals: ${pendingApprovals}\n• Payments awaiting verification: ${pendingPayments}\n• Unpaid/partial projects: ${unpaidProjects}\n• Total verified revenue: $${paidTotal.toFixed(2)}\n• Active AI agents: ${agents} · executions (24h): ${execToday}\n• Failed automations: ${failedAutomations} · failed messages: ${failedComms}\n\nPIPELINE\n${pipeline.map((p) => `• ${p.pipelineStage}: ${p._count}`).join('\n') || '• No pipeline data yet'}\n\nTOP ACTIONS\n1. Review ${pendingApprovals} pending approval(s).\n2. Verify ${pendingPayments} payment record(s).\n3. Follow up unpaid projects (${unpaidProjects}).\n4. Review failed automations/messages if any.\n\n— Pulse (CEO Reporting Agent), generated from live CRM data.`
  const run = await runAgent('RPT-039', {
    input: `Compose the executive daily report from this verified data:\n${summary}`,
    workflow: 'CEO_REPORT',
  })
  await audit({ actor: `user:${userId}`, action: 'CEO_REPORT_GENERATED', details: { leads24h, totalClients } })
  return run.ok ? run.output : summary
}
