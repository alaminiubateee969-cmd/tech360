// Marketing Dashboard overview (Super Admin/Admin only):
// platform connection states, recent campaigns and the social
// post queue. Secret VALUES are never returned — presence only.
import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { guard, isResponse } from '@/lib/api-guard'
import { allPlatformStatuses, OAUTH_CONTINUITY_NOTE } from '@/lib/social/platforms'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const g = await guard(req, { minRole: 'ADMIN' })
  if (isResponse(g)) return g

  const [posts, campaigns, accounts] = await Promise.all([
    db.socialPost.findMany({ orderBy: { createdAt: 'desc' }, take: 100 }),
    db.campaign.findMany({ orderBy: { createdAt: 'desc' }, take: 20, include: { _count: { select: { assets: true } } } }),
    db.socialAccount.findMany(),
  ])
  const verified = new Map(accounts.map((a) => [a.platform, a]))
  const platforms = allPlatformStatuses().map((p) => ({
    ...p,
    verifiedState: verified.get(p.platform)?.state ?? null,
    lastVerifiedAt: verified.get(p.platform)?.lastVerifiedAt ?? null,
    lastError: verified.get(p.platform)?.lastError ?? null,
    externalId: verified.get(p.platform)?.externalId ?? null,
  }))
  return Response.json({ platforms, posts, campaigns, oauthNote: OAUTH_CONTINUITY_NOTE })
}
