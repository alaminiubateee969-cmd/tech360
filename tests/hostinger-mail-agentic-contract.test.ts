/**
 * Contract test for the extended Hostinger Agentic Mail adapter.
 *
 * The REAL `hostinger-mail-api-sdk` is pointed at a local fake server so the
 * requests our code ships are verified field by field: folder listing, quota,
 * message paging, attachment download, move, flag changes, folder creation,
 * webhook listing and a threaded send with an attachment.
 *
 * Nothing reaches api.mail.hostinger.com and no credential is real.
 */
import assert from 'node:assert/strict'
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http'
import type { AddressInfo } from 'node:net'
import { after, before, beforeEach, describe, it } from 'node:test'
import { createHostingerMailClient, sendHostingerEmail, type HostingerMailClient } from '../src/lib/mail/hostinger-mail'
import type { HostingerMailConfig } from '../src/lib/mail/hostinger-config'

const TOKEN = 'hm_agentic_contract_token_0123456789'
const MAILBOX = 'MBX_AGENTIC_1'
const FROM = 'info@bdtech360.com'

type Recorded = { method: string; path: string; query: string; authorization: string | undefined; body: string }
let recorded: Recorded[] = []
let server: Server
let baseUrl = ''

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve) => {
    let data = ''
    req.on('data', (c: Buffer) => { data += c.toString('utf8') })
    req.on('end', () => resolve(data))
  })
}

function ok(res: ServerResponse, body: unknown) {
  res.writeHead(200, { 'content-type': 'application/json' })
  res.end(JSON.stringify(body))
}

before(async () => {
  server = createServer(async (req, res) => {
    const url = new URL(req.url ?? '/', 'http://localhost')
    const raw = await readBody(req)
    recorded.push({
      method: req.method ?? '',
      path: decodeURIComponent(url.pathname),
      query: url.search,
      authorization: req.headers.authorization,
      body: raw,
    })

    const base = `/api/v1/mailboxes/${MAILBOX}`
    if (req.method === 'GET' && url.pathname === base + '/folders') {
      return ok(res, {
        data: [
          { path: 'INBOX', name: 'INBOX', delimiter: '/', specialUse: '\\Inbox', messageCount: 12 },
          { path: 'Sent', name: 'Sent', delimiter: '/', specialUse: '\\Sent', messageCount: 4 },
        ],
        pagination: { page: 1, perPage: 200, total: 2, totalPages: 1 },
      })
    }
    if (req.method === 'POST' && url.pathname === base + '/folders') {
      return ok(res, { data: { path: 'Clients/TECH360', name: 'TECH360', delimiter: '/', specialUse: null, messageCount: 0 } })
    }
    if (req.method === 'GET' && url.pathname === base + '/quota') {
      return ok(res, { data: { quotas: [], totalUsage: 2_000, totalLimit: 10_000, totalPercentage: 20, supported: true } })
    }
    if (req.method === 'GET' && url.pathname === base + '/folders/INBOX/messages') {
      return ok(res, {
        data: [{
          uid: 41, path: 'INBOX', date: '2026-11-11T09:00:00Z', flags: ['\\Seen'], unseen: false, size: 512,
          subject: 'Re: TECH-2026-000114', from: { name: 'Client', address: 'Client@Example.com' },
          to: [], cc: [], bcc: [], messageId: '<m41@example.com>', inReplyTo: '', attachments: [],
        }],
        pagination: { page: 1, perPage: 25, total: 1, totalPages: 1 },
      })
    }
    if (req.method === 'GET' && url.pathname === base + '/folders/INBOX/messages/41/move') {
      return ok(res, {})
    }
    if (req.method === 'POST' && url.pathname === base + '/folders/INBOX/messages/41/move') {
      return ok(res, {})
    }
    if (req.method === 'PATCH' && url.pathname === base + '/folders/INBOX/messages/41') {
      return ok(res, { data: { uid: 41, path: 'INBOX', date: '2026-11-11T09:00:00Z', flags: ['\\Seen'], unseen: false, size: 512, subject: 'x', from: null, to: [], cc: [], bcc: [], messageId: '<m41@example.com>', inReplyTo: '', attachments: [] } })
    }
    if (req.method === 'GET' && url.pathname === base + '/folders/INBOX/messages/41/attachments/ATT-1') {
      res.writeHead(200, { 'content-type': 'application/pdf', 'content-disposition': 'attachment; filename="quote.pdf"' })
      return res.end(Buffer.from('%PDF-1.4 test'))
    }
    if (req.method === 'POST' && url.pathname === base + '/send') {
      res.writeHead(204)
      return res.end()
    }
    if (req.method === 'GET' && url.pathname === base + '/webhooks') {
      return ok(res, {
        data: [{
          id: 'WH-1', accountResourceId: 'ACC', mailbox: MAILBOX, name: 'TECH360 inbound',
          description: null, events: ['message.received'], status: 'active',
          url: 'https://bdtech360.com/api/webhooks/hostinger-mail',
          createdAt: '2026-11-01T00:00:00Z', updatedAt: '2026-11-01T00:00:00Z',
        }],
        pagination: { page: 1, perPage: 100, total: 1, totalPages: 1 },
      })
    }
    res.writeHead(404, { 'content-type': 'application/json' })
    res.end(JSON.stringify({ error: 'Not found.', code: 'ERR_NOT_FOUND', params: {} }))
  })
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()))
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
})

after(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()))
})

beforeEach(() => { recorded = [] })

const config: HostingerMailConfig = { token: TOKEN, mailboxResourceId: MAILBOX, fromAddress: FROM, webhookSecret: null }
const client = (): HostingerMailClient => createHostingerMailClient(config, { basePath: baseUrl })

describe('folder and quota reads', () => {
  it('lists folders with the documented GET path and the Bearer token', async () => {
    const folders = await client().listFolders()
    assert.deepEqual(folders.map((f) => f.path), ['INBOX', 'Sent'])
    const call = recorded[0]
    assert.equal(call.method, 'GET')
    assert.equal(call.path, `/api/v1/mailboxes/${MAILBOX}/folders`)
    assert.equal(call.authorization, `Bearer ${TOKEN}`)
  })

  it('reads the quota without inventing a value', async () => {
    const quota = await client().getQuota()
    assert.deepEqual(quota, { supported: true, totalUsage: 2_000, totalLimit: 10_000, percentage: 20 })
    assert.equal(recorded[0].path, `/api/v1/mailboxes/${MAILBOX}/quota`)
  })

  it('lists a page of messages and lower-cases the sender address', async () => {
    const page = await client().listMessages({ folder: 'INBOX', page: 1, perPage: 25 })
    assert.equal(page.items.length, 1)
    assert.equal(page.items[0].fromAddress, 'client@example.com')
    assert.deepEqual(page.items[0].flags, ['\\Seen'])
    const call = recorded.find((r) => r.path.endsWith('/folders/INBOX/messages'))
    assert.match(call?.query ?? '', /page=1/)
    assert.match(call?.query ?? '', /sort=uid/)
  })
})

describe('mailbox operations', () => {
  it('moves a message with the documented POST body', async () => {
    await client().moveMessage({ folder: 'INBOX', uid: 41, targetFolder: 'Clients/TECH360' })
    const call = recorded.find((r) => r.method === 'POST' && r.path.endsWith('/messages/41/move'))
    assert.ok(call)
    assert.deepEqual(JSON.parse(call.body), { targetFolder: 'Clients/TECH360' })
  })

  it('changes flags with a PATCH on the message resource', async () => {
    await client().setMessageFlags({ folder: 'INBOX', uid: 41, addFlags: ['\\Seen'], removeFlags: ['\\Flagged'] })
    const call = recorded.find((r) => r.method === 'PATCH')
    assert.ok(call)
    assert.equal(call.path, `/api/v1/mailboxes/${MAILBOX}/folders/INBOX/messages/41`)
    assert.deepEqual(JSON.parse(call.body), { addFlags: ['\\Seen'], removeFlags: ['\\Flagged'] })
  })

  it('creates a folder by name', async () => {
    const created = await client().createFolder('Clients/TECH360')
    assert.equal(created.path, 'Clients/TECH360')
    const call = recorded.find((r) => r.method === 'POST' && r.path.endsWith('/folders'))
    assert.deepEqual(JSON.parse(call?.body ?? '{}'), { name: 'Clients/TECH360' })
  })

  it('downloads an attachment as base64 with its real content type', async () => {
    const attachment = await client().getMessageAttachment({ folder: 'INBOX', uid: 41, attachmentId: 'ATT-1' })
    assert.equal(attachment.base64, Buffer.from('%PDF-1.4 test').toString('base64'))
    assert.equal(attachment.filename, 'quote.pdf')
    assert.equal(recorded[0].path, `/api/v1/mailboxes/${MAILBOX}/folders/INBOX/messages/41/attachments/ATT-1`)
  })

  it('lists the registered webhooks so registration can be verified', async () => {
    const hooks = await client().listWebhooks()
    assert.equal(hooks.length, 1)
    assert.deepEqual(hooks[0].events, ['message.received'])
    assert.equal(hooks[0].status, 'active')
  })
})

describe('threaded send with attachment', () => {
  it('sends inReplyTo and the attachment in the documented body', async () => {
    const result = await sendHostingerEmail(
      {
        to: 'client@example.com',
        subject: 'Re: TECH-2026-000114',
        html: '<p>Hello</p>',
        text: 'Hello',
        inReplyTo: { uid: 41, folder: 'INBOX' },
        attachments: [{ filename: 'sow.pdf', contentBase64: 'JVBERi0xLjQ=', contentType: 'application/pdf' }],
      },
      { client: client(), displayName: 'Tech360' },
    )
    assert.equal(result.ok, true)
    const call = recorded.find((r) => r.path.endsWith('/send'))
    const body = JSON.parse(call?.body ?? '{}') as Record<string, unknown>
    assert.deepEqual(body.inReplyTo, { uid: 41, folder: 'INBOX' })
    assert.deepEqual(body.attachments, [{ filename: 'sow.pdf', content: 'JVBERi0xLjQ=', contentType: 'application/pdf' }])
    assert.equal('forwardOf' in body, false, 'unset threading fields are not sent')
  })
})
