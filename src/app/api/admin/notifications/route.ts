import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { guard, isResponse } from '@/lib/api-guard'
import { sanitizeText } from '@/lib/security'

export const dynamic = 'force-dynamic'

// Real notification feed: every notification row is created by the platform
// itself (journey events, AI operations loop, error triage, approvals).
// GET  /api/admin/notifications?unread=1&take=30
export async function GET(req: NextRequest) {
  const g = await guard(req, { minRole: 'STAFF' })
  if (isResponse(g)) return g
  const url = new URL(req.url)
  const unreadOnly = url.searchParams.get('unread') === '1'
  const take = Math.min(100, Math.max(1, Number(url.searchParams.get('take') ?? 30) || 30))

  const [notifications, unread, severityCounts] = await Promise.all([
    db.notification.findMany({
      where: unreadOnly ? { read: false } : {},
      orderBy: { createdAt: 'desc' },
      take,
    }),
    db.notification.count({ where: { read: false } }),
    db.notification.groupBy({ by: ['severity'], where: { read: false }, _count: true }),
  ])

  return Response.json({
    notifications,
    unread,
    severityCounts: Object.fromEntries(severityCounts.map((s) => [s.severity, s._count])),
  })
}
