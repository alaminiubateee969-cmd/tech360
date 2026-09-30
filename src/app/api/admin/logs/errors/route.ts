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
  const resolved = url.searchParams.get('resolved')
  const source = sanitizeText(url.searchParams.get('source') ?? '', 20).toUpperCase()
  const logs = await db.errorLog.findMany({
    where: {
      ...(resolved === 'true' ? { resolved: true } : resolved === 'false' ? { resolved: false } : {}),
      ...(source ? { source } : {}),
    },
    orderBy: { createdAt: 'desc' }, take: 200,
  })
  return Response.json({ logs })
}
