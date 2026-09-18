import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { guard, isResponse } from '@/lib/api-guard'

export const dynamic = 'force-dynamic'

const DAY_MS = 24 * 3600 * 1000
const CONVERSION_EVENT_NAMES = new Set(['lead', 'contact', 'form_submit', 'conversion', 'approval', 'whatsapp_click'])

function dayKey(d: Date): string {
  return d.toISOString().slice(0, 10)
}

/** meta is a JSON string column — parse defensively after fetching. */
function parseMeta(meta: string | null): Record<string, unknown> {
  if (!meta) return {}
  try {
    const v = JSON.parse(meta)
    return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {}
  } catch {
    return {}
  }
}

/** Referrer source = URL host from the event meta, or 'Direct / unknown'. */
function referrerSource(meta: string | null): string {
  const ref = parseMeta(meta).referrer
  if (typeof ref === 'string' && ref.trim()) {
    try {
      const host = new URL(ref).hostname.replace(/^www\./, '')
      if (host) return host
    } catch {
      // not a URL → treat as unknown
    }
  }
  return 'Direct / unknown'
}

export async function GET(req: NextRequest) {
  const g = await guard(req, { minRole: 'MANAGER' })
  if (isResponse(g)) return g

  const cutoff30 = new Date(Date.now() - 30 * DAY_MS)

  const [leadsTrend, pipeline, channelMix, agentActivity, execTrend, events] = await Promise.all([
    db.client.findMany({ where: { createdAt: { gte: cutoff30 } }, select: { createdAt: true } }),
    db.client.groupBy({ by: ['pipelineStage'], _count: true }),
    db.communication.groupBy({ by: ['channel'], _count: true }),
    db.aiAgent.findMany({ orderBy: { executionCount: 'desc' }, take: 10, select: { code: true, name: true, executionCount: true, successCount: true, failureCount: true } }),
    db.aiAgentExecution.findMany({ where: { createdAt: { gte: cutoff30 } }, select: { createdAt: true, status: true } }),
    // NOTE: TrackingEvent.createdAt is epoch millis (Prisma DateTime) — millisecond
    // cutoffs only, never datetime() SQL. meta is a JSON string parsed in JS.
    db.trackingEvent.findMany({ where: { createdAt: { gte: cutoff30 } }, select: { name: true, path: true, anonId: true, meta: true, createdAt: true } }),
  ])

  const dayMap = new Map<string, number>()
  for (let i = 29; i >= 0; i--) {
    const d = new Date(Date.now() - i * DAY_MS)
    dayMap.set(dayKey(d), 0)
  }
  leadsTrend.forEach((c) => {
    const k = dayKey(c.createdAt)
    if (dayMap.has(k)) dayMap.set(k, (dayMap.get(k) ?? 0) + 1)
  })
  const execMap = new Map<string, number>()
  execTrend.forEach((e) => {
    const k = dayKey(e.createdAt)
    execMap.set(k, (execMap.get(k) ?? 0) + 1)
  })

  // ---------------- Website traffic (TrackingEvent-based) ----------------
  const pageviews = events.filter((e) => e.name === 'page_view')

  // 30-day series. Honest undercount: events recorded before the anonId
  // field existed carry null — all nulls collapse into ONE legacy bucket
  // per day rather than counting as separate visitors.
  const trafficTrend: Array<{ date: string; pageviews: number; uniques: number }> = []
  for (let i = 29; i >= 0; i--) {
    const day = dayKey(new Date(Date.now() - i * DAY_MS))
    const dayEvents = pageviews.filter((e) => dayKey(e.createdAt) === day)
    const ids = new Set<string>()
    let legacyNull = false
    for (const e of dayEvents) {
      if (e.anonId) ids.add(e.anonId)
      else legacyNull = true
    }
    trafficTrend.push({
      date: day,
      pageviews: dayEvents.length,
      uniques: ids.size + (legacyNull ? 1 : 0),
    })
  }

  const totalPageviews = pageviews.length
  const pageCount = new Map<string, number>()
  for (const e of pageviews) {
    const path = (e.path ?? '(no path)').slice(0, 200)
    pageCount.set(path, (pageCount.get(path) ?? 0) + 1)
  }
  const topPages = [...pageCount.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([path, count]) => ({
      path,
      count,
      share: totalPageviews > 0 ? Math.round((count / totalPageviews) * 1000) / 10 : 0,
    }))

  const refCount = new Map<string, number>()
  for (const e of pageviews) {
    const src = referrerSource(e.meta)
    refCount.set(src, (refCount.get(src) ?? 0) + 1)
  }
  const referrers = [...refCount.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([source, count]) => ({ source, count }))

  const eventCount = new Map<string, number>()
  for (const e of events) eventCount.set(e.name, (eventCount.get(e.name) ?? 0) + 1)
  const eventMix = [...eventCount.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([name, count]) => ({ name, count }))

  const todayKey = dayKey(new Date())
  const viewsToday = pageviews.filter((e) => dayKey(e.createdAt) === todayKey).length
  const uniqueIds = new Set<string>()
  let legacyNull30 = false
  for (const e of pageviews) {
    if (e.anonId) uniqueIds.add(e.anonId)
    else legacyNull30 = true
  }
  const conversionEvents30 = events.filter((e) => CONVERSION_EVENT_NAMES.has(e.name)).length

  const trafficKpis = {
    pageviews30: totalPageviews,
    uniques30: uniqueIds.size + (legacyNull30 ? 1 : 0),
    viewsToday,
    conversionEvents30,
    topReferrer: referrers[0]?.source ?? 'Direct / unknown',
  }

  return Response.json({
    // existing keys (unchanged shape)
    leadsTrend: [...dayMap.entries()].map(([date, count]) => ({ date, count })),
    pipeline: pipeline.map((p) => ({ stage: p.pipelineStage, count: p._count })),
    channelMix: channelMix.map((c) => ({ channel: c.channel, count: c._count })),
    agentActivity: agentActivity.map((a) => ({ code: a.code, name: a.name, executions: a.executionCount, successes: a.successCount, failures: a.failureCount })),
    executionsTrend: [...dayMap.keys()].map((date) => ({ date, count: execMap.get(date) ?? 0 })),
    // website traffic (new)
    trafficTrend,
    topPages,
    referrers,
    eventMix,
    trafficKpis,
  })
}
