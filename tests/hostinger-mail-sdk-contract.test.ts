/**
 * Contract test: the REAL hostinger-mail-api-sdk makes REAL HTTP requests to a
 * local fake server that follows the documented Hostinger Mail API shapes.
 * Nothing reaches api.mail.hostinger.com. It proves, for the code we ship:
 *   - request paths, methods, query parameters and the Bearer header;
 *   - the JSON body of a send (no undefined fields leak into the payload);
 *   - the status-code → outcome mapping, including timeouts and refused connections;
 *   - that a token never appears in any returned error text.
 */
import assert from 'node:assert/strict'
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http'
import type { AddressInfo } from 'node:net'
import { after, before, beforeEach, describe, it } from 'node:test'
import { createHostingerMailClient, sendHostingerEmail, verifyHostingerMailbox, type HostingerMailClient } from '../src/lib/mail/hostinger-mail'
import type { HostingerMailConfig } from '../src/lib/mail/hostinger-config'

const TOKEN = 'hm_contract_token_0123456789ABCDEFGHIJ'
const MAILBOX = 'MBX_CONTRACT_1'
const FROM = 'info@bdtech360.com'

type Recorded = { method: string; path: string; query: string; authorization: string | undefined; body: unknown }
let recorded: Recorded[] = []
let next: { status: number; body?: unknown; delayMs?: number } | null = null
let server: Server
let baseUrl = ''

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve) => {
    let data = ''
    req.on('data', (chunk: Buffer) => { data += chunk.toString('utf8') })
    req.on('end', () => resolve(data))
  })
}

function respond(res: ServerResponse, status: number, body?: unknown) {
  if (status === 204 || body === undefined) {
    res.writeHead(status)
    res.end()
    return
  }
  res.writeHead(status, { 'content-type': 'application/json' })
  res.end(JSON.stringify(body))
}

before(async () => {
  server = createServer(async (req, res) => {
    const url = new URL(req.url ?? '/', 'http://localhost')
    const raw = await readBody(req)
    let parsed: unknown = undefined
    try { parsed = raw ? JSON.parse(raw) : undefined } catch { parsed = raw }
    recorded.push({ method: req.method ?? '', path: url.pathname, query: url.search, authorization: req.headers.authorization, body: parsed })

    if (next) {
      const forced = next
      next = null
      if (forced.delayMs) await new Promise((r) => setTimeout(r, forced.delayMs))
      return respond(res, forced.status, forced.body)
    }
    if (req.method === 'GET' && url.pathname === '/api/v1/me') {
      return respond(res, 200, { data: { orderResourceId: 'ORD_1', mailboxes: [{ resourceId: MAILBOX, address: FROM }] } })
    }
    if (req.method === 'POST' && url.pathname === `/api/v1/mailboxes/${MAILBOX}/send`) return respond(res, 204)
    if (req.method === 'POST' && url.pathname === `/api/v1/mailboxes/${MAILBOX}/folders/INBOX/messages/search`) {
      return respond(res, 200, {
        data: [{ uid: 7, path: 'INBOX', date: '2026-10-23T10:00:00Z', flags: [], unseen: true, size: 10, subject: 'Re: TECH-2026-000001', from: { name: 'A', address: 'Client@Example.com' }, to: [], cc: [], bcc: [], messageId: '<m7@example.com>', inReplyTo: '', attachments: [] }],
        pagination: { page: 1, perPage: 50, total: 1, totalPages: 1 },
      })
    }
    if (req.method === 'GET' && url.pathname === `/api/v1/mailboxes/${MAILBOX}/folders/INBOX/messages/7/text`) {
      return respond(res, 200, { data: { text: 'Hello from the customer', html: '<p>Hello</p>' } })
    }
    return respond(res, 404, { error: 'Not found.', code: 'ERR_NOT_FOUND', params: {} })
  })
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()))
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
})

after(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()))
})

beforeEach(() => {
  recorded = []
  next = null
})

const config: HostingerMailConfig = { token: TOKEN, mailboxResourceId: MAILBOX, fromAddress: FROM, webhookSecret: null }
const client = (timeoutMs?: number): HostingerMailClient => createHostingerMailClient(config, { basePath: baseUrl, timeoutMs })
const message = { to: 'customer@example.com', subject: 'Welcome', html: '<p>Hi</p>', text: 'Hi' }

describe('SDK send: real request shape and outcome', () => {
  it('POSTs to the documented send path with a Bearer token and a clean JSON body', async () => {
    const result = await sendHostingerEmail(message, { client: client(), displayName: 'Tech360' })
    assert.equal(result.ok, true)
    assert.equal(result.status, 'SENT')
    assert.equal(result.classification, 'ACCEPTED')
    assert.equal(result.providerMessageId, undefined, 'Hostinger returns no message id on send')
    const call = recorded.find((r) => r.path.endsWith('/send'))
    assert.ok(call, 'send request was made')
    assert.equal(call.method, 'POST')
    assert.equal(call.path, `/api/v1/mailboxes/${MAILBOX}/send`)
    assert.equal(call.authorization, `Bearer ${TOKEN}`)
    assert.deepEqual(call.body, { to: ['customer@example.com'], subject: 'Welcome', html: '<p>Hi</p>', text: 'Hi', displayName: 'Tech360' })
    assert.ok(!('cc' in (call.body as object)) && !('inReplyTo' in (call.body as object)), 'unset optional fields are not sent')
  })

  it('refuses an invalid recipient without making any request', async () => {
    const result = await sendHostingerEmail({ ...message, to: 'not an address' }, { client: client() })
    assert.equal(result.ok, false)
    assert.equal(result.classification, 'REJECTED')
    assert.equal(recorded.length, 0)
  })

  it('maps 429 to NOT_PROCESSED and 422 to REJECTED using the provider code', async () => {
    next = { status: 429, body: { error: 'Too many requests.', code: 'ERR_RATE_LIMIT', params: {} } }
    const limited = await sendHostingerEmail(message, { client: client() })
    assert.equal(limited.classification, 'NOT_PROCESSED')
    assert.match(limited.error ?? '', /HTTP 429 \(ERR_RATE_LIMIT\)/)

    next = { status: 422, body: { error: 'Validation failed.', code: 'ERR_VALIDATION', params: { to: ['invalid'] } } }
    const invalid = await sendHostingerEmail(message, { client: client() })
    assert.equal(invalid.classification, 'REJECTED')
    assert.match(invalid.error ?? '', /HTTP 422 \(ERR_VALIDATION\)/)
  })

  it('maps 401 to REJECTED and never echoes the token or the upstream message', async () => {
    next = { status: 401, body: { error: `Bearer ${TOKEN} is invalid for customer@example.com`, code: 'ERR_UNAUTHENTICATED', params: {} } }
    const result = await sendHostingerEmail(message, { client: client() })
    assert.equal(result.classification, 'REJECTED')
    const text = JSON.stringify(result)
    assert.doesNotMatch(text, new RegExp(TOKEN))
    assert.doesNotMatch(text, /customer@example\.com/)
  })

  it('maps HTTP 504 after the request was handed over to AMBIGUOUS', async () => {
    next = { status: 504, body: { error: 'Upstream timeout.', code: 'ERR_UPSTREAM_TIMEOUT', params: {} } }
    const result = await sendHostingerEmail(message, { client: client() })
    assert.equal(result.classification, 'AMBIGUOUS')
    assert.match(result.error ?? '', /^AMBIGUOUS_PROVIDER_OUTCOME/)
  })

  it('maps a client-side timeout after the request is sent to AMBIGUOUS', async () => {
    next = { status: 204, delayMs: 800 }
    const result = await sendHostingerEmail(message, { client: client(150) })
    assert.equal(result.classification, 'AMBIGUOUS', 'a timed-out send may still have been accepted')
    assert.match(result.error ?? '', /^AMBIGUOUS_PROVIDER_OUTCOME/)
  })

  it('maps a refused connection to NOT_PROCESSED (the request never left the process)', async () => {
    const closed = await new Promise<number>((resolve) => {
      const probe = createServer()
      probe.listen(0, '127.0.0.1', () => {
        const port = (probe.address() as AddressInfo).port
        probe.close(() => resolve(port))
      })
    })
    const dead = createHostingerMailClient(config, { basePath: `http://127.0.0.1:${closed}`, timeoutMs: 2000 })
    const result = await sendHostingerEmail(message, { client: dead })
    assert.equal(result.classification, 'NOT_PROCESSED')
  })
})

describe('SDK read paths: account, search and message text', () => {
  it('verifies the mailbox resource id and sender address with GET /api/v1/me', async () => {
    const ok = await verifyHostingerMailbox(config, client())
    assert.deepEqual(ok, { ok: true, mailboxAddress: FROM })
    assert.equal(recorded[0].authorization, `Bearer ${TOKEN}`)
  })

  it('reports a mismatched sender address or an unknown mailbox without a send', async () => {
    const wrongSender = await verifyHostingerMailbox({ ...config, fromAddress: 'other@bdtech360.com' }, client())
    assert.equal(wrongSender.ok, false)
    const wrongMailbox = await verifyHostingerMailbox({ ...config, mailboxResourceId: 'MBX_OTHER' }, client())
    assert.equal(wrongMailbox.ok, false)
    assert.equal(recorded.filter((r) => r.path.endsWith('/send')).length, 0)
  })

  it('searches INBOX by UID with the documented search endpoint and returns lower-cased sender addresses', async () => {
    const page = await client().searchInbox({ uidFrom: 5, page: 1, perPage: 50 })
    const call = recorded.find((r) => r.path.endsWith('/messages/search'))
    assert.ok(call)
    assert.equal(call.method, 'POST')
    assert.equal(call.path, `/api/v1/mailboxes/${MAILBOX}/folders/INBOX/messages/search`)
    assert.match(call.query, /page=1/)
    assert.match(call.query, /perPage=50/)
    assert.match(call.query, /sort=uid/)
    assert.deepEqual(call.body, { uid: '5:*' })
    assert.equal(page.items[0].uid, 7)
    assert.equal(page.items[0].fromAddress, 'client@example.com')
    assert.equal(page.items[0].messageId, '<m7@example.com>')
    assert.equal(page.items[0].inReplyTo, null)
    assert.equal(page.totalPages, 1)
  })

  it('reads message text by UID without requesting any mutation', async () => {
    const text = await client().getInboxMessageText(7)
    assert.equal(text.text, 'Hello from the customer')
    const call = recorded.find((r) => r.path.endsWith('/text'))
    assert.equal(call?.method, 'GET')
    assert.ok(recorded.every((r) => r.method === 'GET' || r.method === 'POST'))
    assert.ok(!recorded.some((r) => r.method === 'DELETE' || r.path.endsWith('/move') || r.method === 'PATCH'))
  })
})
