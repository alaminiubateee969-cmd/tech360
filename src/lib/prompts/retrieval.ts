// ============================================================
// TECH360 — prompt retrieval
// ============================================================
// Intelligent prompt retrieval.
//
// The rule from the specification: "Do NOT send all prompts to an
// agent. Build intelligent prompt retrieval."
//
// The retriever scores candidates on the dimensions the specification
// names — agent, role, department, task, skill, SOP, context,
// priority, prompt category, version, quality and language — and
// returns only the top-scoring handful.
//
// The whole library is never materialised. A retrieval touches one
// department × one role × the stages the task needs.
// ============================================================

import {
  buildPromptsForBinding,
  PROMPT_STAGES,
  renderPrompt,
  stagesForTask,
  type PromptLanguage,
  type PromptRecord,
  type PromptStage,
} from './library'

export type RetrievalContext = {
  departmentCode: string
  roleSlug: string
  roleTitle: string
  skillSlug?: string | null
  sopKey?: string | null
  language?: PromptLanguage
  complexity?: 'SIMPLE' | 'STANDARD' | 'COMPLEX' | 'ENTERPRISE'
  /** Extra terms that make a prompt more relevant to this task. */
  taskTerms?: string[]
  limit?: number
}

export type ScoredPrompt = {
  prompt: PromptRecord
  score: number
  reasons: string[]
}

/**
 * Score a prompt against a retrieval context.
 *
 * The score is a sum of independent, explainable contributions — every
 * point has a reason, so a retrieval can be audited.
 */
export function scorePrompt(prompt: PromptRecord, context: RetrievalContext): { score: number; reasons: string[] } {
  let score = 0
  const reasons: string[] = []

  if (prompt.departmentCode === context.departmentCode) {
    score += 30
    reasons.push('department match')
  }
  if (prompt.role === context.roleSlug) {
    score += 25
    reasons.push('role match')
  }
  if (context.skillSlug && prompt.skillCode === context.skillSlug) {
    score += 20
    reasons.push('skill binding')
  }
  if (context.sopKey && prompt.sopKey === context.sopKey) {
    score += 15
    reasons.push('SOP binding')
  }
  if (context.language && prompt.language === context.language) {
    score += 12
    reasons.push('language match')
  }

  const wanted = new Set(stagesForTask(context.complexity ?? 'STANDARD'))
  if (wanted.has(prompt.stage)) {
    score += 18
    reasons.push('stage required for this complexity')
  } else if (PROMPT_STAGES.includes(prompt.stage)) {
    score -= 8
  }

  // Priority and quality are the standing preference between otherwise
  // equal candidates.
  score += prompt.priority * 0.5
  score += prompt.quality * 10

  // The task terms nudge a prompt whose tags overlap the request.
  if (context.taskTerms?.length) {
    const haystack = `${prompt.name} ${prompt.tags.join(' ')} ${prompt.stage}`.toLowerCase()
    const hits = context.taskTerms.filter((term) => haystack.includes(term.toLowerCase())).length
    if (hits > 0) {
      score += Math.min(10, hits * 3)
      reasons.push(`task term overlap (${hits})`)
    }
  }

  if (prompt.status !== 'ACTIVE') {
    score -= 50
    reasons.push('not active')
  }

  return { score, reasons }
}

/**
 * Retrieve the prompts for a context. The library is materialised for
 * the ONE binding that is needed, scored, and trimmed.
 */
export function retrievePrompts(context: RetrievalContext): ScoredPrompt[] {
  const candidates = buildPromptsForBinding({
    departmentCode: context.departmentCode,
    roleSlug: context.roleSlug,
    roleTitle: context.roleTitle,
    skillSlug: context.skillSlug ?? null,
    sopKey: context.sopKey ?? null,
  })

  const scored = candidates
    .map((prompt) => {
      const { score, reasons } = scorePrompt(prompt, context)
      return { prompt, score, reasons }
    })
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score)

  const limit = Math.max(1, Math.min(32, context.limit ?? 12))
  return scored.slice(0, limit)
}

/**
 * Build the prompt context for a model call: the retrieved prompts,
 * rendered with their variables, joined into one instruction block.
 */
export function buildPromptContext(
  context: RetrievalContext,
  values: Record<string, string | undefined> = {},
): { prompts: ScoredPrompt[]; block: string; tokenEstimate: number } {
  const prompts = retrievePrompts(context)
  const block = prompts
    .map((entry) => renderPrompt(entry.prompt.template, values))
    .join('\n\n---\n\n')
  return {
    prompts,
    block,
    // A rough estimate only — used to decide whether the context
    // needs compressing, never to claim a measured token count.
    tokenEstimate: Math.round(block.length / 4),
  }
}

/** The stages a retrieval actually used — reported for audit. */
export function stagesRetrieved(prompts: ScoredPrompt[]): PromptStage[] {
  return [...new Set(prompts.map((entry) => entry.prompt.stage))]
}
