import { ROLE_RANK, ROLES, type Role } from '@/lib/constants'

export type Capability =
  | 'crm.read'
  | 'crm.write'
  | 'crm.merge'
  | 'comms.send'
  | 'scope.write'
  | 'scope.approve'
  | 'preview.manage'
  | 'project.read'
  | 'project.write'
  | 'delivery.prepare'
  | 'handover.release'
  | 'finance.read'
  | 'finance.invoice.write'
  | 'finance.invoice.approve'
  | 'finance.payment.record'
  | 'finance.payment.verify'
  | 'finance.refund.request'
  | 'finance.refund.decide'
  | 'audit.read'
  | 'team.manage'
  | 'settings.manage'

const ALL_CAPABILITIES: readonly Capability[] = [
  'crm.read',
  'crm.write',
  'crm.merge',
  'comms.send',
  'scope.write',
  'scope.approve',
  'preview.manage',
  'project.read',
  'project.write',
  'delivery.prepare',
  'handover.release',
  'finance.read',
  'finance.invoice.write',
  'finance.invoice.approve',
  'finance.payment.record',
  'finance.payment.verify',
  'finance.refund.request',
  'finance.refund.decide',
  'audit.read',
  'team.manage',
  'settings.manage',
] as const

export const ROLE_CAPABILITIES: Record<Role, ReadonlySet<Capability>> = {
  SUPER_ADMIN: new Set<Capability>(ALL_CAPABILITIES),
  ADMIN: new Set<Capability>([
    'crm.read',
    'crm.write',
    'crm.merge',
    'comms.send',
    'scope.write',
    'scope.approve',
    'preview.manage',
    'project.read',
    'project.write',
    'delivery.prepare',
    'finance.read',
    'finance.invoice.write',
    'finance.invoice.approve',
    'finance.payment.record',
    'finance.refund.request',
  ]),
  FINANCE: new Set<Capability>([
    'crm.read',
    'comms.send',
    'project.read',
    'finance.read',
    'finance.invoice.write',
    'finance.invoice.approve',
    'finance.payment.record',
    'finance.refund.request',
  ]),
  PROJECT_MANAGER: new Set<Capability>([
    'crm.read',
    'crm.write',
    'comms.send',
    'scope.write',
    'preview.manage',
    'project.read',
    'project.write',
    'delivery.prepare',
  ]),
  MANAGER: new Set<Capability>([
    'crm.read',
    'crm.write',
    'comms.send',
    'scope.write',
    'preview.manage',
    'project.read',
    'project.write',
    'delivery.prepare',
    'finance.read',
    'finance.invoice.write',
    'finance.payment.record',
    'finance.refund.request',
  ]),
  DEVELOPER: new Set<Capability>([
    'project.read',
    'project.write',
    'preview.manage',
    'delivery.prepare',
  ]),
  SALES: new Set<Capability>([
    'crm.read',
    'crm.write',
    'comms.send',
    'scope.write',
  ]),
  SUPPORT: new Set<Capability>([
    'crm.read',
    'comms.send',
    'project.read',
  ]),
  AUDITOR: new Set<Capability>([
    'crm.read',
    'project.read',
    'finance.read',
    'audit.read',
  ]),
  STAFF: new Set<Capability>([
    'crm.read',
    'crm.write',
    'comms.send',
    'project.read',
  ]),
  // Campaigns, content and channel reporting. No finance, scope approval,
  // handover release or governance capability.
  MARKETING: new Set<Capability>([
    'crm.read',
    'crm.write',
    'comms.send',
    'project.read',
  ]),
  // Design and preview work on assigned projects only. Designers may manage
  // previews but cannot approve scopes, release handovers or read finance.
  DESIGNER: new Set<Capability>([
    'crm.read',
    'project.read',
    'preview.manage',
  ]),
}

export function isValidRole(role: string): role is Role {
  return (ROLES as readonly string[]).includes(role)
}

export function isReadOnlyRole(user: { role: string } | null | undefined): boolean {
  if (!user) return false
  return user.role === 'AUDITOR'
}

export function hasRole(user: { role: string } | null | undefined, minimumRole: string): boolean {
  if (!user) return false
  return (ROLE_RANK[user.role] ?? 0) >= (ROLE_RANK[minimumRole] ?? 0)
}

export function hasCapability(user: { role: string } | null | undefined, capability: Capability): boolean {
  if (!user || !isValidRole(user.role)) return false
  return ROLE_CAPABILITIES[user.role]?.has(capability) ?? false
}

export function isSuperAdmin(user: { role: string } | null | undefined): boolean {
  return hasRole(user, 'SUPER_ADMIN')
}

export function canViewFinancialDashboard(user: { role: string } | null | undefined): boolean {
  return hasCapability(user, 'finance.read')
}

export function canDecideApproval(user: { role: string } | null | undefined, currentStatus: string): boolean {
  return isSuperAdmin(user) && currentStatus === 'PENDING'
}
