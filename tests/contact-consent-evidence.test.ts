import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'
import { hasExplicitContactConsent, hasExplicitMarketingConsent } from '../src/lib/contact-policy'

const read = (path: string) => readFileSync(path, 'utf8')

describe('contact and marketing consent are separate, explicit purposes', () => {
  it('accepts only boolean opt-in values', () => {
    assert.equal(hasExplicitContactConsent(true), true)
    assert.equal(hasExplicitContactConsent('true'), false)
    assert.equal(hasExplicitMarketingConsent(true), true)
    assert.equal(hasExplicitMarketingConsent('yes'), false)
    assert.equal(hasExplicitMarketingConsent(false), false)
  })

  it('persists contact consent on contact and chat intake', () => {
    const contact = read('src/app/api/contact/route.ts')
    const chat = read('src/app/api/chat/session/route.ts')
    assert.match(contact, /contactConsentAt: capturedAt/)
    assert.match(contact, /consentVersion: CONTACT_CONSENT_VERSION/)
    assert.match(chat, /contactConsentAt: now/)
    assert.match(chat, /hasExplicitContactConsent\(raw\.contactConsent\)/)
  })

  it('supports consented SMS-first or email-first progressive profile intake', () => {
    const contact = read('src/app/api/contact/route.ts')
    const contactView = read('src/components/site/ContactView.tsx')
    const chatWidget = read('src/components/site/ChatWidget.tsx')
    assert.match(contact, /if \(!email\)/)
    assert.match(contactView, /Name \(optional\)/)
    assert.match(contactView, /Business type \(optional\)/)
    assert.match(contactView, /Country \(optional\)/)
    assert.match(contactView, /Project type \(optional\)/)
    assert.match(contactView, /Budget range \(optional\)/)
    assert.match(contactView, /Email \*/)
    assert.match(contactView, /Project details \*/)
    assert.match(chatWidget, /preferredContact === 'Email'/)
    assert.match(chatWidget, /optional for SMS-first/)
    assert.match(chatWidget, /Name <span[^>]*>\(optional/)
    assert.match(chatWidget, /SMS first/)
    assert.match(chatWidget, /No marketing messages without separate opt-in/)
    const chatSession = read('src/app/api/chat/session/route.ts')
    assert.match(chatSession, /preferredContact === 'Email'/)
    assert.match(chatSession, /preferredContact === 'SMS' && !phone/)
    assert.match(chatSession, /toE164\(phoneInput\)/)
  })

  it('requires a separate newsletter opt-in and stores its evidence transactionally', () => {
    const newsletter = read('src/app/api/newsletter/route.ts')
    const footer = read('src/components/site/SiteFooter.tsx')
    assert.match(newsletter, /hasExplicitMarketingConsent\(raw\.consent\)/)
    assert.match(newsletter, /marketingConsentAt: consentAt/)
    assert.match(newsletter, /consentAt,\s*consentVersion: MARKETING_CONSENT_VERSION/)
    assert.match(newsletter, /db\.\$transaction/)
    assert.match(footer, /footer-newsletter-consent/)
    assert.match(footer, /consent: true/)
  })
})
