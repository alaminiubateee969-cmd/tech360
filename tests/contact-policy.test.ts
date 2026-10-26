import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { hasExplicitContactConsent, selectWelcomeChannel } from '../src/lib/contact-policy'

describe('contact consent and selected channel policy', () => {
  it('accepts only an explicit boolean consent value', () => {
    assert.equal(hasExplicitContactConsent(true), true)
    assert.equal(hasExplicitContactConsent(false), false)
    assert.equal(hasExplicitContactConsent('true'), false)
    assert.equal(hasExplicitContactConsent(undefined), false)
  })

  it('replies to inbound channels and never falls back from the website preference', () => {
    assert.equal(selectWelcomeChannel('WHATSAPP_WEBHOOK', 'Email'), 'WHATSAPP')
    assert.equal(selectWelcomeChannel('EMAIL_WEBHOOK', 'WhatsApp'), 'EMAIL')
    assert.equal(selectWelcomeChannel('WEBSITE', 'Email'), 'EMAIL')
    assert.equal(selectWelcomeChannel('WEBSITE', 'WhatsApp'), 'WHATSAPP')
    assert.equal(selectWelcomeChannel('WEBSITE', 'Phone'), null)
    assert.equal(selectWelcomeChannel('WEBSITE', null), null)
  })
})
