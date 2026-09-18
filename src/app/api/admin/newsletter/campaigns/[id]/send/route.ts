import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { guard, isResponse } from '@/lib/api-guard'
import { audit } from '@/lib/security'
import { channelConfigured, sendCommunication } from '@/lib/comms'
import { sanitizeCampaignHtml, signUnsubToken } from '@/lib/newsletter'

export const dynamic = 'force-dynamic'

const MAX_RECIPIENTS_PER_SEND = 1000

// ------------------------------------------------------------
// POST /api/admin/newsletter/campaigns/[id]/send
// Honest send gate: when SMTP is not configured the campaign stays
// a DRAFT and the request fails 409 with the honest reason. When
// credentials land, this same path performs the real dispatch:
// QUEUED → one sendCommunication per ACTIVE subscriber (with a
// signed per-subscriber unsubscribe footer) → SENT + sentAt +
// recipientCount. Nothing is ever faked.
// ------------------------------------------------------------
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const g = await guard(req, { minRole: 'MANAGER' })
  if (isResponse(g)) return g

  const { id } = await params
  const campaign = await db.emailCampaign.findUnique({ where: { id } })
  if (!campaign) return Response.json({ error: 'Campaign not found.' }, { status: 404 })
  if (campaign.status === 'SENT') {
    return Response.json({ error: `This campaign was already sent on ${campaign.sentAt?.toISOString().slice(0, 16).replace('T', ' ')} UTC to ${campaign.recipientCount ?? 0} recipients.` }, { status: 409 })
  }
  if (campaign.status === 'QUEUED') {
    return Response.json({ error: 'This campaign is already queued for dispatch.' }, { status: 409 })
  }

  // ---- the honest gate: EMAIL channel must be live ----
  if (!channelConfigured('EMAIL')) {
    return Response.json(
      { error: 'SMTP not configured — the EMAIL channel is not live. Campaign remains a draft.' },
      { status: 409 },
    )
  }

  // ---- real dispatch path (executes the day credentials land) ----
  await db.emailCampaign.update({ where: { id: campaign.id }, data: { status: 'QUEUED' } })

  const subscribers = await db.newsletterSubscriber.findMany({
    where: { status: 'ACTIVE' },
    orderBy: { createdAt: 'asc' },
    take: MAX_RECIPIENTS_PER_SEND,
  })

  const baseUrl = (process.env.APP_PUBLIC_URL ?? 'https://bdtech360.com').replace(/\/+$/, '')
  let sent = 0
  let failed = 0
  const failures: Array<{ email: string; error: string }> = []
  for (const sub of subscribers) {
    const unsubUrl = `${baseUrl}/api/newsletter/unsubscribe?token=${encodeURIComponent(signUnsubToken(sub.email))}`
    const html =
      sanitizeCampaignHtml(campaign.body) +
      `\n<p style="font-size:12px;color:#94a3b8;margin-top:24px;">You receive this because you subscribed to TECH360 insights. ` +
      `<a href="${unsubUrl}" style="color:#009FE3;">Unsubscribe</a> — one click, instant.</p>`
    const res = await sendCommunication({
      channel: 'EMAIL',
      to: sub.email,
      subject: campaign.subject,
      body: html,
      messageType: 'CAMPAIGN',
      templateName: 'NEWSLETTER_CAMPAIGN',
      workflowId: campaign.id,
    })
    if (res.result.status === 'SENT') sent++
    else {
      failed++
      if (failures.length < 25) failures.push({ email: sub.email, error: res.result.error ?? res.result.status })
    }
  }

  await db.emailCampaign.update({
    where: { id: campaign.id },
    data: { status: 'SENT', sentAt: new Date(), recipientCount: sent },
  })

  await audit({
    actor: g.user.email,
    action: 'NEWSLETTER_SENT',
    userId: g.user.id,
    entityType: 'EMAIL_CAMPAIGN',
    entityId: campaign.id,
    details: { subject: campaign.subject, recipients: subscribers.length, sent, failed, capped: subscribers.length === MAX_RECIPIENTS_PER_SEND },
  })

  return Response.json({
    ok: true,
    status: 'SENT',
    recipientCount: sent,
    attempted: subscribers.length,
    failed,
    failures,
    capped: subscribers.length === MAX_RECIPIENTS_PER_SEND,
  })
}
