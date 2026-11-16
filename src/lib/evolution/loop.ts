/**
 * TECH360 — Evolution Loop: observe → propose
 * ============================================
 * The half of "the AI edits its own code and evolves" that is actually
 * defensible. Nothing here is magic and nothing here is autonomous:
 *
 *   OBSERVE  Read what happened. Real signals only — a teardown whose findings
 *            an operator corrected, a skill run that failed, a capture that was
 *            refused, a fingerprint that produced a false positive.
 *   PROPOSE  Turn those signals into a bounded, validated, reversible patch on
 *            a governed surface, with the evidence that motivated it attached.
 *   GATE     The proposal becomes an ApprovalRequest. It changes nothing until a
 *            different human approves it.
 *
 * There is no APPLY in this module. Applying is the API's job, behind the gate,
 * and it re-validates before writing.
 *
 * Why proposals are generated deterministically rather than by a model call:
 * an evolution loop driven by unreviewed model output would produce a different
 * mutation every run for the same evidence, which makes the lineage impossible
 * to audit. Here the same observations always produce the same proposals, so a
 * reviewer can read the lineage and know exactly why each change was suggested.
 * A model may later be allowed to DRAFT proposal rationale text; it may never
 * decide the patch.
 */
import {
  classifyRisk,
  validatePatch,
  type EvolutionPatch,
  type EvolutionSurface,
  type PatchOp,
  type ProposalRisk,
  type RiskLevel,
} from './policy'

export type ObservationKind =
  | 'TEARDOWN_CORRECTED' // an operator overrode a finding
  | 'FINGERPRINT_FALSE_POSITIVE' // a detection was wrong
  | 'FINGERPRINT_FALSE_NEGATIVE' // something obvious was missed
  | 'CAPTURE_REFUSED' // admission refused a target
  | 'CAPTURE_FAILED' // network/HTTP failure
  | 'SKILL_RUN_FAILED'
  | 'SKILL_RUN_SLOW'
  | 'RECONSTRUCTION_REJECTED' // an operator discarded a rebuild brief
  | 'OPERATOR_FEEDBACK'
  | 'GUARD_ATTEMPT' // the loop tried to touch an immutable control

export type Observation = {
  kind: ObservationKind
  /** What was seen, in one sentence. */
  detail: string
  /** Stable reference to the run, target or skill involved. */
  ref: string
  /** Which surface this observation could legitimately improve. */
  surface?: EvolutionSurface
  /** The value that was wrong, when known. */
  subject?: string
  /** How many times this has been seen — repeat evidence weights a proposal. */
  count: number
  at: string
}

export type EvolutionProposal = {
  id: string
  title: string
  rationale: string
  surface: EvolutionSurface
  targetKey: string
  patch: EvolutionPatch
  risk: ProposalRisk
  /** The observations that motivated it. A proposal with none is refused. */
  evidence: Array<{ kind: ObservationKind; detail: string; ref: string }>
  /** What happens if this is applied, in one line. */
  effect: string
  /** How to undo it. */
  rollback: string
  generation: number
  createdAt: string
}

export type ProposeResult = {
  proposals: EvolutionProposal[]
  /** Observations that produced no proposal, and why. */
  declined: Array<{ observation: string; reason: string }>
  /** Attempts to evolve a control — recorded, never silently dropped. */
  refused: Array<{ observation: string; reason: string }>
}

/**
 * The heuristics document that REA_HEURISTIC patches act on. Stored as a
 * Setting row so it is data, versioned and reversible. Defaults reproduce the
 * values compiled into the analysis engine — the loop may tune them within
 * bounds, and the bound ceiling (0.95) is below certainty by design.
 */
export const DEFAULT_HEURISTICS = {
  version: 1,
  renderModel: { spaShellWordThreshold: 120, ssrWordThreshold: 400 },
  fingerprint: { minConfidenceToReport: 0.4, inferredConfidenceCap: 0.6 },
  routes: { maxCandidates: 120, bundleLiteralConfidence: 0.35 },
  endpoints: { maxCandidates: 80, literalConfidence: 0.4, callSiteConfidence: 0.45 },
  teardown: { spokenMaxChars: 3800, maxObservationsPerSection: 40 },
  reconstruction: { baseConfidence: 0.25, confidenceCeiling: 0.85 },
} as const

export type Heuristics = typeof DEFAULT_HEURISTICS

export function nextGeneration(current: number): number {
  return Number.isFinite(current) && current >= 0 ? Math.floor(current) + 1 : 1
}

/**
 * Turns observations into proposals. Deterministic: the same observation list
 * always yields the same proposals in the same order.
 */
export function proposeMutations(input: {
  observations: Observation[]
  heuristics?: Heuristics
  generation: number
  now?: string
}): ProposeResult {
  const observations = input.observations ?? []
  const heuristics = input.heuristics ?? (DEFAULT_HEURISTICS as unknown as Heuristics)
  const now = input.now ?? new Date().toISOString()
  const proposals: EvolutionProposal[] = []
  const declined: ProposeResult['declined'] = []
  const refused: ProposeResult['refused'] = []

  const grouped = new Map<string, Observation[]>()
  for (const o of observations) {
    const key = `${o.kind}:${o.subject ?? o.ref}`
    grouped.set(key, [...(grouped.get(key) ?? []), o])
  }

  let seq = 0
  const push = (draft: Omit<EvolutionProposal, 'id' | 'generation' | 'createdAt'>) => {
    seq += 1
    const validation = validatePatch(draft.patch)
    if (!validation.ok) {
      declined.push({ observation: draft.title, reason: `Patch refused at proposal time: ${validation.code} — ${validation.reason}` })
      return
    }
    if (draft.evidence.length === 0) {
      declined.push({ observation: draft.title, reason: 'A proposal with no supporting observation is refused. Evolution must be evidence-driven, not mood-driven.' })
      return
    }
    proposals.push({
      ...draft,
      id: `evo_${now.replace(/[-:TZ.]/g, '').slice(0, 14)}_${String(seq).padStart(3, '0')}`,
      generation: input.generation,
      createdAt: now,
    })
  }

  for (const [key, items] of grouped) {
    const first = items[0]
    const totalCount = items.reduce((t, i) => t + Math.max(1, i.count), 0)
    const evidence = items.slice(0, 6).map((i) => ({ kind: i.kind, detail: i.detail.slice(0, 300), ref: i.ref }))

    // A guard attempt is never a proposal. It is recorded as a refusal so the
    // attempt itself is visible in the lineage.
    if (first.kind === 'GUARD_ATTEMPT') {
      refused.push({ observation: first.detail, reason: 'The loop attempted to reach an immutable control. Recorded, not proposed.' })
      continue
    }

    if (first.kind === 'FINGERPRINT_FALSE_POSITIVE' && first.subject) {
      // Raise the reporting floor so weak signals stop being reported as fact.
      const current = heuristics.fingerprint.minConfidenceToReport
      const proposed = Math.min(0.95, Number((current + Math.min(0.1, 0.02 * totalCount)).toFixed(3)))
      if (proposed === current) { declined.push({ observation: key, reason: 'Reporting floor is already at its ceiling; no further tightening is possible.' }); continue }
      push({
        title: `Raise fingerprint reporting floor after false positive on "${first.subject}"`,
        rationale: `"${first.subject}" was reported but wrong, ${totalCount} time(s). Raising the minimum confidence for reporting a fingerprint means weaker signals are held back instead of being stated as findings.`,
        surface: 'REA_HEURISTIC',
        targetKey: 'rea.heuristics',
        patch: {
          surface: 'REA_HEURISTIC',
          targetKey: 'rea.heuristics',
          ops: [{ op: 'set', path: 'fingerprint.minConfidenceToReport', value: proposed }] satisfies PatchOp[],
          before: { 'fingerprint.minConfidenceToReport': current },
          after: { 'fingerprint.minConfidenceToReport': proposed },
        },
        risk: classifyRisk({ surface: 'REA_HEURISTIC', ops: [{ op: 'set', path: 'fingerprint.minConfidenceToReport', value: proposed }] }),
        evidence,
        effect: `Fingerprints below confidence ${proposed} will no longer appear in a teardown. Fewer claims, each better supported.`,
        rollback: `Restore fingerprint.minConfidenceToReport to ${current} (one call; the before-snapshot is stored on the proposal).`,
      })
      continue
    }

    if (first.kind === 'FINGERPRINT_FALSE_NEGATIVE' && first.subject) {
      const current = heuristics.fingerprint.minConfidenceToReport
      const proposed = Math.max(0, Number((current - Math.min(0.1, 0.02 * totalCount)).toFixed(3)))
      if (proposed === current) { declined.push({ observation: key, reason: 'Reporting floor is already at 0; it cannot be lowered further.' }); continue }
      push({
        title: `Lower fingerprint reporting floor after missed "${first.subject}"`,
        rationale: `"${first.subject}" was present but not reported, ${totalCount} time(s). Lowering the floor lets weaker-but-real signals through. This trades precision for recall, and the reviewer should decide whether that trade is worth it.`,
        surface: 'REA_HEURISTIC',
        targetKey: 'rea.heuristics',
        patch: {
          surface: 'REA_HEURISTIC',
          targetKey: 'rea.heuristics',
          ops: [{ op: 'set', path: 'fingerprint.minConfidenceToReport', value: proposed }],
          before: { 'fingerprint.minConfidenceToReport': current },
          after: { 'fingerprint.minConfidenceToReport': proposed },
        },
        risk: classifyRisk({ surface: 'REA_HEURISTIC', ops: [{ op: 'set', path: 'fingerprint.minConfidenceToReport', value: proposed }] }),
        evidence,
        effect: `More fingerprints will be reported, including weaker ones. Expect more INFERRED items in teardowns.`,
        rollback: `Restore fingerprint.minConfidenceToReport to ${current}.`,
      })
      continue
    }

    if (first.kind === 'TEARDOWN_CORRECTED') {
      push({
        title: `Tighten render-model classification after ${totalCount} operator correction(s)`,
        rationale: `Operators corrected the teardown ${totalCount} time(s) (${first.detail.slice(0, 140)}). The most common cause is a client-rendered shell being described as if its structure were the product. Raising the word threshold at which a document is treated as substantive makes the caveat fire earlier.`,
        surface: 'REA_HEURISTIC',
        targetKey: 'rea.heuristics',
        patch: {
          surface: 'REA_HEURISTIC',
          targetKey: 'rea.heuristics',
          ops: [{ op: 'delta', path: 'renderModel.spaShellWordThreshold', delta: Math.min(60, 20 * totalCount) }],
          before: { 'renderModel.spaShellWordThreshold': heuristics.renderModel.spaShellWordThreshold },
          after: { 'renderModel.spaShellWordThreshold': heuristics.renderModel.spaShellWordThreshold + Math.min(60, 20 * totalCount) },
        },
        risk: classifyRisk({ surface: 'REA_HEURISTIC', ops: [{ op: 'delta', path: 'renderModel.spaShellWordThreshold', delta: Math.min(60, 20 * totalCount) }] }),
        evidence,
        effect: 'More pages will be reported as client-rendered shells, with the shallow-teardown caveat attached.',
        rollback: `Restore renderModel.spaShellWordThreshold to ${heuristics.renderModel.spaShellWordThreshold}.`,
      })
      continue
    }

    if (first.kind === 'RECONSTRUCTION_REJECTED') {
      push({
        title: `Lower reconstruction confidence ceiling after ${totalCount} rejected rebuild(s)`,
        rationale: `${totalCount} reconstruction brief(s) were discarded. Reporting a lower confidence for derived briefs makes the rebuild look as speculative as it proved to be, which is the honest number.`,
        surface: 'REA_HEURISTIC',
        targetKey: 'rea.heuristics',
        patch: {
          surface: 'REA_HEURISTIC',
          targetKey: 'rea.heuristics',
          ops: [{ op: 'delta', path: 'reconstruction.confidenceCeiling', delta: -Math.min(0.15, 0.05 * totalCount) }],
          before: { 'reconstruction.confidenceCeiling': heuristics.reconstruction.confidenceCeiling },
          after: { 'reconstruction.confidenceCeiling': Math.max(0, heuristics.reconstruction.confidenceCeiling - Math.min(0.15, 0.05 * totalCount)) },
        },
        risk: classifyRisk({ surface: 'REA_HEURISTIC', ops: [{ op: 'delta', path: 'reconstruction.confidenceCeiling', delta: -Math.min(0.15, 0.05 * totalCount) }] }),
        evidence,
        effect: 'Reconstruction briefs report lower confidence, so reviewers weigh them with more scepticism.',
        rollback: `Restore reconstruction.confidenceCeiling to ${heuristics.reconstruction.confidenceCeiling}.`,
      })
      continue
    }

    if (first.kind === 'CAPTURE_REFUSED' || first.kind === 'CAPTURE_FAILED') {
      declined.push({
        observation: key,
        reason:
          first.kind === 'CAPTURE_REFUSED'
            ? 'A refused capture is the target policy working as designed. The loop may not tune an admission rule — that is an immutable control. If the refusal was wrong, a human changes src/lib/rea/target-policy.ts through review.'
            : 'A network failure is an environment outcome, not a behaviour to evolve. It belongs in the ops monitor and the error log.',
      })
      continue
    }

    if (first.kind === 'SKILL_RUN_FAILED' || first.kind === 'SKILL_RUN_SLOW') {
      // Skill runtime tuning lives in the skill's own configuration JSON. Its
      // handler, permissions and input/output schemas are NOT evolvable.
      const path = first.kind === 'SKILL_RUN_SLOW' ? 'timeoutMs' : 'retries'
      const before = first.kind === 'SKILL_RUN_SLOW' ? 30_000 : 2
      const ops: PatchOp[] =
        first.kind === 'SKILL_RUN_SLOW'
          ? [{ op: 'delta', path, delta: 15_000 }]
          : [{ op: 'delta', path, delta: 1 }]
      push({
        title: `${first.kind === 'SKILL_RUN_SLOW' ? 'Raise timeout' : 'Add a retry'} for ${first.subject ?? first.ref} after ${totalCount} failure(s)`,
        rationale: `${first.subject ?? first.ref} ${first.kind === 'SKILL_RUN_SLOW' ? 'timed out' : 'failed'} ${totalCount} time(s): ${first.detail.slice(0, 160)}. This changes the skill's configuration JSON only — never its handler, permissions or input/output schemas.`,
        surface: 'SKILL_CONFIG',
        targetKey: first.subject ?? first.ref,
        patch: {
          surface: 'SKILL_CONFIG',
          targetKey: first.subject ?? first.ref,
          ops,
          before: { [path]: before },
          after: { [path]: first.kind === 'SKILL_RUN_SLOW' ? before + 15_000 : before + 1 },
        },
        risk: classifyRisk({ surface: 'SKILL_CONFIG', ops }),
        evidence,
        effect: first.kind === 'SKILL_RUN_SLOW' ? `Runs get ${before + 15_000}ms instead of ${before}ms before timing out.` : `Runs retry ${before + 1} times instead of ${before}.`,
        rollback: `Restore ${path} to ${before}.`,
      })
      continue
    }

    if (first.kind === 'OPERATOR_FEEDBACK' && first.surface === 'PROMPT_TEMPLATE' && first.subject) {
      push({
        title: `Amend prompt "${first.subject}" from operator feedback`,
        rationale: `${totalCount} operator note(s): ${first.detail.slice(0, 200)}. The amendment is APPENDED as guidance, never a rewrite, so the original wording stays reviewable in the diff.`,
        surface: 'PROMPT_TEMPLATE',
        targetKey: first.subject,
        patch: {
          surface: 'PROMPT_TEMPLATE',
          targetKey: first.subject,
          ops: [{ op: 'append', path: 'template', value: `\n\nOperator guidance (evolution gen ${input.generation}): ${first.detail.slice(0, 400).replace(/\s+/g, ' ')}` }],
          before: { templateNote: 'the full current template is snapshotted at apply time' },
          after: { templateNote: 'the current template plus the appended guidance' },
        },
        risk: classifyRisk({ surface: 'PROMPT_TEMPLATE', ops: [{ op: 'append', path: 'template', value: first.detail }], affectsOutboundCommunication: /client|customer|email|whatsapp/i.test(first.detail) }),
        evidence,
        effect: `The agent's instructions for "${first.subject}" gain one appended paragraph of operator guidance.`,
        rollback: `Remove the appended paragraph; the before-snapshot restores the exact prior content.`,
      })
      continue
    }

    declined.push({ observation: key, reason: `No governed-surface mutation is defined for ${first.kind}. The loop does not invent patches for signals it has no rule for.` })
  }

  // Highest risk first, then most-evidenced: the reviewer's attention goes
  // where the consequence is.
  proposals.sort((a, b) => riskRank(b.risk.level) - riskRank(a.risk.level) || b.evidence.length - a.evidence.length)

  return { proposals, declined, refused }
}

function riskRank(level: RiskLevel): number {
  return { LOW: 1, MEDIUM: 2, HIGH: 3, CRITICAL: 4 }[level]
}

/**
 * The lineage entry recorded for a generation. A generation is only "evolved"
 * once something was actually applied; proposing alone does not advance it.
 */
export type GenerationRecord = {
  generation: number
  parentGeneration: number | null
  observations: number
  proposed: number
  applied: number
  rejected: number
  rolledBack: number
  surfaces: EvolutionSurface[]
  startedAt: string
  closedAt: string | null
  /** The honest headline: what this generation actually changed. */
  summary: string
}

export function summarizeGeneration(input: {
  generation: number
  parentGeneration: number | null
  observations: number
  proposals: Array<{ status: string; surface: EvolutionSurface }>
  startedAt: string
  now?: string
}): GenerationRecord {
  const applied = input.proposals.filter((p) => p.status === 'APPLIED')
  const rejected = input.proposals.filter((p) => p.status === 'REJECTED')
  const rolledBack = input.proposals.filter((p) => p.status === 'ROLLED_BACK')
  const surfaces = [...new Set(applied.map((p) => p.surface))]

  const summary = applied.length === 0
    ? `Generation ${input.generation} observed ${input.observations} signal(s) and proposed ${input.proposals.length}, but applied nothing. The agent did not change.`
    : `Generation ${input.generation} applied ${applied.length} of ${input.proposals.length} proposal(s) across ${surfaces.join(', ')}. ${rejected.length} rejected, ${rolledBack.length} rolled back.`

  return {
    generation: input.generation,
    parentGeneration: input.parentGeneration,
    observations: input.observations,
    proposed: input.proposals.length,
    applied: applied.length,
    rejected: rejected.length,
    rolledBack: rolledBack.length,
    surfaces,
    startedAt: input.startedAt,
    closedAt: applied.length || rejected.length || rolledBack.length ? (input.now ?? new Date().toISOString()) : null,
    summary,
  }
}

/** What the loop is, stated for the UI and the docs. */
export const EVOLUTION_LOOP_STEPS = [
  { step: 'OBSERVE', what: 'Read real outcome signals: operator corrections, false positives, failed runs, discarded rebuilds.', autonomous: true },
  { step: 'PROPOSE', what: 'Turn signals into bounded, validated, reversible patches on a governed surface, deterministically.', autonomous: true },
  { step: 'GATE', what: 'Every proposal becomes an ApprovalRequest with a computed risk. Nothing changes yet.', autonomous: true },
  { step: 'APPROVE', what: 'A different human decides. The proposer can never be the approver.', autonomous: false },
  { step: 'APPLY', what: 'Re-validate, claim atomically, write the new value, store the before-snapshot, bump the generation.', autonomous: true },
  { step: 'VERIFY', what: 'Read the value back and confirm the invariant holds. A failed verify triggers rollback.', autonomous: true },
  { step: 'ROLLBACK', what: 'One call restores the snapshot. Available for every applied proposal, forever.', autonomous: false },
] as const
