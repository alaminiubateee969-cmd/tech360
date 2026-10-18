import { NextRequest } from 'next/server'
import { POST as adminCommand } from '@/app/api/admin/command/route'

export const dynamic = 'force-dynamic'

/**
 * POST /api/command
 *
 * The natural-language command contract. It delegates to the EXISTING
 * admin command route, so the command grammar, the live context, the
 * RBAC rule and the audit trail are literally the same implementation
 * — one command centre, two contract paths.
 */
export async function POST(req: NextRequest) {
  return adminCommand(req)
}
