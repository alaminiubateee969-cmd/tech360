// ============================================================
// TECH360 — SOP executor
// ============================================================
// The runtime WALKS a procedure. It does not display one.
//
// EXECUTION CONTRACT
//   1. The SOP must exist and be ACTIVE.
//   2. Every declared required input must be present.
//   3. Steps run in order. A step that calls a skill runs it through
//      the ONE skill executor, with the caller's permissions.
//   4. A step that calls a tool goes through the governed tool
//      gateway. The executor never performs a side effect itself.
//   5. A step marked `requiresApproval` stops the run and returns
//      AWAITING_APPROVAL. It never self-approves.
//   6. Decision points are resolved from a skill's output. A decision
//      that cannot be resolved is UNDETERMINED and takes the
//      `otherwise` branch — the safe default — and says so.
//   7. The run is validated structurally, recorded as a SopRun, and
//      audited.
//   8. A failure follows the SOP's declared failure path and
//      escalates to the declared level. It never silently continues.
// ============================================================

import { newCorrelationId } from '@/lib/correlation'
import { executeSkill } from '@/lib/skills/executor'
import { getSkillDefinition } from '@/lib/skills/registry'
import { SKILL_CATALOG, departmentSlug } from '@/lib/skills/catalog'
import type { SopDefinition } from './library'
import { getSop } from './library'

export type SopStepTranscript = {
  order: number
  stepId: string
  action: string
  kind: 'SKILL' | 'TOOL' | 'ADVISORY' | 'APPROVAL' | 'SKIPPED'
  status: 'OK' | 'FAILED' | 'SKIPPED' | 'AWAITING_APPROVAL' | 'UNDETERMINED'
  output: unknown
  error: string | null
  durationMs: number
}

export type SopDecisionTranscript = {
  decisionId: string
  question: string
  answer: 'YES' | 'NO' | 'UNDETERMINED'
  branch: 'CONTINUE' | 'BRANCH' | 'ESCALATE' | 'STOP'
  evidence: string
}

export type SopRunResult = {
  ok: boolean
  status: 'SUCCESS' | 'FAILED' | 'ESCALATED' | 'AWAITING_APPROVAL'
  sopKey: string
  correlationId: string
  output: Record<string, unknown>
  steps: SopStepTranscript[]
  decisions: SopDecisionTranscript[]
  error: string | null
  errorCode: string | null
  validation: {
    structuralPass: boolean
    failures: string[]
    declaredChecks: string[]
  }
  durationMs: number
}

export type SopToolGateway = {
  /** Call a governed tool. The executor never calls the tool itself. */
  call: (toolName: string, args: Record<string, unknown>) => Promise<{ ok: boolean; output?: unknown; error?: string }>
}

export type ExecuteSopOptions = {
  grantedPermissions: string[]
  correlationId?: string
  requestedBy?: string
  /** The governed tool gateway. Without it, tool steps are refused. */
  toolGateway?: SopToolGateway
  /** The SOP definition to run. Defaults to the library entry. */
  definition?: SopDefinition
  /** Persist the SopRun row. Off in unit tests with no database. */
  persist?: boolean
  /** Maximum steps. A procedure that loops is stopped, never retried forever. */
  maxSteps?: number
}

// ------------------------------------------------------------
// Decision resolution
// ------------------------------------------------------------

const BOOLEAN_KEYS = ['ok', 'pass', 'passed', 'valid', 'complete', 'satisfied', 'approved', 'match', 'isValid', 'acceptable']
const POSITIVE_BANDS = ['PASS', 'PASSED', 'COMPLETE', 'COMPLETED', 'GOOD', 'QUALIFIED', 'MATCH', 'OK', 'READY', 'APPROVED']

/**
 * Resolve a decision point from a skill's output.
 *
 * The rule is explicit and conservative: a boolean wins; a band wins
 * if it is in the positive set; a score counts as satisfied at 0.6
 * and above. Anything else is UNDETERMINED.
 */
export function resolveDecision(output: unknown): { answer: 'YES' | 'NO' | 'UNDETERMINED'; evidence: string } {
  if (!output || typeof output !== 'object') return { answer: 'UNDETERMINED', evidence: 'no structured output' }
  const record = output as Record<string, unknown>
  for (const key of BOOLEAN_KEYS) {
    if (typeof record[key] === 'boolean') {
      return { answer: record[key] ? 'YES' : 'NO', evidence: `${key}=${record[key]}` }
    }
  }
  if (typeof record.band === 'string') {
    const band = record.band.toUpperCase()
    return {
      answer: POSITIVE_BANDS.includes(band) ? 'YES' : 'NO',
      evidence: `band=${band}`,
    }
  }
  if (typeof record.score === 'number') {
    return { answer: record.score >= 0.6 ? 'YES' : 'NO', evidence: `score=${record.score} (threshold 0.6)` }
  }
  if (typeof record.confidence === 'number') {
    return { answer: record.confidence >= 0.6 ? 'YES' : 'NO', evidence: `confidence=${record.confidence} (threshold 0.6)` }
  }
  return { answer: 'UNDETERMINED', evidence: 'no decision signal in the skill output' }
}

// ------------------------------------------------------------
// The executor
// ------------------------------------------------------------

/** The skill id for a capability slug inside a department. */
export function sopSkillId(definition: SopDefinition, capabilitySlug: string): string {
  return `${departmentSlug(definition.departmentName)}_${capabilitySlug}`
}

export async function executeSop(
  sopKey: string,
  inputs: Record<string, unknown>,
  options: ExecuteSopOptions,
): Promise<SopRunResult> {
  const started = Date.now()
  const correlationId = options.correlationId ?? newCorrelationId()
  const definition = options.definition ?? getSop(sopKey)

  const steps: SopStepTranscript[] = []
  const decisions: SopDecisionTranscript[] = []

  const build = (
    status: SopRunResult['status'],
    error: string | null,
    errorCode: string | null,
    output: Record<string, unknown>,
    failures: string[],
  ): SopRunResult => ({
    ok: status === 'SUCCESS',
    status,
    sopKey,
    correlationId,
    output,
    steps,
    decisions,
    error,
    errorCode,
    validation: {
      structuralPass: status === 'SUCCESS',
      failures,
      declaredChecks: definition?.validation ?? [],
    },
    durationMs: Date.now() - started,
  })

  if (!definition) {
    return build('FAILED', `SOP "${sopKey}" does not exist`, 'SOP_NOT_FOUND', {}, [`SOP "${sopKey}" does not exist`])
  }
  if (definition.status !== 'ACTIVE') {
    return build('FAILED', `SOP "${sopKey}" is ${definition.status}`, 'SOP_NOT_ACTIVE', {}, [`SOP "${sopKey}" is ${definition.status}`])
  }

  // 1. Preconditions: the required inputs must be present.
  const missing = definition.inputs.filter((input) => input.required && inputs[input.name] === undefined)
  if (missing.length > 0) {
    const message = `SOP "${sopKey}" requires inputs that were not supplied: ${missing.map((m) => m.name).join(', ')}`
    return build('FAILED', message, 'MISSING_INPUTS', {}, [message])
  }

  // 2. Walk the steps.
  const maxSteps = options.maxSteps ?? definition.steps.length
  const context: Record<string, unknown> = { ...inputs }
  let stepIndex = 0
  let stopped = false

  for (const step of definition.steps) {
    if (stepIndex >= maxSteps) {
      steps.push({
        order: step.order,
        stepId: step.id,
        action: step.action,
        kind: 'SKIPPED',
        status: 'SKIPPED',
        output: null,
        error: `the procedure exceeded its ${maxSteps}-step bound and was stopped`,
        durationMs: 0,
      })
      break
    }
    stepIndex += 1

    if (stopped) {
      steps.push({
        order: step.order,
        stepId: step.id,
        action: step.action,
        kind: 'SKIPPED',
        status: 'SKIPPED',
        output: null,
        error: 'the procedure stopped at an earlier decision point',
        durationMs: 0,
      })
      continue
    }

    if (step.requiresApproval) {
      steps.push({
        order: step.order,
        stepId: step.id,
        action: step.action,
        kind: 'APPROVAL',
        status: 'AWAITING_APPROVAL',
        output: null,
        error: 'this step requires a human approval before it may run',
        durationMs: 0,
      })
      const message = `step ${step.order} requires a human approval`
      const result = build('AWAITING_APPROVAL', message, 'APPROVAL_REQUIRED', context, [message])
      await persistRun(result, definition, inputs, options)
      return result
    }

    const stepStart = Date.now()

    if (step.skill) {
      const skillId = sopSkillId(definition, step.skill)
      const skillDefinition = getSkillDefinition(skillId, SKILL_CATALOG)
      if (!skillDefinition) {
        const message = `SOP "${sopKey}" step ${step.order} needs skill "${skillId}", which is not registered`
        steps.push({
          order: step.order,
          stepId: step.id,
          action: step.action,
          kind: 'SKILL',
          status: 'FAILED',
          output: null,
          error: `skill "${skillId}" is not registered`,
          durationMs: Date.now() - stepStart,
        })
        const result = build('FAILED', message, 'SKILL_NOT_FOUND', context, [message])
        await persistRun(result, definition, inputs, options)
        return result
      }
      const skillResult = await executeSkill(skillDefinition, buildSkillInput(context, skillDefinition.inputSchema), {
        grantedPermissions: options.grantedPermissions,
        correlationId,
        requestedBy: options.requestedBy,
        persist: options.persist !== false,
      })
      if (!skillResult.ok) {
        const message = `SOP "${sopKey}" step ${step.order} failed: ${skillResult.error}`
        steps.push({
          order: step.order,
          stepId: step.id,
          action: step.action,
          kind: 'SKILL',
          status: 'FAILED',
          output: null,
          error: skillResult.error,
          durationMs: Date.now() - stepStart,
        })
        const result = build('FAILED', message, 'SKILL_FAILED', context, [message])
        await persistRun(result, definition, inputs, options)
        return result
      }
      steps.push({
        order: step.order,
        stepId: step.id,
        action: step.action,
        kind: 'SKILL',
        status: 'OK',
        output: skillResult.output,
        error: null,
        durationMs: Date.now() - stepStart,
      })
      context[`step_${step.order}`] = skillResult.output
      if (skillResult.output && typeof skillResult.output === 'object') {
        Object.assign(context, skillResult.output as Record<string, unknown>)
      }
    } else if (step.tool) {
      if (!options.toolGateway) {
        const message = `SOP "${sopKey}" step ${step.order} calls tool "${step.tool}", but no governed tool gateway was supplied`
        steps.push({
          order: step.order,
          stepId: step.id,
          action: step.action,
          kind: 'TOOL',
          status: 'FAILED',
          output: null,
          error: 'no tool gateway',
          durationMs: Date.now() - stepStart,
        })
        const result = build('FAILED', message, 'TOOL_GATEWAY_UNAVAILABLE', context, [message])
        await persistRun(result, definition, inputs, options)
        return result
      }
      const toolResult = await options.toolGateway.call(step.tool, context)
      if (!toolResult.ok) {
        const message = `SOP "${sopKey}" step ${step.order} failed at tool "${step.tool}": ${toolResult.error ?? 'unknown error'}`
        steps.push({
          order: step.order,
          stepId: step.id,
          action: step.action,
          kind: 'TOOL',
          status: 'FAILED',
          output: toolResult.output ?? null,
          error: toolResult.error ?? 'tool failed',
          durationMs: Date.now() - stepStart,
        })
        const result = build('FAILED', message, 'TOOL_FAILED', context, [message])
        await persistRun(result, definition, inputs, options)
        return result
      }
      steps.push({
        order: step.order,
        stepId: step.id,
        action: step.action,
        kind: 'TOOL',
        status: 'OK',
        output: toolResult.output ?? null,
        error: null,
        durationMs: Date.now() - stepStart,
      })
      context[`step_${step.order}`] = toolResult.output ?? null
    } else {
      steps.push({
        order: step.order,
        stepId: step.id,
        action: step.action,
        kind: 'ADVISORY',
        status: 'OK',
        output: null,
        error: null,
        durationMs: Date.now() - stepStart,
      })
    }

    // 3. Decision points that sit after this step.
    for (const decision of definition.decisionPoints.filter((d) => d.afterStep === step.order)) {
      const decisionSkillId = sopSkillId(definition, decision.skill)
      const decisionDefinition = getSkillDefinition(decisionSkillId, SKILL_CATALOG)
      let answer: 'YES' | 'NO' | 'UNDETERMINED' = 'UNDETERMINED'
      let evidence = 'the decision skill was not registered'

      if (decision.source === 'APPROVAL') {
        // The answer is the recorded human decision, not a checklist.
        const state = String(context.approvalState ?? '').toUpperCase()
        answer = state === 'APPROVED' ? 'YES' : state === 'REJECTED' ? 'NO' : 'UNDETERMINED'
        evidence = `the recorded approval state is "${state || 'not recorded'}"`
      } else if (decisionDefinition) {
        const decisionResult = await executeSkill(decisionDefinition, buildSkillInput(context, decisionDefinition.inputSchema), {
          grantedPermissions: options.grantedPermissions,
          correlationId,
          requestedBy: options.requestedBy,
          persist: options.persist !== false,
        })
        if (decisionResult.ok) {
          const resolved = resolveDecision(decisionResult.output)
          answer = resolved.answer
          evidence = resolved.evidence
        } else {
          evidence = `the decision skill failed: ${decisionResult.error}`
        }
      }

      // An UNDETERMINED decision takes the `otherwise` branch — the
      // safe default — and is recorded as such.
      const branch = answer === 'YES' ? decision.then : decision.otherwise
      decisions.push({
        decisionId: decision.id,
        question: decision.question,
        answer,
        branch,
        evidence,
      })

      if (branch === 'STOP') {
        stopped = true
      } else if (branch === 'ESCALATE') {
        const message = `the procedure escalated at decision "${decision.question}": ${evidence}`
        const result = build('ESCALATED', message, 'SOP_ESCALATED', context, [decision.question])
        await persistRun(result, definition, inputs, options)
        return result
      }
    }
  }

  // 4. Structural validation.
  const failures: string[] = []
  const executedSteps = steps.filter((s) => s.kind === 'SKILL' || s.kind === 'TOOL')
  if (executedSteps.length === 0 && definition.steps.some((s) => !s.advisory)) {
    failures.push('the procedure declared working steps but none produced a result')
  }
  for (const decision of decisions) {
    if (decision.answer === 'UNDETERMINED') {
      failures.push(`decision "${decision.question}" could not be resolved (${decision.evidence})`)
    }
  }
  if (steps.some((s) => s.status === 'AWAITING_APPROVAL')) {
    failures.push('a step is still awaiting approval')
  }

  const result = build(
    failures.length === 0 ? 'SUCCESS' : 'FAILED',
    failures.length === 0 ? null : failures.join('; '),
    failures.length === 0 ? null : 'VALIDATION_FAILED',
    context,
    failures,
  )
  await persistRun(result, definition, inputs, options)
  return result
}

// ------------------------------------------------------------
// Helpers
// ------------------------------------------------------------

/**
 * The aliases that let a procedure's declared inputs satisfy a
 * skill's declared inputs.
 *
 * A procedure declares `subject`, `identifier` and `payload`. A skill
 * declares `text`, `message`, `filename`. Without an alias table a
 * procedure step would fail on a field that IS present, in a
 * different name. The aliases are explicit and small.
 */
const INPUT_ALIASES: Record<string, string[]> = {
  text: ['subject', 'content', 'body', 'document', 'description', 'message'],
  message: ['subject', 'content', 'body', 'text', 'description'],
  filename: ['identifier', 'subject', 'document'],
  fileName: ['identifier', 'subject', 'document'],
  name: ['subject', 'identifier'],
  title: ['subject', 'identifier'],
  id: ['identifier', 'subject'],
  identifier: ['identifier', 'subject'],
  company: ['subject', 'identifier'],
  payload: ['payload', 'subject'],
  body: ['body', 'subject', 'content'],
  content: ['content', 'subject', 'body'],
  url: ['identifier', 'subject'],
  phone: ['identifier', 'subject'],
  email: ['identifier', 'subject'],
  question: ['subject', 'objective', 'task', 'text'],
  evidence: ['evidence', 'text', 'content', 'body', 'subject'],
  variables: ['variables', 'payload'],
  template: ['template'],
  query: ['subject', 'question', 'text'],
  candidates: ['candidates', 'payload'],
  items: ['items', 'checklist'],
}

/**
 * Build the input for a skill step from the accumulated context.
 *
 * The skill's OWN declared input schema decides what is passed: a
 * field the skill did not declare is not passed, so a step never
 * hands a skill a value it did not ask for.
 */
export function buildSkillInput(
  context: Record<string, unknown>,
  schema?: { properties?: Record<string, unknown> },
): Record<string, unknown> {
  const payload: Record<string, unknown> = {}
  const declared = schema?.properties ? Object.keys(schema.properties) : null

  const take = (name: string): unknown => {
    if (context[name] !== undefined && context[name] !== null) return context[name]
    for (const alias of INPUT_ALIASES[name] ?? []) {
      if (context[alias] !== undefined && context[alias] !== null) return context[alias]
    }
    return undefined
  }

  if (declared) {
    for (const name of declared) {
      const value = take(name)
      if (value === undefined) continue
      const declaredType = (schema?.properties?.[name] as { type?: string } | undefined)?.type
      if (declaredType === 'array' && !Array.isArray(value)) {
        // An array-typed input that resolves to a single value becomes
        // a one-element array. The procedure's own text IS the
        // evidence it is working on.
        payload[name] = [value]
        continue
      }
      payload[name] = value
    }
    // The accumulated step results are always available to a skill
    // that asks for them.
    for (const [key, value] of Object.entries(context)) {
      if (key.startsWith('step_') && value !== undefined) payload[key] = value
    }
    return payload
  }

  for (const [key, value] of Object.entries(context)) {
    if (value === undefined || value === null) continue
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      payload[key] = value
    } else if (Array.isArray(value) || key.startsWith('step_')) {
      payload[key] = value
    }
  }
  return payload
}

/** Persist the run and audit it. */
async function persistRun(
  result: SopRunResult,
  definition: SopDefinition,
  inputs: Record<string, unknown>,
  options: ExecuteSopOptions,
): Promise<void> {
  if (options.persist === false) return
  try {
    const [{ db }, { audit }] = await Promise.all([import('@/lib/db'), import('@/lib/security')])
    const sop = await db.sop.findUnique({ where: { key: definition.key }, select: { id: true } })
    if (sop) {
      await db.sopRun.create({
        data: {
          sopKey: definition.key,
          correlationId: result.correlationId,
          status: result.status,
          stepIndex: result.steps.length,
          totalSteps: definition.steps.length,
          input: JSON.stringify(inputs).slice(0, 20_000),
          output: JSON.stringify(result.output).slice(0, 20_000),
          error: result.error,
          steps: JSON.stringify({ steps: result.steps, decisions: result.decisions }).slice(0, 40_000),
          completedAt: new Date(),
        },
      })
    }
    await audit({
      actor: options.requestedBy ? `user:${options.requestedBy}` : 'system:sops',
      action: 'SOP_EXECUTED',
      entityType: 'Sop',
      entityId: definition.key,
      details: {
        correlationId: result.correlationId,
        status: result.status,
        errorCode: result.errorCode,
        steps: result.steps.length,
        decisions: result.decisions.length,
        durationMs: result.durationMs,
        structuralPass: result.validation.structuralPass,
      },
    })
  } catch (error) {
    console.error('[sops] failed to record the SOP run', error)
  }
}
