import { NextRequest } from 'next/server'
import { intakeLead } from '@/lib/journey'
import { sanitizeText, sanitizePhone, sanitizeEmail, rateLimit, clientIp, logError, audit, constantTimeEquals } from '@/lib/security'

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
  const email = sanitizeEmail(raw.email)
  const phone = sanitizePhone(raw.phone)

  try {

    // Social profile contact fields are provider-supplied claims, not a
    // verification proof. Do not match them against existing CRM records or
    // merge tenants automatically; a verified identity can be linked later by
    // an authorized admin with an audit reason.
    const result = await intakeLead({
      source: channel,
      name: sender || `${channel} Contact`,
      email: email || undefined,
      whatsapp: phone || undefined,
      message: `${channel} inbound message: ${message}`,
    })
    await audit({ actor: `social:${channel}`, action: 'NEW_LEAD_FROM_SOCIAL', clientId: result.clientId, ip })
    return Response.json({ ok: true })
  } catch (e) {
    await logError({ source: 'WEBHOOK', code: 'SOCIAL_HOOK_FAILED', message: e instanceof Error ? e.message : 'unknown', workflow: 'SOCIAL_INBOX' })
    return Response.json({ ok: false }, { status: 200 })
  }
}
