import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { guard, isResponse } from '@/lib/api-guard'
import { readJson, sanitizeText, audit, logError } from '@/lib/security'
import { intakeLead } from '@/lib/journey'
import { createNotification } from '@/lib/notify'

export const dynamic = 'force-dynamic'

// ============================================================
// POST /api/admin/referrals/[id]/convert — close the growth loop.
//
// A referred contact becomes a REAL lead: the full intake pipeline
// runs (Client ID assignment, Lead record, LEAD_INTAKE automation
// log, AI business detection queue, memory) with source=REFERRAL
// and the referrer tracked. The referral is linked to the client
// it produced — attribution that survives forever.
// ============================================================
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const g = await guard(req, { minRole: 'ADMIN' })
  if (isResponse(g)) return g
  const { id } = await params
  const raw = await readJson(req)

  const referral = await db.referral.findUnique({
    where: { id: sanitizeText(id, 40) },
    include: { client: { select: { id: true, clientId: true, name: true, businessName: true } }, convertedClient: { select: { id: true, clientId: true, name: true } } },
  })
  if (!referral) return Response.json({ error: 'Referral not found' }, { status: 404 })
  if (referral.status === 'CONVERTED' || referral.convertedClientId) {
    return Response.json({ error: `Already converted to ${referral.convertedClient?.clientId ?? 'a client'} — one referral converts once.`, referral: null }, { status: 409 })
  }
  if (referral.status === 'CLOSED') return Response.json({ error: 'This referral is CLOSED — reopen it before converting.' }, { status: 400 })

  // contact details: admin edits win, else parse from the referral record
  const name = sanitizeText(raw.name, 120).trim() || referral.name?.trim() || ''
  const contactRaw = sanitizeText(raw.contact, 200).trim() || referral.contact?.trim() || ''
  const email = sanitizeText(raw.email, 200).trim() || (contactRaw.includes('@') ? contactRaw : '')
  const whatsapp = sanitizeText(raw.whatsapp, 40).trim() || (/^[+\d][\d\s-]{6,}$/.test(contactRaw) ? contactRaw : '')
  if (!name) return Response.json({ error: 'Referred person name required (provide name or edit the referral).' }, { status: 400 })
  if (!email && !whatsapp) return Response.json({ error: 'An email or WhatsApp number is required to reach the referred contact.' }, { status: 400 })

  const message = sanitizeText(raw.message, 2000).trim() ||
    `Referred by ${referral.client.name}${referral.client.businessName ? ` (${referral.client.businessName})` : ''} — client ${referral.client.clientId}.${referral.notes ? ` Referral notes: ${referral.notes}` : ''} Please reach out regarding a new project.`

  try {
    const lead = await intakeLead({
      source: 'REFERRAL',
      name,
      email: email || undefined,
      whatsapp: whatsapp || undefined,
      message,
      preferredContact: email ? 'EMAIL' : 'WHATSAPP',
      tracking: { referralId: referral.id, referredBy: referral.client.clientId },
    })

    // link + convert
    const updated = await db.referral.update({
      where: { id: referral.id },
      data: {
        status: 'CONVERTED',
        convertedClientId: lead.clientRowId,
        convertedAt: new Date(),
        notes: referral.notes ? `${referral.notes}\nCONVERTED → ${lead.clientId}` : `CONVERTED → ${lead.clientId}`,
      },
      include: { convertedClient: { select: { clientId: true, name: true } } },
    })

    await createNotification({
      type: 'REFERRAL',
      title: `Referral converted: ${lead.clientId}`,
      body: `${name} was referred by ${referral.client.clientId} and is now a live lead with the full intake pipeline. Attribution recorded.`,
      severity: 'INFO',
      link: 'leads',
    })
    await audit({
      actor: g.user.email, action: 'REFERRAL_CONVERTED', userId: g.user.id,
      clientId: referral.client.clientId,
      details: { referralId: referral.id, newClientId: lead.clientId, referred: name, referrer: referral.client.clientId },
    })

    return Response.json({
      ok: true,
      message: `Converted — ${name} is now ${lead.clientId} (source: REFERRAL).`,
      clientId: lead.clientId,
      clientRowId: lead.clientRowId,
      referral: {
        id: updated.id,
        clientId: referral.client.clientId,
        clientName: referral.client.name,
        businessName: referral.client.businessName,
        name: updated.name, contact: updated.contact, notes: updated.notes, status: updated.status,
        convertedClientId: updated.convertedClientId,
        convertedClientIdCode: updated.convertedClient?.clientId ?? null,
        convertedClientName: updated.convertedClient?.name ?? null,
        convertedAt: updated.convertedAt,
        createdAt: updated.createdAt,
      },
    }, { status: 201 })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Conversion failed'
    await logError({ source: 'AUTOMATION', code: 'REFERRAL_CONVERT_FAILED', message: msg, workflow: 'REFERRAL_CONVERT', clientId: referral.client.clientId })
    return Response.json({ error: msg }, { status: 500 })
  }
}
