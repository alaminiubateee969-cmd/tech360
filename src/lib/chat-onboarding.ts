import { db } from '@/lib/db'
import { intakeLead } from '@/lib/journey'
import { CONTACT_CONSENT_VERSION } from '@/lib/contact-policy'
import { audit } from '@/lib/security'
import { sanitizeEmail } from '@/lib/security'
import { redactSensitiveCrmData } from '@/lib/sensitive-redaction'

/** Extract first email address from free-text; used for the email-gated Client ID flow. */
export function extractEmail(text: string): string | null {
  const m = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)
  if (!m) return null
  const candidate = m[0].trim()
  return sanitizeEmail(candidate) ? candidate.trim() : null
}

/** Canonical first-contact prompt — the webchat agent's first SMS asks for email before issuing Client ID. */
export const EMAIL_GATE_PROMPT =
  'Thanks for reaching out to TECH360. To create your Client ID and keep your project securely on file, please share your email address. Once we have your email, your Client ID will be generated automatically and we will continue on your preferred channel.'

export type ChatOnboardingResult = {
  clientRowId: string | null
  displayClientId: string | null
  identityReviewRequired: boolean
  emailRequired?: boolean
  emailDeliveryStatus: string | null
  contactDeliveryStatus: { channel: string; status: string; ok: boolean } | null
}

function formIdForConversation(conversationId: string): string {
  return `chat_${conversationId}`
}

function isUniqueConflict(error: unknown): boolean {
  return Boolean(
    error &&
      typeof error === 'object' &&
      'code' in error &&
      (error as { code?: unknown }).code === 'P2002',
  )
}

/**
 * Attach a website chat to a CRM record without treating a typed email as
 * proof of ownership. Reuse only the same browser's prior conversation; if
 * the address already belongs to another CRM row, leave the conversation
 * unlinked for a verified/manual resolution instead of exposing that record
 * or creating a duplicate customer.
 */
export async function ensureChatClient(input: {
  conversationId: string
  anonId: string
  name: string
  email: string | null
  phone?: string
  preferredContact?: string
  firstMessage: string
  contactConsentAt: Date
}): Promise<ChatOnboardingResult> {
  // Gate: no Client ID is issued until we have a valid email address.
  // The webchat agent's first SMS asks for email; after the visitor replies with email we auto-create the Client.
  let effectiveEmail = input.email?.trim() ?? null
  if (!effectiveEmail || !sanitizeEmail(effectiveEmail)) {
    const extracted = input.firstMessage ? extractEmail(input.firstMessage) : null
    if (extracted) effectiveEmail = extracted
  }
  const cleanFirstMessage = redactSensitiveCrmData(input.firstMessage).text
  if (!effectiveEmail || !sanitizeEmail(effectiveEmail)) {
    // Keep a pending FormSubmission so a later message with email can be claimed atomically via the same formId,
    // but do NOT create a Client yet.
    const formId = formIdForConversation(input.conversationId)
    const pendingDetails = `Website chat (awaiting email): ${cleanFirstMessage.slice(0, 1500)}`
    await db.formSubmission.upsert({
      where: { id: formId },
      create: {
        id: formId,
        form: 'CHAT',
        name: input.name || 'Website Visitor',
        email: input.email,
        phone: input.phone,
        details: pendingDetails,
        preferredContact: input.preferredContact || 'Email',
        contactConsentAt: input.contactConsentAt,
        consentVersion: CONTACT_CONSENT_VERSION,
        tracking: JSON.stringify({ source: 'WEB_CHAT', consentVersion: CONTACT_CONSENT_VERSION, pendingEmail: true }),
        status: 'NEW',
      },
      update: {
        name: input.name || 'Website Visitor',
        ...(input.phone ? { phone: input.phone } : {}),
        details: pendingDetails,
      },
    }).catch(() => null)
    return { clientRowId: null, displayClientId: null, identityReviewRequired: false, emailRequired: true, emailDeliveryStatus: null, contactDeliveryStatus: null }
  }
  // Normalize to extracted/clean email when it came from free-text.
  input.email = sanitizeEmail(effectiveEmail) ?? effectiveEmail

  const priorConversation = await db.chatConversation.findFirst({
    where: {
      anonId: input.anonId,
      clientId: { not: null },
      contactConsentAt: { not: null },
      id: { not: input.conversationId },
    },
    orderBy: { createdAt: 'desc' },
    select: { clientId: true },
  })
  if (priorConversation?.clientId) {
    const client = await db.client.findUnique({
      where: { id: priorConversation.clientId },
      select: { id: true, clientId: true, deletedAt: true },
    })
    if (client && !client.deletedAt) {
      return { clientRowId: client.id, displayClientId: client.clientId, identityReviewRequired: false, emailDeliveryStatus: null, contactDeliveryStatus: null }
    }
  }

  const formId = formIdForConversation(input.conversationId)
  const details = `Website chat: ${cleanFirstMessage.slice(0, 1500)}`

  // The stable form id lets intakeLead atomically claim this onboarding attempt
  // and recover its existing Client ID after a retry without creating another.
  await db.formSubmission.upsert({
    where: { id: formId },
    create: {
      id: formId,
      form: 'CHAT',
      name: input.name || 'Website Visitor',
      email: input.email,
      phone: input.phone,
      details,
      preferredContact: input.preferredContact || 'Email',
      contactConsentAt: input.contactConsentAt,
      consentVersion: CONTACT_CONSENT_VERSION,
      tracking: JSON.stringify({ source: 'WEB_CHAT', consentVersion: CONTACT_CONSENT_VERSION }),
      status: 'NEW',
    },
    update: {
      name: input.name || 'Website Visitor',
      email: input.email,
      ...(input.phone ? { phone: input.phone } : {}),
      details,
    },
  })

  const existingEmailOwner = input.email
    ? await db.client.findFirst({
        where: { email: input.email, deletedAt: null },
        select: { id: true },
      })
    : null
  if (existingEmailOwner) {
    const reviewTransition = await db.formSubmission.updateMany({
      where: { id: formId, status: { not: 'PENDING_REVIEW' } },
      data: {
        status: 'PENDING_REVIEW',
        tracking: JSON.stringify({
          source: 'WEB_CHAT',
          consentVersion: CONTACT_CONSENT_VERSION,
          identityReviewRequired: true,
        }),
      },
    })
    if (reviewTransition.count > 0) {
      await Promise.all([
        audit({ actor: 'public:web-chat', action: 'CHAT_IDENTITY_REVIEW_REQUIRED', details: { conversationId: input.conversationId, formId } }).catch(() => null),
        db.notification.create({
          data: {
            type: 'IDENTITY_REVIEW',
            title: 'Web chat requires identity review',
            body: `Conversation ${input.conversationId} is saved without a Client link; verify ownership before linking.`,
            severity: 'WARNING',
          },
        }).catch(() => null),
      ])
    }
    return { clientRowId: null, displayClientId: null, identityReviewRequired: true, emailDeliveryStatus: null, contactDeliveryStatus: null }
  }

  try {
    const result = await intakeLead({
      source: 'WEBSITE',
      name: input.name || 'Website Visitor',
      email: input.email || undefined,
      phone: input.phone || undefined,
      preferredContact: input.preferredContact || 'Email',
      contactConsent: true,
      message: details,
      tracking: { source: 'WEB_CHAT', consentVersion: CONTACT_CONSENT_VERSION },
      formId,
    })
    return {
      clientRowId: result.clientRowId,
      displayClientId: result.clientId,
      identityReviewRequired: false,
      emailDeliveryStatus: result.welcome?.deliveries.find((delivery) => delivery.channel === 'EMAIL')?.status ?? null,
      contactDeliveryStatus: result.welcome?.deliveries.find((delivery) => delivery.channel.toLowerCase() === (input.preferredContact || 'Email').toLowerCase()) ?? null,
    }
  } catch (error) {
    // Recover a Client already attached to this form if a later pipeline step
    // failed. Do not create another Client or replay the welcome message.
    const submission = await db.formSubmission.findUnique({
      where: { id: formId },
      select: { clientId: true },
    }).catch(() => null)
    if (submission?.clientId) {
      const client = await db.client.findUnique({
        where: { id: submission.clientId },
        select: { id: true, clientId: true, deletedAt: true },
      }).catch(() => null)
      if (client && !client.deletedAt) {
        return { clientRowId: client.id, displayClientId: client.clientId, identityReviewRequired: false, emailDeliveryStatus: null, contactDeliveryStatus: null }
      }
    }

    // If two requests raced on this deterministic form, recover only after the
    // winning intake has committed its Client link. Otherwise leave it pending
    // for an operator/retry rather than manufacturing a second CRM identity.
    if (isUniqueConflict(error)) {
      const retry = await db.formSubmission.findUnique({
        where: { id: formId },
        select: { clientId: true },
      }).catch(() => null)
      if (retry?.clientId) {
        const client = await db.client.findUnique({
          where: { id: retry.clientId },
          select: { id: true, clientId: true, deletedAt: true },
        }).catch(() => null)
        if (client && !client.deletedAt) {
          return { clientRowId: client.id, displayClientId: client.clientId, identityReviewRequired: false, emailDeliveryStatus: null, contactDeliveryStatus: null }
        }
      }
    }
    return { clientRowId: null, displayClientId: null, identityReviewRequired: false, emailDeliveryStatus: null, contactDeliveryStatus: null }
  }
}
