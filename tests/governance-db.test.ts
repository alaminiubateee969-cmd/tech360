import assert from 'node:assert/strict'
import { after, before, describe, it } from 'node:test'
import { PrismaClient } from '@prisma/client'

import { markPaymentVerifiedInTx } from '../src/lib/journey'
import { checkGovernedAction, executeGoverned, GovernanceDeniedError, type GovernedActionInput } from '../src/lib/governance/enforce'

// DB-backed governance tests. They run against the disposable MySQL in CI
// (DATABASE_URL). They never call sendCommunication, the receipt builder or
// any provider, so no message or payment leaves the test database.

const db = new PrismaClient()
const run = `GOV-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
let clientRowId = ''
let clientCode = ''
let superAdminId = ''
let requesterId = ''
let adminOnlyId = ''
const paymentIds: string[] = []
const approvalIds: string[] = []

before(async () => {
  const client = await db.client.create({
    data: { clientId: `${run}-C`, name: 'Governance Test Client', email: `${run.toLowerCase()}@example.test`, source: 'TEST' },
  })
  clientRowId = client.id
  clientCode = client.clientId
  const [superAdmin, requester, adminOnly] = await Promise.all([
    db.user.create({ data: { email: `${run.toLowerCase()}-super@example.test`, name: 'Super', role: 'SUPER_ADMIN', passwordHash: 'x' } }),
    db.user.create({ data: { email: `${run.toLowerCase()}-req@example.test`, name: 'Requester', role: 'SUPER_ADMIN', passwordHash: 'x' } }),
    db.user.create({ data: { email: `${run.toLowerCase()}-admin@example.test`, name: 'Admin', role: 'ADMIN', passwordHash: 'x' } }),
  ])
  superAdminId = superAdmin.id
  requesterId = requester.id
  adminOnlyId = adminOnly.id
})

after(async () => {
  await db.auditLog.deleteMany({ where: { OR: [{ clientId: clientRowId }, { entityId: { in: [...approvalIds, ...paymentIds.map((id) => `payment:${id}`)] } }] } })
  await db.approvalRequest.deleteMany({ where: { id: { in: approvalIds } } })
  await db.payment.deleteMany({ where: { id: { in: paymentIds } } })
  await db.client.deleteMany({ where: { id: clientRowId } })
  await db.user.deleteMany({ where: { id: { in: [superAdminId, requesterId, adminOnlyId].filter(Boolean) } } })
  await db.$disconnect()
})

async function makePayment(amount = 100): Promise<{ id: string; amountMinor: number }> {
  const payment = await db.payment.create({
    data: { clientId: clientRowId, amount, currency: 'USD', status: 'PENDING', milestone: `${run}-M` },
  })
  paymentIds.push(payment.id)
  return { id: payment.id, amountMinor: Math.round(amount * 100) }
}

async function makeApproval(paymentId: string, amountMinor: number, overrides: { status?: string; decidedBy?: string | null; requestedBy?: string; decidedAt?: Date; type?: string } = {}): Promise<string> {
  const decidedAt = overrides.decidedAt ?? new Date()
  const approval = await db.approvalRequest.create({
    data: {
      type: overrides.type ?? 'PAYMENT_VERIFY',
      title: `${run} verify`,
      clientId: clientRowId,
      payload: JSON.stringify({ action: 'payment.verify', resourceKey: `payment:${paymentId}`, amountMinor }),
      risk: 'CRITICAL',
      status: overrides.status ?? 'APPROVED',
      requestedBy: overrides.requestedBy ?? requesterId,
      decidedBy: overrides.decidedBy === undefined ? superAdminId : overrides.decidedBy,
      updatedAt: decidedAt,
    },
  })
  approvalIds.push(approval.id)
  return approval.id
}

function verifyInput(paymentId: string, amountMinor: number, approvalId: string | null, actor: GovernedActionInput['actor'] = { type: 'HUMAN', id: superAdminId, role: 'SUPER_ADMIN' }): GovernedActionInput {
  return {
    action: 'payment.verify',
    actor,
    resourceKey: `payment:${paymentId}`,
    amountMinor,
    approvalId,
    clientId: clientRowId,
  }
}

async function verifyWith(paymentId: string, amountMinor: number, approvalId: string | null, actor?: GovernedActionInput['actor']) {
  return executeGoverned(verifyInput(paymentId, amountMinor, approvalId, actor), (tx) => markPaymentVerifiedInTx(tx, paymentId, superAdminId))
}

async function denialCode(promise: Promise<unknown>): Promise<string> {
  try {
    await promise
  } catch (error) {
    if (error instanceof GovernanceDeniedError) return error.code
    throw error
  }
  assert.fail('expected the governed action to be denied')
}

describe('runtime governance (database): payment verification', () => {
  it('denies verification without an approval and leaves the payment PENDING', async () => {
    const payment = await makePayment(100)
    assert.equal(await denialCode(verifyWith(payment.id, payment.amountMinor, null)), 'APPROVAL_REQUIRED')
    const row = await db.payment.findUniqueOrThrow({ where: { id: payment.id } })
    assert.equal(row.status, 'PENDING')
    const denial = await db.auditLog.findFirst({ where: { action: 'GOVERNANCE_DECISION', entityId: `payment:${payment.id}` } })
    assert.ok(denial, 'the denial must be audited')
    assert.equal(JSON.parse(denial.details ?? '{}').decision, 'DENY')
  })

  it('executes once with a valid approval, then refuses the same approval on replay', async () => {
    const payment = await makePayment(250)
    const approvalId = await makeApproval(payment.id, payment.amountMinor)
    const first = await verifyWith(payment.id, payment.amountMinor, approvalId)
    assert.equal(first.alreadyVerified, false)
    const row = await db.payment.findUniqueOrThrow({ where: { id: payment.id } })
    assert.equal(row.status, 'PAID')
    assert.equal(row.verifiedBy, superAdminId)
    assert.equal((await db.approvalRequest.findUniqueOrThrow({ where: { id: approvalId } })).status, 'EXECUTED')

    assert.equal(await denialCode(verifyWith(payment.id, payment.amountMinor, approvalId)), 'APPROVAL_ALREADY_CONSUMED')
  })

  it('lets exactly one of two concurrent requests consume a single approval', async () => {
    const payment = await makePayment(300)
    const approvalId = await makeApproval(payment.id, payment.amountMinor)
    const results = await Promise.allSettled([
      verifyWith(payment.id, payment.amountMinor, approvalId),
      verifyWith(payment.id, payment.amountMinor, approvalId),
    ])
    const fulfilled = results.filter((r) => r.status === 'fulfilled')
    assert.equal(fulfilled.length, 1, 'exactly one request may execute')
    const rejected = results.find((r): r is PromiseRejectedResult => r.status === 'rejected')
    assert.ok(rejected, 'the second request must be refused')
    assert.ok(rejected.reason instanceof Error)
    const consumed = await db.approvalRequest.findUniqueOrThrow({ where: { id: approvalId } })
    assert.equal(consumed.status, 'EXECUTED')
  })

  it('rolls back the approval consumption when the side effect fails, so a retry can still use it', async () => {
    const payment = await makePayment(400)
    const approvalId = await makeApproval(payment.id, payment.amountMinor)
    await assert.rejects(
      executeGoverned(verifyInput(payment.id, payment.amountMinor, approvalId), async () => {
        throw new Error('simulated mid-write failure')
      }),
      /simulated mid-write failure/,
    )
    assert.equal((await db.approvalRequest.findUniqueOrThrow({ where: { id: approvalId } })).status, 'APPROVED')
    assert.equal((await db.payment.findUniqueOrThrow({ where: { id: payment.id } })).status, 'PENDING')

    await verifyWith(payment.id, payment.amountMinor, approvalId)
    assert.equal((await db.payment.findUniqueOrThrow({ where: { id: payment.id } })).status, 'PAID')
  })

  it('denies an approval granted by an account that is not a Super Admin', async () => {
    const payment = await makePayment(120)
    const approvalId = await makeApproval(payment.id, payment.amountMinor, { decidedBy: adminOnlyId })
    assert.equal(await denialCode(verifyWith(payment.id, payment.amountMinor, approvalId)), 'UNAUTHORIZED_APPROVER')
    assert.equal((await db.payment.findUniqueOrThrow({ where: { id: payment.id } })).status, 'PENDING')
  })

  it('denies an expired approval', async () => {
    const payment = await makePayment(130)
    const approvalId = await makeApproval(payment.id, payment.amountMinor, { decidedAt: new Date(Date.now() - 25 * 60 * 60 * 1000) })
    assert.equal(await denialCode(verifyWith(payment.id, payment.amountMinor, approvalId)), 'APPROVAL_EXPIRED')
  })

  it('denies a rejected approval', async () => {
    const payment = await makePayment(140)
    const approvalId = await makeApproval(payment.id, payment.amountMinor, { status: 'REJECTED' })
    assert.equal(await denialCode(verifyWith(payment.id, payment.amountMinor, approvalId)), 'APPROVAL_REJECTED')
  })

  it('denies an AI agent even when a valid approval exists, and does not consume the approval', async () => {
    const payment = await makePayment(150)
    const approvalId = await makeApproval(payment.id, payment.amountMinor)
    assert.equal(
      await denialCode(verifyWith(payment.id, payment.amountMinor, approvalId, { type: 'AGENT', id: 'PAY-016' })),
      'ACTOR_NOT_PERMITTED',
    )
    assert.equal((await db.approvalRequest.findUniqueOrThrow({ where: { id: approvalId } })).status, 'APPROVED')
  })

  it('allows the verified Stripe webhook as provider evidence without a human approval', async () => {
    const payment = await makePayment(160)
    await executeGoverned(
      verifyInput(payment.id, payment.amountMinor, null, { type: 'PROVIDER', id: 'stripe', evidence: 'VERIFIED_SIGNATURE' }),
      (tx) => markPaymentVerifiedInTx(tx, payment.id, 'stripe'),
    )
    assert.equal((await db.payment.findUniqueOrThrow({ where: { id: payment.id } })).status, 'PAID')
    const decision = await db.auditLog.findFirst({ where: { action: 'GOVERNANCE_DECISION', entityId: `payment:${payment.id}`, details: { contains: 'PROVIDER_EVIDENCE' } } })
    assert.ok(decision, 'provider evidence must be audited with its path')
  })

  it('writes a decision audit row without payloads, secrets or password hashes', async () => {
    const payment = await makePayment(170)
    const approvalId = await makeApproval(payment.id, payment.amountMinor)
    await verifyWith(payment.id, payment.amountMinor, approvalId)
    const rows = await db.auditLog.findMany({ where: { action: 'GOVERNANCE_DECISION', entityId: approvalId } })
    assert.equal(rows.length, 1)
    const details = JSON.parse(rows[0].details ?? '{}') as Record<string, unknown>
    assert.deepEqual(Object.keys(details).sort(), [
      'action', 'appliedRules', 'amountMinor', 'approvalId', 'code', 'decidedAt', 'decision', 'governanceRule', 'path', 'reason', 'resourceKey',
    ].sort())
    assert.equal(details.decision, 'ALLOW')
    assert.equal(details.path, 'APPROVAL')
    assert.ok(!rows[0].details?.includes('passwordHash'))
  })

  it('refuses an AI invoice from the governance boundary without a human approval', async () => {
    const outcome = await checkGovernedAction({
      action: 'invoice.generate',
      actor: { type: 'AGENT', id: 'PAY-016' },
      resourceKey: `client:${clientRowId}:milestone:0`,
      amountMinor: 50_000,
      clientId: clientRowId,
    })
    assert.equal(outcome.allowed, false)
    const audit = await db.auditLog.findFirst({ where: { action: 'GOVERNANCE_DECISION', entityId: `client:${clientRowId}:milestone:0` } })
    assert.ok(audit, 'the refusal must be audited')
  })
})
