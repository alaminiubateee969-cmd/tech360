import { createHash } from 'node:crypto'
import { featureEnabled } from '@/lib/features'
import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { intakeLead } from '@/lib/journey'
import { readJson, sanitizeText, sanitizeEmail, rateLimit, clientIp, logError, audit } from '@/lib/security'
import { toE164 } from '@/lib/phone'
import { hasExplicitContactConsent, CONTACT_CONSENT_VERSION, isValidClientRequestId } from '@/lib/contact-policy'

export const dynamic = 'force-dynamic'

function payloadHash(payload: Record<string, string | boolean>): string {
  return createHash('sha256').update(JSON.stringify(payload), 'utf8').digest('hex')
}

function isUniqueConflict(error: unknown): boolean {
  return Boolean(error && typeof error === 'object' && 'code' in error && (error as { code?: unknown }).code === 'P2002')
}

async function replayResponse(submission: {
  id: string
  requestHash: string | null
  status: string
  clientId: string | null
  clientRequestId?: string | null
}, requestHash: string): Promise<Response | null> {
  if (submission.requestHash !== requestHash) {
    return Response.json({ ok: false, error: 'This request id was already used for different enquiry details. Refresh the form and submit again.' }, { status: 409 })
  }
  if (submission.status === 'PENDING_REVIEW') {
    return Response.json({
      ok: false,
      reviewPending: true,
      requestRef: submission.clientRequestId ?? null,
      message: 'Your enquiry is saved, but a Customer ID cannot be issued until contact ownership is safely reviewed. This reference is for support follow-up only, not authentication. Contact info@bdtech360.com for verification.',
    }, { status: 202 })
  }
  if (submission.status === 'PROCESSED' && submission.clientId) {
    const client = await db.client.findUnique({ where: { id: submission.clientId }, select: { clientId: true } })
    if (!client) return Response.json({ ok: false, error: 'The saved enquiry needs operator review. Please contact info@bdtech360.com.' }, { status: 503 })
    return Response.json({ ok: true, replayed: true, clientId: client.clientId, message: `Your enquiry is already registered under reference ${client.clientId}. Keep this reference for future communication.` })
  }
  if (submission.status === 'PROCESSING') {
    return Response.json({ ok: false, error: 'This enquiry is already being processed. Wait a moment, then retry with the same form state.' }, { status: 202 })
  }
  if (submission.clientId) {
    return Response.json({ ok: false, error: 'This enquiry reached a partial state and needs operator review. It was not submitted a second time; please contact info@bdtech360.com.' }, { status: 409 })
  }
  return null
}

// PUBLIC CONTACT FORM → consent-evidenced, idempotent CRM intake
export async function POST(req: NextRequest) {
  // feature-gate: support/contact switch + maintenance mode (Super Admin)
  if (!(await featureEnabled('support'))) {
    return Response.json({ error: 'Contact form intake is currently disabled. Please try again later or email info@bdtech360.com.' }, { status: 503 })
  }
  if (await featureEnabled('maintenance_mode')) {
    return Response.json({ error: 'We are performing scheduled maintenance. Please try again shortly.' }, { status: 503 })
  }

  const raw = await readJson(req)
  if (!hasExplicitContactConsent(raw.consent)) {
    return Response.json({ error: 'Explicit consent is required before we can process your enquiry.', fields: { consent: 'Please agree to the Privacy Policy.' } }, { status: 400 })
  }
  const requestId = sanitizeText(raw.requestId, 64)
  if (!isValidClientRequestId(requestId)) {
    return Response.json({ error: 'A valid request id is required. Refresh the page and try again.' }, { status: 400 })
  }

  const ip = clientIp(req)
  const name = sanitizeText(raw.name, 200)
  const emailInput = sanitizeText(raw.email, 320)
  const email = sanitizeEmail(emailInput)
  const preferredContact = sanitizeText(raw.preferredContact, 40)
  const contactNumberInput = sanitizeText(raw.whatsapp ?? raw.phone, 32)
  const normalizedContactNumber = contactNumberInput.startsWith('+') ? (toE164(contactNumberInput) ?? '') : ''
  const whatsapp = preferredContact === 'WhatsApp' || (preferredContact === 'Email' && contactNumberInput)
    ? normalizedContactNumber
    : ''
  const phone = preferredContact === 'Phone' ? normalizedContactNumber : ''
  const details = sanitizeText(raw.details ?? raw.projectDetails, 8000)
  const businessName = sanitizeText(raw.businessName, 200)
  const businessType = sanitizeText(raw.businessType, 80)
  const country = sanitizeText(raw.country, 80)
  const projectType = sanitizeText(raw.projectType, 120)
  const budgetRange = sanitizeText(raw.budgetRange, 80)

  const errors: Record<string, string> = {}
  if (name && name.length < 2) errors.name = 'If you provide a name, enter at least two characters.'
  if (!email) errors.email = emailInput ? 'Enter a valid email address.' : 'Email is required so we can send service-related updates.'
  if (contactNumberInput && !normalizedContactNumber) errors.whatsapp = 'Enter a valid international number starting with +, or leave it blank.'
  if (details.length < 20) errors.details = 'Please describe your project (at least 20 characters)'
  if (!['WhatsApp', 'Email', 'Phone'].includes(preferredContact)) errors.preferredContact = 'Choose a contact method.'
  if (preferredContact === 'Email' && !email) errors.preferredContact = 'Enter an email address for your preferred contact method.'
  if (preferredContact === 'WhatsApp' && !whatsapp) errors.preferredContact = 'Enter a reachable WhatsApp number in international format.'
  if (preferredContact === 'Phone' && !phone) errors.preferredContact = 'Enter a reachable phone number in international format.'
  if (Object.keys(errors).length > 0) return Response.json({ error: 'Validation failed', fields: errors }, { status: 400 })

  const fingerprint = payloadHash({
    name,
    businessName,
    businessType,
    email,
    phone,
    whatsapp,
    country,
    projectType,
    budgetRange,
    details,
    preferredContact,
    consent: true,
    consentVersion: CONTACT_CONSENT_VERSION,
  })

  let existing = await db.formSubmission.findUnique({
    where: { clientRequestId: requestId },
    select: { id: true, requestHash: true, status: true, clientId: true, clientRequestId: true },
  }).catch(() => null)
  if (existing) {
    const replay = await replayResponse(existing, fingerprint)
    if (replay) return replay
  }

  const rl = rateLimit(`contact:${ip}`, 5, 10 * 60_000)
  if (!rl.ok) return Response.json({ error: 'Too many submissions. Please try again later or email info@bdtech360.com.' }, { status: 429 })

  let submission = existing
  if (!submission) {
    const capturedAt = new Date()
    const trackingInput = raw.tracking && typeof raw.tracking === 'object' && !Array.isArray(raw.tracking)
      ? raw.tracking as Record<string, unknown>
      : {}
    const tracking = JSON.stringify({
      source: 'CONTACT_FORM',
      referrer: sanitizeText(trackingInput.ref, 500) || null,
      path: sanitizeText(trackingInput.path, 200) || null,
      consent: { contact: true, version: CONTACT_CONSENT_VERSION, capturedAt: capturedAt.toISOString() },
    })
    try {
      submission = await db.formSubmission.create({
        data: {
          clientRequestId: requestId,
          requestHash: fingerprint,
          form: 'CONTACT',
          name: name || 'Unknown',
          businessName: businessName || null,
          businessType: businessType || null,
          email: email || null,
          phone: phone || null,
          whatsapp: whatsapp || null,
          country: country || null,
          projectType: projectType || null,
          budgetRange: budgetRange || null,
          details,
          preferredContact: preferredContact || null,
          tracking,
          ip,
          contactConsentAt: capturedAt,
          consentVersion: CONTACT_CONSENT_VERSION,
          status: 'NEW',
        },
        select: { id: true, requestHash: true, status: true, clientId: true, clientRequestId: true },
      })
    } catch (error) {
      if (!isUniqueConflict(error)) {
        return Response.json({ error: 'The enquiry could not be saved. Please try again shortly.' }, { status: 503 })
      }
      existing = await db.formSubmission.findUnique({
        where: { clientRequestId: requestId },
        select: { id: true, requestHash: true, status: true, clientId: true, clientRequestId: true },
      }).catch(() => null)
      if (!existing) return Response.json({ error: 'The enquiry is being processed. Retry shortly with the same request.' }, { status: 202 })
      const replay = await replayResponse(existing, fingerprint)
      if (replay) return replay
      submission = existing
    }
  }

  if (!submission) {
    return Response.json({ error: 'The enquiry could not be saved. Please try again shortly.' }, { status: 503 })
  }
  if (submission.status === 'NEW' || submission.status === 'FAILED') {
    const priorClient = submission.clientId
      ? await db.client.findUnique({ where: { id: submission.clientId }, select: { id: true, clientId: true } }).catch(() => null)
      : null
    if (priorClient) {
      return Response.json({ ok: false, error: 'This enquiry has a partial CRM record and needs operator review. It was not duplicated; please contact info@bdtech360.com.' }, { status: 409 })
    }
  }

  // Do not auto-link or create a second CRM Client solely because an unverified
  // email string matches. Preserve the enquiry and route collisions for review.
  if (email && !submission.clientId) {
    const existingEmailOwner = await db.client.findFirst({
      where: { email, deletedAt: null },
      select: { id: true },
    })
    if (existingEmailOwner) {
      await db.formSubmission.update({
        where: { id: submission.id },
        data: {
          status: 'PENDING_REVIEW',
          tracking: JSON.stringify({
            source: 'CONTACT_FORM',
            consent: { contact: true, version: CONTACT_CONSENT_VERSION },
            identityReviewRequired: true,
          }),
        },
      })
      await Promise.all([
        audit({ actor: 'public:form', action: 'CONTACT_IDENTITY_REVIEW_REQUIRED', ip, details: { formId: submission.id, requestRef: requestId } }).catch(() => null),
        db.notification.create({
          data: {
            type: 'IDENTITY_REVIEW',
            title: 'Public contact intake requires identity review',
            body: `Request ${requestId} is saved without a Client link; verify ownership before linking.`,
            severity: 'WARNING',
          },
        }).catch(() => null),
      ])
      return Response.json({
        ok: false,
        reviewPending: true,
        requestRef: requestId,
        message: 'Your enquiry is saved, but a Customer ID cannot be issued until contact ownership is safely reviewed. This reference is for support follow-up only, not authentication. Contact info@bdtech360.com for verification.',
      }, { status: 202 })
    }
  }

  // Analytics remains separate and cannot turn a failed CRM submission into success.
  await db.trackingEvent.create({
    data: { name: 'lead', path: '/contact', consent: true, meta: JSON.stringify({ form: 'CONTACT', ip }) },
  }).catch(() => null)

  // Contact fields are stored separately; keep project requirements free of contact PII.
  const message = details


  try {
    const result = await intakeLead({
      source: 'WEBSITE',
      name,
      businessName,
      businessType,
      email,
      phone: phone || undefined,
      whatsapp: whatsapp || undefined,
      country,
      message,
      projectType,
      budgetRange,
      preferredContact,
      contactConsent: true,
      tracking: {
        source: 'CONTACT_FORM',
        referrer: raw.tracking && typeof raw.tracking === 'object' && !Array.isArray(raw.tracking)
          ? sanitizeText((raw.tracking as Record<string, unknown>).ref, 500) || null
          : null,
        path: raw.tracking && typeof raw.tracking === 'object' && !Array.isArray(raw.tracking)
          ? sanitizeText((raw.tracking as Record<string, unknown>).path, 200) || null
          : null,
        consent: { contact: true, version: CONTACT_CONSENT_VERSION },
      },
      formId: submission.id,
    })

    await audit({ actor: 'public:form', action: 'CONTACT_FORM_SUBMITTED', clientId: result.clientId, ip, details: { formId: submission.id } })
    const emailDelivery = result.welcome?.deliveries.find((delivery) => delivery.channel === 'EMAIL')
    const emailDeliveryStatus = emailDelivery?.ok ? 'ACCEPTED_BY_PROVIDER' : emailDelivery ? 'NOT_CONFIRMED' : 'NOT_ATTEMPTED'
    return Response.json({
      ok: true,
      clientId: result.clientId,
      emailDeliveryStatus,
      message: `${name ? `Thank you ${name}.` : 'Thank you.'} Your enquiry is registered under Client ID ${result.clientId}. Keep your Client ID for future communication.`,
    })
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error'
    await logError({ source: 'API', code: 'CONTACT_FAILED', message: msg, workflow: 'CONTACT' })
    return Response.json({ error: 'We could not process your submission right now. Your request is saved for safe retry; please retry without changing the form or email info@bdtech360.com.' }, { status: 503 })
  }
}
