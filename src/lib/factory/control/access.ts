/**
 * Server-side tenant isolation and least-privilege authorization.
 *
 * CRITICAL RULE: a companyId from the URL, body or UI is never trusted.
 * Access is resolved from an explicit FactoryCompanyMember grant. A factory
 * SUPER_ADMIN can manage the control plane but has NO automatic access to a
 * company's private business data — that requires a separately granted,
 * audited (and optionally expiring) membership.
 */
import { db } from '@/lib/db'
import { audit } from '@/lib/security'
import { READ_ROLES, WRITE_ROLES, type CompanyRole } from './types'
import { stableStringify } from './util'

export interface Actor {
  email: string
  role: string
  userId?: string | null
  ip?: string | null
}

export type AccessLevel = 'read' | 'write' | 'manage' | 'audit'

export interface CompanyScope {
  companyId: string
  membership: {
    id: string
    role: string
    privileged: boolean
    expiresAt: string | null
    grantReason: string | null
  }
  level: AccessLevel
}

export interface AccessDecision {
  ok: boolean
  code: string
  reason: string
  scope: CompanyScope | null
}

export function canManageFactory(actor: Actor): boolean {
  return actor.role === 'SUPER_ADMIN'
}

export function canApproveRelease(actor: Actor): boolean {
  return actor.role === 'SUPER_ADMIN'
}

export async function writeFactoryAudit(entry: {
  actor: Actor
  action: string
  targetType: string
  targetId: string
  decision?: 'ALLOW' | 'DENY'
  companyId?: string | null
  detail?: unknown
}): Promise<void> {
  const decision = entry.decision ?? 'ALLOW'
  try {
    await db.factoryAuditEvent.create({
      data: {
        companyId: entry.companyId ?? null,
        actor: entry.actor.email,
        action: entry.action,
        targetType: entry.targetType,
        targetId: entry.targetId,
        decision,
        detail: entry.detail === undefined ? null : stableStringify(entry.detail),
        ip: entry.actor.ip ?? null,
      },
    })
  } catch (error) {
    console.error('[factory-control] audit event failed', error)
  }
  // Sensitive operations also land in the platform-wide audit log.
  if (decision === 'DENY' || entry.action.startsWith('FACTORY_')) {
    await audit({
      actor: entry.actor.email,
      action: `FACTORY_${entry.action}`,
      userId: entry.actor.userId ?? undefined,
      entityType: entry.targetType,
      entityId: entry.targetId,
      details: { decision, companyId: entry.companyId ?? null, detail: entry.detail ?? null },
      ip: entry.actor.ip ?? undefined,
    }).catch(() => null)
  }
}

function roleAllows(role: string, level: AccessLevel): boolean {
  switch (level) {
    case 'read': return (READ_ROLES as readonly string[]).includes(role)
    case 'write': return (WRITE_ROLES as readonly string[]).includes(role)
    case 'manage': return role === 'COMPANY_ADMIN' || role === 'FACTORY_OPERATOR'
    case 'audit': return role === 'COMPANY_ADMIN' || role === 'COMPANY_AUDITOR' || role === 'FACTORY_OPERATOR'
    default: return false
  }
}

/**
 * Resolve a company scope for a business-data operation. Denials are always
 * audited (including attempts to name a company the actor is not a member of).
 */
export async function resolveCompanyAccess(actor: Actor, companyId: string | null | undefined, level: AccessLevel, action: string): Promise<AccessDecision> {
  const requested = (companyId ?? '').trim()
  if (!requested) {
    await writeFactoryAudit({ actor, action, targetType: 'COMPANY', targetId: '(missing)', decision: 'DENY', detail: { reason: 'no company id' } })
    return { ok: false, code: 'COMPANY_REQUIRED', reason: 'A company scope is required for this operation.', scope: null }
  }
  const row = await db.factoryCompanyMember.findUnique({
    where: { companyId_userEmail: { companyId: requested, userEmail: actor.email } },
  })
  if (!row || row.status !== 'ACTIVE') {
    await writeFactoryAudit({ actor, action, targetType: 'COMPANY', targetId: requested, decision: 'DENY', companyId: requested, detail: { reason: 'no active grant', level } })
    return { ok: false, code: 'NO_COMPANY_GRANT', reason: 'No active company access grant. Factory administrators need an explicit, audited grant to read private business data.', scope: null }
  }
  if (row.expiresAt && row.expiresAt.getTime() < Date.now()) {
    await writeFactoryAudit({ actor, action, targetType: 'COMPANY', targetId: requested, decision: 'DENY', companyId: requested, detail: { reason: 'grant expired' } })
    return { ok: false, code: 'GRANT_EXPIRED', reason: 'This privileged company access grant has expired.', scope: null }
  }
  if (row.privileged && (!row.grantedBy || !row.grantReason)) {
    await writeFactoryAudit({ actor, action, targetType: 'COMPANY', targetId: requested, decision: 'DENY', companyId: requested, detail: { reason: 'incomplete privileged grant' } })
    return { ok: false, code: 'INVALID_PRIVILEGED_GRANT', reason: 'Privileged grants require a grantor and a recorded reason.', scope: null }
  }
  if (!roleAllows(row.role, level)) {
    await writeFactoryAudit({ actor, action, targetType: 'COMPANY', targetId: requested, decision: 'DENY', companyId: requested, detail: { reason: 'role not permitted', role: row.role, level } })
    return { ok: false, code: 'ROLE_DENIED', reason: `The ${row.role} grant does not permit this ${level} operation.`, scope: null }
  }
  return {
    ok: true,
    code: 'OK',
    reason: 'allowed',
    scope: {
      companyId: requested,
      level,
      membership: {
        id: row.id,
        role: row.role,
        privileged: row.privileged,
        expiresAt: row.expiresAt ? row.expiresAt.toISOString() : null,
        grantReason: row.grantReason,
      },
    },
  }
}

/** Verify a resource belongs to the resolved scope before reading it. */
export async function assertResourceInScope(
  actor: Actor,
  scope: CompanyScope,
  resource: { companyId?: string | null } | null | undefined,
  targetType: string,
  targetId: string,
  action: string,
): Promise<boolean> {
  if (!resource || resource.companyId !== scope.companyId) {
    await writeFactoryAudit({ actor, action, targetType, targetId, decision: 'DENY', companyId: scope.companyId, detail: { reason: 'resource belongs to another company or does not exist' } })
    return false
  }
  return true
}

/** Company registry metadata is control-plane data, not private business data. */
export async function listVisibleCompanies(actor: Actor): Promise<string[]> {
  if (canManageFactory(actor)) {
    const rows = await db.factoryCompany.findMany({ select: { id: true } })
    return rows.map((r) => r.id)
  }
  const grants = await db.factoryCompanyMember.findMany({
    where: { userEmail: actor.email, status: 'ACTIVE' },
    select: { companyId: true },
  })
  return grants.map((g) => g.companyId)
}

export function membershipRole(role: string): CompanyRole {
  return (['COMPANY_ADMIN', 'COMPANY_USER', 'COMPANY_AUDITOR', 'FACTORY_OPERATOR'] as const).includes(role as CompanyRole)
    ? (role as CompanyRole)
    : 'COMPANY_USER'
}

/** Non-auditing membership peek for registry/control-plane screens (metadata only). */
export async function peekCompanyAccess(actor: Actor, companyId: string, level: AccessLevel = 'read'): Promise<boolean> {
  if (canManageFactory(actor)) return true
  const row = await db.factoryCompanyMember.findUnique({
    where: { companyId_userEmail: { companyId, userEmail: actor.email } },
  })
  if (!row || row.status !== 'ACTIVE') return false
  if (row.expiresAt && row.expiresAt.getTime() < Date.now()) return false
  if (row.privileged && (!row.grantedBy || !row.grantReason)) return false
  return roleAllows(row.role, level)
}
