// ============================================================
// TECH360 — the client profile.
//
// The specification requires the AI to create and save this record
// for every client:
//
//   Client ID · client name · business name · business type ·
//   phone · WhatsApp · email · lead source · message history ·
//   scope history · approval history · payment history ·
//   delivery history · review history
//
// Every part of it is read from the records the journey engine
// already writes, so the profile is a VIEW of the CRM, not a
// second copy of it.
// ============================================================

import { db } from '@/lib/db'

export type ClientProfileDTO = {
  clientId: string
  name: string
  businessName: string | null
  businessType: string | null
  phone: string | null
  whatsapp: string | null
  email: string | null
  leadSource: string
  pipelineStage: string
  status: string
  createdAt: string
  messageHistory: Array<{
    id: string
    at: string
    channel: string
    direction: 'IN' | 'OUT'
    subject: string | null
    body: string
    status: string
    templateName: string | null
  }>
  scopeHistory: Array<{
    id: string
    at: string
    version: number
    status: string
    summary: string | null
    approvedBy: string | null
    approvedAt: string | null
    decision: string | null
  }>
  approvalHistory: Array<{
    id: string
    at: string
    type: string
    status: string
    title: string
    decidedBy: string | null
  }>
  paymentHistory: Array<{
    id: string
    at: string
    amount: number
    currency: string
    status: string
    method: string | null
    transactionId: string | null
    verifiedAt: string | null
    invoice: string | null
  }>
  deliveryHistory: Array<{
    id: string
    at: string
    kind: 'DELIVERY' | 'HANDOVER'
    status: string
    projectCode: string | null
    clientConfirmedAt: string | null
    passwordChangeConfirmedAt: string | null
  }>
  reviewHistory: Array<{
    id: string
    at: string
    kind: 'REVIEW' | 'REFERRAL'
    status: string
    published: boolean
    consent: boolean
  }>
  counters: {
    messages: number
    inbound: number
    outbound: number
    scopes: number
    approvals: number
    payments: number
    paidTotal: number
    deliveries: number
    reviews: number
  }
}

/**
 * Build the client profile.
 *
 * @param clientRef the Client ID (TECH-2026-000001) or the row id
 */
export async function clientProfile(clientRef: string): Promise<ClientProfileDTO> {
  const client = await db.client.findFirst({
    where: { OR: [{ id: clientRef }, { clientId: clientRef }] },
    include: {
      lead: true,
      communications: { orderBy: { createdAt: 'desc' }, take: 500 },
      scopes: { orderBy: { createdAt: 'desc' } },
      payments: { orderBy: { createdAt: 'desc' }, include: { invoice: { select: { number: true } } } },
      projects: { include: { deliveries: true, handovers: true, reviews: true } },
      approvals: { orderBy: { createdAt: 'desc' } },
      reviews: { orderBy: { createdAt: 'desc' } },
      referrals: { orderBy: { createdAt: 'desc' } },
    },
  })
  if (!client) throw new Error('Client not found')

  const scopeApprovals = await db.scopeApproval.findMany({
    where: { clientId: client.id },
    orderBy: { decidedAt: 'desc' },
  })

  const scopeHistory = client.scopes.map((scope) => {
    const decision = scopeApprovals.find((row) => row.scopeId === scope.id)?.decision ?? null
    return {
      id: scope.id,
      at: scope.createdAt.toISOString(),
      version: scope.version,
      status: scope.status,
      summary: scope.summary,
      approvedBy: scope.approvedBy,
      approvedAt: scope.approvedAt ? scope.approvedAt.toISOString() : null,
      decision,
    }
  })

  const deliveryHistory = client.projects.flatMap((project) => [
    ...project.deliveries.map((delivery) => ({
      id: delivery.id,
      at: delivery.createdAt.toISOString(),
      kind: 'DELIVERY' as const,
      status: delivery.status,
      projectCode: project.code,
      clientConfirmedAt: delivery.clientConfirmedAt ? delivery.clientConfirmedAt.toISOString() : null,
      passwordChangeConfirmedAt: null,
    })),
    ...project.handovers.map((handover) => ({
      id: handover.id,
      at: handover.createdAt.toISOString(),
      kind: 'HANDOVER' as const,
      status: handover.status,
      projectCode: project.code,
      clientConfirmedAt: handover.confirmedAt ? handover.confirmedAt.toISOString() : null,
      passwordChangeConfirmedAt: handover.passwordChangeConfirmedAt ? handover.passwordChangeConfirmedAt.toISOString() : null,
    })),
  ]).sort((a, b) => b.at.localeCompare(a.at))

  const reviewHistory = [
    ...client.reviews.map((review) => ({
      id: review.id,
      at: review.createdAt.toISOString(),
      kind: 'REVIEW' as const,
      status: review.status,
      published: review.published,
      consent: review.consent,
    })),
    ...client.referrals.map((referral) => ({
      id: referral.id,
      at: referral.createdAt.toISOString(),
      kind: 'REFERRAL' as const,
      status: referral.status,
      published: false,
      consent: false,
    })),
  ].sort((a, b) => b.at.localeCompare(a.at))

  const payments = client.payments.map((payment) => ({
    id: payment.id,
    at: payment.createdAt.toISOString(),
    amount: payment.amount,
    currency: payment.currency,
    status: payment.status,
    method: payment.method,
    transactionId: payment.transactionId,
    verifiedAt: payment.verifiedAt ? payment.verifiedAt.toISOString() : null,
    invoice: payment.invoice?.number ?? null,
  }))

  const messages = client.communications.map((comm) => ({
    id: comm.id,
    at: comm.createdAt.toISOString(),
    channel: comm.channel,
    direction: (comm.direction === 'IN' ? 'IN' : 'OUT') as 'IN' | 'OUT',
    subject: comm.subject,
    body: comm.body,
    status: comm.status,
    templateName: comm.templateName,
  }))

  return {
    clientId: client.clientId,
    name: client.name,
    businessName: client.businessName,
    businessType: client.businessType,
    phone: client.phone,
    whatsapp: client.whatsapp,
    email: client.email,
    leadSource: client.lead?.sourceDetails ?? client.source,
    pipelineStage: client.pipelineStage,
    status: client.status,
    createdAt: client.createdAt.toISOString(),
    messageHistory: messages,
    scopeHistory,
    approvalHistory: client.approvals.map((approval) => ({
      id: approval.id,
      at: approval.createdAt.toISOString(),
      type: approval.type,
      status: approval.status,
      title: approval.title,
      decidedBy: approval.decidedBy,
    })),
    paymentHistory: payments,
    deliveryHistory,
    reviewHistory,
    counters: {
      messages: messages.length,
      inbound: messages.filter((m) => m.direction === 'IN').length,
      outbound: messages.filter((m) => m.direction === 'OUT').length,
      scopes: scopeHistory.length,
      approvals: client.approvals.length,
      payments: payments.length,
      paidTotal: payments.filter((p) => p.status === 'PAID').reduce((total, p) => total + p.amount, 0),
      deliveries: deliveryHistory.length,
      reviews: reviewHistory.length,
    },
  }
}
