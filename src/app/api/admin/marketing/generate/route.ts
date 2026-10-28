// Idea -> campaign + per-platform draft posts (Marketing Dashboard).
// Drafts are generated locally and labelled; the content agent may
// enhance copy when a model is configured. NOTHING publishes here —
// posts are created as DRAFT and require explicit approval.
import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { guard, isResponse } from '@/lib/api-guard'
import { readJson, sanitizeText, audit } from '@/lib/security'
import { buildMarketingPlan } from '@/lib/social/plan'
import { PLATFORM_DEFS, type SocialPlatform } from '@/lib/social/platforms'
import { runAgent } from '@/lib/agents/engine'

export const dynamic = 'force-dynamic'
const VALID = new Set(PLATFORM_DEFS.map((d) => d.platform))

export async function POST(req: NextRequest) {
  const g = await guard(req, { minRole: 'ADMIN' })
  if (isResponse(g)) return g
  const raw = await readJson(req)
  const idea = sanitizeText(raw.idea, 500)
  if (idea.length < 3) return Response.json({ error: 'idea required' }, { status: 400 })
  const language = (['EN', 'BN', 'BOTH'].includes(String(raw.language)) ? String(raw.language) : 'EN') as 'EN' | 'BN' | 'BOTH'
  const requested = Array.isArray(raw.platforms) ? raw.platforms.map((p) => String(p).toUpperCase()).filter((p): p is SocialPlatform => VALID.has(p as SocialPlatform)) : undefined
  const plan = buildMarketingPlan({
    idea,
    language,
    platforms: requested,
    offer: sanitizeText(raw.offer, 200) || undefined,
    audience: sanitizeText(raw.audience, 200) || undefined,
  })

  // Optional agent enhancement of the Facebook/LinkedIn copy when a
  // model is configured. Failure is recorded, never hidden: the
  // local draft is used and the response says so.
  let enhanced = false
  try {
    const run = await runAgent('CST-020', {
      input: `Improve this social campaign draft. Keep every claim honest, no invented results. Return STRICT JSON {headline, facebookText, linkedinText}.\n\n${JSON.stringify({ idea: plan.idea, headline: plan.headline, facebook: plan.drafts.find((d) => d.platform === 'FACEBOOK')?.text, linkedin: plan.drafts.find((d) => d.platform === 'LINKEDIN')?.text })}`,
      expectJson: true,
      workflow: 'MARKETING_DASHBOARD',
    })
    if (run.ok && run.json) {
      const j = run.json as { headline?: string; facebookText?: string; linkedinText?: string }
      if (j.headline) plan.headline = j.headline
      for (const d of plan.drafts) {
        if (d.platform === 'FACEBOOK' && j.facebookText) d.text = j.facebookText
        if (d.platform === 'LINKEDIN' && j.linkedinText) d.text = j.linkedinText
      }
      enhanced = true
    }
  } catch { /* local draft stands; enhanced=false is reported */ }

  const campaign = await db.campaign.create({
    data: {
      name: plan.headline.slice(0, 200),
      goal: idea,
      channel: plan.drafts.map((d) => d.platform).join(','),
      audience: sanitizeText(raw.audience, 500) || null,
      status: 'SCRIPTING',
      hooks: JSON.stringify([plan.videoPlan.hook]),
      metrics: '{}',
      lessons: '[]',
    },
  })
  const kit = await db.contentAsset.create({
    data: {
      campaignId: campaign.id,
      type: 'MARKETING_KIT',
      language,
      title: plan.headline.slice(0, 200),
      content: JSON.stringify({ ...plan, enhanced }),
      status: 'DRAFT',
      safeContent: true,
      metrics: '{}',
    },
  })
  await db.contentAsset.create({
    data: { campaignId: campaign.id, type: 'IMAGE_PROMPT', language, title: `${plan.headline} — image`.slice(0, 200), content: JSON.stringify({ prompt: plan.imagePrompt }), status: 'DRAFT', safeContent: true, metrics: '{}' },
  })
  await db.contentAsset.create({
    data: { campaignId: campaign.id, type: 'VIDEO_PLAN', language, aspect: plan.videoPlan.aspect, durationSec: plan.videoPlan.durationSec, title: `${plan.headline} — video`.slice(0, 200), content: JSON.stringify(plan.videoPlan), status: 'DRAFT', safeContent: true, metrics: '{}' },
  })
  const posts: Array<{ id: string; platform: SocialPlatform; text: string; status: string }> = []
  for (const draft of plan.drafts) {
    posts.push(await db.socialPost.create({
      data: {
        campaignId: campaign.id,
        assetId: kit.id,
        platform: draft.platform,
        text: draft.hashtags.length ? `${draft.text}\n\n${draft.hashtags.join(' ')}` : draft.text,
        hashtags: JSON.stringify(draft.hashtags),
        mediaPrompt: draft.mediaPrompt,
        cta: draft.cta,
        status: 'DRAFT',
        createdBy: g.user.email,
      },
    }))
  }
  await audit({ actor: g.user.email, action: 'MARKETING_CAMPAIGN_GENERATED', userId: g.user.id, entityId: campaign.id, details: { idea: idea.slice(0, 100), platforms: plan.drafts.map((d) => d.platform), enhanced } })
  return Response.json({ ok: true, campaign, plan, posts, enhanced })
}
