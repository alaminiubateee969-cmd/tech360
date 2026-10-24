/**
 * TECH360 — payment integration safety.
 *
 * PayPal and SSLCommerz remain INTEGRATION_NOT_BUILT. These tests pin the
 * guarantees that stop the platform from ever representing them as working, and
 * pin the rules every payment path must satisfy:
 *
 *   • a browser redirect is never payment evidence;
 *   • settlement requires a verified webhook or an admin verification;
 *   • signatures are verified and replays/duplicates are handled;
 *   • amount and currency must match the invoice.
 *
 * Pure/static only: no provider account, no live financial transaction.
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, it } from 'node:test'

import {
  evaluateStripePayment,
  verifyStripeSignature,
  STRIPE_SIGNATURE_TOLERANCE_SECONDS,
} from '../src/lib/commerce-policy'
import { GATEWAY_DEFINITIONS } from '../src/lib/features'

const ROOT = join(__dirname, '..')
const read = (p: string) => readFileSync(join(ROOT, p), 'utf8')

describe('unbuilt gateways can never look operational', () => {
  it('PayPal and SSLCommerz are registered as checkout gateways with no adapter', () => {
    for (const code of ['PAYPAL', 'SSLCOMMERZ']) {
      const def = GATEWAY_DEFINITIONS.find((d) => d.code === code)
      assert.ok(def, `${code} must be in the honest gateway registry`)
      assert.equal(def!.settlement, 'GATEWAY_CHECKOUT')
      assert.equal(def!.defaultEnabled, false, `${code} must be disabled by default`)
      assert.match(def!.instructionsNote, /NOT implemented/i)
    }
  })

  it('the status calculator derives INTEGRATION_NOT_BUILT from code, not configuration', () => {
    const src = read('src/lib/features.ts')
    // checkoutBuilt is a code fact: only Stripe has a real implementation.
    assert.match(src, /checkoutBuilt = def\.settlement !== 'GATEWAY_CHECKOUT' \|\| def\.code === 'STRIPE'/)
    assert.match(src, /status = 'INTEGRATION_NOT_BUILT'/)
    // and the acceptance check refuses such a gateway even if switched on
    assert.match(src, /if \(gateway\.status === 'INTEGRATION_NOT_BUILT'\)/)
    assert.match(src, /503/)
  })

  it('the settings API refuses to switch an unbuilt gateway on', () => {
    const src = read('src/app/api/admin/settings/route.ts')
    assert.match(src, /GATEWAY_NOT_BUILT/)
    assert.match(src, /not implemented \(INTEGRATION_NOT_BUILT\) and cannot be enabled/)
    // The refusal must happen before the override is persisted.
    const block = src.slice(src.indexOf('// ---- Payment gateways ----'))
    const refusal = block.indexOf('GATEWAY_NOT_BUILT')
    const persist = block.indexOf('saveGatewayOverrides')
    assert.ok(refusal > 0 && persist > refusal, 'the refusal must precede persistence')
    assert.match(src, /status: 409/)
  })

  it('no checkout route marks an invoice paid from a success redirect', () => {
    const checkout = read('src/app/api/payments/stripe/checkout/route.ts')
    assert.match(checkout, /success_url|successUrl/, 'checkout must define a return URL')
    assert.ok(!/status:\s*'PAID'/.test(checkout), 'checkout must never settle a payment itself')
    assert.match(checkout, /PENDING/, 'checkout only creates a pending payment record')
    assert.match(checkout, /never by the browser|ONLY by the verified webhook/i)

    // Only the webhook + admin verification may settle.
    const webhook = read('src/app/api/webhooks/stripe/route.ts')
    assert.match(webhook, /verifyStripeSignature/)
    assert.match(webhook, /evaluateStripePayment/)
  })
})

describe('webhook settlement rules', () => {
  const secret = 'whsec_test_secret_value'

  async function sign(body: string, timestamp: number, key = secret): Promise<string> {
    const subtle = globalThis.crypto.subtle
    const imported = await subtle.importKey('raw', new TextEncoder().encode(key), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
    const mac = await subtle.sign('HMAC', imported, new TextEncoder().encode(`${timestamp}.${body}`))
    return Buffer.from(mac).toString('hex')
  }

  it('accepts a correctly signed event', async () => {
    const body = '{"id":"evt_1"}'
    const ts = Math.floor(Date.now() / 1000)
    const header = `t=${ts},v1=${await sign(body, ts)}`
    const result = await verifyStripeSignature(body, header, secret)
    assert.equal(result.ok, true)
  })

  it('rejects an invalid signature and a tampered body', async () => {
    const ts = Math.floor(Date.now() / 1000)
    const body = '{"id":"evt_1","amount_total":1000}'
    const header = `t=${ts},v1=${await sign(body, ts)}`
    const otherSecretHeader = `t=${ts},v1=${await sign(body, ts, 'whsec_a_different_secret')}`
    assert.equal((await verifyStripeSignature(body, otherSecretHeader, secret)).ok, false, 'signature made with another secret')
    const tampered = '{"id":"evt_1","amount_total":999999}'
    assert.equal((await verifyStripeSignature(tampered, header, secret)).ok, false, 'tampered payload')
  })

  it('rejects a replayed signature outside the tolerance window', async () => {
    const body = '{"id":"evt_old"}'
    const old = Math.floor(Date.now() / 1000) - STRIPE_SIGNATURE_TOLERANCE_SECONDS - 60
    const header = `t=${old},v1=${await sign(body, old)}`
    const result = await verifyStripeSignature(body, header, secret)
    assert.equal(result.ok, false)
    assert.match((result as { error: string }).error, /outside .* tolerance/)
  })

  it('rejects a missing or malformed signature header', async () => {
    assert.equal((await verifyStripeSignature('{}', null, secret)).ok, false)
    assert.equal((await verifyStripeSignature('{}', 'garbage', secret)).ok, false)
  })

  it('settles only on an exact amount and currency match', () => {
    const base = { expectedAmount: 125.5, expectedCurrency: 'USD', currentStatus: 'ISSUED' }
    assert.equal(evaluateStripePayment({ ...base, receivedMinor: 12550, receivedCurrency: 'usd' }).action, 'SETTLE')
    assert.equal(evaluateStripePayment({ ...base, receivedMinor: 12549, receivedCurrency: 'usd' }).action, 'REJECT_AMOUNT')
    assert.equal(evaluateStripePayment({ ...base, receivedMinor: 12550, receivedCurrency: 'EUR' }).action, 'REJECT_CURRENCY')
    // A duplicate delivery of the same event must not double-settle.
    assert.equal(
      evaluateStripePayment({ ...base, currentStatus: 'PAID', receivedMinor: 12550, receivedCurrency: 'USD' }).action,
      'DUPLICATE',
    )
  })
})

describe('no live financial transaction is initiated by the tests', () => {
  it('the webhook route is inert without STRIPE_WEBHOOK_SECRET', () => {
    const src = read('src/app/api/webhooks/stripe/route.ts')
    // No secret → honest refusal, never a permissive fallback.
    assert.match(src, /CONFIGURATION_REQUIRED|NOT_CONFIGURED|no .*secret|missing .*secret/i)
    assert.ok(!/if \(!secret\)[^\n]*\n[^\n]*SETTLE/.test(src), 'a missing secret must never lead to settlement')
  })
})
