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
          // Update comm state: inbound record for follow-up machine (Requirement G)
          const { recordInbound } = await import('@/lib/conversation-state')
          await recordInbound(existing.id, existing.clientId, text, 'WHATSAPP').catch(() => null)

          await audit({ actor: 'webhook:WHATSAPP', action: 'INBOUND_MESSAGE', clientId: existing.clientId, ip })

          // --- Contextual AI response (Requirement B.3, C, D) ---
          // Previously messages were merely stored; now we generate a contextual
          // reply via the orchestrator and send it on the same channel (or email
          // if that is canonical and WhatsApp is only for notifications).
          try {
            await handleWhatsAppReply({ client: existing, phone, text, providerMessageId: m.id })
          } catch (replyError) {
            const { logError: logErr } = await import('@/lib/security')
            await logErr({ source: 'WEBHOOK', code: 'WA_REPLY_FAILED', message: replyError instanceof Error ? replyError.message : String(replyError), workflow: 'WHATSAPP_REPLY' }).catch(() => null)
            // Never silently ignore — we already logged; we do not throw to WhatsApp
          }

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

// --- Orchestrated reply (uses same one-question-at-a-time engine as web chat) ---
async function handleWhatsAppReply(input: { client: { id: string; clientId: string; email: string | null; whatsapp: string | null; name: string; pipelineStage: string }; phone: string; text: string; providerMessageId: string }) {
  // Find or create a ChatConversation for this WhatsApp client so history is unified
  let convo = await db.chatConversation.findFirst({
    where: { anonId: `wa:${input.phone}`, status: 'OPEN' },
    orderBy: { createdAt: 'desc' },
  })
  if (!convo) {
    convo = await db.chatConversation.create({
      data: { anonId: `wa:${input.phone}`, visitorName: input.client.name, visitorPhone: input.phone, clientId: input.client.id, status: 'OPEN' },
    })
  }
  // Use chat orchestrator for contextual AI response (honest errors, one Q at a time)
  const { handleCustomerMessage } = await import('@/lib/chat-orchestrator')
  const result = await handleCustomerMessage({
    channel: 'WHATSAPP',
    conversationId: convo.id,
    clientRowId: input.client.id,
    clientId: input.client.clientId,
    visitorBody: input.text,
    visitorName: input.client.name,
    visitorEmail: input.client.email,
  })

  if (!result.ok) return // orchestrator persisted honest error as SYSTEM message; we do not re-send

  // Route outbound: if email is canonical for formal stage, send concise WhatsApp notification;
  // otherwise send full reply on WhatsApp (same channel as inbound)
  const isFormalStage = ['SCOPE_REVIEW', 'FINAL_SCOPE', 'CLIENT_APPROVAL', 'PAYMENT_PENDING', 'PROJECT_ACTIVE', 'DELIVERY', 'HANDOVER'].includes(input.client.pipelineStage)
  const emailCanonical = Boolean(input.client.email) && isFormalStage

  if (emailCanonical) {
    // Formal detail should go to email — send concise WhatsApp notice
    const { sendCommunication } = await import('@/lib/comms')
    await sendCommunication({
      clientId: input.client.id,
      channel: 'WHATSAPP',
      to: input.phone,
      body: `Tech360 · Ref ${input.client.clientId}\nWe sent details to your email (${input.client.email}). Please check it and reply there when a detailed answer is needed.\n\n${result.reply.slice(0, 500)}`,
      agentCode: 'CHAT-AI',
    })
    const { recordOutbound } = await import('@/lib/conversation-state')
    await recordOutbound(input.client.id, input.client.clientId, result.reply, 'WHATSAPP').catch(() => null)
  } else {
    const { sendCommunication } = await import('@/lib/comms')
    const sendRes = await sendCommunication({
      clientId: input.client.id,
      channel: 'WHATSAPP',
      to: input.phone,
      body: result.reply.slice(0, 4000),
      agentCode: result.wasAiGenerated ? 'CHAT-AI' : 'CHAT-FALLBACK',
    })
    // Honest status: only claim sent if provider accepted
    const { recordOutbound } = await import('@/lib/conversation-state')
    await recordOutbound(input.client.id, input.client.clientId, result.reply, 'WHATSAPP').catch(() => null)
    // Persist delivery status already handled by sendCommunication
    if (!sendRes.result.ok) {
      // Log the honest failure; customer already has SYSTEM message explaining fallback
      const { logError: le } = await import('@/lib/security')
      await le({ source: 'WEBHOOK', code: `WA_SEND_${sendRes.result.status}`, message: `Outbound WhatsApp ${sendRes.result.status}: ${sendRes.result.error ?? 'unknown'}`, clientId: input.client.clientId }).catch(() => null)
    }
  }
}

