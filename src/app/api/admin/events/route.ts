import { NextRequest } from 'next/server'
import { guard, isResponse } from '@/lib/api-guard'
import { eventHistory, listSubscriptions, EVENT_TYPES } from '@/lib/events/bus'

export const dynamic = 'force-dynamic'

/**
 * GET /api/admin/events — the event bus.
 *
 * The event history is read from the AgentEvent table, so it is the
 * REAL record of what the workforce published. The subscriber list is
 * the live registry of handlers.
 */
export async function GET(req: NextRequest) {
  const g = await guard(req, { minRole: 'SUPER_ADMIN' })
  if (isResponse(g)) return g

  const params = req.nextUrl.searchParams
  const type = params.get('type')
  const source = params.get('source')
  const limit = Math.max(1, Math.min(200, Number(params.get('limit') ?? 50)))

  const events = await eventHistory({
    type: type && (EVENT_TYPES as readonly string[]).includes(type) ? (type as never) : undefined,
    source: source ?? undefined,
    limit,
  })

  const byType = new Map<string, number>()
  for (const event of events) byType.set(event.type, (byType.get(event.type) ?? 0) + 1)

  return Response.json({
    events,
    total: events.length,
    byType: Object.fromEntries(byType),
    eventTypes: EVENT_TYPES,
    subscribers: listSubscriptions(),
  })
}
