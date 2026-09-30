import { AI_WORKFORCE_MIN_ROLE } from '@/lib/ai-workforce-policy'
import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { guard, isResponse } from '@/lib/api-guard'
import { sanitizeText } from '@/lib/security'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const g = await guard(req, { minRole: AI_WORKFORCE_MIN_ROLE })
  if (isResponse(g)) return g
  const url = new URL(req.url)
  const query = sanitizeText(url.searchParams.get('query') ?? '', 60)
  const status = sanitizeText(url.searchParams.get('status') ?? '', 20).toUpperCase()
  const [agents, departments, stats] = await Promise.all([
    db.aiAgent.findMany({
      where: {
        ...(status ? { status } : {}),
        ...(query ? { OR: [{ code: { contains: query.toUpperCase() } }, { name: { contains: query } }, { title: { contains: query } }, { purpose: { contains: query } }] } : {}),
      },
      include: { department: { select: { code: true, name: true, category: true } } },
      orderBy: [{ level: 'asc' }, { code: 'asc' }],
    }),
    db.department.findMany({ orderBy: { code: 'asc' } }),
    db.aiAgent.aggregate({ _count: true }),
  ])
  const active = agents.filter((a) => a.status === 'ACTIVE').length
  const totalExec = agents.reduce((a, x) => a + x.executionCount, 0)
  return Response.json({
    agents: agents.map((a) => ({
      code: a.code, name: a.name, title: a.title, dept: a.department?.code ?? '—', deptName: a.department?.name ?? 'Unassigned',
      category: a.department?.category ?? 'OPERATIONS', purpose: a.purpose, status: a.status,
      executions: a.executionCount, successRate: a.executionCount > 0 ? Math.round((a.successCount / a.executionCount) * 100) : null,
      requiresApproval: a.requiresApproval, level: a.level, tools: JSON.parse(a.tools || '[]'), permissions: JSON.parse(a.permissions || '[]'),
      parentCode: a.parentCode, dailyQuota: a.dailyQuota,
    })),
    departments: departments.map((d) => ({ code: d.code, name: d.name, category: d.category })),
    stats: { totalDepartments: departments.length, totalAgents: stats._count, activeAgents: active, totalExecutions: totalExec },
  })
}
