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

import { CONSTITUTION, DEPARTMENTS } from '@/lib/agents/registry'
import { ROLE_ARCHETYPES } from '@/lib/agents/catalogue'

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
      ['payment.verify', 'payment.prepare', 'invoice.generate', 'refund.settle'].includes(context.tool) ||
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
export const FINANCIAL_TOOLS = ['payment.prepare', 'payment.verify', 'invoice.generate', 'refund.settle']

export function defaultGovernanceRules(): GovernanceRule[] {
  const now = new Date()
  return [
    {
      id: 'GLOBAL-001',
      layer: 'GLOBAL',
      subject: '*',
      // A review requirement, not a FORBID. A FORBID on tool identity blocked
      // every client-facing tool (email, invoices, reports) before the human
      // approval could be considered. Leakage of internal prompts, agent
      // identities or architecture is blocked by the content screens
      // (ai-reply-guard, screenAiContent); this rule makes the review explicit.
      effect: 'REQUIRE_REVIEW',
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

// ------------------------------------------------------------
// Full 550-Rule Constitutional & Layered Governance Catalog
// ------------------------------------------------------------

export type ConstitutionalCatalogRule = GovernanceRule & {
  version: string
  category:
    | 'CONSTITUTIONAL_CORE'
    | 'COMPANY_POLICY'
    | 'DEPARTMENT_BOUNDARY'
    | 'ROLE_AUTHORITY'
    | 'TASK_SAFETY'
}

const TASK_SAFETY_SUBJECTS: Array<{
  id: string
  subject: string
  effect: RuleEffect
  condition: RuleCondition
  fromRisk?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
  requirement: string
}> = [
  {
    id: 'TASK-001',
    subject: 'FINANCIAL_DISBURSEMENT',
    effect: 'REQUIRE_APPROVAL',
    condition: 'FINANCIAL',
    fromRisk: 'HIGH',
    requirement: 'All financial disbursements and refund settlements require explicit Super Admin approval.',
  },
  {
    id: 'TASK-002',
    subject: 'CLIENT_CONTRACT_EXECUTION',
    effect: 'REQUIRE_APPROVAL',
    condition: 'ALWAYS',
    fromRisk: 'HIGH',
    requirement: 'Legal commitments, scope revisions, and formal client handovers require human sign-off.',
  },
  {
    id: 'TASK-003',
    subject: 'PRODUCTION_SCHEMA_MUTATION',
    effect: 'FORBID',
    condition: 'ALWAYS',
    fromRisk: 'CRITICAL',
    requirement: 'Autonomous schema resets, destructive migrations, and production table drops are forbidden.',
  },
  {
    id: 'TASK-004',
    subject: 'SOURCE_CODE_RELEASE',
    effect: 'REQUIRE_APPROVAL',
    condition: 'TOOL_LIST',
    fromRisk: 'HIGH',
    requirement: 'Releasing source code or deployment bundles requires explicit Super Admin release authorization.',
  },
  {
    id: 'TASK-005',
    subject: 'EXTERNAL_BROADCAST',
    effect: 'REQUIRE_APPROVAL',
    condition: 'EXTERNAL_COMMS',
    fromRisk: 'MEDIUM',
    requirement: 'Outbound email, SMS, WhatsApp, or social broadcasts require review and approval.',
  },
  {
    id: 'TASK-006',
    subject: 'LOOP_AGENT_SPAWN',
    effect: 'REQUIRE_APPROVAL',
    condition: 'TOOL_LIST',
    fromRisk: 'HIGH',
    requirement: 'Spawning a child Loop Agent requires a current DCC certificate, parent eligibility, and Super Admin approval.',
  },
  {
    id: 'TASK-007',
    subject: 'SECRET_OR_CREDENTIAL_ACCESS',
    effect: 'FORBID',
    condition: 'CLIENT_FACING_OUTPUT',
    fromRisk: 'LOW',
    requirement: 'Secrets, API keys, tokens, and internal credentials must never be emitted or logged.',
  },
  {
    id: 'TASK-008',
    subject: 'CROSS_DEPARTMENT_ESCALATION',
    effect: 'REQUIRE_REVIEW',
    condition: 'ALWAYS',
    fromRisk: 'MEDIUM',
    requirement: 'Cross-department task handoffs must record structured audit telemetry and SLA checkpoints.',
  },
  {
    id: 'TASK-009',
    subject: 'PII_DATA_PROCESSING',
    effect: 'REQUIRE_REVIEW',
    condition: 'CLIENT_FACING_OUTPUT',
    fromRisk: 'MEDIUM',
    requirement: 'Client PII must obey data-classification access levels and redaction rules prior to output.',
  },
  {
    id: 'TASK-010',
    subject: 'QUOTA_OR_BUDGET_OVERRIDE',
    effect: 'REQUIRE_APPROVAL',
    condition: 'ALWAYS',
    fromRisk: 'HIGH',
    requirement: 'Modifying an agent daily token quota or model routing tier requires Super Admin governance.',
  },
  {
    id: 'TASK-011',
    subject: 'EMERGENCY_KILL_SWITCH',
    effect: 'REQUIRE_APPROVAL',
    condition: 'ALWAYS',
    fromRisk: 'CRITICAL',
    requirement: 'Activating or clearing a department/global emergency pause must be logged with actor attribution.',
  },
  {
    id: 'TASK-012',
    subject: 'INVOICE_ISSUANCE',
    effect: 'REQUIRE_APPROVAL',
    condition: 'FINANCIAL',
    fromRisk: 'MEDIUM',
    requirement: 'Issuing or voiding a client invoice requires finance verification and human approval.',
  },
  {
    id: 'TASK-013',
    subject: 'SECURITY_VULNERABILITY_SCAN',
    effect: 'REQUIRE_REVIEW',
    condition: 'ALWAYS',
    fromRisk: 'HIGH',
    requirement: 'High-severity security scan findings must trigger an immediate audit record and review.',
  },
  {
    id: 'TASK-014',
    subject: 'KNOWLEDGE_BASE_PUBLICATION',
    effect: 'REQUIRE_REVIEW',
    condition: 'PUBLISHED_RESULT',
    fromRisk: 'MEDIUM',
    requirement: 'Publishing knowledge articles or SOP revisions requires factual verification and version tagging.',
  },
  {
    id: 'TASK-015',
    subject: 'SYNTHETIC_BENCHMARK_AUDIT',
    effect: 'REQUIRE_REVIEW',
    condition: 'ALWAYS',
    fromRisk: 'LOW',
    requirement: 'Fallback or synthetic execution traces must be explicitly labeled and never reported as live inference.',
  },
]

/**
 * Build the complete 550-rule Enterprise Constitutional & Layered Governance
 * Catalog spanning all 110 preserved departments and 20 role archetypes:
 * - 10 Global Constitutional Rules (GLOBAL-CONST-001..010)
 * - 5 Company Operational Rules (COMPANY-POL-001..005)
 * - 440 Department Boundary Rules (110 departments × 4 rules: scope, PII/client output, financial/external approval, DCC gate)
 * - 80 Role Archetype Rules (20 role archetypes × 4 rules: tool permission, escalation, quality gate, audit logging)
 * - 15 Task Safety Rules (TASK-001..015)
 * Total = 550 versioned rules (>= 500 target).
 */
export function buildConstitutionalRuleCatalog(): ConstitutionalCatalogRule[] {
  const createdAt = new Date('2026-01-01T00:00:00.000Z')
  const catalog: ConstitutionalCatalogRule[] = []

  // 1. 10 Global Constitutional Core Rules
  CONSTITUTION_WITH_ENFORCEMENT.forEach((entry) => {
    const code = `GLOBAL-CONST-${String(entry.index).padStart(3, '0')}`
    catalog.push({
      id: code,
      version: '1.0.0',
      category: 'CONSTITUTIONAL_CORE',
      layer: 'GLOBAL',
      subject: '*',
      effect: entry.rule.toLowerCase().includes('approval') ? 'REQUIRE_APPROVAL' : 'REQUIRE_REVIEW',
      condition: 'ALWAYS',
      requirement: `${entry.rule} (Enforced by: ${entry.enforcedBy})`,
      active: true,
      setBy: 'system:constitution',
      createdAt,
    })
  })

  // 2. 5 Company Operational Rules
  const companyStatements = [
    {
      id: 'COMPANY-POL-001',
      effect: 'REQUIRE_REVIEW' as const,
      condition: 'CLIENT_FACING_OUTPUT' as const,
      requirement: 'All client-facing deliverables must pass brand, quality, and non-disclosure screening before release.',
    },
    {
      id: 'COMPANY-POL-002',
      effect: 'REQUIRE_APPROVAL' as const,
      condition: 'FINANCIAL' as const,
      requirement: 'All company financial commitments, invoices, and payment verifications require human authorization.',
    },
    {
      id: 'COMPANY-POL-003',
      effect: 'REQUIRE_APPROVAL' as const,
      condition: 'EXTERNAL_COMMS' as const,
      requirement: 'All external communications sent on behalf of Tech 360 Solutions require human approval.',
    },
    {
      id: 'COMPANY-POL-004',
      effect: 'REQUIRE_PERMISSION' as const,
      condition: 'ALWAYS' as const,
      requirement: 'Every agent execution must validate declared tool permissions and daily token quota before invocation.',
    },
    {
      id: 'COMPANY-POL-005',
      effect: 'REQUIRE_REVIEW' as const,
      condition: 'PUBLISHED_RESULT' as const,
      requirement: 'Every published result must be backed by verifiable execution telemetry and immutable audit logs.',
    },
  ]
  for (const item of companyStatements) {
    catalog.push({
      id: item.id,
      version: '1.0.0',
      category: 'COMPANY_POLICY',
      layer: 'COMPANY',
      subject: '*',
      effect: item.effect,
      condition: item.condition,
      requirement: item.requirement,
      active: true,
      setBy: 'system:constitution',
      createdAt,
    })
  }

  // 3. 440 Department Boundary Rules (110 departments × 4 rules)
  for (const dept of DEPARTMENTS) {
    catalog.push(
      {
        id: `DEPT-${dept.code}-SCOPE`,
        version: '1.0.0',
        category: 'DEPARTMENT_BOUNDARY',
        layer: 'DEPARTMENT',
        subject: dept.code,
        effect: 'REQUIRE_PERMISSION',
        condition: 'ALWAYS',
        requirement: `${dept.name} (${dept.code}) agents must operate strictly within ${dept.category} domain permissions and SOPs.`,
        active: true,
        setBy: 'system:constitution',
        createdAt,
      },
      {
        id: `DEPT-${dept.code}-OUTPUT`,
        version: '1.0.0',
        category: 'DEPARTMENT_BOUNDARY',
        layer: 'DEPARTMENT',
        subject: dept.code,
        effect: 'REQUIRE_REVIEW',
        condition: 'CLIENT_FACING_OUTPUT',
        tools: CLIENT_FACING_TOOLS,
        requirement: `${dept.name} (${dept.code}) client-facing outputs must be screened for internal prompt/identity leakage.`,
        active: true,
        setBy: 'system:constitution',
        createdAt,
      },
      {
        id: `DEPT-${dept.code}-APPROVAL`,
        version: '1.0.0',
        category: 'DEPARTMENT_BOUNDARY',
        layer: 'DEPARTMENT',
        subject: dept.code,
        effect: 'REQUIRE_APPROVAL',
        condition: 'TOOL_LIST',
        tools: [...EXTERNAL_COMMS_TOOLS, ...FINANCIAL_TOOLS, 'handover.release', 'agent.create'],
        fromRisk: 'HIGH',
        requirement: `${dept.name} (${dept.code}) high-risk external, financial, or child-agent actions require Super Admin approval.`,
        active: true,
        setBy: 'system:constitution',
        createdAt,
      },
      {
        id: `DEPT-${dept.code}-DCC`,
        version: '1.0.0',
        category: 'DEPARTMENT_BOUNDARY',
        layer: 'DEPARTMENT',
        subject: dept.code,
        effect: 'REQUIRE_REVIEW',
        condition: 'PUBLISHED_RESULT',
        tools: PUBLISHED_RESULT_TOOLS,
        requirement: `${dept.name} (${dept.code}) autonomous expansion requires a current 9-metric DCC CERTIFIED assessment.`,
        active: true,
        setBy: 'system:constitution',
        createdAt,
      },
    )
  }

  // 4. 80 Role Archetype Rules (20 role archetypes × 4 rules)
  ROLE_ARCHETYPES.forEach((role, idx) => {
    const slot = String(idx + 1).padStart(2, '0')
    const slug = role.slug.toUpperCase().replace(/[^A-Z0-9]+/g, '_')
    catalog.push(
      {
        id: `ROLE-${slot}-PERM`,
        version: '1.0.0',
        category: 'ROLE_AUTHORITY',
        layer: 'ROLE',
        subject: slug,
        effect: 'REQUIRE_PERMISSION',
        condition: 'ALWAYS',
        requirement: `Role ${role.title} (${slug}) may only invoke tools aligned with its assigned specialist archetype.`,
        active: true,
        setBy: 'system:constitution',
        createdAt,
      },
      {
        id: `ROLE-${slot}-ESC`,
        version: '1.0.0',
        category: 'ROLE_AUTHORITY',
        layer: 'ROLE',
        subject: slug,
        effect: 'REQUIRE_REVIEW',
        condition: 'ALWAYS',
        fromRisk: 'HIGH',
        requirement: `Role ${role.title} (${slug}) must escalate uncertain or high-risk tasks to its supervisor before completion.`,
        active: true,
        setBy: 'system:constitution',
        createdAt,
      },
      {
        id: `ROLE-${slot}-QA`,
        version: '1.0.0',
        category: 'ROLE_AUTHORITY',
        layer: 'ROLE',
        subject: slug,
        effect: 'REQUIRE_REVIEW',
        condition: 'PUBLISHED_RESULT',
        requirement: `Role ${role.title} (${slug}) outputs must pass 6-check quality evaluation prior to publication.`,
        active: true,
        setBy: 'system:constitution',
        createdAt,
      },
      {
        id: `ROLE-${slot}-APPROVAL`,
        version: '1.0.0',
        category: 'ROLE_AUTHORITY',
        layer: 'ROLE',
        subject: slug,
        effect: 'REQUIRE_APPROVAL',
        condition: 'EXTERNAL_COMMS',
        fromRisk: 'HIGH',
        requirement: `Role ${role.title} (${slug}) may not dispatch high-risk external communications without human approval.`,
        active: true,
        setBy: 'system:constitution',
        createdAt,
      },
    )
  })

  // 5. 15 Task Safety Rules
  for (const taskRule of TASK_SAFETY_SUBJECTS) {
    catalog.push({
      id: taskRule.id,
      version: '1.0.0',
      category: 'TASK_SAFETY',
      layer: 'TASK',
      subject: taskRule.subject,
      effect: taskRule.effect,
      condition: taskRule.condition,
      fromRisk: taskRule.fromRisk,
      requirement: taskRule.requirement,
      active: true,
      setBy: 'system:constitution',
      createdAt,
    })
  }

  return catalog
}

export const ENTERPRISE_CONSTITUTIONAL_RULES: ConstitutionalCatalogRule[] = buildConstitutionalRuleCatalog()

export function constitutionalRuleStats() {
  const byLayer: Record<GovernanceLayer, number> = {
    GLOBAL: 0,
    COMPANY: 0,
    DEPARTMENT: 0,
    ROLE: 0,
    AGENT: 0,
    TASK: 0,
  }
  const byCategory: Record<ConstitutionalCatalogRule['category'], number> = {
    CONSTITUTIONAL_CORE: 0,
    COMPANY_POLICY: 0,
    DEPARTMENT_BOUNDARY: 0,
    ROLE_AUTHORITY: 0,
    TASK_SAFETY: 0,
  }
  for (const rule of ENTERPRISE_CONSTITUTIONAL_RULES) {
    byLayer[rule.layer] = (byLayer[rule.layer] ?? 0) + 1
    byCategory[rule.category] = (byCategory[rule.category] ?? 0) + 1
  }
  return {
    total: ENTERPRISE_CONSTITUTIONAL_RULES.length,
    target: 500,
    coreConstitutionCount: CONSTITUTION_WITH_ENFORCEMENT.length,
    defaultOperationalRulesCount: defaultGovernanceRules().length,
    byLayer,
    byCategory,
  }
}
