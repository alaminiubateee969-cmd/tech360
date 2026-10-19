import { NextRequest } from 'next/server'
import { guard, isResponse } from '@/lib/api-guard'
import { WORKFORCE, workforceStats, validateWorkforce, getEmployee, employeesInDepartment } from '@/lib/agents/workforce'
import { DIVISIONS, ORG_LEVELS } from '@/lib/agents/org'
import { DEPARTMENTS } from '@/lib/agents/registry'

export const dynamic = 'force-dynamic'

/**
 * GET /api/admin/workforce — the AI workforce.
 *
 * GET /api/admin/workforce?employeeId=EMP-D010-004 — one employee.
 * GET /api/admin/workforce?department=D010 — one department.
 *
 * Every number is COUNTED from the workforce, not asserted. The
 * response carries the validation result, so a panel can show that
 * the workforce is consistent rather than claiming it.
 */
export async function GET(req: NextRequest) {
  const g = await guard(req, { minRole: 'SUPER_ADMIN' })
  if (isResponse(g)) return g

  const params = req.nextUrl.searchParams
  const employeeId = params.get('employeeId')
  const department = params.get('department')
  const division = params.get('division')
  const level = params.get('level')

  if (employeeId) {
    const employee = getEmployee(employeeId)
    if (!employee) {
      return Response.json({ error: `No employee with the id "${employeeId}".`, code: 'EMPLOYEE_NOT_FOUND' }, { status: 404 })
    }
    return Response.json({ employee })
  }

  let employees = WORKFORCE
  if (department) employees = employees.filter((e) => e.profile.departmentCode === department)
  if (division) employees = employees.filter((e) => e.profile.divisionCode === division)
  if (level) employees = employees.filter((e) => e.profile.levelName === level)

  // The list view never returns all 2,201 employees in one payload.
  const limit = Math.max(1, Math.min(200, Number(params.get('limit') ?? 50)))
  const offset = Math.max(0, Number(params.get('offset') ?? 0))

  const stats = workforceStats()
  const validation = validateWorkforce()

  return Response.json({
    stats: {
      ...stats,
      levels: ORG_LEVELS.map((entry) => ({
        level: entry.level,
        name: entry.name,
        label: entry.label,
        count: stats.byLevel[entry.name] ?? 0,
        decisionAuthority: entry.decisionAuthority,
      })),
      divisionList: DIVISIONS.map((entry) => ({
        code: entry.code,
        name: entry.name,
        count: stats.byDivision[entry.code] ?? 0,
        departments: DEPARTMENTS.filter((d) => entry.categories.includes(d.category)).map((d) => d.code),
      })),
    },
    validation: { valid: validation.valid, issues: validation.issues.slice(0, 25), issueCount: validation.issues.length },
    employees: employees.slice(offset, offset + limit).map((employee) => ({
      employeeId: employee.employeeId,
      name: employee.profile.name,
      role: employee.profile.role,
      level: employee.profile.level,
      levelName: employee.profile.levelName,
      departmentCode: employee.profile.departmentCode,
      departmentName: employee.profile.departmentName,
      divisionCode: employee.profile.divisionCode,
      managerEmployeeId: employee.profile.managerEmployeeId,
      tools: employee.profile.tools.length,
      skills: employee.configuration.skills.length,
      sops: employee.sops.length,
      knowledgeAccess: employee.profile.knowledgeAccess,
      memoryScopes: employee.profile.memoryScopes,
      kpis: employee.profile.kpis,
      modelProfile: employee.configuration.modelProfile,
      status: employee.configuration.status,
    })),
    total: employees.length,
    offset,
    limit,
  })
}
