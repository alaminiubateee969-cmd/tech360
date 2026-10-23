import { db } from '@/lib/db'
import { isCurrentDccCertification, type StoredDccAssessment } from '@/lib/dcc-policy'
import { evaluateAgentPlacement, MAX_AGENT_HIERARCHY_DEPTH } from './hierarchy-policy'

type HierarchyClient = Pick<typeof db, 'aiAgent' | 'departmentCapabilityAssessment'>
export type HierarchyNode = {
  code: string
  parentCode: string | null
  departmentId: string | null
  status: string
  department: { code: string } | null
}

export type ParentHierarchy = {
  valid: boolean
  parent: HierarchyNode | null
  parentDepth: number | null
  sameDepartment: boolean
  allAncestorsActive: boolean
  reason: string | null
}

/** Resolve persisted ancestry with cycle, orphan, department, and depth checks. */
export async function inspectParentHierarchy(
  client: HierarchyClient,
  parentCode: string,
  departmentId: string,
): Promise<ParentHierarchy> {
  const visited = new Set<string>()
  let currentCode: string | null = parentCode
  let parent: HierarchyNode | null = null
  let depth = 0
  let sameDepartment = true
  let allAncestorsActive = true

  while (currentCode) {
    if (visited.has(currentCode)) {
      return { valid: false, parent, parentDepth: null, sameDepartment: false, allAncestorsActive: false, reason: 'The persisted parent chain contains a cycle.' }
    }
    visited.add(currentCode)

    const node = await client.aiAgent.findUnique({
      where: { code: currentCode },
      select: {
        code: true,
        parentCode: true,
        departmentId: true,
        status: true,
        department: { select: { code: true } },
      },
    })
    if (!node) {
      return { valid: false, parent, parentDepth: null, sameDepartment: false, allAncestorsActive: false, reason: 'The persisted parent chain contains a missing agent.' }
    }
    if (!parent) parent = node
    if (node.departmentId !== departmentId) sameDepartment = false
    if (node.status !== 'ACTIVE') allAncestorsActive = false

    depth += 1
    if (depth > MAX_AGENT_HIERARCHY_DEPTH) {
      return { valid: false, parent, parentDepth: depth, sameDepartment, allAncestorsActive, reason: `The persisted parent chain exceeds depth ${MAX_AGENT_HIERARCHY_DEPTH}.` }
    }
    currentCode = node.parentCode
  }

  return {
    valid: parent !== null,
    parent,
    parentDepth: parent ? depth : null,
    sameDepartment,
    allAncestorsActive,
    reason: parent ? null : 'A persisted parent agent is required.',
  }
}

/** Verify fresh DCC plus persisted structure of a dynamic child at activation/runtime boundaries. */
export async function isValidExistingChildAgent(
  client: HierarchyClient,
  agent: { code: string; parentCode: string | null; departmentId: string | null; department: { code: string } | null },
): Promise<boolean> {
  if (!agent.parentCode || !agent.departmentId || !agent.department?.code || agent.parentCode === agent.code) return false
  const certification = await client.departmentCapabilityAssessment.findFirst({
    where: { departmentId: agent.departmentId },
    orderBy: { assessedAt: 'desc' },
    select: {
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
  if (!certification || !isCurrentDccCertification(certification as StoredDccAssessment)) return false

  const hierarchy = await inspectParentHierarchy(client, agent.parentCode, agent.departmentId)
  if (!hierarchy.parent || !hierarchy.valid || !hierarchy.sameDepartment || !hierarchy.allAncestorsActive) return false
  const persistedChildren = await client.aiAgent.count({ where: { parentCode: agent.parentCode } })
  const placement = evaluateAgentPlacement({
    parentExists: true,
    parentStatus: hierarchy.parent.status,
    parentDepartmentCode: hierarchy.parent.department?.code ?? null,
    departmentCode: agent.department.code,
    parentDepth: hierarchy.parentDepth,
    // The target agent is already one of the parent's persisted children.
    existingChildren: persistedChildren - 1,
  })
  return placement.allowed && placement.depth === MAX_AGENT_HIERARCHY_DEPTH && persistedChildren >= 1
}
