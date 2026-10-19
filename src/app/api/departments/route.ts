import { AI_WORKFORCE_MIN_ROLE } from '@/lib/ai-workforce-policy'
import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { guard, isResponse } from '@/lib/api-guard'
import { sanitizeText } from '@/lib/security'
import { DEPARTMENTS } from '@/lib/agents/registry'
import { LOGICAL_AGENT_CATALOGUE } from '@/lib/agents/catalogue'

export const dynamic = 'force-dynamic'

/**
 * GET /api/departments
 *
 * The department registry: the 110 canonical departments with their
 * category, the number of executable LLM agents and the number of
 * logical agent definitions registered against them.
 */
export async function GET(req: NextRequest) {
  const g = await guard(req, { minRole: AI_WORKFORCE_MIN_ROLE })
  if (isResponse(g)) return g
  const url = new URL(req.url)
  const category = sanitizeText(url.searchParams.get('category') ?? '', 30).toUpperCase()

  const persisted = await db.department.findMany({
    orderBy: { code: 'asc' },
    select: { code: true, name: true, category: true, description: true },
  })
  const persistedByCode = new Map(persisted.map((d) => [d.code, d]))
  // Count the executable agents per department with one grouped query
  // rather than a relation count, so the shape does not depend on the
  // generated client's relation metadata.
  const agentRows = await db.aiAgent.findMany({ select: { departmentId: true, department: { select: { code: true } } } })
  const executableByDepartment = new Map<string, number>()
  for (const row of agentRows) {
    const code = row.department?.code
    if (!code) continue
    executableByDepartment.set(code, (executableByDepartment.get(code) ?? 0) + 1)
  }

  const logicalCounts = new Map<string, number>()
  for (const agent of LOGICAL_AGENT_CATALOGUE) {
    logicalCounts.set(agent.department, (logicalCounts.get(agent.department) ?? 0) + 1)
  }

  const departments = DEPARTMENTS.filter((department) => !category || department.category === category).map(
    (department) => {
      const row = persistedByCode.get(department.code)
      return {
        code: department.code,
        name: department.name,
        category: department.category,
        description: department.description ?? null,
        persisted: Boolean(row),
        executableAgents: executableByDepartment.get(department.code) ?? 0,
        logicalAgents: logicalCounts.get(department.code) ?? 0,
        skills: LOGICAL_AGENT_CATALOGUE.filter((a) => a.department === department.code).length,
      }
    },
  )

  return Response.json({
    total: departments.length,
    canonicalTotal: DEPARTMENTS.length,
    categories: [...new Set(DEPARTMENTS.map((d) => d.category))].sort(),
    departments,
  })
}
