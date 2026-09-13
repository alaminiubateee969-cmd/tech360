import { NextRequest } from 'next/server'
import { cookies } from 'next/headers'
import { db } from '@/lib/db'
import { verifyPortalToken, PORTAL_COOKIE } from '@/lib/portal'
import { readJson, sanitizeText, audit, rateLimit, clientIp } from '@/lib/security'
import { createNotification } from '@/lib/notify'

export const dynamic = 'force-dynamic'

// POST /api/portal/referral — client refers another business from the portal.
// Writes the REAL Referral record with status RECEIVED.
export async function POST(req: NextRequest) {
  const ip = clientIp(req)
  const rl = rateLimit(`portal-referral:${ip}`, 5, 60_000)
  if (!rl.ok) return Response.json({ error: 'Too many attempts, please wait a minute.' }, { status: 429 })

  const store = await cookies()
  const clientId = verifyPortalToken(store.get(PORTAL_COOKIE)?.value)
  if (!clientId) return Response.json({ error: 'Session expired. Please sign in again.' }, { status: 401 })

  const client = await db.client.findFirst({ where: { clientId, deletedAt: null } })
  if (!client) return Response.json({ error: 'Client not found' }, { status: 404 })

  const raw = await readJson(req)
  const name = sanitizeText(raw.name, 120).trim()
  const contact = sanitizeText(raw.contact, 160).trim()
  const notes = sanitizeText(raw.notes, 1000).trim()

  if (name.length < 2) return Response.json({ error: 'Referred business or person name is required.' }, { status: 400 })
  if (contact.length < 5) return Response.json({ error: 'A contact (email or phone) for the referral is required.' }, { status: 400 })

  const existing = await db.referral.findFirst({ where: { clientId: client.id } })
  const referral = existing
    ? await db.referral.update({ where: { id: existing.id }, data: { name, contact, notes, status: existing.status === 'REQUESTED' ? 'RECEIVED' : existing.status } })
    : await db.referral.create({ data: { clientId: client.id, name, contact, notes, status: 'RECEIVED' } })

  await audit({ actor: `client:${client.clientId}`, action: 'REFERRAL_SUBMITTED', clientId: client.clientId, details: { referred: name, contact: contact.slice(0, 40) } })
  await createNotification({
    type: 'REFERRAL', severity: 'INFO',
    title: 'New referral received',
    body: `${client.clientId} · ${client.name} referred ${name} (${contact}).`,
  })

  return Response.json({ ok: true, status: referral.status, message: 'Thank you for the referral — our team will reach out.' })
}
