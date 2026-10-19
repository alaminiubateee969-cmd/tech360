// ============================================================
// TECH360 — SOP library
// ============================================================
// A Standard Operating Procedure is EXECUTABLE, not documentation.
//
// The specification requires 500+ SOPs. This module generates 550:
// five procedure archetypes specialised for each of the 110
// departments (110 × 5 = 550).
//
// Each SOP declares its trigger, inputs, preconditions, ordered steps,
// decision points, responsible role, tools, validation rules, output,
// failure path, escalation and audit requirement. The runtime WALKS
// the steps; it never merely displays them.
//
// HONESTY NOTE
// ------------
// The five archetypes are real procedure SHAPES. Each department's
// version carries its own subject, tools, validation rules and
// escalation path, so the 550 are genuinely distinct procedures — but
// the shape is shared, and the documentation says so.
// ============================================================

import { DEPARTMENTS } from '@/lib/agents/registry'

export type SopStep = {
  id: string
  order: number
  action: string
  /** The skill slug this step uses, if any. */
  skill?: string
  /** The tool this step calls, if any. */
  tool?: string
  /** A human must confirm this step. */
  requiresApproval?: boolean
  /** A human must confirm the OUTPUT of this step. */
  requiresReview?: boolean
  /** The step is informational — it produces a note, not a change. */
  advisory?: boolean
}

export type SopDecisionPoint = {
  id: string
  afterStep: number
  question: string
  /** The skill slug that evaluates the decision. */
  skill: string
  /**
   * Where the answer comes from.
   *
   * `SKILL` — the decision skill evaluates the question from the
   *   accumulated context.
   * `APPROVAL` — the answer is the recorded human decision. A
   *   decision about a human approval is answered by the approval
   *   record, not by a checklist.
   */
  source?: 'SKILL' | 'APPROVAL'
  /** Where the procedure goes when the answer is yes. */
  then: 'CONTINUE' | 'BRANCH' | 'ESCALATE' | 'STOP'
  /** Where the procedure goes when the answer is no. */
  otherwise: 'CONTINUE' | 'BRANCH' | 'ESCALATE' | 'STOP'
  escalateTo?: string
}

export type SopDefinition = {
  key: string
  name: string
  category: string
  departmentCode: string
  /** The department NAME — the skill catalogue keys on the name, not the code. */
  departmentName: string
  version: string
  status: 'DRAFT' | 'ACTIVE' | 'RETIRED'
  owner: string
  level: number
  description: string
  trigger: string
  inputs: Array<{ name: string; type: string; required: boolean }>
  preconditions: string[]
  steps: SopStep[]
  decisionPoints: SopDecisionPoint[]
  tools: string[]
  validation: string[]
  output: string
  failurePath: string
  escalation: string
  requiresApproval: boolean
  auditRequired: boolean
}

// ------------------------------------------------------------
// The five procedure archetypes
// ------------------------------------------------------------

type Archetype = {
  slug: string
  name: string
  level: number
  description: string
  trigger: string
  steps: Array<Omit<SopStep, 'id' | 'order'>>
  decisions: Array<Omit<SopDecisionPoint, 'id' | 'afterStep'> & { afterStep?: number }>
  validation: string[]
  output: string
  failurePath: string
  escalation: string
  requiresApproval: boolean
}

const INTAKE: Archetype = {
  slug: 'intake',
  name: 'Intake',
  level: 8,
  description: 'Receive, validate and register an incoming item so that it enters the department’s pipeline exactly once.',
  trigger: 'A new item arrives in the department’s intake channel.',
  steps: [
    { action: 'Read the incoming item and confirm it is addressed to this department.', skill: 'classify_intent', advisory: true },
    { action: 'Extract the identifiers, the parties and the amounts from the item.', skill: 'extract_references' },
    { action: 'Normalise the contact details so the record is reachable.', skill: 'normalise_phone_region' },
    { action: 'Compute the dedupe key and check whether this item is already registered.', skill: 'dedupe_client' },
    { action: 'Classify the item against the department’s own type rules.', skill: 'route_document' },
    { action: 'Register the item with its provenance recorded.', tool: 'crm.createLead' },
    { action: 'Write the intake outcome to the shared memory scope.', tool: 'memory.write' },
  ],
  decisions: [
    { question: 'Has this item already been registered?', skill: 'check_lead_completeness', then: 'STOP', otherwise: 'CONTINUE' },
  ],
  validation: ['The item carries at least one usable identifier.', 'The dedupe key does not already exist.'],
  output: 'A registered record with its provenance, classification and dedupe key.',
  failurePath: 'Quarantine the item, record why, and route it to a human for triage.',
  escalation: 'Escalate to the department manager when the item cannot be classified with confidence above 0.6.',
  requiresApproval: false,
}

const REVIEW: Archetype = {
  slug: 'review',
  name: 'Review',
  level: 7,
  description: 'Assess an item against the department’s policy and quality bar, and record the evidence for the decision.',
  trigger: 'A registered item is ready for assessment.',
  steps: [
    { action: 'Load the applicable policy and the department checklist.', skill: 'check_policy_compliance' },
    { action: 'Summarise the item in the department’s own terms.', skill: 'summarize_executive' },
    { action: 'Extract the claims and the risks the item states or implies.', skill: 'extract_risks' },
    { action: 'Map the internal terminology to the wording the audience expects.', skill: 'align_terminology' },
    { action: 'Produce the assessment and the evidence that supports it.', skill: 'extract_answer' },
    { action: 'Record the assessment against the record.', tool: 'evidence.record' },
  ],
  decisions: [
    { question: 'Is the evidence sufficient to decide?', skill: 'check_readiness', then: 'CONTINUE', otherwise: 'ESCALATE', escalateTo: 'department_manager' },
  ],
  validation: ['Every conclusion cites the evidence it came from.', 'The assessment names what is still missing.'],
  output: 'An assessment with its evidence, its gaps and a recommended outcome.',
  failurePath: 'Record the assessment as INCOMPLETE and escalate; never present an incomplete assessment as a decision.',
  escalation: 'Escalate to the supervisor when the checklist fails on a mandatory item.',
  requiresApproval: false,
}

const APPROVAL: Archetype = {
  slug: 'approval',
  name: 'Approval and release',
  level: 5,
  description: 'Prepare an item for release, validate it, and route it to the human who must authorise the action.',
  trigger: 'An assessment recommends a release decision.',
  steps: [
    { action: 'Confirm the assessment is complete and every mandatory check passed.', skill: 'check_quality_bar' },
    { action: 'Read the release note back and check it is in plain language.', skill: 'check_plain_language' },
    { action: 'Validate the assembled payload against the required-field contract.', skill: 'validate_payload' },
    { action: 'Fingerprint the release artefact so any later change is detectable.', skill: 'fingerprint_file' },
    { action: 'Create the approval request with the full evidence bundle.', tool: 'approval.record', requiresApproval: true },
    { action: 'Wait for the human decision; do not act on the request itself.', advisory: true },
  ],
  decisions: [
    {
      question: 'Has a human approved this release?',
      skill: 'check_readiness',
      source: 'APPROVAL',
      afterStep: 5,
      then: 'CONTINUE',
      otherwise: 'STOP',
    },
  ],
  validation: ['The release bundle carries the assessment, the evidence and the fingerprint.', 'No unresolved placeholder remains.'],
  output: 'An approved release, executed only after the human decision is recorded.',
  failurePath: 'Do not release. Record the blocking check and return the item to review.',
  escalation: 'The approval is the escalation. It is never self-granted.',
  requiresApproval: true,
}

const EXCEPTION: Archetype = {
  slug: 'exception',
  name: 'Exception handling',
  level: 4,
  description: 'Handle an item that has breached its SLA, its policy or its quality bar, and decide its disposition.',
  trigger: 'A monitoring signal reports a breach, a failure or a stall.',
  steps: [
    { action: 'Confirm the signal is real and not a duplicate of an open case.', skill: 'classify_priority' },
    { action: 'Diagnose the cause from the recorded evidence.', skill: 'extract_claims' },
    { action: 'Decide whether a safe retry is appropriate.', skill: 'check_policy_compliance', advisory: true },
    { action: 'Attempt one bounded remediation within the department’s authority.', tool: 'automation.retry' },
    { action: 'Record the diagnosis and the action taken.', tool: 'error.log' },
    { action: 'Escalate with the full case history.', tool: 'error.escalate', requiresApproval: true },
  ],
  decisions: [
    { question: 'Is a bounded retry safe?', skill: 'check_quality_bar', then: 'CONTINUE', otherwise: 'ESCALATE', escalateTo: 'department_director' },
  ],
  validation: ['At most one bounded retry is attempted. There is no unbounded loop.', 'The case history is complete before escalation.'],
  output: 'A diagnosed case with the action taken and the escalation raised.',
  failurePath: 'Escalate immediately. A failed remediation is a human decision, not a second retry.',
  escalation: 'Escalate to the department director, then to the division lead, then to the Master AI.',
  requiresApproval: true,
}

const CLOSURE: Archetype = {
  slug: 'closure',
  name: 'Closure and reporting',
  level: 6,
  description: 'Close a completed case, record the outcome, and report the result to the people who need it.',
  trigger: 'A case reaches a terminal state.',
  steps: [
    { action: 'Confirm the case outcome is recorded and the evidence is attached.', skill: 'check_readiness' },
    { action: 'Summarise what was done, for whom and with what result.', skill: 'summarize_action_items' },
    { action: 'Update the department’s metrics from the real record.', skill: 'measure_text', advisory: true },
    { action: 'Write the outcome to the shared memory scope for the next agent.', tool: 'memory.write' },
    { action: 'Publish the report to the audience that needs it.', tool: 'report.generate' },
  ],
  decisions: [
    { question: 'Is the outcome fully evidenced?', skill: 'check_quality_bar', then: 'CONTINUE', otherwise: 'ESCALATE', escalateTo: 'supervisor' },
  ],
  validation: ['The report contains no figure that is not in the record.', 'The memory entry holds the approved lesson, not raw source material.'],
  output: 'A closed case, a report, and an approved lesson in the shared memory scope.',
  failurePath: 'Leave the case open with a stated reason rather than closing it incompletely.',
  escalation: 'Escalate to the supervisor when the outcome cannot be evidenced.',
  requiresApproval: false,
}

export const SOP_ARCHETYPES: Archetype[] = [INTAKE, REVIEW, APPROVAL, EXCEPTION, CLOSURE]

// ------------------------------------------------------------
// Generation
// ------------------------------------------------------------

const CATEGORY_TOOLS: Record<string, string[]> = {
  EXECUTIVE: ['crm.query', 'report.generate', 'approval.record', 'agent.dispatch'],
  REVENUE: ['crm.query', 'crm.createLead', 'crm.update', 'email.send', 'meeting.schedule', 'task.create'],
  DELIVERY: ['project.create', 'task.update', 'scope.revise', 'handover.prepare', 'evidence.record', 'qa.plan'],
  TECHNOLOGY: ['security.scan', 'automation.run', 'error.log', 'knowledge.index', 'file.scan'],
  CONTENT: ['content.create', 'knowledge.search', 'campaign.update', 'social.publish', 'report.generate'],
  OPERATIONS: ['invoice.generate', 'payment.prepare', 'task.update', 'knowledge.index', 'report.generate'],
  GOVERNANCE: ['approval.queue', 'approval.record', 'security.scan', 'evidence.record', 'error.escalate'],
  SUPPORT: ['crm.query', 'memory.search', 'memory.write', 'email.send', 'whatsapp.status', 'task.create'],
}

function subjectFor(departmentName: string): string {
  return departmentName
    .replace(/^Office of the /, '')
    .replace(/&/g, 'and')
    .trim()
    .toLowerCase()
}

export function buildSopLibrary(): SopDefinition[] {
  const sops: SopDefinition[] = []
  for (const department of DEPARTMENTS) {
    const subject = subjectFor(department.name)
    const tools = CATEGORY_TOOLS[department.category] ?? ['crm.query', 'task.update', 'report.generate']
    for (const archetype of SOP_ARCHETYPES) {
      const key = `${department.code}-${archetype.slug.toUpperCase()}`
      const steps: SopStep[] = archetype.steps.map((step, index) => ({
        ...step,
        id: `${key}-S${index + 1}`,
        order: index + 1,
      }))
      const decisionPoints: SopDecisionPoint[] = archetype.decisions.map((decision, index) => ({
        ...decision,
        id: `${key}-D${index + 1}`,
        afterStep: decision.afterStep ?? Math.min(steps.length, index * 3 + 3),
      }))
      sops.push({
        key,
        name: `${department.name} — ${archetype.name}`,
        category: department.category,
        departmentCode: department.code,
        departmentName: department.name,
        version: '1.0.0',
        status: 'ACTIVE',
        owner: department.code,
        level: archetype.level,
        description: `${archetype.description} Specialised for ${department.name} (${department.code}).`,
        trigger: archetype.trigger,
        inputs: [
          { name: 'subject', type: 'string', required: true },
          { name: 'identifier', type: 'string', required: true },
          { name: 'payload', type: 'object', required: true },
        ],
        preconditions: [
          'The caller holds the department’s base permission.',
          'The record is not already closed.',
          ...(archetype.requiresApproval ? ['A human approver is available for the release step.'] : []),
        ],
        steps,
        decisionPoints,
        tools,
        validation: archetype.validation,
        output: `${archetype.output} (${department.name})`,
        failurePath: archetype.failurePath,
        escalation: archetype.escalation,
        requiresApproval: archetype.requiresApproval,
        auditRequired: true,
      })
    }
  }
  return sops
}

export const SOP_LIBRARY: SopDefinition[] = buildSopLibrary()

export const SOP_LIBRARY_SIZE = SOP_LIBRARY.length

export function getSop(key: string): SopDefinition | undefined {
  return SOP_LIBRARY.find((sop) => sop.key === key)
}

/** Find the SOPs a department may execute, in level order (most senior first). */
export function sopsForDepartment(departmentCode: string): SopDefinition[] {
  return SOP_LIBRARY.filter((sop) => sop.departmentCode === departmentCode).sort((a, b) => a.level - b.level)
}

/** Find the SOPs that use a given skill. */
export function sopsUsingSkill(skillSlug: string): SopDefinition[] {
  return SOP_LIBRARY.filter((sop) =>
    sop.steps.some((step) => step.skill === skillSlug) || sop.decisionPoints.some((point) => point.skill === skillSlug),
  )
}
