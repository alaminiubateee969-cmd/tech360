import { NextRequest } from 'next/server'
import { companyReport } from '@/lib/factory/control/data'
import { guardFailed, noStore, requireActor, text } from '@/lib/factory/control/http'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const g = await requireActor(req, 'STAFF')
  if (guardFailed(g)) return g
  const url = new URL(req.url)
  const companyId = text(url.searchParams.get('companyId'), 60)
  if (!companyId) return noStore({ ok: false, reason: 'companyId is required' }, 400)
  const result = await companyReport(g.actor, companyId, text(url.searchParams.get('applicationId'), 60) || undefined)
  return noStore(result as unknown as Record<string, unknown>, result.ok ? 200 : 403)
}
