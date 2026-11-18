/**
 * SMS opt-out end to end, on a real disposable database.
 *
 * Regression guard for the consent key used by lib/comms. The STOP webhook
 * persists an opt-out with setOptOut(Client.id, Client.clientId, true). The
 * send and retry paths read it back with loadCommState(Communication.clientId, ...),
 * and Communication.clientId is a foreign key to Client.id. If either side ever
 * switches to the human TECH-YYYY-NNNNNN code, the two keys stop matching. The
 * opt-out would then be silently ignored and an opted-out customer would get an
 * SMS. The other outbox tests stub the state lookup without regard to its key,
 * so only a persisted round trip can catch that.
 *
 * Runs against a disposable database only. It is skipped when none is
 * configured, rather than reporting a fake pass. The SMS provider fetch is
 * stubbed so no real message can leave the machine.
 */
import assert from 'node:assert/strict'
import { after, before, describe, it } from 'node:test'

const HAS_DB = Boolean(process.env.PREVIEW_SQLITE_URL || process.env.DATABASE_URL)
const RUN = `sop${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`
const SMS_URL = 'https://sms-provider.test.invalid/send'

describe('SMS opt-out persists and blocks sends (database)', { skip: !HAS_DB }, () => {
  let db: typeof import('../src/lib/db').db
  let comms: typeof import('../src/lib/comms')
  let state: typeof import('../src/lib/conversation-state')
  const clientRowIds: string[] = []
  const realFetch = globalThis.fetch
  const savedEnv = { url: process.env.SMS_API_URL, key: process.env.SMS_API_KEY, hk: process.env.HTTPSMS_API_KEY, hf: process.env.HTTPSMS_FROM }
  let providerCalls: string[] = []

  async function newClient(suffix: string) {
    const c = await db.client.create({
      data: { clientId: `TECH-2099-${RUN}${suffix}`.slice(0, 40), name: `Opt-out ${suffix}`, phone: '+8801700000000' },
    })
    clientRowIds.push(c.id)
    return c
  }

  before(async () => {
    ;({ db } = await import('../src/lib/db'))
    comms = await import('../src/lib/comms')
    state = await import('../src/lib/conversation-state')
    process.env.SMS_API_URL = SMS_URL
    process.env.SMS_API_KEY = 'test-only-not-a-secret'
    delete process.env.HTTPSMS_API_KEY
    delete process.env.HTTPSMS_FROM
    globalThis.fetch = (async (input: string | URL | Request) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
      if (url !== SMS_URL) return realFetch(input)
      providerCalls.push(url)
      return new Response(JSON.stringify({ id: `prov-${providerCalls.length}` }), { status: 200, headers: { 'content-type': 'application/json' } })
    }) as typeof fetch
  })

  after(async () => {
    globalThis.fetch = realFetch
    for (const [k, v] of [['SMS_API_URL', savedEnv.url], ['SMS_API_KEY', savedEnv.key], ['HTTPSMS_API_KEY', savedEnv.hk], ['HTTPSMS_FROM', savedEnv.hf]] as const) {
      if (v === undefined) delete process.env[k]
      else process.env[k] = v
    }
    if (clientRowIds.length) {
      await db.aiMemory.deleteMany({ where: { key: { in: clientRowIds.map((id) => `comm_state:${id}`) } } })
      await db.communication.deleteMany({ where: { clientId: { in: clientRowIds } } })
      await db.client.deleteMany({ where: { id: { in: clientRowIds } } })
    }
  })

  it('control: a consenting customer is actually dispatched to the provider', async () => {
    const c = await newClient('ok')
    providerCalls = []
    const { communicationId, result } = await comms.sendCommunication({ clientId: c.id, channel: 'SMS', to: c.phone!, body: 'Your project update is ready.' })
    assert.equal(result.ok, true, `expected a dispatched send, got ${result.status}: ${result.error ?? ''}`)
    assert.equal(providerCalls.length, 1)
    const row = await db.communication.findUniqueOrThrow({ where: { id: communicationId } })
    assert.equal(row.status, 'SENT')
  })

  it('an opt-out written the way the STOP webhook writes it refuses the next send', async () => {
    const c = await newClient('stop')
    await state.setOptOut(c.id, c.clientId, true) // same call as api/webhooks/sms on STOP
    const persisted = await db.aiMemory.findFirst({ where: { key: `comm_state:${c.id}` } })
    assert.ok(persisted, 'opt-out was not persisted')
    assert.equal(JSON.parse(persisted.content).optedOut, true)

    providerCalls = []
    const { communicationId, result } = await comms.sendCommunication({ clientId: c.id, channel: 'SMS', to: c.phone!, body: 'Promo: 20% off this week' })
    assert.equal(result.status, 'OPTED_OUT')
    assert.equal(providerCalls.length, 0, 'an opted-out customer was sent an SMS')
    const row = await db.communication.findUniqueOrThrow({ where: { id: communicationId } })
    assert.equal(row.status, 'OPTED_OUT')
    assert.equal(row.sentAt, null)
    assert.equal(row.nextRetryAt, null)
  })

  it('a failed SMS queued before the opt-out is never retried afterwards', async () => {
    const c = await newClient('late')
    const queued = await db.communication.create({
      data: { clientId: c.id, channel: 'SMS', direction: 'OUT', recipient: c.phone!, body: 'Reminder', status: 'FAILED', attempts: 1, nextRetryAt: new Date(Date.now() - 1000) },
    })
    await state.setOptOut(c.id, c.clientId, true)

    providerCalls = []
    const outcome = await comms.retryCommunicationOutbox(queued.id)
    assert.equal(outcome.ok, false)
    assert.equal(outcome.status, 'OPTED_OUT')
    assert.equal(providerCalls.length, 0, 'retry dispatched an SMS to an opted-out customer')
    const row = await db.communication.findUniqueOrThrow({ where: { id: queued.id } })
    assert.equal(row.status, 'OPTED_OUT')
    assert.equal(row.nextRetryAt, null)
  })
})
