/** A client decision must be explicit. Missing or unknown input never means approval. */
export const SCOPE_DECISIONS = ['APPROVED', 'REVISION_REQUESTED', 'CLARIFICATION_REQUESTED'] as const
export const PREVIEW_DECISIONS = ['APPROVED', 'REVISION_REQUESTED'] as const
export type ScopeDecision = (typeof SCOPE_DECISIONS)[number]
export type PreviewDecision = (typeof PREVIEW_DECISIONS)[number]

export function parseScopeDecision(input: unknown): ScopeDecision | null {
  if (typeof input !== 'string') return null
  const decision = input.trim().toUpperCase()
  return SCOPE_DECISIONS.includes(decision as ScopeDecision) ? decision as ScopeDecision : null
}
export function parsePreviewDecision(input: unknown): PreviewDecision | null {
  const decision = parseScopeDecision(input)
  return decision && decision !== 'CLARIFICATION_REQUESTED' ? decision : null
}
