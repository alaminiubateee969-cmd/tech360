import assert from 'node:assert/strict'
import { it } from 'node:test'
import { sourcePaymentEvidence } from '../src/lib/source-payment'

it('requires same-currency verified payments net of settled refunds and a positive project total', () => {
  const payment = { amount: 100, currency: 'USD', status: 'PAID', verifiedAt: new Date(), verifiedBy: 'reviewer' }
  const check = (payments: Array<{ amount: number; currency: string; status: string; verifiedAt: Date | null; verifiedBy: string | null }> = [payment], refunds: Array<{ approvedAmountMinor: number; currency: string; settledAt: Date | null; status: string }> = [], totalAmount = 100) => sourcePaymentEvidence({ totalAmount, currency: 'USD', payments, refunds })
  assert.equal(check().cleared, true)
  assert.equal(check([{ ...payment, verifiedAt: null }]).cleared, false)
  assert.equal(check([{ ...payment, verifiedBy: null }]).cleared, false)
  assert.equal(check([{ ...payment, verifiedBy: ' ' }]).cleared, false)
  assert.equal(check([{ ...payment, status: 'REFUNDED' }]).cleared, false)
  assert.equal(check([payment], [{ approvedAmountMinor: 1000, currency: 'USD', settledAt: new Date(), status: 'CLOSED' }]).cleared, false)
  assert.equal(check([{ ...payment, currency: 'BDT' }]).cleared, false)
  assert.equal(check([payment], [], 0).cleared, false)
  assert.equal(check([], [], 0.001).cleared, false)
  assert.equal(check([payment], [{ approvedAmountMinor: 1000, currency: 'USD', settledAt: new Date(), status: 'PARTIALLY_REFUNDED' }]).cleared, false)
  assert.equal(check([payment], [{ approvedAmountMinor: 1000, currency: 'BDT', settledAt: new Date(), status: 'PARTIALLY_REFUNDED' }]).cleared, false)
})
