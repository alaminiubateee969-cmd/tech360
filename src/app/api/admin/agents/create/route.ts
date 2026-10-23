import { randomBytes } from 'crypto'
import { AI_WORKFORCE_MIN_ROLE, AGENT_TOOLS } from '@/lib/ai-workforce-policy'
import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { guard, isResponse } from '@/lib/api-guard'
import { readJson, sanitizeText } from '@/lib/security'
import { runAgent } from '@/lib/agents/engine'
import { inspectParentHierarchy } from '@/lib/agents/hierarchy-service'
import { evaluateAgentPlacement } from '@/lib/agents/hierarchy-policy'
import { CORE_AGENTS } from '@/lib/agents/registry'
import { DCC_THRESHOLD_VERSION, isCurrentDccCertification, type StoredDccAssessment } from '@/lib/dcc-policy'

export const dynamic = 'force-dynamic'

const KNOWN_PERMISSIONS = new Set(CORE_AGENTS.flatMap((agent) => agent.permissions).filter((permission) => permission !== '*' && !permission.endsWith(':all')))
const CODE_PATTERN = /^AGT-[A-F0-9]{8}$/

class CreationPolicyError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status: number,
    readonly details: Record<string, unknown> = {},
  ) {
    super(message)
  }
}

function parseGeneratedGrants(value: unknown, allowed: ReadonlySet<string>, maxItems: number): string[] | null {
  if (!Array.isArray(value) || value.length > maxItems) return null
  const items: string[] = []
  for (const entry of value) {
    if (typeof entry !== 'string') return null
    const item = sanitizeText(entry, 120)
    if (!item || !allowed.has(item) || items.includes(item)) return null
    items.push(item)
  }
  return items
}

async function latestCertification(client: Pick<typeof db, 'departmentCapabilityAssessment'>, departmentId: string) {
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

function requireCurrentCertification(row: (Awaited<ReturnType<typeof latestCertification>>) | null): asserts row is NonNullable<Awaited<ReturnType<typeof latestCertification>>> {
  if (!row || !isCurrentDccCertification(row as StoredDccAssessment)) {
    const details: Record<string, unknown> = {
      assessmentId: row?.id ?? null,
      assessmentStatus: row?.status ?? 'NOT_ASSESSED',
      thresholdVersion: row?.thresholdVersion ?? null,
    }
    throw new CreationPolicyError(
      'DCC_CERTIFICATION_REQUIRED',
      'The selected department does not have a fresh, fully passing DCC certification.',
      403,
      details,
    )
  }
}

function requirePlacement(input: Parameters<typeof evaluateAgentPlacement>[0]) {
  const placement = evaluateAgentPlacement(input)
  if (!placement.allowed) {
    throw new CreationPolicyError(placement.code, placement.reason, 409, {
      parentCode: input.parentExists ? undefined : null,
      parentDepth: input.parentDepth,
      existingChildren: input.existingChildren,
    })
  }
  return placement
}

async function auditBlockedDecision(user: { id: string; email: string }, departmentId: string | null, code: string, details: Record<string, unknown>) {
  await db.auditLog.create({
    data: {
      actor: user.email,
      userId: user.id,
      action: code === 'DCC_CERTIFICATION_REQUIRED' ? 'AGENT_CREATION_BLOCKED_DCC' : 'AGENT_CREATION_BLOCKED_POLICY',
      entityType: departmentId ? 'Department' : 'AgentCreationRequest',
      entityId: departmentId,
      details: JSON.stringify({ code, ...details }).slice(0, 8_000),
    },
  })
}

/**
 * Governed draft creation. A fresh persisted DCC certificate is required before
 * any LLM drafting call. New agents are explicit children, bounded to three per
 * active parent and depth two, and always persist PAUSED.
 */
export async function POST(req: NextRequest) {
  const guarded = await guard(req, {
    minRole: AI_WORKFORCE_MIN_ROLE,
    limit: { max: 3, windowMs: 60_000 },
  })
  if (isResponse(guarded)) return guarded

  const raw = await readJson(req)
  const purpose = sanitizeText(raw.purpose, 300)
  const description = sanitizeText(raw.description, 2_000)
  const departmentCode = sanitizeText(raw.departmentCode, 10).toUpperCase()
  const parentCode = sanitizeText(raw.parentCode, 20).toUpperCase()
  if (purpose.length < 10) return Response.json({ error: 'Describe the agent purpose (at least 10 characters).' }, { status: 400 })
  if (description.length < 20) return Response.json({ error: 'Describe the proposed behavior and boundaries (at least 20 characters).' }, { status: 400 })
  if (!/^[A-Z0-9]{4,10}$/.test(departmentCode)) return Response.json({ error: 'A persisted department code is required.' }, { status: 400 })
  if (!/^[A-Z0-9_-]{2,20}$/.test(parentCode)) return Response.json({ error: 'An active persisted parent agent is required.' }, { status: 400 })

  let department: { id: string; code: string; name: string } | null
  try {
    department = await db.department.findUnique({ where: { code: departmentCode }, select: { id: true, code: true, name: true } })
    if (!department) return Response.json({ error: 'Department does not exist in the persisted database.' }, { status: 404 })

    const certification = await latestCertification(db, department.id)
    try {
      requireCurrentCertification(certification)
    } catch (error) {
      if (error instanceof CreationPolicyError) {
        await auditBlockedDecision(guarded.user, department.id, error.code, {
          departmentCode,
          assessmentId: certification?.id ?? null,
          assessmentStatus: certification?.status ?? 'NOT_ASSESSED',
          thresholdVersion: certification?.thresholdVersion ?? null,
        })
        return Response.json({
          error: 'Agent drafting is blocked: this department is not currently DCC-certified. No AI drafting call or agent write was made.',
          code: error.code,
          departmentCode,
          assessmentId: certification?.id ?? null,
          assessmentStatus: certification?.status ?? 'NOT_ASSESSED',
        }, { status: error.status })
      }
      throw error
    }

    const hierarchy = await inspectParentHierarchy(db, parentCode, department.id)
    if (!hierarchy.parent) return Response.json({ error: 'Parent agent was not found in the persisted agent table.' }, { status: 404 })
    const existingChildren = await db.aiAgent.count({ where: { parentCode } })
    try {
      requirePlacement({
        parentExists: hierarchy.valid,
        parentStatus: hierarchy.parent.status,
        parentDepartmentCode: hierarchy.parent.department?.code ?? null,
        departmentCode: department.code,
        parentDepth: hierarchy.valid && hierarchy.sameDepartment ? hierarchy.parentDepth : null,
        existingChildren,
      })
      if (!hierarchy.valid || !hierarchy.sameDepartment || !hierarchy.allAncestorsActive) {
        throw new CreationPolicyError('INVALID_HIERARCHY', hierarchy.reason ?? 'The parent hierarchy is invalid or inactive.', 409)
      }
    } catch (error) {
      const policy = error instanceof CreationPolicyError
        ? error
        : new CreationPolicyError('INVALID_HIERARCHY', 'The persisted parent hierarchy is invalid.', 409)
      await auditBlockedDecision(guarded.user, department.id, policy.code, {
        departmentCode,
        parentCode,
        reason: policy.message,
        parentDepth: hierarchy.parentDepth,
        existingChildren,
      })
      return Response.json({ error: policy.message, code: policy.code, departmentCode, parentCode }, { status: policy.status })
    }
  } catch {
    return Response.json({ error: 'DCC or hierarchy data is unavailable. Agent creation remains fail-closed.' }, { status: 503 })
  }

  // The department and parent are fixed by the authorized caller; model output
  // cannot move a draft into an uncertified department or choose its hierarchy.
  const run = await runAgent('AGC-041', {
    input: `Draft one new TECH360 AI agent.\nPurpose: ${purpose}\nDetails and boundaries: ${description}\nDepartment: ${department.code} — ${department.name}\nParent agent: ${parentCode}\nProposed by: ${guarded.user.email}\nReturn JSON with name, title, systemPrompt, tools, and permissions. Do not choose a different department or parent.`,
    expectJson: true,
    workflow: 'AGENT_CREATION',
  })
  if (!run.ok || !run.json) {
    return Response.json({ ok: false, message: `Agent drafting failed: ${run.error ?? 'no structured output'}` }, { status: 502 })
  }

  const name = sanitizeText(run.json.name, 80)
  const title = sanitizeText(run.json.title, 120) || purpose.slice(0, 80)
  const systemPrompt = sanitizeText(run.json.systemPrompt, 20_000)
  const tools = parseGeneratedGrants(run.json.tools, new Set(AGENT_TOOLS.filter((tool) => tool !== 'capability:all')), 40)
  const permissions = parseGeneratedGrants(run.json.permissions, KNOWN_PERMISSIONS, 40)
  if (name.length < 2 || systemPrompt.length < 50 || !tools || !permissions) {
    try {
      await db.auditLog.create({
        data: {
          actor: guarded.user.email,
          userId: guarded.user.id,
          action: 'AGENT_CREATION_DRAFT_REJECTED',
          entityType: 'Department',
          entityId: department.id,
          details: JSON.stringify({ departmentCode, parentCode, reason: 'Generated draft failed schema or least-privilege validation.' }),
        },
      })
    } catch {
      return Response.json({ error: 'The invalid draft was not saved, but its rejection audit could not be recorded.' }, { status: 503 })
    }
    return Response.json({ error: 'The generated draft failed schema or least-privilege validation and was not saved.', code: 'AGENT_DRAFT_INVALID' }, { status: 422 })
  }

  const code = `AGT-${randomBytes(4).toString('hex').toUpperCase()}`
  if (!CODE_PATTERN.test(code)) return Response.json({ error: 'A valid agent identifier could not be generated.' }, { status: 500 })

  try {
    const created = await db.$transaction(async (tx) => {
      const currentDepartment = await tx.department.findUnique({ where: { code: department.code }, select: { id: true, code: true } })
      if (!currentDepartment || currentDepartment.id !== department.id) {
        throw new CreationPolicyError('DEPARTMENT_CHANGED', 'The persisted department changed during drafting.', 409)
      }
      const latest = await latestCertification(tx, currentDepartment.id)
      requireCurrentCertification(latest)

      const currentHierarchy = await inspectParentHierarchy(tx, parentCode, currentDepartment.id)
      const currentChildren = await tx.aiAgent.count({ where: { parentCode } })
      if (!currentHierarchy.parent || !currentHierarchy.valid || !currentHierarchy.sameDepartment || !currentHierarchy.allAncestorsActive) {
        throw new CreationPolicyError('INVALID_HIERARCHY', currentHierarchy.reason ?? 'The parent hierarchy changed during drafting.', 409)
      }
      requirePlacement({
        parentExists: true,
        parentStatus: currentHierarchy.parent.status,
        parentDepartmentCode: currentHierarchy.parent.department?.code ?? null,
        departmentCode: currentDepartment.code,
        parentDepth: currentHierarchy.parentDepth,
        existingChildren: currentChildren,
      })
      const collision = await tx.aiAgent.findUnique({ where: { code }, select: { id: true } })
      if (collision) throw new CreationPolicyError('AGENT_CODE_COLLISION', 'The generated agent code already exists; retry the request.', 409)

      const agent = await tx.aiAgent.create({
        data: {
          code,
          name,
          title,
          departmentId: currentDepartment.id,
          parentCode,
          purpose,
          systemPrompt,
          tools: JSON.stringify(tools),
          permissions: JSON.stringify(permissions),
          requiresApproval: true,
          status: 'PAUSED',
        },
        select: { code: true, name: true, status: true, departmentId: true, parentCode: true },
      })
      await tx.auditLog.create({
        data: {
          actor: guarded.user.email,
          userId: guarded.user.id,
          action: 'AGENT_CREATED_PAUSED',
          entityType: 'AiAgent',
          entityId: agent.code,
          details: JSON.stringify({ departmentCode, parentCode, assessmentId: latest?.id ?? null, thresholdVersion: DCC_THRESHOLD_VERSION, purpose }),
        },
      })
      return { agent, assessmentId: latest?.id ?? null }
    }, { isolationLevel: 'Serializable' })

    return Response.json({
      ok: true,
      agent: { code: created.agent.code, name: created.agent.name, status: created.agent.status, parentCode: created.agent.parentCode },
      assessmentId: created.assessmentId,
      message: `Draft ${created.agent.code} saved as PAUSED under ${parentCode}. It cannot execute until a Super Admin explicitly activates it after reviewing the persisted draft.`,
    }, { status: 201 })
  } catch (error) {
    if (error instanceof CreationPolicyError) {
      try {
        await auditBlockedDecision(guarded.user, department.id, error.code, {
          departmentCode,
          parentCode,
          reason: error.message,
          ...error.details,
        })
      } catch {
        return Response.json({ error: 'Creation remains blocked, but the decision audit could not be recorded.' }, { status: 503 })
      }
      return Response.json({ error: error.message, code: error.code }, { status: error.status })
    }
    return Response.json({ error: 'Agent draft could not be persisted. No partially saved agent is reported.' }, { status: 503 })
  }
}
