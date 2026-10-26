import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import { describe, it } from 'node:test'
import { buildIdentityBackfillPreview, hashNormalizedIdentity, normalizeIdentity } from '../src/lib/identity-policy'

describe('verified client identity primitives', () => {
  it('normalizes without provider-specific alias merging', () => {
    assert.equal(normalizeIdentity('EMAIL', '  PERSON+tag@Example.COM '), 'person+tag@example.com')
    assert.equal(normalizeIdentity('EMAIL', 'not an email'), null)
    assert.equal(normalizeIdentity('PHONE', '01711 000000'), '+8801711000000')
    assert.equal(normalizeIdentity('PHONE', '123'), null)
  })

  it('uses a configured keyed digest and fails closed when the key is unavailable', () => {
    const original = process.env.IDENTITY_HASH_SECRET
    try {
      delete process.env.IDENTITY_HASH_SECRET
      assert.throws(() => hashNormalizedIdentity('PHONE', '+8801711000000'), /IDENTITY_HASH_SECRET/)
      process.env.IDENTITY_HASH_SECRET = randomBytes(32).toString('hex')
      const digest = hashNormalizedIdentity('PHONE', '+8801711000000')
      assert.match(digest, /^[a-f0-9]{64}$/)
      assert.notEqual(digest, hashNormalizedIdentity('EMAIL', '+8801711000000'))
      assert.ok(!digest.includes('8801711000000'))
    } finally {
      if (original === undefined) delete process.env.IDENTITY_HASH_SECRET
      else process.env.IDENTITY_HASH_SECRET = original
    }
  })

  it('reports ambiguous legacy candidates without returning values or writing identities', () => {
    const preview = buildIdentityBackfillPreview([
      { id: 'client-a', email: 'shared@example.com', phone: '01711 000000', whatsapp: '01711000000' },
      { id: 'client-b', email: 'SHARED@example.com', phone: '+8801711000000', whatsapp: null },
      { id: 'client-c', email: 'unique@example.com', phone: null, whatsapp: null },
    ])
    assert.equal(preview.rowsScanned, 3)
    assert.equal(preview.collisionGroups, 2)
    assert.equal(preview.clientsInCollisionGroups, 2)
    assert.equal(preview.byType.EMAIL.collisionGroups, 1)
    assert.equal(preview.byType.PHONE.collisionGroups, 1)
    assert.equal(preview.writesPerformed, 0)
    assert.equal(preview.automaticBackfillEnabled, false)
    const serialized = JSON.stringify(preview)
    assert.ok(!serialized.includes('shared@example.com'))
    assert.ok(!serialized.includes('01711'))
  })
})
