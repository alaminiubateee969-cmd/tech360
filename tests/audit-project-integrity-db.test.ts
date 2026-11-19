import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import { after, before, describe, it, mock } from 'node:test'
import type { NextRequest } from 'next/server'
import { db } from '../src/lib/db'
import { finishClaimedJob } from '../src/lib/agents/jobs'
import { projectClosureEvidence } from '../src/lib/lifecycle-gates'
import { closeProject } from '../src/lib/journey'

const HAS_DB = Boolean(process.env.PREVIEW_SQLITE_URL || process.env.DATABASE_URL)
const RUN = `integrity-${randomBytes(7).toString('hex')}`
const csrf = randomBytes(24).toString('hex')
const sessions = new Map<string, string>()
const users: string[] = [], jobs: string[] = []
let role = 'ADMIN', clientId: string, projectId: string
let clientMove: (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => Promise<Response>
let projectMove: typeof clientMove
let journeyAction: (req: NextRequest) => Promise<Response>
let taskPatch: (req: NextRequest, ctx: { params: Promise<{ id: string; taskId: string }> }) => Promise<Response>
let taskRun: typeof taskPatch
const request = (path: string, method: string, data?: unknown) => new Request(`https://audit.invalid/api/admin/${path}`, {
  method, headers: { 'content-type': 'application/json', 'x-csrf-token': csrf }, ...(data === undefined ? {} : { body: JSON.stringify(data) }),
}) as NextRequest
const projectCtx = () => ({ params: Promise.resolve({ id: projectId }) })
const taskCtx = (taskId: string) => ({ params: Promise.resolve({ id: projectId, taskId }) })
const task = (evidence: string | null, status = 'TODO') => db.projectTask.create({ data: { projectId, title: 'Synthetic evidence-integrity task', assigneeType: 'HUMAN', status, evidence } })

// Real guards, database sessions, transactions and route handlers. The only
// platform seam is Next's request-local cookie accessor. No provider runs.
describe('audit: project/CRM state corrections and durable task evidence', { skip: !HAS_DB }, () => {
  before(async () => {
    assert.notEqual(process.env.NODE_ENV, 'production')
    const url = new URL(process.env.PREVIEW_SQLITE_URL || process.env.DATABASE_URL || '')
    assert.ok(url.protocol === 'file:' && url.pathname.endsWith('/.preview/test.db')
      || url.protocol === 'mysql:' && ['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname)
      && ['tech360_ci', 'tech360_test'].includes(decodeURIComponent(url.pathname.slice(1))), 'disposable database required')
    mock.module('next/headers', { namedExports: { cookies: async () => ({ get: (name: string) => {
      const value = name === 't360_session' ? sessions.get(role) : name === 't360_csrf' ? csrf : undefined
      return value ? { value } : undefined
    } }) } })
    for (const name of ['SUPER_ADMIN', 'ADMIN', 'PROJECT_MANAGER', 'FINANCE', 'STAFF']) {
      const user = await db.user.create({ data: { email: `${RUN}-${name}@example.invalid`, role: name, passwordHash: 'not-used-for-session-fixture' } })
      users.push(user.id)
      const token = randomBytes(32).toString('hex')
      await db.session.create({ data: { token, userId: user.id, expiresAt: new Date(Date.now() + 3_600_000) } })
      sessions.set(name, token)
    }
    clientId = (await db.client.create({ data: { clientId: RUN, name: 'Synthetic integrity client', pipelineStage: 'CONTACTED' } })).id
    projectId = (await db.project.create({ data: { clientId, code: RUN, name: 'Synthetic integrity project', totalAmount: 1000, status: 'ACTIVE' } })).id
    ;({ PATCH: clientMove } = await import('../src/app/api/admin/clients/[id]/stage/route'))
    ;({ PATCH: projectMove } = await import('../src/app/api/admin/projects/[id]/status/route'))
    ;({ PATCH: taskPatch } = await import('../src/app/api/admin/projects/[id]/tasks/[taskId]/route'))
    ;({ POST: taskRun } = await import('../src/app/api/admin/projects/[id]/tasks/[taskId]/run/route'))
    ;({ POST: journeyAction } = await import('../src/app/api/admin/journey/route'))
  })
  after(async () => {
    if (jobs.length) await db.agentJob.deleteMany({ where: { id: { in: jobs } } })
    if (projectId) await db.automationEvent.deleteMany({ where: { subjectType: 'Project', subjectId: projectId } })
    if (clientId) await db.client.deleteMany({ where: { id: clientId } })
    if (users.length) { await db.session.deleteMany({ where: { userId: { in: users } } }); await db.user.deleteMany({ where: { id: { in: users } } }) }
  })

  it('recognizes PROJECT_MANAGER as a manager for authorized CRM corrections', async () => {
    role = 'PROJECT_MANAGER'
    const response = await clientMove(request(`clients/${clientId}/stage`, 'PATCH', { pipelineStage: 'NEW' }), { params: Promise.resolve({ id: clientId }) })
    assert.equal(response.status, 200)
    assert.equal((await db.client.findUniqueOrThrow({ where: { id: clientId } })).pipelineStage, 'NEW')
  })
  it('recognizes PROJECT_MANAGER as a manager for authorized project corrections', async () => {
    role = 'PROJECT_MANAGER'
    const response = await projectMove(request(`projects/${projectId}/status`, 'PATCH', { status: 'PLANNING' }), projectCtx())
    assert.equal(response.status, 200)
    assert.equal((await db.project.findUniqueOrThrow({ where: { id: projectId } })).status, 'PLANNING')
  })
  it('does not treat an unknown persisted CRM stage as the stage before NEW', async () => {
    role = 'STAFF'
    await db.client.update({ where: { id: clientId }, data: { pipelineStage: 'UNRECOGNIZED_LEGACY_STAGE' } })
    const response = await clientMove(request(`clients/${clientId}/stage`, 'PATCH', { pipelineStage: 'NEW' }), { params: Promise.resolve({ id: clientId }) })
    assert.equal(response.status, 403)
    assert.equal((await db.client.findUniqueOrThrow({ where: { id: clientId } })).pipelineStage, 'UNRECOGNIZED_LEGACY_STAGE')
  })
  it('does not allow FINANCE to enqueue project-task AI work without project.write', async () => {
    role = 'FINANCE'
    const row = await task(null)
    const response = await taskRun(request(`projects/${projectId}/tasks/${row.id}/run`, 'POST'), taskCtx(row.id))
    assert.equal(response.status, 403)
    assert.equal((await db.projectTask.findUniqueOrThrow({ where: { id: row.id } })).status, 'TODO')
  })
  it('preserves whole historical evidence entries when a human note crosses the old 8000-character cut', async () => {
    role = 'ADMIN'
    const history = Array.from({ length: 6 }, (_, i) => ({ note: `${i}:` + 'x'.repeat(1300) }))
    const row = await task(JSON.stringify(history))
    const response = await taskPatch(request(`projects/${projectId}/tasks/${row.id}`, 'PATCH', { evidence: 'New evidence: ' + 'y'.repeat(300) }), taskCtx(row.id))
    assert.equal(response.status, 200)
    const stored = JSON.parse((await db.projectTask.findUniqueOrThrow({ where: { id: row.id } })).evidence!)
    assert.deepEqual(stored.slice(0, 6), history)
    assert.equal(stored[6].note, 'New evidence: ' + 'y'.repeat(300))
  })
  it('preserves malformed legacy evidence as explicitly marked raw content instead of throwing or discarding it', async () => {
    role = 'ADMIN'
    const legacy = '[{"note":"a previously truncated document'
    const row = await task(legacy)
    const response = await taskPatch(request(`projects/${projectId}/tasks/${row.id}`, 'PATCH', { evidence: 'Human-added recovery note' }), taskCtx(row.id))
    assert.equal(response.status, 200)
    const stored = JSON.parse((await db.projectTask.findUniqueOrThrow({ where: { id: row.id } })).evidence!)
    assert.equal(stored[0].type, 'LEGACY_UNPARSEABLE_EVIDENCE')
    assert.equal(stored[0].raw, legacy)
    assert.equal(stored[1].note, 'Human-added recovery note')
  })
  it('refuses evidence over the TEXT byte budget without changing status or destroying notes', async () => {
    role = 'ADMIN'
    const history = JSON.stringify([{ note: 'ব'.repeat(19_990) }])
    const row = await task(history)
    const response = await taskPatch(request(`projects/${projectId}/tasks/${row.id}`, 'PATCH', { status: 'DONE', evidence: 'new'.repeat(100) }), taskCtx(row.id))
    assert.equal(response.status, 413)
    const stored = await db.projectTask.findUniqueOrThrow({ where: { id: row.id } })
    assert.equal(stored.evidence, history)
    assert.equal(stored.status, 'TODO')
  })
  it('does not lose a successful human note when concurrent requests read the same evidence', async () => {
    role = 'ADMIN'
    const row = await task('[]')
    const delegate = db.projectTask
    const original = delegate.findFirst
    let arrivals = 0, release!: () => void
    const barrier = new Promise<void>((resolve) => { release = resolve })
    Reflect.set(delegate, 'findFirst', async (...args: unknown[]) => {
      const result = await Reflect.apply(original, delegate, args)
      if (result?.id === row.id) { arrivals++; if (arrivals === 2) release(); await barrier }
      return result
    })
    try {
      const responses = await Promise.all(['First concurrent evidence', 'Second concurrent evidence'].map((evidence) => taskPatch(request(`projects/${projectId}/tasks/${row.id}`, 'PATCH', { evidence }), taskCtx(row.id))))
      assert.ok(responses.every((response) => [200, 409].includes(response.status)))
      const notes = JSON.parse((await db.projectTask.findUniqueOrThrow({ where: { id: row.id } })).evidence!).map((entry: { note: string }) => entry.note)
      assert.equal(notes.length, responses.filter((response) => response.status === 200).length, 'each acknowledged successful append must survive')
      assert.equal(new Set(notes).size, notes.length)
    } finally { Reflect.set(delegate, 'findFirst', original) }
  })
  for (const full of [false, true]) {
    it(`persists a terminal worker draft without invalid JSON or lost prior evidence (${full ? 'full TEXT budget' : 'old 8000-character boundary'})`, async () => {
      const history = JSON.stringify([{ note: full ? 'x'.repeat(59_950) : 'x'.repeat(7950) }])
      const row = await db.projectTask.create({ data: { projectId, title: 'Synthetic worker evidence task', status: 'IN_PROGRESS', assigneeType: 'AGENT', assigneeRef: 'TSK-019', evidence: history } })
      const key = `${RUN}-${row.id}`
      const job = await db.agentJob.create({ data: { idempotencyKey: key, payloadHash: '1'.repeat(64), correlationId: key, clientId, projectId, workflow: 'PROJECT_TASK_EXECUTION', input: 'Synthetic persistence-only completion; no inference', status: 'RUNNING', claimedBy: RUN, attempts: 1, checkpoint: JSON.stringify({ projectTaskId: row.id }) } })
      jobs.push(job.id)
      await db.projectTask.update({ where: { id: row.id }, data: { agentJobId: job.id } })
      assert.equal(await finishClaimedJob(job, RUN, { ok: true, executionId: '', correlationId: key, output: 'SYNTHETIC DRAFT ONLY', status: 'COMPLETED' }, new Date()), 'COMPLETED')
      const stored = await db.projectTask.findUniqueOrThrow({ where: { id: row.id } })
      assert.equal(stored.status, 'REVIEW')
      const entries = JSON.parse(stored.evidence!)
      assert.equal(entries[0].note, JSON.parse(history)[0].note)
      if (full) {
        assert.equal(stored.evidence, history)
        assert.equal(await db.auditLog.count({ where: { entityId: row.id, action: 'TASK_EVIDENCE_LIMIT_REACHED' } }), 1)
      } else { assert.equal(entries[1].jobId, job.id) }
    })
  }
  it('does not bypass real completion evidence through the project-status board endpoint, even for SUPER_ADMIN', async () => {
    role = 'SUPER_ADMIN'
    await db.project.update({ where: { id: projectId }, data: { status: 'HANDOVER' } })
    const response = await projectMove(request(`projects/${projectId}/status`, 'PATCH', { status: 'COMPLETED' }), projectCtx())
    assert.equal(response.status, 409)
    assert.equal((await response.json()).code, 'PAYMENT_INCOMPLETE')
    assert.equal((await db.project.findUniqueOrThrow({ where: { id: projectId } })).status, 'HANDOVER')
  })
  it('requires verified, same-currency payment records instead of trusting PAID labels or cached totals', async () => {
    const payment = await db.payment.create({ data: { clientId, projectId, amount: 1000, currency: 'USD', status: 'PAID' } })
    await db.project.update({ where: { id: projectId }, data: { paidAmount: 1000 } })
    assert.deepEqual((await projectClosureEvidence(projectId)).closure, { allowed: false, code: 'PAYMENT_INCOMPLETE' })
    await db.payment.update({ where: { id: payment.id }, data: { verifiedAt: new Date(), verifiedBy: users[0], currency: 'EUR' } })
    assert.deepEqual((await projectClosureEvidence(projectId)).closure, { allowed: false, code: 'PAYMENT_INCOMPLETE' })
    await db.payment.update({ where: { id: payment.id }, data: { currency: 'USD' } })
    assert.deepEqual((await projectClosureEvidence(projectId)).closure, { allowed: false, code: 'TASKS_INCOMPLETE' })
  })
  it('retains delivery and source-handover acceptance gates after verified payment and completed work', async () => {
    await db.projectTask.updateMany({ where: { projectId }, data: { status: 'DONE' } })
    assert.deepEqual((await projectClosureEvidence(projectId)).closure, { allowed: false, code: 'DELIVERY_NOT_ACCEPTED' })
    await db.delivery.create({ data: { clientId, projectId, status: 'CONFIRMED', checklist: '[]', confirmationAnswers: JSON.stringify({ received: true, working: true }) } })
    assert.deepEqual((await projectClosureEvidence(projectId)).closure, { allowed: false, code: 'HANDOVER_NOT_CONFIRMED' })
    await db.handoverRecord.create({ data: { clientId, projectId, type: 'SOURCE_CODE', packageToken: `${RUN}-source-token`, status: 'CONFIRMED' } })
    assert.deepEqual((await projectClosureEvidence(projectId)).closure, { allowed: true })
  })
  it('refuses project closure after a settled refund, including a case that was later CLOSED', async () => {
    const refund = await db.refundCase.create({ data: { clientId, projectId, caseNumber: `${RUN}-refund`, status: 'CLOSED', approvedAmountMinor: 100, currency: 'USD', reason: 'Synthetic persisted refund evidence', requestedBy: RUN, settledAt: new Date() } })
    try {
      assert.deepEqual((await projectClosureEvidence(projectId)).closure, { allowed: false, code: 'PAYMENT_INCOMPLETE' })
      role = 'SUPER_ADMIN'
      const response = await projectMove(request(`projects/${projectId}/status`, 'PATCH', { status: 'COMPLETED' }), projectCtx())
      assert.equal(response.status, 409)
      await assert.rejects(() => closeProject(projectId, RUN), /full payment not verified/)
      assert.equal((await db.project.findUniqueOrThrow({ where: { id: projectId } })).status, 'HANDOVER')
    } finally { await db.refundCase.delete({ where: { id: refund.id } }) }
  })
  it('does not use one client as authorization context to close another client\'s project', async () => {
    role = 'ADMIN'
    const decoy = await db.client.create({ data: { clientId: `${RUN}-decoy`, name: 'Synthetic unrelated client' } })
    const originalProject = await db.project.findUniqueOrThrow({ where: { id: projectId } })
    const originalClient = await db.client.findUniqueOrThrow({ where: { id: clientId } })
    try {
      const response = await journeyAction(request('journey', 'POST', { clientId: decoy.id, action: 'CLOSE_PROJECT', payload: { projectId } }))
      assert.equal(response.status, 404)
      assert.equal((await db.project.findUniqueOrThrow({ where: { id: projectId } })).status, originalProject.status)
      assert.equal((await db.client.findUniqueOrThrow({ where: { id: clientId } })).pipelineStage, originalClient.pipelineStage)
    } finally {
      await db.project.update({ where: { id: projectId }, data: { status: originalProject.status, closedAt: originalProject.closedAt } })
      await db.client.update({ where: { id: clientId }, data: { pipelineStage: originalClient.pipelineStage, status: originalClient.status } })
      await db.client.delete({ where: { id: decoy.id } })
    }
  })
  it('does not let a manager-ranked FINANCE operator close projects without project.write', async () => {
    role = 'FINANCE'
    const originalProject = await db.project.findUniqueOrThrow({ where: { id: projectId } })
    const originalClient = await db.client.findUniqueOrThrow({ where: { id: clientId } })
    try {
      const response = await journeyAction(request('journey', 'POST', { clientId, action: 'CLOSE_PROJECT', payload: { projectId } }))
      assert.equal(response.status, 403)
      assert.equal((await db.project.findUniqueOrThrow({ where: { id: projectId } })).status, originalProject.status)
    } finally {
      await db.project.update({ where: { id: projectId }, data: { status: originalProject.status, closedAt: originalProject.closedAt } })
      await db.client.update({ where: { id: clientId }, data: { pipelineStage: originalClient.pipelineStage, status: originalClient.status } })
    }
  })
  it('still allows a board completion when all real persisted evidence exists', async () => {
    role = 'SUPER_ADMIN'
    const response = await projectMove(request(`projects/${projectId}/status`, 'PATCH', { status: 'COMPLETED' }), projectCtx())
    assert.equal(response.status, 200)
    const stored = await db.project.findUniqueOrThrow({ where: { id: projectId } })
    assert.equal(stored.status, 'COMPLETED')
    assert.ok(stored.closedAt)
  })
  it('does not mark unrelated in-flight automation successful just because a journey stage advances', async () => {
    const log = await db.automationLog.create({ data: { clientId, workflow: RUN, correlationId: RUN, trigger: 'AUDIT', status: 'RUNNING', steps: '[]' } })
    assert.deepEqual(await closeProject(projectId, 'synthetic-audit-operator'), { ok: true })
    assert.equal((await db.automationLog.findUniqueOrThrow({ where: { id: log.id } })).status, 'RUNNING')
  })
  it('shares the verified-currency gate with the journey close action, not only the board', async () => {
    await db.payment.updateMany({ where: { projectId }, data: { currency: 'EUR' } })
    await assert.rejects(() => closeProject(projectId, 'synthetic-audit-operator'), /full payment not verified/)
  })
})
