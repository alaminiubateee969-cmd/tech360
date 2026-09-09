import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { intakeLead } from '@/lib/journey'
import { readJson, sanitizeText, sanitizeEmail, sanitizePhone, rateLimit, clientIp, logError, audit } from '@/lib/security'
import { PIPELINE_STAGES } from '@/lib/constants'

export const dynamic = 'force-dynamic'

// PUBLIC CONTACT FORM → real CRM lead with Client ID + AI journey start
export async function POST(req: NextRequest) {
  const ip = clientIp(req)
  const rl = rateLimit(`contact:${ip}`, 5, 10 * 60_000)
  if (!rl.ok) return Response.json({ error: 'Too many submissions. Please try again later or message us on WhatsApp.' }, { status: 429 })

  const raw = await readJson(req)
  const name = sanitizeText(raw.name, 200)
  const email = sanitizeEmail(raw.email)
  const whatsapp = sanitizePhone(raw.whatsapp)
  const details = sanitizeText(raw.details ?? raw.projectDetails, 8000)
  const businessName = sanitizeText(raw.businessName, 200)
  const businessType = sanitizeText(raw.businessType, 80)
  const country = sanitizeText(raw.country, 80)
  const projectType = sanitizeText(raw.projectType, 120)
  const budgetRange = sanitizeText(raw.budgetRange, 80)
  const preferredContact = sanitizeText(raw.preferredContact, 40)

  const errors: Record<string, string> = {}
  if (name.length < 2) errors.name = 'Name is required'
  if (!email && !whatsapp) errors.contact = 'Email or WhatsApp number is required'
  if (email && !email) errors.email = 'Invalid email'
  if (details.length < 20) errors.details = 'Please describe your project (at least 20 characters)'
  if (Object.keys(errors).length > 0) return Response.json({ error: 'Validation failed', fields: errors }, { status: 400 })

  try {
    // Persist raw submission first (never lose data)
    const submission = await db.formSubmission.create({
      data: {
        form: 'CONTACT', name: name || 'Unknown',
        businessName: businessName || null, businessType: businessType || null,
        email: email || null, whatsapp: whatsapp || null, country: country || null,
        projectType: projectType || null, budgetRange: budgetRange || null,
        details, preferredContact: preferredContact || null,
        tracking: raw.tracking ? JSON.stringify(raw.tracking).slice(0, 2000) : null,
        ip, status: 'PROCESSING',
      },
    })

    // Analytics: lead event
    await db.trackingEvent.create({
      data: { name: 'lead', path: '/contact', consent: raw.consent === true, meta: JSON.stringify({ form: 'CONTACT', ip }) },
    }).catch(() => null)

    // Build the message for AI intake
    const message = [
      `New website contact form submission:`,
      `Name: ${name}`,
      businessName && `Business: ${businessName}`,
      businessType && `Business type: ${businessType}`,
      email && `Email: ${email}`,
      whatsapp && `WhatsApp: ${whatsapp}`,
      country && `Country: ${country}`,
      projectType && `Project type: ${projectType}`,
      budgetRange && `Budget: ${budgetRange}`,
      preferredContact && `Preferred contact: ${preferredContact}`,
      `Project details: ${details}`,
    ].filter(Boolean).join('\n')

    // Real journey: client id, lead record, AI business detection, welcome comms
    const result = await intakeLead({
      source: 'WEBSITE',
      name, businessName, businessType, email, whatsapp: whatsapp || undefined,
      country, message, projectType, budgetRange, preferredContact,
      tracking: raw.tracking, formId: submission.id,
    })

    await audit({ actor: 'public:form', action: 'CONTACT_FORM_SUBMITTED', clientId: result.clientId, ip, details: { formId: submission.id } })

    return Response.json({
      ok: true,
      clientId: result.clientId,
      message: `Thank you ${name}. Your request has been registered under reference ${result.clientId}. Our team is reviewing your requirements and will contact you within one business day. Keep your reference ID for all future communication.`,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error'
    await logError({ source: 'API', code: 'CONTACT_FAILED', message: msg, workflow: 'CONTACT' })
    return Response.json({ error: 'We could not process your submission right now. Please message us directly on WhatsApp.' }, { status: 500 })
  }
}
