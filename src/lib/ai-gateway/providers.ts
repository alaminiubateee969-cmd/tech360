// Shared AI Gateway provider adapters: the existing OpenRouter
// free-model provider, an OpenAI-compatible LOCAL model endpoint,
// and a clearly-marked development-only mock. The deterministic
// mock is forbidden in production by the config loader and never
// counts toward readiness.
import { completeWithFreeModels, openRouterComplete } from '../agents/model-provider'
import type { GatewayConfig } from './config'
import type { ProviderFn } from './core'

async function fetchJson(url: string, init: RequestInit, timeoutMs: number): Promise<unknown> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const response = await fetch(url, { ...init, signal: controller.signal })
    if (!response.ok) throw new Error(`Provider HTTP ${response.status}`)
    return await response.json()
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      const timeout = new Error(`Provider timed out after ${timeoutMs}ms`)
      timeout.name = 'AbortError'
      throw timeout
    }
    throw error
  } finally {
    clearTimeout(timer)
  }
}

export function gatewayProviders(config: GatewayConfig): Partial<Record<'local' | 'external' | 'mock', ProviderFn>> {
  const providers: Partial<Record<'local' | 'external' | 'mock', ProviderFn>> = {}

  if (config.localModel) {
    const local = config.localModel
    providers.local = async ({ messages, maxTokens, timeoutMs }) => {
      const data = (await fetchJson(`${local.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(local.apiKey ? { Authorization: `Bearer ${local.apiKey}` } : {}),
        },
        body: JSON.stringify({ model: local.name, messages, max_tokens: maxTokens }),
      }, Math.min(timeoutMs, local.timeoutMs))) as { choices?: Array<{ message?: { content?: string } }>; usage?: { prompt_tokens?: number; completion_tokens?: number } }
      const content = data.choices?.[0]?.message?.content ?? ''
      return {
        content,
        usage: data.usage ? { promptTokens: data.usage.prompt_tokens, completionTokens: data.usage.completion_tokens } : undefined,
        costUsd: null, // local serving cost is deployment-specific; recorded as unknown, never invented
      }
    }
  }

  if (config.openRouterApiKey) {
    const key: string = config.openRouterApiKey
    providers.external = async ({ model, messages }) => {
      if (model === 'openrouter/free' || model.endsWith(':free')) {
        const env = model === 'openrouter/free' ? process.env : { ...process.env, OPENROUTER_MODELS: model }
        const result = await completeWithFreeModels(messages, env)
        return { content: result.output, costUsd: 0 }
      }
      const content = await openRouterComplete(key, model, messages)
      return { content, costUsd: null }
    }
  }

  if (config.mockEnabled && !config.isProduction) {
    providers.mock = async ({ model, messages }) => {
      const last = [...messages].reverse().find((m) => m.role === 'user')?.content ?? ''
      return {
        content: `[MOCK ${model}] Deterministic development response (no real inference performed). Last user message length: ${last.length} characters.`,
        usage: { promptTokens: 0, completionTokens: 0 },
        costUsd: 0,
      }
    }
  }

  return providers
}
