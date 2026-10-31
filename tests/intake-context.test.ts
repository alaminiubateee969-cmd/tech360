import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  buildIntakeContext,
  describeSource,
  extractAttribution,
  hasAttribution,
  normalizeLandingPath,
  normalizeReferrer,
  parseUserAgent,
  resolveLocation,
} from '../src/lib/intake-context'

function headersOf(entries: Record<string, string>): { get(name: string): string | null } {
  const map = new Map(Object.entries(entries).map(([key, value]) => [key.toLowerCase(), value]))
  return { get: (name: string) => map.get(name.toLowerCase()) ?? null }
}

describe('intake context — user agent classification', () => {
  it('classifies desktop, mobile and tablet clients', () => {
    const desktop = parseUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
    )
    assert.equal(desktop.device, 'DESKTOP')
    assert.equal(desktop.browser, 'Chrome')
    assert.equal(desktop.os, 'Windows')

    const iphone = parseUserAgent(
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1',
    )
    assert.equal(iphone.device, 'MOBILE')
    assert.equal(iphone.browser, 'Safari')
    assert.equal(iphone.os, 'iOS')

    const ipad = parseUserAgent(
      'Mozilla/5.0 (iPad; CPU OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1',
    )
    assert.equal(ipad.device, 'TABLET')

    const androidTablet = parseUserAgent(
      'Mozilla/5.0 (Linux; Android 13; SM-X700) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
    )
    assert.equal(androidTablet.device, 'TABLET')
    assert.equal(androidTablet.os, 'Android')
  })

  it('detects automated clients before mobile tokens', () => {
    const whatsapp = parseUserAgent('WhatsApp/2.23.20.0 A')
    assert.equal(whatsapp.device, 'BOT')

    // Googlebot's smartphone UA also contains "Android"/"Mobile"; bot wins.
    const googlebot = parseUserAgent(
      'Mozilla/5.0 (Linux; Android 6.0.1; Nexus 5X Build/MMB29P) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/W.X.Y.Z Mobile Safari/537.36 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
    )
    assert.equal(googlebot.device, 'BOT')
    assert.equal(googlebot.browser, 'Googlebot')
  })

  it('returns UNKNOWN for a missing user agent instead of guessing', () => {
    assert.deepEqual(parseUserAgent(null), { device: 'UNKNOWN', browser: null, os: null })
    assert.deepEqual(parseUserAgent(''), { device: 'UNKNOWN', browser: null, os: null })
  })
})

describe('intake context — attribution allowlist', () => {
  it('keeps known UTM keys, trims them and drops everything else', () => {
    const attribution = extractAttribution({
      utm: {
        utm_source: '  facebook  ',
        utm_medium: 'cpc',
        utm_campaign: 'ramadan-offer',
        utm_term: 'crm bangladesh',
        utm_content: 'ad-1',
        email: 'attacker@example.com',
        name: 'injected',
        __proto__: { polluted: true },
      },
      ref: 'https://www.google.com/search?q=secret+query',
      path: '/contact?token=abc123',
    })

    assert.equal(attribution.source, 'facebook')
    assert.equal(attribution.medium, 'cpc')
    assert.equal(attribution.campaign, 'ramadan-offer')
    assert.equal(attribution.term, 'crm bangladesh')
    assert.equal(attribution.content, 'ad-1')
    // Only the host survives; the search query never reaches storage.
    assert.equal(attribution.referrer, 'www.google.com')
    // Only the pathname survives; the query string never reaches storage.
    assert.equal(attribution.landingPath, '/contact')
    assert.equal((attribution as unknown as Record<string, unknown>).email, undefined)
    assert.equal((attribution as unknown as Record<string, unknown>).name, undefined)
  })

  it('captures an ad click id with its type', () => {
    assert.deepEqual(extractAttribution({ utm: { gclid: 'abc123' } }).clickId, { type: 'GCLID', value: 'abc123' })
    assert.deepEqual(extractAttribution({ utm: { fbclid: 'xyz' } }).clickId, { type: 'FBCLID', value: 'xyz' })
    assert.equal(extractAttribution({}).clickId, null)
  })

  it('ignores non-http referrers and relative paths', () => {
    assert.equal(normalizeReferrer('javascript:alert(1)'), null)
    assert.equal(normalizeReferrer('not a url'), null)
    assert.equal(normalizeLandingPath('contact'), null)
    assert.equal(normalizeLandingPath('/services/ecommerce'), '/services/ecommerce')
  })

  it('survives hostile payload shapes', () => {
    assert.deepEqual(extractAttribution(null).source, null)
    assert.deepEqual(extractAttribution('utm_source=x').source, null)
    assert.deepEqual(extractAttribution([1, 2, 3]).source, null)
    const long = 'a'.repeat(5000)
    assert.equal((extractAttribution({ utm: { utm_source: long } }).source ?? '').length, 120)
  })

  it('caps campaign values and strips control characters', () => {
    const attribution = extractAttribution({ utm: { utm_campaign: 'summer\u0000\u0007sale' } })
    assert.equal(attribution.campaign, 'summersale')
  })

  it('reports attribution presence and a readable source label', () => {
    assert.equal(hasAttribution(extractAttribution({})), false)
    const attributed = extractAttribution({ utm: { utm_source: 'linkedin', utm_medium: 'social' } })
    assert.equal(hasAttribution(attributed), true)
    assert.equal(describeSource(attributed), 'linkedin / social')
    assert.equal(describeSource(extractAttribution({})), 'direct')
    assert.equal(describeSource({ ...attributed, source: null, medium: null, referrer: 'example.com' }), 'example.com')
  })
})

describe('intake context — coarse location', () => {
  it('reads country from trusted edge headers only', () => {
    const location = resolveLocation(headersOf({ 'cf-ipcountry': 'bd' }))
    assert.equal(location.country, 'BD')
    assert.equal(location.source, 'EDGE_HEADER')
  })

  it('never fabricates a location when headers are absent', () => {
    const location = resolveLocation(headersOf({}))
    assert.deepEqual(location, { country: null, region: null, city: null, source: 'NONE' })
  })

  it('rejects malformed country codes', () => {
    assert.equal(resolveLocation(headersOf({ 'cf-ipcountry': 'XX1' })).country, null)
    assert.equal(resolveLocation(headersOf({ 'cf-ipcountry': 'T1' })).source, 'NONE')
  })
})

describe('intake context — assembly', () => {
  it('combines attribution, device and transport facts into one record', () => {
    const context = buildIntakeContext({
      headers: headersOf({
        'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
        'cf-ipcountry': 'BD',
        'cf-region': 'Dhaka',
        'x-forwarded-proto': 'https',
      }),
      tracking: { utm: { utm_source: 'google', utm_medium: 'cpc' }, path: '/?x=1' },
      now: new Date('2026-10-30T00:00:00.000Z'),
    })

    assert.equal(context.source, 'google')
    assert.equal(context.medium, 'cpc')
    assert.equal(context.device, 'DESKTOP')
    assert.equal(context.browser, 'Chrome')
    assert.equal(context.os, 'macOS')
    assert.equal(context.location.country, 'BD')
    assert.equal(context.location.region, 'Dhaka')
    assert.equal(context.secure, true)
    assert.equal(context.capturedAt, '2026-10-30T00:00:00.000Z')
  })

  it('does not treat a missing proto header as secure', () => {
    assert.equal(buildIntakeContext({ headers: headersOf({}) }).secure, false)
    assert.equal(buildIntakeContext({ headers: headersOf({ 'x-forwarded-proto': 'http' }) }).secure, false)
  })
})
