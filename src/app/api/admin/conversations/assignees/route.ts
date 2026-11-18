import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { guard, isResponse } from '@/lib/api-guard'
import { hasCapability } from '@/lib/access-policy'
import { tenantOf } from '@/lib/tenancy'
import { TEAMS } from '@/lib/webchat/policy'

export const dynamic = 'force-dynamic'

// STAFF — active teammates in the caller's tenant who can take conversations
// (they must hold comms.send). Names/emails only; no roles beyond a label.
export async function GET(req: NextRequest) {
  const g = await guard(req, { minRole: 'STAFF', capability: 'crm.read' })
  if (isResponse(g)) return g
  const tenantId = tenantOf(g.user as typeof g.user & { tenantId?: string })
  const users = await db.user.findMany({
    where: { tenantId, isActive: true },
    orderBy: { email: 'asc' },
    select: { id: true, email: true, name: true, role: true },
    take: 200,
  })
  return Response.json({
    me: g.user.id,
    teams: TEAMS,
    assignees: users.filter((u) => hasCapability(u, 'comms.send')).map((u) => ({ id: u.id, email: u.email, name: u.name, role: u.role })),
  })
}
