/**
 * TECH360 — Call & SMS centre tests.
 * The important property: with no provider configured, nothing may claim a
 * call was placed or a message was sent.
 */
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { canTransitionCall, dialUri, normalizeDialNumber, sendDeviceSms, telephonyState } from '../src/lib/telephony'

describe('telephony: number normalisation', () => {
  it('converts UK national numbers to E.164', () => {
    assert.equal(normalizeDialNumber('020 7946 0000'), '+442079460000')
  })

  it('keeps an explicit country code', () => {
    assert.equal(normalizeDialNumber('+880 1712 345678'), '+8801712345678')
  })

  it('handles the international 00 prefix', () => {
    assert.equal(normalizeDialNumber('0044 20 7946 0000'), '+442079460000')
  })

  it('supports a different default country', () => {
    assert.equal(normalizeDialNumber('01712345678', '880'), '+8801712345678')
  })

  it('rejects unusable input', () => {
    assert.equal(normalizeDialNumber(''), null)
    assert.equal(normalizeDialNumber('not a number'), null)
  })
})

describe('telephony: honest provider state', () => {
  it('reports NONE / NOT_CONFIGURED with an empty environment', () => {
    const state = telephonyState({})
    assert.equal(state.provider, 'NONE')
    assert.equal(state.serverCalling, 'NOT_CONFIGURED')
    assert.equal(state.smsGateway, 'NOT_CONFIGURED')
    assert.match(state.detail, /No telephony provider/i)
  })

  it('recognises a device SMS gateway without inventing a voice line', () => {
    const state = telephonyState({ HTTPSMS_BASE_URL: 'https://sms.example', HTTPSMS_API_KEY: 'k', HTTPSMS_FROM: '+440000000000' })
    assert.equal(state.provider, 'DEVICE_GATEWAY')
    assert.equal(state.smsGateway, 'AVAILABLE')
    assert.equal(state.serverCalling, 'NOT_CONFIGURED')
  })

  it('recognises SIP and Twilio credentials', () => {
    assert.equal(telephonyState({ SIP_DOMAIN: 'sip.example' }).provider, 'SIP')
    assert.equal(telephonyState({ TWILIO_ACCOUNT_SID: 'AC', TWILIO_AUTH_TOKEN: 't' }).provider, 'TWILIO')
  })
})

describe('telephony: dial URIs', () => {
  it('uses tel: by default', () => {
    assert.equal(dialUri('+442079460000', 'CLICK_TO_CALL'), 'tel:+442079460000')
  })

  it('uses sip: when a SIP domain is configured', () => {
    assert.equal(dialUri('+442079460000', 'SIP', { SIP_DOMAIN: 'sip.example' }), 'sip:442079460000@sip.example')
  })

  it('falls back to tel: when SIP is requested but unconfigured', () => {
    assert.equal(dialUri('+442079460000', 'SIP', {}), 'tel:+442079460000')
  })
})

describe('telephony: device SMS refuses honestly', () => {
  it('returns NOT_CONFIGURED without credentials and performs no request', async () => {
    const result = await sendDeviceSms('+442079460000', 'hello', {})
    assert.equal(result.ok, false)
    if (result.ok) return
    assert.equal(result.state, 'NOT_CONFIGURED')
    assert.match(result.detail, /No message was sent/)
  })

  it('rejects an unnormalisable destination before calling the gateway', async () => {
    const result = await sendDeviceSms('nonsense', 'hello', { HTTPSMS_BASE_URL: 'https://sms.example', HTTPSMS_API_KEY: 'k', HTTPSMS_FROM: '+440000000000' })
    assert.equal(result.ok, false)
    if (result.ok) return
    assert.equal(result.state, 'FAILED')
  })
})

describe('telephony: call state machine', () => {
  it('allows a logged call to be completed', () => {
    assert.equal(canTransitionCall('LOGGED', 'COMPLETED'), true)
    assert.equal(canTransitionCall('LOGGED', 'MISSED'), true)
  })

  it('treats completed, missed and failed as terminal', () => {
    for (const s of ['COMPLETED', 'MISSED', 'FAILED'] as const) {
      assert.equal(canTransitionCall(s, 'LOGGED'), false)
    }
  })

  it('lets an honest NOT_CONFIGURED record be corrected later', () => {
    assert.equal(canTransitionCall('NOT_CONFIGURED', 'LOGGED'), true)
    assert.equal(canTransitionCall('LOGGED', 'NOT_CONFIGURED'), true)
  })
})
