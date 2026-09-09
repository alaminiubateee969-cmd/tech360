import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { guard, isResponse } from '@/lib/api-guard'
import { readJson, sanitizeText, audit } from '@/lib/security'
import { sendCommunication, wrapEmailHtml, emailTemplate } from '@/lib/comms'

export const dynamic = 'force-dynamic'

// Manual message send from admin console — uses the real channel adapters
export async function POST(req: NextRequest) {
  const g = await guard(req)
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

  const { communicationId, result } = await sendCommunication({
    clientId: client?.id, channel, to: recipient, subject: subject || (channel === 'EMAIL' ? 'Message from Tech360' : undefined),
    body, agentCode: 'MANUAL',
  })
  await audit({ actor: g.user.email, action: 'MANUAL_MESSAGE_SENT', userId: g.user.id, clientId: client?.clientId, details: { channel, recipient, status: result.status } })

  const statusText = result.status === 'SENT' ? 'sent successfully' : result.status === 'NOT_CONFIGURED' ? 'not sent — channel not configured' : `failed: ${result.error}`
  return Response.json({
    ok: result.status === 'SENT',
    status: result.status,
    error: result.error ?? null,
    message: `Message ${statusText}. Recorded in CRM.`,
    communicationId,
  })
}
