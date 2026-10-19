import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { guard, isResponse } from '@/lib/api-guard'
import { readJson, sanitizeText, audit } from '@/lib/security'
import { sendCommunication, wrapEmailHtml, emailTemplate } from '@/lib/comms'
import { classifyContentCategory, containsAmount } from '@/lib/pipeline/rules'

export const dynamic = 'force-dynamic'

// Manual message send from admin console — uses the real channel adapters
export async function POST(req: NextRequest) {
  const g = await guard(req, { minRole: 'MANAGER' })
  if (isResponse(g)) return g
  const raw = await readJson(req)
  const clientRef = sanitizeText(raw.clientId, 40)
  const channel = sanitizeText(raw.channel, 20).toUpperCase()
  const body = sanitizeText(raw.body, 8000)
  const subject = sanitizeText(raw.subject, 300)
  const to = sanitizeText(raw.to, 200)

  if (!['WHATSAPP', 'EMAIL', 'SMS'].includes(channel)) {
    return Response.json({ error: 'channel must be WHATSAPP, EMAIL or SMS' }, { status: 400 })
  }
  if (body.length < 1) return Response.json({ error: 'Message body required' }, { status: 400 })

  const client = clientRef ? await db.client.findFirst({ where: { OR: [{ id: clientRef }, { clientId: clientRef }] } }) : null
  if (!client && !to) return Response.json({ error: 'Client or direct recipient required' }, { status: 400 })

  const recipient = to || (channel === 'EMAIL' ? client?.email : client?.whatsapp) || ''
  if (!recipient) return Response.json({ error: `No ${channel === 'EMAIL' ? 'email' : 'phone'} on record for this client` }, { status: 400 })

  // The communication policy gates seven categories even when a human
  // composes the message: a payment instruction with an amount, an
  // invoice, a legal or refund response, a source-code handover, the
  // delivery file links and a dispute response. A MANAGER may not send
  // those; a SUPER_ADMIN send IS the approval the policy requires.
  const gatedCategories = classifyContentCategory(body)
  const carriesAmount = containsAmount(body)
  if ((gatedCategories.length > 0 || carriesAmount) && g.user.role !== 'SUPER_ADMIN') {
    await audit({
      actor: g.user.email,
      action: 'MANUAL_MESSAGE_GATED',
      userId: g.user.id,
      clientId: client?.clientId,
      details: { channel, categories: gatedCategories, carriesAmount },
    })
    return Response.json({
      ok: false,
      status: 'ADMIN_APPROVAL_REQUIRED',
      error: 'This message falls under a category that requires Super Admin approval before it is sent.',
      categories: gatedCategories,
      carriesAmount,
      message: `Refused: ${gatedCategories.length > 0 ? gatedCategories.join(', ') : 'the message carries a monetary amount'} requires Super Admin approval. Nothing was sent and nothing was saved as sent.`,
    }, { status: 403 })
  }

  const { communicationId, result } = await sendCommunication({
    clientId: client?.id, channel, to: recipient, subject: subject || (channel === 'EMAIL' ? 'Message from Tech360' : undefined),
    body, agentCode: 'MANUAL',
  })
  await audit({ actor: g.user.email, action: 'MANUAL_MESSAGE_SENT', userId: g.user.id, clientId: client?.clientId, details: { channel, recipient, status: result.status, gatedCategories } })

  const statusText = result.status === 'SENT' ? 'sent successfully' : result.status === 'NOT_CONFIGURED' ? 'not sent — channel not configured' : `failed: ${result.error}`
  return Response.json({
    ok: result.status === 'SENT',
    status: result.status,
    error: result.error ?? null,
    message: `Message ${statusText}. Recorded in CRM.`,
    communicationId,
  })
}
