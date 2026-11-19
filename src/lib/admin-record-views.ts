import type { Prisma } from '@prisma/client'

/**
 * Composite CRM/project responses must not be an alternate finance endpoint.
 * Preserve the operational project identity/status, but use null (not fake
 * zeroes) when the authenticated role lacks finance.read. The explicit flag
 * also lets the console distinguish restricted data from an unpaid project.
 */
export function projectRecordView<T extends object>(project: T, financeRead: boolean) {
  if (financeRead) return { ...project, financeRead: true }
  return {
    ...project,
    totalAmount: null,
    paidAmount: null,
    paymentStatus: null,
    currency: null,
    financeRead: false,
  }
}

// Operational roles can follow their requests, but only the deciding Super
// Admin needs full generated content, execution results or private workforce
// governance. Unknown/new approval kinds fail closed until classified here.
const OPERATIONAL_APPROVAL_TYPES = [
  'FINAL_SCOPE_SEND', 'PIPELINE_MESSAGE', 'SOURCE_HANDOVER', 'MANUAL_COMMUNICATION',
  'EXTERNAL_SEND', 'SOCIAL_PUBLISH', 'LEGAL_COMM', 'SENSITIVE_COMM',
] as const
const FINANCIAL_APPROVAL_TYPES = [
  'PAYMENT_INSTRUCTION', 'PAYMENT_VERIFY', 'INVOICE_GENERATE', 'REFUND', 'REFUND_SETTLE',
] as const

export function approvalReadWhere(privateWorkforceRead: boolean, financeRead: boolean): Prisma.ApprovalRequestWhereInput {
  return privateWorkforceRead ? {} : { type: { in: [...OPERATIONAL_APPROVAL_TYPES, ...(financeRead ? FINANCIAL_APPROVAL_TYPES : [])] } }
}

export function approvalReadSelect(detailsRead: boolean) {
  return {
    id: true, type: true, title: true, clientId: true, projectId: true,
    risk: true, status: true, createdAt: true, updatedAt: true, executedAt: true,
    description: detailsRead, payload: detailsRead, result: detailsRead,
    decisionNote: detailsRead, requestedBy: detailsRead, decidedBy: detailsRead, agentCode: detailsRead,
  } as const
}

export function approvalRecordView<T extends object>(approval: T, detailsRead: boolean) {
  return {
    ...approval,
    ...(!detailsRead ? { description: null, payload: null, result: null, decisionNote: null, requestedBy: null, decidedBy: null, agentCode: null } : {}),
    detailsRestricted: !detailsRead,
  }
}
