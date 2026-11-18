import { db } from '@/lib/db'
import { getAgentProviderStatus } from '@/lib/agents/provider-selection'

/**
 * AI platform diagnostics: database, selected AI provider, agent registry and
 * the autonomous operations driver/heartbeat.
 *
 * These details are OPERATOR-ONLY. The public /api/health endpoint was
 * deliberately minimised (security: provider configuration, agent counts and
 * internal heartbeats must not be disclosed to anonymous callers), so this
 * module is consumed by the authenticated /api/health/deep route and by the
 * code-only verifier (scripts/verify-ai-production.ts) — never by public routes.
 *
 * Provider states are the safe tri-state from provider-selection:
 * CONFIGURED | NOT_CONFIGURED | MISCONFIGURED. Credentials, connection strings
 * and hostnames are never included in any detail string.
 */
export type HealthCheck = { status: string; detail?: string; provider?: string }

export interface AiPlatformDiagnostics {
  /** True when the database is up, the provider is configured where required, and an active driver has a fresh heartbeat. */
  healthy: boolean
  databaseHealthy: boolean
  checks: {
    database: HealthCheck
    aiProvider: HealthCheck
    aiAgents: HealthCheck
    aiOperations: HealthCheck
  }
}

/** Database engine label derived from the URL scheme only (never the URL itself). */
function databaseEngineLabel(): string {
  // Only the scheme of DATABASE_URL is inspected; its value is never echoed.
  const scheme = (process.env.DATABASE_URL ?? '').split(':', 1)[0].toLowerCase()
  if (scheme.startsWith('mysql')) return 'MySQL'
  if (scheme === 'file') return 'SQLite'
  return 'database'
}

export async function collectAiPlatformDiagnostics(): Promise<AiPlatformDiagnostics> {
  const checks = {} as AiPlatformDiagnostics['checks']
  const provider = getAgentProviderStatus()
  const providerRequired = process.env.NODE_ENV === 'production'
  let databaseHealthy = false

  checks.aiProvider = { status: provider.state, detail: provider.detail, provider: provider.provider }

  try {
    // SELECT 1 proves network/credentials; the model query confirms the
    // migrated core schema without requiring a seeded user.
    await db.$queryRaw`SELECT 1`
    await db.user.findFirst({ select: { id: true } })
    databaseHealthy = true
    checks.database = { status: 'UP', detail: `${databaseEngineLabel()} via Prisma — connected; core schema available` }
  } catch {
    checks.database = { status: 'DOWN', detail: 'database connection or core schema check failed' }
  }

  if (databaseHealthy) {
    try {
      const agents = await db.aiAgent.count()
      checks.aiAgents = { status: agents > 0 ? 'UP' : 'DEGRADED', detail: `${agents} agents registered` }
    } catch {
      checks.aiAgents = { status: 'UNKNOWN', detail: 'agent registry could not be read' }
    }

    try {
      const hb = await db.setting.findUnique({ where: { key: 'ops.heartbeat' } })
      if (hb) {
        const parsed = JSON.parse(hb.value) as { at?: string; cycles?: number }
        const heartbeatAt = parsed.at ? new Date(parsed.at).getTime() : Number.NaN
        const ageSec = Number.isFinite(heartbeatAt) ? Math.floor((Date.now() - heartbeatAt) / 1000) : null
        const intervalSec = Math.max(30, Number(process.env.OPS_INTERVAL_SEC ?? 90) || 90)
        checks.aiOperations = ageSec !== null && ageSec >= 0 && ageSec < intervalSec * 3
          ? { status: 'ACTIVE', detail: `autonomous loop cycle #${parsed.cycles ?? '?'} · heartbeat ${ageSec}s ago` }
          : { status: 'STALE', detail: `last heartbeat ${ageSec ?? '?'}s ago — check mini-services/ai-ops` }
      } else {
        checks.aiOperations = { status: 'OFFLINE', detail: 'no heartbeat recorded — start mini-services/ai-ops' }
      }
    } catch {
      checks.aiOperations = { status: 'UNKNOWN', detail: 'operations heartbeat could not be read' }
    }
  } else {
    // No further database calls after a critical dependency failed.
    checks.aiAgents = { status: 'UNKNOWN', detail: 'database unavailable' }
    checks.aiOperations = { status: 'UNKNOWN', detail: 'database unavailable' }
  }

  // The driver state is env-derived, so it stays honest even when the DB is down.
  const configuredDriver = process.env.AI_OPS_DRIVER?.trim().toLowerCase()
  const driverDisabled = configuredDriver === 'off'
  const driverActive = process.env.NODE_ENV === 'production' && !driverDisabled
  if (driverDisabled) {
    checks.aiOperations = { status: 'DISABLED', detail: 'AI_OPS_DRIVER=off — in-process AI operations driver is intentionally disabled' }
  }
  const aiOperationsHealthy = !driverActive || checks.aiOperations.status === 'ACTIVE'
  const healthy = databaseHealthy && (!providerRequired || provider.configured) && aiOperationsHealthy

  return { healthy, databaseHealthy, checks }
}
