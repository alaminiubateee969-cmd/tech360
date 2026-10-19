import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { guard, isResponse } from '@/lib/api-guard'
import { CLIENT_JOURNEY_STAGES } from '@/lib/pipeline/rules'
import {
  ADMIN_APPROVAL_CATEGORIES,
  ADMIN_APPROVAL_STAGES,
  AUTO_SEND_STAGES,
  classifyContentCategory,
  effectiveGate,
  gateReason,
} from '@/lib/pipeline/rules'
import { PIPELINE_MESSAGE_STAGES, pipelineMessage, type PipelineVariables } from '@/lib/pipeline/templates'
import { PIPELINE_LABELS, PIPELINE_STAGES } from '@/lib/constants'

export const dynamic = 'force-dynamic'

const SAMPLE: PipelineVariables = {
  clientId: 'TECH-2026-000001',
  clientName: 'Client Name',
  businessType: 'eCommerce',
  recommendedPlan: 'Recommended solution for your business',
  meetingLink: 'https://bdtech360.com/#contact',
  projectName: 'Project',
  finalScope: 'Final Scope of Work (as approved)',
  paymentPolicy: 'Advance · On milestone · On final delivery',
  htmlPreviewUrl: 'https://bdtech360.com/api/preview/<token>',
}

/**
 * GET /api/admin/pipeline
 *
 * The communication pipeline: the eleven client-journey stages, the
 * auto-send vs admin-approval gate for each one, the exact copy, and
 * the REAL live state read from the CRM.
 *
 * Nothing here is fabricated: the counts come from the database, and
 * the copy comes from the same module the journey engine sends.
 */
export async function GET(req: NextRequest) {
  const g = await guard(req, { minRole: 'MANAGER' })
  if (isResponse(g)) return g

  const byStage = await db.client.groupBy({
    by: ['pipelineStage'],
    _count: { _all: true },
  })
  const stageCounts: Record<string, number> = {}
  for (const row of byStage) stageCounts[row.pipelineStage] = row._count._all

  const [totalClients, pendingApprovals, messageTotals, savedMessages] = await Promise.all([
    db.client.count(),
    db.approvalRequest.count({ where: { status: 'PENDING', type: { in: ['PIPELINE_MESSAGE', 'PAYMENT_INSTRUCTION', 'FINAL_SCOPE_SEND', 'SOURCE_HANDOVER', 'REFUND', 'LEGAL_COMM'] } } }),
    db.communication.groupBy({ by: ['channel', 'direction'], _count: { _all: true } }),
    db.communication.count({ where: { messageType: 'TEMPLATE' } }),
  ])

  const channelCounts: Record<string, number> = {}
  for (const row of messageTotals) {
    const key = `${row.direction}_${row.channel}`
    channelCounts[key] = row._count._all
  }

  const copy = PIPELINE_MESSAGE_STAGES.map((stage) => {
    const messages = pipelineMessage(stage, SAMPLE)
    return {
      stage,
      whatsapp: messages.whatsapp.body,
      emailSubject: messages.email.subject ?? null,
      email: messages.email.body,
      gate: effectiveGate(stage, messages.whatsapp.body),
      gateReason: gateReason(stage, messages.whatsapp.body),
      detectedCategories: classifyContentCategory(messages.whatsapp.body),
    }
  })

  return Response.json({
    journey: CLIENT_JOURNEY_STAGES.map((stage) => ({
      number: stage.number,
      key: stage.key,
      label: stage.label,
      messageStage: stage.messageStage,
      gate: (ADMIN_APPROVAL_STAGES as readonly string[]).includes(stage.messageStage) ? 'ADMIN_APPROVAL_REQUIRED' : 'AUTO_SEND',
      clients: stageCounts[stage.key] ?? 0,
    })),
    pipelineStages: PIPELINE_STAGES.map((stage) => ({ stage, label: PIPELINE_LABELS[stage] ?? stage, clients: stageCounts[stage] ?? 0 })),
    autoSendStages: AUTO_SEND_STAGES,
    adminApprovalStages: ADMIN_APPROVAL_STAGES,
    adminApprovalCategories: ADMIN_APPROVAL_CATEGORIES,
    policies: ['HTML Preview Before Payment', 'Source Code After Full Payment'],
    stats: {
      totalClients,
      pendingApprovals,
      savedPipelineMessages: savedMessages,
      channelCounts,
    },
    copy,
    viewer: { id: g.user.id, role: g.user.role },
  })
}
