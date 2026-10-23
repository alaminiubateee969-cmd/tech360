import { AI_WORKFORCE_MIN_ROLE } from '@/lib/ai-workforce-policy'
import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { guard, isResponse } from '@/lib/api-guard'
import { sanitizeText } from '@/lib/security'
import { DCC_THRESHOLD_VERSION, isCurrentDccCertification, type StoredDccAssessment } from '@/lib/dcc-policy'
import { isValidExistingChildAgent } from '@/lib/agents/hierarchy-service'
import { DYNAMIC_AGENT_CODE_PATTERN, isWellFormedDynamicAgent } from '@/lib/agents/runtime-policy'

export const dynamic = 'force-dynamic'

class AgentStatusPolicyError extends Error {
  constructor(readonly code: string, message: string, readonly statusCode: number, readonly details: Record<string, unknown> = {}) {
    super(message)
  }
}

async function currentDcc(client: Pick<typeof db, 'departmentCapabilityAssessment'>, departmentId: string) {
  return client.departmentCapabilityAssessment.findFirst({
    where: { departmentId },
    orderBy: { assessedAt: 'desc' },
    select: {
      id: true,
      status: true,
      thresholdVersion: true,
      assessedAt: true,
      expiresAt: true,
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
    },
  })
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const guarded = await guard(req, { minRole: AI_WORKFORCE_MIN_ROLE })
  if (isResponse(guarded)) return guarded
  const { code } = await params
  const clean = sanitizeText(code, 20).toUpperCase()
  const agent = await db.aiAgent.findUnique({ where: { code: clean }, include: { department: true } })
  if (!agent) return Response.json({ error: 'Agent not found' }, { status: 404 })
  const executions = await db.aiAgentExecution.findMany({ where: { agentCode: clean }, orderBy: { createdAt: 'desc' }, take: 25 })
  return Response.json({
    agent: {
      ...agent,
      tools: JSON.parse(agent.tools || '[]'),
      permissions: JSON.parse(agent.permissions || '[]'),
      department: agent.department ? { code: agent.department.code, name: agent.department.name, category: agent.department.category } : null,
    },
    executions,
  })
}

/** Explicit human activation/pause for DB-backed dynamic drafts. */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const guarded = await guard(req, {
    minRole: AI_WORKFORCE_MIN_ROLE,
    limit: { max: 5, windowMs: 60_000 },
  })
  if (isResponse(guarded)) return guarded

  const { code } = await params
  const clean = sanitizeText(code, 20).toUpperCase()
  if (!DYNAMIC_AGENT_CODE_PATTERN.test(clean)) return Response.json({ error: 'Only dynamic AGT drafts can be activated or paused here.' }, { status: 400 })

  let body: { status?: unknown; reason?: unknown; confirmation?: unknown } = {}
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: 'A JSON body is required.' }, { status: 400 })
  }
  const nextStatus = sanitizeText(body.status, 16).toUpperCase()
  const reason = sanitizeText(body.reason, 500)
  const confirmation = sanitizeText(body.confirmation, 16)
  if (!['ACTIVE', 'PAUSED'].includes(nextStatus)) return Response.json({ error: 'Status must be ACTIVE or PAUSED.' }, { status: 400 })
  if (reason.length < 20) return Response.json({ error: 'A documented reason of at least 20 characters is required.' }, { status: 400 })
  if (nextStatus === 'ACTIVE' && confirmation !== 'ACTIVATE') {
    return Response.json({ error: 'Explicit confirmation is required: enter ACTIVATE.' }, { status: 400 })
  }

  try {
    const result = await db.$transaction(async (tx) => {
      const agent = await tx.aiAgent.findUnique({ where: { code: clean }, include: { department: { select: { code: true } } } })
      if (!agent) throw new AgentStatusPolicyError('AGENT_NOT_FOUND', 'Agent not found.', 404)
      if (nextStatus === 'ACTIVE') {
        if (!isWellFormedDynamicAgent(agent)) {
          throw new AgentStatusPolicyError('DYNAMIC_AGENT_INVALID', 'The persisted draft does not meet dynamic-agent runtime policy.', 409)
        }
        if (agent.status !== 'PAUSED') throw new AgentStatusPolicyError('AGENT_NOT_PAUSED', 'Only a PAUSED draft can be activated.', 409)
        if (!agent.departmentId || !agent.department) throw new AgentStatusPolicyError('DEPARTMENT_REQUIRED', 'The persisted agent has no department.', 409)
        const certification = await currentDcc(tx, agent.departmentId)
        if (!certification || !isCurrentDccCertification(certification as StoredDccAssessment)) {
          throw new AgentStatusPolicyError('DCC_CERTIFICATION_REQUIRED', 'Activation is blocked until the department has fresh passing DCC evidence.', 403, {
            departmentCode: agent.department.code,
            assessmentId: certification?.id ?? null,
            assessmentStatus: certification?.status ?? 'NOT_ASSESSED',
            thresholdVersion: certification?.thresholdVersion ?? null,
          })
        }
        if (!(await isValidExistingChildAgent(tx, agent))) {
          throw new AgentStatusPolicyError('INVALID_HIERARCHY', 'Activation is blocked because the parent chain is inactive, cross-department, over depth, or over the child limit.', 409)
        }
      }

      const updated = await tx.aiAgent.update({ where: { code: clean }, data: { status: nextStatus }, select: { code: true, name: true, status: true, departmentId: true, parentCode: true } })
      await tx.auditLog.create({
        data: {
          actor: guarded.user.email,
          userId: guarded.user.id,
          action: nextStatus === 'ACTIVE' ? 'AGENT_ACTIVATED' : 'AGENT_PAUSED',
          entityType: 'AiAgent',
          entityId: updated.code,
          details: JSON.stringify({
            departmentCode: agent.department?.code ?? null,
            parentCode: agent.parentCode,
            reason,
            thresholdVersion: nextStatus === 'ACTIVE' ? DCC_THRESHOLD_VERSION : null,
          }),
        },
      })
      return updated
    }, { isolationLevel: 'Serializable' })

    return Response.json({ ok: true, agent: result, message: nextStatus === 'ACTIVE' ? 'Dynamic agent activated after current DCC and hierarchy checks.' : 'Dynamic agent paused.' })
  } catch (error) {
    if (error instanceof AgentStatusPolicyError) {
      try {
        await db.auditLog.create({
          data: {
            actor: guarded.user.email,
            userId: guarded.user.id,
            action: 'AGENT_STATUS_CHANGE_BLOCKED',
            entityType: 'AiAgent',
            entityId: clean,
            details: JSON.stringify({ code: error.code, reason, ...error.details }),
          },
        })
      } catch {
        return Response.json({ error: 'Status change remains blocked, but its audit record could not be written.' }, { status: 503 })
      }
      return Response.json({ error: error.message, code: error.code, ...error.details }, { status: error.statusCode })
    }
    return Response.json({ error: 'Agent status change could not be persisted. No success is reported.' }, { status: 503 })
  }
}
