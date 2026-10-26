// ============================================================
// TECH360 — self-healing
// ============================================================
// detect → classify → diagnose → bounded safe retry →
// alternative strategy → alternative model → specialist escalation →
// human escalation
//
// THE BOUNDARIES (all of them are enforced in code)
//   · A repair is BOUNDED. There is a hard attempt ceiling, so no
//     repair can loop.
//   · A repair may only touch a SAFE, ALLOW-LISTED action. An action
//     that is not on the list is never attempted automatically.
//   · A repair may NEVER bypass a permission, an approval, the
//     constitution or a governance rule. The allow-list is the
//     enforcement.
//   · After the ceiling, the failure ESCALATES to a human. It does
//     not keep trying.
//
// NOT A DUPLICATE
//   The existing `src/lib/ops-actions.ts` executes the operational
//   actions. This module classifies a failure and DECIDES what to do;
//   it then calls the same action executor. There is one action
//   executor, not two.
// ============================================================

import { newCorrelationId } from '@/lib/correlation'
import { audit } from '@/lib/security'

// ------------------------------------------------------------
// Types
// ------------------------------------------------------------

export type FailureClass =
  | 'TRANSIENT_NETWORK'
  | 'TIMEOUT'
  | 'RATE_LIMITED'
  | 'PROVIDER_UNAVAILABLE'
  | 'MODEL_OUTPUT_INVALID'
  | 'TOOL_PERMISSION_DENIED'
  | 'TOOL_FAILED'
  | 'KNOWLEDGE_MISSING'
  | 'DATA_INCONSISTENT'
  | 'POLICY_VIOLATION'
  | 'UNKNOWN'

export type RepairAction =
  | 'RETRY_SAME'
  | 'SWITCH_STRATEGY'
  | 'SWITCH_MODEL'
  | 'ESCALATE_SPECIALIST'
  | 'ESCALATE_HUMAN'
  | 'NO_ACTION'

export type RepairStep = {
  order: number
  action: RepairAction
  reason: string
  /** True when the step was actually attempted. */
  attempted: boolean
  ok: boolean
  error: string | null
  durationMs: number
}

export type SelfHealingResult = {
  ok: boolean
  classification: FailureClass
  diagnosis: string
  steps: RepairStep[]
  /** True when the run was recovered. */
  recovered: boolean
  /** True when the failure reached a human. */
  escalatedToHuman: boolean
  attempts: number
  error: string | null
  correlationId: string
  durationMs: number
}

// ------------------------------------------------------------
// The safe action allow-list
// ------------------------------------------------------------

/**
 * The actions a repair may take without a human.
 *
 * An action that is not on this list is never attempted by the
 * self-healing loop. It escalates instead.
 */
export const SAFE_REPAIR_ACTIONS: ReadonlySet<string> = new Set([
  'RETRY_SAME',
  'SWITCH_STRATEGY',
  'SWITCH_MODEL',
  'ESCALATE_SPECIALIST',
])

// ------------------------------------------------------------
// Classification
// ------------------------------------------------------------

export function classifyFailure(error: {
  code?: string | null
  message: string
  status?: number | null
}): { classification: FailureClass; reason: string } {
  const code = (error.code ?? '').toUpperCase()
  const message = error.message.toLowerCase()

  if (code.includes('TIMEOUT') || code.includes('TIMEDOUT') || message.includes('timed out') || message.includes('etimedout')) {
    return { classification: 'TIMEOUT', reason: 'the operation exceeded its time budget' }
  }
  if (code.includes('RATE_LIMIT') || error.status === 429 || message.includes('rate limit')) {
    return { classification: 'RATE_LIMITED', reason: 'the provider or gateway is rate limiting' }
  }
  if (code.includes('CONNECTION') || code.includes('ECONN') || code.includes('ENOTFOUND') || message.includes('fetch failed') || message.includes('network')) {
    return { classification: 'TRANSIENT_NETWORK', reason: 'the network call failed' }
  }
  if (code.includes('PROVIDER') || code.includes('NO_PROVIDER') || message.includes('provider')) {
    return { classification: 'PROVIDER_UNAVAILABLE', reason: 'no model provider could serve the request' }
  }
  if (code.includes('INVALID_OUTPUT') || code.includes('INVALID_INPUT') || message.includes('schema')) {
    return { classification: 'MODEL_OUTPUT_INVALID', reason: 'the model output did not match its schema' }
  }
  if (code.includes('PERMISSION') || code.includes('DENIED') || message.includes('permission')) {
    return { classification: 'TOOL_PERMISSION_DENIED', reason: 'the action was refused by a permission check' }
  }
  if (code.includes('TOOL') || message.includes('tool')) {
    return { classification: 'TOOL_FAILED', reason: 'a tool call failed' }
  }
  if (code.includes('NO_EVIDENCE') || code.includes('KNOWLEDGE') || message.includes('no evidence')) {
    return { classification: 'KNOWLEDGE_MISSING', reason: 'the knowledge needed to proceed was not found' }
  }
  if (code.includes('INCONSISTENT') || code.includes('DUPLICATE') || message.includes('inconsistent')) {
    return { classification: 'DATA_INCONSISTENT', reason: 'the data did not satisfy its own invariant' }
  }
  if (code.includes('POLICY') || code.includes('CONSTITUTION') || message.includes('policy')) {
    return { classification: 'POLICY_VIOLATION', reason: 'the attempt violated a policy or the constitution' }
  }
  return { classification: 'UNKNOWN', reason: 'the failure did not match a known class' }
}

/**
 * The repair plan for a failure class.
 *
 * The plan is a fixed ladder, so the number of attempts is bounded by
 * construction.
 */
export function repairPlan(classification: FailureClass): RepairAction[] {
  switch (classification) {
    case 'TRANSIENT_NETWORK':
    case 'TIMEOUT':
    case 'RATE_LIMITED':
      return ['RETRY_SAME', 'RETRY_SAME', 'SWITCH_MODEL', 'ESCALATE_SPECIALIST']
    case 'PROVIDER_UNAVAILABLE':
      return ['SWITCH_MODEL', 'SWITCH_MODEL', 'ESCALATE_SPECIALIST']
    case 'MODEL_OUTPUT_INVALID':
      return ['SWITCH_STRATEGY', 'SWITCH_STRATEGY', 'ESCALATE_SPECIALIST']
    case 'TOOL_FAILED':
      return ['RETRY_SAME', 'SWITCH_STRATEGY', 'ESCALATE_SPECIALIST']
    case 'TOOL_PERMISSION_DENIED':
    case 'POLICY_VIOLATION':
      // A refusal is not a transient failure. Retrying it would be
      // an attempt to bypass a control, so it escalates directly.
      return ['ESCALATE_HUMAN']
    case 'KNOWLEDGE_MISSING':
    case 'DATA_INCONSISTENT':
      return ['SWITCH_STRATEGY', 'ESCALATE_SPECIALIST']
    case 'UNKNOWN':
    default:
      return ['RETRY_SAME', 'ESCALATE_SPECIALIST']
  }
}

// ------------------------------------------------------------
// The repair loop
// ------------------------------------------------------------

export type SelfHealingInput = {
  error: { code?: string | null; message: string; status?: number | null }
  /** The work that failed, so a retry can re-run it. */
  retry: () => Promise<{ ok: boolean; output?: unknown; error?: string }>
  /** An alternative way of doing the same work. */
  alternativeStrategy?: () => Promise<{ ok: boolean; output?: unknown; error?: string }>
  /** An alternative model to serve the work. */
  alternativeModel?: () => Promise<{ ok: boolean; output?: unknown; error?: string }>
  /** A specialist employee to hand the work to. */
  escalateToSpecialist?: () => Promise<{ ok: boolean; output?: unknown; error?: string }>
  /** A human to hand the work to. */
  escalateToHuman?: () => Promise<{ ok: boolean; output?: unknown; error?: string }>
  /** Hard ceiling on the number of repair attempts. */
  maxAttempts?: number
  correlationId?: string
  persist?: boolean
}

/**
 * Attempt to repair a failure.
 *
 * The loop is bounded by `maxAttempts` (default 4) AND by the plan
 * length. It stops at the first success. When the plan is exhausted
 * it escalates to a human.
 */
export async function selfHeal(input: SelfHealingInput): Promise<SelfHealingResult> {
  const started = Date.now()
  const correlationId = input.correlationId ?? newCorrelationId()
  const { classification, reason } = classifyFailure(input.error)
  const plan = repairPlan(classification)
  const maxAttempts = Math.max(1, Math.min(8, input.maxAttempts ?? 4))
  const steps: RepairStep[] = []
  let attempts = 0
  let escalatedToHuman = false
  let recovered = false
  let output: unknown = null

  for (const action of plan.slice(0, maxAttempts)) {
    if (!SAFE_REPAIR_ACTIONS.has(action) && action !== 'ESCALATE_HUMAN') {
      // Defence in depth: an action that is not explicitly safe is
      // never attempted automatically.
      steps.push({
        order: steps.length + 1,
        action: 'NO_ACTION',
        reason: `"${action}" is not on the safe-repair allow-list, so it was not attempted automatically`,
        attempted: false,
        ok: false,
        error: 'the action is not allow-listed',
        durationMs: 0,
      })
      continue
    }

    const stepStart = Date.now()
    attempts += 1
    try {
      const result = await runAction(action, input)
      if (action === 'ESCALATE_HUMAN') escalatedToHuman = true
      if (result.ok) {
        output = result.output ?? null
        recovered = true
        steps.push({
          order: steps.length + 1,
          action,
          reason: `the "${action}" repair succeeded`,
          attempted: true,
          ok: true,
          error: null,
          durationMs: Date.now() - stepStart,
        })
        break
      }
      steps.push({
        order: steps.length + 1,
        action,
        reason: `the "${action}" repair did not resolve the failure`,
        attempted: true,
        ok: false,
        error: result.error ?? 'the repair did not succeed',
        durationMs: Date.now() - stepStart,
      })
    } catch (error) {
      steps.push({
        order: steps.length + 1,
        action,
        reason: `the "${action}" repair threw`,
        attempted: true,
        ok: false,
        error: error instanceof Error ? error.message : 'the repair threw',
        durationMs: Date.now() - stepStart,
      })
    }
  }

  // The plan is exhausted: hand it to a human.
  if (!recovered) {
    const stepStart = Date.now()
    attempts += 1
    if (input.escalateToHuman) {
      try {
        const result = await input.escalateToHuman()
        escalatedToHuman = true
        steps.push({
          order: steps.length + 1,
          action: 'ESCALATE_HUMAN',
          reason: 'the repair plan was exhausted, so the failure was handed to a human',
          attempted: true,
          ok: result.ok,
          error: result.error ?? null,
          durationMs: Date.now() - stepStart,
        })
        if (result.ok) {
          output = result.output ?? null
          recovered = true
        }
      } catch (error) {
        steps.push({
          order: steps.length + 1,
          action: 'ESCALATE_HUMAN',
          reason: 'the escalation to a human threw',
          attempted: true,
          ok: false,
          error: error instanceof Error ? error.message : 'the escalation threw',
          durationMs: Date.now() - stepStart,
        })
      }
    } else {
      steps.push({
        order: steps.length + 1,
        action: 'ESCALATE_HUMAN',
        reason: 'the repair plan was exhausted and no human escalation was available',
        attempted: false,
        ok: false,
        error: 'no human escalation path was available',
        durationMs: 0,
      })
    }
  }

  const result: SelfHealingResult = {
    ok: recovered,
    classification,
    diagnosis: reason,
    steps,
    recovered,
    escalatedToHuman,
    attempts,
    error: recovered ? null : `the failure was not repaired after ${attempts} bounded attempts: ${input.error.message}`,
    correlationId,
    durationMs: Date.now() - started,
  }

  if (input.persist !== false) {
    try {
      await audit({
        actor: 'system:self-healing',
        action: 'SELF_HEALING_COMPLETED',
        entityType: 'AgentExecution',
        entityId: correlationId,
        details: {
          correlationId,
          classification,
          recovered,
          escalatedToHuman,
          attempts,
          steps: steps.map((step) => ({ action: step.action, ok: step.ok, attempted: step.attempted })),
        },
      })
    } catch (error) {
      console.error('[self-healing] failed to record the repair', error)
    }
  }

  return result
}

async function runAction(
  action: RepairAction,
  input: SelfHealingInput,
): Promise<{ ok: boolean; output?: unknown; error?: string }> {
  switch (action) {
    case 'RETRY_SAME':
      return input.retry()
    case 'SWITCH_STRATEGY':
      if (!input.alternativeStrategy) return { ok: false, error: 'no alternative strategy is available' }
      return input.alternativeStrategy()
    case 'SWITCH_MODEL':
      if (!input.alternativeModel) return { ok: false, error: 'no alternative model is available' }
      return input.alternativeModel()
    case 'ESCALATE_SPECIALIST':
      if (!input.escalateToSpecialist) return { ok: false, error: 'no specialist escalation path is available' }
      return input.escalateToSpecialist()
    case 'ESCALATE_HUMAN':
      if (!input.escalateToHuman) return { ok: false, error: 'no human escalation path is available' }
      return input.escalateToHuman()
    default:
      return { ok: false, error: `"${action}" is not a repair action` }
  }
}
