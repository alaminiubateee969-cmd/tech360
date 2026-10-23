import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { evaluateGovernance, defaultGovernanceRules } from '../src/lib/governance/rules'
import { decideAuthorization, type ApprovalSnapshot, type GovernedActionInput } from '../src/lib/governance/enforce'
import { classifyOutbound, outboundContentHash, recipientHash } from '../src/lib/governance/outbound'

const NOW = new Date('2026-10-24T06:00:00.000Z')

const ROUTINE = 'Thanks for getting in touch. We have received your enquiry and will reply shortly.'
const PAYMENT = 'Please pay 12,000 USD to the account below and send us the reference.'

describe('outbound policy: routine versus consequential', () => {
  it('treats a routine acknowledgement as routine', () => {
    const policy = classifyOutbound(ROUTINE, 'Message from Tech360')
    assert.equal(policy.consequential, false)
    assert.equal(policy.carriesAmount, false)
  })

  it('treats a message carrying an amount as consequential', () => {
    const policy = classifyOutbound(PAYMENT, 'Payment instructions')
    assert.equal(policy.consequential, true)
    assert.equal(policy.carriesAmount, true)
  })

  it('classifies the same content the same way every time', () => {
    assert.deepEqual(classifyOutbound(PAYMENT), classifyOutbound(PAYMENT))
  })
})

describe('outbound content binding', () => {
  const base = { channel: 'EMAIL', to: 'client@example.test', subject: 'Hello', body: ROUTINE }

  it('is stable for identical content', () => {
    assert.equal(outboundContentHash(base), outboundContentHash({ ...base }))
  })

  it('changes when the recipient, channel, subject or body changes, so an approval cannot be reused for another message', () => {
    const hash = outboundContentHash(base)
    assert.notEqual(hash, outboundContentHash({ ...base, to: 'other@example.test' }))
    assert.notEqual(hash, outboundContentHash({ ...base, channel: 'WHATSAPP' }))
    assert.notEqual(hash, outboundContentHash({ ...base, subject: 'Changed' }))
    assert.notEqual(hash, outboundContentHash({ ...base, body: `${ROUTINE} Extra line.` }))
  })

  it('ignores case in the recipient address', () => {
    assert.equal(outboundContentHash(base), outboundContentHash({ ...base, to: 'CLIENT@example.test' }))
  })

  it('never stores the raw recipient in the approval payload', () => {
    const digest = recipientHash('client@example.test')
    assert.equal(digest.length, 64)
    assert.ok(!digest.includes('client@example.test'))
  })
})

describe('outbound approval lifecycle (pure decision)', () => {
  const body = PAYMENT
  const resourceKey = `comm:${outboundContentHash({ channel: 'WHATSAPP', to: '+8801700000000', subject: null, body })}`
  const input: GovernedActionInput = {
    action: 'communication.send',
    actor: { type: 'HUMAN', id: 'user_sender', role: 'MANAGER' },
    resourceKey,
    approvalId: 'appr_c1',
  }
  const approved = (overrides: Partial<ApprovalSnapshot> = {}): ApprovalSnapshot => ({
    id: 'appr_c1',
    type: 'MANUAL_COMMUNICATION',
    status: 'APPROVED',
    payload: JSON.stringify({ resourceKey, channel: 'WHATSAPP' }),
    requestedBy: 'user_sender',
    decidedBy: 'user_approver',
    decidedAt: new Date(NOW.getTime() - 60_000),
    ...overrides,
  })
  const run = (i: GovernedActionInput, a: ApprovalSnapshot | null, approverRole: string | null = 'SUPER_ADMIN') =>
    decideAuthorization({ input: i, approval: a, approverRole, now: NOW })

  it('sends an approved consequential message once the approval matches the exact content', () => {
    const outcome = run(input, approved())
    assert.equal(outcome.allowed, true)
  })

  it('refuses a changed body: the approval does not cover the new wording', () => {
    const changed = { ...input, resourceKey: `comm:${outboundContentHash({ channel: 'WHATSAPP', to: '+8801700000000', subject: null, body: `${body} Edited.` })}` }
    const outcome = run(changed, approved())
    assert.equal(outcome.allowed, false)
    if (!outcome.allowed) assert.equal(outcome.code, 'APPROVAL_RESOURCE_MISMATCH')
  })

  it('refuses a different recipient', () => {
    const other = { ...input, resourceKey: `comm:${outboundContentHash({ channel: 'WHATSAPP', to: '+8801999999999', subject: null, body })}` }
    const outcome = run(other, approved())
    assert.equal(outcome.allowed, false)
    if (!outcome.allowed) assert.equal(outcome.code, 'APPROVAL_RESOURCE_MISMATCH')
  })

  it('refuses a payment approval reused for a message (cross-action replay)', () => {
    const outcome = run(input, approved({ type: 'PAYMENT_VERIFY' }))
    assert.equal(outcome.allowed, false)
    if (!outcome.allowed) assert.equal(outcome.code, 'APPROVAL_TYPE_MISMATCH')
  })

  it('refuses a message that was already sent (approval consumed)', () => {
    const outcome = run(input, approved({ status: 'EXECUTED' }))
    assert.equal(outcome.allowed, false)
    if (!outcome.allowed) assert.equal(outcome.code, 'APPROVAL_ALREADY_CONSUMED')
  })

  it('refuses an approval granted by a non-Super-Admin', () => {
    const outcome = run(input, approved(), 'MANAGER')
    assert.equal(outcome.allowed, false)
    if (!outcome.allowed) assert.equal(outcome.code, 'UNAUTHORIZED_APPROVER')
  })

  it('refuses an AI agent sending a consequential message even with an approval', () => {
    const outcome = run({ ...input, actor: { type: 'AGENT', id: 'PAY-016' } }, approved())
    assert.equal(outcome.allowed, false)
    if (!outcome.allowed) assert.equal(outcome.code, 'ACTOR_NOT_PERMITTED')
  })
})

describe('GLOBAL-001 conflict: a content rule, not a tool FORBID', () => {
  const context = (tool: string) => ({
    departmentCode: 'COMPANY',
    role: 'SUPER_ADMIN',
    agentId: 'none',
    taskType: 'communication.send',
    tool,
    riskLevel: 'HIGH' as const,
    rules: defaultGovernanceRules(),
  })

  it('no longer forbids invoice generation by tool identity', () => {
    const decision = evaluateGovernance(context('invoice.generate'))
    assert.notEqual(decision.decidedBy, 'GLOBAL-001')
    assert.equal(decision.requiresApproval, true, 'the approval requirement still applies')
  })

  it('no longer forbids client email by tool identity, so approval can be considered', () => {
    const decision = evaluateGovernance(context('email.send'))
    assert.notEqual(decision.decidedBy, 'GLOBAL-001')
    assert.equal(decision.requiresApproval, true)
  })

  it('still applies the client-facing content review to client-facing tools', () => {
    const decision = evaluateGovernance(context('email.send'))
    assert.ok(decision.appliedRules.includes('GLOBAL-001'), 'the review rule must still be evaluated')
  })

  it('the rule is a review requirement, not a FORBID', () => {
    const rule = defaultGovernanceRules().find((r) => r.id === 'GLOBAL-001')
    assert.equal(rule?.effect, 'REQUIRE_REVIEW')
  })
})
