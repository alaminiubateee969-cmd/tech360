// ============================================================
// TECH360 — Ollama provider (local, self-hosted inference)
// ============================================================
// Talks to a locally hosted Ollama server. The upstream MUST be a
// loopback / private-network address: a public Ollama endpoint would
// expose the company's document corpus to the internet. This module
// refuses to call a public host.
//
// REFERENCE: https://github.com/ollama/ollama  (MIT)
// API shape:  POST {base}/api/chat   → { message:{content}, done, ... }
//             POST {base}/api/embeddings → { embedding: number[] }
//             GET  {base}/api/tags   → { models: [{ name, size, details }] }
// ============================================================

import type {
  ChatCompletionRequest,
  ChatCompletionResult,
  EmbeddingRequest,
  EmbeddingResult,
  ModelProviderKind,
  ProviderStatus,
} from '../types'

export const OLLAMA_PROVIDER: ModelProviderKind = 'ollama'

export type OllamaConfig = {
  baseUrl: string
  apiKey: string | null
  chatModel: string
  embeddingModel: string
  timeoutMs: number
}

/**
 * RFC1918 / RFC4193 / loopback / link-local check.
 * Public addresses are rejected — the model service is private by design.
 */
export function isPrivateUpstream(rawUrl: string): boolean {
  let parsed: URL
  try {
    parsed = new URL(rawUrl)
  } catch {
    return false
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return false
  if (parsed.username || parsed.password) return false
  const host = parsed.hostname.toLowerCase().replace(/^\[|\]$/g, '')
  if (host === 'localhost' || host === 'localhost.localdomain') return true
  if (host === '::1' || host === '0:0:0:0:0:0:0:1') return true
  if (/^127\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(host)) return true
  if (/^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(host)) return true
  if (/^192\.168\.\d{1,3}\.\d{1,3}$/.test(host)) return true
  if (/^172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}$/.test(host)) return true
  if (/^169\.254\.\d{1,3}\.\d{1,3}$/.test(host)) return true
  if (/^f[cd][0-9a-f]{2}:/.test(host)) return true
  if (host === '::' || host === '0.0.0.0') return false
  return false
}

export function resolveOllamaConfig(env: NodeJS.ProcessEnv = process.env): {
  config: OllamaConfig | null
  reason: string
} {
  const baseUrl = (env.LOCAL_MODEL_BASE_URL ?? '').trim().replace(/\/+$/, '')
  if (!baseUrl) return { config: null, reason: 'LOCAL_MODEL_BASE_URL is not configured' }
  if (!isPrivateUpstream(baseUrl)) {
    return {
      config: null,
      reason:
        'LOCAL_MODEL_BASE_URL must be a loopback or private-network address; a public model endpoint would expose company data',
    }
  }
  const chatModel = (env.LOCAL_MODEL_CHAT_MODEL ?? '').trim() || 'qwen2.5:1.5b-instruct-q4_K_M'
  const embeddingModel = (env.LOCAL_MODEL_EMBED_MODEL ?? '').trim() || 'bge-m3:latest'
  const timeoutRaw = Number(env.LOCAL_MODEL_TIMEOUT_MS ?? 0)
  const timeoutMs = Number.isFinite(timeoutRaw) && timeoutRaw > 0 ? Math.min(timeoutRaw, 120_000) : 60_000
  const apiKey = (env.LOCAL_MODEL_API_KEY ?? '').trim() || null
  return { config: { baseUrl, apiKey, chatModel, embeddingModel, timeoutMs }, reason: 'ok' }
}

export function ollamaStatus(env: NodeJS.ProcessEnv = process.env): ProviderStatus {
  const { config, reason } = resolveOllamaConfig(env)
  if (!config) {
    return {
      kind: OLLAMA_PROVIDER,
      state: reason.startsWith('LOCAL_MODEL_BASE_URL must be') ? 'MISCONFIGURED' : 'NOT_CONFIGURED',
      detail: reason,
      baseUrl: null,
      privateOnly: true,
      chatModel: null,
      embeddingModel: null,
    }
  }
  return {
    kind: OLLAMA_PROVIDER,
    state: 'CONFIGURED',
    detail: 'Ollama upstream is configured on a private address',
    baseUrl: config.baseUrl,
    privateOnly: true,
    chatModel: config.chatModel,
    embeddingModel: config.embeddingModel,
  }
}

function headers(config: OllamaConfig): Record<string, string> {
  const h: Record<string, string> = { 'Content-Type': 'application/json' }
  if (config.apiKey) h.Authorization = `Bearer ${config.apiKey}`
  return h
}

export async function ollamaChat(
  config: OllamaConfig,
  request: ChatCompletionRequest,
): Promise<ChatCompletionResult> {
  const model = request.model?.trim() || config.chatModel
  const started = Date.now()
  const timeout = request.timeoutMs ?? config.timeoutMs
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeout)
  try {
    const options: Record<string, unknown> = {
      temperature: request.temperature ?? 0.2,
      num_predict: request.maxTokens ?? 1024,
    }
    if (request.topP !== undefined) options.top_p = request.topP
    if (request.stop?.length) options.stop = request.stop
    if (request.jsonMode) options.format = 'json'

    const res = await fetch(`${config.baseUrl}/api/chat`, {
      method: 'POST',
      headers: headers(config),
      body: JSON.stringify({
        model,
        messages: request.messages,
        stream: false,
        ...options,
      }),
      signal: controller.signal,
    })
    if (!res.ok) {
      const detail = (await res.text().catch(() => '')).replace(/\s+/g, ' ').slice(0, 200)
      return {
        ok: false,
        provider: OLLAMA_PROVIDER,
        model,
        content: '',
        firstTokenMs: null,
        durationMs: Date.now() - started,
        tokensUsed: null,
        finishReason: null,
        error: `ollama upstream returned HTTP ${res.status}${detail ? `: ${detail}` : ''}`,
        errorCode: 'PROVIDER_ERROR',
      }
    }
    const body = (await res.json()) as {
      message?: { content?: string }
      done_reason?: string
      eval_count?: number
      prompt_eval_count?: number
      total_duration?: number
      load_duration?: number
    }
    const durationMs = Date.now() - started
    // Ollama reports load_duration (model load) + total_duration (whole call).
    // First-token latency is approximated as total_duration - eval time.
    const totalNs = typeof body.total_duration === 'number' ? body.total_duration : 0
    const loadNs = typeof body.load_duration === 'number' ? body.load_duration : 0
    const evalCount = typeof body.eval_count === 'number' ? body.eval_count : 0
    const evalNs = totalNs > 0 ? Math.max(0, totalNs - loadNs) : 0
    const firstTokenMs = evalCount > 0 && evalNs > 0 ? Math.round(evalNs / evalCount) : null
    return {
      ok: true,
      provider: OLLAMA_PROVIDER,
      model,
      content: typeof body.message?.content === 'string' ? body.message.content : '',
      firstTokenMs,
      durationMs,
      tokensUsed:
        typeof body.eval_count === 'number'
          ? body.eval_count + (body.prompt_eval_count ?? 0)
          : null,
      finishReason: body.done_reason ?? null,
      error: null,
      errorCode: null,
    }
  } catch (error) {
    const aborted = error instanceof Error && (error.name === 'AbortError' || /abort/i.test(error.message))
    return {
      ok: false,
      provider: OLLAMA_PROVIDER,
      model,
      content: '',
      firstTokenMs: null,
      durationMs: Date.now() - started,
      tokensUsed: null,
      finishReason: null,
      error: aborted ? 'local model request timed out' : 'local model request failed',
      errorCode: aborted ? 'PROVIDER_TIMEOUT' : 'PROVIDER_ERROR',
    }
  } finally {
    clearTimeout(timer)
  }
}

export async function ollamaEmbed(
  config: OllamaConfig,
  request: EmbeddingRequest,
): Promise<EmbeddingResult> {
  const model = request.model?.trim() || config.embeddingModel
  const started = Date.now()
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), config.timeoutMs)
  try {
    const res = await fetch(`${config.baseUrl}/api/embeddings`, {
      method: 'POST',
      headers: headers(config),
      body: JSON.stringify({ model, prompt: request.input }),
      signal: controller.signal,
    })
    if (!res.ok) {
      return {
        ok: false,
        provider: OLLAMA_PROVIDER,
        model,
        vectors: [],
        dimensions: null,
        durationMs: Date.now() - started,
        error: `ollama embedding upstream returned HTTP ${res.status}`,
        errorCode: 'PROVIDER_ERROR',
      }
    }
    const body = (await res.json()) as { embedding?: number[] }
    const vector = Array.isArray(body.embedding) ? body.embedding : []
    return {
      ok: true,
      provider: OLLAMA_PROVIDER,
      model,
      vectors: vector.length ? [vector] : [],
      dimensions: vector.length || null,
      durationMs: Date.now() - started,
      error: null,
      errorCode: null,
    }
  } catch (error) {
    const aborted = error instanceof Error && (error.name === 'AbortError' || /abort/i.test(error.message))
    return {
      ok: false,
      provider: OLLAMA_PROVIDER,
      model,
      vectors: [],
      dimensions: null,
      durationMs: Date.now() - started,
      error: aborted ? 'local embedding request timed out' : 'local embedding request failed',
      errorCode: aborted ? 'PROVIDER_TIMEOUT' : 'PROVIDER_ERROR',
    }
  } finally {
    clearTimeout(timer)
  }
}

/** List the models the local server actually has. Used by /api/models. */
export async function ollamaListModels(
  config: OllamaConfig,
): Promise<{ ok: boolean; models: Array<{ name: string; sizeMb: number; family: string | null }>; error: string | null }> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 10_000)
  try {
    const res = await fetch(`${config.baseUrl}/api/tags`, { headers: headers(config), signal: controller.signal })
    if (!res.ok) return { ok: false, models: [], error: `ollama tags returned HTTP ${res.status}` }
    const body = (await res.json()) as {
      models?: Array<{ name?: string; size?: number; details?: { family?: string } }>
    }
    const models = (body.models ?? [])
      .filter((m) => typeof m.name === 'string')
      .map((m) => ({
        name: m.name as string,
        sizeMb: typeof m.size === 'number' ? Math.round(m.size / 1_048_576) : 0,
        family: m.details?.family ?? null,
      }))
    return { ok: true, models, error: null }
  } catch {
    return { ok: false, models: [], error: 'ollama tags request failed' }
  } finally {
    clearTimeout(timer)
  }
}
