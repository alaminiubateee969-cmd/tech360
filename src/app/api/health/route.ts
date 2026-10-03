import { db } from '@/lib/db'
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
  let healthy = false

  try {
    // SELECT 1 proves network/credentials; this model query also confirms that
    // the essential migrated application schema is available without requiring
    // a seeded user to exist.
    await db.$queryRaw`SELECT 1`
    await db.user.findFirst({ select: { id: true } })
    healthy = true
    checks.database = { status: 'UP', detail: `${dbProvider} via Prisma — connected; core schema available` }
  } catch {
    // Keep connection details and environment/configuration internals out of
    // the public health response. Operators should use protected platform logs.
    checks.database = { status: 'DOWN', detail: 'database connection or core schema check failed' }
  }

  if (healthy) {
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
        checks.aiOperations = ageSec !== null && ageSec >= 0 && ageSec < 180
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
