import { db } from '@/lib/db'
import { channelStatuses } from '@/lib/comms'

export const dynamic = 'force-dynamic'

export async function GET() {
  const dbProvider = (process.env.DATABASE_URL ?? '').split(':')[0].toLowerCase() === 'mysql' ? 'MySQL' : (process.env.DATABASE_URL ?? '').startsWith('file:') ? 'SQLite' : 'database'
  const checks: Record<string, { status: string; detail?: string }> = {}
  let healthy = true
  try {
    await db.$queryRaw`SELECT 1`
    checks.database = { status: 'UP', detail: `${dbProvider} via Prisma — connected` }
  } catch (e) {
    healthy = false
    checks.database = { status: 'DOWN', detail: e instanceof Error ? e.message : 'unknown' }
  }
  try {
    const agents = await db.aiAgent.count()
    checks.aiAgents = { status: agents > 0 ? 'UP' : 'DEGRADED', detail: `${agents} agents registered` }
  } catch {
    checks.aiAgents = { status: 'UNKNOWN' }
  }
  // Autonomous AI operations service — honest status from heartbeat
  try {
    const hb = await db.setting.findUnique({ where: { key: 'ops.heartbeat' } })
    if (hb) {
      const parsed = JSON.parse(hb.value) as { at?: string; cycles?: number }
      const ageSec = parsed.at ? Math.floor((Date.now() - new Date(parsed.at).getTime()) / 1000) : null
      checks.aiOperations = ageSec !== null && ageSec < 180
        ? { status: 'ACTIVE', detail: `autonomous loop cycle #${parsed.cycles ?? '?'} · heartbeat ${ageSec}s ago` }
        : { status: 'STALE', detail: `last heartbeat ${ageSec ?? '?'}s ago — check mini-services/ai-ops` }
    } else {
      checks.aiOperations = { status: 'OFFLINE', detail: 'no heartbeat recorded — start mini-services/ai-ops' }
    }
  } catch {
    checks.aiOperations = { status: 'UNKNOWN' }
  }
  const channels = channelStatuses()
  const result = {
    status: healthy ? 'healthy' : 'unhealthy',
    timestamp: new Date().toISOString(),
    app: 'tech360-platform',
    version: '1.0.0',
    checks,
    channels,
    uptimeSeconds: Math.floor(process.uptime()),
  }
  return Response.json(result, { status: healthy ? 200 : 503 })
}
