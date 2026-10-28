export type FactoryAppScopeBinding = {
  clientId: string | null
  projectId: string | null
  scopeId: string | null
  scopeVersion: number | null
  scopeHash: string | null
}

export type CurrentFactoryScope = {
  id: string
  clientId: string
  projectId: string | null
  version: number
  status: string
  approvedAt: Date | string | null
  latestClientDecision: string | null
  latestApprovalClientId: string | null
  contentHash: string
}

export type FactoryScopeGateResult =
  | { allowed: true }
  | {
      allowed: false
      code:
        | 'PROJECT_SCOPE_REQUIRED'
        | 'SCOPE_SNAPSHOT_MISSING'
        | 'SCOPE_LINK_MISMATCH'
        | 'SCOPE_NOT_FINAL'
        | 'CLIENT_APPROVAL_REQUIRED'
        | 'SCOPE_CONTENT_CHANGED'
        | 'SCOPE_MANIFEST_INVALID'
        | 'SCOPE_BRIEF_MISMATCH'
    }

/**
 * Client source delivery must remain tied to the exact scope version approved
 * by both TECH360 and the client. Internal prototypes deliberately do not pass
 * this gate; callers decide whether an unbound app may be exported for review.
 */
export function checkFactoryScopeGate(
  app: FactoryAppScopeBinding,
  scope: CurrentFactoryScope | null,
): FactoryScopeGateResult {
  if (!app.clientId || !app.projectId) {
    return { allowed: false, code: 'PROJECT_SCOPE_REQUIRED' }
  }
  if (!app.scopeId || app.scopeVersion === null || !app.scopeHash || !scope) {
    return { allowed: false, code: 'SCOPE_SNAPSHOT_MISSING' }
  }
  if (
    scope.id !== app.scopeId ||
    scope.clientId !== app.clientId ||
    scope.projectId !== app.projectId ||
    scope.version !== app.scopeVersion
  ) {
    return { allowed: false, code: 'SCOPE_LINK_MISMATCH' }
  }
  if (scope.status !== 'FINAL' || !scope.approvedAt) {
    return { allowed: false, code: 'SCOPE_NOT_FINAL' }
  }
  if (scope.latestClientDecision !== 'APPROVED' || scope.latestApprovalClientId !== app.clientId) {
    return { allowed: false, code: 'CLIENT_APPROVAL_REQUIRED' }
  }
  if (!/^[a-f0-9]{64}$/i.test(app.scopeHash) || app.scopeHash.toLowerCase() !== scope.contentHash.toLowerCase()) {
    return { allowed: false, code: 'SCOPE_CONTENT_CHANGED' }
  }
  return { allowed: true }
}
