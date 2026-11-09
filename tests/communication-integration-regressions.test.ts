import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, it } from 'node:test'

const read = (path: string) => readFileSync(join(process.cwd(), path), 'utf8')
const orchestrator = read('src/lib/chat-orchestrator.ts')
const state = read('src/lib/conversation-state.ts')
const opsActions = read('src/lib/ops-actions.ts')
const pipelineSend = read('src/lib/pipeline/send.ts')
const journey = read('src/lib/journey.ts')
const sms = read('src/app/api/webhooks/sms/route.ts')
const email = read('src/app/api/webhooks/email/route.ts')
const whatsapp = read('src/app/api/webhooks/whatsapp/route.ts')

describe('TECH360 communication integration safeguards', () => {
  it('suppresses AI generation when takeover is active or state cannot be read', () => {
    const guard = orchestrator.indexOf('const humanTakeoverActive =')
    const generation = orchestrator.indexOf('tryGenerateAiReply({')
    assert.ok(guard >= 0 && generation > guard)
    assert.match(orchestrator, /if \(humanTakeoverActive\)[\s\S]*?else if \(aiAvailable\)/)
  })

  it('does not mark external provider messages SENT inside the orchestrator', () => {
    assert.match(orchestrator, /if \(input\.channel === 'WEB'\) \{[\s\S]*?status: 'SENT'/)
    assert.match(orchestrator, /if \(input\.channel === 'WEB'\) \{\s*await recordOutbound/)
  })

  it('records SMS state only after a successful provider result', () => {
    const failed = sms.indexOf('if (!sendRes.result.ok)')
    const record = sms.indexOf('await recordOutbound(input.client.id')
    assert.ok(failed >= 0 && record > failed)
    assert.match(sms.slice(failed, record), /return/)
  })

  it('records email state only in the provider-success branch', () => {
    const failed = email.indexOf('if (!res.result.ok)')
    const accepted = email.indexOf('} else {', failed)
    const record = email.indexOf('await recordOutbound(clientRow.id', accepted)
    assert.ok(failed >= 0 && accepted > failed && record > accepted)
  })

  it('records WhatsApp state only after a successful provider result', () => {
    const failed = whatsapp.indexOf('if (!sendRes.result.ok)')
    const record = whatsapp.indexOf('await recordOutbound(input.client.id')
    assert.ok(failed >= 0 && record > failed)
    assert.match(whatsapp.slice(failed, record), /return/)
  })

  it('records pipeline outbound state only after a provider accepts delivery', () => {
    assert.match(pipelineSend, /const acceptedDelivery = deliveries\.find\(\(delivery\) => delivery\.ok\)/)
    assert.match(pipelineSend, /if \(acceptedDelivery\)[\s\S]*?await recordOutbound\(/)
    assert.match(journey, /stage: 'FIRST_MESSAGE'[\s\S]*?nextPendingActor: 'CLIENT'/)
  })

  it('requires explicit inbound SMS provider authentication and stable event IDs', () => {
    assert.match(sms, /SMS_INBOUND_PROVIDER/)
    assert.match(sms, /SMS_WEBHOOK_SECRET/)
    assert.match(sms, /if \(!from \|\| !bodyText \|\| !messageSid\)/)
    assert.match(sms, /Inbound message could not be safely claimed[\s\S]*?\{ status: 503 \}/)
  })

  it('prevents 48-hour operations follow-up from bypassing opt-out/takeover/closure', () => {
    assert.match(opsActions, /loadCommState\(client\.id, client\.clientId, client\.pipelineStage\)/)
    // The guard is one multi-line `if` with additional clauses after `closed`
    // (nextPendingActor / repliedSinceLastOutbound / stageChanged) — match the
    // four required clauses in order, across line breaks.
    assert.match(opsActions, /!communicationState\.followUpEnabled \|\|\s+communicationState\.optedOut \|\|\s+communicationState\.humanTakeover \|\|\s+communicationState\.closed/)
    assert.match(opsActions, /communicationState\.nextPendingActor === 'TECH360'/)
    assert.match(opsActions, /repliedSinceLastOutbound/)
    assert.match(opsActions, /client\.pipelineStage !== communicationState\.followUpStage/)
  })

  it('resets the reminder counter for a new outbound cycle', () => {
    assert.match(state, /state\.reminderCount = 0\s+state\.lastReminderAt = null/)
  })

  it('restores follow-ups only when all stop flags are clear', () => {
    assert.match(state, /!takeover && !state\.optedOut && !state\.closed/)
    assert.match(state, /!optedOut && !state\.humanTakeover && !state\.closed/)
    assert.match(state, /!closed && !state\.optedOut && !state\.humanTakeover/)
  })

  it('fails closed on communication-state read or JSON errors', () => {
    assert.match(state, /Persisted communication state is invalid JSON/)
    assert.doesNotMatch(state, /catch \{\s*return defaultCommState/)
  })

  it('uses minute-precision quiet hours and the same receipt hash delimiter', () => {
    assert.match(state, /minute: '2-digit'/)
    assert.match(state, /provider \+ '\\0' \+ providerEventId\.trim\(\)/)
  })

  it('anchors root-only scratch patterns in .gitignore so nested source files are never ignored', () => {
    const gitignore = read('.gitignore')
    assert.doesNotMatch(gitignore, /^local-\*$/m)
    assert.doesNotMatch(gitignore, /^test$/m)
    assert.doesNotMatch(gitignore, /^prompt$/m)
    assert.match(gitignore, /^\/local-\*$/m)
  })
})
