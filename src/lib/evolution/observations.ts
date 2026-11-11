/**
 * TECH360 — Evolution Loop: observation store
 * ============================================
 * Where the loop's evidence lives. Observations are stored in the existing
 * `Setting` key/value table rather than a new model, because they are small,
 * bounded, aggregated JSON — and because adding a table for every internal
 * signal is how a schema turns into sediment.
 *
 * Aggregation is deliberate: one row per (kind, subject), with a `count` that
 * grows. That is what lets a proposal say "this was wrong four times" instead
 * of "this was wrong once, four separate rows". It also bounds the table — a
 * thousand corrections about the same fingerprint do not become a thousand
 * rows.
 *
 * `consumedBy` marks the generation that read an observation. Consumed
 * observations are kept, not deleted: the lineage of a change must be able to
 * point back at the evidence that motivated it, forever.
 */
import { db } from '@/lib/db'
import type { EvolutionSurface } from './policy'
import { DEFAULT_HEURISTICS, type Heuristics, type ObservationKind } from './loop'

export const KEYS = {
  heuristics: 'rea.heuristics',
  generation: 'evolution.generation.current',
  observationPrefix: 'rea.obs.',
} as const

export type StoredObservation = {
  kind: ObservationKind
  detail: string
  subject: string | null
  ref: string
  refId: string | null
  surface?: EvolutionSurface
  count: number
  firstAt: string
  lastAt: string
  recordedBy: string | null
  consumedBy: number | null
}

/** Keys a (kind, subject) pair to one stable Setting key. */
function observationKey(kind: string, subject: string | null): string {
  const slug = (subject ?? 'general')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60) || 'general'
  return `${KEYS.observationPrefix}${kind.toLowerCase()}.${slug}`
}

/**
 * Records (or re-records) an observation. Repeating the same kind+subject
 * increments `count` and refreshes `detail`, which is the signal that makes a
 * proposal worth a reviewer's attention.
 */
export async function recordObservation(input: {
  kind: string
  detail: string
  subject?: string | null
  ref: string
  refId?: string | null
  surface?: EvolutionSurface
  actor: string
}): Promise<StoredObservation> {
  const kind = normalizeKind(input.kind)
  const key = observationKey(kind, input.subject ?? null)
  const now = new Date().toISOString()

  const existing = await db.setting.findUnique({ where: { key } })
  const prior = existing ? (safeParse(existing.value) as StoredObservation | null) : null

  const next: StoredObservation = {
    kind,
    detail: input.detail.slice(0, 800),
    subject: (input.subject ?? null)?.slice(0, 120) ?? null,
    ref: input.ref.slice(0, 160),
    refId: input.refId ?? prior?.refId ?? null,
    ...(input.surface ? { surface: input.surface } : prior?.surface ? { surface: prior.surface } : {}),
    count: (prior?.count ?? 0) + 1,
    firstAt: prior?.firstAt ?? now,
    lastAt: now,
    recordedBy: input.actor,
    // A new observation re-opens the question even if a prior generation
    // already consumed it, so the loop can respond to a repeat.
    consumedBy: null,
  }

  await db.setting.upsert({
    where: { key },
    create: { key, value: JSON.stringify(next) },
    update: { value: JSON.stringify(next) },
  })

  return next
}

/** Unconsumed observations, most-repeated first — repeat evidence leads. */
export async function readPendingObservations(limit = 200): Promise<StoredObservation[]> {
  const rows = await db.setting.findMany({
    where: { key: { startsWith: KEYS.observationPrefix } },
    take: 2000,
  })
  const observations = rows
    .map((row) => ({ key: row.key, value: safeParse(row.value) as StoredObservation | null }))
    .filter((row): row is { key: string; value: StoredObservation } => Boolean(row.value))
    .filter((row) => row.value.consumedBy === null)
    .sort((a, b) => b.value.count - a.value.count || b.value.lastAt.localeCompare(a.value.lastAt))
    .slice(0, limit)
  return observations.map((row) => row.value)
}

/** Marks observations as consumed by a generation. Kept, never deleted. */
export async function markObservationsConsumed(input: {
  keys: string[]
  generation: number
}): Promise<number> {
  if (!input.keys.length) return 0
  let updated = 0
  for (const key of input.keys.slice(0, 500)) {
    const row = await db.setting.findUnique({ where: { key } })
    if (!row) continue
    const value = safeParse(row.value) as StoredObservation | null
    if (!value) continue
    value.consumedBy = input.generation
    await db.setting.update({ where: { key }, data: { value: JSON.stringify(value) } })
    updated += 1
  }
  return updated
}

/** Recomputes the Setting keys for the pending observations, for consumption. */
export function keysFor(observations: StoredObservation[]): string[] {
  return observations.map((o) => observationKey(o.kind, o.subject))
}

/** The tunable heuristics document, or the compiled defaults if never tuned. */
export async function readHeuristics(): Promise<{ value: Heuristics; tuned: boolean }> {
  const row = await db.setting.findUnique({ where: { key: KEYS.heuristics } })
  if (!row) return { value: DEFAULT_HEURISTICS as unknown as Heuristics, tuned: false }
  const parsed = safeParse(row.value) as Partial<Heuristics> | null
  if (!parsed) return { value: DEFAULT_HEURISTICS as unknown as Heuristics, tuned: false }
  // Merge over the defaults so a partially-written document can never remove a
  // bound the engine relies on.
  return { value: deepMerge(DEFAULT_HEURISTICS as unknown as Heuristics, parsed) as Heuristics, tuned: true }
}

export async function writeHeuristics(value: Record<string, unknown>): Promise<Heuristics> {
  const merged = deepMerge(DEFAULT_HEURISTICS as unknown as Record<string, unknown>, value)
  await db.setting.upsert({
    where: { key: KEYS.heuristics },
    create: { key: KEYS.heuristics, value: JSON.stringify(merged) },
    update: { value: JSON.stringify(merged) },
  })
  return merged as unknown as Heuristics
}

/** The current generation number (the last one opened), or 0 if none yet. */
export async function readCurrentGeneration(): Promise<number> {
  const row = await db.setting.findUnique({ where: { key: KEYS.generation } })
  const parsed = row ? (safeParse(row.value) as { generation?: number } | null) : null
  const generation = Number(parsed?.generation ?? 0)
  return Number.isFinite(generation) && generation > 0 ? Math.floor(generation) : 0
}

export async function writeCurrentGeneration(generation: number): Promise<void> {
  const value = JSON.stringify({ generation, updatedAt: new Date().toISOString() })
  await db.setting.upsert({
    where: { key: KEYS.generation },
    create: { key: KEYS.generation, value },
    update: { value },
  })
}

const VALID_KINDS: ObservationKind[] = [
  'TEARDOWN_CORRECTED',
  'FINGERPRINT_FALSE_POSITIVE',
  'FINGERPRINT_FALSE_NEGATIVE',
  'CAPTURE_REFUSED',
  'CAPTURE_FAILED',
  'SKILL_RUN_FAILED',
  'SKILL_RUN_SLOW',
  'RECONSTRUCTION_REJECTED',
  'OPERATOR_FEEDBACK',
  'GUARD_ATTEMPT',
]

export function normalizeKind(input: string): ObservationKind {
  const value = (input ?? '').trim().toUpperCase().replace(/[\s-]+/g, '_')
  return (VALID_KINDS as string[]).includes(value) ? (value as ObservationKind) : 'OPERATOR_FEEDBACK'
}

export function observationKinds(): readonly ObservationKind[] {
  return VALID_KINDS
}

function safeParse(value: string | null): unknown {
  if (!value) return null
  try { return JSON.parse(value) } catch { return null }
}

function deepMerge<T extends Record<string, unknown>>(base: T, patch: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = { ...base }
  for (const [key, value] of Object.entries(patch)) {
    const current = out[key]
    if (value && typeof value === 'object' && !Array.isArray(value) && current && typeof current === 'object' && !Array.isArray(current)) {
      out[key] = deepMerge(current as Record<string, unknown>, value as Record<string, unknown>)
    } else if (value !== undefined) {
      out[key] = value
    }
  }
  return out
}
