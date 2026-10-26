// ------------------------------------------------------------
// Model provider for the internal automation engine (server-side
// only — see docs/AI_VISIBILITY_POLICY.md).
//
// Provider order (honest, no fake fallback):
//   1. OpenRouter FREE models — active when OPENROUTER_API_KEY is
//      set. The chain starts with `openrouter/free` (OpenRouter's
//      free-model router, which auto-selects an available free
//      model), then curated `:free` slugs. Each failure moves to
//      the next model; if every free model fails, the LAST error
//      is thrown and the execution is recorded FAILED.
//   2. The platform SDK (z-ai-web-dev-sdk) — used when no
//      OpenRouter key is configured.
//
// Override the chain with OPENROUTER_MODELS="a:free,b:free".
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

/** Parse OPENROUTER_MODELS (comma list) or fall back to the default chain. */
export function freeModelChain(env: Record<string, string | undefined> = process.env): string[] {
  const raw = env.OPENROUTER_MODELS?.trim()
  if (!raw) return [...DEFAULT_FREE_MODELS]
  const list = raw.split(',').map((s) => s.trim()).filter(Boolean)
  return list.length ? list : [...DEFAULT_FREE_MODELS]
}

export function openRouterConfigured(env: Record<string, string | undefined> = process.env): boolean {
  return Boolean(env.OPENROUTER_API_KEY?.trim())
}

export type ChatMessage = { role: 'system' | 'user' | 'assistant'; content: string }

export async function openRouterComplete(apiKey: string, model: string, messages: ChatMessage[]): Promise<string> {
  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': process.env.APP_PUBLIC_URL || 'https://bdtech360.com',
      'X-Title': 'TECH360 internal automation',
    },
    body: JSON.stringify({ model, messages, temperature: 0.3 }),
    signal: AbortSignal.timeout(90_000),
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
export async function completeWithFreeModels(messages: ChatMessage[], env: Record<string, string | undefined> = process.env): Promise<{ output: string; model: string }> {
  const apiKey = env.OPENROUTER_API_KEY?.trim()
  if (!apiKey) throw new Error('OPENROUTER_API_KEY is not configured')
  let lastError: Error = new Error('No free models configured')
  for (const model of freeModelChain(env)) {
    try {
      const output = await openRouterComplete(apiKey, model, messages)
      return { output, model }
    } catch (e) {
      lastError = e instanceof Error ? e : new Error(String(e))
    }
  }
  throw lastError
}
