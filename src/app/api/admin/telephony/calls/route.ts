import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { guard, isResponse } from '@/lib/api-guard'
import { sanitizeText, audit } from '@/lib/security'
import { telephonyState, normalizeDialNumber, dialUri, CALL_CHANNELS, type CallChannel } from '@/lib/telephony'

export const dynamic = 'force-dynamic'

// Call centre — click-to-call with a real, persisted call record.
// With no server-side line configured the platform still logs the call and
// hands the operator a device `tel:`/`sip:` link; it never claims the server
// placed a call it cannot place.
export async function GET(req: NextRequest) {
  const g = await guard(req, { minRole: 'STAFF' })
  if (isResponse(g)) return g

  const url = new URL(req.url)
  const status = sanitizeText(url.searchParams.get('status') ?? '', 24).toUpperCase()
  const clientId = sanitizeText(url.searchParams.get('clientId') ?? '', 40)

  const calls = await db.callLog.findMany({
    where: { ...(status ? { status } : {}), ...(clientId ? { clientId } : {}) },
    orderBy: { startedAt: 'desc' },
    take: 200,
  })

  const clientIds = [...new Set(calls.map((c) => c.clientId).filter((v): v is string => Boolean(v)))]
  type ClientRef = { id: string; clientId: string; name: string; phone: string | null }
  const clients: ClientRef[] = clientIds.length
    ? await db.client.findMany({ where: { id: { in: clientIds } }, select: { id: true, clientId: true, name: true, phone: true } })
    : []
  const byId = new Map<string, ClientRef>(clients.map((c) => [c.id, c]))

  return Response.json({
    calls: calls.map((c) => ({
      ...c,
      client: c.clientId ? byId.get(c.clientId) ?? null : null,
      dialUri: dialUri(c.number, c.channel as CallChannel),
    })),
    state: telephonyState(),
  })
}

export async function POST(req: NextRequest) {
  const g = await guard(req, { minRole: 'STAFF' })
  if (isResponse(g)) return g

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>
  const rawNumber = sanitizeText(body.number ?? '', 32).trim()
  const clientId = sanitizeText(body.clientId ?? '', 40).trim() || null
  const leadId = sanitizeText(body.leadId ?? '', 40).trim() || null
  const channelRaw = sanitizeText(body.channel ?? 'CLICK_TO_CALL', 20).toUpperCase()
  const notes = sanitizeText(body.notes ?? '', 1000)

  const state = telephonyState()
  const channel: CallChannel = (CALL_CHANNELS as readonly string[]).includes(channelRaw) ? (channelRaw as CallChannel) : 'CLICK_TO_CALL'

  let number = normalizeDialNumber(rawNumber)
  if (!number && clientId) {
    const client = await db.client.findFirst({ where: { id: clientId, deletedAt: null }, select: { phone: true } })
    if (client?.phone) number = normalizeDialNumber(client.phone)
  }
  if (!number) return Response.json({ error: 'A dialable phone number is required (or a client with a phone number on file).' }, { status: 400 })

  if (clientId) {
    const client = await db.client.findFirst({ where: { id: clientId, deletedAt: null }, select: { id: true } })
    if (!client) return Response.json({ error: 'Client not found.' }, { status: 404 })
  }

  const call = await db.callLog.create({
    data: {
      clientId,
      leadId,
      direction: 'OUTBOUND',
      number,
      channel,
      provider: state.provider === 'NONE' ? null : state.provider,
      status: 'LOGGED',
      notes: notes || null,
      createdBy: g.user.email,
    },
  })
  await audit({ actor: g.user.email, action: 'CALL_LOGGED', userId: g.user.id, entityId: call.id, clientId: clientId ?? undefined, details: { number, channel, provider: state.provider } })

  return Response.json(
    {
      call,
      dialUri: dialUri(number, channel),
      state,
      notice:
        state.serverCalling === 'AVAILABLE'
          ? 'Server-side calling is configured; the call is queued through the provider and this record tracks the outcome.'
          : 'No server-side voice line is configured. Open the dial link on the operator device and record the outcome here — this is a logged call, not a server-placed one.',
    },
    { status: 201 },
  )
}
