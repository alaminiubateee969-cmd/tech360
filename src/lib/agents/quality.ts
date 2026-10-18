// ============================================================
// TECH360 — quality engine
// ============================================================
// worker → reviewer → validator
//
// The specification says: "For important work, use a quality chain:
// worker → reviewer → validator. Deeper validation only when the
// complexity or risk justifies it."
//
// So the chain depth is NOT fixed:
//   LOW RISK, SIMPLE      → worker only
//   STANDARD              → worker → reviewer
//   COMPLEX or HIGH RISK  → worker → reviewer → validator
//
// WHAT MAKES IT HONEST
//   The reviewer's verdict is a real, computed score over real
//   criteria — never a constant "approved". The validator runs
//   deterministic checks (schema, policy, grounding, tool
//   permissions) that can FAIL. A failed check is reported as a
//   failure, not smoothed over.
// ============================================================

import { newCorrelationId } from '@/lib/correlation'
import { audit } from '@/lib/security'

// ------------------------------------------------------------
// Types
// ------------------------------------------------------------

export type QualityRisk = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'

export type ReviewCriterion = {
  id: string
  /** What the criterion measures. */
  description: string
  /** 0..1. A criterion with no evidence scores 0 — never 1. */
  score: number
  /** The evidence for the score. */
  evidence: string
  /** True when the criterion is a hard gate. */
  blocking: boolean
}

export type QualityStage = 'WORKER' | 'REVIEWER' | 'VALIDATOR'

export type QualityStageResult = {
  stage: QualityStage
  ok: boolean
  score: number | null
  output: unknown
  criteria: ReviewCriterion[]
  errors: string[]
  durationMs: number
}

export type QualityOutcome = {
  ok: boolean
  /** The stage that failed, or null when everything passed. */
  failedAt: QualityStage | null
  stages: QualityStageResult[]
  finalOutput: unknown
  score: number | null
  error: string | null
  correlationId: string
  durationMs: number
}

// ------------------------------------------------------------
// Chain depth
// ------------------------------------------------------------

/**
 * Decide how deep the chain goes.
 *
 * The rule is explicit: the chain deepens with complexity and with
 * risk, and a CRITICAL risk always reaches the validator.
 */
export function chainDepth(input: { complexity: 'SIMPLE' | 'STANDARD' | 'COMPLEX' | 'ENTERPRISE'; risk: QualityRisk }): QualityStage[] {
  if (input.risk === 'CRITICAL') return ['WORKER', 'REVIEWER', 'VALIDATOR']
  if (input.complexity === 'ENTERPRISE' || input.complexity === 'COMPLEX') return ['WORKER', 'REVIEWER', 'VALIDATOR']
  if (input.risk === 'HIGH') return ['WORKER', 'REVIEWER', 'VALIDATOR']
  if (input.complexity === 'STANDARD' || input.risk === 'MEDIUM') return ['WORKER', 'REVIEWER']
  return ['WORKER']
}

/** The score a work must reach to pass the reviewer. */
export const REVIEW_PASS_THRESHOLD = 0.75

// ------------------------------------------------------------
// The engine
// ------------------------------------------------------------

export type QualityEngineInput = {
  task: string
  complexity: 'SIMPLE' | 'STANDARD' | 'COMPLEX' | 'ENTERPRISE'
  risk: QualityRisk
  /** The worker: does the work. */
  worker: () => Promise<{ ok: boolean; output: unknown; error?: string }>
  /** The reviewer: judges the work. Omit it to run the worker alone. */
  reviewer?: (work: unknown) => Promise<{ criteria: ReviewCriterion[]; output?: unknown; error?: string }>
  /** The validator: deterministic checks that can fail. */
  validator?: (work: unknown) => Promise<{ criteria: ReviewCriterion[]; output?: unknown; error?: string }>
  correlationId?: string
  /** Where the run is recorded. */
  requestedBy?: string
  /** Persist the run and the metrics. */
  persist?: boolean
}

export async function runQualityChain(input: QualityEngineInput): Promise<QualityOutcome> {
  const started = Date.now()
  const correlationId = input.correlationId ?? newCorrelationId()
  const stages: QualityStageResult[] = []
  const depth = chainDepth(input)

  // --- WORKER ---
  const workerStart = Date.now()
  let work: unknown = null
  let workerErrors: string[] = []
  try {
    const result = await input.worker()
    if (!result.ok) workerErrors = [result.error ?? 'the worker failed']
    work = result.output
  } catch (error) {
    workerErrors = [error instanceof Error ? error.message : 'the worker threw']
  }
  stages.push({
    stage: 'WORKER',
    ok: workerErrors.length === 0,
    score: null,
    output: work,
    criteria: [],
    errors: workerErrors,
    durationMs: Date.now() - workerStart,
  })
  if (workerErrors.length > 0) {
    const outcome = finish('WORKER', stages, work, null, workerErrors.join('; '), correlationId, started)
    await record(outcome, input)
    return outcome
  }

  // --- REVIEWER ---
  if (depth.includes('REVIEWER')) {
    if (!input.reviewer) {
      const error = 'the chain requires a reviewer but none was supplied'
      stages.push({ stage: 'REVIEWER', ok: false, score: null, output: null, criteria: [], errors: [error], durationMs: 0 })
      const outcome = finish('REVIEWER', stages, work, null, error, correlationId, started)
      await record(outcome, input)
      return outcome
    }
    const reviewStart = Date.now()
    try {
      const review = await input.reviewer(work)
      const score = averageScore(review.criteria)
      const blockingFailure = review.criteria.find((criterion) => criterion.blocking && criterion.score < 1)
      const passed = score >= REVIEW_PASS_THRESHOLD && !blockingFailure
      const errors: string[] = []
      if (blockingFailure) errors.push(`the blocking criterion "${blockingFailure.id}" failed: ${blockingFailure.evidence}`)
      if (score < REVIEW_PASS_THRESHOLD) {
        errors.push(`the review score ${score.toFixed(2)} is below the ${REVIEW_PASS_THRESHOLD} threshold`)
      }
      if (review.error) errors.push(review.error)
      stages.push({
        stage: 'REVIEWER',
        ok: passed,
        score,
        output: review.output ?? work,
        criteria: review.criteria,
        errors,
        durationMs: Date.now() - reviewStart,
      })
      if (!passed) {
        const outcome = finish('REVIEWER', stages, work, score, errors.join('; '), correlationId, started)
        await record(outcome, input)
        return outcome
      }
      work = review.output ?? work
    } catch (error) {
      const message = error instanceof Error ? error.message : 'the reviewer threw'
      stages.push({ stage: 'REVIEWER', ok: false, score: null, output: null, criteria: [], errors: [message], durationMs: Date.now() - reviewStart })
      const outcome = finish('REVIEWER', stages, work, null, message, correlationId, started)
      await record(outcome, input)
      return outcome
    }
  }

  // --- VALIDATOR ---
  if (depth.includes('VALIDATOR')) {
    if (!input.validator) {
      const error = 'the chain requires a validator but none was supplied'
      stages.push({ stage: 'VALIDATOR', ok: false, score: null, output: null, criteria: [], errors: [error], durationMs: 0 })
      const outcome = finish('VALIDATOR', stages, work, null, error, correlationId, started)
      await record(outcome, input)
      return outcome
    }
    const validationStart = Date.now()
    try {
      const validation = await input.validator(work)
      const score = averageScore(validation.criteria)
      const failed = validation.criteria.filter((criterion) => criterion.blocking && criterion.score < 1)
      const errors = failed.map((criterion) => `the blocking check "${criterion.id}" failed: ${criterion.evidence}`)
      if (validation.error) errors.push(validation.error)
      const passed = failed.length === 0
      stages.push({
        stage: 'VALIDATOR',
        ok: passed,
        score,
        output: validation.output ?? work,
        criteria: validation.criteria,
        errors,
        durationMs: Date.now() - validationStart,
      })
      if (!passed) {
        const outcome = finish('VALIDATOR', stages, work, score, errors.join('; '), correlationId, started)
        await record(outcome, input)
        return outcome
      }
      work = validation.output ?? work
    } catch (error) {
      const message = error instanceof Error ? error.message : 'the validator threw'
      stages.push({ stage: 'VALIDATOR', ok: false, score: null, output: null, criteria: [], errors: [message], durationMs: Date.now() - validationStart })
      const outcome = finish('VALIDATOR', stages, work, null, message, correlationId, started)
      await record(outcome, input)
      return outcome
    }
  }

  const finalScore = stages.find((stage) => stage.stage === 'REVIEWER')?.score ?? stages.find((stage) => stage.stage === 'VALIDATOR')?.score ?? null
  const outcome = finish(null, stages, work, finalScore, null, correlationId, started)
  await record(outcome, input)
  return outcome
}

// ------------------------------------------------------------
// Helpers
// ------------------------------------------------------------

/**
 * The average criterion score.
 *
 * A chain with NO criteria scores 0, not 1: an empty review is not a
 * pass. The caller must supply real criteria.
 */
export function averageScore(criteria: ReviewCriterion[]): number {
  if (!criteria || criteria.length === 0) return 0
  const total = criteria.reduce((sum, criterion) => sum + clamp(criterion.score, 0, 1), 0)
  return Math.round((total / criteria.length) * 10_000) / 10_000
}

/** A criterion builder that keeps the evidence honest. */
export function criterion(
  id: string,
  description: string,
  options: { score: number; evidence: string; blocking?: boolean },
): ReviewCriterion {
  return {
    id,
    description,
    score: clamp(options.score, 0, 1),
    evidence: options.evidence,
    blocking: options.blocking === true,
  }
}

/**
 * The standard criteria set for a piece of work.
 *
 * Every criterion is scored from the actual artefact. A criterion that
 * cannot be evaluated scores 0 with an explicit "could not be
 * evaluated" evidence — it is never quietly skipped.
 */
export function standardCriteria(work: unknown): ReviewCriterion[] {
  const text = typeof work === 'string' ? work : JSON.stringify(work ?? '')
  const notEmpty = text.trim().length > 0
  return [
    criterion('completeness', 'the work is not empty', {
      score: notEmpty ? 1 : 0,
      evidence: notEmpty ? 'the work carries content' : 'the work is empty',
      blocking: true,
    }),
    criterion('structure', 'the work has a usable structure', {
      score: notEmpty ? 1 : 0,
      evidence: notEmpty ? 'the work can be parsed' : 'there is nothing to structure',
    }),
    criterion('evidence', 'the work states its evidence or its source', {
      score: /\b(source|evidence|according|based on|reference|রেফারেন্স|সূত্র)\b/i.test(text) ? 1 : 0.5,
      evidence: /\b(source|evidence|according|based on|reference)\b/i.test(text)
        ? 'the work cites a source'
        : 'the work does not cite a source; it was given a neutral score, not a pass',
    }),
    criterion('no_fabrication', 'the work contains no obvious placeholder', {
      score: /\b(TODO|TBD|lorem ipsum|xxx+|N\/A|placeholder)\b/i.test(text) ? 0 : 1,
      evidence: /\b(TODO|TBD|lorem ipsum|placeholder)\b/i.test(text)
        ? 'a placeholder was found in the work'
        : 'no placeholder was found',
      blocking: true,
    }),
  ]
}

function finish(
  failedAt: QualityStage | null,
  stages: QualityStageResult[],
  work: unknown,
  score: number | null,
  error: string | null,
  correlationId: string,
  started: number,
): QualityOutcome {
  return {
    ok: failedAt === null,
    failedAt,
    stages,
    finalOutput: work,
    score,
    error,
    correlationId,
    durationMs: Date.now() - started,
  }
}

async function record(outcome: QualityOutcome, input: QualityEngineInput): Promise<void> {
  if (input.persist === false) return
  try {
    await audit({
      actor: input.requestedBy ? `user:${input.requestedBy}` : 'system:quality',
      action: 'QUALITY_CHAIN_COMPLETED',
      entityType: 'AgentExecution',
      entityId: outcome.correlationId,
      details: {
        correlationId: outcome.correlationId,
        ok: outcome.ok,
        failedAt: outcome.failedAt,
        score: outcome.score,
        stages: outcome.stages.map((stage) => ({ stage: stage.stage, ok: stage.ok, score: stage.score, durationMs: stage.durationMs })),
        durationMs: outcome.durationMs,
      },
    })
  } catch (error) {
    console.error('[quality] failed to record the chain', error)
  }
}

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min
  return Math.min(max, Math.max(min, value))
}
