// ============================================================
// TECH360 — Private model service · type contracts
// ============================================================
// The private model service is a LOCAL, self-hosted inference layer.
// It is never exposed directly to the public internet: only the
// authenticated gateway under /api/model/v1/* may reach it, and the
// gateway only accepts loopback/private upstream hosts (SSRF guard).
// ============================================================

export type ModelProviderKind = 'ollama' | 'openai-compatible' | 'zai' | 'none'

export type ModelProviderState =
  | 'CONFIGURED'
  | 'NOT_CONFIGURED'
  | 'MISCONFIGURED'
  | 'UNREACHABLE'

export type ModelPurpose = 'CHAT' | 'EMBEDDING' | 'RERANK'

/**
 * A model profile groups a provider with the concrete weights it serves.
 * `cpu_general` is the default profile for the agent runtime; the router
 * picks the smallest profile that satisfies the request.
 */
export type ModelProfile = 'cpu_fast' | 'cpu_general' | 'cpu_quality' | 'embedding' | 'remote_fallback'

export type ModelDescriptor = {
  /** Stable slug used in configuration and audit records. */
  slug: string
  /** Upstream model reference exactly as the provider spells it. */
  upstreamModel: string
  displayName: string
  provider: ModelProviderKind
  purpose: ModelPurpose
  parameters: string
  quantization: string
  /** Approximate resident memory in MB for CPU inference at this quantization. */
  ramFootprintMb: number
  contextWindow: number
  embeddingDimensions: number | null
  /** SPDX identifier of the weight license, or a marker that it is unverified. */
  license: string
  licenseVerified: boolean
  /** Upstream revision (commit SHA) of the weight snapshot. */
  revision: string | null
  /** sha256 of the weight file(s) as downloaded. */
  weightChecksum: string | null
  /** Whether the weights have been pulled and checksummed on this host. */
  weightsVerified: boolean
  languages: string[]
  notes: string
}

export type ModelCatalogEntry = ModelDescriptor & {
  /** Acceptance criteria that must pass before a model may be promoted. */
  acceptance: ModelAcceptanceCriteria
}

export type ModelAcceptanceCriteria = {
  /** Maximum first-token latency in milliseconds. */
  maxFirstTokenMs: number
  /** Minimum generation throughput in tokens/second. */
  minTokensPerSecond: number
  /** Maximum resident memory in MB. */
  maxRamMb: number
  /** Minimum score (0-1) on the Bangla evaluation slice. */
  minBanglaScore: number
  /** Minimum score (0-1) on the English evaluation slice. */
  minEnglishScore: number
  /** Must emit schema-valid JSON when asked for structured output. */
  requiresStructuredOutput: boolean
  /** Must pick the correct tool from a candidate list. */
  requiresToolSelection: boolean
  /** Must answer from retrieved context without inventing facts. */
  requiresGroundedAnswers: boolean
  /** Must refuse/ask when the evidence is missing. */
  requiresAbstention: boolean
  /** Must ignore instructions embedded in retrieved documents. */
  requiresInjectionResistance: boolean
}

export type ChatMessage = {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export type ChatCompletionRequest = {
  model?: string
  messages: ChatMessage[]
  temperature?: number
  maxTokens?: number
  topP?: number
  stop?: string[]
  /** When true the provider must answer with a single JSON object. */
  jsonMode?: boolean
  /** Optional caller-supplied timeout. */
  timeoutMs?: number
  /** Correlation id propagated into audit records. */
  correlationId?: string
}

export type ChatCompletionResult = {
  ok: boolean
  provider: ModelProviderKind
  model: string
  content: string
  /** Milliseconds to the first token, when the provider reports it. */
  firstTokenMs: number | null
  durationMs: number
  tokensUsed: number | null
  finishReason: string | null
  error: string | null
  errorCode: string | null
}

export type EmbeddingRequest = {
  model?: string
  input: string | string[]
  correlationId?: string
}

export type EmbeddingResult = {
  ok: boolean
  provider: ModelProviderKind
  model: string
  vectors: number[][]
  dimensions: number | null
  durationMs: number
  error: string | null
  errorCode: string | null
}

export type ProviderStatus = {
  kind: ModelProviderKind
  state: ModelProviderState
  detail: string
  baseUrl: string | null
  /** True when the upstream is a loopback/private address (the only allowed kind). */
  privateOnly: boolean
  chatModel: string | null
  embeddingModel: string | null
}

export type ModelServiceStatus = {
  state: 'AVAILABLE' | 'DEGRADED' | 'UNAVAILABLE'
  detail: string
  providers: ProviderStatus[]
  catalog: ModelDescriptor[]
  gateway: {
    /** True when MODEL_API_KEY is set — the gateway refuses to serve without it. */
    enabled: boolean
    detail: string
  }
}
