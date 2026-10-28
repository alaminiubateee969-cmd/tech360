import { createHash } from 'node:crypto'
import { db } from '@/lib/db'
import { checkFactoryScopeGate, type FactoryAppScopeBinding } from './scope-gate'

/** Resolve and verify the persisted scope snapshot for a client-bound app. */
export async function verifyFactoryAppScope(app: FactoryAppScopeBinding) {
  if (!app.scopeId) return checkFactoryScopeGate(app, null)

  const scope = await db.scopeOfWork.findUnique({
    where: { id: app.scopeId },
    include: {
      approvals: {
        orderBy: { decidedAt: 'desc' },
        take: 1,
        select: { decision: true, clientId: true },
      },
    },
  })
  if (!scope) return checkFactoryScopeGate(app, null)

  const latestApproval = scope.approvals[0]
  return checkFactoryScopeGate(app, {
    id: scope.id,
    clientId: scope.clientId,
    projectId: scope.projectId,
    version: scope.version,
    status: scope.status,
    approvedAt: scope.approvedAt,
    latestClientDecision: latestApproval?.decision ?? null,
    latestApprovalClientId: latestApproval?.clientId ?? null,
    contentHash: createHash('sha256').update(scope.content, 'utf8').digest('hex'),
  })
}
