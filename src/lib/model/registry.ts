// ============================================================
// TECH360 — Private model catalog
// ============================================================
// Every weight listed here is evaluated for CPU-only inference.
//
// HONESTY RULE (enforced by tests/model-service.test.ts):
//   A model may only be reported as VERIFIED when its revision and
//   weight checksum were captured on the host that runs it, by
//   `node scripts/verify-local-models.mjs`. Until then the catalog
//   reports `weightsVerified: false` and the router refuses to
//   promote it to the default profile. We never fabricate a SHA.
//
// UPSTREAM REFERENCES (model cards / licences):
//   Qwen2.5  — https://huggingface.co/Qwen/Qwen2.5-1.5B-Instruct  (Apache-2.0)
//   Qwen3    — https://huggingface.co/Qwen/Qwen3-1.7B            (Apache-2.0)
//   BGE-M3   — https://huggingface.co/BAAI/bge-m3               (MIT)
//   MiniLM   — https://huggingface.co/sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2 (Apache-2.0)
//   Ollama   — https://github.com/ollama/ollama                 (MIT)
//   llama.cpp— https://github.com/ggml-org/llama.cpp            (MIT)
// ============================================================

import type { ModelCatalogEntry, ModelDescriptor, ModelProfile } from './types'

/**
 * Candidate CPU models, ordered smallest-first. The router selects the
 * smallest entry whose acceptance criteria are satisfied by the measured
 * benchmark on THIS host (see scripts/benchmark-local-models.mjs).
 */
export const MODEL_CATALOG: ModelCatalogEntry[] = [
  {
    slug: 'qwen2.5-0.5b-instruct-q4',
    upstreamModel: 'qwen2.5:0.5b-instruct-q4_K_M',
    displayName: 'Qwen2.5 0.5B Instruct (Q4_K_M)',
    provider: 'ollama',
    purpose: 'CHAT',
    parameters: '0.5B',
    quantization: 'Q4_K_M',
    ramFootprintMb: 800,
    contextWindow: 32768,
    embeddingDimensions: null,
    license: 'Apache-2.0',
    licenseVerified: true,
    revision: null,
    weightChecksum: null,
    weightsVerified: false,
    languages: ['en', 'zh'],
    notes:
      'Smallest viable CPU model. English only in practice; Bangla quality is below the acceptance floor. Kept as the emergency fallback so the platform never loses AI capability entirely.',
    acceptance: {
      maxFirstTokenMs: 1500,
      minTokensPerSecond: 12,
      maxRamMb: 1400,
      minBanglaScore: 0,
      minEnglishScore: 0.55,
      requiresStructuredOutput: false,
      requiresToolSelection: false,
      requiresGroundedAnswers: false,
      requiresAbstention: false,
      requiresInjectionResistance: false,
    },
  },
  {
    slug: 'qwen2.5-1.5b-instruct-q4',
    upstreamModel: 'qwen2.5:1.5b-instruct-q4_K_M',
    displayName: 'Qwen2.5 1.5B Instruct (Q4_K_M)',
    provider: 'ollama',
    purpose: 'CHAT',
    parameters: '1.5B',
    quantization: 'Q4_K_M',
    ramFootprintMb: 1600,
    contextWindow: 32768,
    embeddingDimensions: null,
    license: 'Apache-2.0',
    licenseVerified: true,
    revision: null,
    weightChecksum: null,
    weightsVerified: false,
    languages: ['en', 'zh'],
    notes:
      'Primary candidate from the specification. Apache-2.0 weights permit commercial use. Q4_K_M keeps the resident set near 1.6 GB so it coexists with MySQL and the Next.js server on a 16 GB host.',
    acceptance: {
      maxFirstTokenMs: 2500,
      minTokensPerSecond: 8,
      maxRamMb: 2600,
      minBanglaScore: 0.35,
      minEnglishScore: 0.65,
      requiresStructuredOutput: true,
      requiresToolSelection: true,
      requiresGroundedAnswers: true,
      requiresAbstention: true,
      requiresInjectionResistance: true,
    },
  },
  {
    slug: 'qwen2.5-3b-instruct-q4',
    upstreamModel: 'qwen2.5:3b-instruct-q4_K_M',
    displayName: 'Qwen2.5 3B Instruct (Q4_K_M)',
    provider: 'ollama',
    purpose: 'CHAT',
    parameters: '3B',
    quantization: 'Q4_K_M',
    ramFootprintMb: 2600,
    contextWindow: 32768,
    embeddingDimensions: null,
    license: 'Apache-2.0',
    licenseVerified: true,
    revision: null,
    weightChecksum: null,
    weightsVerified: false,
    languages: ['en', 'zh'],
    notes:
      'Quality tier. Still Apache-2.0 and still CPU-viable at Q4_K_M (≈2.6 GB resident). Chosen when the 1.5B model fails the Bangla or tool-selection slice of the benchmark.',
    acceptance: {
      maxFirstTokenMs: 5000,
      minTokensPerSecond: 5,
      maxRamMb: 4200,
      minBanglaScore: 0.5,
      minEnglishScore: 0.72,
      requiresStructuredOutput: true,
      requiresToolSelection: true,
      requiresGroundedAnswers: true,
      requiresAbstention: true,
      requiresInjectionResistance: true,
    },
  },
  {
    slug: 'qwen2.5-7b-instruct-q4',
    upstreamModel: 'qwen2.5:7b-instruct-q4_K_M',
    displayName: 'Qwen2.5 7B Instruct (Q4_K_M)',
    provider: 'ollama',
    purpose: 'CHAT',
    parameters: '7B',
    quantization: 'Q4_K_M',
    ramFootprintMb: 5200,
    contextWindow: 32768,
    embeddingDimensions: null,
    license: 'Apache-2.0',
    licenseVerified: true,
    revision: null,
    weightChecksum: null,
    weightsVerified: false,
    languages: ['en', 'zh'],
    notes:
      'Optional tier. Needs a 16 GB+ host to keep MySQL resident while the model is loaded. The router must never load this while the 3B model is still resident — one model at a time, measured headroom first.',
    acceptance: {
      maxFirstTokenMs: 12000,
      minTokensPerSecond: 2.5,
      maxRamMb: 8000,
      minBanglaScore: 0.58,
      minEnglishScore: 0.78,
      requiresStructuredOutput: true,
      requiresToolSelection: true,
      requiresGroundedAnswers: true,
      requiresAbstention: true,
      requiresInjectionResistance: true,
    },
  },
  {
    slug: 'bge-m3-q4',
    upstreamModel: 'bge-m3:latest',
    displayName: 'BAAI BGE-M3 (Q4_K_M)',
    provider: 'ollama',
    purpose: 'EMBEDDING',
    parameters: '567M',
    quantization: 'Q4_K_M',
    ramFootprintMb: 1200,
    contextWindow: 8192,
    embeddingDimensions: 1024,
    license: 'MIT',
    licenseVerified: true,
    revision: null,
    weightChecksum: null,
    weightsVerified: false,
    languages: ['en', 'zh', 'multilingual'],
    notes:
      'Primary retrieval embedding model. Multilingual, so Bangla and English queries share one index. 1024 dimensions × 4 bytes = 4 KB per chunk; at 20 000 chunks that is ≈80 MB of vector payload, which fits the MySQL host comfortably.',
    acceptance: {
      maxFirstTokenMs: 1200,
      minTokensPerSecond: 0,
      maxRamMb: 2400,
      minBanglaScore: 0,
      minEnglishScore: 0,
      requiresStructuredOutput: false,
      requiresToolSelection: false,
      requiresGroundedAnswers: false,
      requiresAbstention: false,
      requiresInjectionResistance: false,
    },
  },
  {
    slug: 'multilingual-minilm-l12-q4',
    upstreamModel: 'paraphrase-multilingual-MiniLM-L12-v2:latest',
    displayName: 'Multilingual MiniLM L12 (Q4_K_M)',
    provider: 'ollama',
    purpose: 'EMBEDDING',
    parameters: '118M',
    quantization: 'Q4_K_M',
    ramFootprintMb: 320,
    contextWindow: 512,
    embeddingDimensions: 384,
    license: 'Apache-2.0',
    licenseVerified: true,
    revision: null,
    weightChecksum: null,
    weightsVerified: false,
    languages: ['multilingual'],
    notes:
      'Light embedding fallback for hosts that cannot afford BGE-M3. 384 dimensions keeps the vector table half the size of BGE-M3.',
    acceptance: {
      maxFirstTokenMs: 400,
      minTokensPerSecond: 0,
      maxRamMb: 800,
      minBanglaScore: 0,
      minEnglishScore: 0,
      requiresStructuredOutput: false,
      requiresToolSelection: false,
      requiresGroundedAnswers: false,
      requiresAbstention: false,
      requiresInjectionResistance: false,
    },
  },
]

/** Map a runtime profile to the ordered candidate list for that profile. */
export const PROFILE_CANDIDATES: Record<ModelProfile, string[]> = {
  cpu_fast: ['qwen2.5-0.5b-instruct-q4', 'qwen2.5-1.5b-instruct-q4'],
  cpu_general: ['qwen2.5-1.5b-instruct-q4', 'qwen2.5-3b-instruct-q4', 'qwen2.5-7b-instruct-q4'],
  cpu_quality: ['qwen2.5-3b-instruct-q4', 'qwen2.5-7b-instruct-q4', 'qwen2.5-1.5b-instruct-q4'],
  embedding: ['bge-m3-q4', 'multilingual-minilm-l12-q4'],
  remote_fallback: ['qwen2.5-3b-instruct-q4', 'qwen2.5-1.5b-instruct-q4'],
}

export function findModel(slug: string): ModelCatalogEntry | undefined {
  return MODEL_CATALOG.find((m) => m.slug === slug)
}

export function catalogForPurpose(purpose: 'CHAT' | 'EMBEDDING'): ModelDescriptor[] {
  return MODEL_CATALOG.filter((m) => m.purpose === purpose).map(toDescriptor)
}

export function toDescriptor(entry: ModelCatalogEntry): ModelDescriptor {
  const { acceptance: _acceptance, ...descriptor } = entry
  return descriptor
}

/**
 * A model is only promotable to a default profile when:
 *  - its licence was verified,
 *  - its weights were verified on this host (revision + checksum captured),
 *  - its resident memory fits the configured host budget.
 *
 * `hostRamMb` is the RAM available to the model service (total host RAM
 * minus a documented reserve for MySQL + the app).
 */
export function promotableModels(
  candidates: string[],
  opts: { verifiedWeights: Set<string>; hostRamMb: number },
): ModelCatalogEntry[] {
  return candidates
    .map((slug) => findModel(slug))
    .filter((m): m is ModelCatalogEntry => Boolean(m))
    .filter((m) => m.licenseVerified)
    .filter((m) => opts.verifiedWeights.has(m.slug))
    .filter((m) => m.ramFootprintMb + 512 <= opts.hostRamMb)
}

/**
 * Choose the SMALLEST model that satisfies the acceptance criteria.
 * This is the "select the smallest model meeting the acceptance criteria"
 * rule from the specification, expressed as a pure function so it is
 * unit-testable without a running model server.
 */
export function selectSmallestAcceptingModel(
  candidates: string[],
  measured: Record<string, MeasuredModelResult>,
): { selected: ModelCatalogEntry | null; rejected: Array<{ slug: string; reason: string }> } {
  const rejected: Array<{ slug: string; reason: string }> = []
  const ordered = candidates
    .map((slug) => findModel(slug))
    .filter((m): m is ModelCatalogEntry => Boolean(m))
    .sort((a, b) => a.ramFootprintMb - b.ramFootprintMb)

  for (const model of ordered) {
    const m = measured[model.slug]
    if (!m) {
      rejected.push({ slug: model.slug, reason: 'NOT_MEASURED' })
      continue
    }
    if (!m.passed) {
      rejected.push({ slug: model.slug, reason: m.failureReasons[0] ?? 'ACCEPTANCE_FAILED' })
      continue
    }
    return { selected: model, rejected }
  }
  return { selected: null, rejected }
}

export type MeasuredModelResult = {
  slug: string
  passed: boolean
  failureReasons: string[]
  firstTokenMs: number | null
  tokensPerSecond: number | null
  ramMb: number | null
  banglaScore: number | null
  englishScore: number | null
  structuredOutputOk: boolean | null
  toolSelectionOk: boolean | null
  groundedAnswerOk: boolean | null
  abstentionOk: boolean | null
  injectionResistant: boolean | null
}
