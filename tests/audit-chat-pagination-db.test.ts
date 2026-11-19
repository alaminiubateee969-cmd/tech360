import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import { after, before, describe, it } from 'node:test'
import { db } from '../src/lib/db'
import { messagesAfter, sseStream } from '../src/lib/webchat/thread'

const HAS_DB = Boolean(process.env.PREVIEW_SQLITE_URL || process.env.DATABASE_URL)
const RUN = `cursor${randomBytes(6).toString('hex')}`
const id = (index: number) => `${RUN}_${String(index).padStart(4, '0')}`

describe('audit: real chat keyset pagination does not lose equal-timestamp messages', { skip: !HAS_DB }, () => {
  let conversationId: string
  let otherId: string
  const at = new Date('2026-11-18T00:00:00.000Z')
  const visibleIds = Array.from({ length: 650 }, (_, i) => i).filter((i) => i % 50 !== 0).map(id)

  before(async () => {
    assert.notEqual(process.env.NODE_ENV, 'production')
    const url = new URL(process.env.PREVIEW_SQLITE_URL || process.env.DATABASE_URL || '')
    assert.ok(url.protocol === 'file:' && url.pathname.endsWith('/.preview/test.db')
      || url.protocol === 'mysql:' && ['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname)
      && ['tech360_ci', 'tech360_test'].includes(decodeURIComponent(url.pathname.slice(1))), 'requires a disposable test database')
    conversationId = (await db.chatConversation.create({ data: { anonId: RUN, contactConsentAt: at } })).id
    otherId = (await db.chatConversation.create({ data: { anonId: `${RUN}-other`, contactConsentAt: at } })).id
    await db.chatMessage.createMany({ data: Array.from({ length: 650 }, (_, i) => ({
      id: id(i), conversationId, sender: i % 2 ? 'ADMIN' : 'VISITOR', body: `message ${i}`, createdAt: at,
      internal: i % 50 === 0, kind: i % 50 === 0 ? 'NOTE' : 'MESSAGE',
    })) })
    await db.chatMessage.create({ data: { id: `${RUN}-foreign`, conversationId: otherId, sender: 'ADMIN', body: 'foreign conversation must remain private', createdAt: at } })
  })
  after(async () => {
    if (!conversationId || !otherId) return
    await db.chatMessage.deleteMany({ where: { conversationId: { in: [conversationId, otherId] } } })
    await db.chatConversation.deleteMany({ where: { id: { in: [conversationId, otherId] } } })
  })

  it('delivers every visible message across a 300-row page boundary exactly once', async () => {
    const received: string[] = []
    let afterId: string | null = null
    for (let page = 0; page < 5; page += 1) {
      const rows = await messagesAfter(conversationId, afterId, 'VISITOR')
      assert.ok(rows.length <= 300)
      if (!rows.length) break
      assert.ok(rows.every((row) => !row.internal && row.kind !== 'NOTE'))
      received.push(...rows.map((row) => row.id))
      afterId = rows[rows.length - 1].id
    }
    assert.deepEqual(received, visibleIds)
    assert.equal(new Set(received).size, received.length)
  })

  it('can reconnect after an anchor beyond the first 300 equal-timestamp rows', async () => {
    const rows = await messagesAfter(conversationId, id(449), 'VISITOR')
    assert.deepEqual(rows.map((row) => row.id), visibleIds.filter((value) => value > id(449)))
  })

  it('uses a hidden-note anchor only as an ordering boundary, without leaking the note or dropping visible ties', async () => {
    const rows = await messagesAfter(conversationId, id(600), 'VISITOR')
    assert.deepEqual(rows.map((row) => row.id), visibleIds.filter((value) => value > id(600)))
  })

  it('uses the same deterministic pagination for the operator including notes', async () => {
    const rows = await messagesAfter(conversationId, id(449), 'OPERATOR')
    assert.deepEqual(rows.map((row) => row.id), Array.from({ length: 200 }, (_, i) => id(i + 450)))
  })

  it('never follows an anchor from another conversation into that conversation', async () => {
    const rows = await messagesAfter(conversationId, `${RUN}-foreign`, 'VISITOR')
    assert.ok(rows.length > 0)
    assert.ok(rows.every((row) => !row.body.includes('foreign conversation')))
  })
})

describe('audit: SSE resumption and stream lifecycle', () => {
  it('emits an SSE id for delivered message batches so EventSource can resume after a network reconnect', async () => {
    const body = sseStream(new AbortController().signal, async (send) => {
      send('messages', { messages: [{ id: 'audit-message-id' }], lastId: 'audit-message-id' }, 'audit-message-id')
      return false
    }, { intervalMs: 1, maxMs: 50 })
    const text = await new Response(body).text()
    assert.match(text, /id: audit-message-id\n/)
    assert.match(text, /event: messages\n/)
  })

  it('does not query or emit into a stream whose request was already aborted', async () => {
    const controller = new AbortController()
    controller.abort()
    let ticks = 0
    const body = sseStream(controller.signal, async () => { ticks += 1; return false }, { intervalMs: 1, maxMs: 50 })
    assert.equal(await new Response(body).text(), '')
    assert.equal(ticks, 0)
  })
})
