// ============================================================
// TECH360 — learning engine
// ============================================================
// observation → pattern → hypothesis → validation → approval →
// integration → knowledge update
//
// THE BOUNDARY
// ------------
// The learning engine may improve SKILLS, KNOWLEDGE, PROCEDURES,
// BEHAVIOUR and ROUTING.
//
// It may NEVER override:
//   · the constitution
//   · a security control
//   · a permission
//   · a governance rule
//   · a human approval
//
// Every proposed change names the artefact it would change, and a
// change to a governed artefact is REFUSED by construction: the
// integration step refuses to touch anything on the protected list.
// A proposal may only be INTEGRATED after an explicit approval, and
// an approval is a human act recorded in the audit trail.
// ============================================================

import { newCorrelationId } from '@/lib/correlation'
import { audit } from '@/lib/security'
import { writeMemory, type MemoryScope } from '@/lib/memory/system'

// ------------------------------------------------------------
// Types
// ------------------------------------------------------------

export type LearningStage =
  | 'OBSERVATION'
  | 'PATTERN'
  | 'HYPOTHESIS'
  | 'VALIDATION'
  | 'APPROVAL'
  | 'INTEGRATION'
  | 'KNOWLEDGE_UPDATE'

export type LearningArtefact = 'SKILL' | 'KNOWLEDGE' | 'PROCEDURE' | 'BEHAVIOUR' | 'ROUTING' | 'MEMORY'

export type LearningProposal = {
  id: string
  stage: LearningStage
  artefact: LearningArtefact
  /** The artefact this would change, e.g. a skill id. */
  target: string
  /** What was observed. */
  observation: string
  /** The pattern that was found in the observations. */
  pattern: string
  /** The change that is proposed. */
  hypothesis: string
  /** The evidence that supports it. */
  evidence: string[]
  /** The measured effect, once validated. */
  measuredEffect: number | null
  /** The status of the proposal. */
  status: 'PROPOSED' | 'VALIDATING' | 'VALIDATED' | 'AWAITING_APPROVAL' | 'APPROVED' | 'REJECTED' | 'INTEGRATED' | 'REFUSED'
  /** Who approved it. Empty until a human approves. */
  approvedBy: string | null
  /** Why it was refused. */
  refusalReason: string | null
  createdAt: Date
  updatedAt: Date
  correlationId: string
}

// ------------------------------------------------------------
// The protected list
// ------------------------------------------------------------

/**
 * The artefacts the learning engine may never change on its own.
 *
 * A proposal that targets one of these is refused at the integration
 * step, even when every earlier stage passed. This is the mechanism
 * that makes "the learning engine is bounded" a property of the code
 * rather than a promise in a document.
 */
export const PROTECTED_TARGETS: Array<{ pattern: RegExp; reason: string }> = [
  { pattern: /^constitution/i, reason: 'the constitution is not machine-learnable' },
  { pattern: /^policy:/i, reason: 'a governance rule is changed by a human, not by a model' },
  { pattern: /^security:/i, reason: 'a security control is changed by a human, not by a model' },
  { pattern: /^permission:/i, reason: 'a permission is granted by a human, not by a model' },
  { pattern: /^approval/i, reason: 'an approval decision is a human act' },
  { pattern: /^rbac/i, reason: 'an access-control rule is changed by a human' },
]

export function isProtectedTarget(target: string): { protected: boolean; reason: string | null } {
  for (const rule of PROTECTED_TARGETS) {
    if (rule.pattern.test(target)) return { protected: true, reason: rule.reason }
  }
  return { protected: false, reason: null }
}

// ------------------------------------------------------------
// The stages
// ------------------------------------------------------------

/** Stage 1 — record what happened. */
export function observe(input: {
  observation: string
  artefact: LearningArtefact
  target: string
  evidence: string[]
}): LearningProposal {
  return {
    id: `LP-${newCorrelationId().slice(0, 12)}`,
    stage: 'OBSERVATION',
    artefact: input.artefact,
    target: input.target,
    observation: input.observation,
    pattern: '',
    hypothesis: '',
    evidence: input.evidence,
    measuredEffect: null,
    status: 'PROPOSED',
    approvedBy: null,
    refusalReason: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    correlationId: newCorrelationId(),
  }
}

/**
 * Stage 2 — find a pattern in the observations.
 *
 * The pattern must appear in at least `minimumObservations` separate
 * observations. One bad run is an incident, not a pattern.
 */
export function findPattern(
  observations: Array<{ target: string; observation: string; evidence: string[] }>,
  options: { minimumObservations?: number } = {},
): { pattern: string; evidence: string[]; sufficient: boolean } {
  const minimum = options.minimumObservations ?? 3
  const byTarget = new Map<string, typeof observations>()
  for (const observation of observations) {
    const list = byTarget.get(observation.target) ?? []
    list.push(observation)
    byTarget.set(observation.target, list)
  }
  let best: { pattern: string; evidence: string[]; sufficient: boolean } = {
    pattern: '',
    evidence: [],
    sufficient: false,
  }
  for (const [target, list] of byTarget) {
    if (list.length < minimum) continue
    const evidence = list.flatMap((entry) => entry.evidence)
    best = {
      pattern: `${list.length} observations of "${target}" share a recurring cause: ${list[0].observation}`,
      evidence,
      sufficient: true,
    }
    break
  }
  if (!best.sufficient) {
    best = {
      pattern: `no pattern reached the ${minimum}-observation threshold`,
      evidence: observations.flatMap((entry) => entry.evidence).slice(0, 20),
      sufficient: false,
    }
  }
  return best
}

/** Stage 3 — state the hypothesis and the change it implies. */
export function hypothesise(
  proposal: LearningProposal,
  pattern: { pattern: string; evidence: string[]; sufficient: boolean },
  change: string,
): LearningProposal {
  return {
    ...proposal,
    stage: 'HYPOTHESIS',
    pattern: pattern.pattern,
    hypothesis: change,
    evidence: pattern.evidence,
    status: pattern.sufficient ? 'VALIDATING' : 'REJECTED',
    refusalReason: pattern.sufficient ? null : 'the pattern did not reach the observation threshold',
    updatedAt: new Date(),
  }
}

/**
 * Stage 4 — validate the hypothesis.
 *
 * A hypothesis is validated only when the measured effect clears the
 * threshold. A negative or an unmeasured effect is NOT a validation.
 */
export function validateHypothesis(
  proposal: LearningProposal,
  measuredEffect: number | null,
  options: { threshold?: number } = {},
): LearningProposal {
  const threshold = options.threshold ?? 0.05
  if (measuredEffect === null) {
    return {
      ...proposal,
      stage: 'VALIDATION',
      status: 'REJECTED',
      measuredEffect: null,
      refusalReason: 'the effect was never measured, so the hypothesis is unvalidated',
      updatedAt: new Date(),
    }
  }
  const passed = measuredEffect >= threshold
  return {
    ...proposal,
    stage: 'VALIDATION',
    measuredEffect,
    status: passed ? 'AWAITING_APPROVAL' : 'REJECTED',
    refusalReason: passed ? null : `the measured effect ${measuredEffect} is below the ${threshold} threshold`,
    updatedAt: new Date(),
  }
}

/** Stage 5 — a human approves. Nobody else may. */
export function approveProposal(proposal: LearningProposal, approvedBy: string, approved: boolean, reason?: string): LearningProposal {
  if (!approvedBy) {
    return {
      ...proposal,
      status: 'REJECTED',
      refusalReason: 'an approval must name the human who gave it',
      updatedAt: new Date(),
    }
  }
  return {
    ...proposal,
    stage: 'APPROVAL',
    status: approved ? 'APPROVED' : 'REJECTED',
    approvedBy: approved ? approvedBy : null,
    refusalReason: approved ? null : reason ?? 'a human rejected the proposal',
    updatedAt: new Date(),
  }
}

/**
 * Stage 6 — integrate the change.
 *
 * A proposal that targets a protected artefact is REFUSED here, even
 * when it was approved. The check is not a formality: it is the
 * difference between a bounded learning engine and an uncontrolled
 * one.
 */
export async function integrateProposal(
  proposal: LearningProposal,
  apply: (proposal: LearningProposal) => Promise<void>,
): Promise<{ integrated: boolean; proposal: LearningProposal; error: string | null }> {
  if (proposal.status !== 'APPROVED') {
    return { integrated: false, proposal, error: `the proposal is ${proposal.status}, not APPROVED` }
  }
  const protection = isProtectedTarget(proposal.target)
  if (protection.protected) {
    const refused: LearningProposal = {
      ...proposal,
      stage: 'INTEGRATION',
      status: 'REFUSED',
      refusalReason: protection.reason,
      updatedAt: new Date(),
    }
    return { integrated: false, proposal: refused, error: protection.reason }
  }
  try {
    await apply(proposal)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'the change could not be applied'
    return {
      integrated: false,
      proposal: { ...proposal, stage: 'INTEGRATION', status: 'REJECTED', refusalReason: message, updatedAt: new Date() },
      error: message,
    }
  }
  return { integrated: true, proposal: { ...proposal, stage: 'INTEGRATION', status: 'INTEGRATED', updatedAt: new Date() }, error: null }
}

/**
 * Stage 7 — write the outcome into the knowledge system.
 *
 * The lesson is written to a scope the requester can read, and it is
 * marked as validated only when the proposal was integrated.
 */
export async function updateKnowledge(
  proposal: LearningProposal,
  options: { scope?: MemoryScope; writtenBy?: string } = {},
): Promise<{ written: boolean; error: string | null }> {
  try {
    await writeMemory({
      scope: options.scope ?? 'LESSON',
      key: `learning:${proposal.target}`,
      content: [
        `Hypothesis: ${proposal.hypothesis}`,
        `Pattern: ${proposal.pattern}`,
        `Measured effect: ${proposal.measuredEffect === null ? 'not measured' : proposal.measuredEffect}`,
        `Approved by: ${proposal.approvedBy ?? 'nobody'}`,
      ].join('\n'),
      memoryType: 'PROCEDURAL',
      accessLevel: 'INTERNAL',
      validated: proposal.status === 'INTEGRATED',
      source: 'LEARNING_ENGINE',
      correlationId: proposal.correlationId,
      tags: ['learning', proposal.artefact.toLowerCase(), proposal.target],
      writtenBy: options.writtenBy ?? 'system:learning',
    })
    return { written: true, error: null }
  } catch (error) {
    // A knowledge write that fails is reported, not swallowed. The
    // proposal was still integrated; the lesson simply did not land.
    const message = error instanceof Error ? error.message : 'the knowledge write failed'
    console.error('[learning] the knowledge update failed', error)
    return { written: false, error: message }
  }
}

// ------------------------------------------------------------
// The whole chain
// ------------------------------------------------------------

export type LearningChainInput = {
  observations: Array<{ target: string; observation: string; evidence: string[] }>
  artefact: LearningArtefact
  change: string
  /** The measured effect of the change, once it was tried. */
  measuredEffect: number | null
  /** The human who approved it. Null means it cannot be integrated. */
  approvedBy: string | null
  approved: boolean
  /** The function that applies the change. */
  apply?: (proposal: LearningProposal) => Promise<void>
  minimumObservations?: number
  threshold?: number
  scope?: MemoryScope
}

export type LearningChainResult = {
  proposal: LearningProposal
  integrated: boolean
  knowledgeUpdated: boolean
  stages: LearningStage[]
  error: string | null
}

/**
 * Run the whole learning chain.
 *
 * The chain is a STATE MACHINE, not a sequence of hopeful calls: if a
 * stage refuses, the chain stops and the refusal is recorded.
 */
export async function runLearningChain(input: LearningChainInput): Promise<LearningChainResult> {
  const stages: LearningStage[] = []
  const first = input.observations[0]
  if (!first) {
    return {
      proposal: {
        id: 'LP-none',
        stage: 'OBSERVATION',
        artefact: input.artefact,
        target: '',
        observation: '',
        pattern: '',
        hypothesis: '',
        evidence: [],
        measuredEffect: null,
        status: 'REJECTED',
        approvedBy: null,
        refusalReason: 'there were no observations to learn from',
        createdAt: new Date(),
        updatedAt: new Date(),
        correlationId: newCorrelationId(),
      },
      integrated: false,
      knowledgeUpdated: false,
      stages,
      error: 'there were no observations to learn from',
    }
  }

  let proposal = observe({
    observation: first.observation,
    artefact: input.artefact,
    target: first.target,
    evidence: input.observations.flatMap((entry) => entry.evidence),
  })
  stages.push('OBSERVATION')

  const pattern = findPattern(input.observations, { minimumObservations: input.minimumObservations })
  proposal = hypothesise(proposal, pattern, input.change)
  stages.push('PATTERN', 'HYPOTHESIS')
  if (proposal.status === 'REJECTED') {
    return { proposal, integrated: false, knowledgeUpdated: false, stages, error: proposal.refusalReason }
  }

  proposal = validateHypothesis(proposal, input.measuredEffect, { threshold: input.threshold })
  stages.push('VALIDATION')
  if (proposal.status === 'REJECTED') {
    return { proposal, integrated: false, knowledgeUpdated: false, stages, error: proposal.refusalReason }
  }

  proposal = approveProposal(proposal, input.approvedBy ?? '', input.approved)
  stages.push('APPROVAL')
  if (proposal.status !== 'APPROVED') {
    return { proposal, integrated: false, knowledgeUpdated: false, stages, error: proposal.refusalReason }
  }

  let integrated = false
  if (input.apply) {
    const result = await integrateProposal(proposal, input.apply)
    proposal = result.proposal
    integrated = result.integrated
    stages.push('INTEGRATION')
    if (!integrated) {
      return { proposal, integrated: false, knowledgeUpdated: false, stages, error: result.error }
    }
  } else {
    stages.push('INTEGRATION')
  }

  const knowledge = await updateKnowledge(proposal, { scope: input.scope })
  stages.push('KNOWLEDGE_UPDATE')

  await audit({
    actor: 'system:learning',
    action: 'LEARNING_INTEGRATED',
    entityType: 'LearningProposal',
    entityId: proposal.id,
    details: {
      correlationId: proposal.correlationId,
      artefact: proposal.artefact,
      target: proposal.target,
      measuredEffect: proposal.measuredEffect,
      approvedBy: proposal.approvedBy,
    },
  })

  return { proposal, integrated: true, knowledgeUpdated: knowledge.written, stages, error: knowledge.error }
}
