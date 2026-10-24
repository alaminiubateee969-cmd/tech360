import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { AgentJobToolInputError, normalizeAgentJobToolCall } from '../src/lib/agents/tool-executor'
import {
  APPROVAL_TTL_MS,
  decideAuthorization,
  type ApprovalSnapshot,
  type GovernedActionInput,
} from '../src/lib/governance/enforce'

const NOW = new Date('2026-10-24T06:00:00.000Z')
const RESOURCE = 'payment:pay_1'
const AMOUNT = 125_000

const SUPER = { role: 'SUPER_ADMIN' }

function paymentInput(overrides: Partial<GovernedActionInput> = {}): GovernedActionInput {
  return {
    action: 'payment.verify',
    actor: { type: 'HUMAN', id: 'user_requester', role: 'SUPER_ADMIN' },
    resourceKey: RESOURCE,
    amountMinor: AMOUNT,
    approvalId: 'appr_1',
    ...overrides,
  }
}

function approved(overrides: Partial<ApprovalSnapshot> = {}): ApprovalSnapshot {
  return {
    id: 'appr_1',
    type: 'PAYMENT_VERIFY',
    status: 'APPROVED',
    payload: JSON.stringify({ action: 'payment.verify', resourceKey: RESOURCE, amountMinor: AMOUNT }),
    requestedBy: 'user_requester',
    decidedBy: 'user_approver',
    decidedAt: new Date(NOW.getTime() - 60_000),
    ...overrides,
  }
}

function run(input: GovernedActionInput, approval: ApprovalSnapshot | null, extra: Partial<Parameters<typeof decideAuthorization>[0]> = {}) {
  return decideAuthorization({ input, approval, approverRole: SUPER.role, now: NOW, ...extra })
}

describe('governance boundary: allowed, restricted and approved paths', () => {
  it('allows a payment verification only with a matching, approved Super Admin decision', () => {
    const outcome = run(paymentInput(), approved())
    assert.equal(outcome.allowed, true)
    if (outcome.allowed) {
      assert.equal(outcome.path, 'APPROVAL')
      assert.equal(outcome.approvalId, 'appr_1')
    }
  })

  it('denies a restricted payment action when no approval is presented', () => {
    const outcome = run(paymentInput({ approvalId: null }), null)
    assert.equal(outcome.allowed, false)
    if (!outcome.allowed) assert.equal(outcome.code, 'APPROVAL_REQUIRED')
  })

  it('denies a refund settlement when no approval is presented, even if the rule engine allows it', () => {
    const input = paymentInput({ action: 'refund.settle', approvalId: null, resourceKey: 'refund:case_1:5000' })
    const outcome = run(input, null, { evaluate: () => ({ allowed: true, requiresApproval: false, requiredPermissions: [], requiresReview: false, decidedBy: null, appliedRules: [], reason: 'allowed' }) })
    assert.equal(outcome.allowed, false)
    if (!outcome.allowed) assert.equal(outcome.code, 'APPROVAL_REQUIRED')
  })

  it('takes the real rule engine path for an approved payment: the policy evaluates and the approval still gates', () => {
    const outcome = run(paymentInput(), approved())
    assert.equal(outcome.allowed, true)
    if (outcome.allowed) assert.ok(outcome.appliedRules.length > 0, 'the policy must have been evaluated')
  })
})

describe('governance boundary: rejected, expired, consumed and mismatched approvals', () => {
  const cases: Array<[string, Partial<ApprovalSnapshot>, string]> = [
    ['pending', { status: 'PENDING', decidedAt: null }, 'APPROVAL_PENDING'],
    ['rejected', { status: 'REJECTED' }, 'APPROVAL_REJECTED'],
    ['already consumed (replay)', { status: 'EXECUTED' }, 'APPROVAL_ALREADY_CONSUMED'],
    ['revoked or failed', { status: 'FAILED' }, 'APPROVAL_NOT_GRANTED'],
    ['stuck in EXECUTING', { status: 'EXECUTING' }, 'APPROVAL_NOT_GRANTED'],
    ['expired', { decidedAt: new Date(NOW.getTime() - APPROVAL_TTL_MS - 1_000) }, 'APPROVAL_EXPIRED'],
    ['never decided', { decidedAt: null }, 'APPROVAL_EXPIRED'],
    ['for another action type', { type: 'REFUND_SETTLE' }, 'APPROVAL_TYPE_MISMATCH'],
    ['for another resource', { payload: JSON.stringify({ resourceKey: 'payment:other', amountMinor: AMOUNT }) }, 'APPROVAL_RESOURCE_MISMATCH'],
    ['with no payload', { payload: null }, 'APPROVAL_RESOURCE_MISMATCH'],
    ['for another amount', { payload: JSON.stringify({ resourceKey: RESOURCE, amountMinor: AMOUNT + 1 }) }, 'APPROVAL_AMOUNT_MISMATCH'],
  ]
  for (const [label, override, code] of cases) {
    it(`denies an ${label} approval`, () => {
      const outcome = run(paymentInput(), approved(override))
      assert.equal(outcome.allowed, false)
      if (!outcome.allowed) assert.equal(outcome.code, code)
    })
  }

  it('denies when the presented approval id does not match the approval loaded', () => {
    const outcome = run(paymentInput({ approvalId: 'appr_other' }), approved())
    assert.equal(outcome.allowed, false)
    if (!outcome.allowed) assert.equal(outcome.code, 'APPROVAL_NOT_FOUND')
  })

  it('denies when the approval does not exist', () => {
    const outcome = run(paymentInput(), null)
    assert.equal(outcome.allowed, false)
    if (!outcome.allowed) assert.equal(outcome.code, 'APPROVAL_NOT_FOUND')
  })
})

describe('governance boundary: approver authority', () => {
  it('denies an approval decided by a non-Super-Admin role', () => {
    const outcome = run(paymentInput(), approved(), { approverRole: 'ADMIN' })
    assert.equal(outcome.allowed, false)
    if (!outcome.allowed) assert.equal(outcome.code, 'UNAUTHORIZED_APPROVER')
  })

  it('denies an approval whose approver account is inactive or missing', () => {
    const outcome = run(paymentInput(), approved(), { approverRole: null })
    assert.equal(outcome.allowed, false)
    if (!outcome.allowed) assert.equal(outcome.code, 'UNAUTHORIZED_APPROVER')
  })

  it('denies an approval with no recorded approver', () => {
    const outcome = run(paymentInput(), approved({ decidedBy: null }))
    assert.equal(outcome.allowed, false)
    if (!outcome.allowed) assert.equal(outcome.code, 'UNAUTHORIZED_APPROVER')
  })

  it('denies self-approval, where the requester and the approver are the same account', () => {
    const outcome = run(paymentInput(), approved({ requestedBy: 'user_approver' }))
    assert.equal(outcome.allowed, false)
    if (!outcome.allowed) assert.equal(outcome.code, 'SELF_APPROVAL_FORBIDDEN')
  })
})

describe('governance boundary: fail closed on policy errors', () => {
  it('denies when the governance evaluation throws, even with a valid approval', () => {
    const outcome = run(paymentInput(), approved(), {
      evaluate: () => {
        throw new Error('rules store unavailable')
      },
    })
    assert.equal(outcome.allowed, false)
    if (!outcome.allowed) assert.equal(outcome.code, 'GOVERNANCE_EVALUATION_FAILED')
  })

  for (const [label, value] of [
    ['undefined', undefined],
    ['null', null],
    ['a string', 'allowed'],
    ['an object with a non-boolean allowed field', { allowed: 'yes', requiresApproval: true, appliedRules: [], reason: 'x' }],
    ['an object missing appliedRules', { allowed: true, requiresApproval: true, reason: 'x' }],
  ] as const) {
    it(`denies when the governance decision is ${label}`, () => {
      const outcome = run(paymentInput(), approved(), { evaluate: () => value })
      assert.equal(outcome.allowed, false)
      if (!outcome.allowed) assert.equal(outcome.code, 'GOVERNANCE_INVALID_DECISION')
    })
  }

  it('denies a FORBID from the policy even when a valid approval exists', () => {
    const outcome = run(paymentInput(), approved(), {
      evaluate: () => ({ allowed: false, requiresApproval: false, requiredPermissions: [], requiresReview: false, decidedBy: 'GLOBAL-001', appliedRules: ['GLOBAL-001'], reason: 'forbidden' }),
    })
    assert.equal(outcome.allowed, false)
    if (!outcome.allowed) assert.equal(outcome.code, 'GOVERNANCE_FORBIDDEN')
  })

  it('denies a malformed actor and a non-positive or fractional amount', () => {
    const noActor = run({ ...paymentInput(), actor: { type: 'HUMAN', id: '', role: 'SUPER_ADMIN' } }, approved())
    assert.equal(noActor.allowed, false)
    const badAmount = run(paymentInput({ amountMinor: 12.5 }), approved())
    assert.equal(badAmount.allowed, false)
    if (!badAmount.allowed) assert.equal(badAmount.code, 'INVALID_REQUEST')
  })

  it('denies an action that is not in the governed set', () => {
    const outcome = run({ ...paymentInput(), action: 'file.delete' as never }, approved())
    assert.equal(outcome.allowed, false)
    if (!outcome.allowed) assert.equal(outcome.code, 'UNKNOWN_ACTION')
  })
})

describe('governance boundary: non-human and bypass attempts', () => {
  it('denies an AI agent even with a valid, approved human decision', () => {
    const outcome = run(paymentInput({ actor: { type: 'AGENT', id: 'PAY-016' } }), approved())
    assert.equal(outcome.allowed, false)
    if (!outcome.allowed) assert.equal(outcome.code, 'ACTOR_NOT_PERMITTED')
  })

  it('denies a background automation (n8n) even with a valid, approved human decision', () => {
    const outcome = run(paymentInput({ actor: { type: 'AUTOMATION', id: 'n8n' } }), approved())
    assert.equal(outcome.allowed, false)
    if (!outcome.allowed) assert.equal(outcome.code, 'ACTOR_NOT_PERMITTED')
  })

  it('denies an automation with no approval', () => {
    const outcome = run(paymentInput({ actor: { type: 'AUTOMATION', id: 'n8n-automation' }, approvalId: null }), null)
    assert.equal(outcome.allowed, false)
  })

  it('allows the verified Stripe webhook as provider evidence without a human approval', () => {
    const outcome = run(paymentInput({ actor: { type: 'PROVIDER', id: 'stripe', evidence: 'VERIFIED_SIGNATURE' }, approvalId: null }), null)
    assert.equal(outcome.allowed, true)
    if (outcome.allowed) assert.equal(outcome.path, 'PROVIDER_EVIDENCE')
  })

  it('denies a provider that is not on the action allowlist', () => {
    const outcome = run(paymentInput({ actor: { type: 'PROVIDER', id: 'bank-feed', evidence: 'VERIFIED_SIGNATURE' }, approvalId: null }), null)
    assert.equal(outcome.allowed, false)
    if (!outcome.allowed) assert.equal(outcome.code, 'PROVIDER_NOT_PERMITTED')
  })

  it('does not let Stripe evidence settle a refund', () => {
    const input = paymentInput({ action: 'refund.settle', actor: { type: 'PROVIDER', id: 'stripe', evidence: 'VERIFIED_SIGNATURE' }, approvalId: null, resourceKey: 'refund:case_1:5000' })
    const outcome = run(input, null)
    assert.equal(outcome.allowed, false)
    if (!outcome.allowed) assert.equal(outcome.code, 'PROVIDER_NOT_PERMITTED')
  })

  it('denies AI invoice generation outright (policy FORBID on invoices in client-facing output)', () => {
    const outcome = run({ action: 'invoice.generate', actor: { type: 'AGENT', id: 'PAY-016' }, resourceKey: 'client:c1:milestone:0', amountMinor: 50_000 }, null)
    assert.equal(outcome.allowed, false)
    if (!outcome.allowed) assert.equal(outcome.code, 'ACTOR_NOT_PERMITTED')
  })
})

describe('governance boundary: durable worker cannot reach financial or outbound tools', () => {
  for (const tool of ['payment.verify', 'payment.prepare', 'refund.settle', 'invoice.generate', 'handover.release', 'email.send']) {
    it(`refuses ${tool} as a durable AgentJob tool, so no financial side effect is reachable from a worker`, () => {
      assert.throws(
        () => normalizeAgentJobToolCall(tool, { title: 'Attempted financial action', description: null, priority: 'HIGH' }),
        (error: unknown) => error instanceof AgentJobToolInputError,
      )
    })
  }
})
