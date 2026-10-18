// ============================================================
// TECH360 — evaluation harness
// ============================================================
// Runs a benchmark dataset against a responder and produces a report.
//
// The responder is INJECTED. That keeps the harness testable without a
// model server, and it keeps the real runner and the test runner on the
// SAME scoring code — a metric can never be "different in production".
//
// The harness never records a benchmark result for a model that did not
// actually answer. A provider error is reported as an error, not as a
// wrong answer.
// ============================================================

import { scoreAnswer, type EvalOutcome } from './metrics'
import { summariseDataset, validateDataset, type EvalCategory, type EvalDataset, type EvalQuestion } from './dataset'

export type Responder = (question: EvalQuestion) => Promise<{
  answer: string
  durationMs: number
  firstTokenMs: number | null
  tokensGenerated: number | null
  provider: string | null
  model: string | null
}>

export type EvalReport = {
  datasetId: string
  datasetVersion: string
  ranAt: string
  provider: string | null
  model: string | null
  total: number
  passed: number
  failed: number
  errors: number
  overallScore: number
  byCategory: Record<string, { total: number; passed: number; score: number }>
  byLanguage: Record<string, { total: number; passed: number; score: number }>
  latency: {
    meanMs: number
    p50Ms: number
    p95Ms: number
    maxMs: number
    meanFirstTokenMs: number | null
    tokensPerSecond: number | null
  }
  outcomes: EvalOutcome[]
  notes: string[]
}

export type RunOptions = {
  responder: Responder
  /** Only run questions in these categories. */
  categories?: EvalCategory[]
  /** Stop after this many questions. */
  limit?: number
  /** Report progress. */
  onProgress?: (done: number, total: number) => void
}

export async function runEvaluation(dataset: EvalDataset, options: RunOptions): Promise<EvalReport> {
  const issues = validateDataset(dataset)
  const notes: string[] = []
  if (issues.length > 0) {
    notes.push(`dataset validation reported ${issues.length} issue(s): ${issues.slice(0, 3).join('; ')}`)
  }

  let questions = dataset.questions
  if (options.categories?.length) {
    questions = questions.filter((question) => options.categories!.includes(question.category))
  }
  if (options.limit && options.limit > 0) questions = questions.slice(0, options.limit)

  const outcomes: EvalOutcome[] = []
  const errors: Array<{ questionId: string; error: string }> = []
  let provider: string | null = null
  let model: string | null = null

  for (let index = 0; index < questions.length; index += 1) {
    const question = questions[index]
    try {
      const response = await options.responder(question)
      provider = response.provider ?? provider
      model = response.model ?? model
      const outcome = scoreAnswer(question, response.answer, {
        evidence: question.evidence,
        provider: response.provider,
        model: response.model,
      })
      outcome.durationMs = response.durationMs
      outcome.firstTokenMs = response.firstTokenMs
      outcome.tokensGenerated = response.tokensGenerated
      outcomes.push(outcome)
    } catch (error) {
      errors.push({
        questionId: question.id,
        error: error instanceof Error ? error.message : 'unknown error',
      })
    }
    options.onProgress?.(index + 1, questions.length)
  }

  const passed = outcomes.filter((outcome) => outcome.ok).length
  const totalChecks = outcomes.reduce((sum, outcome) => sum + Object.keys(outcome.checks).length, 0)
  const passedChecks = outcomes.reduce(
    (sum, outcome) => sum + Object.values(outcome.checks).filter(Boolean).length,
    0,
  )

  const byCategory: EvalReport['byCategory'] = {}
  const byLanguage: EvalReport['byLanguage'] = {}
  for (const outcome of outcomes) {
    const category = (byCategory[outcome.category] ??= { total: 0, passed: 0, score: 0 })
    category.total += 1
    category.passed += outcome.ok ? 1 : 0
    category.score += outcome.score
    const language = (byLanguage[outcome.language] ??= { total: 0, passed: 0, score: 0 })
    language.total += 1
    language.passed += outcome.ok ? 1 : 0
    language.score += outcome.score
  }
  for (const bucket of Object.values(byCategory)) bucket.score = bucket.total ? bucket.score / bucket.total : 0
  for (const bucket of Object.values(byLanguage)) bucket.score = bucket.total ? bucket.score / bucket.total : 0

  const durations = outcomes.map((outcome) => outcome.durationMs).sort((a, b) => a - b)
  const firstTokens = outcomes
    .map((outcome) => outcome.firstTokenMs)
    .filter((value): value is number => typeof value === 'number')
  const totalTokens = outcomes.reduce((sum, outcome) => sum + (outcome.tokensGenerated ?? 0), 0)
  const totalDuration = durations.reduce((sum, value) => sum + value, 0)

  const percentile = (sorted: number[], p: number): number => {
    if (sorted.length === 0) return 0
    const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1))
    return sorted[index]
  }

  return {
    datasetId: dataset.id,
    datasetVersion: dataset.version,
    ranAt: new Date().toISOString(),
    provider,
    model,
    total: questions.length,
    passed,
    failed: outcomes.length - passed,
    errors: errors.length,
    overallScore: totalChecks ? passedChecks / totalChecks : 0,
    byCategory,
    byLanguage,
    latency: {
      meanMs: durations.length ? Math.round(totalDuration / durations.length) : 0,
      p50Ms: percentile(durations, 50),
      p95Ms: percentile(durations, 95),
      maxMs: durations.length ? durations[durations.length - 1] : 0,
      meanFirstTokenMs: firstTokens.length
        ? Math.round(firstTokens.reduce((sum, value) => sum + value, 0) / firstTokens.length)
        : null,
      tokensPerSecond: totalDuration > 0 ? Math.round((totalTokens / totalDuration) * 1000) : null,
    },
    outcomes,
    notes: [...notes, ...(errors.length ? [`${errors.length} question(s) could not be answered`] : [])],
  }
}

/** Render a report as a compact, human-readable table. */
export function formatReport(report: EvalReport): string {
  const lines: string[] = []
  lines.push(`dataset: ${report.datasetId} v${report.datasetVersion}`)
  lines.push(`provider: ${report.provider ?? 'unknown'}  model: ${report.model ?? 'unknown'}`)
  lines.push(
    `questions: ${report.total}  passed: ${report.passed}  failed: ${report.failed}  errors: ${report.errors}  score: ${(report.overallScore * 100).toFixed(1)}%`,
  )
  lines.push('')
  lines.push('by category:')
  for (const [category, bucket] of Object.entries(report.byCategory)) {
    lines.push(
      `  ${category.padEnd(18)} ${String(bucket.passed).padStart(3)}/${String(bucket.total).padEnd(3)}  ${(bucket.score * 100).toFixed(1)}%`,
    )
  }
  lines.push('')
  lines.push('by language:')
  for (const [language, bucket] of Object.entries(report.byLanguage)) {
    lines.push(
      `  ${language.padEnd(18)} ${String(bucket.passed).padStart(3)}/${String(bucket.total).padEnd(3)}  ${(bucket.score * 100).toFixed(1)}%`,
    )
  }
  lines.push('')
  lines.push(
    `latency: mean ${report.latency.meanMs}ms  p50 ${report.latency.p50Ms}ms  p95 ${report.latency.p95Ms}ms  first-token ${report.latency.meanFirstTokenMs ?? 'n/a'}ms  ${report.latency.tokensPerSecond ?? 'n/a'} tok/s`,
  )
  const failures = report.outcomes.filter((outcome) => !outcome.ok).slice(0, 10)
  if (failures.length > 0) {
    lines.push('')
    lines.push('sample failures:')
    for (const failure of failures) {
      lines.push(`  ${failure.questionId} [${failure.category}] — ${failure.notes.join('; ')}`)
    }
  }
  return lines.join('\n')
}

export { summariseDataset }
