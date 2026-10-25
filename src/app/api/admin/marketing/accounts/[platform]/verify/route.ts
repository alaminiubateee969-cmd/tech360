// Verify a social connection against the real platform API and
// record the outcome (never any secret) on SocialAccount.
import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { guard, isResponse } from '@/lib/api-guard'
import { audit } from '@/lib/security'
import { PLATFORM_DEFS, platformStatus, type SocialPlatform } from '@/lib/social/platforms'
import { verifyPlatform } from '@/lib/social/publish'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest, { params }: { params: Promise<{ platform: string }> }) {
  const g = await guard(req, { minRole: 'ADMIN' })
  if (isResponse(g)) return g
  const { platform: rawPlatform } = await params
  const platform = rawPlatform.toUpperCase() as SocialPlatform
  const def = PLATFORM_DEFS.find((d) => d.platform === platform)
  if (!def) return Response.json({ error: 'Unknown platform' }, { status: 400 })

  const status = platformStatus(platform)
  const result = await verifyPlatform(platform)
  const state = result.ok ? 'CONNECTED' : status.state === 'CONNECTED' ? 'ERROR' : status.state
  const account = await db.socialAccount.upsert({
    where: { platform },
    create: {
      platform,
      label: def.label,
      externalId: platform === 'FACEBOOK' || platform === 'INSTAGRAM' ? (process.env.META_PAGE_ID ?? null) : platform === 'LINKEDIN' ? (process.env.LINKEDIN_ORGANIZATION_ID ?? null) : null,
      state,
      envKeys: JSON.stringify(def.requiredEnv),
      lastVerifiedAt: new Date(),
      lastError: result.ok ? null : result.detail,
    },
    update: {
      state,
      envKeys: JSON.stringify(def.requiredEnv),
      lastVerifiedAt: new Date(),
      lastError: result.ok ? null : result.detail,
    },
  })
  await audit({ actor: g.user.email, action: 'SOCIAL_ACCOUNT_VERIFIED', userId: g.user.id, entityId: account.id, details: { platform, ok: result.ok } })
  return Response.json({ ok: result.ok, detail: result.detail, account })
}
