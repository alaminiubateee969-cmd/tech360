/**
 * TECH360 — Evolution Loop: the writable-field allowlist (pure)
 * ==============================================================
 * `policy.ts` decides what may be PROPOSED. This module decides what may be
 * WRITTEN, and it is deliberately stricter: each governed surface has an
 * explicit allowlist of editable FIELDS, and a patch may only touch a field on
 * that list, whatever the proposal claimed. Even if a malformed or hostile
 * proposal reached apply, `permissions`, `handler`, `tools`,
 * `requiresApproval`, `inputSchema`, `riskLevel` and every other control column
 * is simply not writable through here. There is no code path that writes them.
 *
 * WHY THIS IS A SEPARATE MODULE
 * -----------------------------
 * The allowlist and its bound checks are pure predicates. `surfaces.ts` — which
 * reads and writes the real rows — imports `@/lib/db`, and importing that pulls
 * in `@prisma/client`. Keeping the declaration here means the safety boundary is
 * unit-testable with no database and no generated client, which is the
 * convention every other suite in `tests/` follows. It also means the allowlist
 * cannot be quietly widened by someone editing a database accessor: the list of
 * writable fields is a declaration, reviewed on its own.
 */
import { SURFACE_SPECS, type EvolutionSurface, type PatchOp } from './policy'

export type FieldSpec = {
  type: 'string' | 'number' | 'json'
  /** For numbers: the value bound. For arrays: the element-COUNT bound. */
  min?: number
  /** For numbers/arrays: the ceiling. For strings: the character ceiling. */
  max?: number
  /** For string arrays: the per-element character ceiling. */
  itemMax?: number
  /** For a whole JSON document: the serialised character ceiling. */
  jsonMax?: number
  note: string
}

export type SurfaceAllowlist = {
  /** The only fields a patch may touch on this surface. */
  editableFields: Record<string, FieldSpec>
  /** Fields that are explicitly NOT writable, named so the refusal is legible. */
  protectedFields: string[]
}

/**
 * The allowlist, per surface. Bounds are taken from `SURFACE_SPECS` where the
 * proposal-time validator already declares one, so the two gates cannot drift:
 * a value that passes proposal also passes apply.
 */
export const FIELD_ALLOWLIST: Record<EvolutionSurface, SurfaceAllowlist> = {
  REA_HEURISTIC: {
    editableFields: {
      renderModel: { type: 'json', note: 'Word thresholds that decide SSR vs client-rendered shell.' },
      fingerprint: { type: 'json', note: 'Confidence floor for reporting a fingerprint, and the inferred cap.' },
      routes: { type: 'json', note: 'Candidate caps and literal confidences.' },
      endpoints: { type: 'json', note: 'Candidate caps and literal confidences.' },
      teardown: { type: 'json', note: 'Spoken-script length and per-section observation caps.' },
      reconstruction: { type: 'json', note: 'Base confidence and ceiling for derived rebuild briefs.' },
    },
    // `version` is provenance: a patch that could rewrite it could rewrite the
    // record of which heuristic produced which teardown.
    protectedFields: ['version'],
  },
  PROMPT_TEMPLATE: {
    editableFields: {
      template: {
        type: 'string',
        min: SURFACE_SPECS.PROMPT_TEMPLATE.bounds.template[0],
        max: SURFACE_SPECS.PROMPT_TEMPLATE.bounds.template[1],
        note: 'The prompt wording itself. The minimum length is what stops an evolved value from emptying an agent\u2019s instructions.',
      },
      priority: { type: 'number', min: SURFACE_SPECS.PROMPT_TEMPLATE.bounds.priority[0], max: SURFACE_SPECS.PROMPT_TEMPLATE.bounds.priority[1], note: 'Retrieval priority. Changes which template wins, not who may run it.' },
      quality: { type: 'number', min: SURFACE_SPECS.PROMPT_TEMPLATE.bounds.quality[0], max: SURFACE_SPECS.PROMPT_TEMPLATE.bounds.quality[1], note: 'Retrieval quality score.' },
    },
    protectedFields: ['code', 'agentCode', 'role', 'departmentCode', 'skillCode', 'status', 'variables', 'stage', 'language'],
  },
  SKILL_CONFIG: {
    editableFields: {
      timeoutMs: { type: 'number', min: SURFACE_SPECS.SKILL_CONFIG.bounds.timeoutMs[0], max: SURFACE_SPECS.SKILL_CONFIG.bounds.timeoutMs[1], note: 'Per-run deadline for this skill.' },
      retries: { type: 'number', min: SURFACE_SPECS.SKILL_CONFIG.bounds.retries[0], max: SURFACE_SPECS.SKILL_CONFIG.bounds.retries[1], note: 'Bounded retry count.' },
      threshold: { type: 'number', min: 0, max: 1, note: 'A skill-specific decision threshold.' },
      configuration: { type: 'json', jsonMax: SURFACE_SPECS.SKILL_CONFIG.bounds.configuration[1], note: 'The whole configuration document, when a patch replaces it.' },
    },
    protectedFields: ['handler', 'permissions', 'inputSchema', 'outputSchema', 'requiresApproval', 'riskLevel', 'status', 'owner', 'departmentCode', 'slug', 'testRefs'],
  },
  AGENT_PARAM: {
    editableFields: {
      dailyQuota: { type: 'number', min: SURFACE_SPECS.AGENT_PARAM.bounds.dailyQuota[0], max: SURFACE_SPECS.AGENT_PARAM.bounds.dailyQuota[1], note: 'How many runs a day this agent may take. A throughput dial, not a permission.' },
      model: { type: 'string', min: SURFACE_SPECS.AGENT_PARAM.bounds.model[0], max: SURFACE_SPECS.AGENT_PARAM.bounds.model[1], note: 'Model selection. Must be "default" or an already-verified ModelDeployment slug.' },
    },
    protectedFields: ['tools', 'permissions', 'requiresApproval', 'status', 'level', 'parentCode', 'code', 'systemPrompt', 'departmentId'],
  },
  PLAYBOOK: {
    editableFields: {
      steps: {
        type: 'json',
        min: SURFACE_SPECS.PLAYBOOK.bounds.steps[0],
        max: SURFACE_SPECS.PLAYBOOK.bounds.steps[1],
        itemMax: SURFACE_SPECS.PLAYBOOK.bounds.step[1],
        note: 'The ordered procedure steps. Text only; a step grants no capability. The count and the per-step length are both bounded.',
      },
    },
    protectedFields: ['key', 'requiresApproval', 'auditRequired', 'tools', 'validation', 'owner', 'level', 'status', 'departmentCode', 'preconditions', 'decisionPoints'],
  },
}

/** Refuses a field write that is not on the surface's allowlist. */
export function assertFieldAllowed(surface: EvolutionSurface, path: string): { ok: boolean; reason: string } {
  const allowlist = FIELD_ALLOWLIST[surface]
  if (!allowlist) return { ok: false, reason: `No allowlist is registered for surface ${surface}.` }
  const leaf = path.split('.').pop() ?? ''
  const root = path.split('.')[0] ?? ''
  const allowed = allowlist.editableFields[root] ?? allowlist.editableFields[leaf]
  if (!allowed) {
    return {
      ok: false,
      reason: `"${path}" is not an editable field on ${surface}. Editable: ${Object.keys(allowlist.editableFields).join(', ')}. Protected: ${allowlist.protectedFields.join(', ')}.`,
    }
  }
  return { ok: true, reason: '' }
}

/**
 * Checks one value against its field bound. Returns a refusal reason, or null.
 *
 * Every value shape is checked: numbers against the numeric bound, strings
 * against BOTH the minimum and the maximum (a minimum that is never enforced is
 * a bound that only works in one direction, and an empty prompt is worse than a
 * long one), arrays against the element-count bound and each element against the
 * per-element bound, and a whole JSON document against its serialised size.
 */
export function checkValueBound(surface: EvolutionSurface, path: string, spec: FieldSpec, value: unknown): string | null {
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return `${path} must be a finite number on ${surface}.`
    if (spec.min !== undefined && value < spec.min) return `${path} = ${value} is below the ${spec.min} floor for ${surface}.`
    if (spec.max !== undefined && value > spec.max) return `${path} = ${value} is above the ${spec.max} ceiling for ${surface}.`
    return null
  }
  if (typeof value === 'string') {
    if (spec.min !== undefined && value.length < spec.min) return `${path} is ${value.length} characters; ${surface} requires at least ${spec.min}. A value this short would empty the field rather than tune it.`
    if (spec.max !== undefined && value.length > spec.max) return `${path} exceeds the ${spec.max}-character bound for ${surface}.`
    return null
  }
  if (Array.isArray(value)) {
    if (spec.min !== undefined && value.length < spec.min) return `${path} has ${value.length} entries; ${surface} requires at least ${spec.min}.`
    if (spec.max !== undefined && value.length > spec.max) return `${path} has ${value.length} entries, above the ${spec.max} ceiling for ${surface}.`
    if (spec.itemMax !== undefined) {
      const oversized = value.find((item) => typeof item === 'string' && item.length > spec.itemMax!)
      if (oversized !== undefined) return `a ${path} entry is ${String(oversized).length} characters, above the ${spec.itemMax} per-entry bound for ${surface}.`
    }
    return null
  }
  if (value !== null && typeof value === 'object') {
    const serialized = JSON.stringify(value)
    if (spec.jsonMax !== undefined && serialized.length > spec.jsonMax) return `${path} serialises to ${serialized.length} characters, above the ${spec.jsonMax} bound for ${surface}.`
    return null
  }
  return null
}

/** Verifies every op in a patch targets an allowed field within its bound. */
export function assertPatchWritable(surface: EvolutionSurface, ops: PatchOp[]): { ok: boolean; reason: string } {
  const allowlist = FIELD_ALLOWLIST[surface]
  if (!allowlist) return { ok: false, reason: `No allowlist is registered for surface ${surface}.` }

  for (const op of ops) {
    const check = assertFieldAllowed(surface, op.path)
    if (!check.ok) return check

    const root = op.path.split('.')[0] ?? ''
    const spec = allowlist.editableFields[root] ?? allowlist.editableFields[op.path.split('.').pop() ?? '']
    if (!spec) continue

    if (op.op === 'set' || op.op === 'append') {
      const refusal = checkValueBound(surface, op.path, spec, op.value)
      if (refusal) return { ok: false, reason: refusal }
    }
    if (op.op === 'delta') {
      // A delta is only meaningful on a number; refusing it here stops a patch
      // from sliding a string field into a numeric one.
      if (spec.type !== 'number') return { ok: false, reason: `${op.path} is a ${spec.type} field on ${surface}; a numeric delta cannot be applied to it.` }
      const bound = SURFACE_SPECS[surface].bounds.weightDelta ?? SURFACE_SPECS[surface].bounds.numericValue
      if (bound && (op.delta < bound[0] || op.delta > bound[1])) {
        return { ok: false, reason: `delta ${op.delta} on ${op.path} is outside [${bound[0]}, ${bound[1]}] for ${surface}.` }
      }
    }
  }
  return { ok: true, reason: '' }
}
