import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { guard, isResponse } from '@/lib/api-guard'

export const dynamic = 'force-dynamic'

/**
 * Cross-module snapshot for the central command center.
 * Counts are sourced from live database records; no synthetic metrics are returned.
 */
export async function GET(req: NextRequest) {
  const g = await guard(req, { minRole: 'STAFF' })
  if (isResponse(g)) return g

  const [
    leads,
    clients,
    whatsappMessages,
    inboundWhatsapp,
    outboundWhatsapp,
    failedCommunications,
    contentDrafts,
    contentApproved,
    contentPublished,
    pendingApprovals,
    failedAutomations,
    recentAutomations,
  ] = await Promise.all([
    db.client.count({ where: { status: 'LEAD', deletedAt: null } }),
    db.client.count({ where: { deletedAt: null } }),
    db.communication.count({ where: { channel: 'WHATSAPP' } }),
    db.communication.count({ where: { channel: 'WHATSAPP', direction: 'IN' } }),
    db.communication.count({ where: { channel: 'WHATSAPP', direction: 'OUT' } }),
    db.communication.count({ where: { status: 'FAILED' } }),
    db.contentAsset.count({ where: { status: 'DRAFT' } }),
    db.contentAsset.count({ where: { status: 'APPROVED' } }),
    db.contentAsset.count({ where: { status: 'PUBLISHED' } }),
    db.approvalRequest.count({ where: { status: 'PENDING' } }),
    db.automationLog.count({ where: { status: 'FAILED' } }),
    db.automationLog.findMany({
      orderBy: { startedAt: 'desc' },
      take: 8,
      select: { id: true, workflow: true, trigger: true, status: true, startedAt: true, finishedAt: true, durationMs: true, error: true },
    }),
  ])

  return Response.json({
    generatedAt: new Date().toISOString(),
    dataSource: 'live-database',
    metrics: {
      leads,
      clients,
      whatsappMessages,
      inboundWhatsapp,
      outboundWhatsapp,
      failedCommunications,
      content: { drafts: contentDrafts, approved: contentApproved, published: contentPublished },
      pendingApprovals,
      failedAutomations,
    },
    recentAutomations,
  })
}
