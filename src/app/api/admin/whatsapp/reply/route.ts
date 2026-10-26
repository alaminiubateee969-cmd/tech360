import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { guard, isResponse } from '@/lib/api-guard'
import { audit, readJson, sanitizeText } from '@/lib/security'
import { sendCommunication } from '@/lib/comms'

export const dynamic = 'force-dynamic'

const SERVICE_WINDOW_MS = 24 * 60 * 60 * 1000

/**
 * Sends a free-form inbox reply only while the latest inbound WhatsApp message
 * is inside Meta's 24-hour customer-service window. Outside that window the
 * API fails closed; approved-template dispatch needs a separate consent-aware flow.
 */
export async function POST(req: NextRequest) {
  const g = await guard(req, { minRole: 'MANAGER', limit: { max: 30, windowMs: 60_000 } })
  if (isResponse(g)) return g

  const raw = await readJson(req)
  const clientRef = sanitizeText(raw.clientId, 80)
  const body = sanitizeText(raw.body, 4000)
  if (!clientRef || !body) {
    return Response.json({ error: 'clientId and message body are required' }, { status: 400 })
  }

  const client = await db.client.findFirst({
    where: { OR: [{ id: clientRef }, { clientId: clientRef }], deletedAt: null },
    select: { id: true, clientId: true, name: true, whatsapp: true, phone: true },
  })
  if (!client) return Response.json({ error: 'CRM contact not found' }, { status: 404 })
  const recipient = (client.whatsapp || client.phone || '').replace(/[^\d]/g, '')
  if (!recipient) return Response.json({ error: 'This contact has no WhatsApp phone number' }, { status: 400 })

  const lastInbound = await db.communication.findFirst({
    where: { clientId: client.id, channel: 'WHATSAPP', direction: 'IN', status: { not: 'FAILED' } },
    orderBy: { createdAt: 'desc' },
    select: { id: true, createdAt: true },
  })
  const expiresAt = lastInbound ? new Date(lastInbound.createdAt.getTime() + SERVICE_WINDOW_MS) : null
  if (!expiresAt || expiresAt.getTime() <= Date.now()) {
    return Response.json({
      error: 'The 24-hour customer-service window is closed. Use an approved WhatsApp template through a consent-aware template workflow.',
      code: 'WHATSAPP_SERVICE_WINDOW_CLOSED',
      serviceWindowExpiresAt: expiresAt?.toISOString() ?? null,
    }, { status: 409 })
  }

  const { communicationId, result } = await sendCommunication({
    clientId: client.id,
    channel: 'WHATSAPP',
    to: recipient,
    body,
    agentCode: g.user.email,
    messageType: 'TEXT',
  })

  await audit({
    actor: g.user.email,
    action: 'WHATSAPP_INBOX_REPLY',
    userId: g.user.id,
    clientId: client.clientId,
    details: { communicationId, status: result.status, serviceWindowExpiresAt: expiresAt.toISOString() },
    ip: g.ip,
  })

  return Response.json({
    ok: result.status === 'SENT',
    status: result.status,
    communicationId,
    serviceWindowExpiresAt: expiresAt.toISOString(),
    error: result.error ?? null,
  }, { status: result.status === 'SENT' ? 200 : result.status === 'NOT_CONFIGURED' || result.status === 'DISABLED_BY_ADMIN' ? 503 : 502 })
}
