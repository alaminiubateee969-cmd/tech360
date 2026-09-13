import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { guard, isResponse } from '@/lib/api-guard'
import { sanitizeText } from '@/lib/security'

export const dynamic = 'force-dynamic'

// GET /api/admin/reports — the CEO report archive (executive trail)
// Every generated report is persisted: manual admin requests AND the
// autonomous 08:00 daily briefing land here. ?take=&skip= for paging.
export async function GET(req: NextRequest) {
  const g = await guard(req, { minRole: 'MANAGER' })
  if (isResponse(g)) return g
  const url = new URL(req.url)
  const take = Math.min(100, Math.max(1, Number(url.searchParams.get('take') ?? 30) || 30))
  const skip = Math.max(0, Number(url.searchParams.get('skip') ?? 0) || 0)

  const [reports, total, scheduledCount, latest] = await Promise.all([
    db.ceoReport.findMany({ orderBy: { createdAt: 'desc' }, take, skip, select: { id: true, title: true, trigger: true, generatedBy: true, agentRuns: true, durationMs: true, createdAt: true } }),
    db.ceoReport.count(),
    db.ceoReport.count({ where: { trigger: 'SCHEDULED' } }),
    db.ceoReport.findFirst({ orderBy: { createdAt: 'desc' }, select: { id: true, title: true, trigger: true, content: true, agentRuns: true, durationMs: true, createdAt: true } }),
  ])

  return Response.json({
    reports,
    total,
    stats: { scheduled: scheduledCount, manual: total - scheduledCount },
    latest: latest ? { ...latest, content: undefined, hasContent: true } : null,
  })
}
