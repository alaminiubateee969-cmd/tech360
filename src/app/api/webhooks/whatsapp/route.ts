import { createHmac } from 'crypto'
import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { intakeLead } from '@/lib/journey'
import { sanitizeText, rateLimit, clientIp, logError, audit, constantTimeEquals } from '@/lib/security'
import { toE164 } from '@/lib/phone'
import { claimInboundWebhookEvent, finishInboundWebhookEvent, resolveVerifiedClientIdentity } from '@/lib/identity-resolver'
import type { VerifiedIdentityProof } from '@/lib/identity-policy'

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

    for (const m of messages) {
      // Meta message ids are the replay/idempotency key. Do not create CRM
      // records for an event that cannot be durably deduplicated.
      if (!m.id) continue
      const claim = await claimInboundWebhookEvent({ provider: 'WHATSAPP', providerEventId: m.id, eventType: 'MESSAGE' })
      if (!claim.claimed || !claim.receiptId || !claim.claimToken) continue

      try {
        const phone = toE164(m.from ?? '')
        if (!phone) {
          await finishInboundWebhookEvent({ receiptId: claim.receiptId, claimToken: claim.claimToken, success: false, errorCode: 'INVALID_PHONE' })
          continue
        }
        const contact = contacts.find((item) => item.wa_id === m.from) ?? contacts[0]
        const name = sanitizeText(contact?.profile?.name ?? '', 200)
        const text = sanitizeText(m.text?.body ?? `[${m.type ?? 'media'} message]`, 4000)
        const proof: VerifiedIdentityProof = { type: 'PHONE', value: phone, verificationSource: 'WHATSAPP_SIGNATURE' }

        // Only a correctly signed provider event establishes a verified phone
        // identity. Raw website form fields remain unverified contact data.
        const existing = await resolveVerifiedClientIdentity(proof)
        if (existing) {
          const duplicate = await db.communication.findFirst({ where: { providerMessageId: m.id }, select: { id: true } })
          if (!duplicate) {
            await db.communication.create({
              data: {
                clientId: existing.id,
                channel: 'WHATSAPP',
                direction: 'IN',
                sender: phone,
                body: text,
                providerMessageId: m.id,
                status: 'RECEIVED',
                messageType: m.type === 'text' ? 'TEXT' : 'MEDIA',
              },
            })
          }
          if (existing.name === 'Unknown Contact' && name) {
            await db.client.update({ where: { id: existing.id }, data: { name } })
          }
          await audit({ actor: 'webhook:WHATSAPP', action: 'INBOUND_MESSAGE', clientId: existing.clientId, ip })
          await finishInboundWebhookEvent({ receiptId: claim.receiptId, claimToken: claim.claimToken, success: true, clientId: existing.id })
        } else {
          // First signed message creates and atomically links the canonical
          // client identity. Concurrent first contacts converge on that row.
          const result = await intakeLead({
            source: 'WHATSAPP',
            name: name || 'WhatsApp Contact',
            whatsapp: phone,
            message: `WhatsApp first message: ${text}`,
            providerMessageId: m.id,
            verifiedIdentities: [proof],
          })
          await audit({ actor: 'webhook:WHATSAPP', action: 'NEW_LEAD_FROM_WHATSAPP', clientId: result.clientId, ip })
          await finishInboundWebhookEvent({ receiptId: claim.receiptId, claimToken: claim.claimToken, success: true, clientId: result.clientRowId })
        }
      } catch (error) {
        await finishInboundWebhookEvent({
          receiptId: claim.receiptId,
          claimToken: claim.claimToken,
          success: false,
          errorCode: error instanceof Error ? error.name : 'PROCESSING_FAILED',
        }).catch(() => false)
        throw error
      }
    }
    return Response.json({ ok: true })
  } catch (e) {
    await logError({ source: 'WEBHOOK', code: 'WA_HOOK_FAILED', message: e instanceof Error ? e.message : 'unknown', workflow: 'WHATSAPP_IN' })
    return Response.json({ ok: false }, { status: 200 }) // always 200 to WhatsApp
  }
}
