import { featureEnabled } from '@/lib/features'
import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { readJson, sanitizeEmail, sanitizeText, rateLimit, clientIp } from '@/lib/security'
import { hasExplicitMarketingConsent, MARKETING_CONSENT_VERSION } from '@/lib/contact-policy'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  if (await featureEnabled('maintenance_mode')) {
    return Response.json({ error: 'We are performing scheduled maintenance. Please try again shortly.' }, { status: 503 })
  }
  const ip = clientIp(req)
  const rl = rateLimit(`news:${ip}`, 3, 10 * 60_000)
  if (!rl.ok) return Response.json({ error: 'Too many requests' }, { status: 429 })

  const raw = await readJson(req)
  const email = sanitizeEmail(raw.email)
  if (!email) return Response.json({ error: 'Valid email required' }, { status: 400 })
  if (!hasExplicitMarketingConsent(raw.consent)) {
    return Response.json({ error: 'Please opt in before subscribing to TECH360 insights.' }, { status: 400 })
  }

  const consentAt = new Date()
  const name = sanitizeText(raw.name, 120) || null
  const interest = sanitizeText(raw.interest, 200) || null
  try {
    // Both records commit together: the API never reports a subscription when
    // the subscriber row failed, and historical consent remains auditable.
    await db.$transaction(async (tx) => {
      await tx.formSubmission.create({
        data: {
          form: 'NEWSLETTER',
          name: name ?? 'Newsletter Subscriber',
          email,
          status: 'PROCESSED',
          ip,
          details: interest,
          marketingConsentAt: consentAt,
          consentVersion: MARKETING_CONSENT_VERSION,
          tracking: JSON.stringify({ consent: { marketing: true, version: MARKETING_CONSENT_VERSION, capturedAt: consentAt.toISOString() } }),
        },
      })
      await tx.newsletterSubscriber.upsert({
        where: { email },
        create: {
          email,
          name,
          source: 'FOOTER',
          status: 'ACTIVE',
          consentAt,
          consentVersion: MARKETING_CONSENT_VERSION,
        },
        update: {
          name: name ?? undefined,
          status: 'ACTIVE',
          source: 'FOOTER',
          consentAt,
          consentVersion: MARKETING_CONSENT_VERSION,
          unsubscribedAt: null,
        },
      })
    })
  } catch {
    return Response.json(
      { error: 'Subscription is temporarily unavailable — please try again shortly.' },
      { status: 503 },
    )
  }

  await db.trackingEvent.create({
    data: { name: 'form_submit', path: '/newsletter', consent: true, meta: JSON.stringify({ form: 'NEWSLETTER' }) },
  }).catch(() => null)
  return Response.json({ ok: true, message: 'Subscribed. Expect occasional engineering insights — no spam.' })
}
