import { guard, isResponse } from '@/lib/api-guard'
import { AI_OPERATOR_MIN_ROLE } from '@/lib/ai-workforce-policy'
import { db } from '@/lib/db'
import { channelStatuses } from '@/lib/comms'
import { PIPELINE_LABELS, PIPELINE_STAGES } from '@/lib/constants'

export const dynamic = 'force-dynamic'

/** Read-only operational evidence, not a claim that the whole journey is complete. */
export async function GET(req: Request) {
  const g = await guard(req, { minRole: AI_OPERATOR_MIN_ROLE })
  if (isResponse(g)) return g
  try {
    const [stages, approvals, jobs, messages, agents, heartbeat] = await Promise.all([
      db.client.groupBy({ by: ['pipelineStage'], where: { deletedAt: null }, _count: { _all: true } }),
      db.approvalRequest.groupBy({ by: ['type'], where: { status: 'PENDING' }, _count: { _all: true } }),
      db.agentJob.groupBy({ by: ['status'], _count: { _all: true } }),
      db.communication.groupBy({ by: ['status'], where: { direction: 'OUT' }, _count: { _all: true } }),
      db.aiAgent.groupBy({ by: ['status'], _count: { _all: true } }),
      db.setting.findUnique({ where: { key: 'ops.heartbeat' }, select: { value: true } }),
    ])
    let heartbeatAt: string | null = null
    try {
      const value = JSON.parse(heartbeat?.value ?? '{}')
      if (typeof value.at === 'string' && Number.isFinite(Date.parse(value.at))) heartbeatAt = new Date(value.at).toISOString()
    } catch { /* Missing evidence is offline, never successful. */ }
    const age = heartbeatAt ? Math.max(0, Math.round((Date.now() - Date.parse(heartbeatAt)) / 1000)) : null
    const interval = Math.max(30, Number(process.env.OPS_INTERVAL_SEC ?? 90) || 90)
    return Response.json({
      checkedAt: new Date().toISOString(),
      worker: { state: age === null ? 'OFFLINE' : age > interval * 3 ? 'STALE' : 'ACTIVE', heartbeatAt, ageSeconds: age },
      stages: PIPELINE_STAGES.map((stage) => ({ stage, label: PIPELINE_LABELS[stage], count: stages.find((row) => row.pipelineStage === stage)?._count._all ?? 0 })),
      approvals: approvals.map((row) => ({ type: row.type, count: row._count._all })),
      jobs: jobs.map((row) => ({ status: row.status, count: row._count._all })),
      outbound: messages.map((row) => ({ status: row.status, count: row._count._all })),
      agents: agents.map((row) => ({ status: row.status, count: row._count._all })),
      channels: channelStatuses(),
    }, { headers: { 'Cache-Control': 'private, no-store' } })
  } catch {
    return Response.json({ error: 'Live pipeline evidence unavailable. Check database connectivity; completion cannot be verified.' }, { status: 503 })
  }
}
