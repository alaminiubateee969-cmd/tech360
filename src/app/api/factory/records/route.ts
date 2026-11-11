import { NextRequest } from 'next/server'
import { createRecord, listRecords } from '@/lib/factory/control/data'
import { guardFailed, noStore, readBody, requireActor, text } from '@/lib/factory/control/http'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const g = await requireActor(req, 'STAFF')
  if (guardFailed(g)) return g
  const url = new URL(req.url)
  const applicationId = text(url.searchParams.get('applicationId'), 60)
  if (!applicationId) return noStore({ ok: false, code: 'APPLICATION_REQUIRED', reason: 'applicationId is required' }, 400)
  const result = await listRecords(g.actor, {
    companyId: text(url.searchParams.get('companyId'), 60) || undefined,
    applicationId,
    moduleKey: text(url.searchParams.get('moduleKey'), 60) || undefined,
    entityType: text(url.searchParams.get('entityType'), 60) || undefined,
  })
  return noStore(result as unknown as Record<string, unknown>, result.ok ? 200 : 403)
}

export async function POST(req: NextRequest) {
  const g = await requireActor(req, 'STAFF')
  if (guardFailed(g)) return g
  const result = await createRecord(g.actor, await readBody(req))
  return noStore(result as unknown as Record<string, unknown>, result.ok ? 201 : 403)
}
