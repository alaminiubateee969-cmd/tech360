/**
 * Regression: the social inbound webhook (Facebook/Instagram/LinkedIn/X via the
 * n8n relay) must not create a second Client when the relay redelivers the same
 * message. Before the fix, every delivery called intakeLead with no message id
 * and no receipt claim, so each retry created a new customer and a new welcome.
 */
import assert from 'node:assert/strict'
import { afterEach, before, beforeEach, describe, it, mock } from 'node:test'
import { createFakePrismaClientClass, createFakeStore, type FakeStore } from './support/hostinger-fake-prisma'

const SECRET = 'social_secret_0123456789abcdef0123456789'
let store: FakeStore
let POST: (req: Request) => Promise<Response>
let intakeCalls: Array<Record<string, unknown>> = []
let intakeFailNext = false

before(async () => {
  store = createFakeStore()
  mock.module('@prisma/client', {
    namedExports: { PrismaClient: createFakePrismaClientClass(store) },
    defaultExport: { PrismaClient: createFakePrismaClientClass(store) },
  })
  mock.module('@/lib/journey', {
    namedExports: {
      intakeLead: async (input: Record<string, unknown>) => {
        intakeCalls.push(input)
        if (intakeFailNext) {
          intakeFailNext = false
          throw new Error('simulated intake failure')
        }
        return { clientId: `TECH-2026-${String(intakeCalls.length).padStart(6, '0')}`, clientRowId: `row_${intakeCalls.length}`, logId: 'log', welcome: null }
      },
    },
  })
  const route = await import('../src/app/api/webhooks/social/route')
  POST = route.POST as unknown as (req: Request) => Promise<Response>
})

const saved = process.env.SOCIAL_WEBHOOK_SECRET
beforeEach(() => {
  process.env.SOCIAL_WEBHOOK_SECRET = SECRET
  intakeCalls = []
  intakeFailNext = false
  store.inboundWebhookReceipt.length = 0
  store.communication.length = 0
  store.errorLog.length = 0
  store.auditLog.length = 0
})
afterEach(() => {
  if (saved === undefined) delete process.env.SOCIAL_WEBHOOK_SECRET
  else process.env.SOCIAL_WEBHOOK_SECRET = saved
})

function deliver(body: Record<string, unknown>, headers: Record<string, string> = { 'x-webhook-secret': SECRET }): Promise<Response> {
  return POST(new Request('https://bdtech360.com/api/webhooks/social', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify(body),
  }))
}

const message = { channel: 'FACEBOOK', messageId: 'fb-msg-1', sender: 'Ada', email: 'ada@example.test', message: 'Need a website' }

describe('social webhook idempotency', () => {
  it('accepts Messenger, preserving its source and provider id with deduplication', async () => {
    const payload = { channel: 'MESSENGER', messageId: 'msg-1', sender: 'Ada', message: 'Need CRM' }
    assert.equal((await deliver(payload)).status, 200)
    assert.equal(intakeCalls[0].source, 'MESSENGER')
    assert.equal(intakeCalls[0].providerMessageId, 'MESSENGER:msgid:msg-1')
    assert.equal((await (await deliver(payload)).json() as { duplicate?: boolean }).duplicate, true)
    assert.equal(intakeCalls.length, 1)
  })

  it('a redelivery of the same provider message creates one intake, not two', async () => {
    const first = await deliver(message)
    assert.equal(first.status, 200)
    const second = await deliver(message)
    const body = await second.json() as { duplicate?: boolean }
    assert.equal(body.duplicate, true)
    assert.equal(intakeCalls.length, 1, 'duplicate delivery must not call intakeLead again')
  })

  it('passes the provider message id through so the stored communication is traceable', async () => {
    await deliver(message)
    assert.equal(intakeCalls[0].providerMessageId, 'FACEBOOK:msgid:fb-msg-1')
  })

  it('a byte-identical redelivery without a message id is deduplicated by body hash', async () => {
    const noId = { channel: 'INSTAGRAM', sender: 'Ben', message: 'hello' }
    await deliver(noId)
    const again = await deliver(noId)
    assert.equal((await again.json() as { duplicate?: boolean }).duplicate, true)
    assert.equal(intakeCalls.length, 1)
  })

  it('distinct messages from the same sender each create an intake', async () => {
    await deliver(message)
    await deliver({ ...message, messageId: 'fb-msg-2', message: 'Second message' })
    assert.equal(intakeCalls.length, 2)
  })

  it('a failed intake is recorded as FAILED and a redelivery retries it', async () => {
    intakeFailNext = true
    const failed = await deliver(message)
    assert.equal(failed.status, 200)
    assert.equal((await failed.json() as { ok: boolean }).ok, false)
    assert.equal(store.inboundWebhookReceipt[0].status, 'FAILED')

    const retried = await deliver(message)
    assert.equal((await retried.json() as { ok: boolean }).ok, true)
    assert.equal(intakeCalls.length, 2, 'the retry runs the intake once more')
    assert.equal(store.inboundWebhookReceipt[0].status, 'PROCESSED')
  })

  it('fails closed with 503 when no secret is configured, and 401 for a wrong header', async () => {
    delete process.env.SOCIAL_WEBHOOK_SECRET
    assert.equal((await deliver(message)).status, 503)
    process.env.SOCIAL_WEBHOOK_SECRET = SECRET
    assert.equal((await deliver(message, { 'x-webhook-secret': 'wrong' })).status, 401)
    assert.equal(intakeCalls.length, 0)
  })

  it('rejects an oversized body with 413 before intake', async () => {
    const huge = { ...message, message: 'x'.repeat(70_000) }
    assert.equal((await deliver(huge)).status, 413)
    assert.equal(intakeCalls.length, 0)
  })
})
