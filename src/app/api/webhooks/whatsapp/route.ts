import { createHmac } from 'crypto'
import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { intakeLead, detectBusiness } from '@/lib/journey'
import { sanitizeText, sanitizePhone, rateLimit, clientIp, logError, audit, constantTimeEquals } from '@/lib/security'

export const dynamic = 'force-dynamic'

// WhatsApp Cloud API webhook verification (GET)
export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const mode = url.searchParams.get('hub.mode')
  const token = url.searchParams.get('hub.verify_token')
  const challenge = url.searchParams.get('hub.challenge')
  const expected = process.env.WHATSAPP_VERIFY_TOKEN
  if (mode === 'subscribe' && expected && token === expected) {
    return new Response(challenge ?? '', { status: 200 })
  }
  return new Response('Forbidden', { status: 403 })
}

type WaMessage = {
  from?: string
  id?: string
  timestamp?: string
  text?: { body?: string }
  type?: string
}

// Inbound WhatsApp messages → CRM (linked to Client ID)
export async function POST(req: NextRequest) {
  const ip = clientIp(req)
  const rl = rateLimit(`wa-hook:${ip}`, 60, 60_000)
  if (!rl.ok) return Response.json({ ok: true })

  // Meta signs every delivery with HMAC-SHA256 over the RAW body using the
  // app secret. Without this check anyone could POST a forged inbound message
  // and create CRM/communication records attributed to a real client.
  // Read the body as text first — re-serialising JSON would change the bytes
  // and break the signature.
  const rawBody = await req.text()
  const appSecret = process.env.WHATSAPP_APP_SECRET
  if (!appSecret) {
    await logError({ source: 'WEBHOOK', code: 'WA_APP_SECRET_MISSING', message: 'WhatsApp webhook rejected: WHATSAPP_APP_SECRET is not configured' })
    return Response.json({ ok: false, error: 'Webhook not configured' }, { status: 503 })
  }
  const expected = 'sha256=' + createHmac('sha256', appSecret).update(rawBody).digest('hex')
  if (!constantTimeEquals(req.headers.get('x-hub-signature-256'), expected)) {
    return Response.json({ ok: false, error: 'Invalid signature' }, { status: 401 })
  }

  let payload: Record<string, unknown>
  try { payload = JSON.parse(rawBody) as Record<string, unknown> } catch { return Response.json({ ok: true }) }

  try {
    const entry = (payload.entry as Array<Record<string, unknown>>)?.[0]
    const change = (entry?.changes as Array<Record<string, unknown>>)?.[0]
    const value = change?.value as Record<string, unknown> | undefined
    const messages = (value?.messages as WaMessage[]) ?? []
    const contacts = (value?.contacts as Array<{ profile?: { name?: string }; wa_id?: string }>) ?? []
    const statuses = (value?.statuses as Array<{ id?: string; status?: string; recipient_id?: string }>) ?? []

    for (const st of statuses) {
      if (st.id) {
        await db.communication.updateMany({
          where: { providerMessageId: st.id },
          data: { status: (st.status ?? 'SENT').toUpperCase() },
        }).catch(() => null)
      }
    }

    for (let i = 0; i < messages.length; i++) {
      const m = messages[i]
      const phone = sanitizePhone(m.from ?? '')
      const name = contacts[i]?.profile?.name ?? ''
      const text = sanitizeText(m.text?.body ?? `[${m.type ?? 'media'} message]`, 4000)
      if (!phone) continue

      // find existing client by whatsapp number
      const existing = await db.client.findFirst({ where: { whatsapp: phone, deletedAt: null } })
      if (existing) {
        await db.communication.create({
          data: { clientId: existing.id, channel: 'WHATSAPP', direction: 'IN', sender: phone, body: text, providerMessageId: m.id ?? null, status: 'RECEIVED', messageType: (m.type ?? 'TEXT').toUpperCase() },
        })
        await db.client.update({ where: { id: existing.id }, data: { name: existing.name === 'Unknown Contact' && name ? name : existing.name } })
        await audit({ actor: `whatsapp:${phone}`, action: 'INBOUND_MESSAGE', clientId: existing.clientId, ip })
      } else {
        // first message from this number → full intake journey
        const result = await intakeLead({ source: 'WHATSAPP', name: name || 'WhatsApp Contact', whatsapp: phone, message: `WhatsApp first message: ${text}` })
        await db.communication.updateMany({ where: { clientId: result.clientRowId, channel: 'WHATSAPP', direction: 'IN' }, data: { providerMessageId: m.id ?? null } })
        await audit({ actor: `whatsapp:${phone}`, action: 'NEW_LEAD_FROM_WHATSAPP', clientId: result.clientId, ip })
      }
    }
    return Response.json({ ok: true })
  } catch (e) {
    await logError({ source: 'WEBHOOK', code: 'WA_HOOK_FAILED', message: e instanceof Error ? e.message : 'unknown', workflow: 'WHATSAPP_IN' })
    return Response.json({ ok: false }, { status: 200 }) // always 200 to WhatsApp
  }
}
