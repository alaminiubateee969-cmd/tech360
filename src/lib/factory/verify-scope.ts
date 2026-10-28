import { createHash } from 'node:crypto'
import { db } from '@/lib/db'
import { normalizeBrief } from './blueprint'
import { checkFactoryScopeGate, type FactoryAppScopeBinding } from './scope-gate'
import { factoryBriefMatchesScopeManifest, factoryManifestFromScopeContent } from './scope-manifest'

/** Resolve, verify and return the approved software manifest bound to an app. */
export async function verifyFactoryAppScope(app: FactoryAppScopeBinding & { brief: string }) {
  if (!app.scopeId) return { allowed: false as const, code: 'SCOPE_SNAPSHOT_MISSING' as const }

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
  if (!scope) return { allowed: false as const, code: 'SCOPE_SNAPSHOT_MISSING' as const }

  const latestApproval = scope.approvals[0]
  const gate = checkFactoryScopeGate(app, {
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
  if (!gate.allowed) return gate

  const manifestResult = factoryManifestFromScopeContent(scope.content)
  if (!manifestResult.ok) return { allowed: false as const, code: 'SCOPE_MANIFEST_INVALID' as const }
  let rawBrief: Record<string, unknown>
  try {
    const parsed = JSON.parse(app.brief) as unknown
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('invalid brief')
    rawBrief = parsed as Record<string, unknown>
  } catch {
    return { allowed: false as const, code: 'SCOPE_BRIEF_MISMATCH' as const }
  }
  const brief = normalizeBrief(rawBrief)
  if (!factoryBriefMatchesScopeManifest(brief, manifestResult.manifest)) {
    return { allowed: false as const, code: 'SCOPE_BRIEF_MISMATCH' as const }
  }
  return { allowed: true as const, manifest: manifestResult.manifest }
}
