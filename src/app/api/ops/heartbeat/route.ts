import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { rateLimit, clientIp } from '@/lib/security'

export const dynamic = 'force-dynamic'

function authorized(req: NextRequest): boolean {
  const secret = process.env.OPS_SECRET
  return Boolean(secret) && req.headers.get('x-ops-secret') === secret
}

export async function POST(req: NextRequest) {
  if (!authorized(req)) return Response.json({ error: 'Unauthorized' }, { status: 401 })
  const rl = rateLimit(`ops-hb:${clientIp(req)}`, 120, 60_000)
  if (!rl.ok) return Response.json({ ok: true })

  const existing = await db.setting.findUnique({ where: { key: 'ops.heartbeat' } })
  let cycles = 1
  if (existing) {
    try {
      const parsed = JSON.parse(existing.value) as { cycles?: number }
      cycles = (parsed.cycles ?? 0) + 1
    } catch {
      cycles = 1
    }
  }
  const value = JSON.stringify({ at: new Date().toISOString(), cycles, service: 'tech360-ai-ops' })
  if (existing) {
    await db.setting.update({ where: { key: 'ops.heartbeat' }, data: { value } })
  } else {
    await db.setting.create({ data: { key: 'ops.heartbeat', value } })
  }
  return Response.json({ ok: true, ts: new Date().toISOString(), cycles })
}
