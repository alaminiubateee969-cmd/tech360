import { db } from '@/lib/db'
import { channelStatuses } from '@/lib/comms'

export const dynamic = 'force-dynamic'

export async function GET() {
  const checks: Record<string, { status: string; detail?: string }> = {}
  let healthy = true
  try {
    await db.$queryRaw`SELECT 1`
    checks.database = { status: 'UP', detail: 'SQLite/Prisma connected' }
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
