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
  const status = sanitizeText(url.searchParams.get('status') ?? '', 20).toUpperCase()
  const workflow = sanitizeText(url.searchParams.get('workflow') ?? '', 60)
  const logs = await db.automationLog.findMany({
    where: {
      ...(status ? { status } : {}),
      ...(workflow ? { workflow: { contains: workflow.toUpperCase() } } : {}),
    },
    orderBy: { startedAt: 'desc' }, take: 200,
  })
  return Response.json({ logs })
}
