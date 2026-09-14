import { featureEnabled } from "@/lib/features"
import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { readJson, sanitizeEmail, sanitizeText, rateLimit, clientIp } from '@/lib/security'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  // feature-gate: maintenance mode (Super Admin)
  if (await featureEnabled('maintenance_mode')) {
    return Response.json({ error: 'We are performing scheduled maintenance. Please try again shortly.' }, { status: 503 })
  }
  const ip = clientIp(req)
  const rl = rateLimit(`news:${ip}`, 3, 10 * 60_000)
  if (!rl.ok) return Response.json({ error: 'Too many requests' }, { status: 429 })
  const raw = await readJson(req)
  const email = sanitizeEmail(raw.email)
  if (!email) return Response.json({ error: 'Valid email required' }, { status: 400 })
  await db.formSubmission.create({
    data: { form: 'NEWSLETTER', name: 'Newsletter Subscriber', email, status: 'PROCESSED', ip, details: sanitizeText(raw.interest, 200) || null },
  })
  await db.trackingEvent.create({ data: { name: 'form_submit', path: '/newsletter', consent: raw.consent === true, meta: '{"form":"NEWSLETTER"}' } }).catch(() => null)
  return Response.json({ ok: true, message: 'Subscribed. Expect occasional engineering insights — no spam.' })
}
