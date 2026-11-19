// ------------------------------------------------------------
// Model provider for the internal automation engine (server-side
// only — see docs/AI_VISIBILITY_POLICY.md).
//
// Provider order (honest, no fake fallback):
//   1. AI Gateway (when AI_GATEWAY_BASE_URL + AGENTOS_GATEWAY_TOKEN are set)
//   2. OpenRouter models — active when OPENROUTER_API_KEY is set.
//   3. OpenAI API — active when OPENAI_API_KEY is set.
//   4. Google Gemini API — active when GEMINI_API_KEY or GOOGLE_GENERATIVE_AI_API_KEY is set.
//   5. Groq API — active when GROQ_API_KEY is set.
//   6. ZAI SDK — active when ZAI_BASE_URL + ZAI_API_KEY are set.
//
// Override the active provider with AI_PROVIDER=openai|gemini|groq|openrouter|ai-gateway|zai|none.
// Override the OpenRouter chain with OPENROUTER_MODELS="a:free,b:free".
// Free tiers are rate-limited upstream; quota errors surface as
// failed executions, never as invented output.
// ------------------------------------------------------------

export const FREE_MODEL_ROUTER = 'openrouter/free'

export const DEFAULT_FREE_MODELS: readonly string[] = [
  FREE_MODEL_ROUTER,
  'qwen/qwen3-coder:free',
  'deepseek/deepseek-r1:free',
  'meta-llama/llama-3.3-70b-instruct:free',
  'google/gemma-3-27b-it:free',
  'mistralai/mistral-small-3.1-24b-instruct:free',
  'openai/gpt-oss-20b:free',
]

export const DEFAULT_OPENAI_MODEL = 'gpt-4o-mini'
export const DEFAULT_GEMINI_MODEL = 'gemini-2.5-flash'
export const DEFAULT_GROQ_MODEL = 'llama-3.3-70b-versatile'

type EnvMap = Record<string, string | undefined>

/** Parse OPENROUTER_MODELS (comma list) or fall back to the default chain. */
export function freeModelChain(env: EnvMap = process.env): string[] {
  const raw = env.OPENROUTER_MODELS?.trim()
  if (!raw) return [...DEFAULT_FREE_MODELS]
  const list = raw.split(',').map((s) => s.trim()).filter(Boolean)
  return list.length ? list : [...DEFAULT_FREE_MODELS]
}

export function openRouterConfigured(env: EnvMap = process.env): boolean {
  return Boolean(env.OPENROUTER_API_KEY?.trim())
}

export function openAiConfigured(env: EnvMap = process.env): boolean {
  return Boolean(env.OPENAI_API_KEY?.trim())
}

export function geminiConfigured(env: EnvMap = process.env): boolean {
  return Boolean((env.GEMINI_API_KEY ?? env.GOOGLE_GENERATIVE_AI_API_KEY)?.trim())
}

export function groqConfigured(env: EnvMap = process.env): boolean {
  return Boolean(env.GROQ_API_KEY?.trim())
}

export type ChatMessage = { role: 'system' | 'user' | 'assistant'; content: string }

export type DirectCompletionResult = {
  output: string
  model: string
  tokensUsed: number
}

function normalizeModelOverride(override: string | undefined | null, envModel: string | undefined, fallback: string): string {
  const clean = override?.trim()
  if (clean && clean !== 'default' && clean !== 'auto') {
    const colon = clean.indexOf(':')
    if (colon > 0 && ['openai', 'gemini', 'groq', 'openrouter', 'ai-gateway', 'zai'].includes(clean.slice(0, colon).toLowerCase())) {
      const stripped = clean.slice(colon + 1).trim()
      if (stripped) return stripped
    }
    return clean
  }
  return envModel?.trim() || fallback
}

async function openAiCompatibleChatComplete(args: {
  providerLabel: string
  endpoint: string
  apiKey: string
  model: string
  messages: ChatMessage[]
  signal?: AbortSignal
  extraHeaders?: Record<string, string>
}): Promise<DirectCompletionResult> {
  const requestSignal = args.signal ? AbortSignal.any([args.signal, AbortSignal.timeout(90_000)]) : AbortSignal.timeout(90_000)
  const res = await fetch(args.endpoint, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${args.apiKey}`,
      'Content-Type': 'application/json',
      ...(args.extraHeaders ?? {}),
    },
    body: JSON.stringify({ model: args.model, messages: args.messages, temperature: 0.3 }),
    signal: requestSignal,
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`${args.providerLabel} ${args.model} HTTP ${res.status}: ${body.slice(0, 300)}`)
  }
  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>
    usage?: { total_tokens?: number; prompt_tokens?: number; completion_tokens?: number }
  }
  const out = data.choices?.[0]?.message?.content ?? ''
  if (!out.trim()) throw new Error(`${args.providerLabel} ${args.model} returned empty output`)
  const totalTokens =
    typeof data.usage?.total_tokens === 'number'
      ? data.usage.total_tokens
      : (data.usage?.prompt_tokens ?? 0) + (data.usage?.completion_tokens ?? 0)
  const tokensUsed =
    totalTokens > 0
      ? totalTokens
      : Math.ceil((args.messages.reduce((sum, m) => sum + m.content.length, 0) + out.length) / 4)
  return { output: out, model: `${args.providerLabel.toLowerCase()}:${args.model}`, tokensUsed }
}

export async function openRouterComplete(
  apiKey: string,
  model: string,
  messages: ChatMessage[],
  signal?: AbortSignal,
): Promise<string> {
  const requestSignal = signal ? AbortSignal.any([signal, AbortSignal.timeout(90_000)]) : AbortSignal.timeout(90_000)
  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': process.env.APP_PUBLIC_URL || 'https://bdtech360.com',
      'X-Title': 'TECH360 internal automation',
    },
    body: JSON.stringify({ model, messages, temperature: 0.3 }),
    signal: requestSignal,
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`OpenRouter ${model} HTTP ${res.status}: ${body.slice(0, 300)}`)
  }
  const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> }
  const out = data.choices?.[0]?.message?.content ?? ''
  if (!out.trim()) throw new Error(`OpenRouter ${model} returned empty output`)
  return out
}

/** Try every free model in order; throw the last error if all fail. */
export async function completeWithFreeModels(
  messages: ChatMessage[],
  env: EnvMap = process.env,
  signal?: AbortSignal,
  modelOverride?: string | null,
): Promise<{ output: string; model: string; tokensUsed?: number }> {
  const apiKey = env.OPENROUTER_API_KEY?.trim()
  if (!apiKey) throw new Error('OPENROUTER_API_KEY is not configured')
  const customModel = modelOverride && modelOverride !== 'default' && modelOverride !== 'auto'
    ? normalizeModelOverride(modelOverride, undefined, '')
    : ''
  const chain = customModel ? [customModel, ...freeModelChain(env).filter((m) => m !== customModel)] : freeModelChain(env)
  let lastError: Error = new Error('No free models configured')
  for (const model of chain) {
    if (signal?.aborted) throw lastError
    try {
      const output = await openRouterComplete(apiKey, model, messages, signal)
      const tokensUsed = Math.ceil((messages.reduce((sum, m) => sum + m.content.length, 0) + output.length) / 4)
      return { output, model, tokensUsed }
    } catch (e) {
      lastError = e instanceof Error ? e : new Error(String(e))
      if (signal?.aborted) throw lastError
    }
  }
  throw lastError
}

export async function completeWithOpenAi(
  messages: ChatMessage[],
  env: EnvMap = process.env,
  signal?: AbortSignal,
  modelOverride?: string | null,
): Promise<DirectCompletionResult> {
  const apiKey = env.OPENAI_API_KEY?.trim()
  if (!apiKey) throw new Error('OPENAI_API_KEY is not configured')
  const baseUrl = (env.OPENAI_BASE_URL?.trim() || 'https://api.openai.com/v1').replace(/\/+$/, '')
  const model = normalizeModelOverride(modelOverride, env.OPENAI_MODEL, DEFAULT_OPENAI_MODEL)
  return openAiCompatibleChatComplete({
    providerLabel: 'OpenAI',
    endpoint: `${baseUrl}/chat/completions`,
    apiKey,
    model,
    messages,
    signal,
  })
}

export async function completeWithGemini(
  messages: ChatMessage[],
  env: EnvMap = process.env,
  signal?: AbortSignal,
  modelOverride?: string | null,
): Promise<DirectCompletionResult> {
  const apiKey = (env.GEMINI_API_KEY ?? env.GOOGLE_GENERATIVE_AI_API_KEY)?.trim()
  if (!apiKey) throw new Error('GEMINI_API_KEY is not configured')
  const baseUrl = (
    env.GEMINI_BASE_URL?.trim() || 'https://generativelanguage.googleapis.com/v1beta/openai'
  ).replace(/\/+$/, '')
  const model = normalizeModelOverride(modelOverride, env.GEMINI_MODEL, DEFAULT_GEMINI_MODEL)
  return openAiCompatibleChatComplete({
    providerLabel: 'Gemini',
    endpoint: `${baseUrl}/chat/completions`,
    apiKey,
    model,
    messages,
    signal,
  })
}

export async function completeWithGroq(
  messages: ChatMessage[],
  env: EnvMap = process.env,
  signal?: AbortSignal,
  modelOverride?: string | null,
): Promise<DirectCompletionResult> {
  const apiKey = env.GROQ_API_KEY?.trim()
  if (!apiKey) throw new Error('GROQ_API_KEY is not configured')
  const baseUrl = (env.GROQ_BASE_URL?.trim() || 'https://api.groq.com/openai/v1').replace(/\/+$/, '')
  const model = normalizeModelOverride(modelOverride, env.GROQ_MODEL, DEFAULT_GROQ_MODEL)
  return openAiCompatibleChatComplete({
    providerLabel: 'Groq',
    endpoint: `${baseUrl}/chat/completions`,
    apiKey,
    model,
    messages,
    signal,
  })
}
