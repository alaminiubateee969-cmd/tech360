import { NextRequest } from 'next/server'
import { GET as adminAgents } from '@/app/api/admin/agents/route'

export const dynamic = 'force-dynamic'

/**
 * GET /api/agents
 *
 * The public contract path for the agent registry. It delegates to the
 * EXISTING admin registry route so there is exactly one implementation
 * of the agent listing and one RBAC policy — no duplicated route.
 */
export async function GET(req: NextRequest) {
  return adminAgents(req)
}
