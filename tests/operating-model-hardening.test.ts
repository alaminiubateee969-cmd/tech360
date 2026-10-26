import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  createInMemorySequenceStore,
  createSequenceAllocator,
  maxSequenceFromIdentifiers,
  parseSequenceSuffix,
} from '../src/lib/ids'
import {
  hasCapability,
  hasRole,
  isReadOnlyRole,
  isValidRole,
  ROLE_CAPABILITIES,
} from '../src/lib/access-policy'
import { ROLES } from '../src/lib/constants'
import {
  detectDuplicateClients,
  validateClientMergeRequest,
} from '../src/lib/crm-merge'
import {
  buildChangeRequestScopeContent,
  canEditScopeInPlace,
  nextScopeVersionNumber,
  normalizeTo21PointScope,
  SCOPE_21_SECTIONS,
  validate21PointScope,
} from '../src/lib/scope-validator'
import {
  canDecidePreview,
  forwardPipelineStage,
  hasAcceptedPreviewDelivery,
} from '../src/lib/preview-policy'
import {
  canEditInvoiceFields,
  canTransitionInvoiceStatus,
  computeInvoiceSettlement,
  computeInvoiceTotals,
  computeNetProjectPaidMinor,
  evaluateReceiptEligibility,
  evaluateRefundSettlement,
  isCustomerVisibleInvoiceStatus,
  isPayableInvoiceStatus,
} from '../src/lib/invoice-policy'
import {
  DOCUMENT_HTML_HEADERS,
  renderInvoiceDocumentHtml,
  renderReceiptDocumentHtml,
} from '../src/lib/invoice-document'
import {
  DOCUMENT_SECURITY_HEADERS,
  INLINE_SAFE_MIMES,
  scanDocumentBytes,
} from '../src/lib/files'

// ============================================================
// 1. CONCURRENCY-SAFE MONOTONIC IDENTIFIER SEQUENCES
// ============================================================

describe('operating model — concurrency-safe monotonic sequence allocator', () => {
  it('allocates canonical TECH, PRJ, INV, RCT, and RFD identifiers with exact digit padding', async () => {
    const store = createInMemorySequenceStore()
    const allocate = createSequenceAllocator(store, {
      TECH: async () => 0,
      PRJ: async () => 0,
      INV: async () => 0,
      RCT: async () => 0,
      RFD: async () => 0,
    })
    const now = new Date('2026-10-23T12:00:00Z')

    assert.equal(await allocate({ prefix: 'TECH-', digits: 6 }, now), 'TECH-2026-000001')
    assert.equal(await allocate({ prefix: 'PRJ-', digits: 4 }, now), 'PRJ-2026-0001')
    assert.equal(await allocate({ prefix: 'INV-', digits: 4 }, now), 'INV-2026-0001')
    assert.equal(await allocate({ prefix: 'RCT-', digits: 4 }, now), 'RCT-2026-0001')
    assert.equal(await allocate({ prefix: 'RFD-', digits: 4 }, now), 'RFD-2026-0001')
  })

  it('produces strictly unique, gap-free IDs under 50 concurrent requests', async () => {
    const store = createInMemorySequenceStore()
    const allocate = createSequenceAllocator(store, { TECH: async () => 0 })
    const now = new Date('2026-10-23T12:00:00Z')

    const generated = await Promise.all(
      Array.from({ length: 50 }, () => allocate({ prefix: 'TECH', digits: 6 }, now)),
    )

    assert.equal(new Set(generated).size, 50)
    const sorted = [...generated].sort()
    assert.equal(sorted[0], 'TECH-2026-000001')
    assert.equal(sorted[49], 'TECH-2026-000050')
  })

  it('never reuses identifiers after record deletion or merge and rolls over cleanly across years', async () => {
    // Simulate a database where TECH-2026-000001..000041 were deleted and TECH-2026-000042 remains in audit/history
    const survivingHistory = ['TECH-2026-000007', 'TECH-2026-000042', 'TECH-2025-000999']
    const store = createInMemorySequenceStore()
    const allocate = createSequenceAllocator(store, {
      TECH: async (year) => maxSequenceFromIdentifiers(survivingHistory, 'TECH', year),
    })

    const id2026 = await allocate({ prefix: 'TECH', digits: 6 }, new Date('2026-12-31T23:59:59Z'))
    const id2027 = await allocate({ prefix: 'TECH', digits: 6 }, new Date('2027-01-01T00:00:00Z'))
    const id2026Next = await allocate({ prefix: 'TECH', digits: 6 }, new Date('2026-12-31T23:59:59Z'))

    assert.equal(id2026, 'TECH-2026-000043')
    assert.equal(id2027, 'TECH-2027-000001')
    assert.equal(id2026Next, 'TECH-2026-000044')
    assert.equal(parseSequenceSuffix('TECH-2026-000042', 'TECH', 2026), 42)
    assert.equal(parseSequenceSuffix('TECH-2025-000042', 'TECH', 2026), 0)
  })
})

// ============================================================
// 2. LEAST-PRIVILEGE 10-ROLE RBAC & READ-ONLY AUDITOR
// ============================================================

describe('operating model — 10-role least-privilege RBAC and read-only Auditor', () => {
  it('registers all 10 required enterprise roles with explicit capability sets', () => {
    const expected = [
      'SUPER_ADMIN',
      'ADMIN',
      'FINANCE',
      'PROJECT_MANAGER',
      'MANAGER',
      'AUDITOR',
      'DEVELOPER',
      'SALES',
      'SUPPORT',
      'STAFF',
    ]
    for (const r of expected) {
      assert.equal(ROLES.includes(r as (typeof ROLES)[number]), true, `missing role ${r}`)
      assert.equal(isValidRole(r), true)
      assert.ok(ROLE_CAPABILITIES[r as keyof typeof ROLE_CAPABILITIES] instanceof Set)
    }
    assert.equal(isValidRole('ROOT'), false)
  })

  it('restricts payment verification, refund settlement, source handover release, team & settings to SUPER_ADMIN', () => {
    const exclusive = [
      'finance.payment.verify',
      'finance.refund.decide',
      'handover.release',
      'team.manage',
      'settings.manage',
    ] as const

    for (const cap of exclusive) {
      assert.equal(hasCapability({ role: 'SUPER_ADMIN' }, cap), true)
      for (const nonSuper of ['ADMIN', 'FINANCE', 'PROJECT_MANAGER', 'MANAGER', 'AUDITOR', 'DEVELOPER', 'SALES', 'SUPPORT', 'STAFF']) {
        assert.equal(hasCapability({ role: nonSuper }, cap), false, `${nonSuper} must NOT hold ${cap}`)
      }
    }
  })

  it('grants FINANCE invoice/refund-request capabilities without handover or CRM merge access', () => {
    const fin = { role: 'FINANCE' }
    assert.equal(hasCapability(fin, 'finance.read'), true)
    assert.equal(hasCapability(fin, 'finance.invoice.write'), true)
    assert.equal(hasCapability(fin, 'finance.invoice.approve'), true)
    assert.equal(hasCapability(fin, 'finance.refund.request'), true)
    assert.equal(hasCapability(fin, 'crm.merge'), false)
    assert.equal(hasCapability(fin, 'scope.write'), false)
    assert.equal(hasCapability(fin, 'delivery.prepare'), false)
  })

  it('keeps AUDITOR strictly read-only across every domain capability', () => {
    const auditor = { role: 'AUDITOR' }
    assert.equal(isReadOnlyRole(auditor), true)
    assert.equal(isReadOnlyRole({ role: 'SUPER_ADMIN' }), false)
    assert.equal(hasRole(auditor, 'MANAGER'), true)

    assert.equal(hasCapability(auditor, 'audit.read'), true)
    assert.equal(hasCapability(auditor, 'crm.read'), true)
    assert.equal(hasCapability(auditor, 'finance.read'), true)
    assert.equal(hasCapability(auditor, 'project.read'), true)

    for (const writeCap of [
      'crm.write',
      'crm.merge',
      'comms.send',
      'scope.write',
      'scope.approve',
      'preview.manage',
      'finance.invoice.write',
      'finance.invoice.approve',
      'finance.payment.record',
      'finance.payment.verify',
      'finance.refund.request',
      'finance.refund.decide',
      'project.write',
      'delivery.prepare',
      'handover.release',
      'team.manage',
      'settings.manage',
    ] as const) {
      assert.equal(hasCapability(auditor, writeCap), false, `AUDITOR must not have ${writeCap}`)
    }
  })
})

// ============================================================
// 3. CRM DUPLICATE DETECTION & AUDITABLE MERGE POLICY
// ============================================================

describe('operating model — CRM duplicate detection and merge validation', () => {
  it('flags normalized email, WhatsApp/phone, and business-name duplicates while ignoring deleted or merged rows', () => {
    const primary = {
      id: 'c1',
      clientId: 'TECH-2026-000001',
      name: 'Rahim Uddin',
      businessName: 'Bengal Cargo Logistics',
      email: 'Rahim@BengalCargo.com',
      phone: '+880 1712-345678',
      whatsapp: '+8801712345678',
      status: 'CLIENT',
      pipelineStage: 'DEVELOPMENT',
    }
    const candidates = [
      {
        id: 'c2',
        clientId: 'TECH-2026-000002',
        name: 'R. Uddin',
        businessName: 'bengal   cargo logistics',
        email: 'rahim@bengalcargo.com',
        phone: null,
        whatsapp: '880-1712-345678',
        status: 'LEAD',
        pipelineStage: 'NEW',
      },
      {
        id: 'c3',
        clientId: 'TECH-2026-000003',
        name: 'Already Merged',
        email: 'rahim@bengalcargo.com',
        status: 'MERGED',
        pipelineStage: 'NEW',
        mergedIntoId: 'c1',
      },
      {
        id: 'c4',
        clientId: 'TECH-2026-000004',
        name: 'Soft Deleted',
        email: 'rahim@bengalcargo.com',
        status: 'ARCHIVED',
        pipelineStage: 'NEW',
        deletedAt: new Date(),
      },
    ]

    const matches = detectDuplicateClients(primary, candidates)
    assert.equal(matches.length, 1)
    assert.equal(matches[0].client.clientId, 'TECH-2026-000002')
    assert.deepEqual(matches[0].reasons, ['EMAIL_MATCH', 'WHATSAPP_MATCH', 'BUSINESS_NAME_MATCH'])
  })

  it('rejects self-merges, already-merged sources, inactive targets, and missing audit reasons', () => {
    const activeA = { id: 'c1', clientId: 'TECH-2026-000001', deletedAt: null, mergedIntoId: null }
    const activeB = { id: 'c2', clientId: 'TECH-2026-000002', deletedAt: null, mergedIntoId: null }

    assert.equal(validateClientMergeRequest({ target: activeA, source: activeA, reason: 'Same customer verified via email' }).ok, false)
    assert.equal(validateClientMergeRequest({ target: activeA, source: activeB, reason: 'too short' }).ok, false)
    assert.equal(
      validateClientMergeRequest({
        target: activeA,
        source: { ...activeB, mergedIntoId: 'c9' },
        reason: 'Verified duplicate client submission on live chat',
      }).ok,
      false,
    )
    assert.equal(
      validateClientMergeRequest({
        target: activeA,
        source: activeB,
        reason: 'Verified duplicate lead submitted from WhatsApp and web form.',
      }).ok,
      true,
    )
  })
})

// ============================================================
// 4. 21-SECTION SCOPE OF WORK & CHANGE REQUEST VERSIONING
// ============================================================

describe('operating model — 21-section Scope of Work and immutable Change Requests', () => {
  it('enforces all 21 required sections and upgrades legacy drafts cleanly', () => {
    assert.equal(SCOPE_21_SECTIONS.length, 21)

    const incomplete = validate21PointScope({ sections: { clientOverview: 'Acme Corp' } })
    assert.equal(incomplete.valid, false)
    assert.equal(incomplete.missingSections.length, 20)

    const normalized = normalizeTo21PointScope(
      { title: 'Acme E-Commerce Platform', summary: 'Custom storefront and admin inventory.' },
      { clientId: 'TECH-2026-000010', clientName: 'Acme Owner', businessName: 'Acme Ltd', businessType: 'Retail' },
    )
    const validated = validate21PointScope(normalized)
    assert.equal(validated.valid, true)
    assert.equal(validated.presentCount, 21)
  })

  it('treats APPROVED and FINAL scopes as immutable and requires cost/timeline impact on Change Requests', () => {
    assert.equal(canEditScopeInPlace('DRAFT'), true)
    assert.equal(canEditScopeInPlace('AWAITING_ADMIN_APPROVAL'), true)
    assert.equal(canEditScopeInPlace('APPROVED'), false)
    assert.equal(canEditScopeInPlace('FINAL'), false)
    assert.equal(canEditScopeInPlace('SUPERSEDED'), false)

    assert.equal(nextScopeVersionNumber([1, 3, 2]), 4)

    const base = normalizeTo21PointScope(
      { title: 'Portal v1' },
      { clientId: 'TECH-2026-000010', clientName: 'Acme' },
    )
    const missingCost = buildChangeRequestScopeContent({
      priorContent: base,
      priorVersion: 1,
      reason: 'Client requested multi-warehouse inventory sync',
      costImpact: '',
      timelineImpact: '+5 business days',
      requestedBy: 'pm@bdtech360.com',
    })
    assert.equal(missingCost.ok, false)

    const cr = buildChangeRequestScopeContent({
      priorContent: base,
      priorVersion: 1,
      updatedSections: { includedFeatures: 'Storefront + Multi-warehouse sync' },
      reason: 'Client requested multi-warehouse inventory sync',
      costImpact: '+$750.00 USD',
      timelineImpact: '+5 business days',
      requestedBy: 'pm@bdtech360.com',
    })
    assert.equal(cr.ok, true)
    if (cr.ok) {
      assert.equal(validate21PointScope(cr.content).valid, true)
      assert.equal((cr.content.changeRequest as { supersedesVersion: number }).supersedesVersion, 1)
    }
  })
})

// ============================================================
// 5. HTML PREVIEW TERMINAL LOCK & STAGE REGRESSION GUARD
// ============================================================

describe('operating model — secure HTML preview terminal lock and stage monotonicity', () => {
  it('locks APPROVED, REVISION_REQUESTED, and EXPIRED previews against replay while keeping GENERATED/SENT/VIEWED actionable', () => {
    assert.equal(canDecidePreview('GENERATED'), true)
    assert.equal(canDecidePreview('SENT'), true)
    assert.equal(canDecidePreview('VIEWED'), true)
    assert.equal(canDecidePreview('APPROVED'), false)
    assert.equal(canDecidePreview('REVISION_REQUESTED'), false)
    assert.equal(canDecidePreview('EXPIRED'), false)

    assert.equal(hasAcceptedPreviewDelivery([{ channel: 'EMAIL', status: 'SENT', ok: true }]), true)
    assert.equal(hasAcceptedPreviewDelivery([{ channel: 'EMAIL', status: 'NOT_CONFIGURED', ok: false }]), false)
  })

  it('never regresses a client pipeline stage backwards when an older preview link is viewed', () => {
    assert.equal(forwardPipelineStage('FINAL_SCOPE', 'CLIENT_APPROVAL'), 'CLIENT_APPROVAL')
    assert.equal(forwardPipelineStage('CLIENT_APPROVAL', 'PAYMENT_PENDING'), 'PAYMENT_PENDING')
    assert.equal(forwardPipelineStage('DEVELOPMENT', 'CLIENT_APPROVAL'), 'DEVELOPMENT')
    assert.equal(forwardPipelineStage('HANDOVER', 'PAYMENT_PENDING'), 'HANDOVER')
  })
})

// ============================================================
// 6. CREATE INVOICE ENGINE, STATE MACHINE & XSS-SAFE RENDERING
// ============================================================

describe('operating model — Create Invoice minor-unit math, lifecycle, and XSS-safe document rendering', () => {
  it('computes exact integer minor-unit totals and rejects tampered client totals, mixed currencies, and missing labels', () => {
    const valid = computeInvoiceTotals({
      currency: 'USD',
      lineItems: [
        { description: 'UI/UX & HTML Preview', quantity: 1, unitPrice: 499.99 },
        { description: 'Backend Modules', quantity: 3, unitPrice: 199.95 },
      ],
      discountAmount: 50,
      discountReason: 'Early commitment partner discount',
      taxRatePercent: 8.25,
      taxLabel: 'MO Sales Tax',
    })
    assert.equal(valid.ok, true)
    if (valid.ok) {
      // Subtotal: 49999 + 59985 = 109984 ($1,099.84)
      // Discount: 5000 ($50.00) -> Taxable: 104984 ($1,049.84)
      // Tax 8.25% (825 bps): round(104984 * 825 / 10000) = round(8661.18) = 8661 ($86.61)
      // Total: 113645 ($1,136.45)
      assert.equal(valid.subtotalMinor, 109_984)
      assert.equal(valid.discountMinor, 5_000)
      assert.equal(valid.taxMinor, 8_661)
      assert.equal(valid.totalMinor, 113_645)
      assert.equal(valid.totalMajor, 1136.45)
    }

    const tampered = computeInvoiceTotals({
      currency: 'USD',
      lineItems: [{ description: 'Web App', quantity: 1, unitPrice: 1000 }],
      expectedTotalMinor: 1000, // client claimed $10.00 on a $1,000.00 item
    })
    assert.equal(tampered.ok, false)
    if (!tampered.ok) assert.equal(tampered.code, 'CLIENT_TOTAL_MISMATCH')

    const mixedCurrency = computeInvoiceTotals({
      currency: 'USD',
      lineItems: [{ description: 'Item', quantity: 1, unitPrice: 100, currency: 'EUR' }],
    })
    assert.equal(mixedCurrency.ok, false)

    const discountNoReason = computeInvoiceTotals({
      currency: 'USD',
      lineItems: [{ description: 'Item', quantity: 1, unitPrice: 100 }],
      discountAmount: 10,
    })
    assert.equal(discountNoReason.ok, false)

    const taxNoLabel = computeInvoiceTotals({
      currency: 'USD',
      lineItems: [{ description: 'Item', quantity: 1, unitPrice: 100 }],
      taxRatePercent: 5,
    })
    assert.equal(taxNoLabel.ok, false)
  })

  it('enforces invoice state transitions, immutability after approval/issuance, and portal visibility gates', () => {
    assert.equal(canTransitionInvoiceStatus('DRAFT', 'AWAITING_APPROVAL'), true)
    assert.equal(canTransitionInvoiceStatus('AWAITING_APPROVAL', 'APPROVED'), true)
    assert.equal(canTransitionInvoiceStatus('APPROVED', 'ISSUED'), true)
    assert.equal(canTransitionInvoiceStatus('ISSUED', 'SENT'), true)
    assert.equal(canTransitionInvoiceStatus('SENT', 'VIEWED'), true)
    assert.equal(canTransitionInvoiceStatus('DRAFT', 'PAID'), false)
    assert.equal(canTransitionInvoiceStatus('PAID', 'VOID'), false)

    assert.equal(canEditInvoiceFields('DRAFT'), true)
    assert.equal(canEditInvoiceFields('AWAITING_APPROVAL'), true)
    assert.equal(canEditInvoiceFields('APPROVED'), false)
    assert.equal(canEditInvoiceFields('ISSUED'), false)
    assert.equal(canEditInvoiceFields('PAID'), false)

    for (const hidden of ['DRAFT', 'AWAITING_APPROVAL', 'APPROVED']) {
      assert.equal(isCustomerVisibleInvoiceStatus(hidden), false)
      assert.equal(isPayableInvoiceStatus(hidden), false)
    }
    for (const payable of ['ISSUED', 'SENT', 'VIEWED', 'PARTIAL', 'OVERDUE']) {
      assert.equal(isCustomerVisibleInvoiceStatus(payable), true)
      assert.equal(isPayableInvoiceStatus(payable), true)
    }
    assert.equal(isPayableInvoiceStatus('PAID'), false)
    assert.equal(isPayableInvoiceStatus('VOID'), false)
  })

  it('escapes untrusted HTML, enforces script-src none CSP, hides internalNotes, and renders honest Not Configured readiness', () => {
    assert.match(DOCUMENT_HTML_HEADERS['Content-Security-Policy'], /script-src 'none'/)

    const html = renderInvoiceDocumentHtml(
      {
        number: 'INV-2026-0009',
        status: 'ISSUED',
        currency: 'USD',
        amount: 500,
        subtotalMinor: 50000,
        totalMinor: 50000,
        lineItems: JSON.stringify([
          { description: '<script>alert("xss")</script> Core Build', quantity: 1, unitMinor: 50000, amountMinor: 50000 },
        ]),
        customerNotes: 'Thank you <img src=x onerror=alert(1)>',
        internalNotes: 'CONFIDENTIAL_STAFF_MARGIN_NOTE_DO_NOT_LEAK',
        notes: 'CONFIDENTIAL_STAFF_MARGIN_NOTE_DO_NOT_LEAK',
        issuedAt: '2026-10-23T00:00:00Z',
        client: {
          clientId: 'TECH-2026-000099',
          name: '<b>Evil Corp</b>',
          email: 'billing@example.com',
        },
      },
      'Not Configured — Payment setup required',
    )

    assert.ok(!html.includes('<script>alert("xss")</script>'))
    assert.ok(!html.includes('<img src=x onerror=alert(1)>'))
    assert.ok(html.includes('&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;'))
    assert.ok(!html.includes('CONFIDENTIAL_STAFF_MARGIN_NOTE_DO_NOT_LEAK'))
    assert.ok(html.includes('Not Configured — Payment setup required'))
  })
})

// ============================================================
// 7. VERIFIED-ONLY RECEIPTS, REFUNDS & HANDOVER SUSPENSION
// ============================================================

describe('operating model — verified-only receipts, refund settlement, and handover revocation', () => {
  it('issues official payment receipts strictly for verified PAID payments', () => {
    assert.equal(evaluateReceiptEligibility({ status: 'PENDING', amount: 500, verifiedAt: null, verifiedBy: null }).allowed, false)
    assert.equal(evaluateReceiptEligibility({ status: 'PAID', amount: 500, verifiedAt: null, verifiedBy: 'admin-1' }).allowed, false)
    assert.equal(evaluateReceiptEligibility({ status: 'PAID', amount: 500, verifiedAt: new Date(), verifiedBy: '' }).allowed, false)
    assert.equal(evaluateReceiptEligibility({ status: 'FAILED', amount: 500, verifiedAt: new Date(), verifiedBy: 'admin-1' }).allowed, false)
    assert.equal(evaluateReceiptEligibility({ status: 'PAID', amount: 500, verifiedAt: new Date(), verifiedBy: 'admin-1' }).allowed, true)

    const receiptHtml = renderReceiptDocumentHtml({
      receiptNumber: 'RCT-2026-0001',
      amountMinor: 50000,
      currency: 'USD',
      method: 'BANK_TRANSFER',
      transactionId: 'TRX-998877',
      verifiedBy: 'superadmin@bdtech360.com',
      verifiedAt: '2026-10-23T14:00:00Z',
      issuedAt: '2026-10-23T14:00:01Z',
      invoiceNumber: 'INV-2026-0009',
      client: { clientId: 'TECH-2026-000099', name: 'Bengal Cargo' },
    })
    assert.ok(receiptHtml.includes('RCT-2026-0001'))
    assert.ok(receiptHtml.includes('OFFICIAL VERIFIED RECEIPT'))
  })

  it('calculates partial settlement accurately and ignores unverified payments', () => {
    const partial = computeInvoiceSettlement({
      invoiceAmount: 1000,
      invoiceTotalMinor: 100_000,
      currentStatus: 'ISSUED',
      dueAt: new Date('2026-12-01T00:00:00Z'),
      now: new Date('2026-10-23T00:00:00Z'),
      payments: [
        { amount: 400, status: 'PAID', verifiedAt: new Date() },
        { amount: 600, status: 'PENDING', verifiedAt: null }, // unverified -> ignored
        { amount: 600, status: 'PAID', verifiedAt: null }, // unverified PAID -> ignored
      ],
    })
    assert.equal(partial.paidMinor, 40_000)
    assert.equal(partial.remainingMinor, 60_000)
    assert.equal(partial.nextStatus, 'PARTIAL')
  })

  it('recomputes net project balance after a refund and suspends source-code handover when full payment is broken', () => {
    const net = computeNetProjectPaidMinor({
      payments: [
        { amount: 1000, status: 'PAID', verifiedAt: new Date() },
        { amount: 500, status: 'PENDING', verifiedAt: null },
      ],
      settledRefundsMinor: [25_000],
    })
    assert.equal(net.grossVerifiedMinor, 100_000)
    assert.equal(net.netPaidMinor, 75_000)

    const postRefund = evaluateRefundSettlement({
      projectTotalAmount: 1000,
      grossVerifiedMinor: net.grossVerifiedMinor,
      totalSettledRefundsMinor: 25_000,
      invoiceTotalMinor: 100_000,
      invoicePaidMinorBeforeRefunds: 100_000,
      invoiceRefundedMinor: 25_000,
    })
    assert.equal(postRefund.netProjectPaidMinor, 75_000)
    assert.equal(postRefund.projectPaymentStatus, 'PARTIAL')
    assert.equal(postRefund.shouldSuspendHandover, true)
    assert.equal(postRefund.nextInvoiceStatus, 'PARTIALLY_REFUNDED')
  })
})

// ============================================================
// 8. STORED XSS DOCUMENT DOWNLOAD HARDENING
// ============================================================

describe('operating model — stored XSS prevention on uploaded documents', () => {
  it('never permits HTML, SVG, XML, or script MIME types in INLINE_SAFE_MIMES and enforces sandbox CSP', () => {
    for (const dangerous of ['text/html', 'image/svg+xml', 'application/xhtml+xml', 'text/xml', 'application/javascript']) {
      assert.equal(INLINE_SAFE_MIMES.has(dangerous), false, `${dangerous} must never be served inline`)
    }
    assert.match(DOCUMENT_SECURITY_HEADERS['Content-Security-Policy'], /sandbox/)
    assert.equal(DOCUMENT_SECURITY_HEADERS['X-Content-Type-Options'], 'nosniff')
  })

  it('quarantines HTML uploads containing embedded <script> tags or inline event handlers', () => {
    const maliciousHtml = Buffer.from('<!doctype html><html><body onload="fetch(\'/api/portal/me\')">Hello</body></html>')
    const scan = scanDocumentBytes(maliciousHtml, 'text/html', 'invoice-preview.html')
    assert.equal(scan.status, 'QUARANTINED')
  })
})
