/**
 * TECH360 — Evolution Loop: surface accessors (the enforcement point)
 * ====================================================================
 * `policy.ts` decides what may be PROPOSED. This module decides what may be
 * WRITTEN, and it is deliberately stricter.
 *
 * Each governed surface has an explicit allowlist of editable FIELDS. A patch
 * may only touch a field on that list, whatever the proposal claimed. This is
 * the layer that makes the guarantee real: even if a malformed or hostile
 * proposal somehow reached apply, `permissions`, `handler`, `tools`,
 * `requiresApproval`, `inputSchema`, `riskLevel` and every other control column
 * is simply not writable through here. There is no code path that writes them.
 *
 * Every accessor also VERIFIES by reading the value back after the write and
 * comparing it to what was intended. A write that does not verify is reported as
 * a failure and the caller rolls back — the loop never claims a change it
 * cannot show.
 */
import { createHash } from 'node:crypto'
import { db } from '@/lib/db'
import { SURFACE_SPECS, applyOps, type EvolutionSurface, type PatchOp } from './policy'
import { readHeuristics, writeHeuristics, KEYS } from './observations'
import { FIELD_ALLOWLIST, assertFieldAllowed, assertPatchWritable, type FieldSpec } from './field-policy'

// The allowlist and its bound checks live in `field-policy.ts`, which is pure.
// They are re-exported here so this module stays the single import point for
// callers, while the safety boundary itself remains testable with no database
// and no generated Prisma client — the convention every suite in tests/ follows.
export { FIELD_ALLOWLIST, assertFieldAllowed, assertPatchWritable }
export type { FieldSpec }

export type SurfaceAccessor = {
  surface: EvolutionSurface
  /** The only fields a patch may touch on this surface. */
  editableFields: Record<string, FieldSpec>
  /** Fields that are explicitly NOT writable, named so the refusal is legible. */
  protectedFields: string[]
  read(targetKey: string): Promise<ReadResult>
  write(targetKey: string, document: Record<string, unknown>, ops: PatchOp[]): Promise<WriteResult>
}

export type ReadResult =
  | { found: true; label: string; document: Record<string, unknown> }
  | { found: false; label: string; reason: string }

export type WriteResult =
  | { ok: true; verified: Record<string, unknown>; note: string }
  | { ok: false; code: string; reason: string }

// ---------------------------------------------------------------------------
// REA_HEURISTIC — the tunable analysis document
// ---------------------------------------------------------------------------
const reaHeuristicAccessor: SurfaceAccessor = {
  surface: 'REA_HEURISTIC',
  ...FIELD_ALLOWLIST.REA_HEURISTIC,
  async read() {
    const { value, tuned } = await readHeuristics()
    return { found: true, label: `${KEYS.heuristics}${tuned ? ' (tuned)' : ' (compiled defaults)'}`, document: value as unknown as Record<string, unknown> }
  },
  async write(_targetKey, document) {
    // `version` is provenance, not a tunable: a patch cannot rewrite history.
    const rest: Record<string, unknown> = { ...document }
    delete rest.version
    const written = await writeHeuristics(rest)
    const after = await readHeuristics()
    const verified = after.value as unknown as Record<string, unknown>
    return deepEqualish(written, verified)
      ? { ok: true, verified, note: `Wrote and verified ${KEYS.heuristics}; version preserved.` }
      : { ok: false, code: 'VERIFY_MISMATCH', reason: 'The heuristics document read back differently from what was written.' }
  },
}

// ---------------------------------------------------------------------------
// PROMPT_TEMPLATE — wording, retrieval priority, quality score
// ---------------------------------------------------------------------------
const promptTemplateAccessor: SurfaceAccessor = {
  surface: 'PROMPT_TEMPLATE',
  ...FIELD_ALLOWLIST.PROMPT_TEMPLATE,
  async read(targetKey) {
    const row = await db.promptTemplate.findUnique({
      where: { code: targetKey },
      select: { code: true, name: true, template: true, priority: true, quality: true, version: true, status: true },
    })
    if (!row) return { found: false, label: targetKey, reason: `No prompt template with code "${targetKey}".` }
    return { found: true, label: `${row.name} (${row.code} v${row.version})`, document: { template: row.template, priority: row.priority, quality: row.quality } }
  },
  async write(targetKey, document) {
    const row = await db.promptTemplate.findUnique({ where: { code: targetKey }, select: { id: true, template: true, priority: true, quality: true } })
    if (!row) return { ok: false, code: 'TARGET_MISSING', reason: `No prompt template with code "${targetKey}".` }

    const template = typeof document.template === 'string' ? document.template : row.template
    const bounds = SURFACE_SPECS.PROMPT_TEMPLATE.bounds.template
    if (template.length < bounds[0] || template.length > bounds[1]) {
      return { ok: false, code: 'VALUE_OUT_OF_BOUNDS', reason: `Template length ${template.length} is outside [${bounds[0]}, ${bounds[1]}].` }
    }
    const priority = clampInt(document.priority, row.priority, 1, 10)
    const quality = clampFloat(document.quality, row.quality, 0, 1)

    await db.promptTemplate.update({ where: { id: row.id }, data: { template, priority, quality } })
    const after = await db.promptTemplate.findUnique({ where: { id: row.id }, select: { template: true, priority: true, quality: true } })
    if (!after) return { ok: false, code: 'VERIFY_MISSING', reason: 'The template could not be read back after writing.' }
    const verified = { template: after.template, priority: after.priority, quality: after.quality }
    return after.template === template && after.priority === priority && Math.abs(after.quality - quality) < 1e-9
      ? { ok: true, verified, note: `PromptTemplate ${targetKey} updated and verified.` }
      : { ok: false, code: 'VERIFY_MISMATCH', reason: 'The template read back differently from what was written.' }
  },
}

// ---------------------------------------------------------------------------
// SKILL_CONFIG — the skill's configuration JSON only
// ---------------------------------------------------------------------------
const skillConfigAccessor: SurfaceAccessor = {
  surface: 'SKILL_CONFIG',
  ...FIELD_ALLOWLIST.SKILL_CONFIG,
  // The columns that define WHAT a skill is and WHAT it may do. None of these
  // is reachable through this accessor, so no patch can widen a skill.
  async read(targetKey) {
    const row = await db.skill.findUnique({ where: { slug: targetKey }, select: { id: true, slug: true, name: true, version: true, configuration: true, status: true } })
    if (!row) return { found: false, label: targetKey, reason: `No skill with slug "${targetKey}".` }
    return { found: true, label: `${row.name} (${row.slug} v${row.version})`, document: parseJson(row.configuration) }
  },
  async write(targetKey, document, ops) {
    const row = await db.skill.findUnique({ where: { slug: targetKey }, select: { id: true, version: true, configuration: true } })
    if (!row) return { ok: false, code: 'TARGET_MISSING', reason: `No skill with slug "${targetKey}".` }

    const next = JSON.stringify(document).slice(0, 60_000)
    if (next.length >= 60_000) return { ok: false, code: 'VALUE_OUT_OF_BOUNDS', reason: 'Skill configuration exceeds the 60,000-character bound.' }

    const nextVersion = bumpVersion(row.version)
    await db.$transaction([
      db.skill.update({ where: { id: row.id }, data: { configuration: next, version: nextVersion } }),
      db.skillVersion.create({
        data: {
          skillId: row.id,
          version: nextVersion,
          changelog: `Evolution Loop applied ${ops.length} operation(s): ${ops.map((o) => `${o.op} ${o.path}`).join(', ')}.`,
          schemaHash: sha256(next),
          status: 'ACTIVE',
        },
      }),
    ])

    const after = await db.skill.findUnique({ where: { id: row.id }, select: { configuration: true, version: true } })
    if (!after) return { ok: false, code: 'VERIFY_MISSING', reason: 'The skill could not be read back after writing.' }
    return after.configuration === next
      ? { ok: true, verified: parseJson(after.configuration), note: `Skill ${targetKey} configuration updated to v${after.version} and verified; a SkillVersion row records the change.` }
      : { ok: false, code: 'VERIFY_MISMATCH', reason: 'The skill configuration read back differently from what was written.' }
  },
}

// ---------------------------------------------------------------------------
// AGENT_PARAM — daily quota and model selection only
// ---------------------------------------------------------------------------
const agentParamAccessor: SurfaceAccessor = {
  surface: 'AGENT_PARAM',
  ...FIELD_ALLOWLIST.AGENT_PARAM,
  // systemPrompt is editable as PROMPT_TEMPLATE-style wording elsewhere, but
  // tools/permissions/requiresApproval define authority and are never evolvable.
  async read(targetKey) {
    const row = await db.aiAgent.findUnique({ where: { code: targetKey }, select: { code: true, name: true, dailyQuota: true, model: true, status: true } })
    if (!row) return { found: false, label: targetKey, reason: `No agent with code "${targetKey}".` }
    return { found: true, label: `${row.name} (${row.code})`, document: { dailyQuota: row.dailyQuota, model: row.model } }
  },
  async write(targetKey, document) {
    const row = await db.aiAgent.findUnique({ where: { code: targetKey }, select: { id: true, dailyQuota: true, model: true } })
    if (!row) return { ok: false, code: 'TARGET_MISSING', reason: `No agent with code "${targetKey}".` }

    const dailyQuota = clampInt(document.dailyQuota, row.dailyQuota, 1, 10_000)
    const model = typeof document.model === 'string' ? document.model.trim().slice(0, 64) : row.model

    // The model must already be verified in the platform's own registry. An
    // agent may not point itself at an arbitrary upstream model.
    if (model !== row.model && model !== 'default') {
      const deployment = await db.modelDeployment.findUnique({ where: { slug: model }, select: { slug: true } })
      if (!deployment) {
        return { ok: false, code: 'MODEL_NOT_VERIFIED', reason: `Model "${model}" is not a verified ModelDeployment slug. An agent may not select an unregistered model.` }
      }
    }

    await db.aiAgent.update({ where: { id: row.id }, data: { dailyQuota, model } })
    const after = await db.aiAgent.findUnique({ where: { id: row.id }, select: { dailyQuota: true, model: true } })
    if (!after) return { ok: false, code: 'VERIFY_MISSING', reason: 'The agent could not be read back after writing.' }
    return after.dailyQuota === dailyQuota && after.model === model
      ? { ok: true, verified: { dailyQuota: after.dailyQuota, model: after.model }, note: `Agent ${targetKey} parameters updated and verified.` }
      : { ok: false, code: 'VERIFY_MISMATCH', reason: 'The agent parameters read back differently from what were written.' }
  },
}

// ---------------------------------------------------------------------------
// PLAYBOOK — SOP steps only
// ---------------------------------------------------------------------------
const playbookAccessor: SurfaceAccessor = {
  surface: 'PLAYBOOK',
  ...FIELD_ALLOWLIST.PLAYBOOK,
  async read(targetKey) {
    const row = await db.sop.findUnique({ where: { key: targetKey }, select: { key: true, name: true, version: true, steps: true } })
    if (!row) return { found: false, label: targetKey, reason: `No SOP with key "${targetKey}".` }
    return { found: true, label: `${row.name} (${row.key} v${row.version})`, document: { steps: parseArray(row.steps) } }
  },
  async write(targetKey, document) {
    const row = await db.sop.findUnique({ where: { key: targetKey }, select: { id: true, steps: true, version: true } })
    if (!row) return { ok: false, code: 'TARGET_MISSING', reason: `No SOP with key "${targetKey}".` }

    const steps = Array.isArray(document.steps) ? document.steps.slice(0, 40) : parseArray(row.steps)
    if (steps.length < 1) return { ok: false, code: 'VALUE_OUT_OF_BOUNDS', reason: 'A playbook must keep at least one step.' }
    const next = JSON.stringify(steps)

    await db.sop.update({ where: { id: row.id }, data: { steps: next, version: bumpVersion(row.version) } })
    const after = await db.sop.findUnique({ where: { id: row.id }, select: { steps: true } })
    if (!after) return { ok: false, code: 'VERIFY_MISSING', reason: 'The SOP could not be read back after writing.' }
    return after.steps === next
      ? { ok: true, verified: { steps: parseArray(after.steps) }, note: `SOP ${targetKey} steps updated and verified.` }
      : { ok: false, code: 'VERIFY_MISMATCH', reason: 'The SOP steps read back differently from what were written.' }
  },
}

export const ACCESSORS: Record<EvolutionSurface, SurfaceAccessor> = {
  REA_HEURISTIC: reaHeuristicAccessor,
  PROMPT_TEMPLATE: promptTemplateAccessor,
  SKILL_CONFIG: skillConfigAccessor,
  AGENT_PARAM: agentParamAccessor,
  PLAYBOOK: playbookAccessor,
}

/** Reads a surface value, applying ops, without writing anything. */
export async function previewSurface(surface: EvolutionSurface, targetKey: string, ops: PatchOp[]): Promise<
  { ok: true; label: string; before: Record<string, unknown>; after: Record<string, unknown> } | { ok: false; code: string; reason: string }
> {
  const accessor = ACCESSORS[surface]
  if (!accessor) return { ok: false, code: 'SURFACE_UNKNOWN', reason: `No accessor for ${surface}.` }
  const writable = assertPatchWritable(surface, ops)
  if (!writable.ok) return { ok: false, code: 'FIELD_NOT_EDITABLE', reason: writable.reason }

  const read = await accessor.read(targetKey)
  if (!read.found) return { ok: false, code: 'TARGET_MISSING', reason: read.reason }
  return { ok: true, label: read.label, before: read.document, after: applyOps(read.document, ops) }
}

// ---------------------------------------------------------------- helpers
function clampInt(value: unknown, fallback: number, min: number, max: number): number {
  const n = Number(value)
  if (!Number.isFinite(n)) return fallback
  return Math.min(max, Math.max(min, Math.round(n)))
}
function clampFloat(value: unknown, fallback: number, min: number, max: number): number {
  const n = Number(value)
  if (!Number.isFinite(n)) return fallback
  return Math.min(max, Math.max(min, n))
}
function bumpVersion(version: string): string {
  const parts = (version || '1.0.0').split('.').map((p) => Number(p))
  if (parts.length !== 3 || parts.some((p) => !Number.isFinite(p))) return `${version || '1.0.0'}.1`
  return `${parts[0]}.${parts[1]}.${parts[2] + 1}`
}
function parseJson(value: string | null): Record<string, unknown> {
  if (!value) return {}
  try {
    const parsed = JSON.parse(value) as unknown
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : { value: parsed }
  } catch { return {} }
}
function parseArray(value: string | null): unknown[] {
  if (!value) return []
  try {
    const parsed = JSON.parse(value) as unknown
    return Array.isArray(parsed) ? parsed : []
  } catch { return [] }
}
function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex')
}
function deepEqualish(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b)
}
