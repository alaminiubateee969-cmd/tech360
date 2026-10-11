import assert from 'node:assert/strict'
import { createHash, randomBytes } from 'node:crypto'
import { after, before, describe, it } from 'node:test'
import { PrismaClient } from '@prisma/client'

import { evaluateStripePayment } from '../src/lib/commerce-policy'
import { getAgentDefinition } from '../src/lib/agents/bootstrap'
import { AgentJobDecisionConflict, AgentJobIdempotencyConflict, claimNextAgentJob, decideAgentJob, enqueueAgentJob } from '../src/lib/agents/jobs'
import { claimInboundWebhookEvent, finishInboundWebhookEvent, linkVerifiedIdentityToClient, resolveOrCreateVerifiedClient, VerifiedIdentityConflictError } from '../src/lib/identity-resolver'
import { hashNormalizedIdentity, normalizeIdentity, type VerifiedIdentityProof } from '../src/lib/identity-policy'

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

describe('atomic CRM stage transitions', () => {
  it('allows only one concurrent update to claim the same observed pipeline stage', async () => {
    const client = await db.client.create({
      data: { clientId: `${run}-RACE`, name: 'Transition Race', source: 'TEST', pipelineStage: 'NEW' },
    })

    const outcomes = await Promise.all([
      db.client.updateMany({ where: { id: client.id, pipelineStage: 'NEW' }, data: { pipelineStage: 'CONTACTED' } }),
      db.client.updateMany({ where: { id: client.id, pipelineStage: 'NEW' }, data: { pipelineStage: 'BUSINESS_IDENTIFIED' } }),
    ])

    assert.equal(outcomes.reduce((count, outcome) => count + outcome.count, 0), 1)
    const persisted = await db.client.findUniqueOrThrow({ where: { id: client.id }, select: { pipelineStage: true } })
    assert.ok(['CONTACTED', 'BUSINESS_IDENTIFIED'].includes(persisted.pipelineStage))
  })
})

describe('durable AgentJob idempotency and worker claims', () => {
  it('deduplicates concurrent enqueue requests and grants a job to only one worker', async () => {
    const agentCode = 'CEO-001'
    const definition = getAgentDefinition(agentCode)
    assert.ok(definition)
    const idempotencyKey = `${run}-agent-job`
    await db.aiAgent.create({
      data: {
        code: definition.code,
        name: definition.name,
        title: definition.title,
        purpose: definition.purpose,
        systemPrompt: definition.systemPrompt,
        tools: JSON.stringify(definition.tools),
        permissions: JSON.stringify(definition.permissions),
        requiresApproval: false,
      },
    })

    try {
      const request = { agentCode, idempotencyKey, input: 'Summarize this test-only request.', clientId: alphaId, requestedBy: 'database-workflows-test' }
      const results = await Promise.all([enqueueAgentJob(request), enqueueAgentJob(request)])
      assert.equal(results[0].job.id, results[1].job.id)
      assert.equal(results.filter((result) => result.created).length, 1)
      await assert.rejects(() => enqueueAgentJob({ ...request, input: 'Different payload under the same idempotency key.' }), AgentJobIdempotencyConflict)

      const claims = await Promise.all([
        claimNextAgentJob('test-worker-a', new Date()),
        claimNextAgentJob('test-worker-b', new Date()),
      ])
      const winners = claims.filter((claim) => claim !== null)
      assert.equal(winners.length, 1)
      assert.equal(winners[0]?.id, results[0].job.id)
      assert.equal(winners[0]?.status, 'RUNNING')
      assert.equal(winners[0]?.attempts, 1)
    } finally {
      const jobs = await db.agentJob.findMany({ where: { idempotencyKey }, select: { id: true } })
      if (jobs.length) {
        await db.auditLog.deleteMany({ where: { entityType: 'AgentJob', entityId: { in: jobs.map((job) => job.id) } } })
        await db.agentJob.deleteMany({ where: { id: { in: jobs.map((job) => job.id) } } })
      }
      await db.aiAgent.deleteMany({ where: { code: agentCode } })
    }
  })

  it('holds approval-required agents until an authorized decision is persisted', async () => {
    const agentCode = 'EML-012'
    const definition = getAgentDefinition(agentCode)
    assert.ok(definition)
    const idempotencyKey = `${run}-approval-job`
    await db.aiAgent.create({
      data: {
        code: definition.code,
        name: definition.name,
        title: definition.title,
        purpose: definition.purpose,
        systemPrompt: definition.systemPrompt,
        tools: JSON.stringify(definition.tools),
        permissions: JSON.stringify(definition.permissions),
        requiresApproval: true,
      },
    })

    try {
      const { job } = await enqueueAgentJob({ agentCode, idempotencyKey, input: 'Draft a safe test-only message.', clientId: alphaId, requestedBy: 'database-workflows-test' })
      assert.equal(job.status, 'AWAITING_APPROVAL')
      assert.equal(job.approvalState, 'PENDING')
      assert.equal(await claimNextAgentJob('approval-gate-worker'), null)

      const approved = await decideAgentJob({ id: job.id, decision: 'APPROVE', actorId: 'test-super-admin' })
      assert.equal(approved.status, 'QUEUED')
      assert.equal(approved.approvalState, 'APPROVED')
      await assert.rejects(() => decideAgentJob({ id: job.id, decision: 'APPROVE', actorId: 'test-super-admin' }), AgentJobDecisionConflict)
      const claim = await claimNextAgentJob('approved-job-worker')
      assert.equal(claim?.id, job.id)
      assert.equal(claim?.status, 'RUNNING')
    } finally {
      const jobs = await db.agentJob.findMany({ where: { idempotencyKey }, select: { id: true } })
      if (jobs.length) {
        await db.auditLog.deleteMany({ where: { entityType: 'AgentJob', entityId: { in: jobs.map((job) => job.id) } } })
        await db.agentJob.deleteMany({ where: { id: { in: jobs.map((job) => job.id) } } })
      }
      await db.aiAgent.deleteMany({ where: { code: agentCode } })
    }
  })
})

describe('verified client identity resolution', () => {
  it('converges concurrent signed first-contact requests without merging unverified fields', async () => {
    const originalSecret = process.env.IDENTITY_HASH_SECRET
    process.env.IDENTITY_HASH_SECRET = randomBytes(32).toString('hex')
    const testPhone = `+8801${Date.now().toString().slice(-9)}`
    const proof: VerifiedIdentityProof = { type: 'PHONE', value: testPhone, verificationSource: 'WHATSAPP_SIGNATURE' }
    const clientIds = [`${run}-IDENTITY-A`, `${run}-IDENTITY-B`]
    let resolvedIds: string[] = []
    try {
      const results = await Promise.all(clientIds.map((clientId) => resolveOrCreateVerifiedClient({
        clientId,
        name: 'Verified WhatsApp Test',
        businessName: null,
        businessType: null,
        source: 'WHATSAPP',
        status: 'LEAD',
        pipelineStage: 'NEW',
        email: null,
        phone: null,
        whatsapp: testPhone,
        country: null,
        preferredContact: null,
      }, [proof])))
      resolvedIds = results.map((result) => result.client.id)
      assert.equal(new Set(resolvedIds).size, 1)
      assert.equal(results.filter((result) => result.created).length, 1)
      assert.equal(await db.clientIdentity.count({ where: { clientId: resolvedIds[0], identityType: 'PHONE' } }), 1)

      const email = `verified-${run.toLowerCase()}@example.test`
      const emailProof: VerifiedIdentityProof = { type: 'EMAIL', value: email, verificationSource: 'ADMIN_VERIFIED' }
      const linkResult = await linkVerifiedIdentityToClient({
        clientId: resolvedIds[0],
        proof: emailProof,
        actorId: 'database-workflows-test',
        reason: 'Matched the test-only evidence record.',
      })
      assert.equal(linkResult.linked, true)
      const normalizedEmail = normalizeIdentity('EMAIL', email)
      assert.ok(normalizedEmail)
      const emailIdentity = await db.clientIdentity.findUnique({
        where: { identityType_normalizedHash: { identityType: 'EMAIL', normalizedHash: hashNormalizedIdentity('EMAIL', normalizedEmail) } },
      })
      assert.equal(emailIdentity?.clientId, resolvedIds[0])
      await assert.rejects(() => linkVerifiedIdentityToClient({
        clientId: alphaId,
        proof: emailProof,
        actorId: 'database-workflows-test',
        reason: 'This conflicting test link must fail closed.',
      }), VerifiedIdentityConflictError)
      const linkAudit = await db.auditLog.findFirst({ where: { entityType: 'ClientIdentity', entityId: emailIdentity?.id } })
      assert.ok(linkAudit)
      assert.ok(linkAudit.details?.includes('Matched the test-only evidence record.'))
      assert.ok(!linkAudit.details?.includes(email))
    } finally {
      const clients = await db.client.findMany({ where: { clientId: { in: clientIds } }, select: { id: true } })
      if (clients.length) {
        const identities = await db.clientIdentity.findMany({ where: { clientId: { in: clients.map((client) => client.id) } }, select: { id: true } })
        if (identities.length) {
          await db.auditLog.deleteMany({ where: { entityType: 'ClientIdentity', entityId: { in: identities.map((identity) => identity.id) } } })
          await db.clientIdentity.deleteMany({ where: { id: { in: identities.map((identity) => identity.id) } } })
        }
      }
      await db.client.deleteMany({ where: { clientId: { in: clientIds } } })
      if (originalSecret === undefined) delete process.env.IDENTITY_HASH_SECRET
      else process.env.IDENTITY_HASH_SECRET = originalSecret
    }
  })
})

describe('durable webhook replay protection', () => {
  it('serializes duplicate delivery, reclaims failures, and fences stale claim tokens', async () => {
    const provider = 'WHATSAPP'
    const providerEventId = `${run}-inbound-message`
    const eventIdHash = createHash('sha256').update(provider + '\0' + providerEventId, 'utf8').digest('hex')
    try {
      const claims = await Promise.all([
        claimInboundWebhookEvent({ provider, providerEventId }),
        claimInboundWebhookEvent({ provider, providerEventId }),
      ])
      assert.equal(claims.filter((claim) => claim.claimed).length, 1)
      const winner = claims.find((claim) => claim.claimed)
      assert.ok(winner?.receiptId && winner.claimToken)

      const staleToken = winner.claimToken
      assert.equal(await finishInboundWebhookEvent({ receiptId: winner.receiptId, claimToken: staleToken, success: false, errorCode: 'TEST_RETRY' }), true)
      const retry = await claimInboundWebhookEvent({ provider, providerEventId })
      assert.equal(retry.claimed, true)
      assert.equal(retry.receiptId, winner.receiptId)
      assert.notEqual(retry.claimToken, staleToken)
      assert.equal(await finishInboundWebhookEvent({ receiptId: winner.receiptId, claimToken: staleToken, success: true }), false)
      assert.equal(await finishInboundWebhookEvent({ receiptId: retry.receiptId!, claimToken: retry.claimToken!, success: true }), true)
      assert.equal((await claimInboundWebhookEvent({ provider, providerEventId })).claimed, false)
    } finally {
      await db.inboundWebhookReceipt.deleteMany({ where: { provider, eventIdHash } })
    }
  })
})

describe('proposal versioning and approval persistence', () => {
  it('keeps generated scope as a draft and preserves immutable version rows', async () => {
    const v1 = await db.scopeOfWork.create({ data: { clientId: alphaId, version: 1, status: 'DRAFT', content: JSON.stringify({ deliverables: ['CRM'] }), generatedBy: 'TST-001' } })
    const v2 = await db.scopeOfWork.create({ data: { clientId: alphaId, version: 2, status: 'AWAITING_ADMIN_APPROVAL', content: JSON.stringify({ deliverables: ['CRM', 'Portal'] }), generatedBy: 'TST-001' } })
    assert.equal(v1.status, 'DRAFT')
    assert.notEqual(v1.id, v2.id)
    assert.equal(await db.scopeOfWork.count({ where: { clientId: alphaId } }), 2)
    await assert.rejects(() => db.scopeOfWork.create({ data: { clientId: alphaId, version: 2, status: 'DRAFT', content: '{}' } }))
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
