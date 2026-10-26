/**
 * TECH360 — outbox retry integration test.
 *
 * This exercises the REAL `retryCommunicationOutbox()` from src/lib/comms.ts,
 * not a reimplementation. The Prisma client cannot be generated in every
 * environment (it downloads an engine binary), so `@prisma/client` is replaced
 * with a recording stub and the model calls are asserted directly. The module
 * under test, its policy import and its control flow are the production code.
 *
 * The central regression being pinned: a retry must UPDATE the original
 * Communication row. The previous implementation re-entered sendCommunication(),
 * which INSERTED a new row per attempt, so a permanently failing message grew
 * the outbox forever instead of draining into DEAD_LETTER.
 */
import assert from 'node:assert/strict'
import { describe, it, beforeEach, mock } from 'node:test'
import { OUTBOX_MAX_ATTEMPTS } from '../src/lib/outbox-retry'

// ---- stub @prisma/client so src/lib/db.ts can be imported ----
type Call = { method: string; args: unknown }
const calls: Call[] = []
let stubState: {
  found: Record<string, unknown> | null
  updateManyCount: number
} = { found: null, updateManyCount: 1 }

class PrismaClientStub {
  communication = {
    findUnique: async ({ where }: { where: { id: string } }) => {
      calls.push({ method: 'communication.findUnique', args: where })
      return stubState.found && stubState.found.id === where.id ? stubState.found : null
    },
    create: async (args: unknown) => {
      calls.push({ method: 'communication.create', args })
      throw new Error('the retry path must never insert a new Communication row')
    },
    update: async ({ where, data }: { where: { id: string }; data: unknown }) => {
      calls.push({ method: 'communication.update', args: { where, data } })
      return { id: where.id }
    },
    updateMany: async ({ where, data }: { where: unknown; data: unknown }) => {
      calls.push({ method: 'communication.updateMany', args: { where, data } })
      return { count: stubState.updateManyCount }
    },
  }
  setting = {
    findUnique: async () => {
      calls.push({ method: 'setting.findUnique', args: 'feature_flags' })
      return channelEnabled ? null : { key: 'feature_flags', value: JSON.stringify({ whatsapp: false, email: false, sms: false }) }
    },
    deleteMany: async () => {
      calls.push({ method: 'setting.deleteMany', args: 'feature_flags' })
      return { count: 1 }
    },
  }
  notification = {
    create: async (args: unknown) => {
      calls.push({ method: 'notification.create', args })
      return { id: 'notif_1' }
    },
  }
}

mock.module('@prisma/client', {
  namedExports: { PrismaClient: PrismaClientStub },
  defaultExport: { PrismaClient: PrismaClientStub },
})

/** Super Admin channel switches, served to the REAL src/lib/features.ts. */
let channelEnabled = true

/** Module under test, imported lazily so the mocks above are already registered. */
async function loadComms() {
  return import('../src/lib/comms')
}

// src/lib/features.ts caches flags for 15s at module scope. The instance
// comms.ts reaches is loaded through the `@/` alias, so it holds its own cache
// that this test file cannot reset directly. Mocking the clock lets the real
// cache expire between tests instead of forcing a change to production code.
const NOW = Date.now()
mock.timers.enable({ apis: ['Date'], now: NOW })

async function reset(found: Record<string, unknown> | null, updateManyCount = 1) {
  calls.length = 0
  stubState = { found, updateManyCount }
  channelEnabled = true
  process.env.SMS_API_URL = 'https://sms.invalid/send'
  process.env.SMS_API_KEY = 'test-key'
  delete process.env.HTTPSMS_API_KEY
  delete process.env.HTTPSMS_FROM
  delete process.env.SMTP_HOST
  calls.length = 0
}

function updates() {
  return calls.filter((c) => c.method === 'communication.update').map((c) => c.args as { where: { id: string }; data: Record<string, unknown> })
}

/** Make the real SMS adapter succeed or fail without touching the network. */
function stubProviderFetch(mode: 'ok' | 'network-error' | 'http-503') {
  fetchMock = mock.method(globalThis, 'fetch', (async () => {
    if (mode === 'network-error') throw new Error('connect ECONNREFUSED 10.0.0.1:443')
    if (mode === 'http-503') return { ok: false, status: 503, json: async () => ({ message: 'upstream unavailable' }) }
    return { ok: true, status: 200, json: async () => ({ id: 'provider-msg-1' }) }
  }) as unknown as typeof fetch)
}

const baseRow = {
  id: 'comm_1',
  clientId: 'cl_1',
  channel: 'SMS',
  direction: 'OUT',
  recipient: '+8801700000000',
  subject: null,
  body: 'Hello',
  status: 'FAILED',
  error: 'connect ECONNREFUSED 10.0.0.1:443',
  attempts: 0,
  nextRetryAt: null,
  lastAttemptAt: null,
  createdAt: new Date(NOW),
}

/** Restore only the fetch spy; the module mocks must survive across tests. */
let fetchMock: ReturnType<typeof mock.method> | null = null

describe('retryCommunicationOutbox — the changed code path', () => {
  beforeEach(() => {
    fetchMock?.mock.restore()
    fetchMock = null
    mock.timers.tick(20_000) // expire the feature-flag cache
  })

  it('never inserts a duplicate row on retry (the original defect)', async () => {
    const { retryCommunicationOutbox } = await loadComms()
    await reset({ ...baseRow })
    stubProviderFetch('ok')
    const outcome = await retryCommunicationOutbox('comm_1')
    assert.equal(outcome.ok, true)
    assert.equal(outcome.action, 'SENT')
    assert.equal(calls.some((c) => c.method === 'communication.create'), false, 'a retry created a new Communication row')
    assert.ok(calls.some((c) => c.method === 'communication.update'), 'the original row was not updated')
  })

  it('updates the SAME row and clears the retry deadline on success', async () => {
    const { retryCommunicationOutbox } = await loadComms()
    await reset({ ...baseRow })
    stubProviderFetch('ok')
    const outcome = await retryCommunicationOutbox('comm_1')
    assert.equal(outcome.attempts, 1)
    const write = updates().at(-1)!
    assert.equal(write.where.id, 'comm_1')
    assert.equal(write.data.status, 'SENT')
    assert.equal(write.data.nextRetryAt, null)
    assert.equal(write.data.error, null)
    assert.equal(write.data.attempts, 1)
    assert.ok(write.data.sentAt instanceof Date)
  })

  it('backs off and reschedules the same row when the retry fails again', async () => {
    const { retryCommunicationOutbox } = await loadComms()
    await reset({ ...baseRow })
    stubProviderFetch('network-error')
    const outcome = await retryCommunicationOutbox('comm_1')
    assert.equal(outcome.ok, false)
    assert.equal(outcome.action, 'FAILED')
    assert.equal(outcome.attempts, 1)
    const write = updates().at(-1)!
    assert.equal(write.where.id, 'comm_1')
    assert.equal(write.data.status, 'FAILED')
    assert.ok(write.data.nextRetryAt instanceof Date)
    assert.ok((write.data.nextRetryAt as Date).getTime() > NOW)
    assert.equal(calls.some((c) => c.method === 'communication.create'), false)
  })

  it('dead-letters a permanent failure without re-dispatching', async () => {
    const { retryCommunicationOutbox } = await loadComms()
    await reset({ ...baseRow, error: 'Recipient is not a valid phone number' })
    stubProviderFetch('ok')
    const outcome = await retryCommunicationOutbox('comm_1')
    assert.equal(outcome.action, 'NOT_RETRYABLE')
    assert.equal(outcome.status, 'DEAD_LETTER')
    // No fetch happened: the provider stub was installed but never consulted,
    // and no notification-less silent skip either.
    const write = updates().at(-1)!
    assert.equal(write.data.status, 'DEAD_LETTER')
    assert.equal(write.data.nextRetryAt, null)
    assert.ok(calls.some((c) => c.method === 'notification.create'), 'operators were not told why it stopped')
  })

  it('dead-letters once the attempt budget is spent', async () => {
    const { retryCommunicationOutbox } = await loadComms()
    await reset({ ...baseRow, attempts: OUTBOX_MAX_ATTEMPTS })
    stubProviderFetch('ok')
    const outcome = await retryCommunicationOutbox('comm_1')
    assert.equal(outcome.action, 'DEAD_LETTER')
    assert.equal(outcome.attempts, OUTBOX_MAX_ATTEMPTS)
    assert.equal(outcome.status, 'DEAD_LETTER')
    const write = updates().at(-1)!
    assert.equal(write.data.status, 'DEAD_LETTER')
    assert.equal(calls.some((c) => c.method === 'communication.create'), false)
  })

  it('honours the backoff window instead of hammering the provider', async () => {
    const { retryCommunicationOutbox } = await loadComms()
    await reset({ ...baseRow, nextRetryAt: new Date(NOW + 3_600_000) })
    stubProviderFetch('ok')
    const outcome = await retryCommunicationOutbox('comm_1')
    assert.equal(outcome.action, 'BACKOFF_WAIT')
    assert.equal(outcome.ok, false)
    assert.equal(calls.some((c) => c.method === 'communication.update'), false, 'nothing should be written while waiting')
    assert.equal(calls.some((c) => c.method === 'communication.updateMany'), false, 'no attempt should be claimed while waiting')
  })

  it('lets an operator force a retry past the backoff window', async () => {
    const { retryCommunicationOutbox } = await loadComms()
    await reset({ ...baseRow, nextRetryAt: new Date(NOW + 3_600_000) })
    stubProviderFetch('ok')
    const outcome = await retryCommunicationOutbox('comm_1', { force: true, actor: 'admin@bdtech360.com' })
    assert.equal(outcome.action, 'SENT')
  })

  it('prevents a duplicate send when another dispatcher claims the attempt first', async () => {
    const { retryCommunicationOutbox } = await loadComms()
    await reset({ ...baseRow }, 0) // the conditional claim affects zero rows
    stubProviderFetch('ok')
    const outcome = await retryCommunicationOutbox('comm_1')
    assert.equal(outcome.action, 'SKIPPED')
    assert.match(outcome.reason, /duplicate send prevented/i)
    assert.equal(calls.some((c) => c.method === 'communication.update'), false, 'must not write after losing the claim')
  })

  it('refuses to send when the Super Admin has switched the channel off', async () => {
    const { retryCommunicationOutbox } = await loadComms()
    await reset({ ...baseRow })
    channelEnabled = false
    stubProviderFetch('ok')
    const outcome = await retryCommunicationOutbox('comm_1')
    assert.equal(outcome.action, 'DISABLED_BY_ADMIN')
    assert.equal(outcome.status, 'DISABLED_BY_ADMIN')
    const write = updates().at(-1)!
    assert.match(String(write.data.error), /switched OFF by Super Admin/)
  })

  it('refuses to retry inbound messages', async () => {
    const { retryCommunicationOutbox } = await loadComms()
    await reset({ ...baseRow, direction: 'IN' })
    stubProviderFetch('ok')
    const outcome = await retryCommunicationOutbox('comm_1')
    assert.equal(outcome.action, 'SKIPPED')
    assert.match(outcome.reason, /outbound/i)
  })

  it('reports a missing record honestly instead of inventing a send', async () => {
    const { retryCommunicationOutbox } = await loadComms()
    await reset(null)
    stubProviderFetch('ok')
    const outcome = await retryCommunicationOutbox('does-not-exist')
    assert.equal(outcome.ok, false)
    assert.equal(outcome.action, 'SKIPPED')
    assert.match(outcome.reason, /not found/i)
  })

  it('reschedules rather than dead-lettering on a provider 5xx', async () => {
    const { retryCommunicationOutbox } = await loadComms()
    await reset({ ...baseRow })
    stubProviderFetch('http-503')
    const outcome = await retryCommunicationOutbox('comm_1')
    assert.equal(outcome.action, 'FAILED')
    assert.equal(outcome.status, 'FAILED')
    assert.ok(updates().at(-1)!.data.nextRetryAt instanceof Date)
  })
})
