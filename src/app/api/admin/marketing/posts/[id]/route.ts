// Social post lifecycle: approve / reject / publish / set media.
// Publishing requires APPROVED status and goes through the
// official platform adapters; the result recorded here is exactly
// what the platform returned (PUBLISHED only with a post id).
import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { guard, isResponse } from '@/lib/api-guard'
import { readJson, sanitizeText, audit } from '@/lib/security'
import { publishPost } from '@/lib/social/publish'
import type { SocialPlatform } from '@/lib/social/platforms'
import { buildImagePrompt, headlineOf } from '@/lib/social/post-grid'

export const dynamic = 'force-dynamic'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const g = await guard(req, { minRole: 'ADMIN' })
  if (isResponse(g)) return g
  const { id } = await params
  const raw = await readJson(req)
  const action = sanitizeText(raw.action, 20).toLowerCase()
  const post = await db.socialPost.findUnique({ where: { id } })
  if (!post) return Response.json({ error: 'Post not found' }, { status: 404 })

  if (action === 'approve') {
    if (post.status !== 'DRAFT') return Response.json({ error: `Only DRAFT posts can be approved (current: ${post.status})` }, { status: 400 })
    const updated = await db.socialPost.update({ where: { id }, data: { status: 'APPROVED', error: null } })
    await audit({ actor: g.user.email, action: 'SOCIAL_POST_APPROVED', userId: g.user.id, entityId: id, details: { platform: post.platform } })
    return Response.json({ ok: true, post: updated })
  }
  if (action === 'reject') {
    const updated = await db.socialPost.update({ where: { id }, data: { status: 'DRAFT', error: 'Rejected in review — edit and re-approve' } })
    return Response.json({ ok: true, post: updated })
  }
  if (action === 'media') {
    const mediaUrl = sanitizeText(raw.mediaUrl, 2000)
    if (mediaUrl && !/^https:\/\//i.test(mediaUrl)) return Response.json({ error: 'mediaUrl must be a public https URL' }, { status: 400 })
    const updated = await db.socialPost.update({ where: { id }, data: { mediaUrl: mediaUrl || null } })
    return Response.json({ ok: true, post: updated })
  }
  if (action === 'prompt') {
    // Compose (or store) the image brief for this post. A prompt supplied by
    // the operator is kept verbatim; otherwise it is built locally from the
    // post's own headline. Nothing is generated or sent anywhere here.
    const supplied = sanitizeText(raw.prompt, 1500)
    const prompt = supplied || buildImagePrompt({
      topic: headlineOf(post, 140),
      platform: post.platform,
    })
    const updated = await db.socialPost.update({ where: { id }, data: { mediaPrompt: prompt } })
    await audit({ actor: g.user.email, action: 'SOCIAL_POST_PROMPT_SET', userId: g.user.id, entityId: id, details: { platform: post.platform, composed: !supplied } })
    return Response.json({ ok: true, post: updated, prompt })
  }
  if (action === 'schedule') {
    if (post.status !== 'APPROVED') return Response.json({ error: 'Post must be APPROVED before scheduling' }, { status: 400 })
    const when = new Date(sanitizeText(raw.scheduledAt, 40))
    if (Number.isNaN(when.getTime()) || when.getTime() < Date.now() - 60_000) {
      return Response.json({ error: 'scheduledAt must be a valid future time' }, { status: 400 })
    }
    const updated = await db.socialPost.update({ where: { id }, data: { scheduledAt: when } })
    await audit({ actor: g.user.email, action: 'SOCIAL_POST_SCHEDULED', userId: g.user.id, entityId: id, details: { platform: post.platform, scheduledAt: when.toISOString() } })
    return Response.json({ ok: true, post: updated })
  }
  if (action === 'publish') {
    if (post.status !== 'APPROVED') return Response.json({ error: 'Post must be APPROVED before publishing' }, { status: 400 })
    const result = await publishPost({
      platform: post.platform as SocialPlatform,
      text: post.text,
      mediaUrl: post.mediaUrl ?? undefined,
    })
    const updated = await db.socialPost.update({
      where: { id },
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
      entityId: id,
      details: { platform: post.platform, status: result.status, externalId: result.externalId },
    })
    return Response.json({ ok: result.status === 'PUBLISHED', result, post: updated })
  }
  return Response.json({ error: 'action must be approve | reject | media | prompt | schedule | publish' }, { status: 400 })
}
