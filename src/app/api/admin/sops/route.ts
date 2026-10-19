import { NextRequest } from 'next/server'
import { guard, isResponse } from '@/lib/api-guard'
import { getSop, sopsForDepartment, SOP_LIBRARY, SOP_LIBRARY_SIZE } from '@/lib/sops/library'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

/**
 * GET /api/admin/sops — the procedure library.
 *
 * GET /api/admin/sops?key=D001-INTAKE — one procedure with its run
 *   history from the database.
 *
 * The run history is REAL: it is read from the SopRun table. When no
 * procedure has been executed, the history is empty — the panel never
 * shows a fabricated run.
 */
export async function GET(req: NextRequest) {
  const g = await guard(req, { minRole: 'SUPER_ADMIN' })
  if (isResponse(g)) return g

  const params = req.nextUrl.searchParams
  const key = params.get('key')
  const department = params.get('department')

  if (key) {
    const definition = getSop(key)
    if (!definition) {
      return Response.json({ error: `No procedure with the key "${key}".`, code: 'SOP_NOT_FOUND' }, { status: 404 })
    }
    const runs = await db.sopRun
      .findMany({
        where: { sopKey: key },
        orderBy: { createdAt: 'desc' },
        take: 25,
        select: { id: true, status: true, stepIndex: true, totalSteps: true, startedAt: true, completedAt: true, error: true, correlationId: true },
      })
    const totalRuns = await db.sopRun.count({ where: { sopKey: key } })
    return Response.json({ procedure: definition, runs, totalRuns })
  }

  const procedures = department ? sopsForDepartment(department) : SOP_LIBRARY
  const limit = Math.max(1, Math.min(600, Number(params.get('limit') ?? 550)))

  // The real run counts, grouped by procedure key.
  const grouped = await db.sopRun.groupBy({ by: ['sopKey'], _count: { _all: true } })
  const runCounts = new Map(grouped.map((row) => [row.sopKey, row._count._all]))

  return Response.json({
    total: SOP_LIBRARY_SIZE,
    procedures: procedures.slice(0, limit).map((procedure) => ({
      key: procedure.key,
      name: procedure.name,
      category: procedure.category,
      departmentCode: procedure.departmentCode,
      level: procedure.level,
      version: procedure.version,
      status: procedure.status,
      owner: procedure.owner,
      trigger: procedure.trigger,
      steps: procedure.steps.length,
      decisionPoints: procedure.decisionPoints.length,
      tools: procedure.tools,
      requiresApproval: procedure.requiresApproval,
      validation: procedure.validation,
      output: procedure.output,
      failurePath: procedure.failurePath,
      escalation: procedure.escalation,
      runs: runCounts.get(procedure.key) ?? 0,
    })),
  })
}
