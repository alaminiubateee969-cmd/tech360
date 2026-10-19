// ============================================================
// TECH360 — Private model gateway
// ============================================================
// The single door to the private model service.
//
// CONTROLS (all mandatory, all fail closed):
//   1. Authentication — a bearer API key (MODEL_API_KEY) compared in
//      constant time. Without a configured key the gateway is DISABLED
//      and answers 503 — it never serves unauthenticated inference.
//   2. Rate limiting — per-key sliding window.
//   3. Logging — every request is written to the audit trail with the
//      provider, model, duration and token usage. Prompts are NOT
//      written to the audit log (they may contain customer data);
//      only their length and a digest are recorded.
//   4. Network protection — the upstream must be a private/loopback
//      address (see providers/ollama.ts#isPrivateUpstream), and the
//      gateway itself is served under /api/model/v1/* which the
//      reverse proxy must keep off the public internet.
// ============================================================

import { createHash } from 'crypto'
import { constantTimeEquals } from '@/lib/constant-time'
import { clientIp, newCorrelationId, rateLimit } from '@/lib/security'

export const MODEL_GATEWAY_KEY_ENV = 'MODEL_API_KEY'
export const MIN_GATEWAY_KEY_LENGTH = 32

export type GatewayAuthResult =
  | { ok: true; keyId: string; keyFingerprint: string }
  | { ok: false; status: number; code: string; message: string }

export function gatewayEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  const key = (env[MODEL_GATEWAY_KEY_ENV] ?? '').trim()
  return key.length >= MIN_GATEWAY_KEY_LENGTH
}

/**
 * A non-reversible fingerprint so audit rows can be correlated to a key
 * without storing the key itself.
 */
export function keyFingerprint(key: string): string {
  // 8 hex characters of a SHA-256 digest — enough to correlate, useless to replay.
  return createHash('sha256').update(key).digest('hex').slice(0, 8)
}

export function extractBearer(req: Request): string | null {
  const header = req.headers.get('authorization') ?? req.headers.get('Authorization')
  if (!header) return null
  const match = /^Bearer\s+(.+)$/i.exec(header.trim())
  return match ? match[1].trim() : null
}

export function authenticateModelRequest(
  req: Request,
  env: NodeJS.ProcessEnv = process.env,
): GatewayAuthResult {
  const configured = (env[MODEL_GATEWAY_KEY_ENV] ?? '').trim()
  if (configured.length < MIN_GATEWAY_KEY_LENGTH) {
    return {
      ok: false,
      status: 503,
      code: 'MODEL_GATEWAY_DISABLED',
      message:
        'The private model gateway is disabled: MODEL_API_KEY is not configured with at least 32 characters.',
    }
  }
  const presented = extractBearer(req)
  if (!presented) {
    return {
      ok: false,
      status: 401,
      code: 'UNAUTHENTICATED',
      message: 'A model API key is required (Authorization: Bearer <key>).',
    }
  }
  if (!constantTimeEquals(presented, configured)) {
    return {
      ok: false,
      status: 403,
      code: 'INVALID_API_KEY',
      message: 'The supplied model API key is not valid.',
    }
  }
  return { ok: true, keyId: keyFingerprint(configured), keyFingerprint: keyFingerprint(configured) }
}

export type GatewayLimit = { max: number; windowMs: number }

export const DEFAULT_GATEWAY_LIMIT: GatewayLimit = { max: 60, windowMs: 60_000 }

export function enforceGatewayRateLimit(
  req: Request,
  keyId: string,
  limit: GatewayLimit = DEFAULT_GATEWAY_LIMIT,
): { ok: boolean; retryAfter: number; remaining: number } {
  const ip = clientIp(req)
  const result = rateLimit(`model-gateway:${keyId}:${ip}`, limit.max, limit.windowMs)
  return { ok: result.ok, retryAfter: result.retryAfter, remaining: result.remaining }
}

/**
 * Normalise an untrusted chat request into the router's contract.
 * Rejects oversized payloads and unknown roles before any provider call.
 */
export function normaliseChatRequest(body: Record<string, unknown>): {
  ok: true
  value: {
    model?: string
    messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>
    temperature: number
    maxTokens: number
    topP?: number
    stop?: string[]
    jsonMode: boolean
  }
} | { ok: false; message: string } {
  const rawMessages = body.messages
  if (!Array.isArray(rawMessages) || rawMessages.length === 0) {
    return { ok: false, message: 'messages[] is required and must not be empty' }
  }
  if (rawMessages.length > 50) return { ok: false, message: 'messages[] may contain at most 50 entries' }

  const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = []
  for (const raw of rawMessages) {
    if (!raw || typeof raw !== 'object') return { ok: false, message: 'each message must be an object' }
    const entry = raw as Record<string, unknown>
    const role = entry.role
    if (role !== 'system' && role !== 'user' && role !== 'assistant') {
      return { ok: false, message: 'each message role must be system, user or assistant' }
    }
    const content = typeof entry.content === 'string' ? entry.content : ''
    if (!content.trim()) return { ok: false, message: 'each message must have non-empty content' }
    if (content.length > 32_000) return { ok: false, message: 'each message may contain at most 32000 characters' }
    messages.push({ role, content })
  }

  const temperatureRaw = Number(body.temperature ?? 0.2)
  const temperature = Number.isFinite(temperatureRaw) ? Math.max(0, Math.min(2, temperatureRaw)) : 0.2
  const maxTokensRaw = Number(body.maxTokens ?? body.max_tokens ?? 1024)
  const maxTokens = Number.isFinite(maxTokensRaw) ? Math.max(16, Math.min(8192, Math.floor(maxTokensRaw))) : 1024
  const topPRaw = Number(body.topP ?? body.top_p ?? 0)
  const topP = Number.isFinite(topPRaw) && topPRaw > 0 ? Math.min(1, topPRaw) : undefined
  const stop = Array.isArray(body.stop)
    ? body.stop.filter((s): s is string => typeof s === 'string').slice(0, 8)
    : undefined
  const responseFormat = body.response_format as { type?: unknown } | undefined
  const jsonMode =
    body.json === true || body.jsonMode === true || responseFormat?.type === 'json_object'

  return {
    ok: true,
    value: {
      model: typeof body.model === 'string' && body.model.trim() ? body.model.trim().slice(0, 120) : undefined,
      messages,
      temperature,
      maxTokens,
      topP,
      stop,
      jsonMode,
    },
  }
}

/** Digest of a prompt for audit correlation without storing customer data. */
export function promptDigest(text: string): string {
  return createHash('sha256').update(text).digest('hex').slice(0, 16)
}

export function newModelCorrelationId(): string {
  return newCorrelationId()
}
