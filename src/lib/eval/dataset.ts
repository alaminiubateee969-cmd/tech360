// ============================================================
// TECH360 — evaluation dataset contract
// ============================================================
// A benchmark question is a PROMPT plus the expectations that make it
// scoreable. It is deliberately not a list of "right answers" only:
// the categories that matter most for a private, company-owned model
// are the ones where a wrong answer is worse than no answer.
//
// CATEGORIES
//   GROUNDING_EN     — answer only from the supplied evidence
//   GROUNDING_BN     — the same, in Bangla
//   MISSING_EVIDENCE — the evidence does NOT contain the answer; the
//                      model must abstain rather than invent
//   JSON_STRUCTURE   — the reply must be valid JSON of a given shape
//   TOOL_SELECTION   — the reply must select one specific tool
//   INJECTION        — the prompt contains an injected instruction; the
//                      model must not follow it
//   NOISE            — irrelevant context; the model must not be
//                      distracted
// ============================================================

export type EvalCategory =
  | 'GROUNDING_EN'
  | 'GROUNDING_BN'
  | 'MISSING_EVIDENCE'
  | 'JSON_STRUCTURE'
  | 'TOOL_SELECTION'
  | 'INJECTION'
  | 'NOISE'

export type EvalExpectation = {
  /** The answer must be supported by the evidence. */
  mustCite: boolean
  /** The answer must refuse to answer. */
  mustAbstain: boolean
  /** The answer must be valid JSON. */
  validJson: boolean
  /** The JSON must contain these keys. */
  requiredJsonKeys: string[]
  /** The model must select this tool. */
  expectedTool: string | null
  /** Tools the model must NOT select. */
  forbiddenTools: string[]
  /** Terms that must appear in the answer. */
  requiredTerms: string[]
  /** Terms that must NOT appear. */
  forbiddenTerms: string[]
  /** The model must refuse to do this at all. */
  mustRefuse: boolean
}

export type EvalQuestion = {
  id: string
  category: EvalCategory
  language: 'en' | 'bn'
  prompt: string
  /** The evidence the model is allowed to use. */
  evidence: string[]
  /** The tools the model may choose from, when the category needs it. */
  tools?: Array<{ name: string; description: string }>
  expectation: EvalExpectation
}

export type EvalDataset = {
  id: string
  version: string
  createdAt: string
  notes: string
  questions: EvalQuestion[]
}

export const EXPECTED_BENCHMARK_SIZE = 200

export function summariseDataset(dataset: EvalDataset): Record<string, number> {
  const counts: Record<string, number> = {}
  for (const question of dataset.questions) {
    counts[question.category] = (counts[question.category] ?? 0) + 1
  }
  counts.TOTAL = dataset.questions.length
  return counts
}

/**
 * Validate a dataset. A benchmark with malformed questions is worse
 * than no benchmark, because it produces a confident wrong number.
 */
export function validateDataset(dataset: EvalDataset): string[] {
  const issues: string[] = []
  if (!dataset.id) issues.push('the dataset needs an id')
  if (!dataset.version) issues.push('the dataset needs a version')
  if (!Array.isArray(dataset.questions)) {
    issues.push('questions must be an array')
    return issues
  }
  if (dataset.questions.length < EXPECTED_BENCHMARK_SIZE) {
    issues.push(`the dataset must contain at least ${EXPECTED_BENCHMARK_SIZE} questions, found ${dataset.questions.length}`)
  }
  const ids = new Set<string>()
  for (const question of dataset.questions) {
    if (!question.id) {
      issues.push('a question is missing its id')
      continue
    }
    if (ids.has(question.id)) issues.push(`duplicate question id "${question.id}"`)
    ids.add(question.id)
    if (!question.prompt || question.prompt.trim().length < 5) {
      issues.push(`question "${question.id}" has no usable prompt`)
    }
    if (!Array.isArray(question.evidence)) {
      issues.push(`question "${question.id}" has no evidence array`)
    }
    if (question.category === 'TOOL_SELECTION' && !question.expectation.expectedTool) {
      issues.push(`question "${question.id}" is a tool-selection question with no expected tool`)
    }
    if (question.category === 'INJECTION' && !question.expectation.mustRefuse) {
      issues.push(`injection question "${question.id}" does not require a refusal`)
    }
  }
  return issues
}
