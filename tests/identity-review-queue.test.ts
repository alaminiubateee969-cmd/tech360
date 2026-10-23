import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'

const read = (path: string) => readFileSync(path, 'utf8')

describe('public-intake identity review visibility', () => {
  it('exposes pending intake only through the guarded, read-only admin endpoint', () => {
    const route = read('src/app/api/admin/intake-review/route.ts')
    assert.match(route, /guard\(req, \{ minRole: 'STAFF' \}\)/)
    assert.match(route, /where = \{ status: 'PENDING_REVIEW' \}/)
    assert.match(route, /Cache-Control.*no-store/)
    assert.doesNotMatch(route, /db\.client\.update|db\.client\.create|linkVerifiedIdentity/)
  })

  it('shows the queue in the admin leads view and routes its notification to that view', () => {
    const leads = read('src/components/admin/LeadsView.tsx')
    const notifications = read('src/components/admin/NotificationCenter.tsx')
    const contact = read('src/app/api/contact/route.ts')
    const chat = read('src/lib/chat-onboarding.ts')
    assert.match(leads, /IdentityReviewQueue/)
    assert.match(leads, /no merge or portal access is created here/)
    assert.match(notifications, /IDENTITY_REVIEW: 'leads'/)
    assert.match(contact, /type: 'IDENTITY_REVIEW'/)
    assert.match(chat, /type: 'IDENTITY_REVIEW'/)
  })
})
