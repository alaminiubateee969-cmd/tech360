import { NextRequest } from 'next/server'
import { cookies } from 'next/headers'
import { db } from '@/lib/db'
import { verifyPortalToken, PORTAL_COOKIE, portalGate } from "@/lib/portal"
import { readJson, sanitizeText, audit, rateLimit, clientIp } from '@/lib/security'
import { createNotification } from '@/lib/notify'

export const dynamic = 'force-dynamic'

// POST /api/portal/review — client submits their review from the portal.
// Writes the REAL Review record (rating, content, consent). Publishing only
// happens after admin moderation, and only when consent=true.
export async function POST(req: NextRequest) {
  const portalDisabled = await portalGate()
  if (portalDisabled) return portalDisabled
  const ip = clientIp(req)
  const rl = rateLimit(`portal-review:${ip}`, 5, 60_000)
  if (!rl.ok) return Response.json({ error: 'Too many attempts, please wait a minute.' }, { status: 429 })

  const store = await cookies()
  const clientId = verifyPortalToken(store.get(PORTAL_COOKIE)?.value)
  if (!clientId) return Response.json({ error: 'Session expired. Please sign in again.' }, { status: 401 })

  const client = await db.client.findFirst({ where: { clientId, deletedAt: null }, include: { projects: { orderBy: { createdAt: 'desc' }, take: 1, select: { id: true, code: true } } } })
  if (!client) return Response.json({ error: 'Client not found' }, { status: 404 })

  const raw = await readJson(req)
  const rating = Math.round(Number(raw.rating))
  const content = sanitizeText(raw.content, 2000).trim()
  const consent = raw.consent === true

  if (!Number.isFinite(rating) || rating < 1 || rating > 5) return Response.json({ error: 'Rating must be between 1 and 5.' }, { status: 400 })
  if (content.length < 20) return Response.json({ error: 'Please write at least 20 characters about your experience.' }, { status: 400 })

  // Find this client's review slot (created by the journey requestReviewAndReferral step)
  let review = await db.review.findFirst({ where: { clientId: client.id } })
  if (review && (review.status === 'APPROVED' || review.status === 'SUBMITTED')) {
    return Response.json({ error: 'Your review has already been submitted and is awaiting moderation.', status: 'SUBMITTED' }, { status: 409 })
  }

  if (review) {
    review = await db.review.update({
      where: { id: review.id },
      data: { rating, content, consent, status: 'SUBMITTED', published: false, projectId: review.projectId ?? client.projects[0]?.id ?? null },
    })
  } else {
    // Honest fallback: the slot normally exists; create it if the journey step was skipped
    review = await db.review.create({
      data: { clientId: client.id, projectId: client.projects[0]?.id ?? null, rating, content, consent, status: 'SUBMITTED', published: false },
    })
  }

  await audit({ actor: `client:${client.clientId}`, action: 'REVIEW_SUBMITTED', clientId: client.clientId, details: { rating, consent, length: content.length } })
  await createNotification({
    type: 'REVIEW', severity: 'INFO',
    title: 'Client review submitted — moderation required',
    body: `${client.clientId} · ${client.name} submitted a ${rating}★ review${consent ? ' with publish consent' : ' (no publish consent)'}.`,
  })

  return Response.json({ ok: true, status: 'SUBMITTED', message: 'Thank you — your review is submitted and awaiting moderation.' })
}

// GET /api/portal/review — the client's own review state for the portal card
export async function GET() {
  const portalDisabled = await portalGate()
  if (portalDisabled) return portalDisabled
  const store = await cookies()
  const clientId = verifyPortalToken(store.get(PORTAL_COOKIE)?.value)
  if (!clientId) return Response.json({ error: 'Session expired. Please sign in again.' }, { status: 401 })

  const client = await db.client.findFirst({ where: { clientId, deletedAt: null } })
  if (!client) return Response.json({ error: 'Client not found' }, { status: 404 })

  const review = await db.review.findFirst({ where: { clientId: client.id } })
  const referral = await db.referral.findFirst({ where: { clientId: client.id } })

  return Response.json({
    review: review ? { status: review.status, rating: review.rating, content: review.content, consent: review.consent, createdAt: review.createdAt } : null,
    reviewRequested: Boolean(review),
    referral: referral ? { status: referral.status, name: referral.name, contact: referral.contact, createdAt: referral.createdAt } : null,
  })
}
