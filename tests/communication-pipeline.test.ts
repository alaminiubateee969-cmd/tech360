/**
 * TECH360 — the client communication pipeline.
 *
 * These tests cover the eleven-stage client journey (first SMS → final
 * delivery), the exact WhatsApp/SMS and email copy, the auto-send vs
 * admin-approval gates, the "no phone number in AI content" rule and
 * the "always save" CRM contract.
 *
 * Everything here runs WITHOUT a database: the pipeline templates and
 * rules are pure modules by design, so the copy and the policy can be
 * verified without a live CRM.
 */
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  PIPELINE_COPY,
  PIPELINE_MESSAGE_STAGES,
  pipelineMessage,
  renderEmailBody,
  DELIVERY_CONFIRMATION_PHRASE,
  type PipelineMessageStage,
  type PipelineVariables,
} from '../src/lib/pipeline/templates'
import {
  ACTION_SAVE_FIELDS,
  ADMIN_APPROVAL_CATEGORIES,
  ADMIN_APPROVAL_STAGES,
  AUTO_SEND_STAGES,
  CLIENT_JOURNEY_STAGES,
  CRM_SAVE_FIELDS,
  PhoneNumberInAiContentError,
  POLICY_HTML_PREVIEW_BEFORE_PAYMENT,
  POLICY_SOURCE_CODE_AFTER_FULL_PAYMENT,
  assertDeliveryRules,
  assertNoPhoneNumber,
  assertNoSensitiveFilesInPublicContent,
  classifyContentCategory,
  containsAmount,
  containsPhoneNumber,
  effectiveGate,
  findPhoneNumbers,
  findSensitiveFiles,
  gateForCategory,
  gateForStage,
  gatePartitionIsComplete,
  gateReason,
  redactPhoneNumbers,
  screenAiContent,
} from '../src/lib/pipeline/rules'
import { selectWelcomeChannel, hasExplicitContactConsent } from '../src/lib/contact-policy'
import { nextClientId, nextProjectCode, nextInvoiceNumber } from '../src/lib/ids'
import { resolveChannels, PIPELINE_AGENT_BY_CHANNEL } from '../src/lib/pipeline/send'

const V: PipelineVariables = {
  clientId: 'TECH-2026-000001',
  clientName: 'Ayesha Rahman',
  businessType: 'eCommerce',
  recommendedPlan: 'Custom eCommerce platform with CRM and WhatsApp automation',
  meetingLink: 'https://bdtech360.com/#contact',
  projectName: 'Ayesha Store',
  finalScope: 'FINAL SCOPE OF WORK — Tech360',
  paymentPolicy: 'Advance 40% · On milestone 30% · On final delivery 30% · USD',
  htmlPreviewUrl: 'https://bdtech360.com/api/preview/abc123',
}

// ============================================================
// 1 — the exact copy
// ============================================================

describe('communication pipeline — the exact client copy', () => {
  it('stage 1 WhatsApp carries the Client ID and the six intake questions', () => {
    const { whatsapp } = pipelineMessage('FIRST_MESSAGE', V)
    assert.equal(whatsapp.channel, 'WHATSAPP')
    assert.ok(whatsapp.body.includes('TECH-2026-000001'), 'the Client ID must be in the first reply')
    assert.ok(whatsapp.body.includes('Your inquiry has been received and your Client ID is:'))
    for (const question of [
      '1. Your business type',
      '2. Business name',
      '3. What problem do you want to solve?',
      '4. Do you need website, CRM, eCommerce, automation, or full system?',
      '5. Existing website or Facebook page link, if available',
      '6. Expected launch timeline',
    ]) {
      assert.ok(whatsapp.body.includes(question), `missing intake question: ${question}`)
    }
    assert.ok(whatsapp.body.startsWith('Hi, thank you for contacting Tech360.'))
    assert.ok(whatsapp.body.endsWith('After receiving this, our AI system will prepare your recommended plan.'))
  })

  it('stage 1 email uses the exact subject and body', () => {
    const { email } = pipelineMessage('FIRST_MESSAGE', V)
    assert.equal(email.subject, 'Tech360 Inquiry Received - Client ID TECH-2026-000001')
    assert.ok(email.body.startsWith('Dear Ayesha Rahman,'))
    assert.ok(email.body.includes('Thank you for contacting Tech360.'))
    assert.ok(email.body.includes('TECH-2026-000001'))
    for (const question of [
      '1. Your business type',
      '2. Business name',
      '3. Main business problem',
      '4. Required system: website, CRM, eCommerce, automation, or full system',
      '5. Existing website/Facebook page link, if available',
      '6. Expected launch timeline',
    ]) {
      assert.ok(email.body.includes(question), `missing email intake question: ${question}`)
    }
    assert.ok(email.body.includes('Website: [https://bdtech360.com](https://bdtech360.com)'))
    assert.ok(email.body.includes('Email: [info@bdtech360.com](mailto:info@bdtech360.com)'))
  })

  it('stage 2 WhatsApp sends the business type, the plan and the eight scope questions', () => {
    const { whatsapp } = pipelineMessage('BUSINESS_TYPE_RECEIVED', V)
    assert.ok(whatsapp.body.includes('Business Type:\neCommerce'))
    assert.ok(whatsapp.body.includes(V.recommendedPlan!))
    for (const question of [
      '1. Required features',
      '2. Number of staff/users',
      '3. Do you need website, CRM, eCommerce, automation, or full system?',
      '4. Do you need WhatsApp automation?',
      '5. Do you need payment gateway?',
      '6. Do you have logo, content, domain, or hosting?',
      '7. Any reference website/system you like',
      '8. Expected timeline',
    ]) {
      assert.ok(whatsapp.body.includes(question), `missing scope question: ${question}`)
    }
  })

  it('stage 2 email subject names the business type and the Client ID', () => {
    const { email } = pipelineMessage('BUSINESS_TYPE_RECEIVED', V)
    assert.equal(email.subject, 'Recommended Digital Plan for eCommerce - Tech360 Client ID TECH-2026-000001')
  })

  it('stage 3 confirms the requirements were saved and says the final scope follows review', () => {
    const { whatsapp, email } = pipelineMessage('SCOPE_DETAILS_RECEIVED', V)
    assert.ok(whatsapp.body.includes('Your requirements have been saved under Client ID:'))
    assert.ok(whatsapp.body.includes('Our team will review the draft before sending the final Scope of Work.'))
    assert.equal(email.subject, 'Project Details Received - Scope Review Started')
  })

  it('stage 4 sends the final scope with the approval phrase and both policies', () => {
    const { whatsapp, email } = pipelineMessage('FINAL_SCOPE_APPROVED', V)
    assert.ok(whatsapp.body.includes('I approve the Scope of Work.'))
    assert.ok(whatsapp.body.includes('HTML preview may be shared for review before final payment.'))
    assert.ok(whatsapp.body.includes('Final source code, files, admin access, and deployment handover are provided after full payment.'))
    assert.ok(email.subject === 'Final Scope of Work for Approval - Client ID TECH-2026-000001')
    assert.ok(email.body.includes('Final source code, full project files, admin access, and deployment files are delivered after full payment.'))
    assert.ok(email.body.includes('payment is non-refundable unless Tech360 cannot deliver the approved Scope of Work.'))
  })

  it('stage 5A sends the meeting link and the meeting explanation', () => {
    const { whatsapp, email } = pipelineMessage('MEETING_REQUESTED', V)
    assert.ok(whatsapp.body.includes('Meeting link:\nhttps://bdtech360.com/#contact'))
    assert.ok(email.subject === 'Meeting Link for Scope Explanation - Client ID TECH-2026-000001')
  })

  it('stage 5B confirms the scope approval and states the preview policy', () => {
    const { whatsapp, email } = pipelineMessage('SCOPE_APPROVED', V)
    assert.ok(whatsapp.body.includes('Your approval has been saved under Client ID:'))
    assert.ok(whatsapp.body.includes('Final source code, full files, admin access, and deployment handover are provided after full payment.'))
    assert.equal(email.subject, 'Scope Approval Confirmed - Client ID TECH-2026-000001')
  })

  it('stage 6 sends the preview link and the three options', () => {
    const { whatsapp, email } = pipelineMessage('HTML_PREVIEW_SENT', V)
    assert.ok(whatsapp.body.includes('Preview Link:\nhttps://bdtech360.com/api/preview/abc123'))
    for (const option of ['1. Approved', '2. Need revision', '3. Need meeting']) {
      assert.ok(whatsapp.body.includes(option), `missing preview option: ${option}`)
    }
    assert.equal(email.subject, 'HTML Preview Ready for Review - Client ID TECH-2026-000001')
  })

  it('stage 7A acknowledges the revision', () => {
    const { whatsapp, email } = pipelineMessage('REVISION_REQUESTED', V)
    assert.ok(whatsapp.body.includes('Thank you for your feedback.'))
    assert.ok(whatsapp.body.includes('Your revision request has been saved under Client ID:'))
    assert.equal(email.subject, 'Revision Request Received - Client ID TECH-2026-000001')
  })

  it('stage 7B confirms the preview approval and points at the payment step', () => {
    const { whatsapp, email } = pipelineMessage('HTML_PREVIEW_APPROVED', V)
    assert.ok(whatsapp.body.includes('Thank you for approving the HTML/demo preview.'))
    assert.ok(whatsapp.body.includes('The next step is payment confirmation.'))
    assert.equal(email.subject, 'HTML Preview Approval Confirmed - Payment Step')
  })

  it('stage 8 acknowledges the payment', () => {
    const { whatsapp, email } = pipelineMessage('PAYMENT_RECEIVED', V)
    assert.ok(whatsapp.body.includes('Your payment confirmation has been received.'))
    assert.ok(whatsapp.body.includes('Client ID:\nTECH-2026-000001'))
    assert.equal(email.subject, 'Payment Confirmation Received - Client ID TECH-2026-000001')
  })

  it('stage 9 announces the final delivery without a file link', () => {
    const { whatsapp, email } = pipelineMessage('FINAL_DELIVERY_READY', V)
    assert.ok(whatsapp.body.includes('Your final project delivery is ready.'))
    assert.ok(whatsapp.body.includes('✅ Final website/system files'))
    assert.equal(email.subject, 'Final Project Delivery Ready - Client ID TECH-2026-000001')
    assert.ok(!findSensitiveFiles(whatsapp.body).length, 'the delivery-ready notice must not carry a file link')
  })

  it('stage 10 asks for the password-change confirmation and the client confirmation', () => {
    const { whatsapp, email } = pipelineMessage('FINAL_DELIVERY_COMPLETED', V)
    for (const item of [
      '✅ Project delivered/deployed',
      '✅ Work matches approved Scope of Work',
      '✅ Final files/source code/admin access received, if included',
      '✅ You have changed or will change all related passwords',
    ]) {
      assert.ok(whatsapp.body.includes(item), `missing delivery confirmation item: ${item}`)
    }
    assert.ok(whatsapp.body.includes(DELIVERY_CONFIRMATION_PHRASE))
    assert.ok(email.body.includes('“' + DELIVERY_CONFIRMATION_PHRASE + '”'))
    assert.equal(email.subject, 'Final Delivery Completed - Confirmation Required')
  })

  it('stage 11 closes the project, asks for a review and offers a recommendation', () => {
    const { whatsapp, email } = pipelineMessage('PROJECT_CLOSED', V)
    assert.ok(whatsapp.body.includes('Your project has been marked as completed under Client ID:'))
    assert.ok(whatsapp.body.includes('we would appreciate a short review'))
    assert.ok(whatsapp.body.includes('you may recommend Tech360 to them'))
    assert.equal(email.subject, 'Project Completed - Review Request')
  })

  it('every stage produces both a WhatsApp/SMS body and an email with a subject', () => {
    for (const stage of PIPELINE_MESSAGE_STAGES) {
      const { whatsapp, email } = pipelineMessage(stage, V)
      assert.ok(whatsapp.body.length > 40, `${stage} whatsapp body is too short`)
      assert.equal(whatsapp.channel, 'WHATSAPP')
      assert.equal(email.channel, 'EMAIL')
      assert.ok(email.subject && email.subject.length > 5, `${stage} email subject is missing`)
      assert.ok(email.html && email.html.includes('<p'), `${stage} email html is missing`)
    }
  })

  it('no template carries a phone number', () => {
    for (const stage of PIPELINE_MESSAGE_STAGES) {
      const { whatsapp, email } = pipelineMessage(stage, V)
      assert.deepEqual(findPhoneNumbers(whatsapp.body), [], `${stage} WhatsApp body carries a phone number`)
      assert.deepEqual(findPhoneNumbers(email.body), [], `${stage} email body carries a phone number`)
    }
  })

  it('no template carries a sensitive file link', () => {
    for (const stage of PIPELINE_MESSAGE_STAGES) {
      const { whatsapp, email } = pipelineMessage(stage, V)
      assert.deepEqual(findSensitiveFiles(whatsapp.body), [], `${stage} WhatsApp body carries a file link`)
      assert.deepEqual(findSensitiveFiles(email.body), [], `${stage} email body carries a file link`)
    }
  })

  it('the copy registry is complete and every stage is reachable', () => {
    for (const stage of PIPELINE_MESSAGE_STAGES) {
      assert.ok(PIPELINE_COPY[stage], `no copy registered for ${stage}`)
      assert.equal(typeof PIPELINE_COPY[stage].whatsapp, 'function')
      assert.equal(typeof PIPELINE_COPY[stage].email, 'function')
    }
    assert.equal(CLIENT_JOURNEY_STAGES.length, 11, 'the journey has exactly eleven stages')
    for (const stage of CLIENT_JOURNEY_STAGES) {
      assert.ok(PIPELINE_MESSAGE_STAGES.includes(stage.messageStage), `${stage.key} maps to an unknown message stage`)
    }
  })
})

// ============================================================
// 2 — the email HTML renderer
// ============================================================

describe('communication pipeline — the email HTML renderer', () => {
  it('escapes markup so a client name can never inject HTML', () => {
    const html = renderEmailBody('Hi <script>alert(1)</script>,')
    assert.ok(!html.includes('<script>'), 'script tags must be escaped')
    assert.ok(html.includes('&lt;script&gt;'))
  })

  it('renders a markdown link as an anchor', () => {
    const html = renderEmailBody('Website: [https://bdtech360.com](https://bdtech360.com)')
    assert.ok(html.includes('<a href="https://bdtech360.com"'))
    assert.ok(html.includes('>https://bdtech360.com</a>'))
  })

  it('leaves a javascript: link as plain text', () => {
    const html = renderEmailBody('[click](javascript:alert(1))')
    assert.ok(!html.includes('href="javascript:'), 'a javascript: URL must never become a link')
  })

  it('renders bold text and numbered lists', () => {
    const html = renderEmailBody('Important:\n**yes**\n\n1. one\n2. two')
    assert.ok(html.includes('<strong>yes</strong>'))
    assert.ok(html.includes('<li style="margin:6px 0;">one</li>'))
  })

  it('keeps the line structure of the plain body', () => {
    const plain = 'Line one\n\nLine two'
    const html = renderEmailBody(plain)
    assert.equal(html.match(/<p/g)?.length, 2)
  })
})

// ============================================================
// 3 — the auto-send / admin-approval gates
// ============================================================

describe('communication pipeline — the message gates', () => {
  it('partitions every message stage between auto-send and admin approval', () => {
    assert.ok(gatePartitionIsComplete(), 'the auto-send and approval lists must cover every stage exactly once')
  })

  it('auto-sends the messages the specification allows', () => {
    for (const stage of [
      'FIRST_MESSAGE',
      'BUSINESS_TYPE_RECEIVED',
      'SCOPE_DETAILS_RECEIVED',
      'MEETING_REQUESTED',
      'SCOPE_APPROVED',
      'HTML_PREVIEW_SENT',
      'REVISION_REQUESTED',
      'PAYMENT_RECEIVED',
      'FINAL_DELIVERY_READY',
      'FINAL_DELIVERY_COMPLETED',
      'PROJECT_CLOSED',
    ] as PipelineMessageStage[]) {
      assert.equal(gateForStage(stage), 'AUTO_SEND', `${stage} must be auto-sent`)
    }
  })

  it('requires an admin approval for the messages the specification gates', () => {
    for (const stage of ['FINAL_SCOPE_APPROVED', 'HTML_PREVIEW_APPROVED'] as PipelineMessageStage[]) {
      assert.equal(gateForStage(stage), 'ADMIN_APPROVAL_REQUIRED', `${stage} must wait for an admin`)
    }
  })

  it('gates the named non-stage categories', () => {
    for (const category of ADMIN_APPROVAL_CATEGORIES) {
      assert.equal(gateForCategory(category), 'ADMIN_APPROVAL_REQUIRED', `${category} must wait for an admin`)
    }
  })

  it('fails closed for an unknown stage', () => {
    assert.equal(gateForStage('SOMETHING_ELSE'), 'ADMIN_APPROVAL_REQUIRED')
  })

  it('gates any message that carries a monetary amount, whatever its stage', () => {
    assert.equal(effectiveGate('PAYMENT_RECEIVED', 'We received your $1,500 payment'), 'ADMIN_APPROVAL_REQUIRED')
    assert.equal(effectiveGate('FIRST_MESSAGE', 'We received your 1500 USD payment'), 'ADMIN_APPROVAL_REQUIRED')
    // An invoice is one of the seven gated categories, so it is gated
    // even on a stage that is otherwise auto-sent.
    assert.equal(effectiveGate('FIRST_MESSAGE', 'Your invoice INV-2026-0001 is ready'), 'ADMIN_APPROVAL_REQUIRED')
  })

  it('detects a monetary amount', () => {
    assert.ok(containsAmount('$5,000'))
    assert.ok(containsAmount('5000 USD'))
    assert.ok(containsAmount('BDT 12,000'))
    assert.ok(!containsAmount('Client ID TECH-2026-000001'))
    assert.ok(!containsAmount('Your preview is ready'))
  })

  it('gates a stage message when a category demands approval', () => {
    assert.equal(effectiveGate('FIRST_MESSAGE', 'no amount here', 'INVOICE'), 'ADMIN_APPROVAL_REQUIRED')
  })
})

// ============================================================
// 4 — the phone-number rule
// ============================================================

describe('communication pipeline — no phone number in AI content', () => {
  it('finds a phone number in a local format', () => {
    assert.ok(containsPhoneNumber('Call 01712345678 today'))
    assert.ok(containsPhoneNumber('Call +8801712345678 today'))
    assert.ok(containsPhoneNumber('Call +1 (816) 380-8660 today'))
    assert.ok(containsPhoneNumber('Call 816-380-8660 today'))
    assert.ok(containsPhoneNumber('WhatsApp +880 1712-345678'))
  })

  it('does not mistake an identifier, a link, an email, a date or an amount for a number', () => {
    assert.ok(!containsPhoneNumber('Your Client ID is TECH-2026-000001'))
    assert.ok(!containsPhoneNumber('Visit https://bdtech360.com/services'))
    assert.ok(!containsPhoneNumber('Write to info@bdtech360.com'))
    assert.ok(!containsPhoneNumber('Issued 2026-10-19'))
    assert.ok(!containsPhoneNumber('The total is $50,000+'))
    assert.ok(!containsPhoneNumber('Invoice INV-2026-0042'))
    assert.ok(!containsPhoneNumber('Project PRJ-2026-0007'))
    assert.ok(!containsPhoneNumber('1. Website 2. CRM 3. eCommerce 4. Automation'))
    assert.ok(!containsPhoneNumber('24/7 support included'))
  })

  it('redacts the number and keeps the rest of the text intact', () => {
    const text = 'Your Client ID is TECH-2026-000001. Call +8801712345678 to confirm.'
    const redacted = redactPhoneNumbers(text)
    assert.ok(redacted.includes('TECH-2026-000001'), 'the Client ID must survive redaction')
    assert.ok(!containsPhoneNumber(redacted), 'the phone number must be gone')
  })

  it('screens AI content and reports what it removed', () => {
    const screened = screenAiContent('Plan for Rahim 01712345678 — eCommerce')
    assert.equal(screened.redacted.length, 1)
    assert.ok(!containsPhoneNumber(screened.text))
  })

  it('throws when AI content carries a number', () => {
    assert.throws(() => assertNoPhoneNumber('Call 01712345678', 'stage message'), PhoneNumberInAiContentError)
    assert.doesNotThrow(() => assertNoPhoneNumber('Call us on the website', 'stage message'))
  })

  it('refuses a sensitive file reference in public content', () => {
    assert.throws(() => assertNoSensitiveFilesInPublicContent('Download https://x.test/project.zip'))
    assert.doesNotThrow(() => assertNoSensitiveFilesInPublicContent('Download https://x.test/api/preview/abc'))
  })
})

// ============================================================
// 5 — the delivery rules
// ============================================================

describe('communication pipeline — the delivery rules', () => {
  it('refuses a source-code release before payment', () => {
    assert.throws(
      () => assertDeliveryRules({ paymentConfirmed: false, sourceCodeRelease: true, adminApproved: true }),
      /cannot be released before payment/i,
    )
  })

  it('refuses a source-code release without an admin approval', () => {
    assert.throws(
      () => assertDeliveryRules({ paymentConfirmed: true, sourceCodeRelease: true, adminApproved: false }),
      /requires an admin approval/i,
    )
  })

  it('allows a paid, approved release', () => {
    assert.doesNotThrow(() => assertDeliveryRules({ paymentConfirmed: true, sourceCodeRelease: true, adminApproved: true }))
  })

  it('names both policies', () => {
    assert.equal(POLICY_HTML_PREVIEW_BEFORE_PAYMENT, 'HTML Preview Before Payment')
    assert.equal(POLICY_SOURCE_CODE_AFTER_FULL_PAYMENT, 'Source Code After Full Payment')
  })
})

// ============================================================
// 6 — the CRM contract
// ============================================================

describe('communication pipeline — the CRM save contract', () => {
  it('names every field the specification requires to be saved', () => {
    for (const field of [
      'clientId',
      'messageHistory',
      'scopeHistory',
      'approvalHistory',
      'paymentHistory',
      'deliveryHistory',
      'reviewHistory',
    ]) {
      assert.ok((CRM_SAVE_FIELDS as readonly string[]).includes(field), `missing CRM field: ${field}`)
    }
  })

  it('maps every journey action to the records it must write', () => {
    for (const action of [
      'INTAKE',
      'DETECT_BUSINESS',
      'RECOMMEND_PLAN',
      'ASK_SCOPE_QUESTIONS',
      'SUBMIT_SCOPE',
      'ADMIN_SCOPE_APPROVAL',
      'SEND_FINAL_SCOPE',
      'REQUEST_MEETING',
      'GENERATE_PREVIEW',
      'PREVIEW_DECISION',
      'REQUEST_PAYMENT',
      'RECORD_PAYMENT',
      'VERIFY_PAYMENT',
      'PREPARE_HANDOVER',
      'RELEASE_HANDOVER',
      'DELIVERY_CONFIRM',
      'REQUEST_REVIEW',
      'REQUEST_REFERRAL',
      'CLOSE_PROJECT',
    ]) {
      const fields = ACTION_SAVE_FIELDS[action]
      assert.ok(fields && fields.length > 0, `action ${action} has no CRM save fields`)
      assert.ok(fields.includes('clientId'), `action ${action} must save the client ID`)
    }
  })

  it('records the payment and the delivery proof under their own histories', () => {
    assert.ok(ACTION_SAVE_FIELDS.RECORD_PAYMENT.includes('paymentHistory'))
    assert.ok(ACTION_SAVE_FIELDS.VERIFY_PAYMENT.includes('paymentHistory'))
    assert.ok(ACTION_SAVE_FIELDS.VERIFY_PAYMENT.includes('approvalHistory'))
    assert.ok(ACTION_SAVE_FIELDS.RELEASE_HANDOVER.includes('deliveryHistory'))
    assert.ok(ACTION_SAVE_FIELDS.DELIVERY_CONFIRM.includes('deliveryHistory'))
    assert.ok(ACTION_SAVE_FIELDS.REQUEST_REVIEW.includes('reviewHistory'))
  })
})

// ============================================================
// 7 — the identifiers and the channel policy
// ============================================================

describe('communication pipeline — identifiers and channels', () => {
  it('uses the TECH-YYYY-NNNNNN client ID format', () => {
    assert.match(nextClientId.toString(), /TECH-/)
  })

  it('answers an SMS lead on SMS', () => {
    assert.equal(selectWelcomeChannel('SMS'), 'SMS')
    assert.equal(selectWelcomeChannel('WHATSAPP'), 'WHATSAPP')
    assert.equal(selectWelcomeChannel('EMAIL'), 'EMAIL')
    assert.equal(selectWelcomeChannel('WEBSITE', 'sms'), 'SMS')
    assert.equal(selectWelcomeChannel('WEBSITE', 'whatsapp'), 'WHATSAPP')
    assert.equal(selectWelcomeChannel('WEBSITE'), null)
  })

  it('does not turn a phone-call preference into a silent SMS', () => {
    assert.equal(selectWelcomeChannel('WEBSITE', 'Phone'), null)
  })

  it('requires the exact website consent boolean', () => {
    assert.ok(hasExplicitContactConsent(true))
    assert.ok(!hasExplicitContactConsent('true'))
    assert.ok(!hasExplicitContactConsent(undefined))
    assert.ok(!hasExplicitContactConsent(1))
  })

  it('keeps the invoice and project number formats', () => {
    assert.match(nextProjectCode.toString(), /PRJ-/)
    assert.match(nextInvoiceNumber.toString(), /INV-/)
  })
})

// ============================================================
// 8 — the channel selection
// ============================================================

describe('communication pipeline — channel selection', () => {
  const client = {
    id: 'row-1',
    clientId: 'TECH-2026-000001',
    name: 'Ayesha Rahman',
    email: 'ayesha@example.com',
    phone: '+8801712345678',
    whatsapp: '+8801712345678',
    source: 'SMS',
    preferredContact: null,
  }

  it('uses WhatsApp and email for a normal lead, and SMS for an SMS lead', () => {
    assert.deepEqual(resolveChannels({ ...client, source: 'WHATSAPP' } as never), ['WHATSAPP', 'EMAIL'])
    assert.deepEqual(resolveChannels({ ...client, source: 'SMS' } as never), ['WHATSAPP', 'EMAIL', 'SMS'])
  })

  it('never silently changes the channel the client chose', () => {
    assert.deepEqual(resolveChannels({ ...client, source: 'SMS' } as never, ['SMS']), ['SMS'])
    assert.deepEqual(resolveChannels({ ...client, source: 'WHATSAPP' } as never, ['EMAIL']), ['EMAIL'])
  })

  it('returns nothing when the client has no contact detail', () => {
    assert.deepEqual(resolveChannels({ ...client, email: null, whatsapp: null, phone: null } as never), [])
  })

  it('attributes each channel to the agent that owns it', () => {
    assert.equal(PIPELINE_AGENT_BY_CHANNEL.WHATSAPP, 'WAP-011')
    assert.equal(PIPELINE_AGENT_BY_CHANNEL.SMS, 'SMS-013')
    assert.equal(PIPELINE_AGENT_BY_CHANNEL.EMAIL, 'EML-012')
  })
})

// ============================================================
// 9 — the stated communication policy, item by item
// ============================================================

describe('communication pipeline — the stated policy', () => {
  // "AI CAN AUTO SEND: first reply, business-type request, recommended
  // plan, scope questions, meeting link, HTML-preview notification,
  // revision acknowledgement, payment-received acknowledgement, review
  // request."
  const AUTO_SEND_ITEMS: Array<{ label: string; stage: PipelineMessageStage }> = [
    { label: 'first reply', stage: 'FIRST_MESSAGE' },
    { label: 'business-type request', stage: 'BUSINESS_TYPE_RECEIVED' },
    { label: 'recommended plan', stage: 'BUSINESS_TYPE_RECEIVED' },
    { label: 'scope questions', stage: 'BUSINESS_TYPE_RECEIVED' },
    { label: 'meeting link', stage: 'MEETING_REQUESTED' },
    { label: 'HTML-preview notification', stage: 'HTML_PREVIEW_SENT' },
    { label: 'revision acknowledgement', stage: 'REVISION_REQUESTED' },
    { label: 'payment-received acknowledgement', stage: 'PAYMENT_RECEIVED' },
    { label: 'review request', stage: 'PROJECT_CLOSED' },
  ]

  // "AI MUST WAIT FOR ADMIN APPROVAL BEFORE SENDING: final Scope of
  // Work, payment instruction with amount, invoice, legal/refund
  // response, source-code handover, final delivery file links, dispute
  // response."
  const APPROVAL_ITEMS: Array<{ label: string; stage: PipelineMessageStage; body: string; category?: string }> = [
    { label: 'final Scope of Work', stage: 'FINAL_SCOPE_APPROVED', body: 'Your final Scope of Work is ready. I approve the Scope of Work.', category: 'FINAL_SCOPE' },
    { label: 'payment instruction with an amount', stage: 'PAYMENT_RECEIVED', body: 'Your payment of $1,500 is due. Please send the transaction reference.' },
    { label: 'invoice', stage: 'PAYMENT_RECEIVED', body: 'Invoice INV-2026-0001 is ready for your project.', category: 'INVOICE' },
    { label: 'legal response', stage: 'SCOPE_APPROVED', body: 'This is our legal position on the liability for the delivered system.', category: 'LEGAL_RESPONSE' },
    { label: 'refund response', stage: 'SCOPE_APPROVED', body: 'We have processed your refund request for the advance.', category: 'REFUND_RESPONSE' },
    { label: 'source-code handover', stage: 'FINAL_DELIVERY_READY', body: 'Your source code handover package is ready: https://bdtech360.com/api/handover/abc123/download', category: 'SOURCE_CODE_HANDOVER' },
    { label: 'final delivery file links', stage: 'FINAL_DELIVERY_READY', body: 'Download the project files here: https://bdtech360.com/api/handover/abc123/download', category: 'DELIVERY_FILE_LINKS' },
    { label: 'dispute response', stage: 'SCOPE_APPROVED', body: 'We are replying to the dispute you raised about the delivery.', category: 'DISPUTE_RESPONSE' },
  ]

  it('auto-sends every item on the stated auto-send list', () => {
    for (const item of AUTO_SEND_ITEMS) {
      const { whatsapp, email } = pipelineMessage(item.stage, V)
      assert.equal(gateForStage(item.stage), 'AUTO_SEND', `${item.label}: the stage must be auto-send`)
      assert.equal(effectiveGate(item.stage, whatsapp.body), 'AUTO_SEND', `${item.label}: the WhatsApp copy must be auto-sent`)
      assert.equal(effectiveGate(item.stage, email.body), 'AUTO_SEND', `${item.label}: the email copy must be auto-sent`)
    }
  })

  it('requires an admin approval for every item on the stated approval list', () => {
    for (const item of APPROVAL_ITEMS) {
      assert.equal(
        effectiveGate(item.stage, item.body, item.category),
        'ADMIN_APPROVAL_REQUIRED',
        `${item.label}: must wait for an admin approval`,
      )
    }
  })

  it('gates a body carrying an amount whatever its stage label', () => {
    for (const stage of PIPELINE_MESSAGE_STAGES) {
      assert.equal(
        effectiveGate(stage, 'Your payment of $1,500 is due.'),
        'ADMIN_APPROVAL_REQUIRED',
        `${stage}: an amount must gate the message`,
      )
      assert.equal(
        effectiveGate(stage, 'Please settle 12,000 USD before we start.'),
        'ADMIN_APPROVAL_REQUIRED',
        `${stage}: an amount must gate the message`,
      )
    }
  })

  it('does NOT gate a policy statement that merely names the handover rules', () => {
    // The auto-send copy legitimately mentions "source code", "admin
    // access", "handover" and "payment policy". Those are POLICY
    // statements, not a handover, and the gate must not fire on them.
    const policyStatements: Array<[PipelineMessageStage, string]> = [
      ['SCOPE_DETAILS_RECEIVED', 'Payment policy: Advance 40% · Source code, files, admin access and deployment handover follow full payment.'],
      ['MEETING_REQUESTED', 'We can explain the payment policy, the HTML preview process and the final source-code handover.'],
      ['SCOPE_APPROVED', 'Final source code, full files, admin access and deployment handover are provided after full payment.'],
      ['HTML_PREVIEW_SENT', 'After HTML/demo approval and final delivery/source-code handover, payment is non-refundable unless Tech360 cannot deliver the approved scope.'],
      ['FINAL_DELIVERY_READY', 'Delivery may include the final files, the source code, the admin access and the deployment support.'],
      ['FINAL_DELIVERY_COMPLETED', 'Please confirm you received the source code, the admin access and the deployment.'],
      ['BUSINESS_TYPE_RECEIVED', 'Do you need payment gateway integration?'],
      ['PAYMENT_RECEIVED', 'Your payment confirmation has been received.'],
    ]
    for (const [stage, body] of policyStatements) {
      assert.equal(effectiveGate(stage, body), 'AUTO_SEND', `a policy statement must not gate the ${stage} message`)
    }
  })

  it('gates the real copy of the stages that the policy gates', () => {
    const { whatsapp, email } = pipelineMessage('FINAL_SCOPE_APPROVED', V)
    assert.equal(effectiveGate('FINAL_SCOPE_APPROVED', whatsapp.body), 'ADMIN_APPROVAL_REQUIRED')
    assert.equal(effectiveGate('FINAL_SCOPE_APPROVED', email.body), 'ADMIN_APPROVAL_REQUIRED')
  })

  it('explains why a message was gated', () => {
    assert.match(gateReason('FINAL_SCOPE_APPROVED', 'x'), /stage requires an admin approval/)
    assert.match(gateReason('FIRST_MESSAGE', 'Your payment of $1,500 is due.'), /monetary amount/)
    assert.match(gateReason('FIRST_MESSAGE', 'Invoice INV-2026-0001 is ready.'), /INVOICE/)
    assert.match(gateReason('FIRST_MESSAGE', 'We reply to your dispute.'), /DISPUTE_RESPONSE/)
    assert.match(gateReason('FIRST_MESSAGE', 'Hello, how can we help?'), /auto-send list/)
  })

  it('detects the gated categories in a body', () => {
    assert.deepEqual(classifyContentCategory('Your invoice INV-2026-0001 is ready.'), ['INVOICE'])
    assert.ok(classifyContentCategory('This is our legal position.').includes('LEGAL_RESPONSE'))
    assert.ok(classifyContentCategory('We processed your refund.').includes('REFUND_RESPONSE'))
    assert.ok(classifyContentCategory('Regarding your dispute.').includes('DISPUTE_RESPONSE'))
    assert.ok(classifyContentCategory('Download: https://x.test/api/handover/tok/download').includes('DELIVERY_FILE_LINKS'))
    assert.ok(classifyContentCategory('Pay $500 now.').includes('PAYMENT_INSTRUCTION'))
    assert.deepEqual(classifyContentCategory('Thanks for reaching out to Tech360.'), [])
  })
})
