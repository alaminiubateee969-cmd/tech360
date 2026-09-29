import { ROLE_RANK } from '@/lib/constants'

export function hasRole(user: { role: string } | null, minimumRole: string): boolean {
  if (!user) return false
  return (ROLE_RANK[user.role] ?? 0) >= (ROLE_RANK[minimumRole] ?? 0)
}

export function isSuperAdmin(user: { role: string } | null): boolean {
  return user?.role === 'SUPER_ADMIN'
}

export function canDecideApproval(user: { role: string } | null, status: string): boolean {
  return isSuperAdmin(user) && status === 'PENDING'
}
