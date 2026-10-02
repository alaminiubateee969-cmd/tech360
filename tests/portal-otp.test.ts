/**
 * Portal one-time passcodes: forged, expired, wrong-code and cross-secret
 * challenges must all be rejected; codes must never be stored in the comms log.
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, it } from 'node:test'
import { issueOtp, verifyOtp, readChallenge, maskContact, OTP_TTL_MS } from '../src/lib/otp'

const S = 'unit-test-secret-value'

describe('portal OTP', () => {
  it('accepts the right code for the right challenge', () => {
    const { code, challenge } = issueOtp(S, 'TECH-2026-000001', 'EMAIL')
    assert.match(code, /^\d{6}$/)
    assert.equal(verifyOtp(S, challenge, code)?.sub, 'TECH-2026-000001')
  })
  it('does not leak the code inside the challenge', () => {
    const { code, challenge } = issueOtp(S, 'TECH-2026-000001', 'SMS')
    assert.ok(!challenge.includes(code))
  })
  it('rejects wrong code, other secret, expiry, tampering', () => {
    const { code, challenge } = issueOtp(S, 'A', 'EMAIL')
    const wrong = code === '000000' ? '000001' : '000000'
    assert.equal(verifyOtp(S, challenge, wrong), null)
    assert.equal(verifyOtp('another-secret', challenge, code), null)
    assert.equal(verifyOtp(S, challenge, code, Date.now() + OTP_TTL_MS + 1000), null)
    const [body, sig] = challenge.split('.')
    const forged = Buffer.from(JSON.stringify({ sub: 'VICTIM', ch: 'EMAIL', exp: Date.now() + 1e6, n: 'x' })).toString('base64url')
    assert.equal(readChallenge(S, `${forged}.${sig}`), null)
    assert.equal(readChallenge(S, `${body}.`), null)
    assert.equal(verifyOtp(S, challenge, '12345'), null)
    assert.equal(verifyOtp(S, challenge, 123456), null)
  })
  it('masks contacts', () => {
    assert.ok(!maskContact('alamin@example.com').includes('alamin'))
    assert.ok(!maskContact('+8801712345678').includes('1712345'))
  })
  it('login route never persists the code and sets cookie only after verification', () => {
    const src = readFileSync(join(import.meta.dirname, '..', 'src/app/api/portal/login/route.ts'), 'utf8')
    assert.match(src, /storedBody:/)
    assert.ok(!/challenge[^\n]*sessionResponse/.test(src))
  })
})

import { toE164 } from '../src/lib/phone'
describe('phone normalisation for httpSMS', () => {
  it('formats Bangladesh and international numbers', () => {
    assert.equal(toE164('01712345678'), '+8801712345678')
    assert.equal(toE164('+880 1712-345678'), '+8801712345678')
    assert.equal(toE164('008801712345678'), '+8801712345678')
    assert.equal(toE164('+1 (816) 380-8660'), '+18163808660')
    assert.equal(toE164('abc'), null)
    assert.equal(toE164('123'), null)
  })
})
