import { NextRequest } from 'next/server'
import { guard, isResponse } from '@/lib/api-guard'
import {
  ALWAYS_HUMAN_ACTIONS,
  CONSTITUTION_WITH_ENFORCEMENT,
  defaultGovernanceRules,
  GOVERNANCE_LAYERS,
} from '@/lib/governance/rules'
import { TOOL_REGISTRY, validateToolRegistry } from '@/lib/tools/registry'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

/**
 * GET /api/admin/governance — the governance surface.
 *
 * It shows the constitution with the mechanism that enforces each
 * rule, the layered rule set, the list of actions a human always
 * controls, the tool registry with its risk and approval metadata,
 * and the REAL approval queue.
 */
export async function GET(req: NextRequest) {
  const g = await guard(req, { minRole: 'SUPER_ADMIN' })
  if (isResponse(g)) return g

  const registry = validateToolRegistry()

  const [pendingApprovals, recentDecisions] = await Promise.all([
    db.agentJob.count({ where: { approvalState: 'PENDING' } }),
    db.agentJob.count({ where: { approvalState: { in: ['APPROVED', 'REJECTED'] } } }),
  ])

  const byRisk = new Map<string, number>()
  for (const tool of TOOL_REGISTRY) byRisk.set(tool.riskLevel, (byRisk.get(tool.riskLevel) ?? 0) + 1)

  return Response.json({
    constitution: CONSTITUTION_WITH_ENFORCEMENT,
    layers: GOVERNANCE_LAYERS,
    rules: defaultGovernanceRules(),
    alwaysHuman: ALWAYS_HUMAN_ACTIONS.map((action) => ({ id: action.id, description: action.description })),
    tools: {
      total: TOOL_REGISTRY.length,
      byRisk: Object.fromEntries(byRisk),
      registryValid: registry.valid,
      issues: registry.issues,
      entries: TOOL_REGISTRY.map((tool) => ({
        id: tool.id,
        category: tool.category,
        riskLevel: tool.riskLevel,
        permission: tool.permission,
        auth: tool.auth,
        requiresApproval: tool.requiresApproval,
        auditRequired: tool.auditRequired,
        rateLimitPerMinute: tool.rateLimitPerMinute,
        touchesCustomerData: tool.touchesCustomerData,
        autonomous: tool.autonomous,
        description: tool.description,
      })),
    },
    approvals: { pending: pendingApprovals, decided: recentDecisions },
  })
}
