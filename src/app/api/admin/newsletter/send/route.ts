import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { guard, isResponse } from '@/lib/api-guard'
import { readJson, sanitizeText, audit } from '@/lib/security'
import { channelConfigured, sendCommunication } from '@/lib/comms'

export const dynamic = 'force-dynamic'

// ------------------------------------------------------------
// POST /api/admin/newsletter/send {id}
// HONEST SEND: when the EMAIL channel is NOT_CONFIGURED the request is
// refused (409) and the campaign stays a draft — nothing is ever marked
// SENT without a real dispatch. When SMTP is configured, every ACTIVE
// subscriber gets one Communication row (channel EMAIL, direction OUT)
// through the existing comms engine (sendCommunication), the campaign is
// marked SENT with the real recipient count + sentBy + sentAt.
// ------------------------------------------------------------

function campaignFooter(origin: string, email: string): string {
  return `\n\n—\nUnsubscribe: ${origin}/api/newsletter/unsubscribe?email=${encodeURIComponent(email)}`
}

export async function POST(req: NextRequest) {
  const g = await guard(req, { minRole: 'MANAGER' })
  if (isResponse(g)) return g
  const raw = await readJson(req)
  const id = sanitizeText(raw.id, 64)
  if (!id) return Response.json({ error: 'Campaign id required' }, { status: 400 })

  const campaign = await db.emailCampaign.findUnique({ where: { id } })
  if (!campaign) return Response.json({ error: 'Campaign not found' }, { status: 404 })
  if (campaign.status === 'SENT') {
    return Response.json({ error: 'This campaign was already sent — sending again would duplicate emails. Duplicate it as a new draft instead.' }, { status: 409 })
  }

  // Honest channel check — reuses the platform's single source of truth.
  if (!channelConfigured('EMAIL')) {
    return Response.json(
      { error: 'SMTP not configured — the EMAIL channel is not live. Campaign remains a draft.', channel: 'EMAIL', status: 'NOT_CONFIGURED' },
      { status: 409 },
    )
  }

  const subscribers = await db.newsletterSubscriber.findMany({ where: { status: 'ACTIVE' } })
  if (subscribers.length === 0) {
    return Response.json({ error: 'No ACTIVE subscribers to send to — the campaign stays a draft.' }, { status: 409 })
  }

  const origin = new URL(req.url).origin
  await db.emailCampaign.update({ where: { id }, data: { status: 'QUEUED' } })

  let sent = 0
  let failed = 0
  const failures: string[] = []
  for (const sub of subscribers) {
    const { result } = await sendCommunication({
      channel: 'EMAIL',
      to: sub.email,
      subject: campaign.subject,
      body: campaign.body + campaignFooter(origin, sub.email),
      workflowId: `CAMPAIGN:${campaign.id}`,
      messageType: 'TEXT',
    })
    if (result.status === 'SENT') sent += 1
    else {
      failed += 1
      if (failures.length < 5) failures.push(`${sub.email}: ${result.error ?? result.status}`)
    }
  }

  if (sent === 0) {
    // Nothing actually delivered — roll back to DRAFT, never fake a SENT.
    await db.emailCampaign.update({ where: { id }, data: { status: 'DRAFT', recipientCount: 0 } })
    await audit({
      actor: g.user.email, action: 'NEWSLETTER_CAMPAIGN_SEND_FAILED', userId: g.user.id,
      entityId: campaign.id, details: { subject: campaign.subject.slice(0, 120), failed, failures },
    })
    return Response.json({ error: `All ${failed} sends failed — campaign rolled back to DRAFT. First failures: ${failures.join(' | ')}` }, { status: 502 })
  }

  await db.emailCampaign.update({
    where: { id },
    data: { status: 'SENT', recipientCount: sent, sentAt: new Date() },
  })
  await audit({
    actor: g.user.email, action: 'NEWSLETTER_CAMPAIGN_SENT', userId: g.user.id,
    entityId: campaign.id,
    details: { subject: campaign.subject.slice(0, 120), sent, failed, failures: failures.slice(0, 5) },
  })

  return Response.json({
    ok: true,
    message: failed > 0
      ? `Campaign sent to ${sent} subscriber${sent === 1 ? '' : 's'} (${failed} failed — see Communications for details).`
      : `Campaign sent to ${sent} subscriber${sent === 1 ? '' : 's'}.`,
    sent,
    failed,
  })
}
