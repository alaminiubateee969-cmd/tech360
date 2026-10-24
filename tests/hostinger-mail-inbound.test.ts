/**
 * Inbound sync behaviour against an in-memory Prisma stand-in (tests/support).
 * Covers: one row per message, dedupe on replay, checkpoint resume after a
 * provider error, the busy-lease stop, the per-run budget, the unconfigured
 * stop, and that customers are never matched by display name.
 */
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { afterEach, before, beforeEach, describe, it, mock } from 'node:test'
import { createFakePrismaClientClass, createFakeStore, type FakeStore } from './support/hostinger-fake-prisma'
import type { HostingerMailClient, HostingerInboxSummary } from '../src/lib/mail/hostinger-mail'

let store: FakeStore
type Db = typeof import('../src/lib/mail/hostinger-inbound')
let inbound: Db

before(async () => {
  mock.module('@prisma/client', {
    namedExports: { PrismaClient: createFakePrismaClientClass(store = createFakeStore()) },
    defaultExport: { PrismaClient: createFakePrismaClientClass(store) },
  })
  inbound = await import('../src/lib/mail/hostinger-inbound')
})

const ENV = {
  HOSTINGER_MAIL_ENABLED: 'true',
  HOSTINGER_MAIL_API_TOKEN: 'hm_inbound_token_0123456789abcdefgh',
  HOSTINGER_MAILBOX_RESOURCE_ID: 'MBX_INBOUND_1',
  HOSTINGER_MAIL_FROM_ADDRESS: 'info@bdtech360.com',
}
const savedEnv: Record<string, string | undefined> = {}

beforeEach(() => {
  for (const key of Object.keys(ENV)) savedEnv[key] = process.env[key]
  Object.assign(process.env, ENV)
  store.setting.length = 0
  store.client.length = 0
  store.communication.length = 0
  store.inboundWebhookReceipt.length = 0
  store.client.push({ id: 'cli_ada', clientId: 'TECH-2026-000001', name: 'Ada Client', email: 'client@example.com', deletedAt: null, updatedAt: new Date() })
})

afterEach(() => {
  for (const key of Object.keys(ENV)) {
    if (savedEnv[key] === undefined) delete process.env[key]
    else process.env[key] = savedEnv[key]
  }
})

type Msg = HostingerInboxSummary & { text?: string; html?: string }

/** Fake provider. Mirrors IMAP "N:*": when nothing is above uidFrom it still returns the highest message. */
function fakeClient(messages: Msg[], options: { textFailUid?: number } = {}): HostingerMailClient & { textCalls: number[] } {
  const textCalls: number[] = []
  return {
    textCalls,
    async sendEmail() { throw new Error('sync must never send') },
    async getCurrentAccount() { throw new Error('sync must not read the account') },
    async searchInbox({ uidFrom }) {
      let items = messages.filter((m) => m.uid >= uidFrom)
      if (items.length === 0 && messages.length > 0) items = [messages[messages.length - 1]]
      return { items: items.map(({ text: _t, html: _h, ...summary }) => summary), totalPages: 1 }
    },
    async getInboxMessageText(uid) {
      textCalls.push(uid)
      if (uid === options.textFailUid) {
        throw Object.assign(new Error('rate limited'), { response: { status: 429, data: { code: 'ERR_RATE_LIMIT' } } })
      }
      const m = messages.find((x) => x.uid === uid)
      return { text: m?.text ?? '', html: m?.html ?? '' }
    },
  }
}

const messages: Msg[] = [
  { uid: 1, messageId: '<one@mail.example>', inReplyTo: null, subject: 'Question', fromAddress: 'client@example.com', date: null, text: 'First question' },
  // Same display name as the client, different address: must NOT be linked.
  { uid: 2, messageId: '<two@mail.example>', inReplyTo: null, subject: 'Hello', fromAddress: 'ada.impostor@other.example', date: null, text: 'Hi, I am Ada Client' },
  { uid: 3, messageId: null, inReplyTo: null, subject: 'Follow up', fromAddress: 'CLIENT@example.com', date: null, html: '<p>Follow <b>up</b></p>' },
]

describe('inbound sync: storage, matching and checkpoint', () => {
  it('stores each message once, links only on an exact sender address, and advances the checkpoint', async () => {
    const summary = await inbound.syncHostingerInbox({}, fakeClient(messages))
    assert.equal(summary.stopped, 'COMPLETE')
    assert.equal(summary.imported, 3)
    assert.equal(summary.unmatched, 1)
    assert.equal(summary.checkpointUid, 3)

    const rows = store.communication
    assert.equal(rows.length, 3)
    assert.ok(rows.every((r) => r.direction === 'IN' && r.channel === 'EMAIL' && r.status === 'RECEIVED'))
    const one = rows.find((r) => r.providerMessageId === '<one@mail.example>')
    assert.equal(one?.clientId, 'cli_ada')
    const impostor = rows.find((r) => r.providerMessageId === '<two@mail.example>')
    assert.equal(impostor?.clientId, null, 'a display name match must never link a customer')
    const noId = rows.find((r) => r.providerMessageId === 'hostmail-uid:3')
    assert.equal(noId?.clientId, 'cli_ada', 'sender matching is case-insensitive')
    assert.equal(noId?.body, 'Follow up')

    const checkpoint = JSON.parse(String(store.setting.find((s) => s.key === inbound.HOSTINGER_CHECKPOINT_SETTING)?.value))
    assert.equal(checkpoint.lastUid, 3)
    assert.equal(checkpoint.lastError, null)
  })

  it('a second run imports nothing even though the provider re-returns the last UID', async () => {
    const provider = fakeClient(messages)
    await inbound.syncHostingerInbox({}, provider)
    const again = await inbound.syncHostingerInbox({}, provider)
    assert.equal(again.imported, 0)
    assert.equal(again.stopped, 'COMPLETE')
    assert.equal(store.communication.length, 3)
  })

  it('replaying from an empty checkpoint creates no duplicate rows (receipts and stored-row check)', async () => {
    await inbound.syncHostingerInbox({}, fakeClient(messages))
    store.setting.length = 0
    const replay = await inbound.syncHostingerInbox({}, fakeClient(messages))
    assert.equal(replay.imported, 0)
    assert.equal(replay.duplicates, 3)
    assert.equal(store.communication.length, 3)
  })

  it('stops at the failing UID, keeps the checkpoint before it, and resumes without loss', async () => {
    const failed = await inbound.syncHostingerInbox({}, fakeClient(messages, { textFailUid: 2 }))
    assert.equal(failed.stopped, 'ERROR')
    assert.equal(failed.imported, 1)
    assert.equal(failed.checkpointUid, 1)
    assert.match(failed.error ?? '', /rate limit/i)
    assert.doesNotMatch(failed.error ?? '', /First question|client@example\.com/, 'errors must not carry message content')
    const receipt = store.inboundWebhookReceipt.find((r) => r.status === 'FAILED')
    assert.ok(receipt, 'the failing message receipt is marked FAILED, not PROCESSED')

    const resumed = await inbound.syncHostingerInbox({}, fakeClient(messages))
    assert.equal(resumed.stopped, 'COMPLETE')
    assert.equal(resumed.imported, 2)
    assert.equal(store.communication.length, 3, 'the failed message is stored exactly once after retry')
    assert.equal(resumed.checkpointUid, 3)
  })

  it('honours the per-run message budget', async () => {
    const summary = await inbound.syncHostingerInbox({ maxMessages: 1 }, fakeClient(messages))
    assert.equal(summary.stopped, 'BUDGET')
    assert.equal(summary.checkpointUid, 1)
    assert.equal(summary.imported, 1)
  })

  it('stops (does not skip) when another worker holds an unfinished claim on a message', async () => {
    const dedupKey = `msgid:${createHash('sha256').update('<two@mail.example>', 'utf8').digest('hex')}`
    store.inboundWebhookReceipt.push({
      id: 'rcp_held',
      provider: 'HOSTMAIL',
      eventIdHash: createHash('sha256').update(`HOSTMAIL\0${dedupKey}`, 'utf8').digest('hex'),
      status: 'PROCESSING',
      leaseExpiresAt: new Date(Date.now() + 60_000),
      updatedAt: new Date(),
    })
    const summary = await inbound.syncHostingerInbox({}, fakeClient(messages))
    assert.equal(summary.stopped, 'BUSY')
    assert.equal(summary.checkpointUid, 1, 'the checkpoint must not move past the held message')
    assert.equal(store.communication.length, 1)
  })

  it('reports NOT_CONFIGURED without contacting the provider when the integration is off', async () => {
    delete process.env.HOSTINGER_MAIL_ENABLED
    const provider = fakeClient(messages)
    const summary = await inbound.syncHostingerInbox({}, provider)
    assert.equal(summary.stopped, 'NOT_CONFIGURED')
    assert.equal(provider.textCalls.length, 0)
    assert.equal(store.communication.length, 0)
  })
})
