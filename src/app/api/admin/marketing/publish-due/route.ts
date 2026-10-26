// Publish every APPROVED social post whose scheduled time has
// arrived. Idempotent: publishing moves a post out of APPROVED,
// so re-running this endpoint never double-posts. Safe to call
// from an admin button or a scheduled host cron with an admin
// session; there is no anonymous trigger.
import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { guard, isResponse } from '@/lib/api-guard'
import { audit } from '@/lib/security'
import { publishPost } from '@/lib/social/publish'
import type { SocialPlatform } from '@/lib/social/platforms'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const g = await guard(req, { minRole: 'ADMIN' })
  if (isResponse(g)) return g

  const due = await db.socialPost.findMany({
    where: { status: 'APPROVED', scheduledAt: { lte: new Date() } },
    orderBy: { scheduledAt: 'asc' },
    take: 20,
  })
  const results = []
  for (const post of due) {
    const result = await publishPost({
      platform: post.platform as SocialPlatform,
      text: post.text,
      mediaUrl: post.mediaUrl ?? undefined,
    })
    await db.socialPost.update({
      where: { id: post.id },
      data: {
        status: result.status,
        externalId: result.externalId ?? null,
        externalUrl: result.externalUrl ?? null,
        error: result.error ?? null,
        publishedAt: result.status === 'PUBLISHED' ? new Date() : null,
      },
    })
    await audit({
      actor: g.user.email,
      action: result.status === 'PUBLISHED' ? 'SOCIAL_POST_PUBLISHED' : 'SOCIAL_POST_PUBLISH_FAILED',
      userId: g.user.id,
      entityId: post.id,
      details: { platform: post.platform, status: result.status, scheduled: true },
    })
    results.push({ id: post.id, platform: post.platform, status: result.status, externalUrl: result.externalUrl ?? null, error: result.error ?? null })
  }
  return Response.json({ ok: true, processed: results.length, results })
}
