import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'

import {
  invoiceGenerationResourceKey,
  isFinancialInvoiceStatus,
  isInvoiceCurrency,
  parseInvoiceAmount,
} from '../src/lib/invoice-policy'

describe('invoice draft input policy', () => {
  it('parses decimal amounts into exact integer minor units', () => {
    assert.deepEqual(parseInvoiceAmount('125'), { cents: 12500, amount: 125 })
    assert.deepEqual(parseInvoiceAmount('125.5'), { cents: 12550, amount: 125.5 })
    assert.deepEqual(parseInvoiceAmount('0.01'), { cents: 1, amount: 0.01 })
  })

  it('rejects zero, negative, exponent, excess precision, and numeric client totals', () => {
    for (const value of ['0', '0.00', '-1.00', '1e3', '1.001', '1.234', '12,000', '', '10000000000']) {
      assert.equal(parseInvoiceAmount(value), null, `expected ${value} to be rejected`)
    }
    assert.equal(parseInvoiceAmount(100), null)
  })

  it('accepts only explicit supported invoice currencies', () => {
    assert.equal(isInvoiceCurrency('USD'), true)
    assert.equal(isInvoiceCurrency('BDT'), true)
    assert.equal(isInvoiceCurrency('CAD'), false)
    assert.equal(isInvoiceCurrency('usd'), false)
    assert.equal(isInvoiceCurrency(null), false)
  })

  it('excludes pre-issue, disputed, voided, cancelled and refunded statuses from financial totals', () => {
    for (const active of ['ISSUED', 'SENT', 'VIEWED', 'PARTIAL', 'PAID', 'OVERDUE']) {
      assert.equal(isFinancialInvoiceStatus(active), true, active)
    }
    for (const excluded of ['DRAFT', 'AWAITING_APPROVAL', 'APPROVED', 'VOID', 'CANCELLED', 'DISPUTED', 'REFUND_PENDING', 'PARTIALLY_REFUNDED', 'REFUNDED']) {
      assert.equal(isFinancialInvoiceStatus(excluded), false, excluded)
    }
  })

  it('binds invoice-generation approval keys across all customer-visible and lifecycle fields', () => {
    const base = {
      clientId: 'c1',
      projectId: 'p1',
      currency: 'USD',
      subtotalMinor: 10_000,
      discountMinor: 0,
      discountReason: null,
      taxRateBps: 0,
      taxLabel: null,
      taxMinor: 0,
      totalMinor: 10_000,
      lineItems: [{ description: 'Milestone 1', quantity: 1, unitMinor: 10_000, amountMinor: 10_000 }],
      description: 'Phase 1',
      scopeVersion: 1,
      billingName: 'Client Name',
      billingBusiness: 'Client Co',
      billingEmail: 'billing@client.test',
      billingAddress: '123 Main St',
      billingCountry: 'US',
      paymentTerms: 'Net 7',
      paymentMethodsSnapshot: 'Stripe',
      termsVersion: 'v1',
      customerNotes: 'Note A',
      dueAt: new Date('2026-12-01T00:00:00.000Z'),
      initialStatus: 'DRAFT',
    }
    const key = invoiceGenerationResourceKey(base)
    assert.equal(invoiceGenerationResourceKey({ ...base }), key)
    assert.notEqual(invoiceGenerationResourceKey({ ...base, discountMinor: 100 }), key)
    assert.notEqual(invoiceGenerationResourceKey({ ...base, taxRateBps: 500 }), key)
    assert.notEqual(invoiceGenerationResourceKey({ ...base, billingAddress: 'Other' }), key)
    assert.notEqual(invoiceGenerationResourceKey({ ...base, paymentTerms: 'Net 15' }), key)
    assert.notEqual(invoiceGenerationResourceKey({ ...base, customerNotes: 'Note B' }), key)
    assert.notEqual(invoiceGenerationResourceKey({ ...base, initialStatus: 'AWAITING_APPROVAL' }), key)
  })

  it('guards single-invoice lifecycle transitions with compare-and-set transactions and overdue verification', () => {
    const route = readFileSync('src/app/api/admin/invoices/[number]/route.ts', 'utf8')
    assert.match(route, /tx\.invoice\.updateMany\(\{\s*where:\s*\{\s*id:\s*invoice\.id,\s*status:\s*invoice\.status\s*\}/)
    assert.match(route, /currentSettlement\.nextStatus !== 'OVERDUE'/)
    assert.match(route, /renderInvoiceEmailBodyHtml/)
  })
})
