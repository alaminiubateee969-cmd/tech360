/**
 * The email channel's routing between SMTP and the Hostinger Mail API, with
 * no network. Verifies that enabling Hostinger without a valid configuration
 * refuses sends (it never falls back silently), and that the default remains
 * the existing SMTP behaviour.
 */
import assert from 'node:assert/strict'
import { afterEach, before, beforeEach, describe, it, mock } from 'node:test'
import { createFakePrismaClientClass, createFakeStore } from './support/hostinger-fake-prisma'

type Comms = typeof import('../src/lib/comms')
let comms: Comms

before(async () => {
  const store = createFakeStore()
  mock.module('@prisma/client', {
    namedExports: { PrismaClient: createFakePrismaClientClass(store) },
    defaultExport: { PrismaClient: createFakePrismaClientClass(store) },
  })
  comms = await import('../src/lib/comms')
})

const KEYS = ['HOSTINGER_MAIL_ENABLED', 'HOSTINGER_MAIL_API_TOKEN', 'HOSTINGER_MAILBOX_RESOURCE_ID', 'HOSTINGER_MAIL_FROM_ADDRESS', 'SMTP_HOST', 'SMTP_USER', 'SMTP_PASS', 'SMTP_FROM']
const saved: Record<string, string | undefined> = {}
beforeEach(() => {
  for (const k of KEYS) { saved[k] = process.env[k]; delete process.env[k] }
})
afterEach(() => {
  for (const k of KEYS) {
    if (saved[k] === undefined) delete process.env[k]
    else process.env[k] = saved[k]
  }
})

const email = { channel: 'EMAIL', to: 'customer@example.com', subject: 'Hello', body: '<p>Hi</p>' }

describe('email channel routing', () => {
  it('keeps the existing SMTP behaviour when Hostinger is not enabled', async () => {
    assert.equal(comms.isHostingerMailSelected(), false)
    assert.equal(comms.channelConfigured('EMAIL'), false)
    const result = await comms.dispatchChannel(email)
    assert.equal(result.status, 'NOT_CONFIGURED')
    assert.match(result.error ?? '', /SMTP credentials not configured/)
  })

  it('refuses sends when Hostinger is enabled but incomplete, naming the missing variables and never falling back to SMTP', async () => {
    process.env.HOSTINGER_MAIL_ENABLED = 'true'
    process.env.SMTP_HOST = 'smtp.example.invalid'
    process.env.SMTP_USER = 'u'
    process.env.SMTP_PASS = 'p'
    process.env.SMTP_FROM = 'info@bdtech360.com'
    assert.equal(comms.isHostingerMailSelected(), true)
    const result = await comms.dispatchChannel(email)
    assert.equal(result.status, 'NOT_CONFIGURED')
    assert.match(result.error ?? '', /HOSTINGER_MAIL_API_TOKEN/)
    assert.match(result.error ?? '', /HOSTINGER_MAILBOX_RESOURCE_ID/)
    assert.doesNotMatch(result.error ?? '', /smtp\.example|customer@example/)
  })

  it('reports the email channel as configured only when the Hostinger configuration is complete', () => {
    process.env.HOSTINGER_MAIL_ENABLED = 'true'
    process.env.HOSTINGER_MAIL_API_TOKEN = 'hm_routing_token_0123456789abcdefgh'
    process.env.HOSTINGER_MAILBOX_RESOURCE_ID = 'MBX_ROUTING_1'
    process.env.HOSTINGER_MAIL_FROM_ADDRESS = 'info@bdtech360.com'
    assert.equal(comms.channelConfigured('EMAIL'), true)
    assert.equal(comms.channelStatuses().EMAIL, true)
    process.env.HOSTINGER_MAIL_FROM_ADDRESS = 'info@elsewhere.example'
    assert.equal(comms.channelConfigured('EMAIL'), false)
  })

  it('exposes no credential material in the channel status', () => {
    process.env.HOSTINGER_MAIL_ENABLED = 'true'
    process.env.HOSTINGER_MAIL_API_TOKEN = 'hm_routing_token_0123456789abcdefgh'
    assert.doesNotMatch(JSON.stringify(comms.channelStatuses()), /hm_routing_token/)
  })
})
