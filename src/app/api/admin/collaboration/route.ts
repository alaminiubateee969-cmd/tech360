import { NextRequest } from 'next/server'
import { guard, isResponse } from '@/lib/api-guard'
import { db } from '@/lib/db'
import { WORKFORCE } from '@/lib/agents/workforce'

export const dynamic = 'force-dynamic'

/**
 * GET /api/admin/collaboration — the agent-to-agent collaboration
 * record.
 *
 * Every delegation is a CONTRACT: the requester, the target, the
 * task, the objective, the context, the priority, the deadline, the
 * delegated permissions and the expected output. The panel shows the
 * REAL record from the AgentDelegation table.
 */
export async function GET(req: NextRequest) {
  const g = await guard(req, { minRole: 'SUPER_ADMIN' })
  if (isResponse(g)) return g

  const params = req.nextUrl.searchParams
  const status = params.get('status')
  const limit = Math.max(1, Math.min(200, Number(params.get('limit') ?? 50)))

  const delegations = await db.agentDelegation.findMany({
    where: status ? { status } : undefined,
    orderBy: { createdAt: 'desc' },
    take: limit,
    select: {
      id: true,
      requestingAgent: true,
      targetAgent: true,
      kind: true,
      task: true,
      objective: true,
      context: true,
      priority: true,
      deadline: true,
      permissions: true,
      expectedOutput: true,
      status: true,
      result: true,
      correlationId: true,
      createdAt: true,
      completedAt: true,
    },
  })

  const byStatus = new Map<string, number>()
  for (const delegation of delegations) byStatus.set(delegation.status, (byStatus.get(delegation.status) ?? 0) + 1)

  const total = await db.agentDelegation.count()

  return Response.json({
    delegations,
    total,
    byStatus: Object.fromEntries(byStatus),
    workforceSize: WORKFORCE.length,
  })
}
