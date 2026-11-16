import assert from 'node:assert/strict'
import { createHmac } from 'node:crypto'
import { before, beforeEach, describe, it, mock } from 'node:test'

const secret = 'local-test-secret'
const receipts = new Map<string, { id: string; status: string; token: string }>()
const communications = new Map<string, { clientId: string }>()
const calls: string[] = []
const failures = new Set<string>()
let POST: (request: Request) => Promise<Response>

before(async () => {
  process.env.WHATSAPP_APP_SECRET = secret
  mock.module('@/lib/db', { namedExports: { db: {
    inboundWebhookReceipt: { findUnique: async ({ where }: { where: { id: string } }) => [...receipts.values()].find((v) => v.id === where.id) ?? null },
    communication: {
      findFirst: async ({ where }: { where: { providerMessageId: string } }) => communications.get(where.providerMessageId) ?? null,
      updateMany: async () => ({ count: 0 }),
    },
  } } })
  mock.module('@/lib/security', { namedExports: {
    sanitizeText: (x: unknown, max: number) => typeof x === 'string' ? x.slice(0, max) : '',
    rateLimit: () => ({ ok: true }), clientIp: () => 'test', logError: async () => {}, audit: async () => {},
    constantTimeEquals: (a: unknown, b: unknown) => Boolean(a && b && a === b),
  } })
  mock.module('@/lib/identity-resolver', { namedExports: {
    claimInboundWebhookEvent: async ({ providerEventId }: { providerEventId: string }) => {
      const existing = receipts.get(providerEventId)
      if (existing && existing.status !== 'FAILED') return { claimed: false, receiptId: existing.id, claimToken: null }
      const row = { id: providerEventId, token: `claim-${providerEventId}`, status: 'PROCESSING' }
      receipts.set(providerEventId, row)
      return { claimed: true, receiptId: row.id, claimToken: row.token }
    },
    finishInboundWebhookEvent: async ({ receiptId, success }: { receiptId: string; success: boolean }) => { receipts.get(receiptId)!.status = success ? 'PROCESSED' : 'FAILED'; return true },
    resolveVerifiedClientIdentity: async () => null,
  } })
  mock.module('@/lib/journey', { namedExports: { intakeLead: async ({ providerMessageId }: { providerMessageId: string }) => {
    calls.push(providerMessageId)
    if (failures.delete(providerMessageId)) throw new Error('temporary')
    communications.set(providerMessageId, { clientId: 'client-row' })
    return { clientId: 'TECH-2026-000001', clientRowId: 'client-row' }
  } } })
  const route = await import('../src/app/api/webhooks/whatsapp/route')
  POST = route.POST as unknown as (request: Request) => Promise<Response>
})

beforeEach(() => { receipts.clear(); communications.clear(); calls.length = 0; failures.clear() })
function req(payload: unknown) {
  const body = JSON.stringify(payload)
  return new Request('https://example.test/api/webhooks/whatsapp', { method: 'POST', headers: { 'x-hub-signature-256': 'sha256=' + createHmac('sha256', secret).update(body).digest('hex') }, body })
}
const message = (id: string) => ({ id, from: '8801711000000', type: 'text', text: { body: 'Hello' } })
const batch = { entry: [
  { changes: [{ value: { messages: [message('a')] } }, { value: { messages: [message('b')] } }] },
  { changes: [{ value: { messages: [message('c'), null, { id: 'bad' }] } }, null] },
  null,
] }

describe('WhatsApp signed webhook batch handling', () => {
  it('processes all entries and changes, skips malformed items, and deduplicates redelivery', async () => {
    assert.equal((await POST(req(batch))).status, 200)
    assert.deepEqual(calls, ['a', 'b', 'c'])
    assert.equal((await POST(req(batch))).status, 200)
    assert.deepEqual(calls, ['a', 'b', 'c'])
  })
  it('continues after one failure, requests retry, and only reprocesses the failed event', async () => {
    failures.add('b')
    assert.equal((await POST(req(batch))).status, 503)
    assert.deepEqual(calls, ['a', 'b', 'c'])
    assert.equal(receipts.get('b')?.status, 'FAILED')
    assert.equal((await POST(req(batch))).status, 200)
    assert.deepEqual(calls, ['a', 'b', 'c', 'b'])
  })
  it('does not resend a reply when retry finds an already persisted inbound message', async () => {
    receipts.set('a', { id: 'a', token: 'old', status: 'FAILED' })
    communications.set('a', { clientId: 'client-row' })
    assert.equal((await POST(req({ entry: [{ changes: [{ value: { messages: [message('a')] } }] }] }))).status, 200)
    assert.deepEqual(calls, [])
    assert.equal(receipts.get('a')?.status, 'PROCESSED')
  })
  it('does not acknowledge an in-flight receipt as processed', async () => {
    receipts.set('a', { id: 'a', token: 'other', status: 'PROCESSING' })
    assert.equal((await POST(req({ entry: [{ changes: [{ value: { messages: [message('a')] } }] }] }))).status, 503)
    assert.deepEqual(calls, [])
  })
  it('rejects invalid signatures and malformed top-level payloads', async () => {
    const invalid = new Request('https://example.test/api/webhooks/whatsapp', { method: 'POST', body: '{}', headers: { 'x-hub-signature-256': 'bad' } })
    assert.equal((await POST(invalid)).status, 401)
    assert.equal((await POST(req({ entry: 'invalid' }))).status, 400)
  })
})
