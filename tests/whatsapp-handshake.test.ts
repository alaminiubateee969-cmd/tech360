import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'
import { verifyWhatsAppHandshake } from '../src/lib/whatsapp-webhook'

const secret = 'wa-verify-token-0123456789abcdef'
const challenge = '1158201444'

describe('WhatsApp webhook subscription handshake', () => {
  it('echoes the challenge for a correct subscribe handshake', () => {
    const result = verifyWhatsAppHandshake({ mode: 'subscribe', token: secret, challenge, expected: secret })
    assert.deepEqual(result, { ok: true, challenge })
  })

  it('fails closed when the verify token is not configured', () => {
    for (const expected of ['', undefined, null]) {
      assert.deepEqual(
        verifyWhatsAppHandshake({ mode: 'subscribe', token: secret, challenge, expected }),
        { ok: false, reason: 'NOT_CONFIGURED' },
      )
    }
  })

  it('refuses a handshake that is not a subscribe call', () => {
    assert.deepEqual(
      verifyWhatsAppHandshake({ mode: 'unsubscribe', token: secret, challenge, expected: secret }),
      { ok: false, reason: 'WRONG_MODE' },
    )
    assert.deepEqual(
      verifyWhatsAppHandshake({ mode: null, token: secret, challenge, expected: secret }),
      { ok: false, reason: 'WRONG_MODE' },
    )
  })

  it('rejects a missing, empty, wrong, or prefix-only token', () => {
    for (const token of [null, '', 'wrong-token', secret.slice(0, -1), `${secret}x`]) {
      assert.deepEqual(
        verifyWhatsAppHandshake({ mode: 'subscribe', token, challenge, expected: secret }),
        { ok: false, reason: 'INVALID_TOKEN' },
      )
    }
  })

  it('never returns a challenge when the token does not match', () => {
    const result = verifyWhatsAppHandshake({ mode: 'subscribe', token: 'guess', challenge, expected: secret })
    assert.equal(result.ok, false)
    assert.equal('challenge' in result, false)
  })

  it('rejects a verified call with no challenge to echo', () => {
    assert.deepEqual(
      verifyWhatsAppHandshake({ mode: 'subscribe', token: secret, challenge: '', expected: secret }),
      { ok: false, reason: 'MISSING_CHALLENGE' },
    )
  })

  it('is wired to the constant-time comparison, not string equality', () => {
    // Source-level guard: the handshake must not regress to `===` on a secret.
    const source = readFileSync('src/lib/whatsapp-webhook.ts', 'utf8')
    assert.match(source, /constantTimeEquals/)
    assert.doesNotMatch(source, /token\s*===\s*expected|expected\s*===\s*token/)

    // And the route must delegate instead of comparing inline.
    const route = readFileSync('src/app/api/webhooks/whatsapp/route.ts', 'utf8')
    assert.match(route, /verifyWhatsAppHandshake/)
    assert.doesNotMatch(route, /hub\.verify_token[\s\S]{0,200}===\s*expected/)
  })
})
