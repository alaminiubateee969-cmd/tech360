export const MAX_CHILD_AGENTS_PER_PARENT = 3
/** Root agents are depth 1; one child layer (depth 2) is allowed. */
export const MAX_AGENT_HIERARCHY_DEPTH = 2

export type AgentPlacementInput = {
  parentExists: boolean
  parentStatus: string | null
  parentDepartmentCode: string | null
  departmentCode: string
  parentDepth: number | null
  existingChildren: number
}

export type AgentPlacementDecision =
  | { allowed: true; depth: number }
  | {
      allowed: false
      code: 'PARENT_NOT_FOUND' | 'PARENT_NOT_ACTIVE' | 'DEPARTMENT_MISMATCH' | 'INVALID_HIERARCHY' | 'MAX_DEPTH_REACHED' | 'MAX_CHILDREN_REACHED'
      reason: string
    }

/** Pure guard for child-agent creation. Database ancestry and child counts are supplied by the caller. */
export function evaluateAgentPlacement(input: AgentPlacementInput): AgentPlacementDecision {
  if (!input.parentExists) {
    return { allowed: false, code: 'PARENT_NOT_FOUND', reason: 'A persisted parent agent is required.' }
  }
  if (input.parentStatus !== 'ACTIVE') {
    return { allowed: false, code: 'PARENT_NOT_ACTIVE', reason: 'The parent agent must be ACTIVE.' }
  }
  if (!input.parentDepartmentCode || input.parentDepartmentCode !== input.departmentCode) {
    return { allowed: false, code: 'DEPARTMENT_MISMATCH', reason: 'Parent and child must belong to the same persisted department.' }
  }
  const parentDepth = input.parentDepth
  if (parentDepth === null || !Number.isInteger(parentDepth) || parentDepth < 1) {
    return { allowed: false, code: 'INVALID_HIERARCHY', reason: 'The parent hierarchy is missing, cyclic, or invalid.' }
  }
  if (parentDepth >= MAX_AGENT_HIERARCHY_DEPTH) {
    return { allowed: false, code: 'MAX_DEPTH_REACHED', reason: `Agent hierarchy is limited to depth ${MAX_AGENT_HIERARCHY_DEPTH}.` }
  }
  if (!Number.isInteger(input.existingChildren) || input.existingChildren < 0) {
    return { allowed: false, code: 'INVALID_HIERARCHY', reason: 'The existing child count is invalid.' }
  }
  if (input.existingChildren >= MAX_CHILD_AGENTS_PER_PARENT) {
    return { allowed: false, code: 'MAX_CHILDREN_REACHED', reason: `A parent may have at most ${MAX_CHILD_AGENTS_PER_PARENT} direct child agents.` }
  }
  return { allowed: true, depth: parentDepth + 1 }
}
