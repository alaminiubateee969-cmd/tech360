import assert from 'node:assert/strict'
import { createHmac } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'
import { verifyEmailWebhookAuth } from '../src/lib/email-webhook-auth'

const secret = 'a-dedicated-email-webhook-secret-with-32-bytes-minimum'
const body = '{"from":"sender@example.com","text":"Hello"}'
const signature = `sha256=${createHmac('sha256', secret).update(body, 'utf8').digest('hex')}`

describe('inbound email webhook authentication fails closed', () => {
  it('rejects an unset or undersized dedicated secret', () => {
    assert.deepEqual(verifyEmailWebhookAuth({ rawBody: body, secret: '', signature: null, sharedSecret: null }), { ok: false, reason: 'NOT_CONFIGURED' })
    assert.deepEqual(verifyEmailWebhookAuth({ rawBody: body, secret: 'short', signature, sharedSecret: null }), { ok: false, reason: 'NOT_CONFIGURED' })
  })

  it('rejects missing, invalid, and body-tampered authentication', () => {
    assert.deepEqual(verifyEmailWebhookAuth({ rawBody: body, secret, signature: null, sharedSecret: null }), { ok: false, reason: 'MISSING_AUTH' })
    assert.deepEqual(verifyEmailWebhookAuth({ rawBody: body, secret, signature: 'sha256=bad', sharedSecret: null }), { ok: false, reason: 'INVALID_AUTH' })
    assert.deepEqual(verifyEmailWebhookAuth({ rawBody: `${body} `, secret, signature, sharedSecret: null }), { ok: false, reason: 'INVALID_AUTH' })
  })

  it('accepts a valid raw-body HMAC or the dedicated constant-time shared-secret header', () => {
    assert.deepEqual(verifyEmailWebhookAuth({ rawBody: body, secret, signature, sharedSecret: null }), { ok: true, method: 'hmac' })
    assert.deepEqual(verifyEmailWebhookAuth({ rawBody: body, secret, signature: null, sharedSecret: secret }), { ok: true, method: 'shared-secret' })
  })

  it('does not accept a secret from an unrelated legacy integration', () => {
    const source = readFileSync('src/app/api/webhooks/email/route.ts', 'utf8')
    assert.match(source, /EMAIL_WEBHOOK_SECRET/)
    assert.doesNotMatch(source, /SOCIAL_WEBHOOK_SECRET\s*\|\|\s*process\.env\.N8N_WEBHOOK_SECRET/)
    assert.doesNotMatch(source, /payload\.secret/)
  })
})
