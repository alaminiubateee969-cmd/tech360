import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { intakeLead } from '@/lib/journey'
import { sanitizeText, sanitizePhone, sanitizeEmail, rateLimit, clientIp, logError, audit, constantTimeEquals } from '@/lib/security'
import { runAgent } from '@/lib/agents/engine'

export const dynamic = 'force-dynamic'

// Inbound social messages (Facebook/Instagram/LinkedIn/X) — posted by n8n or platform webhooks
export async function POST(req: NextRequest) {
  const ip = clientIp(req)
  const rl = rateLimit(`social-hook:${ip}`, 60, 60_000)
  if (!rl.ok) return Response.json({ ok: true })
  let raw: Record<string, unknown>
  try { raw = await req.json() } catch { return Response.json({ ok: true }) }

  // FAIL CLOSED — an unset secret previously allowed anonymous inbound social
  // events to create CRM records.
  const secret = process.env.SOCIAL_WEBHOOK_SECRET
  if (!secret) {
    return Response.json({ error: 'Webhook not configured' }, { status: 503 })
  }
  if (!constantTimeEquals(req.headers.get('x-webhook-secret'), secret)) {
    return Response.json({ error: 'Unauthorized webhook' }, { status: 401 })
  }

  const channel = sanitizeText(raw.channel, 20).toUpperCase()
  if (!['FACEBOOK', 'INSTAGRAM', 'LINKEDIN', 'X'].includes(channel)) {
    return Response.json({ error: 'channel must be FACEBOOK|INSTAGRAM|LINKEDIN|X' }, { status: 400 })
  }
  const sender = sanitizeText(raw.sender, 200)
  const message = sanitizeText(raw.message, 4000)
  const contact = sanitizeText(raw.contact, 200)
  const email = sanitizeEmail(raw.email)
  const phone = sanitizePhone(raw.phone)

  try {
    // AI triage via Herald agent
    const run = await runAgent('SOC-014', { input: `Channel: ${channel}\nSender: ${sender}\nMessage: ${message}`, expectJson: true, workflow: 'SOCIAL_INBOX' })

    const existing = email ? await db.client.findFirst({ where: { email } }) : phone ? await db.client.findFirst({ where: { OR: [{ whatsapp: phone }, { phone }] } }) : null
    if (existing) {
      await db.communication.create({
        data: { clientId: existing.id, channel, direction: 'IN', sender, body: message, status: 'RECEIVED', metadata: run.ok ? run.output.slice(0, 4000) : null },
      })
      await audit({ actor: `social:${channel}`, action: 'INBOUND_MESSAGE', clientId: existing.clientId, ip })
    } else {
      const result = await intakeLead({
        source: channel, name: sender || `${channel} Contact`, email: email || undefined, whatsapp: phone || undefined,
        message: `${channel} first message from ${sender}: ${message}`,
      })
      await audit({ actor: `social:${channel}`, action: 'NEW_LEAD_FROM_SOCIAL', clientId: result.clientId, ip })
    }
    return Response.json({ ok: true })
  } catch (e) {
    await logError({ source: 'WEBHOOK', code: 'SOCIAL_HOOK_FAILED', message: e instanceof Error ? e.message : 'unknown', workflow: 'SOCIAL_INBOX' })
    return Response.json({ ok: false }, { status: 200 })
  }
}
