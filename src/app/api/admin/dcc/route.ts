import { AI_WORKFORCE_MIN_ROLE } from '@/lib/ai-workforce-policy'
import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { guard, isResponse } from '@/lib/api-guard'
import { sanitizeText } from '@/lib/security'
import { DEPARTMENTS } from '@/lib/agents/registry'
import { collectDepartmentDccEvidence } from '@/lib/agents/dcc-evidence'
import { DCC_CERTIFICATION_VALIDITY_DAYS, DCC_THRESHOLD_VERSION, DCC_THRESHOLDS, evaluateDcc, isCurrentDccCertification, type DccMetricEvidence, type DccMetricKey } from '@/lib/dcc-policy'

export const dynamic = 'force-dynamic'
const MAX_DEPARTMENTS_PER_PAGE = 500

function metricColumns(metrics: Partial<Record<DccMetricKey, DccMetricEvidence>>) {
  return {
    sopCoverage: metrics.sopCoverage?.value ?? null,
    knowledgeCoverage: metrics.knowledgeCoverage?.value ?? null,
    skillCoverage: metrics.skillCoverage?.value ?? null,
    testPassRate: metrics.testPassRate?.value ?? null,
    kpiAchievement: metrics.kpiAchievement?.value ?? null,
    securityCompliance: metrics.securityCompliance?.value ?? null,
    auditCompliance: metrics.auditCompliance?.value ?? null,
    selfRecoveryRate: metrics.selfRecoveryRate?.value ?? null,
    humanEscalationRate: metrics.humanEscalationRate?.value ?? null,
  }
}

/**
 * GET /api/admin/dcc — persisted department rows and their latest persisted
 * assessment. Code catalogue counts are returned separately and never treated
 * as database departments or deployed agents.
 */
export async function GET(req: NextRequest) {
  const guarded = await guard(req, { minRole: AI_WORKFORCE_MIN_ROLE })
  if (isResponse(guarded)) return guarded

  const requestedLimit = Number(req.nextUrl.searchParams.get('limit') ?? 200)
  const requestedOffset = Number(req.nextUrl.searchParams.get('offset') ?? 0)
  const limit = Number.isFinite(requestedLimit)
    ? Math.min(MAX_DEPARTMENTS_PER_PAGE, Math.max(1, Math.floor(requestedLimit)))
    : 200
  const offset = Number.isFinite(requestedOffset) ? Math.max(0, Math.floor(requestedOffset)) : 0

  try {
    const [total, departments] = await Promise.all([
      db.department.count(),
      db.department.findMany({
        orderBy: { code: 'asc' },
        skip: offset,
        take: limit,
        select: {
          id: true,
          code: true,
          name: true,
          category: true,
          _count: { select: { agents: true } },
          dccAssessments: {
            orderBy: { assessedAt: 'desc' },
            take: 1,
            select: {
              id: true,
              thresholdVersion: true,
              status: true,
              sopCoverage: true,
              knowledgeCoverage: true,
              skillCoverage: true,
              testPassRate: true,
              kpiAchievement: true,
              securityCompliance: true,
              auditCompliance: true,
              selfRecoveryRate: true,
              humanEscalationRate: true,
              evidence: true,
              measurementStart: true,
              measurementEnd: true,
              assessedBy: true,
              assessedAt: true,
              expiresAt: true,
            },
          },
        },
      }),
    ])

    return Response.json({
      source: 'PERSISTED_DATABASE',
      persistedDepartmentCount: total,
      sourceDefinedDepartmentCount: DEPARTMENTS.length,
      thresholdVersion: DCC_THRESHOLD_VERSION,
      thresholds: DCC_THRESHOLDS,
      limit,
      offset,
      departments: departments.map(({ dccAssessments, _count, ...department }) => {
        const latest = dccAssessments[0] ?? null
        let evaluation: ReturnType<typeof evaluateDcc> | null = null
        if (latest) {
          try {
            evaluation = evaluateDcc(JSON.parse(latest.evidence))
          } catch {
            evaluation = null
          }
        }
        return {
          ...department,
          persistedAgentCount: _count.agents,
          latestAssessment: latest ? {
            ...latest,
            certificationCurrent: isCurrentDccCertification(latest),
            evaluation,
          } : null,
        }
      }),
    })
  } catch {
    return Response.json({ error: 'Department certification storage is unavailable. No certification state was inferred.' }, { status: 503 })
  }
}

/** Create an immutable, evidence-backed snapshot. Missing metrics remain null. */
export async function POST(req: NextRequest) {
  const guarded = await guard(req, {
    minRole: AI_WORKFORCE_MIN_ROLE,
    limit: { max: 10, windowMs: 60_000 },
  })
  if (isResponse(guarded)) return guarded

  let body: { departmentCode?: unknown } = {}
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: 'A JSON body with departmentCode is required.' }, { status: 400 })
  }
  const departmentCode = sanitizeText(body.departmentCode, 10).trim().toUpperCase()
  if (!/^[A-Z0-9]{4,10}$/.test(departmentCode)) {
    return Response.json({ error: 'A valid persisted department code is required.' }, { status: 400 })
  }

  try {
    const department = await db.department.findUnique({ where: { code: departmentCode }, select: { id: true, code: true, name: true } })
    if (!department) return Response.json({ error: 'Department not found in the persisted department table.' }, { status: 404 })

    const report = await collectDepartmentDccEvidence({ departmentId: department.id, departmentCode: department.code })
    const now = new Date()
    const expiresAt = report.certified
      ? new Date(now.getTime() + DCC_CERTIFICATION_VALIDITY_DAYS * 24 * 60 * 60 * 1000)
      : null
    const columns = metricColumns(report.metrics)

    const assessment = await db.$transaction(async (tx) => {
      const created = await tx.departmentCapabilityAssessment.create({
        data: {
          departmentId: department.id,
          thresholdVersion: report.thresholdVersion,
          status: report.status,
          ...columns,
          evidence: JSON.stringify(report.metrics),
          measurementStart: report.windowStart,
          measurementEnd: report.windowEnd,
          assessedBy: guarded.user.id,
          assessedAt: now,
          expiresAt,
        },
      })
      await tx.auditLog.create({
        data: {
          actor: guarded.user.email,
          userId: guarded.user.id,
          action: 'DEPARTMENT_DCC_ASSESSED',
          entityType: 'DepartmentCapabilityAssessment',
          entityId: created.id,
          details: JSON.stringify({
            departmentCode: department.code,
            status: report.status,
            thresholdVersion: report.thresholdVersion,
            failed: report.evaluation.failed,
            missing: report.evaluation.missing,
            measurementStart: report.windowStart.toISOString(),
            measurementEnd: report.windowEnd.toISOString(),
          }),
        },
      })
      return created
    })

    return Response.json({
      department,
      assessment: {
        id: assessment.id,
        status: assessment.status,
        thresholdVersion: assessment.thresholdVersion,
        assessedBy: assessment.assessedBy,
        assessedAt: assessment.assessedAt,
        expiresAt: assessment.expiresAt,
      },
      evaluation: report.evaluation,
      measurementWindow: { start: report.windowStart, end: report.windowEnd },
      message: report.certified
        ? `DCC certified for ${department.code}. Certification expires after ${DCC_CERTIFICATION_VALIDITY_DAYS} days.`
        : `DCC ${report.status.toLowerCase()} for ${department.code}; agent creation remains blocked until every mandatory metric has fresh passing evidence.`,
    }, { status: 201 })
  } catch {
    return Response.json({ error: 'DCC assessment could not be persisted. Certification and agent creation remain fail-closed.' }, { status: 503 })
  }
}
