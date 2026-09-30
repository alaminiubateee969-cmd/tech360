import assert from 'node:assert/strict'
import { createHmac } from 'node:crypto'
import { describe, it } from 'node:test'

import { canDecideApproval, hasRole, isSuperAdmin } from '../src/lib/access-policy'
import { evaluateHandoverGate, evaluateStripePayment, verifyStripeSignature } from '../src/lib/commerce-policy'
import { normalizeUploadName, resolveExt, scanDocumentBytes } from '../src/lib/files'
import { evaluateProjectClosure } from '../src/lib/lifecycle-policy'

const user = (role: string) => ({ role })

describe('authentication and RBAC policy', () => {
  it('rejects anonymous and insufficient roles', () => {
    assert.equal(hasRole(null, 'ADMIN'), false)
    assert.equal(hasRole(user('STAFF'), 'ADMIN'), false)
    assert.equal(hasRole(user('MANAGER'), 'ADMIN'), false)
  })

  it('allows only roles at or above the required rank', () => {
    assert.equal(hasRole(user('ADMIN'), 'ADMIN'), true)
    assert.equal(hasRole(user('SUPER_ADMIN'), 'ADMIN'), true)
    assert.equal(hasRole(user('ADMIN'), 'SUPER_ADMIN'), false)
  })

  it('reserves pending approval decisions for super administrators', () => {
    assert.equal(isSuperAdmin(user('SUPER_ADMIN')), true)
    assert.equal(canDecideApproval(user('ADMIN'), 'PENDING'), false)
    assert.equal(canDecideApproval(user('SUPER_ADMIN'), 'EXECUTED'), false)
    assert.equal(canDecideApproval(user('SUPER_ADMIN'), 'PENDING'), true)
  })
})

describe('handover payment and authorization gate', () => {
  const future = new Date('2030-01-01T00:00:00Z')
  const now = new Date('2026-09-30T00:00:00Z')

  it('blocks source access before explicit release', () => {
    assert.deepEqual(evaluateHandoverGate({ status: 'PREPARED', totalAmount: 1000, paidAmount: 1000, expiryAt: future, now }), { allowed: false, code: 'NOT_RELEASED' })
  })

  it('blocks a released package until full verified payment', () => {
    assert.deepEqual(evaluateHandoverGate({ status: 'RELEASED', totalAmount: 1000, paidAmount: 999.99, expiryAt: future, now }), { allowed: false, code: 'PAYMENT_INCOMPLETE' })
  })

  it('blocks expired links and allows fully paid released packages', () => {
    assert.deepEqual(evaluateHandoverGate({ status: 'RELEASED', totalAmount: 1000, paidAmount: 1000, expiryAt: new Date('2026-01-01'), now }), { allowed: false, code: 'EXPIRED' })
    assert.deepEqual(evaluateHandoverGate({ status: 'RELEASED', totalAmount: 1000, paidAmount: 1000, expiryAt: future, now }), { allowed: true })
  })
})

describe('file upload validation and quarantine policy', () => {
  it('requires MIME and extension agreement and normalizes traversal names', () => {
    assert.equal(resolveExt('application/pdf', 'invoice.exe'), null)
    assert.equal(resolveExt('application/pdf', 'invoice.pdf'), 'pdf')
    assert.equal(normalizeUploadName('../../private/brief.txt', 'document.txt'), 'brief.txt')
    assert.equal(normalizeUploadName('..\\..\\private\\brief.txt', 'document.txt'), 'brief.txt')
  })

  it('quarantines executable, script and encoded payload content', () => {
    assert.equal(scanDocumentBytes(Buffer.from([0x4d, 0x5a, 0, 0]), 'text/plain', 'notes.txt').status, 'QUARANTINED')
    assert.equal(scanDocumentBytes(Buffer.from('<script>alert(1)</script>'), 'text/plain', 'notes.txt').status, 'QUARANTINED')
    assert.equal(scanDocumentBytes(Buffer.from('eval(atob("payload"))'), 'text/plain', 'notes.txt').status, 'QUARANTINED')
  })

  it('rejects forged binary signatures without claiming external malware scanning', () => {
    assert.equal(scanDocumentBytes(Buffer.from('not a pdf'), 'application/pdf', 'invoice.pdf').status, 'QUARANTINED')
    const pdf = scanDocumentBytes(Buffer.from('%PDF-1.7\nstructurally valid fixture'), 'application/pdf', 'invoice.pdf')
    assert.equal(pdf.status, 'SCANNED')
    assert.match(pdf.notes.join(' '), /external malware scanning is not configured/)
  })
})

describe('project closure lifecycle policy', () => {
  const complete = { totalAmount: 1000, paidAmount: 1000, taskStatuses: ['DONE', 'DONE'], deliveryStatus: 'CONFIRMED', handoverStatus: 'CONFIRMED' }

  it('blocks closure on each missing business gate', () => {
    assert.deepEqual(evaluateProjectClosure({ ...complete, paidAmount: 999 }), { allowed: false, code: 'PAYMENT_INCOMPLETE' })
    assert.deepEqual(evaluateProjectClosure({ ...complete, taskStatuses: ['DONE', 'REVIEW'] }), { allowed: false, code: 'TASKS_INCOMPLETE' })
    assert.deepEqual(evaluateProjectClosure({ ...complete, deliveryStatus: 'PREPARED' }), { allowed: false, code: 'DELIVERY_NOT_ACCEPTED' })
    assert.deepEqual(evaluateProjectClosure({ ...complete, handoverStatus: 'DOWNLOADED' }), { allowed: false, code: 'HANDOVER_NOT_CONFIRMED' })
  })

  it('allows closure only after payment, work, delivery and handover acceptance', () => {
    assert.deepEqual(evaluateProjectClosure(complete), { allowed: true })
  })
})

describe('Stripe payment verification and idempotency', () => {
  it('treats an already-paid record as an idempotent duplicate', () => {
    assert.deepEqual(evaluateStripePayment({ currentStatus: 'PAID', expectedAmount: 125.5, expectedCurrency: 'USD', receivedMinor: 12550, receivedCurrency: 'USD' }), { action: 'DUPLICATE' })
  })

  it('rejects amount and currency mismatches before settlement', () => {
    assert.deepEqual(evaluateStripePayment({ currentStatus: 'PENDING', expectedAmount: 125.5, expectedCurrency: 'USD', receivedMinor: 12549, receivedCurrency: 'USD' }), { action: 'REJECT_AMOUNT', expectedMinor: 12550 })
    assert.deepEqual(evaluateStripePayment({ currentStatus: 'PENDING', expectedAmount: 125.5, expectedCurrency: 'USD', receivedMinor: 12550, receivedCurrency: 'BDT' }), { action: 'REJECT_CURRENCY' })
  })

  it('allows settlement only after exact platform-record matching', () => {
    assert.deepEqual(evaluateStripePayment({ currentStatus: 'PENDING', expectedAmount: 125.5, expectedCurrency: 'usd', receivedMinor: 12550, receivedCurrency: 'USD' }), { action: 'SETTLE' })
  })

  it('verifies a current provider signature and rejects tampering/replay', async () => {
    const secret = 'unit-test-signing-secret'
    const body = JSON.stringify({ type: 'checkout.session.completed', data: { object: { id: 'cs_test' } } })
    const timestamp = 1_800_000_000
    const signature = createHmac('sha256', secret).update(`${timestamp}.${body}`).digest('hex')
    assert.deepEqual(await verifyStripeSignature(body, `t=${timestamp},v1=${signature}`, secret, timestamp), { ok: true, timestamp })
    assert.equal((await verifyStripeSignature(`${body}x`, `t=${timestamp},v1=${signature}`, secret, timestamp)).ok, false)
    const replay = await verifyStripeSignature(body, `t=${timestamp},v1=${signature}`, secret, timestamp + 301)
    assert.equal(replay.ok, false)
  })
})
