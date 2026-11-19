import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { guard, isResponse } from '@/lib/api-guard'
import { sanitizeText } from '@/lib/security'
import { serializeRun, tenantFor, type GuardedUser } from '@/lib/automation/admin-shared'

export const dynamic = 'force-dynamic'

const RUN_STATUSES = ['PENDING', 'RUNNING', 'AWAITING_APPROVAL', 'RETRY_SCHEDULED', 'WAITING_EXTERNAL', 'SUCCEEDED', 'SUCCEEDED_WITH_ERRORS', 'FAILED', 'DEAD_LETTER', 'SKIPPED'] as const

// ADMIN — execution history (tenant-scoped). ?status=… ?ruleId=… ?q=correlationId
// `deadLetter=1` is the failed-jobs queue (FAILED + DEAD_LETTER).
export async function GET(req: NextRequest) {
  const g = await guard(req, { minRole: 'ADMIN' })
  if (isResponse(g)) return g
  const tenantId = tenantFor(g.user as GuardedUser)
  const url = new URL(req.url)
  const status = sanitizeText(url.searchParams.get('status') ?? '', 30).toUpperCase()
  const ruleId = sanitizeText(url.searchParams.get('ruleId') ?? '', 40)
  const q = sanitizeText(url.searchParams.get('q') ?? '', 100)
  const deadLetter = url.searchParams.get('deadLetter') === '1'
  const where = {
    tenantId,
    ...(deadLetter ? { status: { in: ['FAILED', 'DEAD_LETTER'] } } : (RUN_STATUSES as readonly string[]).includes(status) ? { status } : {}),
    ...(ruleId ? { ruleId } : {}),
    ...(q ? { OR: [{ correlationId: { contains: q } }, { id: q }, { eventId: q }] } : {}),
  }
  const [runs, grouped] = await Promise.all([
    db.automationRun.findMany({ where, orderBy: { createdAt: 'desc' }, take: 100 }),
    db.automationRun.groupBy({ by: ['status'], where: { tenantId }, _count: { _all: true } }),
  ])
  const ruleIds = [...new Set(runs.map((r) => r.ruleId))]
  const rules = ruleIds.length ? await db.automationRule.findMany({ where: { id: { in: ruleIds }, tenantId }, select: { id: true, name: true } }) : []
  const nameById = new Map(rules.map((r) => [r.id, r.name]))
  return Response.json({
    runs: runs.map((r) => serializeRun(r, nameById.get(r.ruleId))),
    counts: Object.fromEntries(grouped.map((g2) => [g2.status, g2._count._all])),
  })
}
