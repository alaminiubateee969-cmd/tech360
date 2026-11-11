/**
 * TECH360 AI AGENT COMMUNICATION PIPELINE — the master specification copy.
 *
 * This module is PURE DATA. It is the single, reviewable source of truth for
 * the "FIRST SMS TO FINAL PROJECT DELIVERY" wording that the business approved.
 * It has no database, no environment and no server dependencies, so it can be
 * imported by the public website, by the public read-only API and by tests.
 *
 * It does NOT replace `src/lib/pipeline/templates.ts`. That module remains the
 * live sender's copy (with consent and legal clarifications added later) and
 * `src/lib/pipeline/rules.ts` remains the enforced gate. This file preserves
 * the approved master wording side by side, so both can be reviewed and neither
 * is deleted. The public page states which copy the live system actually sends.
 *
 * Placeholders such as [CLIENT_ID] are intentional — they are substituted by
 * the real journey engine, never by this module.
 */

export const PIPELINE_BRAND = 'Tech360'
export const PIPELINE_DOMAIN = 'https://bdtech360.com'
export const PIPELINE_EMAIL = 'info@bdtech360.com'
export const PIPELINE_WEBCHAT = 'Live Support'
export const PIPELINE_CORE_RULE = 'HTML Preview Before Payment. Source Code After Full Payment.'
export const CLIENT_ID_FORMAT = 'TECH-2026-000001'
export const CLIENT_ID_PATTERN = 'TECH-YYYY-NNNNNN'

/** Every channel whose messages must be saved under the client profile. */
export const SPEC_CHANNELS: ReadonlyArray<{
  key: string
  label: string
  detail: string
  icon: 'whatsapp' | 'sms' | 'email' | 'web' | 'social' | 'admin'
}> = [
  { key: 'WHATSAPP', label: 'WhatsApp', detail: 'Inbound messages and outbound WhatsApp replies', icon: 'whatsapp' },
  { key: 'SMS', label: 'SMS', detail: 'First-SMS intake and SMS replies', icon: 'sms' },
  { key: 'EMAIL', label: 'Email', detail: 'Inbound mail and exact email subjects/bodies', icon: 'email' },
  { key: 'WEB', label: 'Website form', detail: 'Consent-evidenced contact form enquiries', icon: 'web' },
  { key: 'FACEBOOK', label: 'Facebook', detail: 'Page messages relayed into the CRM', icon: 'social' },
  { key: 'INSTAGRAM', label: 'Instagram', detail: 'Direct messages relayed into the CRM', icon: 'social' },
  { key: 'LINKEDIN', label: 'LinkedIn', detail: 'InMail and page messages relayed into the CRM', icon: 'social' },
  { key: 'X', label: 'X', detail: 'Posts and direct messages relayed into the CRM', icon: 'social' },
  { key: 'MESSENGER', label: 'Messenger', detail: 'Conversation messages relayed into the CRM', icon: 'social' },
  { key: 'ADMIN', label: 'Manual admin message', detail: 'Operator-composed messages, always logged', icon: 'admin' },
]

/** The client profile the AI must create and keep under the Client ID. */
export const CRM_PROFILE_FIELDS: readonly string[] = [
  'Client ID',
  'Client name',
  'Business name',
  'Business type',
  'Phone',
  'WhatsApp',
  'Email',
  'Lead source',
  'Message history',
  'Scope history',
  'Approval history',
  'Payment history',
  'Delivery history',
  'Review history',
]

/** AI CAN AUTO SEND — exactly the nine items from the master prompt. */
export const AI_AUTO_SEND: readonly string[] = [
  'First reply',
  'Business type request',
  'Recommended plan',
  'Scope questions',
  'Meeting link',
  'HTML preview notification',
  'Revision acknowledgement',
  'Payment received acknowledgement',
  'Review request',
]

/** AI MUST WAIT FOR ADMIN APPROVAL BEFORE SENDING — exactly the seven items. */
export const AI_ADMIN_APPROVAL: readonly string[] = [
  'Final Scope of Work',
  'Payment instruction with amount',
  'Invoice',
  'Legal/refund response',
  'Source-code handover',
  'Final delivery file links',
  'Dispute response',
]

/** AI MUST ALWAYS SAVE — exactly the nine items. */
export const AI_ALWAYS_SAVE: readonly string[] = [
  'Incoming message',
  'Outgoing message',
  'Email body',
  'WhatsApp body',
  'SMS body',
  'Client ID',
  'Status change',
  'Timestamp',
  'Admin approval',
  'Payment proof',
  'Delivery proof',
]

export const FINAL_RULES: readonly string[] = [
  'No source code before payment confirmation.',
  'No final legal message without admin approval.',
  'No payment-specific message without admin approval.',
  'No sensitive files in public AI content.',
  'HTML Preview Before Payment.',
  'Source Code After Full Payment.',
]

export interface SpecStage {
  /** 1–11 as in the master prompt. */
  stageNumber: number
  /** 'A' / 'B' for the two branching stages (5 and 7), else null. */
  branch: 'A' | 'B' | null
  id: string
  title: string
  aiAction: readonly string[]
  whatsapp: string
  emailSubject: string
  emailBody: string
  crmSave: readonly string[]
  gate: 'AUTO_SEND' | 'ADMIN_APPROVAL_REQUIRED'
  /** Extra operator note, never sent to the client. */
  operatorNote?: string
}

/**
 * All thirteen client-facing message variants (eleven stages, two of which
 * branch). The wording is transcribed verbatim from the master prompt.
 */
export const SPEC_STAGES: readonly SpecStage[] = [
  {
    stageNumber: 1,
    branch: null,
    id: 'FIRST_MESSAGE',
    title: 'First SMS / first message received',
    aiAction: ['Create lead in CRM.', 'Generate Client ID.', 'Save incoming message.', 'Detect source.', 'Ask for business type and project need.'],
    whatsapp: `Hi, thank you for contacting Tech360.

Your inquiry has been received and your Client ID is:

[CLIENT_ID]

Tech360 helps business owners build websites, eCommerce systems, CRM software, ERP, WhatsApp automation, n8n workflows, AI systems, dashboards, and business automation.

To suggest the right solution, please reply with:

1. Your business type
2. Business name
3. What problem do you want to solve?
4. Do you need website, CRM, eCommerce, automation, or full system?
5. Existing website or Facebook page link, if available
6. Expected launch timeline

After receiving this, our AI system will prepare your recommended plan.`,
    emailSubject: 'Tech360 Inquiry Received - Client ID [CLIENT_ID]',
    emailBody: `Dear [CLIENT_NAME],

Thank you for contacting Tech360.

Your inquiry has been received and your Client ID is:

[CLIENT_ID]

Tech360 helps businesses build premium websites, CRM systems, eCommerce platforms, WhatsApp automation, n8n workflows, dashboards, AI systems, and business automation solutions.

To prepare the right recommendation, please share:

1. Your business type
2. Business name
3. Main business problem
4. Required system: website, CRM, eCommerce, automation, or full system
5. Existing website/Facebook page link, if available
6. Expected launch timeline

Once we receive the information, our system will prepare your recommended digital plan.

Best regards,
Tech360 Team
Website: https://bdtech360.com
Email: info@bdtech360.com`,
    crmSave: ['status = New Lead', 'client_id = [CLIENT_ID]', 'lead_source = [SOURCE]', 'communication_log = saved', 'next_action = Wait for business type'],
    gate: 'AUTO_SEND',
  },
  {
    stageNumber: 2,
    branch: null,
    id: 'BUSINESS_TYPE_RECEIVED',
    title: 'Business type received',
    aiAction: ['Save business type.', 'Detect industry.', 'Generate recommended plan.', 'Ask scope questions.', 'Send WhatsApp and email.'],
    whatsapp: `Thank you for sharing your business type.

Business Type:
[BUSINESS_TYPE]

Based on your business, Tech360 recommends:

[RECOMMENDED_PLAN]

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
    emailSubject: 'Recommended Digital Plan for [BUSINESS_TYPE] - Tech360 Client ID [CLIENT_ID]',
    emailBody: `Dear [CLIENT_NAME],

Thank you for sharing your business type.

Business Type:
[BUSINESS_TYPE]

Based on your business, Tech360 recommends the following digital solution:

[RECOMMENDED_PLAN]

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

Best regards,
Tech360 Team
Website: https://bdtech360.com`,
    crmSave: ['status = Business Type Received', 'business_type = [BUSINESS_TYPE]', 'recommended_plan = [RECOMMENDED_PLAN]', 'next_action = Wait for scope details'],
    gate: 'AUTO_SEND',
  },
  {
    stageNumber: 3,
    branch: null,
    id: 'SCOPE_DETAILS_RECEIVED',
    title: 'Scope details received',
    aiAction: ['Save scope details.', 'Generate draft Scope of Work.', 'Mark admin review required.', 'Do not send final scope before admin approval.'],
    whatsapp: `Thank you for sending your project details.

Your requirements have been saved under Client ID:

[CLIENT_ID]

Tech360 will now review your requirements and prepare a Scope of Work including:

✅ Confirmed features
✅ Recommended updates
✅ Timeline
✅ Client responsibilities
✅ Payment policy
✅ HTML preview process
✅ Final source-code handover process

Our team will review the draft before sending the final Scope of Work.`,
    emailSubject: 'Project Details Received - Scope Review Started',
    emailBody: `Dear [CLIENT_NAME],

Thank you for sharing your project details.

Your requirements have been received and saved under Client ID:

[CLIENT_ID]

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
Tech360 Team`,
    crmSave: ['status = Scope Received', 'scope_details = saved', 'ai_scope_draft = generated', 'admin_review_required = yes', 'next_action = Admin review'],
    gate: 'AUTO_SEND',
    operatorNote: 'Only the acknowledgement is auto-sent. The final Scope of Work stays behind an admin approval.',
  },
  {
    stageNumber: 4,
    branch: null,
    id: 'FINAL_SCOPE_APPROVED',
    title: 'Final Scope approved by admin',
    aiAction: ['Send final Scope of Work.', 'Send payment and HTML preview policy.', 'Ask client to review.', 'If unclear, offer meeting link.'],
    whatsapp: `Your final Scope of Work is ready.

Client ID:
[CLIENT_ID]

Please review the Scope of Work carefully.

If everything is clear, reply:

I approve the Scope of Work.

If you need explanation, you can book an online meeting here:

[MEETING_LINK]

Important:
HTML preview may be shared for review before final payment.
Final source code, files, admin access, and deployment handover are provided after full payment.
After final delivery/source-code handover, payment is non-refundable unless Tech360 cannot deliver the approved scope.`,
    emailSubject: 'Final Scope of Work for Approval - Client ID [CLIENT_ID]',
    emailBody: `Dear [CLIENT_NAME],

Your final Scope of Work is ready for review.

Client ID:
[CLIENT_ID]

Project:
[PROJECT_NAME]

Business Type:
[BUSINESS_TYPE]

Final Scope of Work:
[FINAL_SCOPE]

Payment Policy:
[PAYMENT_POLICY]

HTML Preview Policy:
Tech360 may share an HTML/demo preview so you can review the design, structure, and project direction before final source-code handover.

Final Delivery Policy:
Final source code, full project files, admin access, and deployment files are delivered after full payment.

Non-Refund Policy:
After final delivery, source-code handover, admin access handover, or server deployment, payment is non-refundable unless Tech360 cannot deliver the approved Scope of Work.

If the scope is clear, please reply:

I approve the Scope of Work.

If you need clarification, you can book a meeting here:
[MEETING_LINK]

Best regards,
Tech360 Team`,
    crmSave: ['status = Final Scope Sent', 'final_scope_sent = yes', 'email_log = saved', 'whatsapp_log = saved', 'next_action = Wait for approval or meeting request'],
    gate: 'ADMIN_APPROVAL_REQUIRED',
  },
  {
    stageNumber: 5,
    branch: 'A',
    id: 'MEETING_REQUESTED',
    title: '5A · Client does not understand / meeting needed',
    aiAction: ['Send meeting link.', 'Save meeting request.', 'Create task.'],
    whatsapp: `No problem. If any part of the Scope of Work is unclear, you can book an online meeting with Tech360 before approval.

Meeting link:
[MEETING_LINK]

In the meeting, we can explain:

• Project scope
• Included features
• Not included items
• Timeline
• Payment policy
• HTML preview process
• Final source-code handover`,
    emailSubject: 'Meeting Link for Scope Explanation - Client ID [CLIENT_ID]',
    emailBody: `Dear [CLIENT_NAME],

If any part of the Scope of Work is unclear, you can book an online meeting with Tech360 before approval.

Meeting link:
[MEETING_LINK]

During the meeting, we can explain the project scope, included features, excluded items, timeline, payment policy, HTML preview process, and final source-code handover.

Best regards,
Tech360 Team`,
    crmSave: ['status = Meeting Requested', 'meeting_link_sent = yes', 'task_created = yes'],
    gate: 'AUTO_SEND',
  },
  {
    stageNumber: 5,
    branch: 'B',
    id: 'SCOPE_APPROVED',
    title: '5B · Client approves scope',
    aiAction: ['Save approval.', 'Send confirmation.', 'Prepare HTML preview step.'],
    whatsapp: `Thank you for approving the Scope of Work.

Your approval has been saved under Client ID:

[CLIENT_ID]

Tech360 will now prepare the HTML/demo preview for your review.

Please note:
HTML/demo preview is for review and confirmation.
Final source code, full files, admin access, and deployment handover are provided after full payment.`,
    emailSubject: 'Scope Approval Confirmed - Client ID [CLIENT_ID]',
    emailBody: `Dear [CLIENT_NAME],

Thank you for approving the Scope of Work.

Your approval has been saved under Client ID:

[CLIENT_ID]

Tech360 will now prepare the HTML/demo preview for your review.

Please note:
The HTML/demo preview is shared for review and confirmation only. Final source code, full project files, admin access, and deployment handover are provided after full payment.

Best regards,
Tech360 Team`,
    crmSave: ['status = Client Confirmed', 'scope_approval = saved', 'next_action = Prepare HTML preview'],
    gate: 'AUTO_SEND',
  },
  {
    stageNumber: 6,
    branch: null,
    id: 'HTML_PREVIEW_SENT',
    title: 'HTML preview sent',
    aiAction: ['Send preview link.', 'Ask approval or revision.', 'Save preview tracking.'],
    whatsapp: `Your HTML/demo preview is ready.

Preview Link:
[HTML_PREVIEW_URL]

Please review and reply with one of the following:

1. Approved
2. Need revision
3. Need meeting

Important:
After HTML/demo approval and final delivery/source-code handover, payment is non-refundable unless Tech360 cannot deliver the approved scope.`,
    emailSubject: 'HTML Preview Ready for Review - Client ID [CLIENT_ID]',
    emailBody: `Dear [CLIENT_NAME],

Your HTML/demo preview is ready for review.

Preview Link:
[HTML_PREVIEW_URL]

Please review and confirm:

1. Approved
2. Need revision
3. Need meeting

Important:
The HTML/demo preview is provided for review and confirmation. Final source code, full files, admin access, and deployment handover are provided after full payment. After final delivery/source-code handover, payment is non-refundable unless Tech360 cannot deliver the approved scope.

Best regards,
Tech360 Team`,
    crmSave: ['status = HTML Preview Sent', 'html_preview_url = [HTML_PREVIEW_URL]', 'preview_sent_date = current_datetime', 'next_action = Wait for preview response'],
    gate: 'AUTO_SEND',
  },
  {
    stageNumber: 7,
    branch: 'A',
    id: 'REVISION_REQUESTED',
    title: '7A · Client requests revision',
    aiAction: ['Save revision.', 'Notify admin.', 'Create revision task.'],
    whatsapp: `Thank you for your feedback.

Your revision request has been saved under Client ID:

[CLIENT_ID]

Our team will review the requested changes and update you.`,
    emailSubject: 'Revision Request Received - Client ID [CLIENT_ID]',
    emailBody: `Dear [CLIENT_NAME],

Thank you for your feedback.

Your revision request has been received and saved under Client ID:

[CLIENT_ID]

Our team will review the requested changes and update you.

Best regards,
Tech360 Team`,
    crmSave: ['status = Revision Requested', 'revision_note = saved', 'task_created = yes', 'admin_notification = sent'],
    gate: 'AUTO_SEND',
  },
  {
    stageNumber: 7,
    branch: 'B',
    id: 'HTML_PREVIEW_APPROVED',
    title: '7B · Client approves HTML preview',
    aiAction: ['Save preview approval.', 'Send payment instruction after admin approval.', 'Track payment.'],
    whatsapp: `Thank you for approving the HTML/demo preview.

Your approval has been saved under Client ID:

[CLIENT_ID]

The next step is payment confirmation.

After payment is completed, Tech360 will proceed with final development/delivery and source-code handover according to the approved Scope of Work.`,
    emailSubject: 'HTML Preview Approval Confirmed - Payment Step',
    emailBody: `Dear [CLIENT_NAME],

Thank you for approving the HTML/demo preview.

Your approval has been saved under Client ID:

[CLIENT_ID]

The next step is payment confirmation based on the approved Scope of Work and payment policy.

After payment is completed, Tech360 will proceed with final development/delivery and source-code handover according to the approved scope.

Best regards,
Tech360 Team`,
    crmSave: ['status = Payment Pending', 'preview_approval = saved', 'payment_pending = yes'],
    gate: 'ADMIN_APPROVAL_REQUIRED',
    operatorNote: 'The payment instruction with an amount is gated; this acknowledgement is reviewed before it leaves.',
  },
  {
    stageNumber: 8,
    branch: null,
    id: 'PAYMENT_RECEIVED',
    title: 'Payment received',
    aiAction: ['Save payment.', 'Notify admin/team.', 'Unlock delivery workflow.'],
    whatsapp: `Thank you. Your payment confirmation has been received.

Client ID:
[CLIENT_ID]

Tech360 will now proceed with the final delivery process based on the approved Scope of Work.`,
    emailSubject: 'Payment Confirmation Received - Client ID [CLIENT_ID]',
    emailBody: `Dear [CLIENT_NAME],

Thank you. Your payment confirmation has been received.

Client ID:
[CLIENT_ID]

Tech360 will now proceed with the final delivery process based on the approved Scope of Work.

Best regards,
Tech360 Team`,
    crmSave: ['status = Payment Received', 'payment_date = current_datetime', 'payment_log = saved', 'next_action = Final delivery preparation'],
    gate: 'AUTO_SEND',
  },
  {
    stageNumber: 9,
    branch: null,
    id: 'FINAL_DELIVERY_READY',
    title: 'Final delivery ready',
    aiAction: ['Send delivery notice.', 'Attach/link final files if admin approved.', 'Do not release source code unless payment confirmed.'],
    whatsapp: `Your final project delivery is ready.

Client ID:
[CLIENT_ID]

Delivery may include:

✅ Final website/system files
✅ Source code
✅ Admin access, if included
✅ Deployment support, if included
✅ Basic handover documentation

Please review the delivery carefully and confirm after checking.`,
    emailSubject: 'Final Project Delivery Ready - Client ID [CLIENT_ID]',
    emailBody: `Dear [CLIENT_NAME],

Your final project delivery is ready.

Client ID:
[CLIENT_ID]

Your handover may include:

1. Final website/system files
2. Source code
3. Admin access, if included
4. Deployment support, if included
5. Basic handover documentation
6. Scope-based final delivery

Please review the delivery carefully and confirm after checking.

Best regards,
Tech360 Team`,
    crmSave: ['status = Final Delivery Ready', 'delivery_notice_sent = yes', 'admin_approval_required_for_file_release = yes'],
    gate: 'AUTO_SEND',
    operatorNote: 'The notice is auto-sent with no file links. Releasing the links is a separate admin-approved action.',
  },
  {
    stageNumber: 10,
    branch: null,
    id: 'FINAL_DELIVERY_COMPLETED',
    title: 'Final delivery completed',
    aiAction: ['Save delivery.', 'Ask password change confirmation.', 'Ask client to confirm receipt.'],
    whatsapp: `Tech360 confirms that your approved project has been delivered/deployed as per the approved Scope of Work.

Please check your website/system and confirm:

✅ Project delivered/deployed
✅ Work matches approved Scope of Work
✅ Final files/source code/admin access received, if included
✅ You have changed or will change all related passwords

Please reply:

I confirm that Tech360 has delivered/deployed the approved project as per the approved Scope of Work. I have reviewed the website/system and received the agreed delivery. I have changed or will change all related passwords. I understand that after password change, Tech360 will no longer have active access to my server/source-code environment.`,
    emailSubject: 'Final Delivery Completed - Confirmation Required',
    emailBody: `Dear [CLIENT_NAME],

Tech360 confirms that your approved project has been delivered/deployed as per the approved Scope of Work.

Please review your website/system and confirm:

1. The project has been delivered or deployed.
2. The work matches the approved Scope of Work.
3. You have received the agreed final files/source code/admin access, if included.
4. You have changed or will change all related server, hosting, admin, database, email, and API passwords.
5. You understand that after password change, Tech360 will no longer have active access to your server/source-code environment.

Please reply with:

“I confirm that Tech360 has delivered/deployed the approved project as per the approved Scope of Work. I have reviewed the website/system and received the agreed delivery. I have changed or will change all related passwords. I understand that after password change, Tech360 will no longer have active access to my server/source-code environment.”

Best regards,
Tech360 Team`,
    crmSave: ['status = Source Code Delivered', 'delivery_log = saved', 'password_change_confirmation_pending = yes'],
    gate: 'AUTO_SEND',
  },
  {
    stageNumber: 11,
    branch: null,
    id: 'PROJECT_CLOSED',
    title: 'Client confirms final delivery',
    aiAction: ['Close project.', 'Request review.', 'Request optional recommendation.'],
    whatsapp: `Thank you for confirming the final delivery.

Your project has been marked as completed under Client ID:

[CLIENT_ID]

If you are satisfied with Tech360’s service, we would appreciate a short review.

If you know any business owner, company, school, agency, hospital, or organization that needs website, software, CRM, eCommerce, automation, or technical support, you may recommend Tech360 to them.`,
    emailSubject: 'Project Completed - Review Request',
    emailBody: `Dear [CLIENT_NAME],

Thank you for confirming the final delivery.

Your project has been marked as completed under Client ID:

[CLIENT_ID]

If you are satisfied with Tech360’s service, we would appreciate a short review about your experience.

If you know any business owner, company, school, agency, hospital, or organization that needs website, software, CRM, eCommerce, automation, or technical support, you may recommend Tech360 to them.

Thank you for choosing Tech360.

Best regards,
Tech360 Team
Website: https://bdtech360.com
Email: info@bdtech360.com`,
    crmSave: ['status = Project Closed', 'review_requested = yes', 'referral_requested = yes', 'project_close_date = current_datetime'],
    gate: 'AUTO_SEND',
  },
]

/** The eleven group headings shown on the public timeline. */
export const SPEC_GROUP_TITLES: readonly string[] = [
  'First message received',
  'Business type received',
  'Scope details received',
  'Final Scope of Work approved',
  'Meeting or scope approval',
  'HTML preview sent',
  'Revision or preview approval',
  'Payment received',
  'Final delivery ready',
  'Final delivery completed',
  'Project closed and review requested',
]

/** Eleven journey groups for the public timeline (branching stages kept intact). */
export const SPEC_STAGE_GROUPS = Array.from({ length: 11 }, (_, i) => i + 1).map((n) => ({
  number: n,
  entries: SPEC_STAGES.filter((s) => s.stageNumber === n),
  title: SPEC_GROUP_TITLES[n - 1],
}))

export const SPEC_COPY_META = {
  brand: PIPELINE_BRAND,
  domain: PIPELINE_DOMAIN,
  email: PIPELINE_EMAIL,
  webchat: PIPELINE_WEBCHAT,
  coreRule: PIPELINE_CORE_RULE,
  clientIdFormat: CLIENT_ID_FORMAT,
  clientIdPattern: CLIENT_ID_PATTERN,
  stageCount: 11,
  messageVariantCount: SPEC_STAGES.length,
  channelCount: SPEC_CHANNELS.length,
}
