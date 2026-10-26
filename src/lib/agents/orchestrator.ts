// ============================================================
// TECH360 — AI-EOS Orchestrator
// ============================================================
// ONE central orchestrator for the whole workforce.
//
// RESPONSIBILITIES
//   task decomposition · agent selection · capability matching ·
//   skill selection · SOP selection · model selection ·
//   parallel execution · delegation · aggregation · validation ·
//   escalation · retry · failure recovery
//
// THE FOUR EXECUTION PATHS
//   A FAST       — one agent, one model, minimal context
//   B STANDARD   — one agent, skills + knowledge + SOP
//   C COMPLEX    — a planner, several skills, tools, a validator
//   D ENTERPRISE — several agents in parallel, then synthesis,
//                  then review, then an executive result
//
// "Never use complex execution when simple execution is sufficient."
//
// THE ORCHESTRATOR DOES NOT RUN AGENTS
// ------------------------------------
// It SELECTS and ROUTES. Execution still goes through the ONE agent
// runtime and the ONE durable task queue, so an orchestrated run and
// a manually queued run share the same lease, retry and audit path.
// ============================================================

import { randomUUID } from 'crypto'
import { db } from '@/lib/db'
import { newCorrelationId } from '@/lib/correlation'
import { audit } from '@/lib/security'
import { enqueueAgentJob } from '@/lib/agents/jobs'
import type { EmployeeProfile, OrgLevelName } from '@/lib/agents/org'

// ------------------------------------------------------------
// Task classification
// ------------------------------------------------------------

export type TaskType =
  | 'QUESTION'
  | 'CLASSIFICATION'
  | 'EXTRACTION'
  | 'SUMMARISATION'
  | 'DRAFTING'
  | 'ANALYSIS'
  | 'RESEARCH'
  | 'DECISION'
  | 'EXECUTION'
  | 'REPORTING'
  | 'REVIEW'
  | 'ORCHESTRATION'

export type ExecutionPath = 'FAST' | 'STANDARD' | 'COMPLEX' | 'ENTERPRISE'

export type TaskClassification = {
  type: TaskType
  complexity: 'SIMPLE' | 'STANDARD' | 'COMPLEX' | 'ENTERPRISE'
  path: ExecutionPath
  confidence: number
  /** The capabilities the task needs. */
  requiredCapabilities: string[]
  /** The tools the task may need. */
  requiredTools: string[]
  /** Why the classifier decided this. */
  rationale: string
}

const TYPE_SIGNALS: Array<{ type: TaskType; terms: string[]; capability: string }> = [
  { type: 'CLASSIFICATION', terms: ['classify', 'categorise', 'categorize', 'label', 'triage', 'route', 'sort'], capability: 'classification' },
  { type: 'EXTRACTION', terms: ['extract', 'pull out', 'list the', 'capture', 'find the', 'parse'], capability: 'extraction' },
  { type: 'SUMMARISATION', terms: ['summarise', 'summarize', 'brief me', 'tldr', 'condense', 'digest'], capability: 'summarisation' },
  { type: 'DRAFTING', terms: ['draft', 'write', 'compose', 'prepare a reply', 'draft an email', 'copy'], capability: 'drafting' },
  { type: 'ANALYSIS', terms: ['analyse', 'analyze', 'why did', 'what changed', 'compare', 'measure'], capability: 'analysis' },
  { type: 'RESEARCH', terms: ['research', 'investigate', 'find out about', 'look into', 'market'], capability: 'research' },
  { type: 'DECISION', terms: ['decide', 'choose', 'should we', 'approve', 'pick'], capability: 'decision' },
  { type: 'REPORTING', terms: ['report', 'dashboard', 'kpi', 'summarise the', 'status of', 'how are we'], capability: 'reporting' },
  { type: 'REVIEW', terms: ['review', 'check', 'audit', 'verify', 'assess'], capability: 'review' },
  { type: 'EXECUTION', terms: ['send', 'schedule', 'create', 'update', 'publish', 'process'], capability: 'execution' },
  { type: 'ORCHESTRATION', terms: ['strategy', 'campaign', 'full analysis', 'end to end', 'entire', 'across departments'], capability: 'orchestration' },
]

const COMPLEXITY_SIGNALS = {
  COMPLEX: ['strategy', 'architecture', 'plan for', 'multi', 'across', 'optimise', 'optimize', 'redesign'],
  STANDARD: ['report', 'analysis', 'review', 'campaign', 'compare'],
}

export function classifyTask(input: { task: string; requiresApproval?: boolean }): TaskClassification {
  const text = input.task.toLowerCase()
  let best: { type: TaskType; hits: number; capability: string } = { type: 'QUESTION', hits: 0, capability: 'question' }
  for (const signal of TYPE_SIGNALS) {
    const hits = signal.terms.filter((term) => text.includes(term)).length
    if (hits > best.hits) best = { type: signal.type, hits, capability: signal.capability }
  }

  const complexHits = COMPLEXITY_SIGNALS.COMPLEX.filter((term) => text.includes(term)).length
  const standardHits = COMPLEXITY_SIGNALS.STANDARD.filter((term) => text.includes(term)).length

  let complexity: TaskClassification['complexity'] = 'SIMPLE'
  let path: ExecutionPath = 'FAST'
  let rationale = 'A single question with no compounding requirement needs one agent and one model.'

  if (best.hits === 0) {
    complexity = 'SIMPLE'
    path = 'FAST'
    rationale = 'No task-type signal was found; the safest path is the fast single-agent path.'
  } else if (complexHits > 0) {
    complexity = 'COMPLEX'
    path = 'COMPLEX'
    rationale = `The task contains a compounding requirement (${COMPLEXITY_SIGNALS.COMPLEX.filter((t) => text.includes(t)).join(', ')}), so it needs a plan, several skills and a validator.`
  } else if (standardHits > 0) {
    complexity = 'STANDARD'
    path = 'STANDARD'
    rationale = 'The task needs the department\'s skills, knowledge and procedure, but not a plan.'
  } else {
    complexity = 'SIMPLE'
    path = 'FAST'
    rationale = 'The task matches one capability and can be done by one agent with a small context.'
  }

  // An action that needs approval is never a fast path.
  if (input.requiresApproval && path === 'FAST') {
    path = 'STANDARD'
    complexity = 'STANDARD'
    rationale += ' The action requires an approval, so the standard path is used.'
  }

  return {
    type: best.type,
    complexity,
    path,
    confidence: Math.min(1, 0.4 + best.hits * 0.2),
    requiredCapabilities: [best.capability],
    requiredTools: [],
    rationale,
  }
}

// ------------------------------------------------------------
// Agent selection
// ------------------------------------------------------------

export type AgentAvailability = 'AVAILABLE' | 'BUSY' | 'QUEUED' | 'OFFLINE' | 'ERROR' | 'ESCALATED'

export type SelectionCriteria = {
  capability: string
  departmentCode?: string
  /** The permissions the caller holds; an agent without them is not eligible. */
  grantedPermissions: string[]
  /** The maximum organisational level that may be engaged. */
  maxLevel?: number
  availability?: AgentAvailability[]
  limit?: number
}

export type Candidate = {
  employee: EmployeeProfile
  availability: AgentAvailability
  /** Real measured performance, 0..1. Never a fabricated number. */
  successRate: number | null
  /** The agent's current workload, 0..1. */
  workload: number
  /** The measured mean latency in ms, or null when it has never run. */
  meanLatencyMs: number | null
}

/**
 * Score a candidate for a task.
 *
 * The score is explainable: capability fit, permission fit, level fit,
 * availability, measured performance, workload and measured latency.
 * A candidate that has never run has NO performance bonus — it is not
 * given a fabricated score.
 */
export function scoreCandidate(candidate: Candidate, criteria: SelectionCriteria): { score: number; reasons: string[] } {
  const reasons: string[] = []
  let score = 0

  if (criteria.departmentCode) {
    if (candidate.employee.departmentCode === criteria.departmentCode) {
      score += 40
      reasons.push('same department')
    } else {
      score += 8
      reasons.push('different department')
    }
  }

  const holdsCapability = candidate.employee.securityPermissions.some(
    (permission) => permission === 'capability:all' || permission.includes(criteria.capability),
  )
  if (holdsCapability) {
    score += 25
    reasons.push('holds the required capability')
  }

  const eligible = criteria.grantedPermissions.filter(
    (permission) =>
      candidate.employee.securityPermissions.includes(permission) ||
      candidate.employee.securityPermissions.includes('capability:all'),
  )
  if (eligible.length > 0) {
    score += Math.min(20, eligible.length * 4)
    reasons.push('permission fit')
  }

  if (criteria.maxLevel && candidate.employee.level > criteria.maxLevel) {
    score -= 30
    reasons.push('more senior than the task needs')
  }

  if (criteria.availability && !criteria.availability.includes(candidate.availability)) {
    score -= 50
    reasons.push(`availability ${candidate.availability}`)
  }

  if (candidate.successRate !== null) {
    score += candidate.successRate * 20
    reasons.push(`measured success rate ${(candidate.successRate * 100).toFixed(0)}%`)
  }
  score -= candidate.workload * 15
  if (candidate.meanLatencyMs !== null) {
    score += Math.max(0, 10 - candidate.meanLatencyMs / 5000)
    reasons.push('measured latency')
  }

  return { score, reasons }
}

/** Rank the candidates and return the best ones. */
export function selectAgents(candidates: Candidate[], criteria: SelectionCriteria): Array<Candidate & { score: number; reasons: string[] }> {
  return candidates
    .map((candidate) => {
      const { score, reasons } = scoreCandidate(candidate, criteria)
      return { ...candidate, score, reasons }
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, Math.max(1, criteria.limit ?? 1))
}

// ------------------------------------------------------------
// Delegation — agent to agent
// ------------------------------------------------------------

export type DelegationKind = 'DELEGATE' | 'CONSULT' | 'REVIEW' | 'EXPERTISE' | 'ESCALATE' | 'HANDOFF'

export type DelegationInput = {
  requestingAgent: string
  targetAgent: string
  kind: DelegationKind
  task: string
  objective: string
  context?: string
  priority?: 'LOW' | 'NORMAL' | 'HIGH' | 'CRITICAL'
  deadline?: Date
  permissions?: string[]
  expectedOutput: string
  correlationId?: string
}

export type DelegationResult = {
  id: string
  status: 'PENDING' | 'ACCEPTED' | 'COMPLETED' | 'FAILED' | 'DECLINED' | 'ESCALATED'
}

/**
 * Create a delegation. A delegation is a CONTRACT: it names the
 * requester, the target, the objective, the context, the priority,
 * the deadline, the delegated permissions and the expected output.
 */
export async function createDelegation(input: DelegationInput): Promise<DelegationResult> {
  const correlationId = input.correlationId ?? newCorrelationId()
  const row = await db.agentDelegation.create({
    data: {
      requestingAgent: input.requestingAgent,
      targetAgent: input.targetAgent,
      kind: input.kind,
      task: input.task,
      objective: input.objective,
      context: input.context ?? null,
      priority: input.priority ?? 'NORMAL',
      deadline: input.deadline ?? null,
      permissions: JSON.stringify(input.permissions ?? []),
      expectedOutput: input.expectedOutput,
      status: 'PENDING',
      correlationId,
    },
    select: { id: true, status: true },
  })
  await audit({
    actor: `agent:${input.requestingAgent}`,
    action: 'AGENT_DELEGATED',
    entityType: 'AgentDelegation',
    entityId: row.id,
    details: {
      target: input.targetAgent,
      kind: input.kind,
      priority: input.priority ?? 'NORMAL',
      correlationId,
      expectedOutput: input.expectedOutput,
    },
  })
  return { id: row.id, status: row.status as DelegationResult['status'] }
}

/** Close a delegation with its result. */
export async function completeDelegation(
  id: string,
  result: { ok: boolean; output: string; error?: string },
): Promise<DelegationResult> {
  const row = await db.agentDelegation.update({
    where: { id },
    data: {
      status: result.ok ? 'COMPLETED' : 'FAILED',
      result: result.output.slice(0, 20_000),
      completedAt: new Date(),
    },
    select: { id: true, status: true },
  })
  return { id: row.id, status: row.status as DelegationResult['status'] }
}

// ------------------------------------------------------------
// Orchestration plans
// ------------------------------------------------------------

export type OrchestrationStep = {
  order: number
  kind: 'PLAN' | 'RESEARCH' | 'EXECUTE' | 'SYNTHESISE' | 'REVIEW' | 'EXECUTIVE'
  employeeId: string
  employeeName: string
  role: string
  objective: string
  dependsOn: number[]
  parallel: boolean
}

export type OrchestrationPlan = {
  correlationId: string
  task: string
  classification: TaskClassification
  path: ExecutionPath
  steps: OrchestrationStep[]
  /** True when the plan needs a human before the final step. */
  requiresApproval: boolean
}

/**
 * Build an orchestration plan.
 *
 * The plan is built from the CLASSIFIED task and the SELECTED
 * employees. Path D is the only path that fans out; paths A–C use one
 * employee and never activate a team a task does not need.
 */
export function buildOrchestrationPlan(input: {
  task: string
  classification: TaskClassification
  employees: Array<{ employee: EmployeeProfile; score: number }>
  requireApproval?: boolean
}): OrchestrationPlan {
  const correlationId = newCorrelationId()
  const path = input.classification.path
  const steps: OrchestrationStep[] = []

  if (path === 'FAST' || path === 'STANDARD') {
    const chosen = input.employees[0]
    steps.push({
      order: 1,
      kind: 'EXECUTE',
      employeeId: chosen?.employee.employeeId ?? 'EMP-MASTER-001',
      employeeName: chosen?.employee.name ?? 'Master AI',
      role: chosen?.employee.role ?? 'Master AI / CEO',
      objective: input.task,
      dependsOn: [],
      parallel: false,
    })
    if (path === 'STANDARD') {
      steps.push({
        order: 2,
        kind: 'REVIEW',
        employeeId: 'EMP-MASTER-001',
        employeeName: 'Quality review',
        role: 'Reviewer',
        objective: 'Validate the work before it is returned.',
        dependsOn: [1],
        parallel: false,
      })
    }
  } else if (path === 'COMPLEX') {
    const chosen = input.employees[0]
    steps.push({
      order: 1,
      kind: 'PLAN',
      employeeId: chosen?.employee.employeeId ?? 'EMP-MASTER-001',
      employeeName: chosen?.employee.name ?? 'Master AI',
      role: chosen?.employee.role ?? 'Master AI / CEO',
      objective: `Plan how to achieve: ${input.task}`,
      dependsOn: [],
      parallel: false,
    })
    steps.push({
      order: 2,
      kind: 'EXECUTE',
      employeeId: chosen?.employee.employeeId ?? 'EMP-MASTER-001',
      employeeName: chosen?.employee.name ?? 'Master AI',
      role: chosen?.employee.role ?? 'Master AI / CEO',
      objective: input.task,
      dependsOn: [1],
      parallel: false,
    })
    steps.push({
      order: 3,
      kind: 'REVIEW',
      employeeId: 'EMP-MASTER-001',
      employeeName: 'Validator',
      role: 'Validator',
      objective: 'Validate the result against the acceptance criteria.',
      dependsOn: [2],
      parallel: false,
    })
  } else {
    // ENTERPRISE — research in parallel, then synthesis, review, executive.
    const researchers = input.employees.slice(0, 6)
    researchers.forEach((entry, index) => {
      steps.push({
        order: index + 1,
        kind: 'RESEARCH',
        employeeId: entry.employee.employeeId,
        employeeName: entry.employee.name,
        role: entry.employee.role,
        objective: `Contribute the ${entry.employee.role} perspective to: ${input.task}`,
        dependsOn: [],
        parallel: true,
      })
    })
    const synthesisOrder = researchers.length + 1
    steps.push({
      order: synthesisOrder,
      kind: 'SYNTHESISE',
      employeeId: input.employees[0]?.employee.employeeId ?? 'EMP-MASTER-001',
      employeeName: input.employees[0]?.employee.name ?? 'Master AI',
      role: input.employees[0]?.employee.role ?? 'Master AI / CEO',
      objective: 'Combine the parallel findings into one coherent strategy.',
      dependsOn: researchers.map((_, index) => index + 1),
      parallel: false,
    })
    steps.push({
      order: synthesisOrder + 1,
      kind: 'REVIEW',
      employeeId: 'EMP-MASTER-001',
      employeeName: 'Review AI',
      role: 'Review AI',
      objective: 'Check the synthesis for accuracy, evidence and risk.',
      dependsOn: [synthesisOrder],
      parallel: false,
    })
    steps.push({
      order: synthesisOrder + 2,
      kind: 'EXECUTIVE',
      employeeId: 'EMP-MASTER-001',
      employeeName: 'Executive AI',
      role: 'Executive AI',
      objective: 'Produce the final executive answer: summary, root causes, evidence, opportunities, risks, actions, owners, timeline, KPIs.',
      dependsOn: [synthesisOrder + 1],
      parallel: false,
    })
  }

  return {
    correlationId,
    task: input.task,
    classification: input.classification,
    path,
    steps,
    requiresApproval: input.requireApproval === true,
  }
}

/**
 * Queue the plan's steps on the ONE durable task queue.
 *
 * The orchestrator never runs a model itself. It routes work to the
 * same `AgentJob` queue the rest of the platform uses, so an
 * orchestrated run and a manual run share the same lease, retry,
 * recovery and audit behaviour.
 */
export async function queueOrchestration(
  plan: OrchestrationPlan,
  options: { idempotencyPrefix?: string; requestedBy?: string } = {},
): Promise<Array<{ order: number; jobId: string; status: string }>> {
  const queued: Array<{ order: number; jobId: string; status: string }> = []
  const prefix = options.idempotencyPrefix ?? plan.correlationId
  for (const step of plan.steps) {
    const { job } = await enqueueAgentJob({
      agentCode: null,
      taskType: 'WORKFLOW',
      idempotencyKey: `orc-${prefix}-${step.order}`.slice(0, 191),
      input: JSON.stringify({
        kind: 'ORCHESTRATION_STEP',
        order: step.order,
        objective: step.objective,
        employeeId: step.employeeId,
        role: step.role,
        dependsOn: step.dependsOn,
        parallel: step.parallel,
      }),
      workflow: `ORCHESTRATION:${plan.path}`,
      requestedBy: options.requestedBy ?? 'system:orchestrator',
    })
    queued.push({ order: step.order, jobId: job.id, status: job.status })
  }
  return queued
}

/** The organisational level an execution path may engage. */
export const PATH_MAX_LEVEL: Record<ExecutionPath, number> = {
  FAST: 7,
  STANDARD: 6,
  COMPLEX: 5,
  ENTERPRISE: 4,
}

export const ORG_LEVEL_FOR_PATH: Record<ExecutionPath, OrgLevelName> = {
  FAST: 'SPECIALIST',
  STANDARD: 'SENIOR_SPECIALIST',
  COMPLEX: 'MANAGER',
  ENTERPRISE: 'DEPARTMENT_DIRECTOR',
}

export function newCorrelation(): string {
  return randomUUID()
}
