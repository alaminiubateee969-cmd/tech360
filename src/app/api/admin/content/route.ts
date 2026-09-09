import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { guard, isResponse } from '@/lib/api-guard'
import { sanitizeText } from '@/lib/security'

export const dynamic = 'force-dynamic'
export async function GET(req: NextRequest) {
  const g = await guard(req)
  if (isResponse(g)) return g
  const [assets, campaigns] = await Promise.all([
    db.contentAsset.findMany({ orderBy: { createdAt: 'desc' }, take: 200 }),
    db.campaign.findMany({ orderBy: { createdAt: 'desc' }, take: 50 }),
  ])
  return Response.json({ assets, campaigns })
}
