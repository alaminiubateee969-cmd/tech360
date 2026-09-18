import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { guard, isResponse } from '@/lib/api-guard'
import { readJson, sanitizeText, audit } from '@/lib/security'
import { sanitizeCampaignHtml } from '@/lib/newsletter'

export const dynamic = 'force-dynamic'

// ------------------------------------------------------------
// PUT /api/admin/newsletter/campaigns/[id]
// Edit a DRAFT campaign (name / subject / body). Sent or queued
// campaigns are immutable — the record is the proof of what went
// out, so editing is refused with 409 instead of rewriting history.
// ------------------------------------------------------------
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const g = await guard(req, { minRole: 'MANAGER' })
  if (isResponse(g)) return g

  const { id } = await params
  const campaign = await db.emailCampaign.findUnique({ where: { id } })
  if (!campaign) return Response.json({ error: 'Campaign not found.' }, { status: 404 })
  if (campaign.status !== 'DRAFT') {
    return Response.json({ error: `Only DRAFT campaigns can be edited — this one is ${campaign.status}.` }, { status: 409 })
  }

  const raw = await readJson(req)
  const name = sanitizeText(raw.name, 120).trim()
  const subject = sanitizeText(raw.subject, 200).trim()
  const body = sanitizeCampaignHtml(raw.body)

  if (!name) return Response.json({ error: 'Campaign name is required.' }, { status: 400 })
  if (!subject) return Response.json({ error: 'Email subject is required.' }, { status: 400 })
  if (!body) return Response.json({ error: 'Campaign body is required.' }, { status: 400 })

  const updated = await db.emailCampaign.update({
    where: { id: campaign.id },
    data: { name, subject, body },
  })

  await audit({
    actor: g.user.email,
    action: 'NEWSLETTER_CAMPAIGN_UPDATED',
    userId: g.user.id,
    entityType: 'EMAIL_CAMPAIGN',
    entityId: campaign.id,
    details: { name, subject, bodyLength: body.length },
  })

  return Response.json({ ok: true, campaign: updated })
}
