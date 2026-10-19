// ============================================================
// TECH360 — reflection
// ============================================================
// Reflection is NOT a general feature. The specification says
// "reflection for appropriate complex tasks only", and that means:
//
//   · a simple task is NOT reflected on
//   · a routine task is NOT reflected on
//   · a failed task IS reflected on (something went wrong)
//   · a complex or high-risk task IS reflected on
//
// The reflection is stored as a PROCEDURAL memory so the next run can
// retrieve it — but it is stored as a WORKING-type draft until the
// learning engine has validated it. Reflection proposes; it does not
// change behaviour on its own.
// ============================================================

import { newCorrelationId } from '@/lib/correlation'
import { writeMemory } from '@/lib/memory/system'

export type ReflectionTrigger = 'COMPLEX_TASK' | 'HIGH_RISK' | 'FAILURE' | 'ESCALATION' | 'PERIODIC_REVIEW'

export type Reflection = {
  id: string
  trigger: ReflectionTrigger
  objective: string
  outcome: string
  whatWorked: string[]
  whatFailed: string[]
  why: string
  /** The one concrete change for next time. */
  nextChange: string
  /** The learning proposal this reflection feeds. */
  feedsLearning: boolean
  correlationId: string
  createdAt: Date
}

/**
 * Decide whether a task warrants a reflection.
 *
 * The rules are explicit and small. A simple successful task does not.
 */
export function shouldReflect(input: {
  complexity: 'SIMPLE' | 'STANDARD' | 'COMPLEX' | 'ENTERPRISE'
  risk: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
  succeeded: boolean
  escalated?: boolean
}): { reflect: boolean; trigger: ReflectionTrigger | null; reason: string } {
  if (!input.succeeded) {
    return { reflect: true, trigger: 'FAILURE', reason: 'the task failed, so there is something to learn' }
  }
  if (input.escalated) {
    return { reflect: true, trigger: 'ESCALATION', reason: 'the task escalated, so the boundary was reached' }
  }
  if (input.risk === 'CRITICAL' || input.risk === 'HIGH') {
    return { reflect: true, trigger: 'HIGH_RISK', reason: 'the task was high risk' }
  }
  if (input.complexity === 'COMPLEX' || input.complexity === 'ENTERPRISE') {
    return { reflect: true, trigger: 'COMPLEX_TASK', reason: 'the task was complex' }
  }
  return { reflect: false, trigger: null, reason: 'the task was simple and successful; there is nothing to reflect on' }
}

/**
 * Build a reflection from the record of a run.
 *
 * The inputs are the real record: the objective, the outcome, the
 * steps that succeeded and the ones that did not.
 */
export function reflect(input: {
  objective: string
  outcome: string
  succeeded: boolean
  whatWorked: string[]
  whatFailed: string[]
  why?: string
}): Reflection {
  const why =
    input.why ??
    (input.succeeded
      ? 'The work completed within its scope, and the steps that carried the result are recorded above.'
      : 'The work did not complete. The failing steps above are where the attempt broke; the next run should start from there rather than repeating the same path.')

  const nextChange = input.succeeded
    ? `Keep the path that worked — ${input.whatWorked[0] ?? 'the recorded step'} — and stop adding checks that did not change the outcome.`
    : `Change the first failing step — ${input.whatFailed[0] ?? 'the recorded failure'} — before retrying, so the retry is not a repeat.`

  return {
    id: `RF-${newCorrelationId().slice(0, 12)}`,
    trigger: input.succeeded ? 'COMPLEX_TASK' : 'FAILURE',
    objective: input.objective,
    outcome: input.outcome,
    whatWorked: input.whatWorked,
    whatFailed: input.whatFailed,
    why,
    nextChange,
    feedsLearning: true,
    correlationId: newCorrelationId(),
    createdAt: new Date(),
  }
}

/**
 * Store a reflection.
 *
 * It is written as a WORKING memory: it exists, it is retrievable, and
 * it is explicitly NOT validated. The learning engine is what turns it
 * into a validated lesson.
 */
export async function storeReflection(
  reflection: Reflection,
  options: { departmentCode?: string | null; agentCode?: string | null; scope?: 'LESSON' | 'WORKFLOW' } = {},
): Promise<void> {
  await writeMemory({
    scope: options.scope ?? 'LESSON',
    key: `reflection:${reflection.objective.slice(0, 60)}`,
    content: [
      `Objective: ${reflection.objective}`,
      `Outcome: ${reflection.outcome}`,
      `What worked: ${reflection.whatWorked.join('; ') || 'nothing recorded'}`,
      `What failed: ${reflection.whatFailed.join('; ') || 'nothing recorded'}`,
      `Why: ${reflection.why}`,
      `Next change: ${reflection.nextChange}`,
    ].join('\n'),
    memoryType: 'WORKING',
    accessLevel: 'INTERNAL',
    departmentCode: options.departmentCode ?? null,
    agentCode: options.agentCode ?? null,
    validated: false,
    source: 'REFLECTION',
    correlationId: reflection.correlationId,
    tags: ['reflection', reflection.trigger.toLowerCase()],
    writtenBy: 'system:reflection',
  })
}
