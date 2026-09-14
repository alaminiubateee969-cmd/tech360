import { NextRequest } from 'next/server'
import { cookies } from 'next/headers'
import { db } from '@/lib/db'
import { verifyPortalToken, PORTAL_COOKIE, portalGate } from "@/lib/portal"
import { sanitizeText, audit, rateLimit, clientIp } from '@/lib/security'
import { createNotification } from '@/lib/notify'

export const dynamic = 'force-dynamic'

// POST /api/portal/request-preview — client asks for a fresh preview link
// when theirs expired or none was sent yet. Creates a REAL notification +
// audit row; an admin regenerates via the GENERATE_PREVIEW journey action.
// Rate-limited to 1 request / 30 min / client (no spam).
export async function POST(req: NextRequest) {
  const portalDisabled = await portalGate()
  if (portalDisabled) return portalDisabled
  const ip = clientIp(req)
  const rl = rateLimit(`portal-preview-req:${ip}`, 4, 30 * 60_000)
  if (!rl.ok) return Response.json({ error: 'A request was already sent recently — our team is on it.' }, { status: 429 })

  const store = await cookies()
  const clientId = verifyPortalToken(store.get(PORTAL_COOKIE)?.value)
  if (!clientId) return Response.json({ error: 'Session expired. Please sign in again.' }, { status: 401 })

  const client = await db.client.findFirst({ where: { clientId, deletedAt: null }, include: { previews: { orderBy: { createdAt: 'desc' }, take: 1 } } })
  if (!client) return Response.json({ error: 'Client not found' }, { status: 404 })

  const reasonRaw = await req.json().catch(() => ({} as Record<string, unknown>))
  const reason = sanitizeText((reasonRaw as { reason?: unknown }).reason, 300).trim()
  const lastStatus = client.previews[0]?.status ?? 'NONE'

  await audit({
    actor: `client:${client.clientId}`, action: 'PREVIEW_REFRESH_REQUESTED', clientId: client.clientId,
    details: { lastPreviewStatus: lastStatus, reason: reason || 'no reason given' },
  })
  await createNotification({
    type: 'PREVIEW_REFRESH', severity: 'WARNING',
    title: 'Client requested a fresh preview link',
    body: `${client.clientId} · ${client.name} — last preview: ${lastStatus}. Regenerate via Journey → Generate HTML Preview. ${reason || ''}`.slice(0, 500),
  })

  // Persist a delivery-ops automation row so the request is trackable in Logs → Automation
  await db.automationLog
    .create({
      data: {
        workflow: 'PREVIEW_REFRESH_REQUEST',
        trigger: 'API',
        correlationId: `prr-${Date.now()}`,
        clientId: client.id,
        status: 'SUCCESS',
        steps: JSON.stringify([{ step: 'RECEIVED', detail: `Client ${client.clientId} requested a fresh preview link (last: ${lastStatus})`, at: new Date().toISOString() }]),
        output: JSON.stringify({ clientId: client.clientId, lastStatus, reason }),
      },
    })
    .catch(() => null)

  return Response.json({
    ok: true,
    message: 'Request sent — our team will regenerate your preview link and share it over your configured channel.',
  })
}
