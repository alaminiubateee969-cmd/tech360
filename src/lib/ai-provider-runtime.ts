// ============================================================
// TECH360 — Remote provider runtime wrapper
// ============================================================
// The remote (z-ai) provider already existed in this codebase and is
// proven in production. The model router reuses it as the LAST fallback
// only, so a private local model is always preferred.
//
// This module exists so the router does not need to import the SDK
// client directly, and so the fallback path is covered by its own test.
// ============================================================

import { createZaiClient, ZaiProviderError } from '@/lib/ai-provider'

export type ZaiCompletionRequest = {
  model: string
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>
  temperature?: number
  max_tokens?: number
  top_p?: number
  response_format?: { type: 'json_object' }
}

/**
 * Run a completion against the configured remote provider.
 * Throws `ZaiProviderError` when the provider is not configured or fails;
 * the router converts that into an honest failure result.
 */
export async function runZaiCompletion(
  request: ZaiCompletionRequest,
  env: NodeJS.ProcessEnv = process.env,
): Promise<string> {
  const client = createZaiClient({
    ZAI_BASE_URL: env.ZAI_BASE_URL,
    ZAI_API_KEY: env.ZAI_API_KEY,
  })
  const completion = await client.chat.completions.create(
    {
      model: request.model,
      messages: request.messages,
      temperature: request.temperature ?? 0.2,
      max_tokens: request.max_tokens ?? 1024,
      ...(request.top_p !== undefined ? { top_p: request.top_p } : {}),
      ...(request.response_format ? { response_format: request.response_format } : {}),
    } as never,
  )
  const content = completion.choices?.[0]?.message?.content
  if (typeof content !== 'string' || !content.trim()) {
    throw new ZaiProviderError('INVALID_PROVIDER_RESPONSE', 'remote provider returned empty content')
  }
  return content
}
