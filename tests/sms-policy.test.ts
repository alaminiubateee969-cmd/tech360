import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { isSmsOptOutKeyword } from '../src/lib/sms-policy'

const smsRoute = readFileSync(join(process.cwd(), 'src/app/api/webhooks/sms/route.ts'), 'utf8')
const comms = readFileSync(join(process.cwd(), 'src/lib/comms.ts'), 'utf8')

describe('SMS opt-out policy', () => {
  it('recognizes standard opt-out keywords case-insensitively with harmless trailing punctuation', () => {
    for (const keyword of ['STOP', 'STOPALL', 'STOP ALL', 'UNSUBSCRIBE', 'CANCEL', 'END', 'QUIT']) {
      assert.equal(isSmsOptOutKeyword(`  ${keyword.toLowerCase()}!!!  `), true, keyword)
    }
  })

  it('does not opt out on ordinary text or silently opt back in on START', () => {
    for (const text of ['', 'Please stop by the office', 'I cannot cancel the meeting', 'START', 'Thanks']) {
      assert.equal(isSmsOptOutKeyword(text), false, text)
    }
  })

  it('persists opt-out and returns before AI replies in both known and first-contact paths', () => {
    const known = smsRoute.indexOf('if (isSmsOptOutKeyword(text))')
    const knownReply = smsRoute.indexOf('await handleSmsReply({ client: existing', known)
    const first = smsRoute.indexOf('if (isSmsOptOutKeyword(text))', known + 1)
    const firstReply = smsRoute.indexOf('await handleSmsReply({ client: full', first)
    assert.ok(known >= 0 && knownReply > known)
    assert.ok(first > known && firstReply > first)
    assert.match(smsRoute.slice(known, knownReply), /setOptOut\(existing\.id, existing\.clientId, true\)/)
    assert.match(smsRoute.slice(first, firstReply), /setOptOut\(linkedClient\.id, linkedClient\.clientId, true\)/)
    assert.equal((smsRoute.match(/action: 'SMS_OPT_OUT'/g) ?? []).length, 2)
    assert.equal((smsRoute.match(/communicationState\?\.optedOut/g) ?? []).length, 2)
  })

  it('blocks later SMS sends and outbox retries after opt-out, except a requested sign-in OTP', () => {
    assert.match(comms, /entry\.channel === 'SMS' && entry\.clientId && entry\.messageType !== 'OTP'[\s\S]*?status: 'OPTED_OUT'/)
    assert.match(comms, /comm\.channel === 'SMS' && comm\.clientId && comm\.messageType !== 'OTP'[\s\S]*?if \(communicationState\.optedOut\)[\s\S]*?comm\.status : 'OPTED_OUT'/)
  })
})
