import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { guard, isResponse } from '@/lib/api-guard'

export const dynamic = 'force-dynamic'
export async function GET(req: NextRequest) {
  const g = await guard(req)
  if (isResponse(g)) return g

  const [leadsTrend, pipeline, channelMix, agentActivity, execTrend] = await Promise.all([
    db.client.findMany({ where: { createdAt: { gte: new Date(Date.now() - 30 * 24 * 3600 * 1000) } }, select: { createdAt: true } }),
    db.client.groupBy({ by: ['pipelineStage'], _count: true }),
    db.communication.groupBy({ by: ['channel'], _count: true }),
    db.aiAgent.findMany({ orderBy: { executionCount: 'desc' }, take: 10, select: { code: true, name: true, executionCount: true, successCount: true, failureCount: true } }),
    db.aiAgentExecution.findMany({ where: { createdAt: { gte: new Date(Date.now() - 30 * 24 * 3600 * 1000) } }, select: { createdAt: true, status: true } }),
  ])

  const dayMap = new Map<string, number>()
  for (let i = 29; i >= 0; i--) {
    const d = new Date(Date.now() - i * 24 * 3600 * 1000).toISOString().slice(0, 10)
    dayMap.set(d, 0)
  }
  leadsTrend.forEach((c) => {
    const k = c.createdAt.toISOString().slice(0, 10)
    if (dayMap.has(k)) dayMap.set(k, (dayMap.get(k) ?? 0) + 1)
  })
  const execMap = new Map<string, number>()
  execTrend.forEach((e) => {
    const k = e.createdAt.toISOString().slice(0, 10)
    execMap.set(k, (execMap.get(k) ?? 0) + 1)
  })

  return Response.json({
    leadsTrend: [...dayMap.entries()].map(([date, count]) => ({ date, count })),
    pipeline: pipeline.map((p) => ({ stage: p.pipelineStage, count: p._count })),
    channelMix: channelMix.map((c) => ({ channel: c.channel, count: c._count })),
    agentActivity: agentActivity.map((a) => ({ code: a.code, name: a.name, executions: a.executionCount, successes: a.successCount, failures: a.failureCount })),
    executionsTrend: [...dayMap.keys()].map((date) => ({ date, count: execMap.get(date) ?? 0 })),
  })
}
