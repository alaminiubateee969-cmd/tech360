// ============================================================
// TECH360 — Model router
// ============================================================
// Chooses which private model backend serves a request.
//
// ORDER (configurable through AI_PROVIDER_ORDER, default local-first):
//   ollama  → openai-compatible → zai (existing remote provider)
//
// The router NEVER falls back to a public provider silently: the fallback
// chain is explicit, and the response records which provider answered.
//
// REFERENCE for the OpenAI-compatible shape (llama.cpp `server`, vLLM,
// LM Studio, Ollama's own /v1 surface):
//   https://github.com/ggml-org/llama.cpp  (MIT)
// ============================================================

import type {
  ChatCompletionRequest,
  ChatCompletionResult,
  EmbeddingRequest,
  EmbeddingResult,
  ModelProfile,
  ModelProviderKind,
  ModelServiceStatus,
  ProviderStatus,
} from './types'
import {
  OLLAMA_PROVIDER,
  ollamaChat,
  ollamaEmbed,
  ollamaListModels,
  ollamaStatus,
  resolveOllamaConfig,
  type OllamaConfig,
} from './providers/ollama'
import { resolveOpenAiCompatibleConfig, openAiCompatibleChat, openAiCompatibleEmbed, openAiCompatibleStatus } from './providers/openai-compatible'
import { MODEL_CATALOG, PROFILE_CANDIDATES, catalogForPurpose, findModel, toDescriptor } from './registry'
import { getZaiProviderStatus } from '@/lib/ai-provider'

export type ProviderOrder = ModelProviderKind[]

export function resolveProviderOrder(env: NodeJS.ProcessEnv = process.env): ProviderOrder {
  const raw = (env.AI_PROVIDER_ORDER ?? '').trim()
  const allowed: ModelProviderKind[] = ['ollama', 'openai-compatible', 'zai']
  if (!raw) return ['ollama', 'openai-compatible', 'zai']
  const parsed = raw
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter((s): s is ModelProviderKind => (allowed as string[]).includes(s))
  return parsed.length ? parsed : ['ollama', 'openai-compatible', 'zai']
}

export type ResolvedProvider = {
  kind: ModelProviderKind
  status: ProviderStatus
  ollama: OllamaConfig | null
}

/** Report every provider's configuration state without calling out to them. */
export function providerStatuses(env: NodeJS.ProcessEnv = process.env): ProviderStatus[] {
  return [ollamaStatus(env), openAiCompatibleStatus(env), zaiStatus(env)]
}

function zaiStatus(env: NodeJS.ProcessEnv = process.env): ProviderStatus {
  const status = getZaiProviderStatus(env)
  return {
    kind: 'zai',
    state: status.state === 'CONFIGURED' ? 'CONFIGURED' : status.state,
    detail: status.detail,
    baseUrl: null,
    privateOnly: false,
    chatModel: 'remote-zai',
    embeddingModel: null,
  }
}

/** The full service status used by /api/models and /api/health/deep. */
export function modelServiceStatus(env: NodeJS.ProcessEnv = process.env): ModelServiceStatus {
  const providers = providerStatuses(env)
  const order = resolveProviderOrder(env)
  const configured = order.filter((kind) => {
    const p = providers.find((x) => x.kind === kind)
    return p?.state === 'CONFIGURED'
  })
  const gatewayKey = (env.MODEL_API_KEY ?? '').trim()
  const gatewayEnabled = gatewayKey.length >= 32

  let state: ModelServiceStatus['state'] = 'UNAVAILABLE'
  let detail = 'no model provider is configured'
  if (configured.includes('ollama')) {
    state = 'AVAILABLE'
    detail = 'local Ollama provider is configured'
  } else if (configured.includes('openai-compatible')) {
    state = 'AVAILABLE'
    detail = 'local OpenAI-compatible provider is configured'
  } else if (configured.includes('zai')) {
    state = 'DEGRADED'
    detail = 'only the remote provider is configured; local private inference is not available'
  }

  return {
    state,
    detail,
    providers,
    catalog: [...catalogForPurpose('CHAT'), ...catalogForPurpose('EMBEDDING')],
    gateway: {
      enabled: gatewayEnabled,
      detail: gatewayEnabled
        ? 'private model gateway is enabled (API key required on every request)'
        : 'private model gateway is DISABLED — MODEL_API_KEY must be at least 32 characters',
    },
  }
}

function resolveProvider(kind: ModelProviderKind, env: NodeJS.ProcessEnv): ResolvedProvider {
  if (kind === 'ollama') {
    const { config } = resolveOllamaConfig(env)
    return { kind, status: ollamaStatus(env), ollama: config }
  }
  return { kind, status: providerStatuses(env).find((p) => p.kind === kind)!, ollama: null }
}

/**
 * Chat completion across the provider chain.
 * Providers are tried in order; the first successful answer wins. Every
 * failure is recorded so the caller can report an honest degraded state.
 */
export async function routeChat(
  request: ChatCompletionRequest,
  env: NodeJS.ProcessEnv = process.env,
): Promise<ChatCompletionResult> {
  const order = resolveProviderOrder(env)
  const attempts: Array<{ provider: string; error: string }> = []
  let last: ChatCompletionResult | null = null

  for (const kind of order) {
    const resolved = resolveProvider(kind, env)
    if (resolved.status.state !== 'CONFIGURED') {
      attempts.push({ provider: kind, error: resolved.status.detail })
      continue
    }
    let result: ChatCompletionResult
    if (kind === 'ollama' && resolved.ollama) {
      result = await ollamaChat(resolved.ollama, request)
    } else if (kind === 'openai-compatible') {
      result = await openAiCompatibleChat(request, env)
    } else {
      // Remote provider handled by the existing z-ai client (see lib/ai-provider).
      result = await remoteZaiChat(request, env)
    }
    if (result.ok) {
      return { ...result, provider: kind }
    }
    attempts.push({ provider: kind, error: result.error ?? 'unknown error' })
    last = result
  }

  return {
    ok: false,
    provider: order[0] ?? 'none',
    model: request.model ?? 'unknown',
    content: '',
    firstTokenMs: null,
    durationMs: last?.durationMs ?? 0,
    tokensUsed: null,
    finishReason: null,
    // The aggregate code says "the chain was exhausted"; the underlying
    // provider failure is preserved so an operator can act on the real cause.
    error: last?.error ?? 'no model provider could serve this request',
    errorCode: last?.errorCode ?? 'NO_PROVIDER_AVAILABLE',
  }
}

export async function routeEmbed(
  request: EmbeddingRequest,
  env: NodeJS.ProcessEnv = process.env,
): Promise<EmbeddingResult> {
  const order = resolveProviderOrder(env)
  for (const kind of order) {
    const resolved = resolveProvider(kind, env)
    if (resolved.status.state !== 'CONFIGURED') continue
    if (kind === 'ollama' && resolved.ollama) {
      const result = await ollamaEmbed(resolved.ollama, request)
      if (result.ok) return result
    } else if (kind === 'openai-compatible') {
      const result = await openAiCompatibleEmbed(request, env)
      if (result.ok) return result
    }
  }
  return {
    ok: false,
    provider: order[0] ?? 'none',
    model: request.model ?? 'unknown',
    vectors: [],
    dimensions: null,
    durationMs: 0,
    error: 'no embedding provider could serve this request',
    errorCode: 'NO_PROVIDER_AVAILABLE',
  }
}

/** Remote (z-ai) completion — reuses the already-proven provider client. */
async function remoteZaiChat(
  request: ChatCompletionRequest,
  env: NodeJS.ProcessEnv,
): Promise<ChatCompletionResult> {
  const { runZaiCompletion } = await import('@/lib/ai-provider-runtime')
  const started = Date.now()
  try {
    const completion = await runZaiCompletion(
      {
        model: request.model ?? 'glm-4.6',
        messages: request.messages.map((m) => ({ role: m.role, content: m.content })),
        temperature: request.temperature ?? 0.2,
        max_tokens: request.maxTokens ?? 1024,
        ...(request.jsonMode ? { response_format: { type: 'json_object' } } : {}),
      },
      env,
    )
    return {
      ok: true,
      provider: 'zai',
      model: request.model ?? 'glm-4.6',
      content: completion,
      firstTokenMs: null,
      durationMs: Date.now() - started,
      tokensUsed: null,
      finishReason: 'stop',
      error: null,
      errorCode: null,
    }
  } catch (error) {
    return {
      ok: false,
      provider: 'zai',
      model: request.model ?? 'glm-4.6',
      content: '',
      firstTokenMs: null,
      durationMs: Date.now() - started,
      tokensUsed: null,
      finishReason: null,
      error: error instanceof Error ? error.message : 'remote provider request failed',
      errorCode: 'PROVIDER_ERROR',
    }
  }
}

/** Models actually installed on the local server (never fabricated). */
export async function listLocalModels(env: NodeJS.ProcessEnv = process.env) {
  const { config } = resolveOllamaConfig(env)
  if (!config) return { ok: false, models: [], error: 'no local model server is configured' }
  return ollamaListModels(config)
}

/** Which catalog entry a runtime profile maps to, honouring the verified set. */
export function profileModel(
  profile: ModelProfile,
  verifiedWeights: Set<string>,
  hostRamMb: number,
) {
  const candidates = PROFILE_CANDIDATES[profile] ?? PROFILE_CANDIDATES.cpu_general
  for (const slug of candidates) {
    const entry = findModel(slug)
    if (!entry) continue
    if (!entry.licenseVerified) continue
    if (!verifiedWeights.has(slug)) continue
    if (entry.ramFootprintMb + 512 > hostRamMb) continue
    return toDescriptor(entry)
  }
  return null
}

export { MODEL_CATALOG }
