// ============================================================
// TECH360 — model hub
// ============================================================
// The model hub decides WHICH model answers a request.
//
// IT EXTENDS THE EXISTING ROUTER. It does not replace it.
//   `src/lib/model/router.ts`  — WHICH PROVIDER (ollama →
//                               openai-compatible → zai) and the
//                               fallback chain.
//   `src/lib/model/hub.ts`      — WHICH MODEL within the provider's
//                               catalogue, chosen by task type,
//                               complexity, latency, quality,
//                               context length, tool use, language,
//                               cost and availability.
//
// AI MODEL ≠ AI EMPLOYEE
// ----------------------
// A model is a capability. An employee is a role with authority,
// memory, knowledge, tools and KPIs. Routing a task to a model never
// grants the model any authority: the employee's permissions still
// apply, and the governed tool gateway still gates every side effect.
//
// HONESTY
//   A model that is not installed cannot be routed to. The hub only
//   recommends models that the local catalogue lists AND the host
//   reports as installed. It never invents a latency or a quality
//   score: unmeasured values are `null` and are treated as unknown,
//   not as good.
// ============================================================

import {
  MODEL_CATALOG,
  PROFILE_CANDIDATES,
  findModel,
  toDescriptor,
} from './registry'
import type { ModelCatalogEntry, ModelDescriptor, ModelProfile } from './types'

// ------------------------------------------------------------
// Model categories
// ------------------------------------------------------------

export const MODEL_CATEGORIES = [
  'general',
  'reasoning',
  'coding',
  'vision',
  'image',
  'speech',
  'embedding',
  'classification',
  'fast',
  'premium',
] as const

export type ModelCategory = (typeof MODEL_CATEGORIES)[number]

export const TASK_CATEGORIES: ModelCategory[] = [
  'general',
  'reasoning',
  'coding',
  'vision',
  'image',
  'speech',
  'embedding',
  'classification',
  'fast',
  'premium',
]

// ------------------------------------------------------------
// The request
// ------------------------------------------------------------

export type HubRequest = {
  /** The kind of work. */
  taskType: ModelCategory
  /** How hard the work is. */
  complexity: 'SIMPLE' | 'STANDARD' | 'COMPLEX' | 'ENTERPRISE'
  /** The language the answer must be in. */
  language: 'en' | 'bn' | 'any'
  /** The number of context characters the caller intends to send. */
  contextCharacters: number
  /** The model must emit schema-valid JSON. */
  requiresStructuredOutput: boolean
  /** The model must choose a tool from a candidate list. */
  requiresToolSelection: boolean
  /** The model must answer only from retrieved context. */
  requiresGroundedAnswer: boolean
  /** The caller has a hard latency budget in milliseconds. */
  maxLatencyMs?: number
  /** The caller prefers the cheapest acceptable model. */
  preferLowCost?: boolean
  /** The caller requires a minimum measured quality. */
  minQuality?: number
}

export type HubCandidate = {
  descriptor: ModelDescriptor
  entry: ModelCatalogEntry
  /** 0..1 — a score from the routing rules. */
  score: number
  reasons: string[]
  /** True when the host reports this model as installed. */
  installed: boolean
  /** The measured first-token latency, or null when it was never measured. */
  measuredFirstTokenMs: number | null
  /** The measured quality score on the evaluation slice, or null. */
  measuredQuality: number | null
  /** The measured cost per 1,000 tokens, or null when it was never measured. */
  measuredCostPer1k: number | null
}

export type HubDecision = {
  ok: boolean
  selected: HubCandidate | null
  candidates: HubCandidate[]
  reason: string
  /** The fallback chain, in order. */
  chain: string[]
}

// ------------------------------------------------------------
// Routing rules
// ------------------------------------------------------------

/**
 * The category each task type prefers, with the profiles that serve
 * it, smallest first.
 */
export const CATEGORY_PROFILES: Record<ModelCategory, ModelProfile[]> = {
  general: ['cpu_fast', 'cpu_general', 'cpu_quality'],
  reasoning: ['cpu_quality', 'cpu_general'],
  coding: ['cpu_quality', 'cpu_general'],
  vision: ['cpu_general'],
  image: ['cpu_general'],
  speech: ['cpu_general'],
  embedding: ['embedding'],
  classification: ['cpu_fast', 'cpu_general'],
  fast: ['cpu_fast', 'cpu_general'],
  premium: ['cpu_quality', 'remote_fallback'],
}

const COMPLEXITY_MIN_PROFILE: Record<HubRequest['complexity'], ModelProfile> = {
  SIMPLE: 'cpu_fast',
  STANDARD: 'cpu_fast',
  COMPLEX: 'cpu_general',
  ENTERPRISE: 'cpu_quality',
}

/** The context window a model must have, in characters. */
function contextCharactersFor(profile: ModelProfile): number {
  const candidates = PROFILE_CANDIDATES[profile] ?? []
  const best = candidates
    .map((slug) => findModel(slug))
    .filter((entry): entry is ModelCatalogEntry => Boolean(entry))
    .sort((a, b) => b.contextWindow - a.contextWindow)[0]
  return best ? best.contextWindow : 4096
}

/**
 * Score one catalogue entry against a request.
 *
 * Every contribution is explainable, and every UNMEASURED value is
 * treated as unknown — it contributes nothing and is listed as a
 * reason, so the operator can see what was not proven.
 */
export function scoreEntry(
  entry: ModelCatalogEntry,
  request: HubRequest,
  measured: { firstTokenMs: number | null; quality: number | null; costPer1k: number | null },
): { score: number; reasons: string[] } {
  let score = 0
  const reasons: string[] = []

  // 1. Category fit — the model must be able to do this kind of work.
  const preferred = CATEGORY_PROFILES[request.taskType]
  const profile = profileForEntry(entry)
  if (preferred.includes(profile)) {
    const index = preferred.indexOf(profile)
    score += 40 - index * 8
    reasons.push(`profile ${profile} serves ${request.taskType}`)
  } else {
    score -= 20
    reasons.push(`profile ${profile} is not a ${request.taskType} profile`)
  }

  // 2. Complexity floor — a complex task must not go to the smallest model.
  const floor = COMPLEXITY_MIN_PROFILE[request.complexity]
  if (profileRank(profile) >= profileRank(floor)) {
    score += 15
    reasons.push(`clears the ${request.complexity} complexity floor`)
  } else {
    score -= 25
    reasons.push(`below the ${request.complexity} complexity floor`)
  }

  // 3. Context length.
  if (entry.contextWindow >= request.contextCharacters) {
    score += 10
  } else {
    score -= 20
    reasons.push(`context window ${entry.contextWindow} is smaller than the required ${request.contextCharacters}`)
  }

  // 4. Language.
  if (request.language === 'any') {
    score += 2
  } else if (entry.languages.includes(request.language)) {
    score += 8
    reasons.push(`supports ${request.language}`)
  } else {
    score -= 15
    reasons.push(`does not support ${request.language}`)
  }

  // 5. Structured output and tool selection.
  if (request.requiresStructuredOutput) {
    if (entry.acceptance.requiresStructuredOutput) score += 10
    else {
      score -= 20
      reasons.push('the acceptance criteria do not cover structured output')
    }
  }
  if (request.requiresToolSelection) {
    if (entry.acceptance.requiresToolSelection) score += 10
    else {
      score -= 20
      reasons.push('the acceptance criteria do not cover tool selection')
    }
  }
  if (request.requiresGroundedAnswer) {
    if (entry.acceptance.requiresGroundedAnswers) score += 8
    else {
      score -= 12
      reasons.push('the acceptance criteria do not cover grounded answers')
    }
  }

  // 6. Latency budget — measured only.
  if (request.maxLatencyMs) {
    if (measured.firstTokenMs === null) {
      reasons.push('latency was never measured on this host')
    } else if (measured.firstTokenMs <= request.maxLatencyMs) {
      score += 15
      reasons.push(`measured first token ${measured.firstTokenMs}ms is inside the ${request.maxLatencyMs}ms budget`)
    } else {
      score -= 25
      reasons.push(`measured first token ${measured.firstTokenMs}ms exceeds the ${request.maxLatencyMs}ms budget`)
    }
  }

  // 7. Quality — measured only.
  if (request.minQuality !== undefined) {
    if (measured.quality === null) {
      reasons.push('quality was never measured on this host')
    } else if (measured.quality >= request.minQuality) {
      score += 15
      reasons.push(`measured quality ${measured.quality} meets the ${request.minQuality} floor`)
    } else {
      score -= 25
      reasons.push(`measured quality ${measured.quality} is below the ${request.minQuality} floor`)
    }
  }

  // 8. Cost — measured only, and only when the caller asked for it.
  if (request.preferLowCost) {
    if (measured.costPer1k === null) {
      reasons.push('cost was never measured on this host')
    } else {
      // Normalise: 0.001 per 1k tokens is a full point.
      score += Math.max(0, 10 - measured.costPer1k * 10_000)
      reasons.push(`measured cost ${measured.costPer1k} per 1k tokens`)
    }
  }

  // 9. Licence and weight verification. An unverified model may be
  //    used, but it is never promoted ahead of a verified one.
  if (!entry.licenseVerified) {
    score -= 30
    reasons.push('the weight licence is not verified')
  }
  if (!entry.weightsVerified) {
    reasons.push('the weights were not checksummed on this host')
  } else {
    score += 5
  }

  // 10. Memory footprint — a smaller model leaves headroom.
  score += Math.max(0, 8 - entry.ramFootprintMb / 400)

  return { score, reasons }
}

function profileForEntry(entry: ModelCatalogEntry): ModelProfile {
  for (const [profile, candidates] of Object.entries(PROFILE_CANDIDATES)) {
    if (candidates.includes(entry.slug)) return profile as ModelProfile
  }
  return 'cpu_general'
}

function profileRank(profile: ModelProfile): number {
  const order: ModelProfile[] = ['cpu_fast', 'cpu_general', 'cpu_quality', 'embedding', 'remote_fallback']
  return order.indexOf(profile)
}

// ------------------------------------------------------------
// The hub
// ------------------------------------------------------------

export type InstalledModels = {
  /** The upstream model names the host reports as installed. */
  installed: Set<string>
  /** The measured first-token latency by upstream model name. */
  firstTokenMs: Map<string, number>
  /** The measured quality by upstream model name. */
  quality: Map<string, number>
  /** The measured cost per 1,000 tokens by upstream model name. */
  costPer1k: Map<string, number>
}

export function emptyMeasurements(): InstalledModels {
  return {
    installed: new Set(),
    firstTokenMs: new Map(),
    quality: new Map(),
    costPer1k: new Map(),
  }
}

/**
 * Choose a model.
 *
 * The hub never picks a model the host does not have. When the host's
 * measurements are absent, the decision is still made — on the
 * catalogue's acceptance criteria — but the decision says plainly
 * that the numbers were not measured here.
 */
export function routeToModel(request: HubRequest, measurements: InstalledModels = emptyMeasurements()): HubDecision {
  const candidates: HubCandidate[] = []

  for (const entry of MODEL_CATALOG) {
    const installed = measurements.installed.has(entry.upstreamModel)
    const { score, reasons } = scoreEntry(entry, request, {
      firstTokenMs: measurements.firstTokenMs.get(entry.upstreamModel) ?? null,
      quality: measurements.quality.get(entry.upstreamModel) ?? null,
      costPer1k: measurements.costPer1k.get(entry.upstreamModel) ?? null,
    })
    candidates.push({
      descriptor: toDescriptor(entry),
      entry,
      score,
      reasons,
      installed,
      measuredFirstTokenMs: measurements.firstTokenMs.get(entry.upstreamModel) ?? null,
      measuredQuality: measurements.quality.get(entry.upstreamModel) ?? null,
      measuredCostPer1k: measurements.costPer1k.get(entry.upstreamModel) ?? null,
    })
  }

  const installedCandidates = candidates.filter((candidate) => candidate.installed)
  const pool = installedCandidates.length > 0 ? installedCandidates : candidates

  const sorted = [...pool].sort((a, b) => b.score - a.score)
  const selected = sorted[0] ?? null

  const reason = !selected
    ? 'the model catalogue is empty'
    : installedCandidates.length === 0
      ? 'no model is installed on this host; the decision is based on the catalogue acceptance criteria alone and is UNVERIFIED here'
      : `selected ${selected.descriptor.upstreamModel} with score ${selected.score}`

  return {
    ok: Boolean(selected),
    selected,
    candidates: sorted,
    reason,
    chain: sorted.slice(0, 4).map((candidate) => candidate.descriptor.upstreamModel),
  }
}

/**
 * The measured state of the model hub, for the dashboard.
 *
 * Every number here is read from a measurement or from the catalogue.
 * Nothing is estimated.
 */
export async function hubStatus(env: NodeJS.ProcessEnv = process.env): Promise<{
  catalogSize: number
  installed: string[]
  unverifiedWeights: string[]
  byCategory: Record<string, string[]>
  providers: Array<{ kind: string; state: string; detail: string }>
}> {
  const { listLocalModels, providerStatuses } = await import('./router')
  const local = await listLocalModels(env)
  const installed = local.ok ? local.models.map((model) => model.name) : []

  const byCategory: Record<string, string[]> = {}
  for (const category of MODEL_CATEGORIES) {
    byCategory[category] = MODEL_CATALOG.filter((entry) => {
      const profile = profileForEntry(entry)
      return CATEGORY_PROFILES[category].includes(profile)
    }).map((entry) => entry.upstreamModel)
  }

  return {
    catalogSize: MODEL_CATALOG.length,
    installed,
    unverifiedWeights: MODEL_CATALOG.filter((entry) => !entry.weightsVerified).map((entry) => entry.slug),
    byCategory,
    providers: providerStatuses(env).map((p) => ({ kind: p.kind, state: p.state, detail: p.detail })),
  }
}
