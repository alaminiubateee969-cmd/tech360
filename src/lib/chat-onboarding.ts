import { db } from '@/lib/db'
import { intakeLead } from '@/lib/journey'
import { CONTACT_CONSENT_VERSION } from '@/lib/contact-policy'
import { audit } from '@/lib/security'
import { sanitizeEmail } from '@/lib/security'
import { redactSensitiveCrmData } from '@/lib/sensitive-redaction'

/** Extract the first email address from free text (unverified contact data only). */
export function extractEmail(text: string): string | null {
  const m = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)
  if (!m) return null
  const candidate = m[0].trim()
  return sanitizeEmail(candidate) ? candidate.trim() : null
}

/**
 * Optional contact-detail invitation. A Client ID no longer depends on email,
 * so this is never used as a gate; it is kept for flows that explicitly want
 * to ask for an address before sending a document.
 */
export const EMAIL_GATE_PROMPT =
  'Thanks for reaching out to TECH360. To keep formal documents (proposal, scope of work, invoices) securely on file, please share the best email address for service updates. Your Client ID is already created and this conversation is saved.'

export type ChatOnboardingResult = {
  clientRowId: string | null
  displayClientId: string | null
  identityReviewRequired: boolean
  /**
   * Kept for API compatibility. Anonymous web chat no longer gates the
   * conversation on an email address: a prospect Client ID is issued at
   * first contact (see ensureChatClient) and the assistant asks for contact
   * details naturally during the conversation.
   */
  emailRequired?: boolean
  /** True when a usable (still unverified) email is on file for follow-up. */
  contactEmailOnFile?: boolean
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

  // ---------------------------------------------------------------------
  // Root cause fixed here (anonymous web chat was dead on arrival):
  // this function used to REFUSE to issue a Client ID until the visitor had
  // typed an email address. Every caller then skipped the AI orchestrator
  // because the conversation had no clientId, so a first-time visitor got a
  // static "please share your email" reply and never a real answer -- on a
  // site that advertises live support chat. The chat/session route also
  // required email or phone before the first message could be sent.
  //
  // New behaviour (safe by default):
  // 1. A consented first contact always creates (or reuses) a prospect CRM
  //    record with a permanent Client ID, whether or not contact details were
  //    supplied. Prospect creation is idempotent per chat conversation through
  //    the deterministic form id, so retries cannot create duplicates.
  // 2. A typed email remains UNVERIFIED contact data. It is stored on the
  //    client only when no other live CRM row already owns that address.
  // 3. When another CRM row owns the address, no data is linked or exposed:
  //    the prospect is created WITHOUT the address and an identity-review
  //    notification is raised for an admin merge.
  // 4. Verified-identity matching (ClientIdentity) is unchanged and is still
  //    the only path that merges a channel into an existing customer.
  // ---------------------------------------------------------------------
  let effectiveEmail = sanitizeEmail(input.email?.trim() ?? '') ?? null
  if (!effectiveEmail && input.firstMessage) {
    const extracted = extractEmail(input.firstMessage)
    if (extracted) effectiveEmail = sanitizeEmail(extracted) ?? null
  }
  const cleanFirstMessage = redactSensitiveCrmData(input.firstMessage).text

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
      return {
        clientRowId: client.id,
        displayClientId: client.clientId,
        identityReviewRequired: false,
        contactEmailOnFile: false,
        emailDeliveryStatus: null,
        contactDeliveryStatus: null,
      }
    }
  }

  const formId = formIdForConversation(input.conversationId)
  const details = `Website chat: ${cleanFirstMessage.slice(0, 1500)}`

  // An address that already belongs to another live CRM row is not proof of
  // ownership. Do not copy it onto the new prospect and do not link the rows.
  const existingEmailOwner = effectiveEmail
    ? await db.client.findFirst({
        where: { email: effectiveEmail, deletedAt: null },
        select: { id: true },
      })
    : null
  const identityReviewRequired = Boolean(existingEmailOwner)
  const clientEmail = identityReviewRequired ? null : effectiveEmail

  // The stable form id lets intakeLead atomically claim this onboarding attempt
  // and recover its existing Client ID after a retry without creating another.
  await db.formSubmission.upsert({
    where: { id: formId },
    create: {
      id: formId,
      form: 'CHAT',
      name: input.name || 'Website Visitor',
      email: effectiveEmail ?? input.email,
      phone: input.phone,
      details,
      preferredContact: input.preferredContact || 'CHAT',
      contactConsentAt: input.contactConsentAt,
      consentVersion: CONTACT_CONSENT_VERSION,
      tracking: JSON.stringify({
        source: 'WEB_CHAT',
        consentVersion: CONTACT_CONSENT_VERSION,
        identityReviewRequired,
      }),
      status: 'NEW',
    },
    update: {
      name: input.name || 'Website Visitor',
      email: effectiveEmail ?? input.email,
      ...(input.phone ? { phone: input.phone } : {}),
      details,
    },
  }).catch(() => null)

  if (identityReviewRequired) {
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
            title: 'Web chat prospect needs identity review',
            body: `Conversation ${input.conversationId} supplied an email already on file for another client. A separate prospect was created so the conversation could continue; verify ownership before linking or merging.`,
            severity: 'WARNING',
          },
        }).catch(() => null),
      ])
    }
  }

  try {
    const result = await intakeLead({
      source: 'WEBSITE',
      name: input.name || 'Website Visitor',
      email: clientEmail || undefined,
      phone: input.phone || undefined,
      preferredContact: input.preferredContact || 'CHAT',
      contactConsent: true,
      message: details,
      tracking: {
        source: 'WEB_CHAT',
        consentVersion: CONTACT_CONSENT_VERSION,
        identityReviewRequired,
      },
      formId,
    })
    return {
      clientRowId: result.clientRowId,
      displayClientId: result.clientId,
      identityReviewRequired,
      contactEmailOnFile: Boolean(clientEmail),
      emailDeliveryStatus: result.welcome?.deliveries.find((delivery) => delivery.channel === 'EMAIL')?.status ?? null,
      contactDeliveryStatus:
        result.welcome?.deliveries.find(
          (delivery) => delivery.channel.toLowerCase() === (input.preferredContact || '').toLowerCase(),
        ) ?? null,
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
        return {
          clientRowId: client.id,
          displayClientId: client.clientId,
          identityReviewRequired,
          contactEmailOnFile: Boolean(clientEmail),
          emailDeliveryStatus: null,
          contactDeliveryStatus: null,
        }
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
          return {
            clientRowId: client.id,
            displayClientId: client.clientId,
            identityReviewRequired,
            contactEmailOnFile: Boolean(clientEmail),
            emailDeliveryStatus: null,
            contactDeliveryStatus: null,
          }
        }
      }
    }
    return {
      clientRowId: null,
      displayClientId: null,
      identityReviewRequired: false,
      contactEmailOnFile: false,
      emailDeliveryStatus: null,
      contactDeliveryStatus: null,
    }
  }
}
