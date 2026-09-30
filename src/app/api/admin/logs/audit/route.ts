import { AI_WORKFORCE_MIN_ROLE } from '@/lib/ai-workforce-policy'
import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { guard, isResponse } from '@/lib/api-guard'
import { sanitizeText } from '@/lib/security'

export const dynamic = 'force-dynamic'
export async function GET(req: NextRequest) {
  const g = await guard(req, { minRole: AI_WORKFORCE_MIN_ROLE })
  if (isResponse(g)) return g
  const url = new URL(req.url)
  const page = Math.max(1, Number(url.searchParams.get('page') ?? 1) || 1)
  const action = sanitizeText(url.searchParams.get('action') ?? '', 60)
  const perPage = 50
  const [logs, total] = await Promise.all([
    db.auditLog.findMany({ where: action ? { action: { contains: action.toUpperCase() } } : {}, orderBy: { createdAt: 'desc' }, skip: (page - 1) * perPage, take: perPage }),
    db.auditLog.count({ where: action ? { action: { contains: action.toUpperCase() } } : {} }),
  ])
  return Response.json({ logs, total, page, perPage })
}
