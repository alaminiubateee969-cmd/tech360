// ============================================================
// TECH360 — tenant isolation helpers (server-side only)
// ============================================================
// Every inbox, automation and n8n query added for the WebChat/CRM/automation
// programme is scoped by `tenantId`. The tenant always comes from the
// authenticated operator record (or, for public visitors, from the
// conversation row that their signed session cookie already proves) — never
// from a request body or query string. A request that names another tenant's
// row receives the same 404 as a row that does not exist, so ids cannot be
// probed across tenants.
// ============================================================

export const DEFAULT_TENANT_ID = 'tech360'

export type TenantScopedUser = { id: string; role: string; tenantId?: string | null }

/** The tenant an authenticated operator acts within. */
export function tenantOf(user: TenantScopedUser | null | undefined): string {
  const value = typeof user?.tenantId === 'string' ? user.tenantId.trim() : ''
  return value || DEFAULT_TENANT_ID
}

/** True when a row belongs to the operator's tenant. Missing tenant = default tenant (pre-migration rows). */
export function sameTenant(rowTenantId: string | null | undefined, user: TenantScopedUser | null | undefined): boolean {
  return (rowTenantId || DEFAULT_TENANT_ID) === tenantOf(user)
}

/** Strict slug validation for tenant ids created by a Super Admin. */
export function isValidTenantSlug(slug: string): boolean {
  return /^[a-z0-9](?:[a-z0-9-]{1,38}[a-z0-9])$/.test(slug)
}
