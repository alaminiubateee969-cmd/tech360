import type { Prisma } from '@prisma/client'
import { db } from '@/lib/db'
import { evaluateProjectClosure } from '@/lib/lifecycle-policy'
import { sourcePaymentEvidence } from '@/lib/source-payment'

/**
 * Use persisted evidence, never the mutable CRM stage, to gate the current
 * scope. Historical rows are left untouched and missing evidence fails closed.
 */
export async function requireApprovedScope(clientId: string) {
  const scope = await db.scopeOfWork.findFirst({ where: { clientId, status: 'FINAL' }, orderBy: { version: 'desc' } })
  if (!scope) throw new Error('Final scope required before proceeding.')
  const decision = await db.scopeApproval.findFirst({ where: { clientId, scopeId: scope.id }, orderBy: [{ decidedAt: 'desc' }, { id: 'desc' }] })
  if (decision?.decision !== 'APPROVED') throw new Error('Explicit customer approval of the current final scope is required before proceeding.')
  return scope
}

/**
 * A provider accepting a message is not proof of receipt. Require both the
 * recorded dispatch and an actual tokenized preview view of this scope.
 * This is still bearer-link evidence, not identity verification.
 */
export async function requirePreviewBeforePayment(clientId: string, expectedScopeVersion?: number | null) {
  const scope = await requireApprovedScope(clientId)
  if (expectedScopeVersion != null && scope.version !== expectedScopeVersion) {
    throw new Error('The invoice scope version does not match the currently approved scope.')
  }
  const preview = await db.preview.findFirst({
    where: { clientId, scopeVersion: scope.version },
    orderBy: [{ version: 'desc' }, { createdAt: 'desc' }],
  })
  if (!preview?.sentAt || !preview.viewedAt || !['VIEWED', 'APPROVED'].includes(preview.status)) {
    throw new Error('A dispatched and viewed HTML preview for the approved scope is required before requesting payment.')
  }
  return { scope, preview }
}

/** Shared by the journey closure and board status route: a mutable status or
 * cached paidAmount must never stand in for verified payment/refund records,
 * the latest client delivery decision, completed work and source acceptance.
 * A transaction reader keeps board validation and its compare-and-set together.
 */
export async function projectClosureEvidence(projectId: string, reader: Pick<Prisma.TransactionClient, 'project'> = db) {
  const project = await reader.project.findUnique({
    where: { id: projectId },
    include: {
      client: true, payments: true, refundCases: true, tasks: true,
      deliveries: { orderBy: [{ createdAt: 'desc' }, { id: 'desc' }] },
      handovers: { where: { type: 'SOURCE_CODE' }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }] },
    },
  })
  if (!project) throw new Error('Project not found')
  const payment = sourcePaymentEvidence({ totalAmount: project.totalAmount, currency: project.currency, payments: project.payments, refunds: project.refundCases })
  const delivery = project.deliveries[0]
  let deliveryAnswers: { received: boolean; working: boolean } | null = null
  try {
    const parsed: unknown = JSON.parse(delivery?.confirmationAnswers ?? 'null')
    if (parsed && typeof parsed === 'object' && 'received' in parsed && 'working' in parsed
      && typeof parsed.received === 'boolean' && typeof parsed.working === 'boolean') {
      deliveryAnswers = { received: parsed.received, working: parsed.working }
    }
  } catch {
    // Missing/corrupt persisted acceptance is not positive evidence.
    deliveryAnswers = null
  }
  const closure = evaluateProjectClosure({
    totalAmount: project.totalAmount,
    paidAmount: payment.cleared ? payment.netPaid : 0,
    taskStatuses: project.tasks.map((task) => task.status),
    deliveryStatus: delivery?.status,
    deliveryAnswers,
    handoverStatus: project.handovers[0]?.status,
  })
  return { project, paid: payment.netPaid, closure }
}
