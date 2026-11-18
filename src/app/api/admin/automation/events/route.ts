import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { guard, isResponse } from '@/lib/api-guard'
import { sanitizeText } from '@/lib/security'
import { safeParse, tenantFor, type GuardedUser } from '@/lib/automation/admin-shared'

export const dynamic = 'force-dynamic'

// ADMIN — recent automation events (the event log feeding the engine), tenant-scoped.
export async function GET(req: NextRequest) {
  const g = await guard(req, { minRole: 'ADMIN' })
  if (isResponse(g)) return g
  const tenantId = tenantFor(g.user as GuardedUser)
  const url = new URL(req.url)
  const type = sanitizeText(url.searchParams.get('type') ?? '', 60)
  const status = sanitizeText(url.searchParams.get('status') ?? '', 20).toUpperCase()
  const events = await db.automationEvent.findMany({
    where: { tenantId, ...(type ? { type } : {}), ...(['PENDING', 'PROCESSED', 'FAILED'].includes(status) ? { status } : {}) },
    orderBy: { createdAt: 'desc' },
    take: 100,
  })
  return Response.json({
    events: events.map((e) => ({
      id: e.id, type: e.type, source: e.source, subjectType: e.subjectType, subjectId: e.subjectId,
      correlationId: e.correlationId, status: e.status, availableAt: e.availableAt, processedAt: e.processedAt,
      error: e.error, createdAt: e.createdAt, payload: safeParse<unknown>(e.payload, null),
    })),
  })
}
