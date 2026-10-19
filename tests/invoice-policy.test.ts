import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { isInvoiceCurrency, parseInvoiceAmount } from '../src/lib/invoice-policy'

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
})
