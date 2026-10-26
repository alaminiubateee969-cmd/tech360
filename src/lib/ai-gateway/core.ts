// ------------------------------------------------------------
// Shared AI Gateway — core execution pipeline.
// Authenticate (SHA-256 app registry) -> size limits -> rate limit
// -> classification policy -> model allowlist -> route decision
// (local -> approved external -> dev-only mock; never silently
// external) -> bounded retry + circuit breaker + concurrency cap
// + budget checks -> secret-safe audit events.
// Providers are injected, so every behaviour here is unit-tested
// in tests/ai-gateway.test.ts without network access.
// ------------------------------------------------------------
import { createHash, randomUUID, timingSafeEqual } from 'node:crypto'
import { CLASSIFICATION_RANK, type DataClassification, type GatewayApp, type GatewayConfig } from './config'

export const GATEWAY_ERROR = {
  UNAUTHENTICATED: 'UNAUTHENTICATED',
  UNKNOWN_APPLICATION: 'UNKNOWN_APPLICATION',
  INVALID_CREDENTIAL: 'INVALID_CREDENTIAL',
  RATE_LIMITED: 'RATE_LIMITED',
  CONCURRENCY_LIMITED: 'CONCURRENCY_LIMITED',
  INPUT_TOO_LARGE: 'INPUT_TOO_LARGE',
  POLICY_DENIED: 'POLICY_DENIED',
  MODEL_NOT_ALLOWED: 'MODEL_NOT_ALLOWED',
  UNKNOWN_COST: 'UNKNOWN_COST',
  BUDGET_EXCEEDED: 'BUDGET_EXCEEDED',
  NO_PROVIDER_AVAILABLE: 'NO_PROVIDER_AVAILABLE',
  CIRCUIT_OPEN: 'CIRCUIT_OPEN',
  PROVIDER_TIMEOUT: 'PROVIDER_TIMEOUT',
  PROVIDER_BAD_RESPONSE: 'PROVIDER_BAD_RESPONSE',
  PROVIDER_ERROR: 'PROVIDER_ERROR',
  EXTERNAL_POLICY_BLOCKED: 'EXTERNAL_POLICY_BLOCKED',
} as const
export type GatewayErrorCode = (typeof GATEWAY_ERROR)[keyof typeof GATEWAY_ERROR]

export interface GatewayMessage { role: 'system' | 'user' | 'assistant'; content: string }
export interface GatewayRequest {
  messages: GatewayMessage[]
  model?: string
  dataClassification?: DataClassification
  maxTokens?: number
}
export interface ProviderResult { content: string; usage?: { promptTokens?: number; completionTokens?: number }; costUsd?: number | null; latencyMs?: number }
export type ProviderFn = (req: { model: string; messages: GatewayMessage[]; maxTokens: number; timeoutMs: number }) => Promise<ProviderResult>
export interface AuditEvent {
  event: 'ai_gateway.request'
  correlationId: string
  appId: string
  provider: string
  model: string
  classification: DataClassification
  outcome: string
  latencyMs: number
  promptTokens?: number
  completionTokens?: number
  costUsd: number | null
  at: string
}

const sha256 = (s: string) => createHash('sha256').update(s).digest('hex')

export function parseBearer(header: string | null): string | null {
  if (!header) return null
  const m = /^Bearer\s+(.+)$/i.exec(header.trim())
  return m ? m[1].trim() : null
}

export function authenticateApp(config: GatewayConfig, token: string | null): { ok: true; app: GatewayApp } | { ok: false; code: GatewayErrorCode } {
  if (!token) return { ok: false, code: GATEWAY_ERROR.UNAUTHENTICATED }
  if (!/^[A-Za-z0-9_-]{16,256}$/.test(token)) return { ok: false, code: GATEWAY_ERROR.UNAUTHENTICATED }
  const digest = sha256(token)
  const app = config.apps.find((a) => timingSafeEqual(Buffer.from(a.tokenSha256), Buffer.from(digest)))
  if (!app) return { ok: false, code: GATEWAY_ERROR.INVALID_CREDENTIAL }
  return { ok: true, app }
}

// ---------------- shared mutable state ----------------
export interface GatewayState {
  rate: Map<string, { windowStart: number; count: number }>
  concurrent: number
  circuits: Map<string, { failures: number; openUntil: number; lastError?: string }>
  monthlySpend: Map<string, number>
  metrics: { started: number; succeeded: number; failed: number; rateLimited: number; policyDenied: number }
}

export function createGatewayState(): GatewayState {
  return { rate: new Map(), concurrent: 0, circuits: new Map(), monthlySpend: new Map(), metrics: { started: 0, succeeded: 0, failed: 0, rateLimited: 0, policyDenied: 0 } }
}

// Survives dev reloads; a real multi-process deployment must move
// this state to the database/Redis — noted in docs/AI_GATEWAY.md.
const g = globalThis as unknown as { __tech360GatewayState?: GatewayState }
export function gatewayState(): GatewayState {
  g.__tech360GatewayState ??= createGatewayState()
  return g.__tech360GatewayState
}

export function checkRateLimit(state: GatewayState, app: GatewayApp, now = Date.now(), windowMs = 60_000): boolean {
  const entry = state.rate.get(app.id)
  if (!entry || now - entry.windowStart >= windowMs) {
    state.rate.set(app.id, { windowStart: now, count: 1 })
    return true
  }
  if (entry.count >= app.requestsPerMinute) return false
  entry.count += 1
  return true
}

function circuit(config: GatewayConfig, state: GatewayState, provider: string) {
  return state.circuits.get(provider) ?? { failures: 0, openUntil: 0 }
}
function circuitOpen(config: GatewayConfig, state: GatewayState, provider: string, now: number): boolean {
  if (!config.circuitEnabled) return false
  return circuit(config, state, provider).openUntil > now
}
function circuitFailure(config: GatewayConfig, state: GatewayState, provider: string, now: number, error: string) {
  if (!config.circuitEnabled) return
  const c = circuit(config, state, provider)
  c.failures += 1
  c.lastError = error
  if (c.failures >= config.circuitFailureThreshold) c.openUntil = now + config.circuitResetMs
  state.circuits.set(provider, c)
}
function circuitSuccess(state: GatewayState, provider: string) {
  state.circuits.set(provider, { failures: 0, openUntil: 0 })
}

export interface RouteDecision { provider: 'local' | 'external' | 'mock'; model: string }
export function externalPermitted(config: GatewayConfig, app: GatewayApp, classification: DataClassification): boolean {
  return (
    app.allowExternal &&
    config.externalDataPolicy === 'approved' &&
    config.providerAllowlist.includes('openrouter') &&
    Boolean(config.openRouterApiKey) &&
    CLASSIFICATION_RANK[classification] <= CLASSIFICATION_RANK.INTERNAL
  )
}

export function decideRoute(
  config: GatewayConfig,
  app: GatewayApp,
  classification: DataClassification,
  requestedModel?: string,
): { ok: true; routes: RouteDecision[] } | { ok: false; code: GatewayErrorCode; message: string } {
  if (CLASSIFICATION_RANK[classification] > CLASSIFICATION_RANK[app.dataClassification]) {
    return { ok: false, code: GATEWAY_ERROR.POLICY_DENIED, message: `${classification} exceeds the maximum classification registered for ${app.id}` }
  }
  if (requestedModel && app.allowedModels?.length && !app.allowedModels.includes(requestedModel)) {
    return { ok: false, code: GATEWAY_ERROR.MODEL_NOT_ALLOWED, message: `Model ${requestedModel} is not in the allowlist for ${app.id}` }
  }
  const routes: RouteDecision[] = []
  const local = config.localModel
  if (local && (!requestedModel || requestedModel === local.name) && (!app.allowedModels?.length || app.allowedModels.includes(local.name))) {
    routes.push({ provider: 'local', model: local.name })
  }
  if (externalPermitted(config, app, classification)) {
    const externalModel = requestedModel ?? 'openrouter/free'
    if (!app.allowedModels?.length || app.allowedModels.includes(externalModel)) {
      // External is a fallback after local unless it is the only route.
      if (!local || config.externalFallbackEnabled) routes.push({ provider: 'external', model: externalModel })
      else if (!routes.length) routes.push({ provider: 'external', model: externalModel })
    }
  }
  if (!routes.length && config.mockEnabled && !config.isProduction) {
    routes.push({ provider: 'mock', model: config.mockModel })
  }
  if (!routes.length) {
    const wantsExternal = requestedModel && !local
    return {
      ok: false,
      code: wantsExternal ? GATEWAY_ERROR.EXTERNAL_POLICY_BLOCKED : GATEWAY_ERROR.NO_PROVIDER_AVAILABLE,
      message: 'No permitted provider route exists for this application, classification, and model',
    }
  }
  return { ok: true, routes }
}

const FREE_MODEL = /(^|[/:])free($|[/:])/i
export function estimateCostUsd(provider: string, model: string, result?: Partial<ProviderResult>): number | null {
  if (result && typeof result.costUsd === 'number') return result.costUsd
  if (provider === 'mock') return 0
  if (provider === 'external' && (model === 'openrouter/free' || FREE_MODEL.test(model))) return 0
  return null // unknown — never fabricate a price
}

const retryable = (error: unknown): boolean => {
  if (error instanceof Error && (error.name === 'AbortError' || /timeout|5\d\d|ECONN|network/i.test(error.message))) return true
  return false
}

export interface ExecuteDeps {
  providers: Partial<Record<'local' | 'external' | 'mock', ProviderFn>>
  audit?: (event: AuditEvent) => void | Promise<void>
  state?: GatewayState
  now?: () => number
  sleep?: (ms: number) => Promise<void>
}

export interface ExecuteResult {
  status: number
  body: Record<string, unknown>
}

/** The full pipeline. `rawBytes` is the request body size for the
 *  limit check (the route measures the real payload). */
export async function executeGatewayRequest(
  config: GatewayConfig,
  deps: ExecuteDeps,
  input: { authHeader: string | null; request: GatewayRequest; rawBytes: number },
): Promise<ExecuteResult> {
  const state = deps.state ?? gatewayState()
  const now = deps.now ?? Date.now
  const sleep = deps.sleep ?? ((ms: number) => new Promise((r) => setTimeout(r, ms)))
  const correlationId = randomUUID()
  const fail = (status: number, code: GatewayErrorCode, message: string, extra: Record<string, unknown> = {}): ExecuteResult => ({
    status,
    body: { error: { code, message }, correlationId, ...extra },
  })

  const token = parseBearer(input.authHeader)
  const auth = authenticateApp(config, token)
  if (!auth.ok) return fail(401, auth.code, 'Application authentication failed')
  const app = auth.app

  if (input.rawBytes > config.maxInputBytes) return fail(413, GATEWAY_ERROR.INPUT_TOO_LARGE, `Request exceeds ${config.maxInputBytes} bytes`)
  if (!Array.isArray(input.request.messages) || input.request.messages.length === 0) {
    return fail(400, GATEWAY_ERROR.POLICY_DENIED, 'messages must be a non-empty array')
  }

  state.metrics.started += 1
  if (!checkRateLimit(state, app, now())) {
    state.metrics.rateLimited += 1
    return fail(429, GATEWAY_ERROR.RATE_LIMITED, `Rate limit of ${app.requestsPerMinute} requests/minute exceeded for ${app.id}`, { retryAfterSeconds: 60 })
  }
  if (state.concurrent >= config.maxConcurrentRequests) {
    return fail(429, GATEWAY_ERROR.CONCURRENCY_LIMITED, 'Gateway concurrency limit reached, retry shortly')
  }

  const classification = input.request.dataClassification ?? 'INTERNAL'
  const route = decideRoute(config, app, classification, input.request.model)
  if (!route.ok) {
    state.metrics.policyDenied += 1
    return fail(route.code === GATEWAY_ERROR.MODEL_NOT_ALLOWED || route.code === GATEWAY_ERROR.POLICY_DENIED || route.code === GATEWAY_ERROR.EXTERNAL_POLICY_BLOCKED ? 403 : 503, route.code, route.message)
  }

  const maxTokens = Math.min(Math.max(1, input.request.maxTokens ?? config.maxOutputTokens), config.maxOutputTokens)
  state.concurrent += 1
  const startedAt = now()
  try {
    let lastError: unknown
    for (const decision of route.routes) {
      const providerFn = deps.providers[decision.provider]
      if (!providerFn) continue
      if (circuitOpen(config, state, decision.provider, now())) {
        lastError = new Error(`circuit open for ${decision.provider}`)
        continue
      }
      // Budget gates run before any provider spend.
      const preCost = estimateCostUsd(decision.provider, decision.model)
      if ((config.monthlyBudgetLimit !== null || config.maxCostPerRequest !== null) && preCost === null) {
        return fail(403, GATEWAY_ERROR.UNKNOWN_COST, `Cost of ${decision.provider}/${decision.model} is unknown; budgets are configured, so the request is refused rather than guessed`)
      }
      if (preCost !== null) {
        if (config.maxCostPerRequest !== null && preCost > config.maxCostPerRequest) return fail(403, GATEWAY_ERROR.BUDGET_EXCEEDED, 'Estimated cost exceeds AI_MAX_COST_PER_REQUEST')
        const spent = state.monthlySpend.get(app.id) ?? 0
        if (config.monthlyBudgetLimit !== null && spent + preCost > config.monthlyBudgetLimit) return fail(403, GATEWAY_ERROR.BUDGET_EXCEEDED, 'Monthly AI budget limit reached for this application')
      }

      for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
        try {
          const result = await providerFn({ model: decision.model, messages: input.request.messages, maxTokens, timeoutMs: config.requestTimeoutMs })
          if (!result || typeof result.content !== 'string' || !result.content.trim()) {
            throw Object.assign(new Error('Provider returned an empty or malformed response'), { name: 'BadResponse' })
          }
          const cost = estimateCostUsd(decision.provider, decision.model, result)
          if (cost !== null) state.monthlySpend.set(app.id, (state.monthlySpend.get(app.id) ?? 0) + cost)
          circuitSuccess(state, decision.provider)
          state.metrics.succeeded += 1
          const latencyMs = now() - startedAt
          if (config.auditEnabled && deps.audit) {
            await Promise.resolve(deps.audit({
              event: 'ai_gateway.request', correlationId, appId: app.id, provider: decision.provider, model: decision.model,
              classification, outcome: 'success', latencyMs,
              promptTokens: result.usage?.promptTokens, completionTokens: result.usage?.completionTokens,
              costUsd: cost, at: new Date(now()).toISOString(),
            })).catch(() => undefined)
          }
          return {
            status: 200,
            body: {
              id: `chatcmpl-${correlationId}`,
              object: 'chat.completion',
              model: decision.model,
              provider: decision.provider,
              app: app.id,
              dataClassification: classification,
              choices: [{ index: 0, message: { role: 'assistant', content: result.content }, finish_reason: 'stop' }],
              usage: result.usage ?? null,
              costUsd: cost,
              mock: decision.provider === 'mock',
              correlationId,
            },
          }
        } catch (error) {
          lastError = error
          const badResponse = error instanceof Error && error.name === 'BadResponse'
          circuitFailure(config, state, decision.provider, now(), error instanceof Error ? error.message : String(error))
          if (attempt < config.maxRetries && (retryable(error) || badResponse)) {
            await sleep(config.retryBaseMs * 2 ** attempt)
            continue
          }
          break
        }
      }
      // Local failed: the next route (approved external/mock) is
      // tried only because decideRoute already permitted it.
    }
    state.metrics.failed += 1
    const latencyMs = now() - startedAt
    if (config.auditEnabled && deps.audit) {
      await Promise.resolve(deps.audit({
        event: 'ai_gateway.request', correlationId, appId: app.id, provider: route.routes[0].provider, model: route.routes[0].model,
        classification, outcome: 'provider_error', latencyMs, costUsd: null, at: new Date(now()).toISOString(),
      })).catch(() => undefined)
    }
    return fail(502, GATEWAY_ERROR.PROVIDER_ERROR, lastError instanceof Error ? lastError.message : 'All permitted provider routes failed', { correlationId })
  } finally {
    state.concurrent -= 1
  }
}

/** Real inference only: mock never counts toward readiness. */
export function readiness(config: GatewayConfig, configErrors: string[]): { ready: boolean; failures: string[] } {
  const failures = [...configErrors]
  if (config.apps.length === 0) failures.push('No gateway applications are registered')
  const hasLocal = Boolean(config.localModel)
  const hasExternal = Boolean(config.openRouterApiKey) && config.providerAllowlist.includes('openrouter')
  if (!hasLocal && !hasExternal) failures.push('No real inference provider is configured (local model or allowlisted external provider with credentials)')
  return { ready: failures.length === 0, failures }
}
