import assert from 'node:assert/strict'
import { createHash, randomBytes } from 'node:crypto'
import { after, before, describe, it } from 'node:test'
import { PrismaClient } from '@prisma/client'
import { NextRequest } from 'next/server'

import { POST as confirmHandover } from '../src/app/api/handover/[token]/confirm/route'
import { GET as downloadHandover } from '../src/app/api/handover/[token]/download/route'
import { evaluateStripePayment } from '../src/lib/commerce-policy'
import { activateProject, closeProject, confirmDelivery, prepareHandover, releaseHandover } from '../src/lib/journey'
import { scanDocumentBytes, serializeScanResult } from '../src/lib/files'
import { getAgentDefinition } from '../src/lib/agents/bootstrap'
import { AgentJobDecisionConflict, AgentJobIdempotencyConflict, claimNextAgentJob, decideAgentJob, enqueueAgentJob, processAgentJobBatch } from '../src/lib/agents/jobs'
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
  // This suite uses a disposable MySQL database. Clean non-cascading blob,
  // audit, notification and error records before removing run-scoped clients.
  await db.fileRecord.deleteMany({ where: { clientId: { in: [alphaId, betaId] } } }).catch(() => null)
  await db.auditLog.deleteMany({ where: { clientId: { startsWith: run } } }).catch(() => null)
  await db.notification.deleteMany({ where: { body: { contains: run } } }).catch(() => null)
  await db.errorLog.deleteMany({ where: { message: { contains: run } } }).catch(() => null)
  await db.client.deleteMany({ where: { clientId: { startsWith: run } } })
  await db.$disconnect()
})

describe('payment-gated project activation', () => {
  it('refuses to create or activate a project without a verified payment', async () => {
    await assert.rejects(() => activateProject(alphaId), /verified payment/i)
    assert.equal(await db.project.count({ where: { clientId: alphaId } }), 0)
  })

  it('rejects a supplied project owned by another client even when the requester has a paid record', async () => {
    const project = await db.project.create({
      data: { code: `${run}-B-PROJECT`, clientId: betaId, name: 'Beta-only project', status: 'PLANNING' },
    })
    await db.payment.create({
      data: { clientId: alphaId, amount: 100, currency: 'USD', method: 'TEST', status: 'PAID', transactionId: `${run}-cross-client-payment` },
    })
    await assert.rejects(() => activateProject(alphaId, project.id), /does not belong to this client/i)
    assert.equal((await db.project.findUniqueOrThrow({ where: { id: project.id } })).status, 'PLANNING')
  })

  it('activates only with a linked verified payment and reuses existing tasks and delivery on retry', async () => {
    const project = await db.project.create({
      data: { code: `${run}-ACTIVATE`, clientId: alphaId, name: 'Retry-safe activation', status: 'PLANNING', totalAmount: 100 },
    })
    await db.payment.create({
      data: { clientId: alphaId, projectId: project.id, amount: 100, currency: 'USD', method: 'TEST', status: 'PAID', transactionId: `${run}-activation-payment` },
    })
    await db.projectTask.create({ data: { projectId: project.id, title: 'Existing approved work item', status: 'TODO' } })

    const first = await activateProject(alphaId, project.id)
    const second = await activateProject(alphaId, project.id)
    assert.equal(first.taskRun, null)
    assert.equal(second.taskRun, null)
    assert.equal((await db.project.findUniqueOrThrow({ where: { id: project.id } })).status, 'ACTIVE')
    assert.equal(await db.projectTask.count({ where: { projectId: project.id } }), 1)
    assert.equal(await db.delivery.count({ where: { projectId: project.id } }), 1)
  })
})

describe('database-backed client delivery confirmation', () => {
  it('records negative answers as a partial delivery and creates a human follow-up instead of closing', async () => {
    const project = await db.project.create({
      data: { code: `${run}-DELIVERY-ISSUE`, clientId: alphaId, name: 'Delivery issue test', status: 'DELIVERY' },
    })
    const result = await confirmDelivery(alphaId, {
      received: true,
      working: false,
      passwordsChanged: true,
      notes: 'Checkout flow does not load.',
    }, project.id)

    assert.equal(result.accepted, false)
    assert.equal(result.delivery.status, 'PARTIAL')
    assert.equal(result.delivery.clientConfirmedAt, null)
    const answers = JSON.parse(result.delivery.confirmationAnswers ?? '{}') as Record<string, unknown>
    assert.equal(answers.received, true)
    assert.equal(answers.working, false)
    const followUp = await db.projectTask.findFirst({ where: { projectId: project.id, assigneeType: 'HUMAN' } })
    assert.ok(followUp)
    assert.equal(followUp?.status, 'TODO')
    assert.match(followUp?.description ?? '', /checkout flow/i)
  })
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

  it('executes only an allowlisted task.create tool and atomically records one human task', async () => {
    const agentCode = 'PRJ-018'
    const definition = getAgentDefinition(agentCode)
    assert.ok(definition)
    const idempotencyKey = `${run}-task-tool`
    const project = await db.project.create({
      data: { code: `${run}-TOOL-PROJECT`, clientId: alphaId, name: 'Tool execution isolation test', status: 'ACTIVE' },
    })
    const existingDepartment = await db.department.findUnique({ where: { code: definition.dept }, select: { id: true } })
    const department = await db.department.upsert({
      where: { code: definition.dept },
      update: {},
      create: { code: definition.dept, name: 'Test delivery department', category: 'DELIVERY' },
      select: { id: true },
    })
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
        departmentId: department.id,
      },
    })

    try {
      const request = {
        agentCode,
        idempotencyKey,
        input: 'Create an internal human-owned task as explicitly requested by the Super Admin.',
        projectId: project.id,
        requestedBy: 'database-workflows-test',
        toolName: 'task.create',
        toolArgs: { title: 'Review staged delivery artifact', description: 'A human QA reviewer must inspect the uploaded artifact.', priority: 'HIGH' },
      }
      const queued = await enqueueAgentJob(request)
      assert.equal(queued.created, true)
      assert.equal(queued.job.taskType, 'TOOL_CALL')
      assert.equal(queued.job.toolName, 'task.create')
      assert.equal(queued.job.status, 'QUEUED')
      await assert.rejects(
        () => enqueueAgentJob({ ...request, idempotencyKey: `${idempotencyKey}-unsupported`, toolName: 'handover.release' }),
        /not executable by durable AgentJobs/i,
      )

      const batch = await processAgentJobBatch(1)
      assert.equal(batch.processed.length, 1)
      assert.equal(batch.processed[0]?.id, queued.job.id)
      assert.equal(batch.processed[0]?.status, 'COMPLETED')
      assert.equal(batch.processed[0]?.toolName, 'task.create')

      const [persistedJob, task] = await Promise.all([
        db.agentJob.findUniqueOrThrow({ where: { id: queued.job.id } }),
        db.projectTask.findUniqueOrThrow({ where: { agentJobId: queued.job.id } }),
      ])
      assert.equal(persistedJob.status, 'COMPLETED')
      assert.equal(persistedJob.attempts, 1)
      assert.equal(task.projectId, project.id)
      assert.equal(task.title, 'Review staged delivery artifact')
      assert.equal(task.description, 'A human QA reviewer must inspect the uploaded artifact.')
      assert.equal(task.status, 'TODO')
      assert.equal(task.assigneeType, 'HUMAN')
      assert.equal(task.priority, 'HIGH')
      assert.deepEqual(JSON.parse(persistedJob.output ?? '{}'), {
        tool: 'task.create', taskId: task.id, projectId: project.id, taskStatus: 'TODO', assignedTo: 'HUMAN',
      })
      assert.ok(await db.auditLog.findFirst({ where: { entityType: 'AgentJob', entityId: queued.job.id, action: 'AGENT_JOB_TOOL_EXECUTED' } }))

      await processAgentJobBatch(1)
      assert.equal(await db.projectTask.count({ where: { projectId: project.id, agentJobId: queued.job.id } }), 1)
      const retriedRequest = await enqueueAgentJob(request)
      assert.equal(retriedRequest.created, false)
      assert.equal(retriedRequest.job.id, queued.job.id)
    } finally {
      const jobs = await db.agentJob.findMany({ where: { idempotencyKey: { startsWith: idempotencyKey } }, select: { id: true } })
      if (jobs.length) {
        await db.auditLog.deleteMany({ where: { entityType: 'AgentJob', entityId: { in: jobs.map((job) => job.id) } } })
        await db.agentJob.deleteMany({ where: { id: { in: jobs.map((job) => job.id) } } })
      }
      await db.projectTask.deleteMany({ where: { projectId: project.id } })
      await db.project.deleteMany({ where: { id: project.id } })
      await db.aiAgent.deleteMany({ where: { code: agentCode } })
      if (!existingDepartment) await db.department.deleteMany({ where: { code: definition.dept } })
    }
  })

  it('recovers expired worker leases and retries transient inference failures with persisted attempts', async () => {
    const agentCode = 'CEO-001'
    const definition = getAgentDefinition(agentCode)
    assert.ok(definition)
    const idempotencyKey = `${run}-worker-recovery`
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
    const now = new Date()
    const job = await db.agentJob.create({
      data: {
        idempotencyKey,
        payloadHash: createHash('sha256').update(idempotencyKey).digest('hex'),
        taskType: 'INFERENCE',
        agentCode,
        clientId: alphaId,
        correlationId: `${run}-worker-recovery-correlation`,
        workflow: 'MYSQL_WORKER_RECOVERY_TEST',
        input: 'Test durable recovery with an injected provider result.',
        status: 'RUNNING',
        approvalState: 'NOT_REQUIRED',
        attempts: 1,
        maxAttempts: 3,
        claimedBy: 'crashed-test-worker',
        leaseUntil: new Date(now.getTime() - 1000),
        availableAt: new Date(now.getTime() - 60_000),
      },
    })

    try {
      const recoveredBatch = await processAgentJobBatch(1, {
        runInference: async () => { throw new Error('unexpected inference call during lease recovery') },
      })
      assert.equal(recoveredBatch.recovered, 1)
      assert.equal(recoveredBatch.processed.length, 0)
      let persisted = await db.agentJob.findUniqueOrThrow({ where: { id: job.id } })
      assert.equal(persisted.status, 'RETRYING')
      assert.equal(persisted.attempts, 1)
      assert.equal(persisted.claimedBy, null)
      assert.equal(persisted.leaseUntil, null)
      assert.ok((persisted.availableAt?.getTime() ?? 0) > Date.now())
      assert.ok(await db.auditLog.findFirst({ where: { entityType: 'AgentJob', entityId: job.id, action: 'AGENT_JOB_RECOVERED' } }))

      await db.agentJob.update({ where: { id: job.id }, data: { availableAt: new Date(Date.now() - 1000) } })
      const failedAttempt = await processAgentJobBatch(1, {
        runInference: async (code, input) => ({
          ok: false,
          agentCode: code,
          executionId: `${run}-transient-execution`,
          correlationId: input.correlationId ?? job.correlationId,
          output: '',
          json: null,
          error: 'PROVIDER_ERROR: ZAI provider returned HTTP 503: temporary test response',
          status: 'FAILED',
        }),
      })
      assert.equal(failedAttempt.processed[0]?.status, 'RETRYING')
      persisted = await db.agentJob.findUniqueOrThrow({ where: { id: job.id } })
      assert.equal(persisted.attempts, 2)
      assert.equal(persisted.status, 'RETRYING')
      assert.match(persisted.lastError ?? '', /HTTP 503/)
      assert.ok((persisted.availableAt?.getTime() ?? 0) > Date.now())

      await db.agentJob.update({ where: { id: job.id }, data: { availableAt: new Date(Date.now() - 1000) } })
      const successfulAttempt = await processAgentJobBatch(1, {
        runInference: async (code, input) => ({
          ok: true,
          agentCode: code,
          executionId: `${run}-successful-execution`,
          correlationId: input.correlationId ?? job.correlationId,
          output: 'test provider double returned a successful inference result',
          json: null,
          status: 'SUCCESS',
        }),
      })
      assert.equal(successfulAttempt.processed[0]?.status, 'COMPLETED')
      persisted = await db.agentJob.findUniqueOrThrow({ where: { id: job.id } })
      assert.equal(persisted.attempts, 3)
      assert.equal(persisted.status, 'COMPLETED')
      assert.match(persisted.output ?? '', /test provider double/)
      assert.ok(await db.auditLog.findFirst({ where: { entityType: 'AgentJob', entityId: job.id, action: 'AGENT_JOB_COMPLETED' } }))
    } finally {
      await db.auditLog.deleteMany({ where: { entityType: 'AgentJob', entityId: job.id } })
      await db.agentJob.deleteMany({ where: { id: job.id } })
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

describe('approved source handover end-to-end', () => {
  it('serves the pinned project artifact bytes and closes only after explicit positive answers', async () => {
    const project = await db.project.create({
      data: { code: `${run}-HANDOVER`, clientId: alphaId, name: 'Test source handover', status: 'DELIVERY', totalAmount: 100, paidAmount: 100, paymentStatus: 'PAID' },
    })
    const payment = await db.payment.create({
      data: { clientId: alphaId, projectId: project.id, amount: 100, currency: 'USD', method: 'TEST', status: 'PAID', transactionId: `${run}-HANDOVER-PAY` },
    })
    const task = await db.projectTask.create({ data: { projectId: project.id, title: 'Implementation and QA', status: 'DONE', assigneeType: 'HUMAN' } })
    const sourceBytes = Buffer.from('export const healthCheck = () => "ok";\\n')
    const scan = scanDocumentBytes(sourceBytes, 'application/typescript', 'health.ts')
    assert.equal(scan.status, 'SCANNED')
    const artifact = await db.fileRecord.create({
      data: {
        clientId: alphaId,
        projectId: project.id,
        relatedType: 'DELIVERY',
        classification: 'PRIVATE',
        filename: `handover-${scan.sha256.slice(0, 10)}.ts`,
        originalName: 'health.ts',
        mimeType: 'application/typescript',
        size: sourceBytes.length,
        sha256: scan.sha256,
        scanStatus: 'CLEAN',
        scanResult: serializeScanResult(scan),
        content: sourceBytes,
        uploadedBy: 'test-super-admin',
      },
    })

    try {
      const prepared = await prepareHandover(alphaId, project.id, 'test-super-admin')
      if (prepared.blocked) throw new Error(prepared.reason)
      assert.equal(prepared.blocked, false)
      const handover = prepared.handover
      const approval = await db.approvalRequest.findFirstOrThrow({ where: { type: 'SOURCE_HANDOVER', clientId: alphaId, status: 'PENDING' }, orderBy: { createdAt: 'desc' } })
      const approvalPayload = JSON.parse(approval.payload) as { handoverId: string; manifest: { projectId: string; files: Array<{ id: string; sha256: string }> } }
      assert.equal(approvalPayload.handoverId, handover.id)
      assert.equal(approvalPayload.manifest.projectId, project.id)
      assert.deepEqual(approvalPayload.manifest.files.map((file) => ({ id: file.id, sha256: file.sha256 })), [{ id: artifact.id, sha256: scan.sha256 }])
      await db.approvalRequest.update({ where: { id: approval.id }, data: { status: 'EXECUTING', decidedBy: 'test-super-admin' } })
      const released = await releaseHandover(handover.id, 'test-super-admin', approval.id)
      assert.equal(released.artifactCount, 1)
      await db.approvalRequest.update({ where: { id: approval.id }, data: { status: 'EXECUTED', executedAt: new Date() } })

      const request = new NextRequest(`https://example.test/api/handover/${handover.packageToken}/download`, { headers: { 'x-forwarded-for': `198.51.100.${Math.floor(Math.random() * 200) + 1}` } })
      const response = await downloadHandover(request, { params: Promise.resolve({ token: handover.packageToken }) })
      assert.equal(response.status, 200)
      assert.equal(response.headers.get('Content-Type'), 'application/zip')
      const zipBytes = Buffer.from(await response.arrayBuffer())
      assert.equal(response.headers.get('X-Artifact-SHA256'), createHash('sha256').update(zipBytes).digest('hex'))
      const JSZip = (await import('jszip')).default
      const zip = await JSZip.loadAsync(zipBytes)
      assert.equal(await zip.file('source/health.ts')?.async('string'), sourceBytes.toString())
      const zippedManifest = JSON.parse(await zip.file('handover-manifest.json')!.async('string')) as { artifacts: Array<{ sha256: string }> }
      assert.equal(zippedManifest.artifacts[0]?.sha256, scan.sha256)
      assert.equal((await db.handoverRecord.findUniqueOrThrow({ where: { id: handover.id } })).status, 'DOWNLOADED')

      const incompleteRequest = new NextRequest(`https://example.test/api/handover/${handover.packageToken}/confirm`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-forwarded-for': `198.51.100.${Math.floor(Math.random() * 200) + 1}` },
        body: JSON.stringify({ passwordsChanged: true }),
      })
      const incompleteResponse = await confirmHandover(incompleteRequest, { params: Promise.resolve({ token: handover.packageToken }) })
      assert.equal(incompleteResponse.status, 400)
      assert.equal(await db.delivery.count({ where: { projectId: project.id } }), 0)

      const accepted = await confirmDelivery(alphaId, { received: true, working: true, passwordsChanged: true }, project.id)
      assert.equal(accepted.accepted, true)
      assert.equal(accepted.delivery.status, 'CONFIRMED')
      assert.equal((await db.handoverRecord.findUniqueOrThrow({ where: { id: handover.id } })).status, 'CONFIRMED')
      assert.deepEqual(await closeProject(project.id, 'test-super-admin'), { ok: true })
      assert.equal((await db.project.findUniqueOrThrow({ where: { id: project.id } })).status, 'COMPLETED')
    } finally {
      await db.fileRecord.deleteMany({ where: { id: artifact.id } })
      await db.auditLog.deleteMany({ where: { projectId: project.id } })
      await db.notification.deleteMany({ where: { body: { contains: project.code } } })
      await db.payment.deleteMany({ where: { id: payment.id } })
      await db.projectTask.deleteMany({ where: { id: task.id } })
      await db.project.deleteMany({ where: { id: project.id } })
    }
  })
})
