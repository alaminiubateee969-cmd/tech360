import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { guard, isResponse } from '@/lib/api-guard'

export const dynamic = 'force-dynamic'

// GET /api/admin/ops-status — live state of the autonomous AI Operations
// loop + agent workforce execution evidence. All numbers are real queries;
// if the loop is down this endpoint says so honestly.
export async function GET(req: NextRequest) {
  const g = await guard(req)
  if (isResponse(g)) return g

  const [heartbeatSetting, lastCycles, agentAgg, exec24h, notificationAgg] = await Promise.all([
    db.setting.findUnique({ where: { key: 'ops.heartbeat' } }),
    db.automationLog.findMany({ where: { workflow: 'AI_OPS_LOOP' }, orderBy: { startedAt: 'desc' }, take: 3, select: { id: true, startedAt: true, finishedAt: true, status: true, output: true, steps: true } }),
    db.aiAgent.aggregate({ _count: true, _sum: { executionCount: true, successCount: true, failureCount: true } }),
    db.aiAgentExecution.count({ where: { createdAt: { gte: new Date(Date.now() - 24 * 3600 * 1000) } } }),
    db.notification.aggregate({ where: { read: false }, _count: true }),
  ])

  // heartbeat value: { at: ISO, cycles: number, service: string }
  let hbAt = 0
  let hbCycles: number | null = null
  if (heartbeatSetting) {
    try {
      const parsed = JSON.parse(heartbeatSetting.value) as { at?: string; cycles?: number }
      hbAt = parsed.at ? new Date(parsed.at).getTime() : 0
      hbCycles = typeof parsed.cycles === 'number' ? parsed.cycles : null
    } catch { /* honest fallback: treat as offline */ }
  }
  const heartbeatAgeSec = hbAt > 0 ? Math.max(0, Math.round((Date.now() - hbAt) / 1000)) : null
  // the loop beats every OPS_INTERVAL_SEC (default 90s) — stale after 3 missed beats
  const intervalSec = Math.max(30, Number(process.env.OPS_INTERVAL_SEC ?? 90) || 90)
  const status = heartbeatAgeSec == null ? 'OFFLINE' : heartbeatAgeSec <= intervalSec * 3 ? 'ACTIVE' : 'STALE'

  const cycles = lastCycles.map((c) => {
    let summary: Record<string, unknown> = {}
    let actions: string[] = []
    try { summary = c.output ? JSON.parse(c.output) as Record<string, unknown> : {} } catch { /* honest fallback */ }
    try { actions = c.steps ? (JSON.parse(c.steps) as string[]).slice(0, 8) : [] } catch { /* honest fallback */ }
    return { id: c.id, at: c.startedAt, status: c.status, summary, actions }
  })

  return Response.json({
    status, // ACTIVE | STALE | OFFLINE — honest, never faked
    heartbeatAgeSec,
    intervalSec,
    cycles: hbCycles,
    lastCycleAt: cycles[0]?.at ?? null,
    recentCycles: cycles,
    agents: {
      registered: agentAgg._count,
      totalExecutions: agentAgg._sum.executionCount ?? 0,
      successes: agentAgg._sum.successCount ?? 0,
      failures: agentAgg._sum.failureCount ?? 0,
      executions24h: exec24h,
    },
    unreadAlerts: notificationAgg._count,
  })
}
