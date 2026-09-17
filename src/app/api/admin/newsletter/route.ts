import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { guard, isResponse } from '@/lib/api-guard'

export const dynamic = 'force-dynamic'

// ------------------------------------------------------------
// GET /api/admin/newsletter — the newsletter studio payload.
//
// Also performs an idempotent legacy migration: FormSubmission rows
// with form='NEWSLETTER' (the pre-model storage) are copied into
// NewsletterSubscriber — email-unique, existing rows skipped,
// original createdAt preserved. Running it on every GET is safe;
// after the first pass it copies nothing.
// ------------------------------------------------------------
export async function GET(req: NextRequest) {
  const g = await guard(req, { minRole: 'ADMIN' })
  if (isResponse(g)) return g

  // --- legacy migration (idempotent) ---
  let migrated = 0
  try {
    const legacy = await db.formSubmission.findMany({
      where: { form: 'NEWSLETTER', email: { not: null } },
      select: { email: true, createdAt: true },
      take: 5000,
      orderBy: { createdAt: 'asc' },
    })
    if (legacy.length > 0) {
      const existing = new Set(
        (await db.newsletterSubscriber.findMany({ select: { email: true } })).map((s) => s.email),
      )
      for (const row of legacy) {
        const email = (row.email ?? '').trim().toLowerCase()
        if (!email || existing.has(email)) continue
        await db.newsletterSubscriber
          .create({ data: { email, source: 'LEGACY_FORM', createdAt: row.createdAt } })
          .catch(() => null) // unique race → skip
        existing.add(email)
        migrated++
      }
    }
  } catch {
    // migration must never break the read
  }

  const [subscribers, campaigns, activeCount, unsubCount, totalCount, sentCount, createdAts] = await Promise.all([
    db.newsletterSubscriber.findMany({ orderBy: { createdAt: 'desc' }, take: 500 }),
    db.emailCampaign.findMany({ orderBy: { createdAt: 'desc' }, take: 50 }),
    db.newsletterSubscriber.count({ where: { status: 'ACTIVE' } }),
    db.newsletterSubscriber.count({ where: { status: 'UNSUBSCRIBED' } }),
    db.newsletterSubscriber.count(),
    db.emailCampaign.count({ where: { status: 'SENT' } }),
    db.newsletterSubscriber.findMany({ select: { createdAt: true } }),
  ])

  // 30-day rolling cumulative subscriber count (all-time up to each day) —
  // an honest growth curve: flat until the list actually grows.
  const growth: Array<{ date: string; total: number }> = []
  const now = Date.now()
  for (let i = 29; i >= 0; i--) {
    const dayEnd = new Date(now - i * 24 * 3600 * 1000)
    dayEnd.setUTCHours(23, 59, 59, 999)
    growth.push({
      date: dayEnd.toISOString().slice(0, 10),
      total: createdAts.filter((s) => s.createdAt <= dayEnd).length,
    })
  }

  return Response.json({
    migrated,
    subscribers: subscribers.map((s) => ({
      id: s.id,
      email: s.email,
      name: s.name,
      status: s.status,
      source: s.source,
      unsubscribedAt: s.unsubscribedAt,
      createdAt: s.createdAt,
    })),
    campaigns: campaigns.map((c) => ({
      id: c.id,
      name: c.name,
      subject: c.subject,
      body: c.body,
      status: c.status,
      scheduledAt: c.scheduledAt,
      sentAt: c.sentAt,
      recipientCount: c.recipientCount,
      agentExecId: c.agentExecId,
      createdBy: c.createdBy,
      createdAt: c.createdAt,
    })),
    growth,
    stats: {
      active: activeCount,
      unsubscribed: unsubCount,
      total: totalCount,
      campaignsSent: sentCount,
    },
  })
}
