// ============================================================
// TECH360 — the client communication pipeline: the exact copy.
//
// This module is the SINGLE SOURCE OF TRUTH for every message the
// AI agent sends to a client between the first SMS and the final
// project delivery.
//
// WHY A MODULE AND NOT STRINGS IN THE JOURNEY
// ----------------------------------------------
// The copy is a product decision, and a product decision that lives
// in eleven different code paths will drift. Every message here is a
// pure function of its variables, so the copy can be reviewed,
// diffed, and tested without a database.
//
// The WhatsApp/SMS body and the email body are BOTH produced here,
// because the specification gives different wording for each. They
// are not two copies of one string — they are two different
// messages, and both are exact.
//
// NO PHONE NUMBER
// ----------------
// The specification is explicit: "AI AGENT NOT MENTION ANY NUMBER
// AT WEBSITED". The copy below therefore contains no phone number,
// and `assertNoPhoneNumber()` in `./rules` enforces it on every
// message this module produces.
// ============================================================

import { escapeHtml } from '@/lib/comms'
import { COMPANY } from '@/lib/constants'

// ------------------------------------------------------------
// The stage keys
// ------------------------------------------------------------

export const PIPELINE_MESSAGE_STAGES = [
  'FIRST_MESSAGE',
  'BUSINESS_TYPE_RECEIVED',
  'SCOPE_DETAILS_RECEIVED',
  'FINAL_SCOPE_APPROVED',
  'MEETING_REQUESTED',
  'SCOPE_APPROVED',
  'HTML_PREVIEW_SENT',
  'REVISION_REQUESTED',
  'HTML_PREVIEW_APPROVED',
  'PAYMENT_RECEIVED',
  'FINAL_DELIVERY_READY',
  'FINAL_DELIVERY_COMPLETED',
  'PROJECT_CLOSED',
] as const

export type PipelineMessageStage = (typeof PIPELINE_MESSAGE_STAGES)[number]

/** Every channel the pipeline can address. SMS reuses the WhatsApp copy
 *  shape but with shorter bodies; WEB is conversational chat copy; the
 *  social channels are short, platform-appropriate variants. */
export type PipelineChannelKind =
  | 'WHATSAPP'
  | 'SMS'
  | 'EMAIL'
  | 'WEB'
  | 'FACEBOOK'
  | 'INSTAGRAM'
  | 'LINKEDIN'
  | 'X'
  | 'MESSENGER'

export const PIPELINE_CHANNELS: readonly PipelineChannelKind[] = [
  'WHATSAPP',
  'SMS',
  'EMAIL',
  'WEB',
  'FACEBOOK',
  'INSTAGRAM',
  'LINKEDIN',
  'X',
  'MESSENGER',
] as const

export type PipelineMessage = {
  stage: PipelineMessageStage
  /** The channel this copy is for. */
  channel: PipelineChannelKind
  /** The email subject. Absent for non-email channels. */
  subject?: string
  /** The exact body text. */
  body: string
  /** The HTML body, for the email channel. */
  html?: string
}

export type PipelineVariables = {
  clientId: string
  clientName: string
  businessName?: string | null
  businessType?: string | null
  recommendedPlan?: string | null
  meetingLink?: string | null
  projectName?: string | null
  inquirySummary?: string | null
  finalScope?: string | null
  paymentPolicy?: string | null
  htmlPreviewUrl?: string | null
  deliveryDate?: string | null
}

// ------------------------------------------------------------
// The company block that appears at the end of a formal email
// ------------------------------------------------------------

const COMPANY_BLOCK = [
  'Best regards,',
  'Tech360 Team',
  'Website: [https://bdtech360.com](https://bdtech360.com)',
  'Email: [info@bdtech360.com](mailto:info@bdtech360.com)',
].join('\n')

// ------------------------------------------------------------
// STAGE 1 — first SMS / first message received
// ------------------------------------------------------------

export function firstMessageWhatsApp(v: PipelineVariables): PipelineMessage {
  return {
    stage: 'FIRST_MESSAGE',
    channel: 'WHATSAPP',
    body: `Hi, thank you for contacting Tech360.

Your inquiry has been received and your Client ID is:

${v.clientId}

Tech360 helps business owners build websites, eCommerce systems, CRM software, ERP, WhatsApp automation, n8n workflows, AI systems, dashboards, and business automation.

To suggest the right solution, please reply with:

1. Your business type
2. Business name
3. What problem do you want to solve?
4. Do you need website, CRM, eCommerce, automation, or full system?
5. Existing website or Facebook page link, if available
6. Expected launch timeline

After receiving this, our AI system will prepare your recommended plan.`,
  }
}

export function firstMessageEmail(v: PipelineVariables): PipelineMessage {
  const portalUrl = `${COMPANY.url}/#/portal`
  const inquirySummary = v.inquirySummary?.trim().slice(0, 1200) || 'Your enquiry has been received. We will confirm any additional details with you.'
  const greeting = ['UNKNOWN CONTACT', 'WEBSITE VISITOR'].includes(v.clientName.trim().toUpperCase())
    ? 'Hello,'
    : `Dear ${v.clientName},`
  const body = `${greeting}

Welcome to TECH360. Your enquiry has been registered under Client ID ${v.clientId}.

Your enquiry summary:
${inquirySummary}

We use the email address you provided to identify this enquiry and send service-related updates about your requested project. Marketing messages require a separate opt-in. This address is not marked verified until you complete an email one-time code during portal sign-in.

Next steps: our team will review the requirements, ask any necessary follow-up questions, and prepare a written scope for your review. If an HTML Preview is included, its review and the payment schedule will follow the approved Scope of Work and project-specific terms.

You can access the customer portal here: [Open the customer portal](${portalUrl}). Sign-in requires your Client ID and a one-time code sent to a contact on your record.

No payment is due before the applicable preview approval. Any payment step follows the approved Scope of Work and an admin-reviewed instruction; an HTML/demo preview is shared for review before final source-code handover.

For your security, never email passwords, API keys, online banking credentials, or payment-card security codes.

${COMPANY_BLOCK}`
  return {
    stage: 'FIRST_MESSAGE',
    channel: 'EMAIL',
    subject: `Welcome to TECH360 — Your Client ID and Next Steps`,
    body,
    html: renderEmailBody(body),
  }
}

// ------------------------------------------------------------
// STAGE 2 — business type received
// ------------------------------------------------------------

export function businessTypeWhatsApp(v: PipelineVariables): PipelineMessage {
  return {
    stage: 'BUSINESS_TYPE_RECEIVED',
    channel: 'WHATSAPP',
    body: `Thank you for sharing your business type.

Client ID:
${v.clientId}

Business Type:
${v.businessType ?? 'not recorded'}

Based on your business, Tech360 recommends:

${v.recommendedPlan ?? 'a solution plan will be prepared for you'}

To prepare your Scope of Work, please send:

1. Required features
2. Number of staff/users
3. Do you need website, CRM, eCommerce, automation, or full system?
4. Do you need WhatsApp automation?
5. Do you need payment gateway?
6. Do you have logo, content, domain, or hosting?
7. Any reference website/system you like
8. Expected timeline

After receiving these details, Tech360 will prepare your Scope of Work.`,
  }
}

export function businessTypeEmail(v: PipelineVariables): PipelineMessage {
  const body = `Dear ${v.clientName},

Thank you for sharing your business type.

Client ID:
${v.clientId}

Business Type:
${v.businessType ?? 'not recorded'}

Based on your business, Tech360 recommends the following digital solution:

${v.recommendedPlan ?? 'a solution plan will be prepared for you'}

To prepare your Scope of Work, please share:

1. Required features
2. Number of staff/users
3. Required system type
4. WhatsApp automation requirement
5. Payment gateway requirement
6. Logo/content/domain/hosting availability
7. Reference website or system
8. Expected timeline

After receiving these details, Tech360 will prepare a clear Scope of Work and project plan.

${COMPANY_BLOCK}`
  return {
    stage: 'BUSINESS_TYPE_RECEIVED',
    channel: 'EMAIL',
    subject: `Recommended Digital Plan for ${v.businessType ?? 'your business'} - Tech360 Client ID ${v.clientId}`,
    body,
    html: renderEmailBody(body),
  }
}

// ------------------------------------------------------------
// STAGE 3 — scope details received
// ------------------------------------------------------------

export function scopeDetailsWhatsApp(v: PipelineVariables): PipelineMessage {
  return {
    stage: 'SCOPE_DETAILS_RECEIVED',
    channel: 'WHATSAPP',
    body: `Thank you for sending your project details.

Your requirements have been saved under Client ID:

${v.clientId}

Tech360 will now review your requirements and prepare a Scope of Work including:

✅ Confirmed features
✅ Recommended updates
✅ Timeline
✅ Client responsibilities
✅ Payment policy
✅ HTML preview process
✅ Final source-code handover process

Our team will review the draft before sending the final Scope of Work.`,
  }
}

export function scopeDetailsEmail(v: PipelineVariables): PipelineMessage {
  const body = `Dear ${v.clientName},

Thank you for sharing your project details.

Your requirements have been received and saved under Client ID:

${v.clientId}

Tech360 will now review your requirements and prepare a Scope of Work covering:

1. Project objective
2. Confirmed features
3. Recommended updates
4. Excluded items
5. Timeline
6. Client responsibilities
7. Payment policy
8. HTML preview process
9. Final source-code handover process

Please note that the final Scope of Work will be sent after internal review.

Best regards,
Tech360 Team`
  return {
    stage: 'SCOPE_DETAILS_RECEIVED',
    channel: 'EMAIL',
    subject: `Project Details Received - Scope Review Started - Client ID ${v.clientId}`,
    body,
    html: renderEmailBody(body),
  }
}

// ------------------------------------------------------------
// STAGE 4 — final scope approved by admin
// ------------------------------------------------------------

export function finalScopeWhatsApp(v: PipelineVariables): PipelineMessage {
  return {
    stage: 'FINAL_SCOPE_APPROVED',
    channel: 'WHATSAPP',
    body: `Your final Scope of Work is ready.

Client ID:
${v.clientId}

Please review the Scope of Work carefully.

If everything is clear, reply:

I approve the Scope of Work.

If you need explanation, you can book an online meeting here:

${v.meetingLink ?? 'a meeting link will be shared shortly'}

Important:
An HTML Preview is supplied where included in the agreed process. Its review and the project payment schedule follow the approved Scope of Work.
Unless otherwise agreed in writing, final source-code handover takes place after all required project payments have been received and cleared.
Refund requests are reviewed under the Refund Policy, the project agreement, actual work and delivery, payment records, applicable law, and relevant payment-provider rules. Properly completed work is generally non-refundable merely because the Client changes their mind; non-waivable rights remain unaffected.`,
  }
}

export function finalScopeEmail(v: PipelineVariables): PipelineMessage {
  const body = `Dear ${v.clientName},

Your final Scope of Work is ready for review.

Client ID:
${v.clientId}

Project:
${v.projectName ?? 'your Tech360 project'}

Business Type:
${v.businessType ?? 'not recorded'}

Final Scope of Work:
${v.finalScope ?? 'the approved scope'}

Payment Policy:
${v.paymentPolicy ?? 'Preview where included in the agreed process · Project-specific payment schedule · Final source-code handover after required payments clear'}

HTML Preview Policy:
An HTML Preview is supplied for review where included in the agreed process. Approval applies to the visual design and elements shown, not automatically to backend functions or production integrations.

Final Delivery Policy:
After required outstanding project payments have been received and cleared, TECH360 delivers the source code, documentation, and Client-owned credentials specifically identified in the approved Scope of Work. Internal secrets and other Clients’ information are excluded.

Non-Refund Policy:
Refund requests are reviewed against the approved Scope of Work, agreement, work completed, delivery status, payment records, any reported defect or non-delivery, applicable law, and payment-provider rules. Completed and conforming work is generally non-refundable merely because the Client changes their mind; non-waivable rights remain unaffected.

If the scope is clear, please reply:

I approve the Scope of Work.

If you need clarification, you can book a meeting here:
${v.meetingLink ?? 'a meeting link will be shared shortly'}

Best regards,
Tech360 Team`
  return {
    stage: 'FINAL_SCOPE_APPROVED',
    channel: 'EMAIL',
    subject: `Final Scope of Work for Approval - Client ID ${v.clientId}`,
    body,
    html: renderEmailBody(body),
  }
}

// ------------------------------------------------------------
// STAGE 5A — client does not understand / meeting needed
// ------------------------------------------------------------

export function meetingWhatsApp(v: PipelineVariables): PipelineMessage {
  return {
    stage: 'MEETING_REQUESTED',
    channel: 'WHATSAPP',
    body: `No problem. If any part of the Scope of Work is unclear, you can book an online meeting with Tech360 before approval.

Client ID:
${v.clientId}

Meeting link:
${v.meetingLink ?? 'a meeting link will be shared shortly'}

In the meeting, we can explain:

• Project scope
• Included features
• Not included items
• Timeline
• Payment policy
• HTML preview process
• Final source-code handover`,
  }
}

export function meetingEmail(v: PipelineVariables): PipelineMessage {
  const body = `Dear ${v.clientName},

If any part of the Scope of Work is unclear, you can book an online meeting with Tech360 before approval.

Client ID:
${v.clientId}

Meeting link:
${v.meetingLink ?? 'a meeting link will be shared shortly'}

During the meeting, we can explain the project scope, included features, excluded items, timeline, payment policy, HTML preview process, and final source-code handover.

Best regards,
Tech360 Team`
  return {
    stage: 'MEETING_REQUESTED',
    channel: 'EMAIL',
    subject: `Meeting Link for Scope Explanation - Client ID ${v.clientId}`,
    body,
    html: renderEmailBody(body),
  }
}

// ------------------------------------------------------------
// STAGE 5B — client approves the scope
// ------------------------------------------------------------

export function scopeApprovedWhatsApp(v: PipelineVariables): PipelineMessage {
  return {
    stage: 'SCOPE_APPROVED',
    channel: 'WHATSAPP',
    body: `Thank you for approving the Scope of Work.

Your approval has been saved under Client ID:

${v.clientId}

Any HTML Preview included in the approved Scope of Work will be prepared for your review.

Please note:
The preview is for review of the visual design and elements shown; it does not establish that all backend features or production integrations are complete. Final source-code handover follows the agreed payment and handover terms.`,
  }
}

export function scopeApprovedEmail(v: PipelineVariables): PipelineMessage {
  const body = `Dear ${v.clientName},

Thank you for approving the Scope of Work.

Your approval has been saved under Client ID:

${v.clientId}

Any HTML Preview included in the approved Scope of Work will be prepared for your review.

Please note:
The preview covers the visual design and elements shown, not automatically all backend features or production integrations. Final source-code handover follows the agreed payment and handover terms.

Best regards,
Tech360 Team`
  return {
    stage: 'SCOPE_APPROVED',
    channel: 'EMAIL',
    subject: `Scope Approval Confirmed - Client ID ${v.clientId}`,
    body,
    html: renderEmailBody(body),
  }
}

// ------------------------------------------------------------
// STAGE 6 — HTML preview sent
// ------------------------------------------------------------

export function previewSentWhatsApp(v: PipelineVariables): PipelineMessage {
  return {
    stage: 'HTML_PREVIEW_SENT',
    channel: 'WHATSAPP',
    body: `Your HTML Preview is ready for review as provided in the agreed process.

Client ID:
${v.clientId}

Preview Link:
${v.htmlPreviewUrl ?? 'a preview link will be shared shortly'}

Please review and reply with one of the following:

1. Approved
2. Need revision
3. Need meeting

Important:
Preview approval records the design and visible elements reviewed; it does not waive legal rights. Refund requests are reviewed under the approved agreement, actual work and delivery, applicable law, and relevant payment-provider rules.`,
  }
}

export function previewSentEmail(v: PipelineVariables): PipelineMessage {
  const body = `Dear ${v.clientName},

Your HTML/demo preview is ready for review.

Client ID:
${v.clientId}

Preview Link:
${v.htmlPreviewUrl ?? 'a preview link will be shared shortly'}

Please review and confirm:

1. Approved
2. Need revision
3. Need meeting

Important:
The HTML Preview is provided where included in the agreed process and covers the elements shown. Unless otherwise agreed in writing, final source-code handover follows verification that all required outstanding project payments have cleared. Handover includes only the agreed deliverables and Client-owned credentials identified in the Scope of Work; internal secrets and other Clients’ information are excluded. Refund requests are reviewed under the applicable agreement, law, and provider rules; completed and conforming work is generally non-refundable merely because the Client changes their mind, subject to non-waivable rights.

Best regards,
Tech360 Team`
  return {
    stage: 'HTML_PREVIEW_SENT',
    channel: 'EMAIL',
    subject: `HTML Preview Ready for Review - Client ID ${v.clientId}`,
    body,
    html: renderEmailBody(body),
  }
}

// ------------------------------------------------------------
// STAGE 7A — client requests a revision
// ------------------------------------------------------------

export function revisionWhatsApp(v: PipelineVariables): PipelineMessage {
  return {
    stage: 'REVISION_REQUESTED',
    channel: 'WHATSAPP',
    body: `Thank you for your feedback.

Your revision request has been saved under Client ID:

${v.clientId}

Our team will review the requested changes and update you.`,
  }
}

export function revisionEmail(v: PipelineVariables): PipelineMessage {
  const body = `Dear ${v.clientName},

Thank you for your feedback.

Your revision request has been received and saved under Client ID:

${v.clientId}

Our team will review the requested changes and update you.

Best regards,
Tech360 Team`
  return {
    stage: 'REVISION_REQUESTED',
    channel: 'EMAIL',
    subject: `Revision Request Received - Client ID ${v.clientId}`,
    body,
    html: renderEmailBody(body),
  }
}

// ------------------------------------------------------------
// STAGE 7B — client approves the HTML preview
// ------------------------------------------------------------

export function previewApprovedWhatsApp(v: PipelineVariables): PipelineMessage {
  return {
    stage: 'HTML_PREVIEW_APPROVED',
    channel: 'WHATSAPP',
    body: `Thank you for approving the HTML/demo preview.

Your approval has been saved under Client ID:

${v.clientId}

The next step is payment confirmation.

After payment is completed, Tech360 will proceed with final development/delivery and source-code handover according to the approved Scope of Work.`,
  }
}

export function previewApprovedEmail(v: PipelineVariables): PipelineMessage {
  const body = `Dear ${v.clientName},

Thank you for approving the HTML/demo preview.

Your approval has been saved under Client ID:

${v.clientId}

The next step is payment confirmation based on the approved Scope of Work and payment policy.

After payment is completed, Tech360 will proceed with final development/delivery and source-code handover according to the approved scope.

Best regards,
Tech360 Team`
  return {
    stage: 'HTML_PREVIEW_APPROVED',
    channel: 'EMAIL',
    subject: `HTML Preview Approval Confirmed - Payment Step - Client ID ${v.clientId}`,
    body,
    html: renderEmailBody(body),
  }
}

// ------------------------------------------------------------
// STAGE 8 — payment received
// ------------------------------------------------------------

export function paymentReceivedWhatsApp(v: PipelineVariables): PipelineMessage {
  return {
    stage: 'PAYMENT_RECEIVED',
    channel: 'WHATSAPP',
    body: `Thank you. Your payment confirmation has been received.

Client ID:
${v.clientId}

Tech360 will now proceed with the final delivery process based on the approved Scope of Work.`,
  }
}

export function paymentReceivedEmail(v: PipelineVariables): PipelineMessage {
  const body = `Dear ${v.clientName},

Thank you. Your payment confirmation has been received.

Client ID:
${v.clientId}

Tech360 will now proceed with the final delivery process based on the approved Scope of Work.

Best regards,
Tech360 Team`
  return {
    stage: 'PAYMENT_RECEIVED',
    channel: 'EMAIL',
    subject: `Payment Confirmation Received - Client ID ${v.clientId}`,
    body,
    html: renderEmailBody(body),
  }
}

// ------------------------------------------------------------
// STAGE 9 — final delivery ready
// ------------------------------------------------------------

export function deliveryReadyWhatsApp(v: PipelineVariables): PipelineMessage {
  return {
    stage: 'FINAL_DELIVERY_READY',
    channel: 'WHATSAPP',
    body: `Your final project delivery is ready.

Client ID:
${v.clientId}

Delivery may include:

✅ Agreed website/system deliverables
✅ Source code where included in the approved scope
✅ Client-owned credentials identified in the scope, if applicable
✅ Deployment support and documentation, if included

Approved-scope delivery checklist:

✅ Final website/system files
✅ Source code
✅ Admin access, if included
✅ Deployment support, if included
✅ Basic handover documentation

Please review the delivery carefully and confirm after checking.`,
  }
}

export function deliveryReadyEmail(v: PipelineVariables): PipelineMessage {
  const body = `Dear ${v.clientName},

Your final project delivery is ready.

Client ID:
${v.clientId}

Your handover includes only the items agreed in the approved Scope of Work. Where applicable, this may include:

1. Agreed website/system deliverables
2. Source code identified in the scope
3. Client-owned credentials identified in the scope
4. Deployment support and documentation, if included

TECH360 internal secrets, shared infrastructure credentials, and other Clients’ information are excluded. Unless otherwise agreed in writing, handover follows verification that all required outstanding project payments have cleared.

Please review the delivery carefully and confirm after checking.

Best regards,
Tech360 Team`
  return {
    stage: 'FINAL_DELIVERY_READY',
    channel: 'EMAIL',
    subject: `Final Project Delivery Ready - Client ID ${v.clientId}`,
    body,
    html: renderEmailBody(body),
  }
}

// ------------------------------------------------------------
// STAGE 10 — final delivery completed, password change confirmation
// ------------------------------------------------------------

export const DELIVERY_CONFIRMATION_PHRASE =
  'I confirm that Tech360 has delivered/deployed the approved project as per the approved Scope of Work. I have reviewed the website/system and received the agreed delivery. I have changed or will change all related passwords. I understand that after password change, Tech360 will no longer have active access to my server/source-code environment.'

export function deliveryCompletedWhatsApp(v: PipelineVariables): PipelineMessage {
  return {
    stage: 'FINAL_DELIVERY_COMPLETED',
    channel: 'WHATSAPP',
    body: `Tech360 confirms that your approved project has been delivered/deployed as per the approved Scope of Work.

Client ID:
${v.clientId}

Please check your website/system and confirm:

✅ Project delivered/deployed
✅ Work matches approved Scope of Work
✅ Final files/source code/admin access received, if included
✅ You have changed or will change all related passwords

Please reply:

${DELIVERY_CONFIRMATION_PHRASE}`,
  }
}

export function deliveryCompletedEmail(v: PipelineVariables): PipelineMessage {
  const body = `Dear ${v.clientName},

Tech360 confirms that your approved project has been delivered/deployed as per the approved Scope of Work.

Client ID:
${v.clientId}

Please review your website/system and confirm:

1. The project has been delivered or deployed.
2. The work matches the approved Scope of Work.
3. You have received the agreed final files/source code/admin access, if included.
4. You have changed or will change all related server, hosting, admin, database, email, and API passwords.
5. You understand that after password change, Tech360 will no longer have active access to your server/source-code environment.

Please reply with:

“${DELIVERY_CONFIRMATION_PHRASE}”

Best regards,
Tech360 Team`
  return {
    stage: 'FINAL_DELIVERY_COMPLETED',
    channel: 'EMAIL',
    subject: `Final Delivery Completed - Confirmation Required - Client ID ${v.clientId}`,
    body,
    html: renderEmailBody(body),
  }
}

// ------------------------------------------------------------
// STAGE 11 — client confirms final delivery, project closed
// ------------------------------------------------------------

export function projectClosedWhatsApp(v: PipelineVariables): PipelineMessage {
  return {
    stage: 'PROJECT_CLOSED',
    channel: 'WHATSAPP',
    body: `Thank you for confirming the final delivery.

Your project has been marked as completed under Client ID:

${v.clientId}

If you are satisfied with Tech360’s service, we would appreciate a short review.

If you know any business owner, company, school, agency, hospital, or organization that needs website, software, CRM, eCommerce, automation, or technical support, you may recommend Tech360 to them.`,
  }
}

export function projectClosedEmail(v: PipelineVariables): PipelineMessage {
  const body = `Dear ${v.clientName},

Thank you for confirming the final delivery.

Your project has been marked as completed under Client ID:

${v.clientId}

If you are satisfied with Tech360’s service, we would appreciate a short review about your experience.

If you know any business owner, company, school, agency, hospital, or organization that needs website, software, CRM, eCommerce, automation, or technical support, you may recommend Tech360 to them.

Thank you for choosing Tech360.

${COMPANY_BLOCK}`
  return {
    stage: 'PROJECT_CLOSED',
    channel: 'EMAIL',
    subject: `Project Completed - Review Request - Client ID ${v.clientId}`,
    body,
    html: renderEmailBody(body),
  }
}

// ------------------------------------------------------------
// SMS variants — shorter versions of the WhatsApp copy.
// ------------------------------------------------------------

export function firstMessageSms(v: PipelineVariables): PipelineMessage {
  return {
    stage: 'FIRST_MESSAGE',
    channel: 'SMS',
    body: `Hi ${v.clientName}, thank you for contacting Tech360. Your Client ID is ${v.clientId}. Please reply with your business type, business name, and what you need (website, CRM, eCommerce, automation, or full system). We will prepare your recommended plan.`,
  }
}

export function businessTypeSms(v: PipelineVariables): PipelineMessage {
  return {
    stage: 'BUSINESS_TYPE_RECEIVED',
    channel: 'SMS',
    body: `Thank you (Client ID ${v.clientId}). Business type: ${v.businessType ?? 'not recorded'}. Recommended plan: ${v.recommendedPlan ?? 'a solution plan will be prepared'}. Please reply with: required features, number of users, integrations needed, assets you have, and your timeline.`,
  }
}

export function scopeDetailsSms(v: PipelineVariables): PipelineMessage {
  return {
    stage: 'SCOPE_DETAILS_RECEIVED',
    channel: 'SMS',
    body: `Thank you. Your requirements are saved under Client ID ${v.clientId}. Our team will review them and prepare a Scope of Work. The final scope is sent after internal review.`,
  }
}

export function finalScopeSms(v: PipelineVariables): PipelineMessage {
  return {
    stage: 'FINAL_SCOPE_APPROVED',
    channel: 'SMS',
    body: `Your final Scope of Work is ready (Client ID ${v.clientId}). Please review it. Reply "I approve the Scope of Work" to approve, or ask for a meeting: ${v.meetingLink ?? 'link to follow'}. HTML Preview is supplied where included. Source handover follows verified payment.`,
  }
}

export function meetingSms(v: PipelineVariables): PipelineMessage {
  return {
    stage: 'MEETING_REQUESTED',
    channel: 'SMS',
    body: `No problem (Client ID ${v.clientId}). Book a meeting to discuss the scope: ${v.meetingLink ?? 'link to follow'}. We will explain scope, features, timeline, payment policy, preview, and handover.`,
  }
}

export function scopeApprovedSms(v: PipelineVariables): PipelineMessage {
  return {
    stage: 'SCOPE_APPROVED',
    channel: 'SMS',
    body: `Thank you for approving the Scope of Work. Approval saved under Client ID ${v.clientId}. Any HTML Preview included will be prepared for your review.`,
  }
}

export function previewSentSms(v: PipelineVariables): PipelineMessage {
  return {
    stage: 'HTML_PREVIEW_SENT',
    channel: 'SMS',
    body: `Your HTML Preview is ready (Client ID ${v.clientId}): ${v.htmlPreviewUrl ?? 'link to follow'}. Please reply: Approved, Need revision, or Need meeting.`,
  }
}

export function revisionSms(v: PipelineVariables): PipelineMessage {
  return {
    stage: 'REVISION_REQUESTED',
    channel: 'SMS',
    body: `Thank you for your feedback. Your revision request is saved under Client ID ${v.clientId}. Our team will review the changes and update you.`,
  }
}

export function previewApprovedSms(v: PipelineVariables): PipelineMessage {
  return {
    stage: 'HTML_PREVIEW_APPROVED',
    channel: 'SMS',
    body: `Thank you for approving the preview. Approval saved under Client ID ${v.clientId}. Next step is payment confirmation, then final delivery per the approved scope.`,
  }
}

export function paymentReceivedSms(v: PipelineVariables): PipelineMessage {
  return {
    stage: 'PAYMENT_RECEIVED',
    channel: 'SMS',
    body: `Thank you. Payment confirmation received (Client ID ${v.clientId}). We will now proceed with final delivery per the approved scope.`,
  }
}

export function deliveryReadySms(v: PipelineVariables): PipelineMessage {
  return {
    stage: 'FINAL_DELIVERY_READY',
    channel: 'SMS',
    body: `Your final delivery is ready (Client ID ${v.clientId}). Please review the delivered items and confirm. Source handover follows verified payment.`,
  }
}

export function deliveryCompletedSms(v: PipelineVariables): PipelineMessage {
  return {
    stage: 'FINAL_DELIVERY_COMPLETED',
    channel: 'SMS',
    body: `Delivery completed (Client ID ${v.clientId}). Please confirm you received the agreed delivery and have changed your passwords. Reply with the confirmation phrase from your email or chat.`,
  }
}

export function projectClosedSms(v: PipelineVariables): PipelineMessage {
  return {
    stage: 'PROJECT_CLOSED',
    channel: 'SMS',
    body: `Thank you for confirming delivery. Your project is completed under Client ID ${v.clientId}. We appreciate a short review, and referrals are welcome.`,
  }
}

// ------------------------------------------------------------
// WebChat variants — conversational, chat-friendly copy.
// ------------------------------------------------------------

export function firstMessageWeb(v: PipelineVariables): PipelineMessage {
  return {
    stage: 'FIRST_MESSAGE',
    channel: 'WEB',
    body: `Hi ${v.clientName}, thanks for reaching out to TECH360. Your Client ID is ${v.clientId} — everything we discuss will be saved under it.\n\nTo recommend the right solution, could you share your business type and business name? And what are you hoping to build — a website, CRM, eCommerce, automation, or a full system?`,
  }
}

export function businessTypeWeb(v: PipelineVariables): PipelineMessage {
  return {
    stage: 'BUSINESS_TYPE_RECEIVED',
    channel: 'WEB',
    body: `Thanks for sharing that (Client ID ${v.clientId}). For ${v.businessType ?? 'your business'}, we'd recommend: ${v.recommendedPlan ?? 'a tailored solution plan'}.\n\nTo prepare your Scope of Work, could you tell me about the features you need, how many people will use it, any integrations, assets you already have, and your timeline? One thing at a time is fine.`,
  }
}

export function scopeDetailsWeb(v: PipelineVariables): PipelineMessage {
  return {
    stage: 'SCOPE_DETAILS_RECEIVED',
    channel: 'WEB',
    body: `Thanks — your requirements are saved under Client ID ${v.clientId}. Our team will review them and prepare a Scope of Work with confirmed features, timeline, and payment policy. The final scope is sent after internal review, so you can check everything before deciding.`,
  }
}

export function finalScopeWeb(v: PipelineVariables): PipelineMessage {
  return {
    stage: 'FINAL_SCOPE_APPROVED',
    channel: 'WEB',
    body: `Your final Scope of Work is ready for review (Client ID ${v.clientId}).\n\n${v.finalScope ?? 'The approved scope is attached to your client record.'}\n\nIf it looks right, just reply "I approve the Scope of Work". If anything is unclear, you can book a meeting here: ${v.meetingLink ?? 'a meeting link will be shared shortly'}.\n\nWhere included, you'll review an HTML Preview before payment, and source code is handed over after verified payment.`,
  }
}

export function meetingWeb(v: PipelineVariables): PipelineMessage {
  return {
    stage: 'MEETING_REQUESTED',
    channel: 'WEB',
    body: `Of course — happy to walk through it (Client ID ${v.clientId}). Book a time that suits you here: ${v.meetingLink ?? 'a meeting link will be shared shortly'}.\n\nWe can cover the scope, what's included and excluded, timeline, payment policy, preview, and handover.`,
  }
}

export function scopeApprovedWeb(v: PipelineVariables): PipelineMessage {
  return {
    stage: 'SCOPE_APPROVED',
    channel: 'WEB',
    body: `Thank you — your approval is saved under Client ID ${v.clientId}. Any HTML Preview included in your scope will be prepared for your review next.`,
  }
}

export function previewSentWeb(v: PipelineVariables): PipelineMessage {
  return {
    stage: 'HTML_PREVIEW_SENT',
    channel: 'WEB',
    body: `Your HTML Preview is ready (Client ID ${v.clientId}): ${v.htmlPreviewUrl ?? 'a preview link will be shared shortly'}.\n\nTake a look and let me know — Approved, Need revision, or Need meeting?`,
  }
}

export function revisionWeb(v: PipelineVariables): PipelineMessage {
  return {
    stage: 'REVISION_REQUESTED',
    channel: 'WEB',
    body: `Thanks for the feedback — your revision request is saved under Client ID ${v.clientId}. Our team will review the requested changes and update you here.`,
  }
}

export function previewApprovedWeb(v: PipelineVariables): PipelineMessage {
  return {
    stage: 'HTML_PREVIEW_APPROVED',
    channel: 'WEB',
    body: `Thank you for approving the preview — saved under Client ID ${v.clientId}. The next step is payment confirmation, then final delivery per your approved scope.`,
  }
}

export function paymentReceivedWeb(v: PipelineVariables): PipelineMessage {
  return {
    stage: 'PAYMENT_RECEIVED',
    channel: 'WEB',
    body: `Thank you — payment confirmation received (Client ID ${v.clientId}). We'll now proceed with final delivery per your approved scope.`,
  }
}

export function deliveryReadyWeb(v: PipelineVariables): PipelineMessage {
  return {
    stage: 'FINAL_DELIVERY_READY',
    channel: 'WEB',
    body: `Your final delivery is ready (Client ID ${v.clientId}). Please review the delivered items and confirm when you're happy. Source handover follows verified payment.`,
  }
}

export function deliveryCompletedWeb(v: PipelineVariables): PipelineMessage {
  return {
    stage: 'FINAL_DELIVERY_COMPLETED',
    channel: 'WEB',
    body: `Delivery is complete (Client ID ${v.clientId}). Please confirm you received the agreed delivery and have changed your passwords, so we can close the project.`,
  }
}

export function projectClosedWeb(v: PipelineVariables): PipelineMessage {
  return {
    stage: 'PROJECT_CLOSED',
    channel: 'WEB',
    body: `Thank you for confirming delivery — your project is completed under Client ID ${v.clientId}. If you're happy with our work, a short review would mean a lot. And if you know another business that could use our help, we'd appreciate the introduction.`,
  }
}

// ------------------------------------------------------------
// Social variants — short, platform-appropriate copy.
// ------------------------------------------------------------

function socialBody(stage: PipelineMessageStage, v: PipelineVariables, channel: PipelineChannelKind): string {
  const id = v.clientId
  const name = v.clientName
  switch (stage) {
    case 'FIRST_MESSAGE':
      return `Hi ${name}, thanks for contacting TECH360. Your Client ID is ${id}. Please share your business type and what you need (website, CRM, eCommerce, automation, or full system) and we'll prepare your plan.`
    case 'BUSINESS_TYPE_RECEIVED':
      return `Thanks ${name} (${id}). For ${v.businessType ?? 'your business'} we recommend: ${v.recommendedPlan ?? 'a tailored plan'}. Please share features, users, integrations, assets, and timeline so we can scope it.`
    case 'SCOPE_DETAILS_RECEIVED':
      return `Thanks ${name} — requirements saved under ${id}. Our team will prepare your Scope of Work for review.`
    case 'FINAL_SCOPE_APPROVED':
      return `Your final Scope of Work is ready (${id}). Please review and reply "I approve the Scope of Work" or book a meeting: ${v.meetingLink ?? 'link to follow'}.`
    case 'MEETING_REQUESTED':
      return `No problem, ${name} (${id}). Book a meeting here: ${v.meetingLink ?? 'link to follow'} — we'll explain scope, timeline, and payment policy.`
    case 'SCOPE_APPROVED':
      return `Thank you for approving the scope, ${name}. Approval saved under ${id}. Your HTML Preview will be prepared next.`
    case 'HTML_PREVIEW_SENT':
      return `Your HTML Preview is ready, ${name} (${id}): ${v.htmlPreviewUrl ?? 'link to follow'}. Please reply Approved, Need revision, or Need meeting.`
    case 'REVISION_REQUESTED':
      return `Thanks for the feedback, ${name}. Revision request saved under ${id} — our team will review and update you.`
    case 'HTML_PREVIEW_APPROVED':
      return `Thank you for approving the preview, ${name} (${id}). Next step is payment confirmation, then final delivery.`
    case 'PAYMENT_RECEIVED':
      return `Thank you, ${name}. Payment confirmation received (${id}). Proceeding to final delivery.`
    case 'FINAL_DELIVERY_READY':
      return `Your final delivery is ready, ${name} (${id}). Please review and confirm.`
    case 'FINAL_DELIVERY_COMPLETED':
      return `Delivery complete, ${name} (${id}). Please confirm receipt and password changes to close the project.`
    case 'PROJECT_CLOSED':
      return `Thank you, ${name}. Project completed under ${id}. We'd appreciate a short review.`
    default:
      return `Hi ${name}, update on your TECH360 project (${id}).`
  }
}

export function firstMessageSocial(v: PipelineVariables, channel: PipelineChannelKind): PipelineMessage {
  return { stage: 'FIRST_MESSAGE', channel, body: socialBody('FIRST_MESSAGE', v, channel) }
}
export function businessTypeSocial(v: PipelineVariables, channel: PipelineChannelKind): PipelineMessage {
  return { stage: 'BUSINESS_TYPE_RECEIVED', channel, body: socialBody('BUSINESS_TYPE_RECEIVED', v, channel) }
}
export function scopeDetailsSocial(v: PipelineVariables, channel: PipelineChannelKind): PipelineMessage {
  return { stage: 'SCOPE_DETAILS_RECEIVED', channel, body: socialBody('SCOPE_DETAILS_RECEIVED', v, channel) }
}
export function finalScopeSocial(v: PipelineVariables, channel: PipelineChannelKind): PipelineMessage {
  return { stage: 'FINAL_SCOPE_APPROVED', channel, body: socialBody('FINAL_SCOPE_APPROVED', v, channel) }
}
export function meetingSocial(v: PipelineVariables, channel: PipelineChannelKind): PipelineMessage {
  return { stage: 'MEETING_REQUESTED', channel, body: socialBody('MEETING_REQUESTED', v, channel) }
}
export function scopeApprovedSocial(v: PipelineVariables, channel: PipelineChannelKind): PipelineMessage {
  return { stage: 'SCOPE_APPROVED', channel, body: socialBody('SCOPE_APPROVED', v, channel) }
}
export function previewSentSocial(v: PipelineVariables, channel: PipelineChannelKind): PipelineMessage {
  return { stage: 'HTML_PREVIEW_SENT', channel, body: socialBody('HTML_PREVIEW_SENT', v, channel) }
}
export function revisionSocial(v: PipelineVariables, channel: PipelineChannelKind): PipelineMessage {
  return { stage: 'REVISION_REQUESTED', channel, body: socialBody('REVISION_REQUESTED', v, channel) }
}
export function previewApprovedSocial(v: PipelineVariables, channel: PipelineChannelKind): PipelineMessage {
  return { stage: 'HTML_PREVIEW_APPROVED', channel, body: socialBody('HTML_PREVIEW_APPROVED', v, channel) }
}
export function paymentReceivedSocial(v: PipelineVariables, channel: PipelineChannelKind): PipelineMessage {
  return { stage: 'PAYMENT_RECEIVED', channel, body: socialBody('PAYMENT_RECEIVED', v, channel) }
}
export function deliveryReadySocial(v: PipelineVariables, channel: PipelineChannelKind): PipelineMessage {
  return { stage: 'FINAL_DELIVERY_READY', channel, body: socialBody('FINAL_DELIVERY_READY', v, channel) }
}
export function deliveryCompletedSocial(v: PipelineVariables, channel: PipelineChannelKind): PipelineMessage {
  return { stage: 'FINAL_DELIVERY_COMPLETED', channel, body: socialBody('FINAL_DELIVERY_COMPLETED', v, channel) }
}
export function projectClosedSocial(v: PipelineVariables, channel: PipelineChannelKind): PipelineMessage {
  return { stage: 'PROJECT_CLOSED', channel, body: socialBody('PROJECT_CLOSED', v, channel) }
}

// ------------------------------------------------------------
// The registry
// ------------------------------------------------------------

/**
 * Every message the pipeline can send, by stage.
 *
 * `whatsapp` is the WhatsApp/SMS body — the same text is used for
 * both channels, because the specification gives one copy for
 * "WHATSAPP / SMS REPLY".
 */
export const PIPELINE_COPY: Record<
  PipelineMessageStage,
  {
    whatsapp: (v: PipelineVariables) => PipelineMessage
    email: (v: PipelineVariables) => PipelineMessage
    sms: (v: PipelineVariables) => PipelineMessage
    web: (v: PipelineVariables) => PipelineMessage
    social: (v: PipelineVariables, channel: PipelineChannelKind) => PipelineMessage
  }
> = {
  FIRST_MESSAGE: { whatsapp: firstMessageWhatsApp, email: firstMessageEmail, sms: firstMessageSms, web: firstMessageWeb, social: firstMessageSocial },
  BUSINESS_TYPE_RECEIVED: { whatsapp: businessTypeWhatsApp, email: businessTypeEmail, sms: businessTypeSms, web: businessTypeWeb, social: businessTypeSocial },
  SCOPE_DETAILS_RECEIVED: { whatsapp: scopeDetailsWhatsApp, email: scopeDetailsEmail, sms: scopeDetailsSms, web: scopeDetailsWeb, social: scopeDetailsSocial },
  FINAL_SCOPE_APPROVED: { whatsapp: finalScopeWhatsApp, email: finalScopeEmail, sms: finalScopeSms, web: finalScopeWeb, social: finalScopeSocial },
  MEETING_REQUESTED: { whatsapp: meetingWhatsApp, email: meetingEmail, sms: meetingSms, web: meetingWeb, social: meetingSocial },
  SCOPE_APPROVED: { whatsapp: scopeApprovedWhatsApp, email: scopeApprovedEmail, sms: scopeApprovedSms, web: scopeApprovedWeb, social: scopeApprovedSocial },
  HTML_PREVIEW_SENT: { whatsapp: previewSentWhatsApp, email: previewSentEmail, sms: previewSentSms, web: previewSentWeb, social: previewSentSocial },
  REVISION_REQUESTED: { whatsapp: revisionWhatsApp, email: revisionEmail, sms: revisionSms, web: revisionWeb, social: revisionSocial },
  HTML_PREVIEW_APPROVED: { whatsapp: previewApprovedWhatsApp, email: previewApprovedEmail, sms: previewApprovedSms, web: previewApprovedWeb, social: previewApprovedSocial },
  PAYMENT_RECEIVED: { whatsapp: paymentReceivedWhatsApp, email: paymentReceivedEmail, sms: paymentReceivedSms, web: paymentReceivedWeb, social: paymentReceivedSocial },
  FINAL_DELIVERY_READY: { whatsapp: deliveryReadyWhatsApp, email: deliveryReadyEmail, sms: deliveryReadySms, web: deliveryReadyWeb, social: deliveryReadySocial },
  FINAL_DELIVERY_COMPLETED: { whatsapp: deliveryCompletedWhatsApp, email: deliveryCompletedEmail, sms: deliveryCompletedSms, web: deliveryCompletedWeb, social: deliveryCompletedSocial },
  PROJECT_CLOSED: { whatsapp: projectClosedWhatsApp, email: projectClosedEmail, sms: projectClosedSms, web: projectClosedWeb, social: projectClosedSocial },
}

/** The message pair for a stage. */
export function pipelineMessage(stage: PipelineMessageStage, v: PipelineVariables): {
  whatsapp: PipelineMessage
  email: PipelineMessage
} {
  const copy = PIPELINE_COPY[stage]
  return { whatsapp: copy.whatsapp(v), email: copy.email(v) }
}

/** The message for one stage on one channel. Social channels share the
 *  short social copy with the channel recorded on the message. */
export function pipelineMessageForChannel(
  stage: PipelineMessageStage,
  channel: PipelineChannelKind,
  v: PipelineVariables,
): PipelineMessage {
  const copy = PIPELINE_COPY[stage]
  switch (channel) {
    case 'WHATSAPP':
      return copy.whatsapp(v)
    case 'EMAIL':
      return copy.email(v)
    case 'SMS':
      return copy.sms(v)
    case 'WEB':
      return copy.web(v)
    case 'FACEBOOK':
    case 'INSTAGRAM':
    case 'LINKEDIN':
    case 'X':
    case 'MESSENGER':
      return copy.social(v, channel)
  }
}

// ------------------------------------------------------------
// Placeholder validation — every required variable must be present
// before a message is sent. Placeholders follow the master spec:
// [CLIENT_ID] [CLIENT_NAME] [BUSINESS_NAME] [BUSINESS_TYPE]
// [PROJECT_NAME] [RECOMMENDED_PLAN] [FINAL_SCOPE] [MEETING_LINK]
// [HTML_PREVIEW_URL]
// ------------------------------------------------------------

/** Variables required before a stage message may be sent. */
export const REQUIRED_VARIABLES_BY_STAGE: Record<PipelineMessageStage, readonly (keyof PipelineVariables)[]> = {
  FIRST_MESSAGE: ['clientId', 'clientName'],
  BUSINESS_TYPE_RECEIVED: ['clientId', 'clientName', 'businessType', 'recommendedPlan'],
  SCOPE_DETAILS_RECEIVED: ['clientId', 'clientName'],
  FINAL_SCOPE_APPROVED: ['clientId', 'clientName', 'finalScope'],
  MEETING_REQUESTED: ['clientId', 'clientName', 'meetingLink'],
  SCOPE_APPROVED: ['clientId', 'clientName'],
  HTML_PREVIEW_SENT: ['clientId', 'clientName', 'htmlPreviewUrl'],
  REVISION_REQUESTED: ['clientId', 'clientName'],
  HTML_PREVIEW_APPROVED: ['clientId', 'clientName'],
  PAYMENT_RECEIVED: ['clientId', 'clientName'],
  FINAL_DELIVERY_READY: ['clientId', 'clientName'],
  FINAL_DELIVERY_COMPLETED: ['clientId', 'clientName'],
  PROJECT_CLOSED: ['clientId', 'clientName'],
} as const

export type PlaceholderValidation = {
  ok: boolean
  /** Variable keys that are missing or empty for this stage. */
  missing: string[]
}

/** Validate that every required placeholder for a stage is filled.
 *  Never throws — callers must refuse to send when `ok` is false. */
export function validatePipelineVariables(stage: PipelineMessageStage, v: PipelineVariables): PlaceholderValidation {
  const required = REQUIRED_VARIABLES_BY_STAGE[stage] ?? []
  const missing = required.filter((key) => {
    const value = v[key]
    return value === null || value === undefined || String(value).trim().length === 0
  })
  return { ok: missing.length === 0, missing }
}

// ------------------------------------------------------------
// Plain text → email HTML
// ------------------------------------------------------------

/**
 * Convert the plain-text email body into HTML.
 *
 * The text is escaped FIRST, so a client name or a plan can never
 * inject markup. Then the two markdown forms the copy uses are
 * converted: `**bold**` and `[label](url)`. A link is only rendered
 * when its scheme is http, https or mailto — a `javascript:` URL is
 * left as plain text.
 */
export function renderEmailBody(text: string): string {
  const escaped = escapeHtml(text)
  const withLinks = escaped.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (match, label: string, url: string) => {
    if (!/^(https?:\/\/|mailto:)/i.test(url)) return match
    return `<a href="${url}" style="color:#009FE3;text-decoration:underline;">${label}</a>`
  })
  const withBold = withLinks.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')

  return withBold
    .split(/\n{2,}/)
    .map((block) => {
      const trimmed = block.trim()
      if (!trimmed) return ''
      const isList = /^(\d+\.|[-•✅])\s/m.test(trimmed)
      if (isList) {
        const lines = trimmed.split('\n')
        const items = lines
          .map((line) => line.trim())
          .filter(Boolean)
          .map((line) => `<li style="margin:6px 0;">${line.replace(/^(\d+\.|[-•✅])\s*/, '')}</li>`)
          .join('')
        return `<ul style="margin:12px 0 12px 18px;padding:0;">${items}</ul>`
      }
      return `<p style="margin:0 0 12px;">${trimmed.replace(/\n/g, '<br/>')}</p>`
    })
    .filter(Boolean)
    .join('\n')
}
