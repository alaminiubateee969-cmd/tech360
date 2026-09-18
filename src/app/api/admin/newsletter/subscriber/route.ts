import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { guard, isResponse } from '@/lib/api-guard'
import { readJson, sanitizeEmail, sanitizeText, audit } from '@/lib/security'

export const dynamic = 'force-dynamic'

// ------------------------------------------------------------
// POST /api/admin/newsletter/subscriber {email, status}
// Admin row action: unsubscribe / resubscribe a subscriber.
// Upserts so legacy FormSubmission subscribers can be managed too.
// Every change is audited (who flipped which address, which way).
// ------------------------------------------------------------
export async function POST(req: NextRequest) {
  const g = await guard(req, { minRole: 'MANAGER' })
  if (isResponse(g)) return g
  const raw = await readJson(req)
  const email = sanitizeEmail(raw.email)
  const status = sanitizeText(raw.status, 20).toUpperCase()
  if (!email) return Response.json({ error: 'Valid email required' }, { status: 400 })
  if (status !== 'ACTIVE' && status !== 'UNSUBSCRIBED') {
    return Response.json({ error: 'status must be ACTIVE or UNSUBSCRIBED' }, { status: 400 })
  }

  const subscriber = await db.newsletterSubscriber.upsert({
    where: { email },
    create: { email, status, source: 'ADMIN' },
    update: { status },
  })
  await audit({
    actor: g.user.email,
    action: 'NEWSLETTER_SUBSCRIBER_STATUS',
    userId: g.user.id,
    details: { email, status },
  })
  return Response.json({ ok: true, subscriber })
}
