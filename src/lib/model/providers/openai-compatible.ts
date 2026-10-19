// ============================================================
// TECH360 — OpenAI-compatible local provider
// ============================================================
// Serves llama.cpp `server`, vLLM, LM Studio, TGI and Ollama's own
// /v1 surface. Used when the host exposes an OpenAI-shaped API instead
// of Ollama's native /api/chat.
//
// The upstream must still be a private/loopback address: this is a
// PRIVATE model service, not a proxy to the public internet.
//
// REFERENCE: https://github.com/ggml-org/llama.cpp  (MIT)
// ============================================================

import type {
  ChatCompletionRequest,
  ChatCompletionResult,
  EmbeddingRequest,
  EmbeddingResult,
  ProviderStatus,
} from '../types'
import { isPrivateUpstream } from './ollama'

export type OpenAiCompatibleConfig = {
  baseUrl: string
  apiKey: string | null
  chatModel: string
  embeddingModel: string
  timeoutMs: number
}

export function resolveOpenAiCompatibleConfig(env: NodeJS.ProcessEnv = process.env): {
  config: OpenAiCompatibleConfig | null
  reason: string
} {
  const baseUrl = (env.LOCAL_OPENAI_BASE_URL ?? '').trim().replace(/\/+$/, '')
  if (!baseUrl) return { config: null, reason: 'LOCAL_OPENAI_BASE_URL is not configured' }
  if (!isPrivateUpstream(baseUrl)) {
    return {
      config: null,
      reason:
        'LOCAL_OPENAI_BASE_URL must be a loopback or private-network address; a public model endpoint would expose company data',
    }
  }
  const chatModel = (env.LOCAL_OPENAI_CHAT_MODEL ?? '').trim() || 'qwen2.5-1.5b-instruct-q4_K_M'
  const embeddingModel = (env.LOCAL_OPENAI_EMBED_MODEL ?? '').trim() || 'bge-m3'
  const timeoutRaw = Number(env.LOCAL_OPENAI_TIMEOUT_MS ?? 0)
  const timeoutMs = Number.isFinite(timeoutRaw) && timeoutRaw > 0 ? Math.min(timeoutRaw, 120_000) : 60_000
  const apiKey = (env.LOCAL_OPENAI_API_KEY ?? '').trim() || null
  return { config: { baseUrl, apiKey, chatModel, embeddingModel, timeoutMs }, reason: 'ok' }
}

export function openAiCompatibleStatus(env: NodeJS.ProcessEnv = process.env): ProviderStatus {
  const { config, reason } = resolveOpenAiCompatibleConfig(env)
  if (!config) {
    return {
      kind: 'openai-compatible',
      state: reason.startsWith('LOCAL_OPENAI_BASE_URL must be') ? 'MISCONFIGURED' : 'NOT_CONFIGURED',
      detail: reason,
      baseUrl: null,
      privateOnly: true,
      chatModel: null,
      embeddingModel: null,
    }
  }
  return {
    kind: 'openai-compatible',
    state: 'CONFIGURED',
    detail: 'OpenAI-compatible local provider is configured on a private address',
    baseUrl: config.baseUrl,
    privateOnly: true,
    chatModel: config.chatModel,
    embeddingModel: config.embeddingModel,
  }
}

function headers(config: OpenAiCompatibleConfig): Record<string, string> {
  const h: Record<string, string> = { 'Content-Type': 'application/json' }
  if (config.apiKey) h.Authorization = `Bearer ${config.apiKey}`
  return h
}

export async function openAiCompatibleChat(
  request: ChatCompletionRequest,
  env: NodeJS.ProcessEnv = process.env,
): Promise<ChatCompletionResult> {
  const { config } = resolveOpenAiCompatibleConfig(env)
  const model = request.model?.trim() || config?.chatModel || 'unknown'
  if (!config) {
    return {
      ok: false,
      provider: 'openai-compatible',
      model,
      content: '',
      firstTokenMs: null,
      durationMs: 0,
      tokensUsed: null,
      finishReason: null,
      error: 'LOCAL_OPENAI_BASE_URL is not configured',
      errorCode: 'PROVIDER_NOT_CONFIGURED',
    }
  }
  const started = Date.now()
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), request.timeoutMs ?? config.timeoutMs)
  try {
    const res = await fetch(`${config.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: headers(config),
      body: JSON.stringify({
        model,
        messages: request.messages,
        temperature: request.temperature ?? 0.2,
        max_tokens: request.maxTokens ?? 1024,
        ...(request.topP !== undefined ? { top_p: request.topP } : {}),
        ...(request.stop?.length ? { stop: request.stop } : {}),
        ...(request.jsonMode ? { response_format: { type: 'json_object' } } : {}),
        stream: false,
      }),
      signal: controller.signal,
    })
    if (!res.ok) {
      return {
        ok: false,
        provider: 'openai-compatible',
        model,
        content: '',
        firstTokenMs: null,
        durationMs: Date.now() - started,
        tokensUsed: null,
        finishReason: null,
        error: `local OpenAI-compatible provider returned HTTP ${res.status}`,
        errorCode: 'PROVIDER_ERROR',
      }
    }
    const body = (await res.json()) as {
      choices?: Array<{ message?: { content?: string }; finish_reason?: string }>
      usage?: { total_tokens?: number }
    }
    const choice = body.choices?.[0]
    const content = choice?.message?.content ?? ''
    return {
      ok: true,
      provider: 'openai-compatible',
      model,
      content,
      firstTokenMs: null,
      durationMs: Date.now() - started,
      tokensUsed: typeof body.usage?.total_tokens === 'number' ? body.usage.total_tokens : null,
      finishReason: choice?.finish_reason ?? null,
      error: null,
      errorCode: null,
    }
  } catch (error) {
    const aborted = error instanceof Error && (error.name === 'AbortError' || /abort/i.test(error.message))
    return {
      ok: false,
      provider: 'openai-compatible',
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

export async function openAiCompatibleEmbed(
  request: EmbeddingRequest,
  env: NodeJS.ProcessEnv = process.env,
): Promise<EmbeddingResult> {
  const { config } = resolveOpenAiCompatibleConfig(env)
  const model = request.model?.trim() || config?.embeddingModel || 'unknown'
  if (!config) {
    return {
      ok: false,
      provider: 'openai-compatible',
      model,
      vectors: [],
      dimensions: null,
      durationMs: 0,
      error: 'LOCAL_OPENAI_BASE_URL is not configured',
      errorCode: 'PROVIDER_NOT_CONFIGURED',
    }
  }
  const started = Date.now()
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), config.timeoutMs)
  try {
    const res = await fetch(`${config.baseUrl}/embeddings`, {
      method: 'POST',
      headers: headers(config),
      body: JSON.stringify({ model, input: request.input }),
      signal: controller.signal,
    })
    if (!res.ok) {
      return {
        ok: false,
        provider: 'openai-compatible',
        model,
        vectors: [],
        dimensions: null,
        durationMs: Date.now() - started,
        error: `local embedding provider returned HTTP ${res.status}`,
        errorCode: 'PROVIDER_ERROR',
      }
    }
    const body = (await res.json()) as { data?: Array<{ embedding?: number[] }> }
    const vectors = (body.data ?? [])
      .map((d) => d.embedding)
      .filter((v): v is number[] => Array.isArray(v))
    return {
      ok: true,
      provider: 'openai-compatible',
      model,
      vectors,
      dimensions: vectors[0]?.length ?? null,
      durationMs: Date.now() - started,
      error: null,
      errorCode: null,
    }
  } catch (error) {
    const aborted = error instanceof Error && (error.name === 'AbortError' || /abort/i.test(error.message))
    return {
      ok: false,
      provider: 'openai-compatible',
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
