import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { CHAT_SESSION_TTL_SECONDS, signChatSessionToken, verifyChatSessionToken } from '../src/lib/chat-session'
import { isValidClientRequestId } from '../src/lib/contact-policy'

const secret = 'a-secret-used-only-by-this-unit-test-at-least-32-bytes'

describe('signed chat session capability', () => {
  it('is bound to the visitor id and expires', () => {
    const now = 2_000_000_000
    const token = signChatSessionToken('visitor-123', secret, now + CHAT_SESSION_TTL_SECONDS)
    assert.equal(verifyChatSessionToken(token, 'visitor-123', secret, now), true)
    assert.equal(verifyChatSessionToken(token, 'another-visitor', secret, now), false)
    assert.equal(verifyChatSessionToken(token, 'visitor-123', secret, now + CHAT_SESSION_TTL_SECONDS), false)
  })

  it('rejects modified signatures and malformed tokens', () => {
    const token = signChatSessionToken('visitor-123', secret, 2_100_000_000)
    assert.equal(verifyChatSessionToken(`${token.slice(0, -1)}x`, 'visitor-123', secret, 2_000_000_000), false)
    assert.equal(verifyChatSessionToken('not-a-token', 'visitor-123', secret), false)
    assert.equal(verifyChatSessionToken(token, 'visitor-123', '', 2_000_000_000), false)
  })
})

describe('public request idempotency keys', () => {
  it('accepts bounded opaque request ids and rejects malformed values', () => {
    assert.equal(isValidClientRequestId('9d2a44ea-e29d-43ee-a107-c77c3e7ff123'), true)
    assert.equal(isValidClientRequestId('short'), false)
    assert.equal(isValidClientRequestId('x'.repeat(65)), false)
    assert.equal(isValidClientRequestId('../other-route-123'), false)
    assert.equal(isValidClientRequestId(undefined), false)
  })
})
