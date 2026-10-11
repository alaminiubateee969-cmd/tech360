import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { hasAcceptedPreviewDelivery } from '../src/lib/preview-policy'

describe('preview provider acceptance status', () => {
  it('does not call a generated link or an unsuccessful attempt sent', () => {
    assert.equal(hasAcceptedPreviewDelivery([]), false)
    assert.equal(hasAcceptedPreviewDelivery([{ channel: 'EMAIL', status: 'NOT_CONFIGURED', ok: false }]), false)
    assert.equal(hasAcceptedPreviewDelivery([{ channel: 'WHATSAPP', status: 'FAILED', ok: false }]), false)
    assert.equal(hasAcceptedPreviewDelivery([{ channel: 'EMAIL', status: 'SENT', ok: false }]), false)
  })

  it('marks a preview sent only after at least one provider accepts the dispatch', () => {
    assert.equal(hasAcceptedPreviewDelivery([
      { channel: 'EMAIL', status: 'NOT_CONFIGURED', ok: false },
      { channel: 'WHATSAPP', status: 'SENT', ok: true },
    ]), true)
  })
})
