export const DEFAULT_AGENT_RUN_TIMEOUT_MS = 60_000
export const MAX_AGENT_RUN_TIMEOUT_MS = 300_000
export const MAX_RETRY_ATTEMPTS = 2

export type EnvLike = Record<string, string | undefined>

export function resolveAgentTimeoutMs(env: EnvLike = process.env): number {
  const parsed = Number(env.AGENT_RUN_TIMEOUT_MS ?? DEFAULT_AGENT_RUN_TIMEOUT_MS)
  if (!Number.isFinite(parsed)) return DEFAULT_AGENT_RUN_TIMEOUT_MS
  return Math.min(MAX_AGENT_RUN_TIMEOUT_MS, Math.max(5_000, Math.floor(parsed)))
}

export function resolveOpsIntervalSec(env: EnvLike = process.env): number {
  const parsed = Number(env.OPS_INTERVAL_SEC ?? 90)
  if (!Number.isFinite(parsed)) return 90
  return Math.max(30, Math.floor(parsed))
}

export class RunTimeoutError extends Error {
  readonly code = 'PROVIDER_TIMEOUT'

  constructor(timeoutMs: number) {
    super(`AI provider request timed out after ${timeoutMs}ms`)
    this.name = 'RunTimeoutError'
  }
}

type PromiseWork<T> = Promise<T> | ((signal: AbortSignal) => Promise<T>)

export async function withTimeout<T>(work: PromiseWork<T>, timeoutMs: number): Promise<T> {
  const controller = new AbortController()
  let promise: Promise<T>
  try {
    promise = typeof work === 'function' ? work(controller.signal) : work
  } catch (error) {
    return Promise.reject(error)
  }

  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => {
          controller.abort()
          reject(new RunTimeoutError(timeoutMs))
        }, timeoutMs)
      }),
    ])
  } finally {
    if (timer) clearTimeout(timer)
  }
}

export function isTransientRunError(error: unknown): boolean {
  const status = typeof error === 'object' && error !== null && 'status' in error
    ? Number((error as { status?: unknown }).status)
    : Number.NaN
  const code = typeof error === 'object' && error !== null && 'code' in error
    ? String((error as { code?: unknown }).code)
    : ''
  if (code === 'PROVIDER_TIMEOUT' || (code === 'PROVIDER_ERROR' && !Number.isFinite(status))) return true
  if ([408, 409, 425, 429].includes(status) || (status >= 500 && status <= 599)) return true
  const message = error instanceof Error ? error.message : String(error)
  return /\b(?:ECONNRESET|ECONNREFUSED|ETIMEDOUT|EAI_AGAIN|socket hang up|temporarily unavailable)\b/i.test(message)
}

export function tryStartCycle(lastStartedAt: Date | null, now = new Date(), minIntervalMs = 45_000): boolean {
  if (!lastStartedAt) return true
  return now.getTime() - lastStartedAt.getTime() >= minIntervalMs
}

export function finishCycle(startedAt: Date, finishedAt = new Date()): { durationMs: number; finishedAt: string } {
  return {
    durationMs: Math.max(0, finishedAt.getTime() - startedAt.getTime()),
    finishedAt: finishedAt.toISOString(),
  }
}
