import assert from 'node:assert/strict'
import { after, before, describe, it } from 'node:test'
import { PrismaClient } from '@prisma/client'

import { evaluateStripePayment } from '../src/lib/commerce-policy'

const db = new PrismaClient()
const run = `TEST-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
let alphaId = ''
let betaId = ''
let alphaFileId = ''

before(async () => {
  const [alpha, beta] = await Promise.all([
    db.client.create({ data: { clientId: `${run}-A`, name: 'Isolation Alpha', email: `${run.toLowerCase()}-a@example.test`, source: 'TEST' } }),
    db.client.create({ data: { clientId: `${run}-B`, name: 'Isolation Beta', email: `${run.toLowerCase()}-b@example.test`, source: 'TEST' } }),
  ])
  alphaId = alpha.id
  betaId = beta.id
  const file = await db.fileRecord.create({
    data: {
      clientId: alpha.id,
      filename: 'alpha-private.txt',
      originalName: 'alpha-private.txt',
      mimeType: 'text/plain',
      size: 12,
      content: Buffer.from('alpha secret'),
      scanStatus: 'CLEAN',
      relatedType: 'CLIENT_UPLOAD',
      uploadedBy: 'client',
    },
  })
  alphaFileId = file.id
})

after(async () => {
  // Client cascades clean all test-owned relational records. The disposable
  // CI database contains no production data; run-scoped IDs prevent overlap.
  await db.client.deleteMany({ where: { clientId: { startsWith: run } } })
  await db.$disconnect()
})

describe('database-backed tenant isolation', () => {
  it('returns a private file only when both record and owning client match', async () => {
    const own = await db.fileRecord.findFirst({ where: { id: alphaFileId, clientId: alphaId, relatedType: { in: ['CLIENT_UPLOAD', 'ADMIN_SHARE'] } } })
    const idorAttempt = await db.fileRecord.findFirst({ where: { id: alphaFileId, clientId: betaId, relatedType: { in: ['CLIENT_UPLOAD', 'ADMIN_SHARE'] } } })
    assert.ok(own)
    assert.equal(idorAttempt, null)
  })

  it('prevents one client from deleting an admin-shared or another client file', async () => {
    const shared = await db.fileRecord.create({
      data: { clientId: alphaId, filename: 'shared.pdf', originalName: 'shared.pdf', mimeType: 'application/pdf', size: 1, content: Buffer.from('x'), scanStatus: 'CLEAN', relatedType: 'ADMIN_SHARE', uploadedBy: 'admin' },
    })
    const crossTenantDeleteTarget = await db.fileRecord.findFirst({ where: { id: alphaFileId, clientId: betaId, relatedType: 'CLIENT_UPLOAD' } })
    const sharedDeleteTarget = await db.fileRecord.findFirst({ where: { id: shared.id, clientId: alphaId, relatedType: 'CLIENT_UPLOAD' } })
    assert.equal(crossTenantDeleteTarget, null)
    assert.equal(sharedDeleteTarget, null)
  })
})

describe('proposal versioning and approval persistence', () => {
  it('keeps generated scope as a draft and preserves immutable version rows', async () => {
    const v1 = await db.scopeOfWork.create({ data: { clientId: alphaId, version: 1, status: 'DRAFT', content: JSON.stringify({ deliverables: ['CRM'] }), generatedBy: 'TST-001' } })
    const v2 = await db.scopeOfWork.create({ data: { clientId: alphaId, version: 2, status: 'AWAITING_ADMIN_APPROVAL', content: JSON.stringify({ deliverables: ['CRM', 'Portal'] }), generatedBy: 'TST-001' } })
    assert.equal(v1.status, 'DRAFT')
    assert.notEqual(v1.id, v2.id)
    assert.equal(await db.scopeOfWork.count({ where: { clientId: alphaId } }), 2)
    await assert.rejects(() => db.scopeOfWork.create({ data: { clientId: alphaId, version: 2, status: 'DRAFT' } }))
  })

  it('records client approval history against a specific scope version', async () => {
    const scope = await db.scopeOfWork.findUniqueOrThrow({ where: { clientId_version: { clientId: alphaId, version: 2 } } })
    const approval = await db.scopeApproval.create({ data: { scopeId: scope.id, clientId: alphaId, decision: 'APPROVED', notes: 'Approved in isolated test' } })
    assert.equal(approval.scopeId, scope.id)
    assert.equal(approval.clientId, alphaId)
    assert.ok(approval.decidedAt)
  })
})

describe('failed payment verification has no activation side effect', () => {
  it('leaves project and payment pending when provider amount mismatches', async () => {
    const project = await db.project.create({ data: { code: `${run}-PRJ`, clientId: alphaId, name: 'Payment Gate Project', status: 'PLANNING', totalAmount: 500, paymentStatus: 'PENDING' } })
    const payment = await db.payment.create({ data: { clientId: alphaId, projectId: project.id, milestone: 'ADVANCE', amount: 500, currency: 'USD', method: 'STRIPE', status: 'PENDING', transactionId: `${run}-SESSION` } })
    const decision = evaluateStripePayment({ currentStatus: payment.status, expectedAmount: payment.amount, expectedCurrency: payment.currency, receivedMinor: 49999, receivedCurrency: 'USD' })
    assert.equal(decision.action, 'REJECT_AMOUNT')
    const unchangedProject = await db.project.findUniqueOrThrow({ where: { id: project.id } })
    const unchangedPayment = await db.payment.findUniqueOrThrow({ where: { id: payment.id } })
    assert.equal(unchangedProject.status, 'PLANNING')
    assert.equal(unchangedProject.paymentStatus, 'PENDING')
    assert.equal(unchangedPayment.status, 'PENDING')
  })
})
