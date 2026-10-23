import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { resolvePortalOtpMode } from '../src/lib/portal-otp-policy'

describe('portal OTP policy', () => {
  it('requires OTP in production even if the old opt-out is configured', () => {
    assert.equal(resolvePortalOtpMode(undefined, 'production'), 'required')
    assert.equal(resolvePortalOtpMode('auto', 'production'), 'required')
    assert.equal(resolvePortalOtpMode('off', 'production'), 'required')
  })

  it('permits the legacy contact-match path only in non-production development', () => {
    assert.equal(resolvePortalOtpMode('off', 'development'), 'off')
    assert.equal(resolvePortalOtpMode(undefined, 'development'), 'required')
    assert.equal(resolvePortalOtpMode('required', 'test'), 'required')
  })
})
