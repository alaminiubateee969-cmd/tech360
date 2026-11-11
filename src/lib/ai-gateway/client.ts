// AgentOS -> Shared AI Gateway client (opt-in).
// When AI_GATEWAY_BASE_URL and AGENTOS_GATEWAY_TOKEN are both set,
// agent executions call the gateway as the registered `agentos`
// application (INTERNAL classification). Unset = the engine keeps
// its existing direct provider chain; nothing changes by default.
// A gateway failure throws — the execution is recorded FAILED by
// the engine, never silently replaced with invented output.
import type { ChatMessage } from '../agents/model-provider'

export function gatewayConfigured(env: Record<string, string | undefined> = process.env): boolean {
  return Boolean(env.AI_GATEWAY_BASE_URL?.trim() && env.AGENTOS_GATEWAY_TOKEN?.trim())
}

export async function gatewayComplete(
  messages: ChatMessage[],
  env: Record<string, string | undefined> = process.env,
  signal?: AbortSignal,
): Promise<{ output: string; model: string; provider: string }> {
  const base = env.AI_GATEWAY_BASE_URL!.trim().replace(/\/$/, '')
  const token = env.AGENTOS_GATEWAY_TOKEN!.trim()
  const response = await fetch(`${base}/api/ai-gateway/v1/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ messages, dataClassification: 'INTERNAL', maxTokens: 4096 }),
    signal,
  })
  const data = (await response.json().catch(() => ({}))) as {
    choices?: Array<{ message?: { content?: string } }>
    model?: string
    provider?: string
    error?: { code?: string; message?: string }
  }
  if (!response.ok) {
    throw new Error(`AI gateway request failed (${response.status} ${data.error?.code ?? ''}): ${data.error?.message ?? 'unknown error'}`)
  }
  const output = data.choices?.[0]?.message?.content ?? ''
  if (!output.trim()) throw new Error('AI gateway returned an empty response')
  return { output, model: data.model ?? 'unknown', provider: data.provider ?? 'gateway' }
}
