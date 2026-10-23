/**
 * The public Hostinger Mail webhook route, exercised end to end through its
 * exported POST handler with an in-memory receipt store. Verifies the
 * authentication gate, body limits, JSON validation, supported-event handling
 * and body-level deduplication. No network and no real credentials.
 */
import assert from 'node:assert/strict'
import { afterEach, before, beforeEach, describe, it, mock } from 'node:test'
import { createFakePrismaClientClass, createFakeStore, type FakeStore } from './support/hostinger-fake-prisma'

let store: FakeStore
let POST: (req: Request) => Promise<Response>

const SECRET = 'whsec_route_test_0123456789abcdef0123456789'

before(async () => {
  store = createFakeStore()
  mock.module('@prisma/client', {
    namedExports: { PrismaClient: createFakePrismaClientClass(store) },
    defaultExport: { PrismaClient: createFakePrismaClientClass(store) },
  })
  const route = await import('../src/app/api/webhooks/hostinger-mail/route')
  POST = route.POST as unknown as (req: Request) => Promise<Response>
})

const saved = { secret: process.env.HOSTINGER_MAIL_WEBHOOK_SECRET, enabled: process.env.HOSTINGER_MAIL_ENABLED }
afterEach(() => {
  if (saved.secret === undefined) delete process.env.HOSTINGER_MAIL_WEBHOOK_SECRET
  else process.env.HOSTINGER_MAIL_WEBHOOK_SECRET = saved.secret
  if (saved.enabled === undefined) delete process.env.HOSTINGER_MAIL_ENABLED
  else process.env.HOSTINGER_MAIL_ENABLED = saved.enabled
})

beforeEach(() => {
  store.inboundWebhookReceipt.length = 0
  store.setting.length = 0
  store.communication.length = 0
  // Sync stays unconfigured so the route never reaches the real Hostinger API from a test.
  delete process.env.HOSTINGER_MAIL_ENABLED
})

function request(body: string, headers: Record<string, string> = {}): Request {
  return new Request('https://bdtech360.com/api/webhooks/hostinger-mail', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body,
  })
}

describe('Hostinger Mail webhook route', () => {
  it('returns 503 and touches nothing when the webhook secret is not configured', async () => {
    delete process.env.HOSTINGER_MAIL_WEBHOOK_SECRET
    const res = await POST(request('{"event":"message.received"}', { authorization: `Bearer ${SECRET}` }))
    assert.equal(res.status, 503)
    assert.equal(store.inboundWebhookReceipt.length, 0)
  })

  it('rejects missing and wrong bearer tokens with 401 and without storing anything', async () => {
    process.env.HOSTINGER_MAIL_WEBHOOK_SECRET = SECRET
    assert.equal((await POST(request('{"event":"message.received"}'))).status, 401)
    assert.equal((await POST(request('{"event":"message.received"}', { authorization: 'Bearer nope-nope-nope-nope-nope-nope-nope' }))).status, 401)
    assert.equal(store.inboundWebhookReceipt.length, 0)
  })

  it('rejects oversized bodies before parsing and invalid JSON with 400', async () => {
    process.env.HOSTINGER_MAIL_WEBHOOK_SECRET = SECRET
    const auth = { authorization: `Bearer ${SECRET}` }
    const big = await POST(request('{"x":"' + 'a'.repeat(70_000) + '"}', auth))
    assert.equal(big.status, 413)
    const bad = await POST(request('{not json', auth))
    assert.equal(bad.status, 400)
  })

  it('acknowledges an unsupported event without a sync and records the receipt as processed', async () => {
    process.env.HOSTINGER_MAIL_WEBHOOK_SECRET = SECRET
    const res = await POST(request('{"event":"mailbox.deleted"}', { authorization: `Bearer ${SECRET}` }))
    const body = await res.json() as { ignored?: boolean; eventType?: string }
    assert.equal(res.status, 200)
    assert.equal(body.ignored, true)
    assert.equal(body.eventType, 'mailbox.deleted')
    assert.equal(store.inboundWebhookReceipt[0].status, 'PROCESSED')
  })

  it('deduplicates an identical redelivery by body hash', async () => {
    process.env.HOSTINGER_MAIL_WEBHOOK_SECRET = SECRET
    const auth = { authorization: `Bearer ${SECRET}` }
    const payload = '{"event":"mailbox.deleted","id":"evt-1"}'
    const first = await POST(request(payload, auth))
    assert.equal(first.status, 200)
    const second = await POST(request(payload, auth))
    const body = await second.json() as { duplicate?: boolean }
    assert.equal(second.status, 200)
    assert.equal(body.duplicate, true)
    assert.equal(store.inboundWebhookReceipt.length, 1)
  })

  it('a message.received delivery is recorded, runs a sync (not configured here), and marks the receipt for retry', async () => {
    process.env.HOSTINGER_MAIL_WEBHOOK_SECRET = SECRET
    const res = await POST(request('{"event":"message.received","mailbox":"info@bdtech360.com"}', { authorization: `Bearer ${SECRET}` }))
    const body = await res.json() as { sync?: { stopped?: string } }
    assert.equal(res.status, 200)
    assert.equal(body.sync?.stopped, 'NOT_CONFIGURED')
    assert.equal(store.inboundWebhookReceipt[0].status, 'FAILED', 'an incomplete sync is recorded so a redelivery can retry it')
  })

  it('never echoes the webhook secret or the payload back to the caller', async () => {
    process.env.HOSTINGER_MAIL_WEBHOOK_SECRET = SECRET
    const res = await POST(request('{"event":"mailbox.deleted","secretish":"sensitive-body-text"}', { authorization: `Bearer ${SECRET}` }))
    const text = await res.text()
    assert.doesNotMatch(text, new RegExp(SECRET))
    assert.doesNotMatch(text, /sensitive-body-text/)
  })
})
