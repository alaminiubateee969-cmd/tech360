import { NextRequest } from 'next/server'
import { GET as adminAudit } from '@/app/api/admin/logs/audit/route'

export const dynamic = 'force-dynamic'

/**
 * GET /api/audit
 *
 * The audit trail contract. It delegates to the EXISTING admin audit
 * route so there is one query, one pagination shape and one RBAC rule.
 */
export async function GET(req: NextRequest) {
  return adminAudit(req)
}
