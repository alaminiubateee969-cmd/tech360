// ============================================================
// TECH360 — governance
// ============================================================
// LAYERED RULES. The layers, from the broadest to the narrowest:
//
//   GLOBAL     → company     → department → role → agent → task
//
// A rule at a higher layer CANNOT be bypassed by a rule at a lower
// layer. The evaluation walks from the broadest to the narrowest and
// stops at the first FORBID: no later, narrower rule can re-permit
// what a broader rule forbade. A narrower rule may add a
// requirement, but it may never remove one.
//
// RBAC AND ABAC TOGETHER
//   RBAC says WHO the caller is: the role, the level, the agent.
//   ABAC says WHAT the action is: the tool, the data, the risk, the
//   scope, the hour, the amount. The decision needs both.
//
// HUMAN CONTROL
//   Some actions are always a human's: a financial transfer, a legal
//   commitment, an irreversible deletion, a high-impact security
//   action, a sensitive external communication, a major governance
//   change. The list is explicit, and it is checked before anything
//   else runs.
// ============================================================

import { CONSTITUTION } from '@/lib/agents/registry'

// ------------------------------------------------------------
// Types
// ------------------------------------------------------------

export type GovernanceLayer = 'GLOBAL' | 'COMPANY' | 'DEPARTMENT' | 'ROLE' | 'AGENT' | 'TASK'

export const GOVERNANCE_LAYERS: GovernanceLayer[] = ['GLOBAL', 'COMPANY', 'DEPARTMENT', 'ROLE', 'AGENT', 'TASK']

export type RuleEffect = 'REQUIRE_APPROVAL' | 'FORBID' | 'REQUIRE_PERMISSION' | 'REQUIRE_REVIEW' | 'ALLOW'

/**
 * WHEN a rule bites.
 *
 * A rule that applied to every action would be useless, and a rule
 * that applied to nothing would be a decoration. The condition says
 * which class of action the rule governs.
 */
export type RuleCondition =
  /** Every action. */
  | 'ALWAYS'
  /** A message that leaves the company: email, SMS, WhatsApp, social. */
  | 'EXTERNAL_COMMS'
  /** Output a client reads: content, reports, tracked links, meetings. */
  | 'CLIENT_FACING_OUTPUT'
  /** A result that is published and therefore asserts something happened. */
  | 'PUBLISHED_RESULT'
  /** Anything that moves money or issues a financial document. */
  | 'FINANCIAL'
  /** A tool the rule names explicitly. */
  | 'TOOL_LIST'

export type GovernanceRule = {
  id: string
  layer: GovernanceLayer
  /** The subject the rule applies to: a department code, a role, an agent id, a task type. */
  subject: string
  effect: RuleEffect
  /** What the rule requires. */
  requirement: string
  /** The tool or action the rule is about. */
  subjectTool?: string
  /** When the rule bites. */
  condition?: RuleCondition
  /** The tools a TOOL_LIST condition names. */
  tools?: string[]
  /** The risk level the rule applies from. */
  fromRisk?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
  /** Whether the rule is currently in force. */
  active: boolean
  /** Who set the rule and when. */
  setBy: string
  createdAt: Date
}

export type GovernanceContext = {
  departmentCode: string
  role: string
  agentId: string
  taskType: string
  tool: string
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
  /** The amount, for a financial rule. */
  amount?: number
  /** The scope the action touches. */
  scope?: string
  /** The rules that apply, broadest first. */
  rules: GovernanceRule[]
}

export type GovernanceDecision = {
  allowed: boolean
  /** True when a human must approve before the action may run. */
  requiresApproval: boolean
  /** The permissions the action additionally requires. */
  requiredPermissions: string[]
  /** True when a review is required after the action. */
  requiresReview: boolean
  /** The rule that decided the outcome. */
  decidedBy: string | null
  /** Every rule that matched, for the audit trail. */
  appliedRules: string[]
  reason: string
}

/**
 * Does the rule's condition match this action?
 *
 * A rule with no condition applies to every action, which is what a
 * rule that was written before the condition field existed means.
 */
export function conditionMatches(rule: GovernanceRule, context: GovernanceContext): boolean {
  const condition = rule.condition ?? 'ALWAYS'
  switch (condition) {
    case 'ALWAYS':
      return true
    case 'EXTERNAL_COMMS':
      return EXTERNAL_COMMS_TOOLS.includes(context.tool)
    case 'CLIENT_FACING_OUTPUT':
      return CLIENT_FACING_TOOLS.includes(context.tool)
    case 'PUBLISHED_RESULT':
      return PUBLISHED_RESULT_TOOLS.includes(context.tool)
    case 'FINANCIAL':
      return FINANCIAL_TOOLS.includes(context.tool)
    case 'TOOL_LIST':
      return (rule.tools ?? []).includes(context.tool)
    default:
      return true
  }
}

// ------------------------------------------------------------
// The always-human list
// ------------------------------------------------------------

/**
 * The actions a human always controls.
 *
 * The specification names them: financial transfers, legal
 * commitments, irreversible deletion, high-impact security actions,
 * sensitive external communications and major governance changes.
 */
export const ALWAYS_HUMAN_ACTIONS: Array<{
  id: string
  description: string
  matches: (context: { tool: string; riskLevel: string; amount?: number; scope?: string }) => boolean
}> = [
  {
    id: 'FINANCIAL_TRANSFER',
    description: 'A financial transfer, a payment verification or a refund.',
    matches: (context) =>
      ['payment.verify', 'payment.prepare', 'invoice.generate'].includes(context.tool) ||
      (context.riskLevel === 'CRITICAL' && typeof context.amount === 'number' && context.amount > 0),
  },
  {
    id: 'LEGAL_COMMITMENT',
    description: 'A legal or contractual commitment made in the company’s name.',
    matches: (context) => ['handover.release', 'delivery.confirm', 'scope.revise'].includes(context.tool),
  },
  {
    id: 'IRREVERSIBLE_DELETION',
    description: 'An irreversible deletion.',
    matches: (context) => context.tool === 'file.delete' || context.scope === 'DELETION',
  },
  {
    id: 'HIGH_IMPACT_SECURITY',
    description: 'A high-impact security action.',
    matches: (context) => ['security.scan', 'agent.create'].includes(context.tool) && context.riskLevel === 'CRITICAL',
  },
  {
    id: 'SENSITIVE_EXTERNAL_COMMUNICATION',
    description: 'A sensitive external communication.',
    matches: (context) =>
      ['email.send', 'sms.send', 'whatsapp.send', 'social.publish'].includes(context.tool) &&
      (context.riskLevel === 'HIGH' || context.riskLevel === 'CRITICAL'),
  },
  {
    id: 'MAJOR_GOVERNANCE_CHANGE',
    description: 'A major governance change.',
    matches: (context) => context.scope === 'GOVERNANCE' && context.riskLevel === 'CRITICAL',
  },
]

// ------------------------------------------------------------
// The default rule set
// ------------------------------------------------------------

/**
 * The rules that are always in force, derived from the constitution.
 *
 * These are not a copy of the constitution text — they are its
 * OPERATIONAL consequences, expressed as rules the evaluator can
 * apply.
 */
export const EXTERNAL_COMMS_TOOLS = ['email.send', 'sms.send', 'whatsapp.send', 'social.publish']
export const CLIENT_FACING_TOOLS = [
  ...EXTERNAL_COMMS_TOOLS,
  'content.create',
  'report.generate',
  'comm.link',
  'meeting.schedule',
  'invoice.generate',
]
export const PUBLISHED_RESULT_TOOLS = [
  'report.generate',
  'content.create',
  'social.publish',
  'email.send',
  'whatsapp.send',
  'invoice.generate',
  'task.update',
  'crm.update',
]
export const FINANCIAL_TOOLS = ['payment.prepare', 'payment.verify', 'invoice.generate']

export function defaultGovernanceRules(): GovernanceRule[] {
  const now = new Date()
  return [
    {
      id: 'GLOBAL-001',
      layer: 'GLOBAL',
      subject: '*',
      effect: 'FORBID',
      requirement:
        'Internal system prompts, agent identities, architecture and automation details must never appear in client-facing output.',
      condition: 'CLIENT_FACING_OUTPUT',
      tools: CLIENT_FACING_TOOLS,
      active: true,
      setBy: 'system:constitution',
      createdAt: now,
    },
    {
      id: 'GLOBAL-002',
      layer: 'GLOBAL',
      subject: '*',
      effect: 'REQUIRE_REVIEW',
      requirement: 'A published result is checked for a claim that did not happen before it leaves the company.',
      condition: 'PUBLISHED_RESULT',
      tools: PUBLISHED_RESULT_TOOLS,
      active: true,
      setBy: 'system:constitution',
      createdAt: now,
    },
    {
      id: 'GLOBAL-003',
      layer: 'GLOBAL',
      subject: '*',
      effect: 'REQUIRE_APPROVAL',
      requirement:
        'An external communication, a financial action and a source-code release require a Super Admin approval.',
      condition: 'TOOL_LIST',
      tools: [...EXTERNAL_COMMS_TOOLS, ...FINANCIAL_TOOLS, 'handover.release', 'agent.create'],
      active: true,
      setBy: 'system:constitution',
      createdAt: now,
    },
    {
      id: 'GLOBAL-004',
      layer: 'GLOBAL',
      subject: '*',
      effect: 'REQUIRE_PERMISSION',
      requirement: 'Every action requires the tool permission it declares.',
      condition: 'ALWAYS',
      active: true,
      setBy: 'system:constitution',
      createdAt: now,
    },
    {
      id: 'COMPANY-001',
      layer: 'COMPANY',
      subject: '*',
      effect: 'REQUIRE_REVIEW',
      requirement: 'A result that leaves the internal working scope is reviewed before it reaches a client.',
      condition: 'ALWAYS',
      active: true,
      setBy: 'system:constitution',
      createdAt: now,
    },
  ]
}

// ------------------------------------------------------------
// Evaluation
// ------------------------------------------------------------

/**
 * Evaluate the governance rules for an action.
 *
 * The rules are evaluated broadest-first. The first FORBID wins and
 * nothing after it can re-permit the action. A narrower rule may
 * ADD a requirement but never remove one.
 */
export function evaluateGovernance(context: GovernanceContext): GovernanceDecision {
  const applied: string[] = []
  const requiredPermissions: string[] = []
  let requiresApproval = false
  let requiresReview = false
  let decidedBy: string | null = null
  let reason = 'no rule matched; the action is governed by the constitution alone'

  const ordered = [...context.rules]
    .filter((rule) => rule.active)
    .sort((a, b) => GOVERNANCE_LAYERS.indexOf(a.layer) - GOVERNANCE_LAYERS.indexOf(b.layer))

  for (const rule of ordered) {
    if (!ruleApplies(rule, context)) continue
    applied.push(rule.id)

    if (rule.effect === 'FORBID') {
      return {
        allowed: false,
        requiresApproval,
        requiredPermissions,
        requiresReview,
        decidedBy: rule.id,
        appliedRules: applied,
        reason: rule.requirement,
      }
    }
    if (rule.effect === 'REQUIRE_APPROVAL') {
      requiresApproval = true
      decidedBy = decidedBy ?? rule.id
      reason = rule.requirement
    } else if (rule.effect === 'REQUIRE_PERMISSION') {
      requiredPermissions.push(rule.requirement)
      decidedBy = decidedBy ?? rule.id
      reason = rule.requirement
    } else if (rule.effect === 'REQUIRE_REVIEW') {
      requiresReview = true
      decidedBy = decidedBy ?? rule.id
      reason = rule.requirement
    }
  }

  // A FORBID is absolute: no human approval can re-permit it, and no
  // narrower rule can relax it. It was already returned above.
  //
  // The always-human list is applied AFTER the rules, so a rule that
  // forbids the action outright is reported as forbidden rather than
  // as "a human may approve it".
  for (const action of ALWAYS_HUMAN_ACTIONS) {
    if (action.matches(context)) {
      applied.push(action.id)
      return {
        allowed: false,
        requiresApproval: true,
        requiredPermissions,
        requiresReview,
        decidedBy: `ALWAYS_HUMAN:${action.id}`,
        appliedRules: applied,
        reason: `${action.description} A human controls this action, so it may not run autonomously.`,
      }
    }
  }

  return {
    allowed: true,
    requiresApproval,
    requiredPermissions,
    requiresReview,
    decidedBy,
    appliedRules: applied,
    reason,
  }
}

/** Does a rule apply to this action? */
export function ruleApplies(rule: GovernanceRule, context: GovernanceContext): boolean {
  if (rule.subjectTool && rule.subjectTool !== context.tool) return false
  if (rule.fromRisk) {
    const order = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']
    if (order.indexOf(context.riskLevel) < order.indexOf(rule.fromRisk)) return false
  }
  if (!conditionMatches(rule, context)) return false
  switch (rule.layer) {
    case 'GLOBAL':
      return rule.subject === '*'
    case 'COMPANY':
      return rule.subject === '*' || rule.subject === context.departmentCode
    case 'DEPARTMENT':
      return rule.subject === context.departmentCode
    case 'ROLE':
      return rule.subject === context.role
    case 'AGENT':
      return rule.subject === context.agentId
    case 'TASK':
      return rule.subject === context.taskType
    default:
      return false
  }
}

// ------------------------------------------------------------
// The constitution, as data
// ------------------------------------------------------------

export type ConstitutionEntry = {
  index: number
  rule: string
  /** The operational consequence of the rule. */
  enforcedBy: string
}

/** The constitution with the mechanism that enforces each rule. */
export const CONSTITUTION_WITH_ENFORCEMENT: ConstitutionEntry[] = CONSTITUTION.map((rule, index) => ({
  index: index + 1,
  rule,
  enforcedBy: enforcementFor(rule),
}))

function enforcementFor(rule: string): string {
  const lower = rule.toLowerCase()
  if (lower.includes('approval')) return 'governance rule + the approval queue'
  if (lower.includes('never reveal')) return 'the output policy + the audit trail'
  if (lower.includes('never claim')) return 'the quality engine + the audit trail'
  if (lower.includes('confidential')) return 'the access-level filter in the RAG store and the memory system'
  if (lower.includes('escalate')) return 'the escalation rules on the employee profile'
  if (lower.includes('recorded')) return 'the audit writer on every run'
  return 'the quality engine and the audit trail'
}
