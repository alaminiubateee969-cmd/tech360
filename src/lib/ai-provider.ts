import type { CreateChatCompletionBody, ChatMessage } from 'z-ai-web-dev-sdk'

export type ZaiProviderState = 'CONFIGURED' | 'NOT_CONFIGURED' | 'MISCONFIGURED'

export type ZaiProviderStatus = {
  state: ZaiProviderState
  configured: boolean
  baseUrlConfigured: boolean
  apiKeyConfigured: boolean
  detail: string
}

export type ZaiEnvironment = {
  readonly [key: string]: string | undefined
  ZAI_BASE_URL?: string
  ZAI_API_KEY?: string
}

type ProviderErrorCode = 'PROVIDER_NOT_CONFIGURED' | 'PROVIDER_ERROR' | 'PROVIDER_TIMEOUT' | 'INVALID_PROVIDER_RESPONSE'

export class ZaiProviderError extends Error {
  readonly code: ProviderErrorCode
  readonly status?: number

  constructor(code: ProviderErrorCode, message: string, status?: number) {
    super(message)
    this.name = 'ZaiProviderError'
    this.code = code
    this.status = status
  }
}

export type ZaiCompletion = {
  choices: Array<{ message?: { content?: string | null } }>
  usage?: { total_tokens?: number }
}

export type ZaiClient = {
  chat: {
    completions: {
      create(body: CreateChatCompletionBody, options?: { signal?: AbortSignal }): Promise<ZaiCompletion>
    }
  }
  functions: {
    invoke(functionName: string, args: Record<string, unknown>, options?: { signal?: AbortSignal }): Promise<unknown>
  }
}

function value(value: string | undefined): string {
  return value?.trim() ?? ''
}

function isValidBaseUrl(raw: string): boolean {
  try {
    const parsed = new URL(raw)
    return (parsed.protocol === 'https:' || parsed.protocol === 'http:')
      && Boolean(parsed.hostname)
      && !parsed.username
      && !parsed.password
      && !parsed.hash
      && !parsed.search
  } catch {
    return false
  }
}

export function resolveZaiEnvConfig(env: ZaiEnvironment = process.env): { state: ZaiProviderState; baseUrl: string; apiKey: string; detail: string } {
  const baseUrl = value(env.ZAI_BASE_URL)
  const apiKey = value(env.ZAI_API_KEY)

  if (!baseUrl && !apiKey) {
    return { state: 'NOT_CONFIGURED', baseUrl: '', apiKey: '', detail: 'ZAI_BASE_URL and ZAI_API_KEY are not configured' }
  }
  if (!baseUrl || !apiKey) {
    return { state: 'MISCONFIGURED', baseUrl: '', apiKey: '', detail: 'ZAI_BASE_URL and ZAI_API_KEY must be configured together' }
  }
  if (!isValidBaseUrl(baseUrl)) {
    return { state: 'MISCONFIGURED', baseUrl: '', apiKey: '', detail: 'ZAI_BASE_URL must be an absolute HTTP(S) URL without credentials or query data' }
  }

  return { state: 'CONFIGURED', baseUrl: baseUrl.replace(/\/+$/, ''), apiKey, detail: 'ZAI provider configuration is present' }
}

export function getZaiProviderStatus(env: ZaiEnvironment = process.env): ZaiProviderStatus {
  const config = resolveZaiEnvConfig(env)
  return {
    state: config.state,
    configured: config.state === 'CONFIGURED',
    baseUrlConfigured: Boolean(value(env.ZAI_BASE_URL)),
    apiKeyConfigured: Boolean(value(env.ZAI_API_KEY)),
    detail: config.detail,
  }
}

function safeProviderMessage(body: string, apiKey: string): string {
  const compact = body.replace(apiKey, '[REDACTED]').replace(/\s+/g, ' ').trim().slice(0, 400)
  return compact || 'provider returned no error detail'
}

async function postJson(url: string, apiKey: string, body: unknown, signal?: AbortSignal): Promise<unknown> {
  let response: Response
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
        'X-Z-AI-From': 'Z',
      },
      body: JSON.stringify(body),
      signal,
    })
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new ZaiProviderError('PROVIDER_TIMEOUT', 'ZAI provider request timed out')
    }
    throw new ZaiProviderError('PROVIDER_ERROR', 'ZAI provider request could not be completed')
  }

  const text = await response.text()
  if (!response.ok) {
    throw new ZaiProviderError('PROVIDER_ERROR', `ZAI provider returned HTTP ${response.status}: ${safeProviderMessage(text, apiKey)}`, response.status)
  }

  try {
    return JSON.parse(text) as unknown
  } catch {
    throw new ZaiProviderError('INVALID_PROVIDER_RESPONSE', 'ZAI provider returned invalid JSON')
  }
}

function asCompletion(value: unknown): ZaiCompletion {
  if (!value || typeof value !== 'object') throw new ZaiProviderError('INVALID_PROVIDER_RESPONSE', 'ZAI provider response was not an object')
  const response = value as { choices?: unknown; usage?: unknown }
  if (!Array.isArray(response.choices) || response.choices.length === 0) {
    throw new ZaiProviderError('INVALID_PROVIDER_RESPONSE', 'ZAI provider response did not contain choices')
  }
  const first = response.choices[0]
  if (!first || typeof first !== 'object') throw new ZaiProviderError('INVALID_PROVIDER_RESPONSE', 'ZAI provider response contained an invalid choice')
  const message = (first as { message?: unknown }).message
  if (!message || typeof message !== 'object') throw new ZaiProviderError('INVALID_PROVIDER_RESPONSE', 'ZAI provider response did not contain a message')
  const content = (message as { content?: unknown }).content
  if (typeof content !== 'string' || !content.trim()) throw new ZaiProviderError('INVALID_PROVIDER_RESPONSE', 'ZAI provider response contained empty content')
  const usage = response.usage && typeof response.usage === 'object' ? response.usage as { total_tokens?: unknown } : undefined
  return {
    choices: [{ message: { content } }],
    usage: typeof usage?.total_tokens === 'number' && Number.isFinite(usage.total_tokens)
      ? { total_tokens: Math.max(0, Math.floor(usage.total_tokens)) }
      : undefined,
  }
}

export function createZaiClient(env: ZaiEnvironment = process.env): ZaiClient {
  const config = resolveZaiEnvConfig(env)
  if (config.state !== 'CONFIGURED') throw new ZaiProviderError('PROVIDER_NOT_CONFIGURED', config.detail)

  return {
    chat: {
      completions: {
        async create(body, options) {
          const response = await postJson(`${config.baseUrl}/chat/completions`, config.apiKey, body, options?.signal)
          return asCompletion(response)
        },
      },
    },
    functions: {
      async invoke(functionName, args, options) {
        const response = await postJson(`${config.baseUrl}/functions/invoke`, config.apiKey, { function_name: functionName, arguments: args }, options?.signal)
        if (!response || typeof response !== 'object') throw new ZaiProviderError('INVALID_PROVIDER_RESPONSE', 'ZAI function response was not an object')
        const result = response as { result?: unknown }
        return 'result' in result ? result.result : response
      },
    },
  }
}

export type { ChatMessage }
