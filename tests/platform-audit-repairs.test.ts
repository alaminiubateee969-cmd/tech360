import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { after, describe, it } from 'node:test'

import { redactSensitiveCrmData, redactSensitiveValue } from '../src/lib/sensitive-redaction'
import { classifyInboundEmailSafety, extractSenderDisplayName } from '../src/lib/mail/email-inbound-guard'
import {
  detectOutOfScopeRevisionSignals,
  evaluateClientPaymentProofSubmission,
  isPaymentClearedForSourceRelease,
  paymentStatusLabel,
  validatePaymentLifecycleTransition,
} from '../src/lib/payment-policy'
import { screenAiReply } from '../src/lib/ai-reply-guard'
import { canAccessAdminView, VIEW_MIN_ROLE } from '../src/lib/admin-view-policy'
import { canManageFactory } from '../src/lib/factory/control/access'
import { renderMarkdownForPath } from '../src/lib/agent-content'
import { buildFiles, buildPlan, normalizeBrief } from '../src/lib/factory/blueprint'
import { formatScopeForClient, clientScopeDecision } from '../src/lib/journey'
import { runAgent } from '../src/lib/agents/engine'
import { processHostingerInboundMessages } from '../src/lib/mail/hostinger-ai-processor'
import { db } from '../src/lib/db'

const ROOT = join(import.meta.dirname, '..')
const HAS_DB = Boolean(process.env.PREVIEW_SQLITE_URL || process.env.DATABASE_URL)

function makeLuhnVisa(prefix15: string): string {
  let sum = 0
  let doubleDigit = true // 16th digit is check digit, so index 14 (0-based from left) is doubled
  for (let i = prefix15.length - 1; i >= 0; i--) {
    let d = Number(prefix15[i])
    if (doubleDigit) {
      d *= 2
      if (d > 9) d -= 9
    }
    sum += d
    doubleDigit = !doubleDigit
  }
  const check = (10 - (sum % 10)) % 10
  return `${prefix15}${check}`
}

describe('1 — Sensitive CRM, audit & error redaction', () => {
  it('redacts Luhn-valid payment card PANs, CVVs, PEM keys, API tokens, and credential assignments', () => {
    const pan = makeLuhnVisa('453201511283036')
    const formattedPan = `${pan.slice(0, 4)} ${pan.slice(4, 8)} ${pan.slice(8, 12)} ${pan.slice(12)}`
    const stripeTok = ['sk', 'live', '9'.repeat(26)].join('_')
    const pemBegin = ['-----BEGIN', 'RSA', 'PRIVATE', 'KEY-----'].join(' ')
    const pemEnd = ['-----END', 'RSA', 'PRIVATE', 'KEY-----'].join(' ')

    const raw = [
      `Hi, my cPanel password: MySuperSecret!99 and card is ${formattedPan} cvv 842.`,
      `Token is ${stripeTok} and Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.payload`,
      `${pemBegin}\nMIIEpAIBAAKCAQEAtestmaterial\n${pemEnd}`,
    ].join('\n')

    const result = redactSensitiveCrmData(raw)
    assert.equal(result.changed, true)
    assert.ok(!result.text.includes('MySuperSecret!99'))
    assert.ok(!result.text.includes(pan.slice(0, 8)))
    assert.ok(!result.text.includes(stripeTok))
    assert.ok(!result.text.includes('MIIEpAIBAAKCAQEAtestmaterial'))
    assert.ok(result.redactedTypes.includes('PAYMENT_CARD_PAN'))
    assert.ok(result.redactedTypes.includes('CREDENTIAL'))
    assert.ok(result.redactedTypes.includes('STRIPE_SECRET'))
    assert.ok(result.redactedTypes.includes('PRIVATE_KEY'))
  })

  it('preserves ordinary customer messages, Client IDs, phone numbers, and non-card numeric references', () => {
    const ordinary = 'Hello TECH360, my Client ID is TECH-2026-000042, phone +18163808660, budget around 5000 for our CRM portal.'
    const res = redactSensitiveCrmData(ordinary)
    assert.equal(res.changed, false)
    assert.equal(res.text, ordinary)
  })

  it('recursively redacts sensitive object keys in audit payloads', () => {
    const cleaned = redactSensitiveValue({
      clientId: 'TECH-2026-000001',
      smtpPassword: 'raw-secret-password',
      nested: { webhookSecret: 'another-secret-value', safeNote: 'Approved scope v2' },
    }) as Record<string, unknown>
    assert.equal(cleaned.clientId, 'TECH-2026-000001')
    assert.equal(cleaned.smtpPassword, '[REDACTED_CREDENTIAL]')
    assert.equal((cleaned.nested as Record<string, unknown>).webhookSecret, '[REDACTED_CREDENTIAL]')
    assert.equal((cleaned.nested as Record<string, unknown>).safeNote, 'Approved scope v2')
  })
})

describe('2 — Inbound email loop, bounce & RFC 3834 safety guard', () => {
  it('suppresses self-sent emails from info@bdtech360.com and @bdtech360.com to prevent infinite mail loops', () => {
    assert.equal(classifyInboundEmailSafety({ fromEmail: 'info@bdtech360.com', subject: 'Re: Inquiry' }).classification, 'SELF_SENDER')
    assert.equal(classifyInboundEmailSafety({ fromEmail: 'Tech360 Support <billing@bdtech360.com>', subject: 'Invoice' }).classification, 'SELF_SENDER')
    assert.equal(classifyInboundEmailSafety({ fromEmail: 'info@tech360.com', subject: 'Hello' }).classification, 'SELF_SENDER')
  })

  it('detects bounces, RFC 3834 Auto-Submitted headers, and no-reply senders', () => {
    assert.equal(
      classifyInboundEmailSafety({
        fromEmail: 'MAILER-DAEMON@mx.example.com',
        subject: 'Undelivered Mail Returned to Sender',
        body: 'Diagnostic-Code: smtp; 550 5.1.1 user unknown',
      }).classification,
      'BOUNCE_NOTIFICATION',
    )
    assert.equal(
      classifyInboundEmailSafety({
        fromEmail: 'customer@example.com',
        subject: 'Out of office',
        headers: { 'Auto-Submitted': 'auto-replied' },
      }).classification,
      'AUTO_SUBMITTED',
    )
    assert.equal(
      classifyInboundEmailSafety({
        fromEmail: 'no-reply@notifications.example.com',
        subject: 'Alert',
      }).classification,
      'NO_REPLY_SENDER',
    )
  })

  it('allows genuine prospective customer inquiries and extracts clean sender display names', () => {
    const verdict = classifyInboundEmailSafety({
      fromEmail: '"Nadia Karim" <nadia@northwind-logistics.com>',
      subject: 'Need a custom logistics CRM & client portal',
      body: 'Hello, we operate 40 trucks and want a custom portal.',
    })
    assert.equal(verdict.allowProcess, true)
    assert.equal(verdict.allowAutoReply, true)
    assert.equal(extractSenderDisplayName('"Nadia Karim" <nadia@northwind-logistics.com>'), 'Nadia Karim')
  })
})

describe('3 — Stage 8 payment verification & screenshot evidence policy', () => {
  it('maps canonical Stage 8 labels and treats screenshots strictly as SUBMITTED evidence-only', () => {
    assert.equal(paymentStatusLabel('PENDING'), 'Payment Pending')
    assert.equal(paymentStatusLabel('SUBMITTED'), 'Payment Submitted')
    assert.equal(paymentStatusLabel('UNDER_VERIFICATION'), 'Payment Under Verification')
    assert.equal(paymentStatusLabel('PAID'), 'Payment Verified')
    assert.equal(paymentStatusLabel('FAILED'), 'Payment Failed')

    const missing = evaluateClientPaymentProofSubmission({ hasProofFile: false, transactionId: '' })
    assert.equal(missing.ok, false)

    const screenshotOnly = evaluateClientPaymentProofSubmission({ hasProofFile: true, transactionId: null })
    assert.equal(screenshotOnly.ok, true)
    if (screenshotOnly.ok) {
      assert.equal(screenshotOnly.status, 'SUBMITTED')
      assert.equal(screenshotOnly.evidenceOnly, true)
    }
  })

  it('forbids direct operator bypass to PAID and blocks source release until full verified settlement', () => {
    const bypass = validatePaymentLifecycleTransition({ currentStatus: 'SUBMITTED', targetStatus: 'PAID' })
    assert.equal(bypass.ok, false)

    const review = validatePaymentLifecycleTransition({ currentStatus: 'SUBMITTED', targetStatus: 'UNDER_VERIFICATION' })
    assert.equal(review.ok, true)
    if (review.ok) {
      assert.equal(review.nextStatus, 'UNDER_VERIFICATION')
      assert.equal(review.lifecycleLabel, 'Payment Under Verification')
    }

    assert.equal(
      isPaymentClearedForSourceRelease({
        projectTotalAmount: 1000,
        payments: [{ status: 'PAID', verifiedAt: new Date(), verifiedBy: 'admin_1', amount: 1000 }],
      }).cleared,
      true,
    )
    assert.equal(
      isPaymentClearedForSourceRelease({
        projectTotalAmount: 1000,
        payments: [{ status: 'SUBMITTED', verifiedAt: null, verifiedBy: null, amount: 1000 }],
      }).cleared,
      false,
    )
    assert.equal(
      isPaymentClearedForSourceRelease({
        projectTotalAmount: 1000,
        payments: [{ status: 'UNDER_VERIFICATION', verifiedAt: null, verifiedBy: null, amount: 1000 }],
      }).cleared,
      false,
    )
  })

  it('flags out-of-scope expansion signals on client revision requests', () => {
    const minorFix = detectOutOfScopeRevisionSignals('Please fix a typo on milestone 2 description.')
    assert.equal(minorFix.flagged, false)

    const scopeCreep = detectOutOfScopeRevisionSignals('Also add a native iOS and Android mobile app plus WhatsApp bot integration.')
    assert.equal(scopeCreep.flagged, true)
    assert.ok(scopeCreep.signals.length >= 1)
  })
})

describe('4 — Private Software Factory confidentiality & SUPER_ADMIN RBAC', () => {
  it('restricts Software Factory views and control plane strictly to SUPER_ADMIN', () => {
    assert.equal(VIEW_MIN_ROLE.factory, 'SUPER_ADMIN')
    assert.equal(VIEW_MIN_ROLE.factoryControl, 'SUPER_ADMIN')
    for (const role of ['STAFF', 'MANAGER', 'ADMIN', 'FINANCE', 'DEVELOPER', 'CLIENT']) {
      assert.equal(canAccessAdminView(role, 'factory'), false, `${role} must not access factory`)
      assert.equal(canAccessAdminView(role, 'factoryControl'), false, `${role} must not access factoryControl`)
      assert.equal(canManageFactory({ email: 'u@tech360.test', role }), false, `${role} must not manage factory`)
    }
    assert.equal(canAccessAdminView('SUPER_ADMIN', 'factory'), true)
    assert.equal(canAccessAdminView('SUPER_ADMIN', 'factoryControl'), true)
    assert.equal(canManageFactory({ email: 'sa@tech360.test', role: 'SUPER_ADMIN' }), true)
  })

  it('keeps public pages, markdown negotiation, llms.txt, client SOW, and exported archives free of internal Software Factory terms', () => {
    const bannedTerms = ['Software Factory', 'Template Library', 'Module Engine', 'Company Provisioning', 'Deployment & Recovery']

    const publicFiles = [
      'src/components/site/PlatformView.tsx',
      'src/components/site/PremiumSections.tsx',
      'src/data/industries/manufacturing/index.ts',
      'src/app/factory/apps/page.tsx',
      'src/components/factory/runtime/RuntimeApp.tsx',
      'content/llms.txt',
    ]
    for (const rel of publicFiles) {
      const src = readFileSync(join(ROOT, rel), 'utf8')
      for (const term of bannedTerms) {
        assert.ok(!src.toLowerCase().includes(term.toLowerCase()), `${rel} must not expose "${term}"`)
      }
    }

    const platformMd = renderMarkdownForPath('/platform') ?? ''
    for (const term of bannedTerms) {
      assert.ok(!platformMd.toLowerCase().includes(term.toLowerCase()), `/platform markdown must not expose "${term}"`)
    }

    const brief = normalizeBrief({
      appName: 'Acme Portal',
      clientName: 'Acme Corp',
      vertical: 'crm',
      modules: ['leads', 'clients'],
      language: 'EN',
      currency: 'USD',
      primaryColor: '#063B8F',
      primaryContact: 'ops@acme.test',
    })
    const readme = buildFiles(brief, buildPlan(brief)).find((f) => f.path === 'README.md')
    assert.ok(readme && !readme.content.toLowerCase().includes('software factory'))

    const clientSow = formatScopeForClient(
      {
        title: 'Acme CRM',
        summary: 'CRM & Portal',
        factoryManifest: {
          applicationName: 'Acme CRM',
          vertical: 'crm',
          modules: ['leads', 'clients'],
          language: 'EN',
          currency: 'USD',
          primaryColor: '#063B8F',
          deliveryFormat: 'SOURCE_ZIP',
          hostingAndDeployment: 'Client-owned VPS',
          clientResponsibilities: 'Provide DNS & SMTP credentials via secure vault',
        },
      },
      'TECH-2026-000099',
    )
    assert.ok(!clientSow.toLowerCase().includes('software factory'))
    assert.equal(screenAiReply('We build this using our internal Software Factory and Module Engine.').ok, false)
    assert.equal(screenAiReply('The package costs €1,500 in total.').ok, false)
  })
})

describe('5 — Database-backed runtime repairs (lazy agent bootstrap, Hostinger Email AI, offline revision resilience)', { skip: !HAS_DB }, () => {
  const createdClientIds: string[] = []
  const createdCommIds: string[] = []

  after(async () => {
    if (createdCommIds.length > 0) {
      await db.communication.deleteMany({ where: { id: { in: createdCommIds } } }).catch(() => null)
    }
    for (const cid of createdClientIds) {
      await db.approvalRequest.deleteMany({ where: { clientId: cid } }).catch(() => null)
      await db.scopeApproval.deleteMany({ where: { clientId: cid } }).catch(() => null)
      await db.scopeOfWork.deleteMany({ where: { clientId: cid } }).catch(() => null)
      await db.communication.deleteMany({ where: { clientId: cid } }).catch(() => null)
      await db.lead.deleteMany({ where: { clientId: cid } }).catch(() => null)
      await db.client.deleteMany({ where: { id: cid } }).catch(() => null)
    }
  })

  it('lazily persists a missing canonical agent row on first runAgent() call instead of failing with AGENT_NOT_FOUND', async () => {
    await db.aiAgentExecution.deleteMany({ where: { agent: { code: 'CST-020' } } }).catch(() => null)
    await db.aiAgent.deleteMany({ where: { code: 'CST-020' } }).catch(() => null)

    const run = await runAgent('CST-020', {
      input: 'Draft a concise local SEO checklist.',
      workflow: 'TEST_LAZY_BOOTSTRAP',
    })
    assert.notEqual(run.error, 'Agent CST-020 not found in registry')
    const persisted = await db.aiAgent.findUnique({ where: { code: 'CST-020' } })
    assert.ok(persisted, 'canonical agent CST-020 must be lazily persisted in AiAgent table')
    assert.equal(persisted.status, 'ACTIVE')
  })

  it('processes synced Hostinger Mail customer inquiries into canonical TECH-YYYY-NNNNNN leads while suppressing bounces', async () => {
    const uniqueSuffix = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
    const customerEmail = `prospect-${uniqueSuffix}@example.org`

    const customerComm = await db.communication.create({
      data: {
        clientId: null,
        channel: 'EMAIL',
        direction: 'IN',
        sender: customerEmail,
        recipient: 'info@bdtech360.com',
        subject: 'Custom ERP & Portal Inquiry',
        body: 'Hello TECH360, we need a custom inventory and client portal for our distribution company.',
        providerMessageId: `<cust-${uniqueSuffix}@mail.example.org>`,
        status: 'RECEIVED',
        metadata: JSON.stringify({ source: 'HOSTINGER_MAIL_API', orphan: true, senderName: 'Tariq Distribution' }),
      },
    })
    const bounceComm = await db.communication.create({
      data: {
        clientId: null,
        channel: 'EMAIL',
        direction: 'IN',
        sender: 'mailer-daemon@mx.example.org',
        recipient: 'info@bdtech360.com',
        subject: 'Undelivered Mail Returned to Sender',
        body: 'Diagnostic-Code: smtp; 550 5.1.1 mailbox unavailable',
        providerMessageId: `<bounce-${uniqueSuffix}@mx.example.org>`,
        status: 'RECEIVED',
        metadata: JSON.stringify({ source: 'HOSTINGER_MAIL_API', orphan: true }),
      },
    })
    createdCommIds.push(customerComm.id, bounceComm.id)

    const summary = await processHostingerInboundMessages({
      communicationIds: [customerComm.id, bounceComm.id],
    })
    assert.equal(summary.processed, 2)
    assert.equal(summary.leadsCreated, 1)
    assert.equal(summary.bouncesRecorded, 1)

    const createdClient = await db.client.findFirst({ where: { email: customerEmail } })
    assert.ok(createdClient, 'genuine prospective customer email must create a CRM Client')
    createdClientIds.push(createdClient.id)
    assert.match(createdClient.clientId, /^TECH-\d{4}-\d{6}$/)

    const bounceClient = await db.client.findFirst({ where: { email: 'mailer-daemon@mx.example.org' } })
    assert.equal(bounceClient, null, 'mailer-daemon bounce must never create a CRM Client')

    // Idempotent replay must skip already-processed communications
    const replay = await processHostingerInboundMessages({
      communicationIds: [customerComm.id, bounceComm.id],
    })
    assert.equal(replay.leadsCreated, 0)
    assert.equal(replay.skippedDuplicate, 2)
  })

  it('creates v(N+1) ScopeOfWork and HIGH-risk ApprovalRequest on client revision even when AI runtime is offline', async () => {
    const suffix = `${Date.now().toString().slice(-6)}`
    const client = await db.client.create({
      data: {
        clientId: `TECH-2099-${suffix}`,
        name: 'Revision Resilience Co',
        email: `rev-${suffix}@example.org`,
        source: 'WEBSITE',
        status: 'ACTIVE',
        pipelineStage: 'FINAL_SCOPE',
      },
    })
    createdClientIds.push(client.id)

    await db.scopeOfWork.create({
      data: {
        clientId: client.id,
        version: 1,
        status: 'FINAL',
        summary: 'Initial approved baseline scope',
        content: JSON.stringify({ title: 'Web Portal', summary: 'Phase 1 portal' }),
      },
    })

    const decision = await clientScopeDecision(
      client.id,
      'REVISION_REQUESTED',
      'Please also add a native Android and iOS mobile app plus ERP integration.',
    )
    assert.equal(decision.next, 'ADMIN_APPROVAL')
    assert.ok(decision.newScopeId, 'newScopeId must be created even when AI provider is offline')
    assert.equal(decision.outOfScopeReviewRequired, true)

    const v2 = await db.scopeOfWork.findUnique({ where: { id: decision.newScopeId! } })
    assert.ok(v2)
    assert.equal(v2.version, 2)
    assert.equal(v2.status, 'AWAITING_ADMIN_APPROVAL')

    const approval = await db.approvalRequest.findFirst({
      where: { clientId: client.id, type: 'FINAL_SCOPE_SEND' },
      orderBy: { createdAt: 'desc' },
    })
    assert.ok(approval)
    assert.equal(approval.risk, 'HIGH')
  })
})
