/**
 * Pure Hostinger Mail API policy: configuration validation, send-outcome
 * classification, webhook authentication/classification, checkpoint parsing,
 * UID selection and safe HTML conversion. No database, SDK or network.
 */
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { readHostingerMailConfig, describeHostingerMailConfig, isAllowedSenderAddress } from '../src/lib/mail/hostinger-config'
import { classifyHostingerSendFailure, hostingerFailureInputFromError, AMBIGUOUS_OUTCOME_PREFIX } from '../src/lib/mail/hostinger-outcome'
import { classifyFailure, decideRetry } from '../src/lib/outbox-retry'
import {
  classifyWebhookDelivery,
  htmlToPlainText,
  inboundMessageDedupKey,
  normalizeSenderAddress,
  parseCheckpoint,
  selectNewUids,
  verifyHostingerWebhookAuth,
  webhookBodyDedupKey,
} from '../src/lib/mail/hostinger-inbound-policy'

const TOKEN = 'hm_test_token_0123456789abcdefghij'
const SECRET = 'whsec_test_0123456789abcdef0123456789abcdef'
const validEnv = {
  HOSTINGER_MAIL_ENABLED: 'true',
  HOSTINGER_MAIL_API_TOKEN: TOKEN,
  HOSTINGER_MAILBOX_RESOURCE_ID: 'MBX_0123456789',
  HOSTINGER_MAIL_FROM_ADDRESS: 'info@bdtech360.com',
  HOSTINGER_MAIL_WEBHOOK_SECRET: SECRET,
}

describe('Hostinger configuration fails closed', () => {
  it('is disabled unless HOSTINGER_MAIL_ENABLED is exactly "true"', () => {
    assert.equal(readHostingerMailConfig({ ...validEnv, HOSTINGER_MAIL_ENABLED: undefined }).state, 'DISABLED')
    assert.equal(readHostingerMailConfig({ ...validEnv, HOSTINGER_MAIL_ENABLED: 'TRUE' }).state, 'DISABLED')
    assert.equal(readHostingerMailConfig({ ...validEnv, HOSTINGER_MAIL_ENABLED: '1' }).state, 'DISABLED')
  })

  it('accepts a complete configuration on the authorized sender domain', () => {
    const status = readHostingerMailConfig(validEnv)
    assert.equal(status.state, 'CONFIGURED')
    if (status.state === 'CONFIGURED') {
      assert.equal(status.config.fromAddress, 'info@bdtech360.com')
      assert.equal(status.config.webhookSecret, SECRET)
    }
  })

  it('reports every missing variable by NAME only, never by value', () => {
    const status = readHostingerMailConfig({ HOSTINGER_MAIL_ENABLED: 'true' })
    assert.equal(status.state, 'INVALID')
    if (status.state === 'INVALID') {
      const text = status.problems.join('\n')
      for (const name of ['HOSTINGER_MAIL_API_TOKEN', 'HOSTINGER_MAILBOX_RESOURCE_ID', 'HOSTINGER_MAIL_FROM_ADDRESS']) {
        assert.match(text, new RegExp(name))
      }
      assert.doesNotMatch(text, /hm_test_token|whsec_/)
    }
  })

  it('refuses a sender outside bdtech360.com and a short webhook secret', () => {
    assert.equal(isAllowedSenderAddress('someone@gmail.com'), false)
    assert.equal(isAllowedSenderAddress('info@bdtech360.com.evil.test'), false)
    assert.equal(isAllowedSenderAddress('info@sub.bdtech360.com'), false)
    assert.equal(isAllowedSenderAddress('Info@BDTECH360.com'), true)
    const bad = readHostingerMailConfig({ ...validEnv, HOSTINGER_MAIL_FROM_ADDRESS: 'info@other.example', HOSTINGER_MAIL_WEBHOOK_SECRET: 'short' })
    assert.equal(bad.state, 'INVALID')
    if (bad.state === 'INVALID') assert.equal(bad.problems.length, 2)
  })

  it('status description never includes the token or secret', () => {
    const description = JSON.stringify(describeHostingerMailConfig(validEnv))
    assert.doesNotMatch(description, /hm_test_token|whsec_test/)
    assert.equal(describeHostingerMailConfig(validEnv).webhookSecretConfigured, true)
  })
})

describe('send outcome classification', () => {
  it('429 and 503 are NOT_PROCESSED (safe to retry) and carry retryable wording', () => {
    const r429 = classifyHostingerSendFailure({ httpStatus: 429, apiCode: 'ERR_RATE_LIMIT', requestSent: true })
    assert.equal(r429.classification, 'NOT_PROCESSED')
    assert.equal(classifyFailure(r429.error).kind, 'TRANSIENT')
    const r503 = classifyHostingerSendFailure({ httpStatus: 503, requestSent: true })
    assert.equal(r503.classification, 'NOT_PROCESSED')
    assert.equal(classifyFailure(r503.error).kind, 'TRANSIENT')
  })

  it('401/403/422 are REJECTED and classified permanent', () => {
    for (const status of [401, 403, 422]) {
      const result = classifyHostingerSendFailure({ httpStatus: status, apiCode: 'ERR_X', requestSent: true })
      assert.equal(result.classification, 'REJECTED')
      assert.equal(classifyFailure(result.error).kind, 'PERMANENT', `HTTP ${status}`)
    }
  })

  it('500/502/504 and timeouts after send are AMBIGUOUS and never auto-retried', () => {
    for (const status of [500, 502, 504]) {
      const result = classifyHostingerSendFailure({ httpStatus: status, requestSent: true })
      assert.equal(result.classification, 'AMBIGUOUS')
      assert.ok(result.error.startsWith(AMBIGUOUS_OUTCOME_PREFIX))
      assert.equal(classifyFailure(result.error).kind, 'PERMANENT')
      const record = { id: 'c1', channel: 'EMAIL', recipient: 'a@b.co', status: 'FAILED', error: result.error, attempts: 0, nextRetryAt: null, lastAttemptAt: null }
      assert.equal(decideRetry(record, new Date()).action, 'NOT_RETRYABLE', 'an ambiguous send must not be re-dispatched automatically')
    }
    const timeout = classifyHostingerSendFailure({ networkCode: 'ECONNABORTED', requestSent: true })
    assert.equal(timeout.classification, 'AMBIGUOUS')
  })

  it('connection refused and DNS failures before send are NOT_PROCESSED', () => {
    assert.equal(classifyHostingerSendFailure({ networkCode: 'ECONNREFUSED', requestSent: false }).classification, 'NOT_PROCESSED')
    assert.equal(classifyHostingerSendFailure({ networkCode: 'ENOTFOUND', requestSent: false }).classification, 'NOT_PROCESSED')
  })

  it('error text is sanitized and omits any token-shaped or recipient text', () => {
    const result = classifyHostingerSendFailure({ httpStatus: 422, apiCode: 'ERR_X<script>a@b.co hm_test_token', requestSent: true })
    assert.doesNotMatch(result.error, /script|@|hm_test_token|</)
    assert.match(result.error, /\(UNRECOGNIZED\)/)
  })

  it('maps an axios-shaped error to the failure input without reading the body text', () => {
    const input = hostingerFailureInputFromError({ response: { status: 429, data: { code: 'ERR_RATE_LIMIT', error: 'to person@example.com' } } }, true)
    assert.deepEqual(input, { httpStatus: 429, apiCode: 'ERR_RATE_LIMIT', networkCode: undefined, requestSent: true })
    assert.deepEqual(hostingerFailureInputFromError({ code: 'ECONNREFUSED' }, false), { httpStatus: undefined, apiCode: undefined, networkCode: 'ECONNREFUSED', requestSent: false })
  })
})

describe('webhook authentication and event classification', () => {
  it('fails closed when the secret is unset or undersized', () => {
    assert.deepEqual(verifyHostingerWebhookAuth({ authorization: `Bearer ${SECRET}`, secret: '' }), { ok: false, reason: 'NOT_CONFIGURED' })
    assert.deepEqual(verifyHostingerWebhookAuth({ authorization: 'Bearer short', secret: 'short' }), { ok: false, reason: 'NOT_CONFIGURED' })
  })

  it('requires an exact bearer match in constant time', () => {
    assert.deepEqual(verifyHostingerWebhookAuth({ authorization: null, secret: SECRET }), { ok: false, reason: 'MISSING_AUTH' })
    assert.deepEqual(verifyHostingerWebhookAuth({ authorization: `Basic ${SECRET}`, secret: SECRET }), { ok: false, reason: 'INVALID_AUTH' })
    assert.deepEqual(verifyHostingerWebhookAuth({ authorization: `Bearer ${SECRET}x`, secret: SECRET }), { ok: false, reason: 'INVALID_AUTH' })
    assert.deepEqual(verifyHostingerWebhookAuth({ authorization: `bearer ${SECRET}`, secret: SECRET }), { ok: true })
  })

  it('treats message.received as a sync trigger and unknown explicit types as ignored', () => {
    assert.deepEqual(classifyWebhookDelivery({ event: 'message.received' }), { kind: 'SYNC', eventType: 'message.received' })
    assert.deepEqual(classifyWebhookDelivery({ type: 'message.received' }), { kind: 'SYNC', eventType: 'message.received' })
    assert.deepEqual(classifyWebhookDelivery({ foo: 1 }), { kind: 'SYNC', eventType: null })
    assert.equal(classifyWebhookDelivery({ event: 'mailbox.deleted' }).kind, 'IGNORE')
    assert.equal(classifyWebhookDelivery([]).kind, 'INVALID')
    assert.equal(classifyWebhookDelivery('text').kind, 'INVALID')
  })

  it('dedupes identical bodies by SHA-256 and distinguishes different bodies', () => {
    assert.equal(webhookBodyDedupKey('{"a":1}'), webhookBodyDedupKey('{"a":1}'))
    assert.notEqual(webhookBodyDedupKey('{"a":1}'), webhookBodyDedupKey('{"a":1} '))
    assert.match(webhookBodyDedupKey('x'), /^body:[0-9a-f]{64}$/)
  })
})

describe('inbound checkpoint, selection and dedupe keys', () => {
  it('parses corrupt checkpoints to zero instead of skipping mail', () => {
    assert.equal(parseCheckpoint('{not json').lastUid, 0)
    assert.equal(parseCheckpoint('{"lastUid":-4}').lastUid, 0)
    assert.equal(parseCheckpoint('{"lastUid":12,"lastError":"x"}').lastUid, 12)
    assert.equal(parseCheckpoint(null).lastUid, 0)
  })

  it('keeps only UIDs above the checkpoint, oldest first (IMAP "N:*" re-returns the last UID)', () => {
    const picked = selectNewUids([{ uid: 9 }, { uid: 5 }, { uid: 7 }, { uid: 6 }], 6)
    assert.deepEqual(picked.map((m) => m.uid), [7, 9])
  })

  it('uses a bounded hashed key for a Message-ID and a UID fallback otherwise', () => {
    const longId = `<${'a'.repeat(240)}@example.com>`
    assert.match(inboundMessageDedupKey(longId, 1), /^msgid:[0-9a-f]{64}$/)
    assert.equal(inboundMessageDedupKey(null, 42), 'uid:42')
    assert.equal(inboundMessageDedupKey('  ', 42), 'uid:42')
  })

  it('normalizes sender addresses and rejects implausible ones', () => {
    assert.equal(normalizeSenderAddress('  Client@Example.COM '), 'client@example.com')
    assert.equal(normalizeSenderAddress('Display Name <client@example.com>'), null)
    assert.equal(normalizeSenderAddress(''), null)
    assert.equal(normalizeSenderAddress(null), null)
  })
})

describe('HTML to text conversion for inbound and outbound bodies', () => {
  it('removes scripts and styles and strips tags without rendering markup', () => {
    const text = htmlToPlainText('<style>p{}</style><p>Hello <b>Ada</b></p><script>alert(1)</script><br/>Thanks&nbsp;&amp;&lt;ok&gt;')
    assert.doesNotMatch(text, /alert|p\{\}|<script|<style|<b>/)
    assert.match(text, /Hello Ada/)
    assert.match(text, /Thanks & ?<ok>/)
  })

  it('never throws on out-of-range or surrogate numeric entities', () => {
    assert.doesNotThrow(() => htmlToPlainText('x &#99999999; &#xD800; &#0; y'))
    assert.equal(htmlToPlainText('a &#99999999; b').includes('&#99999999;'), true)
  })

  it('caps the output length', () => {
    assert.equal(htmlToPlainText('a'.repeat(20000), 100).length, 100)
  })
})
