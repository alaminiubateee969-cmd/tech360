import { NextRequest } from 'next/server'
import { bootstrapCatalog } from '@/lib/factory/control/catalog'
import { guardFailed, noStore, requireActor } from '@/lib/factory/control/http'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const g = await requireActor(req, 'SUPER_ADMIN')
  if (guardFailed(g)) return g
  const result = await bootstrapCatalog(g.actor)
  return noStore({ ok: result.ok, created: result.created, checks: result.checks }, result.ok ? 200 : 500)
}
