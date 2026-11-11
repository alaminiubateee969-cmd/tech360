/**
 * TECH360 — Evolution Loop: what the AI may edit, and what it may never touch
 * ============================================================================
 * The owner asked for an agent that can edit its own code and evolve, gated by
 * human approval. That is buildable safely, but only if "its own code" is a
 * precisely defined surface rather than the repository.
 *
 * THE RULE THIS MODULE ENCODES
 * ----------------------------
 * The agent evolves its own CONFIGURED BEHAVIOUR, stored as data and versioned
 * in the database. It never writes, patches, executes or deletes application
 * source code, and it never touches a safety control. Self-modification of a
 * guard would make every other guarantee in this file meaningless — an agent
 * that can widen its own permissions has no permissions, only habits.
 *
 * So the surface is split three ways:
 *
 *   GOVERNED   Evolvable, with approval, versioned, reversible. Prompts, skill
 *              configuration, REA heuristic weights, agent runtime parameters,
 *              playbook text.
 *   IMMUTABLE  Refused at proposal time and refused again at apply time. The
 *              SSRF/target policy, RBAC and view policy, secret handling,
 *              payment and refund logic, the approval gate itself, audit
 *              logging, and this file.
 *   UNSUPPORTED Refused because it is not a thing this platform does at all:
 *              arbitrary code generation, shell execution, dependency changes,
 *              filesystem writes, and self-approval.
 *
 * Every patch is validated against a bound before it can even be proposed, and
 * validated AGAIN before it is applied, because a proposal can sit in the
 * approval queue while the world moves. Applying is never a trusted operation.
 *
 * Nothing here touches the network or the database: these are pure predicates
 * so the whole policy is unit-testable and cannot drift from its tests.
 */

export type EvolutionSurface =
  | 'PROMPT_TEMPLATE'
  | 'SKILL_CONFIG'
  | 'REA_HEURISTIC'
  | 'AGENT_PARAM'
  | 'PLAYBOOK'

export const EVOLUTION_SURFACES: readonly EvolutionSurface[] = [
  'PROMPT_TEMPLATE',
  'SKILL_CONFIG',
  'REA_HEURISTIC',
  'AGENT_PARAM',
  'PLAYBOOK',
] as const

export type SurfaceSpec = {
  surface: EvolutionSurface
  label: string
  what: string
  /** Where the value lives, so a reviewer knows what will change. */
  storage: string
  /** Highest risk a mutation on this surface may carry. */
  maxRisk: RiskLevel
  /** True when a change here needs a second approver (SUPER_ADMIN). */
  requiresSuperAdmin: boolean
  bounds: Record<string, [number, number]>
}

export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'

export const SURFACE_SPECS: Record<EvolutionSurface, SurfaceSpec> = {
  PROMPT_TEMPLATE: {
    surface: 'PROMPT_TEMPLATE',
    label: 'Prompt template',
    what: 'The wording an agent is given, plus its retrieval priority and quality score. Changes alter tone and emphasis, not permissions.',
    storage: 'PromptTemplate.template / .priority / .quality, selected by PromptTemplate.code',
    maxRisk: 'MEDIUM',
    requiresSuperAdmin: false,
    bounds: { template: [40, 24_000], priority: [1, 10], quality: [0, 1] },
  },
  SKILL_CONFIG: {
    surface: 'SKILL_CONFIG',
    label: 'Skill configuration',
    what: 'A registered skill\u2019s specialisation JSON. The skill\u2019s handler, permissions and schemas are NOT evolvable.',
    storage: 'Skill.configuration (JSON), selected by Skill.slug; a SkillVersion row records every change',
    maxRisk: 'HIGH',
    requiresSuperAdmin: true,
    bounds: { timeoutMs: [1_000, 300_000], retries: [0, 5], numericValue: [-1_000_000, 1_000_000], configuration: [2, 60_000] },
  },
  REA_HEURISTIC: {
    surface: 'REA_HEURISTIC',
    label: 'REA Studio heuristic',
    what: 'Confidence weights and thresholds used when classifying a teardown. Tuning changes how cautious the analysis is.',
    storage: 'Setting (key rea.heuristics) as JSON',
    maxRisk: 'MEDIUM',
    requiresSuperAdmin: false,
    // Deliberately tight: a heuristic may never be tuned into certainty.
    //
    // The delta bounds are split by what the number MEANS. A confidence weight
    // moves in hundredths, so weightDelta is ±0.25. A word-count or candidate
    // cap moves in tens, so applying weightDelta to it refused every legitimate
    // tuning of `renderModel.spaShellWordThreshold` — the loop generated a patch
    // its own validator rejected, and operator corrections silently produced no
    // proposal at all. One bound cannot serve both units.
    bounds: {
      confidence: [0, 0.95],
      threshold: [0, 1],
      weightDelta: [-0.25, 0.25],
      wordThresholdDelta: [-200, 200],
      countDelta: [-100, 100],
      charsDelta: [-2_000, 2_000],
    },
  },
  AGENT_PARAM: {
    surface: 'AGENT_PARAM',
    label: 'Agent runtime parameter',
    what: 'Model selection within the existing allowlist, temperature, retry and timeout policy.',
    storage: 'AiAgent.dailyQuota / .model, selected by AiAgent.code. tools, permissions, systemPrompt and requiresApproval are NOT evolvable.',
    maxRisk: 'HIGH',
    requiresSuperAdmin: true,
    bounds: { dailyQuota: [1, 10_000], model: [1, 64] },
  },
  PLAYBOOK: {
    surface: 'PLAYBOOK',
    label: 'Operational playbook',
    what: 'The written procedure an operator or agent follows. Text only; it grants nothing.',
    storage: 'Sop.steps (JSON array), selected by Sop.key',
    maxRisk: 'LOW',
    requiresSuperAdmin: false,
    bounds: { steps: [1, 40], step: [4, 2_000] },
  },
}

/**
 * The guard registry. These are the controls that keep the platform safe, and
 * the agent may never propose a change to any of them — not with approval, not
 * with a SUPER_ADMIN signature, not ever. The only way to change one is for a
 * human to change the source and ship it through review.
 */
export const IMMUTABLE_CONTROLS: Array<{ id: string; label: string; why: string; path: string; aliases?: string[] }> = [
  { id: 'rea.target-policy', label: 'REA target admission / SSRF policy', why: 'An agent that could relax its own SSRF guard could reach the metadata service, the loopback interface and every internal host.', path: 'src/lib/rea/target-policy.ts', aliases: ['ssrf policy', 'target admission', 'admission policy', 'target policy'] },
  { id: 'rea.capture-contract', label: 'Capture bounds and header redaction', why: 'Byte caps, redirect caps and credential redaction are what stop the capture becoming a credential collector.', path: 'src/lib/rea/fetch-target.ts', aliases: ['capture contract', 'capture bounds', 'header redaction'] },
  { id: 'rea.clone-refusal', label: 'Reconstruction copy refusal', why: 'The rule that a rebuild never reuses a target\u2019s code, copy or brand is a legal control, not a preference.', path: 'src/lib/rea/reconstruct.ts', aliases: ['clone refusal', 'copy refusal', 'never copied'] },
  { id: 'auth.rbac', label: 'RBAC, roles and capabilities', why: 'Self-modification of permission checks is privilege escalation by definition.', path: 'src/lib/access-policy.ts, src/lib/admin-view-policy.ts', aliases: ['rbac', 'role check', 'permission check', 'view policy'] },
  { id: 'auth.session', label: 'Session, CSRF and OTP handling', why: 'Authentication integrity cannot depend on a value the agent can edit.', path: 'src/lib/auth.ts, src/lib/otp.ts', aliases: ['session handling', 'csrf', 'otp handling'] },
  { id: 'security.secrets', label: 'Secret handling and redaction', why: 'The agent must never be able to make a secret loggable or exfiltrable.', path: 'src/lib/security.ts', aliases: ['secret handling', 'secret redaction'] },
  { id: 'payments.policy', label: 'Payment, invoice and refund policy', why: 'Money movement is governed by reviewed code and dual approval, never by a tuned parameter.', path: 'src/lib/invoice-policy.ts, src/lib/commerce-policy.ts', aliases: ['refund policy', 'invoice policy', 'payment policy'] },
  { id: 'approvals.gate', label: 'The approval gate itself', why: 'If the agent could edit the gate, approval would no longer mean anything.', path: 'src/app/api/admin/approvals/*', aliases: ['approval gate', 'approval requirement', 'deferred approval'] },
  { id: 'ai.gateway', label: 'AI gateway policy, allowlist and budget', why: 'Model allowlist, classification policy and spend caps are the boundary around every model call.', path: 'src/lib/ai-gateway/*', aliases: ['ai gateway', 'model allowlist', 'provider allowlist', 'spend cap'] },
  { id: 'audit.log', label: 'Audit logging', why: 'An agent that can quiet the audit log can act unseen.', path: 'src/lib/security.ts (audit)', aliases: ['audit log', 'audit logging', 'audit trail'] },
  { id: 'evolution.policy', label: 'This policy file', why: 'The definition of what is evolvable is itself immutable. Otherwise the boundary is only a suggestion.', path: 'src/lib/evolution/policy.ts', aliases: ['evolution policy', 'evolution loop policy', 'what is evolvable'] },
] as const

/** Things the agent is asked for that this platform does not do at all. */
export const UNSUPPORTED_MUTATIONS: Array<{ id: string; request: string; refusal: string }> = [
  { id: 'source-code', request: 'Write, patch or delete application source code', refusal: 'The agent evolves configuration, not code. Source changes go through a human-authored pull request and CI review. That is a deliberate limit, not a missing feature.' },
  { id: 'shell', request: 'Execute a shell command, script or migration', refusal: 'No mutation in the Evolution Loop runs a command. Applying a patch writes a validated value to the database and nothing else.' },
  { id: 'dependencies', request: 'Add, upgrade or remove a dependency', refusal: 'Supply-chain changes are human decisions made in a reviewed lockfile.' },
  { id: 'filesystem', request: 'Write to the filesystem outside the database', refusal: 'The loop has no filesystem surface. Every evolved value is a row in the database, which is what makes it versioned, reviewable and reversible in one call. A file on disk would be none of those, and could not be rolled back by the snapshot mechanism.' },
  { id: 'self-approval', request: 'Approve its own proposal', refusal: 'Proposals are decided by a human through the existing approval gate. The proposing actor can never be the deciding actor — this is checked at decision time, not assumed.' },
  { id: 'guard-relaxation', request: 'Relax a rate limit, byte cap, timeout or allowlist', refusal: 'Bounds are controls. The loop may tune within a bound; it may never move the bound.' },
  { id: 'visibility', request: 'Change what is disclosed publicly about AI operation', refusal: 'Public visibility is governed by docs/AI_VISIBILITY_POLICY.md and is a human editorial decision.' },
] as const

export type PatchOp =
  | { op: 'set'; path: string; value: string | number | boolean }
  | { op: 'delta'; path: string; delta: number }
  | { op: 'append'; path: string; value: string }
  | { op: 'remove'; path: string }

export type EvolutionPatch = {
  surface: EvolutionSurface
  /** Stable key of the thing being changed, e.g. a template code or setting key. */
  targetKey: string
  ops: PatchOp[]
  /** The value before the change, so apply is reversible without a re-read. */
  before: Record<string, unknown>
  /** The value after the change, precomputed and validated at proposal time. */
  after: Record<string, unknown>
}

export type ProposalRisk = {
  level: RiskLevel
  score: number
  reasons: string[]
}

export type ValidationVerdict =
  | { ok: true }
  | { ok: false; code: ValidationCode; reason: string }

export type ValidationCode =
  | 'SURFACE_UNKNOWN'
  | 'CONTROL_IMMUTABLE'
  | 'UNSUPPORTED_MUTATION'
  | 'NO_OPS'
  | 'TOO_MANY_OPS'
  | 'PATH_OUT_OF_BOUNDS'
  | 'VALUE_OUT_OF_BOUNDS'
  | 'TYPE_MISMATCH'
  | 'SNAPSHOT_MISSING'
  | 'SNAPSHOT_MISMATCH'
  | 'RISK_UNCLASSIFIED'
  | 'SELF_APPROVAL'
  | 'STALE_PROPOSAL'

/** Keys inside a surface's value that are themselves controls. */
const IMMUTABLE_PATH_PATTERNS: RegExp[] = [
  /(^|\.)(password|passwd|secret|token|apikey|api_key|credential|private_?key|signature)(\.|$)/i,
  /(^|\.)(role|roles|permission|permissions|capability|capabilities|minrole|min_role)(\.|$)/i,
  /(^|\.)(allowlist|allow_list|blocklist|denylist|ssrf|redirect|ratelimit|rate_limit|maxbytes|timeout_?override)(\.|$)/i,
  /(^|\.)(amount|price|total|tax|discount|refund|payout|iban|account_?number|card)(\.|$)/i,
  /(^|\.)(approval_?required|requires_?approval|gate|bypass|override)(\.|$)/i,
]

export function isImmutablePath(path: string): { immutable: boolean; reason: string } {
  const normalized = path.trim().toLowerCase()
  if (!normalized) return { immutable: true, reason: 'An empty path is refused.' }
  if (normalized.startsWith('/') || normalized.includes('..') || normalized.includes('\u0000')) {
    return { immutable: true, reason: 'Paths must be relative value keys, never filesystem paths.' }
  }
  const hit = IMMUTABLE_PATH_PATTERNS.find((re) => re.test(normalized))
  if (hit) {
    return {
      immutable: true,
      reason: `Path "${path}" matches a protected control pattern (${hit.source}). Credentials, roles, allowlists, bounds, money and approval flags are never evolvable.`,
    }
  }
  return { immutable: false, reason: '' }
}

/** Whether a proposal touches a registered control at all. */
export function touchesImmutableControl(input: { path?: string; text?: string }): { blocked: boolean; control: (typeof IMMUTABLE_CONTROLS)[number] | null; reason: string } {
  const haystack = `${input.path ?? ''} ${input.text ?? ''}`.toLowerCase()
  for (const control of IMMUTABLE_CONTROLS) {
    // Aliases are how a natural-language attempt ("disable the ssrf policy") is
    // recognised. Without them only an exact id, path or label matched, so an
    // attempt phrased in prose was recorded as nothing at all — and an attempt
    // that is not recorded cannot be reviewed.
    const needles = [
      control.id.toLowerCase(),
      control.path.toLowerCase(),
      control.label.toLowerCase(),
      ...(control.aliases ?? []).map((a) => a.toLowerCase()),
    ]
    for (const needle of needles) {
      if (needle.length > 6 && haystack.includes(needle)) {
        return { blocked: true, control, reason: `Refused: this proposal targets "${control.label}", an immutable control. ${control.why}` }
      }
    }
  }
  return { blocked: false, control: null, reason: '' }
}

/** Whether the request is something the platform does not do at all. */
export function classifyUnsupported(text: string): { unsupported: boolean; refusal: string; id: string } {
  const value = (text ?? '').toLowerCase()
  for (const item of UNSUPPORTED_MUTATIONS) {
    const needles = item.request.toLowerCase().split(/[,\s]+/).filter((w) => w.length > 5)
    // Refuse when the request names the capability directly.
    if (value.includes(item.request.toLowerCase().slice(0, 24))) {
      return { unsupported: true, refusal: item.refusal, id: item.id }
    }
    const direct = [
      ['source-code', /(edit|write|patch|modify|rewrite|refactor)\s+(its\s+own\s+|the\s+)?(source\s+)?code/],
      ['shell', /(run|execute)\s+(a\s+)?(shell|bash|command|script|migration)/],
      ['dependencies', /(add|install|upgrade|remove|update)\s+(a\s+)?(dependency|dependencies|npm\s+package|package)/],
      ['filesystem', /(write|save|create)\s+(a\s+)?file\s*(system|to\s+disk)?/],
      ['self-approval', /(approve|accept)\s+(its\s+own|itself|my\s+own)/],
      ['guard-relaxation', /(relax|raise|increase|disable|remove|bypass)\s+(the\s+)?(rate\s+limit|byte\s+cap|timeout|allowlist|guard|limit|cap)/],
      // Words may sit between the verb and the audience: "publish this publicly
      // on the website" is the phrasing an operator actually types.
      ['visibility', /(publish|disclose|announce|post|advertise)\s+[^.!?]{0,48}?(publicly|public|on\s+the\s+website|to\s+the\s+public|marketing\s+site)/],
    ] as const
    const match = direct.find(([id]) => id === item.id)
    if (match && match[1].test(value)) return { unsupported: true, refusal: item.refusal, id: item.id }
    if (needles.length && needles.every((n) => value.includes(n))) return { unsupported: true, refusal: item.refusal, id: item.id }
  }
  return { unsupported: false, refusal: '', id: '' }
}

/**
 * Validates a patch against its surface bounds. Called at proposal time AND at
 * apply time — a queued proposal may face a different world than the one it was
 * written in, and apply is never a trusted operation.
 */
export function validatePatch(patch: EvolutionPatch): ValidationVerdict {
  const spec = SURFACE_SPECS[patch.surface]
  if (!spec) return { ok: false, code: 'SURFACE_UNKNOWN', reason: `Unknown evolution surface "${String(patch.surface)}".` }
  if (!patch.ops.length) return { ok: false, code: 'NO_OPS', reason: 'A patch with no operations changes nothing and is refused as noise.' }
  if (patch.ops.length > 24) return { ok: false, code: 'TOO_MANY_OPS', reason: `A patch may carry at most 24 operations; this one has ${patch.ops.length}. Large patches cannot be reviewed.` }
  if (!patch.targetKey || patch.targetKey.length > 160) {
    return { ok: false, code: 'PATH_OUT_OF_BOUNDS', reason: 'targetKey is required and must be at most 160 characters.' }
  }
  if (!patch.before || typeof patch.before !== 'object') return { ok: false, code: 'SNAPSHOT_MISSING', reason: 'A patch must carry its own before-snapshot or it cannot be reversed.' }
  if (!patch.after || typeof patch.after !== 'object') return { ok: false, code: 'SNAPSHOT_MISSING', reason: 'A patch must carry its computed after-snapshot.' }

  for (const op of patch.ops) {
    const guard = isImmutablePath(op.path)
    if (guard.immutable) return { ok: false, code: 'CONTROL_IMMUTABLE', reason: guard.reason }

    const control = touchesImmutableControl({
      path: op.path,
      // `delta` ops carry no value; only set/append do.
      text: 'value' in op && typeof op.value === 'string' ? op.value : '',
    })
    if (control.blocked) return { ok: false, code: 'CONTROL_IMMUTABLE', reason: control.reason }

    if (op.op === 'delta') {
      const bound = deltaBoundFor(spec, op.path)
      if (bound && (op.delta < bound[0] || op.delta > bound[1])) {
        return { ok: false, code: 'VALUE_OUT_OF_BOUNDS', reason: `delta ${op.delta} on ${op.path} is outside [${bound[0]}, ${bound[1]}] for ${patch.surface}.` }
      }
    }
    if (op.op === 'set' || op.op === 'append') {
      const bound = boundFor(spec, op.path)
      if (typeof op.value === 'number' && bound && (op.value < bound[0] || op.value > bound[1])) {
        return { ok: false, code: 'VALUE_OUT_OF_BOUNDS', reason: `value ${op.value} on ${op.path} is outside [${bound[0]}, ${bound[1]}] for ${patch.surface}.` }
      }
      if (typeof op.value === 'string' && bound) {
        // BOTH edges. A maximum that is checked while the minimum is not means
        // the bound only works in one direction — and for a prompt template the
        // dangerous direction is the short one: an evolved value of "" or "hi"
        // empties an agent's instructions while staying inside a max-only check.
        if (op.value.length < bound[0]) {
          return { ok: false, code: 'VALUE_OUT_OF_BOUNDS', reason: `"${op.path}" is ${op.value.length} characters; ${patch.surface} requires at least ${bound[0]}. A value this short would empty the field rather than tune it.` }
        }
        if (op.value.length > bound[1]) {
          return { ok: false, code: 'VALUE_OUT_OF_BOUNDS', reason: `"${op.path}" exceeds the ${bound[1]}-character bound for ${patch.surface}.` }
        }
      }
      // An ARRAY value is bounded by element count, and each string element by
      // the per-element bound. Without this, a list value bypassed every check
      // below — `typeof [] === 'object'` — so a playbook could grow to any
      // length and the [1,40] step bound was decoration.
      if (Array.isArray(op.value) && bound) {
        if (op.value.length < bound[0] || op.value.length > bound[1]) {
          return { ok: false, code: 'VALUE_OUT_OF_BOUNDS', reason: `"${op.path}" has ${op.value.length} entries, outside the [${bound[0]}, ${bound[1]}] bound for ${patch.surface}.` }
        }
        const itemBound = spec.bounds.step ?? spec.bounds.item
        if (itemBound) {
          const oversized = op.value.find((item) => typeof item === 'string' && (item.length < itemBound[0] || item.length > itemBound[1]))
          if (oversized !== undefined) {
            return { ok: false, code: 'VALUE_OUT_OF_BOUNDS', reason: `a "${op.path}" entry is ${String(oversized).length} characters, outside the [${itemBound[0]}, ${itemBound[1]}] per-entry bound for ${patch.surface}.` }
          }
        }
      }
      // A whole JSON document is bounded by its serialised size.
      if (op.value !== null && typeof op.value === 'object' && !Array.isArray(op.value) && bound) {
        const serialized = JSON.stringify(op.value)
        if (serialized.length > bound[1]) {
          return { ok: false, code: 'VALUE_OUT_OF_BOUNDS', reason: `"${op.path}" serialises to ${serialized.length} characters, above the ${bound[1]} bound for ${patch.surface}.` }
        }
      }
      if (typeof op.value === 'string' && /<\/?script|\bon\w+\s*=|javascript:/i.test(op.value)) {
        return { ok: false, code: 'VALUE_OUT_OF_BOUNDS', reason: `"${op.path}" contains script/inline-handler markup. Evolved values are rendered as text and must stay inert.` }
      }
    }
  }
  return { ok: true }
}

/**
 * Picks the delta bound for a path by the UNIT the number is in.
 *
 * Order matters: `spaShellWordThreshold` contains both "word" and "threshold",
 * and it is a word count, not a 0–1 threshold. Confidence weights are matched
 * last so a count field is never held to a ±0.25 bound.
 */
function deltaBoundFor(spec: SurfaceSpec, path: string): [number, number] | null {
  const leaf = (path.split('.').pop() ?? '').toLowerCase()
  if (spec.bounds.wordThresholdDelta && /word/.test(leaf)) return spec.bounds.wordThresholdDelta
  if (spec.bounds.charsDelta && /(chars|characters|spokenmax)/.test(leaf)) return spec.bounds.charsDelta
  if (spec.bounds.countDelta && /(max|count|candidates|observations|limit)/.test(leaf)) return spec.bounds.countDelta
  if (spec.bounds.weightDelta && /(confidence|weight|floor|cap|threshold|score|quality)/.test(leaf)) return spec.bounds.weightDelta
  return spec.bounds.weightDelta ?? spec.bounds.numericValue ?? null
}

function boundFor(spec: SurfaceSpec, path: string): [number, number] | null {
  const leaf = path.split('.').pop()?.toLowerCase() ?? ''
  for (const [key, bound] of Object.entries(spec.bounds)) {
    if (leaf.includes(key.toLowerCase())) return bound
  }
  if (spec.surface === 'REA_HEURISTIC' && /(confidence|threshold|weight|score)/.test(leaf)) return spec.bounds.confidence
  if (spec.surface === 'AGENT_PARAM' && /(quota|limit)/.test(leaf)) return spec.bounds.dailyQuota
  if (spec.surface === 'SKILL_CONFIG' && /(timeout)/.test(leaf)) return spec.bounds.timeoutMs
  if (spec.surface === 'SKILL_CONFIG' && /(retr)/.test(leaf)) return spec.bounds.retries
  if (spec.surface === 'PROMPT_TEMPLATE' && /(content|body|text|template)/.test(leaf)) return spec.bounds.template
  if (spec.surface === 'PLAYBOOK' && /(step|text)/.test(leaf)) return spec.bounds.step
  return null
}

/**
 * Risk is computed, never self-declared. A proposal cannot call itself LOW.
 */
export function classifyRisk(input: {
  surface: EvolutionSurface
  ops: PatchOp[]
  affectsMoney?: boolean
  affectsOutboundCommunication?: boolean
  reverses?: boolean
}): ProposalRisk {
  const spec = SURFACE_SPECS[input.surface]
  const reasons: string[] = []
  let score = 0

  // REA_HEURISTIC starts at MEDIUM, not LOW: tuning a heuristic changes what
  // every future teardown asserts about a third party, which is a claim about
  // the world rather than a cosmetic preference. LOW would understate it to the
  // reviewer who has to decide.
  score += { PROMPT_TEMPLATE: 1, PLAYBOOK: 1, REA_HEURISTIC: 3, SKILL_CONFIG: 3, AGENT_PARAM: 3 }[input.surface]
  reasons.push(`surface ${input.surface} (base ${score})`)

  score += Math.min(3, Math.floor(input.ops.length / 4))
  if (input.ops.length > 4) reasons.push(`${input.ops.length} operations in one patch`)

  if (input.ops.some((o) => o.op === 'delta')) { score += 1; reasons.push('numeric delta — shifts a tuned value rather than replacing it') }
  if (input.affectsMoney) { score += 4; reasons.push('touches a value with a money path') }
  if (input.affectsOutboundCommunication) { score += 3; reasons.push('alters wording that can reach a client') }
  if (spec.requiresSuperAdmin) { score += 2; reasons.push('surface requires SUPER_ADMIN') }

  const level: RiskLevel = score >= 8 ? 'CRITICAL' : score >= 6 ? 'HIGH' : score >= 3 ? 'MEDIUM' : 'LOW'
  const capped = rank(level) > rank(spec.maxRisk) ? spec.maxRisk : level
  if (capped !== level) reasons.push(`capped at ${capped} — the maximum this surface may carry`)
  return { level: capped, score, reasons }
}

const RISK_RANK: Record<RiskLevel, number> = { LOW: 1, MEDIUM: 2, HIGH: 3, CRITICAL: 4 }
export function rank(level: RiskLevel): number {
  return RISK_RANK[level]
}

/**
 * Applies ops to a plain object, returning a NEW object. Pure: the caller
 * persists it. Applying twice is not idempotent by design — the API claims the
 * proposal atomically so apply can only happen once.
 */
export function applyOps(document: Record<string, unknown>, ops: PatchOp[]): Record<string, unknown> {
  const next: Record<string, unknown> = JSON.parse(JSON.stringify(document ?? {}))
  for (const op of ops) {
    const segments = op.path.split('.').filter(Boolean)
    if (!segments.length) continue
    let cursor: Record<string, unknown> = next
    for (let i = 0; i < segments.length - 1; i += 1) {
      const key = segments[i]
      if (typeof cursor[key] !== 'object' || cursor[key] === null) cursor[key] = {}
      cursor = cursor[key] as Record<string, unknown>
    }
    const leaf = segments[segments.length - 1]
    if (op.op === 'set') cursor[leaf] = op.value
    else if (op.op === 'append') cursor[leaf] = `${String(cursor[leaf] ?? '')}${String(op.value)}`
    else if (op.op === 'remove') delete cursor[leaf]
    else if (op.op === 'delta') {
      // A delta on a field that is ABSENT initialises it. A delta on a field
      // that is present but not numeric is refused rather than applied: silently
      // converting "text" into 3 would corrupt the value and hide the fact that
      // the patch was aimed at the wrong field.
      const existing = cursor[leaf]
      if (existing === undefined || existing === null) {
        cursor[leaf] = Number(op.delta.toFixed(6))
      } else {
        const current = Number(existing)
        if (Number.isFinite(current) && (typeof existing === 'number' || /^-?\d+(\.\d+)?$/.test(String(existing).trim()))) {
          cursor[leaf] = Number((current + op.delta).toFixed(6))
        }
      }
    }
  }
  return next
}

/** The proposing actor may never be the deciding actor. */
export function assertNotSelfApproval(input: { proposedBy: string; decidedBy: string }): ValidationVerdict {
  const proposer = (input.proposedBy ?? '').trim().toLowerCase()
  const decider = (input.decidedBy ?? '').trim().toLowerCase()
  if (!proposer || !decider) return { ok: false, code: 'SELF_APPROVAL', reason: 'Both the proposing and deciding identity are required.' }
  if (proposer === decider) {
    return { ok: false, code: 'SELF_APPROVAL', reason: `The proposing actor "${input.proposedBy}" cannot decide its own proposal. A different human must approve it.` }
  }
  return { ok: true }
}

/** Human-readable statement of the boundary, shown in the UI and the docs. */
export const EVOLUTION_CONTRACT = [
  'The agent proposes changes to its own CONFIGURED BEHAVIOUR — prompts, skill configuration, REA heuristics, runtime parameters and playbooks. These are data, versioned in the database.',
  'It never writes, patches, executes or deletes application source code, and it never runs a command.',
  `It can never touch ${IMMUTABLE_CONTROLS.length} registered controls — SSRF policy, RBAC, secrets, payments, the approval gate, the AI gateway budget, audit logging, or this policy itself. Not even with approval.`,
  'Every patch carries its own before-snapshot, so every applied change is reversible in one call.',
  'Risk is computed from the patch, never self-declared, and a proposal cannot exceed its surface\u2019s maximum.',
  'The proposing actor can never be the deciding actor.',
  'Patches are validated at proposal time and validated AGAIN at apply time, because a queued proposal faces a different world than the one it was written in.',
] as const
