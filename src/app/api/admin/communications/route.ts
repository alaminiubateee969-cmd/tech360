import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { guard, isResponse } from '@/lib/api-guard'
import { sanitizeText } from '@/lib/security'
import { channelStatuses } from '@/lib/comms'
import { COMM_CHANNELS } from '@/lib/constants'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const g = await guard(req)
  if (isResponse(g)) return g
  const url = new URL(req.url)
  const channel = sanitizeText(url.searchParams.get('channel') ?? '', 20).toUpperCase()
  const status = sanitizeText(url.searchParams.get('status') ?? '', 20).toUpperCase()
  const clientId = sanitizeText(url.searchParams.get('clientId') ?? '', 40)
  const direction = sanitizeText(url.searchParams.get('direction') ?? '', 5).toUpperCase()
  const page = Math.max(1, Number(url.searchParams.get('page') ?? 1) || 1)
  const perPage = 30

  const where = {
    ...(channel && COMM_CHANNELS.includes(channel as (typeof COMM_CHANNELS)[number]) ? { channel } : {}),
    ...(status ? { status } : {}),
    ...(direction ? { direction } : {}),
    ...(clientId ? { client: { OR: [{ id: clientId }, { clientId }] } } : {}),
  }
  const [comms, total] = await Promise.all([
    db.communication.findMany({
      where, orderBy: { createdAt: 'desc' }, skip: (page - 1) * perPage, take: perPage,
      include: { client: { select: { clientId: true, name: true } } },
    }),
    db.communication.count({ where }),
  ])
  return Response.json({ comms, total, page, perPage, channelsStatus: channelStatuses() })
}
