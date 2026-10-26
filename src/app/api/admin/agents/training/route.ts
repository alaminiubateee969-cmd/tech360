import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { guard, isResponse } from '@/lib/api-guard'
import { AI_WORKFORCE_MIN_ROLE } from '@/lib/ai-workforce-policy'
import { LEARNING_TRACKS, TRAINING_SOURCE_COUNT, maturityFor, trackForCategory } from '@/lib/agents/training'

export const dynamic = 'force-dynamic'

// GET /api/admin/agents/training — training curriculum + evidence.
// Controlled ONLY from Super Admin / Admin dashboards. Progress is
// computed from real execution records, approved knowledge and
// memory — never from dates. Internal system: never public.
export async function GET(req: NextRequest) {
  const g = await guard(req, { minRole: AI_WORKFORCE_MIN_ROLE })
  if (isResponse(g)) return g

  const [agents, executions, knowledgeApproved, memoryCount] = await Promise.all([
    db.aiAgent.findMany({ include: { department: { select: { code: true, name: true, category: true } } } }),
    db.aiAgentExecution.groupBy({ by: ['agentCode', 'status'], _count: { _all: true } }),
    db.knowledgeDocument.count({ where: { status: { in: ['APPROVED', 'INDEXED'] } } }),
    db.aiMemory.count(),
  ])

  const stats = new Map<string, { total: number; success: number }>()
  for (const row of executions) {
    const cur = stats.get(row.agentCode) ?? { total: 0, success: 0 }
    cur.total += row._count._all
    if (row.status === 'SUCCESS') cur.success += row._count._all
    stats.set(row.agentCode, cur)
  }

  const agentRows = agents.map((a) => {
    const ev = stats.get(a.code) ?? { total: 0, success: 0 }
    const successRate = ev.total ? ev.success / ev.total : 0
    return {
      code: a.code,
      name: a.name,
      category: a.department?.category ?? 'OPERATIONS',
      department: a.department?.name ?? null,
      status: a.status,
      executions: ev.total,
      successRate: Math.round(successRate * 100) / 100,
      maturity: maturityFor({ executions: ev.total, successRate }),
      track: trackForCategory(a.department?.category).category,
    }
  })

  const byCategory = LEARNING_TRACKS.map((t) => {
    const inTrack = agentRows.filter((a) => a.track === t.category)
    return {
      category: t.category,
      agents: inTrack.length,
      qualified: inTrack.filter((a) => a.maturity === 'AI_MODEL_QUALIFIED').length,
      operational: inTrack.filter((a) => a.maturity === 'OPERATIONAL').length,
      skills: t.skills,
      gaps: t.gaps,
      sources: t.sources,
      months: t.months,
    }
  })

  return Response.json({
    sourceCount: TRAINING_SOURCE_COUNT,
    knowledgeApproved,
    memoryEntries: memoryCount,
    qualifiedDepartments: byCategory.filter((c) => c.agents > 0 && c.qualified === c.agents).length,
    categories: byCategory,
    agents: agentRows,
    note: 'Maturity is evidence-based (executions + success rate). AI_MODEL_QUALIFIED = Month-3 exit criteria met on real work; it is not a calendar claim and not a weights fine-tune.',
  })
}
