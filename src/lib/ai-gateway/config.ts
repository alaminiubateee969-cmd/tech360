// ------------------------------------------------------------
// Shared AI Gateway — typed, validated configuration.
// Fail-closed: in production a missing/invalid app registry, a
// placeholder token digest, mock mode, or prompt/completion
// logging makes readiness FAIL. The loader never invents a
// permissive default. See docs/AI_GATEWAY.md.
// ------------------------------------------------------------

export const CLASSIFICATIONS = ['PUBLIC', 'INTERNAL', 'CONFIDENTIAL', 'RESTRICTED'] as const
export type DataClassification = (typeof CLASSIFICATIONS)[number]
export const CLASSIFICATION_RANK: Record<DataClassification, number> = { PUBLIC: 0, INTERNAL: 1, CONFIDENTIAL: 2, RESTRICTED: 3 }

export interface GatewayApp {
  id: string
  tokenSha256: string
  dataClassification: DataClassification
  allowExternal: boolean
  allowedModels?: string[]
  requestsPerMinute: number
}

export interface GatewayConfig {
  isProduction: boolean
  host: string
  port: number
  apps: GatewayApp[]
  requestTimeoutMs: number
  maxRetries: number
  retryBaseMs: number
  circuitEnabled: boolean
  circuitFailureThreshold: number
  circuitResetMs: number
  maxConcurrentRequests: number
  maxInputBytes: number
  maxOutputTokens: number
  logPrompts: boolean
  logCompletions: boolean
  auditEnabled: boolean
  externalFallbackEnabled: boolean
  externalDataPolicy: 'restricted' | 'approved'
  providerAllowlist: string[]
  monthlyBudgetLimit: number | null
  maxCostPerRequest: number | null
  localModel: { baseUrl: string; name: string; apiKey: string; timeoutMs: number } | null
  openRouterApiKey: string
  mockEnabled: boolean
  mockModel: string
}

type Env = Record<string, string | undefined>

const num = (env: Env, key: string, def: number, errors: string[], min = 1, max = Number.MAX_SAFE_INTEGER): number => {
  const raw = env[key]?.trim()
  if (!raw) return def
  const n = Number(raw)
  if (!Number.isFinite(n) || n < min || n > max) {
    errors.push(`${key} must be a number between ${min} and ${max}`)
    return def
  }
  return n
}

const bool = (env: Env, key: string, def: boolean): boolean => {
  const raw = env[key]?.trim().toLowerCase()
  if (!raw) return def
  return raw === 'true' || raw === '1'
}

const money = (env: Env, key: string, errors: string[]): number | null => {
  const raw = env[key]?.trim()
  if (!raw) return null
  const n = Number(raw)
  if (!Number.isFinite(n) || n < 0) {
    errors.push(`${key} must be a non-negative number`)
    return null
  }
  return n
}

function parseApps(env: Env, errors: string[], isProduction: boolean): GatewayApp[] {
  const raw = env.AI_GATEWAY_APPS?.trim()
  if (!raw) {
    if (isProduction) errors.push('AI_GATEWAY_APPS is required in production (fail-closed: no registry, no gateway)')
    return []
  }
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    errors.push('AI_GATEWAY_APPS is not valid JSON')
    return []
  }
  if (!Array.isArray(parsed)) {
    errors.push('AI_GATEWAY_APPS must be a JSON array')
    return []
  }
  const apps: GatewayApp[] = []
  const seen = new Set<string>()
  for (const [i, item] of parsed.entries()) {
    const a = item as Partial<GatewayApp>
    const where = `AI_GATEWAY_APPS[${i}]`
    if (!a.id || typeof a.id !== 'string') { errors.push(`${where}.id is required`); continue }
    if (seen.has(a.id)) errors.push(`Duplicate gateway app id: ${a.id}`)
    seen.add(a.id)
    if (typeof a.tokenSha256 !== 'string' || !/^[0-9a-f]{64}$/.test(a.tokenSha256)) {
      errors.push(`${where}.tokenSha256 must be exactly 64 lowercase hex characters (placeholder digests are rejected)`)
      continue
    }
    if (!CLASSIFICATIONS.includes(a.dataClassification as DataClassification)) {
      errors.push(`${where}.dataClassification must be one of ${CLASSIFICATIONS.join('|')}`)
      continue
    }
    const rpm = a.requestsPerMinute ?? 60
    if (!Number.isFinite(rpm) || rpm < 1 || rpm > 100_000) { errors.push(`${where}.requestsPerMinute must be 1..100000`); continue }
    if (apps.some((existing) => existing.id === a.id)) continue
    apps.push({
      id: a.id,
      tokenSha256: a.tokenSha256,
      dataClassification: a.dataClassification as DataClassification,
      allowExternal: a.allowExternal === true,
      allowedModels: Array.isArray(a.allowedModels) ? a.allowedModels.filter((m): m is string => typeof m === 'string') : undefined,
      requestsPerMinute: rpm,
    })
  }
  return apps
}

export function loadGatewayConfig(env: Env = process.env): { config: GatewayConfig; errors: string[] } {
  const errors: string[] = []
  const isProduction = (env.NODE_ENV ?? process.env.NODE_ENV) === 'production'

  const config: GatewayConfig = {
    isProduction,
    host: env.AI_GATEWAY_HOST?.trim() || '127.0.0.1',
    port: num(env, 'AI_GATEWAY_PORT', 3180, errors, 1, 65535),
    apps: parseApps(env, errors, isProduction),
    requestTimeoutMs: num(env, 'AI_GATEWAY_REQUEST_TIMEOUT_MS', 120000, errors, 100, 300000),
    maxRetries: num(env, 'AI_GATEWAY_MAX_RETRIES', 2, errors, 0, 5),
    retryBaseMs: num(env, 'AI_GATEWAY_RETRY_BASE_MS', 120, errors, 0, 10000),
    circuitEnabled: bool(env, 'AI_GATEWAY_CIRCUIT_BREAKER_ENABLED', true),
    circuitFailureThreshold: num(env, 'AI_GATEWAY_CIRCUIT_FAILURE_THRESHOLD', 5, errors, 1, 100),
    circuitResetMs: num(env, 'AI_GATEWAY_CIRCUIT_RESET_MS', 30000, errors, 100, 600000),
    maxConcurrentRequests: num(env, 'AI_GATEWAY_MAX_CONCURRENT_REQUESTS', 8, errors, 1, 256),
    maxInputBytes: num(env, 'AI_GATEWAY_MAX_INPUT_BYTES', 1048576, errors, 1024, 16 * 1024 * 1024),
    maxOutputTokens: num(env, 'AI_GATEWAY_MAX_OUTPUT_TOKENS', 4096, errors, 1, 32768),
    logPrompts: bool(env, 'AI_GATEWAY_LOG_PROMPTS', false),
    logCompletions: bool(env, 'AI_GATEWAY_LOG_COMPLETIONS', false),
    auditEnabled: bool(env, 'AI_GATEWAY_AUDIT_ENABLED', true),
    externalFallbackEnabled: bool(env, 'AI_GATEWAY_EXTERNAL_FALLBACK_ENABLED', false),
    externalDataPolicy: env.AI_EXTERNAL_DATA_POLICY?.trim() === 'approved' ? 'approved' : 'restricted',
    providerAllowlist: (env.AI_PROVIDER_ALLOWLIST ?? '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean),
    monthlyBudgetLimit: money(env, 'AI_MONTHLY_BUDGET_LIMIT', errors),
    maxCostPerRequest: money(env, 'AI_MAX_COST_PER_REQUEST', errors),
    localModel: null,
    openRouterApiKey: env.OPENROUTER_API_KEY?.trim() ?? '',
    mockEnabled: bool(env, 'AI_GATEWAY_ENABLE_MOCK', false),
    mockModel: env.AI_GATEWAY_MOCK_MODEL?.trim() || 'mock-1',
  }

  const localUrl = env.LOCAL_MODEL_BASE_URL?.trim()
  const localName = env.LOCAL_MODEL_NAME?.trim()
  if (localUrl || localName) {
    try {
      const u = new URL(localUrl ?? '')
      if (!/^https?:$/.test(u.protocol) || !localName) throw new Error('bad')
      config.localModel = {
        baseUrl: (localUrl ?? '').replace(/\/$/, ''),
        name: localName ?? '',
        apiKey: env.LOCAL_MODEL_API_KEY?.trim() ?? '',
        timeoutMs: num(env, 'LOCAL_MODEL_REQUEST_TIMEOUT_MS', 120000, errors, 100, 300000),
      }
    } catch {
      errors.push('LOCAL_MODEL_BASE_URL must be a valid http(s) URL and LOCAL_MODEL_NAME is required to enable the local adapter')
    }
  }

  if (isProduction) {
    if (config.mockEnabled) errors.push('AI_GATEWAY_ENABLE_MOCK=true is forbidden in production')
    if (config.logPrompts) errors.push('AI_GATEWAY_LOG_PROMPTS=true is forbidden in production without a separately approved policy')
    if (config.logCompletions) errors.push('AI_GATEWAY_LOG_COMPLETIONS=true is forbidden in production without a separately approved policy')
    if (config.apps.length === 0 && !errors.some((e) => e.startsWith('AI_GATEWAY_APPS'))) {
      errors.push('AI_GATEWAY_APPS contains no valid applications')
    }
  }
  if (config.externalFallbackEnabled && config.externalDataPolicy !== 'approved') {
    errors.push('AI_GATEWAY_EXTERNAL_FALLBACK_ENABLED requires AI_EXTERNAL_DATA_POLICY=approved')
  }

  return { config, errors }
}

/** Safe diagnostics — ids and booleans only, never digests or keys. */
export function redactedDiagnostics(config: GatewayConfig, errors: string[]) {
  return {
    apps: config.apps.map((a) => a.id),
    localModel: config.localModel ? { configured: true, name: config.localModel.name } : { configured: false },
    openRouter: { configuredKey: Boolean(config.openRouterApiKey), allowlisted: config.providerAllowlist.includes('openrouter') },
    externalDataPolicy: config.externalDataPolicy,
    externalFallbackEnabled: config.externalFallbackEnabled,
    mockEnabled: config.mockEnabled,
    errors,
  }
}
