import { db } from '@/lib/db'
import { getZaiProviderStatus } from '@/lib/ai-provider'
import { channelStatuses } from '@/lib/comms'
import packageJson from '../../../../package.json'

export const dynamic = 'force-dynamic'

export async function GET() {
  const databaseUrl = process.env.DATABASE_URL ?? ''
  const dbProvider = databaseUrl.startsWith('mysql:')
    ? 'MySQL'
    : databaseUrl.startsWith('file:')
      ? 'SQLite'
      : 'database'
  const checks: Record<string, { status: string; detail?: string }> = {}
  // Safe provider states: CONFIGURED | NOT_CONFIGURED | MISCONFIGURED.
  const provider = getZaiProviderStatus()
  const providerRequired = process.env.NODE_ENV === 'production'
  let databaseHealthy = false

  checks.aiProvider = { status: provider.state, detail: provider.detail }

  try {
    // SELECT 1 proves network/credentials; this model query also confirms that
    // the essential migrated application schema is available without requiring
    // a seeded user to exist.
    await db.$queryRaw`SELECT 1`
    await db.user.findFirst({ select: { id: true } })
    databaseHealthy = true
    checks.database = { status: 'UP', detail: `${dbProvider} via Prisma — connected; core schema available` }
  } catch {
    // Keep connection details and environment/configuration internals out of
    // the public health response. Operators should use protected platform logs.
    checks.database = { status: 'DOWN', detail: 'database connection or core schema check failed' }
  }

  if (databaseHealthy) {
    try {
      const agents = await db.aiAgent.count()
      checks.aiAgents = { status: agents > 0 ? 'UP' : 'DEGRADED', detail: `${agents} agents registered` }
    } catch {
      checks.aiAgents = { status: 'UNKNOWN' }
    }

    // Autonomous AI operations service — honest status from heartbeat.
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
      checks.aiOperations = { status: 'UNKNOWN' }
    }
  } else {
    // Do not make additional database calls after a critical dependency failed.
    checks.aiAgents = { status: 'UNKNOWN', detail: 'database unavailable' }
    checks.aiOperations = { status: 'UNKNOWN', detail: 'database unavailable' }
  }

  const configuredDriver = process.env.AI_OPS_DRIVER?.trim().toLowerCase()
  const driverDisabled = configuredDriver === 'off'
  const driverActive = process.env.NODE_ENV === 'production' && !driverDisabled
  if (driverDisabled) checks.aiOperations = { status: 'DISABLED', detail: 'AI_OPS_DRIVER=off — in-process AI operations driver is intentionally disabled' }
  const aiOperationsHealthy = !driverActive || checks.aiOperations?.status === 'ACTIVE'
  const healthy = databaseHealthy && (!providerRequired || provider.configured) && aiOperationsHealthy
  const result = {
    status: healthy ? 'healthy' : 'unhealthy',
    timestamp: new Date().toISOString(),
    app: 'tech360-platform',
    version: packageJson.version,
    checks,
    channels: channelStatuses(),
    uptimeSeconds: Math.floor(process.uptime()),
  }
  return Response.json(result, { status: healthy ? 200 : 503 })
}
