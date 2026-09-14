import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { signPortalToken, PORTAL_COOKIE, PORTAL_TTL_HOURS, normalizeContact, portalGate } from "@/lib/portal"
import { readJson, sanitizeText, rateLimit, clientIp, audit } from '@/lib/security'

export const dynamic = 'force-dynamic'

// Client portal login: Client ID + email/WhatsApp on file.
// Rate limited, audit logged. Never reveals which field failed.
export async function POST(req: NextRequest) {
  const portalDisabled = await portalGate()
  if (portalDisabled) return portalDisabled
  const ip = clientIp(req)
  const rl = rateLimit(`portal-login:${ip}`, 10, 10 * 60_000)
  if (!rl.ok) return Response.json({ error: 'Too many attempts. Try again later.' }, { status: 429 })

  const raw = await readJson(req)
  const clientId = sanitizeText(raw.clientId, 40).toUpperCase()
  const contact = sanitizeText(raw.contact, 320)
  if (!clientId || !contact) return Response.json({ error: 'Client ID and email/WhatsApp are required' }, { status: 400 })

  const client = await db.client.findFirst({
    where: { clientId, deletedAt: null },
    include: { lead: true },
  })
  const norm = normalizeContact(contact)
  const emailMatch = norm.email && client?.email?.toLowerCase() === norm.email
  const phoneMatch = norm.phone && (client?.whatsapp?.replace(/[^\d]/g, '') === norm.phone || client?.phone?.replace(/[^\d]/g, '') === norm.phone)

  if (!client || (!emailMatch && !phoneMatch)) {
    await audit({ actor: `portal:${clientId || 'unknown'}`, action: 'PORTAL_LOGIN_FAILED', ip, details: { reason: 'no matching record' } })
    return Response.json({ error: 'We could not match those details. Check your Client ID (e.g. TECH-2026-000001) and the email/WhatsApp you used when you contacted us.' }, { status: 401 })
  }

  await audit({ actor: `client:${client.clientId}`, action: 'PORTAL_LOGIN', clientId: client.clientId, ip })
  const token = signPortalToken(client.clientId)
  const res = Response.json({ ok: true, clientId: client.clientId, name: client.name })
  const secure = process.env.NODE_ENV === 'production'
  res.headers.append('Set-Cookie', `${PORTAL_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax${secure ? '; Secure' : ''}; Max-Age=${PORTAL_TTL_HOURS * 3600}`)
  return res
}

export async function DELETE(req: NextRequest) {
  const res = Response.json({ ok: true })
  res.headers.append('Set-Cookie', `${PORTAL_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`)
  return res
}
