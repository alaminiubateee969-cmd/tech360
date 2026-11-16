import { db } from '@/lib/db'

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
