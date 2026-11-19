import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import { after, before, describe, it, mock } from 'node:test'
import type { NextRequest } from 'next/server'
import { db } from '../src/lib/db'
import { ROLES } from '../src/lib/constants'
import { hasCapability, hasRole } from '../src/lib/access-policy'

const HAS_DB = Boolean(process.env.PREVIEW_SQLITE_URL || process.env.DATABASE_URL)
const RUN = `boundary-${randomBytes(7).toString('hex')}`
const csrf = randomBytes(24).toString('hex')
const sessions = new Map<string, string>()
const users: string[] = [], conversations: string[] = []
let currentRole = 'SUPER_ADMIN'
let clientId: string, projectId: string
let clientGet: (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => Promise<Response>
let projectGet: typeof clientGet
let conversationGet: typeof clientGet
let projectsGet: (req: NextRequest) => Promise<Response>
let projectMove: typeof clientGet
let clientMove: typeof clientGet
let clientsPost: (req: NextRequest) => Promise<Response>
let approvalsGet: (req: NextRequest) => Promise<Response>
const request = (path: string, method = 'GET', data?: unknown) => new Request(`https://audit.invalid/api/admin/${path}`, {
  method, headers: { 'content-type': 'application/json', 'x-csrf-token': csrf }, ...(data === undefined ? {} : { body: JSON.stringify(data) }),
}) as NextRequest

// Only Next's request-local cookie accessor is supplied by the harness. The
// production guard, role/capability policy, DB sessions, CSRF and Prisma queries
// all execute unchanged against a disposable database.
describe('audit: CRM composite routes cannot bypass private workforce or finance boundaries', { skip: !HAS_DB }, () => {
  before(async () => {
    assert.notEqual(process.env.NODE_ENV, 'production')
    const url = new URL(process.env.PREVIEW_SQLITE_URL || process.env.DATABASE_URL || '')
    assert.ok(url.protocol === 'file:' && url.pathname.endsWith('/.preview/test.db')
      || url.protocol === 'mysql:' && ['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname)
      && ['tech360_ci', 'tech360_test'].includes(decodeURIComponent(url.pathname.slice(1))), 'requires a disposable test database')
    mock.module('next/headers', { namedExports: { cookies: async () => ({ get: (name: string) => {
      const value = name === 't360_session' ? sessions.get(currentRole) : name === 't360_csrf' ? csrf : undefined
      return value ? { value } : undefined
    } }) } })
    for (const role of ROLES) {
      const user = await db.user.create({ data: { email: `${RUN}-${role.toLowerCase()}@example.invalid`, role, passwordHash: 'not-used-by-session-fixture' } })
      users.push(user.id)
      const token = randomBytes(32).toString('hex')
      await db.session.create({ data: { token, userId: user.id, expiresAt: new Date(Date.now() + 3_600_000) } })
      sessions.set(role, token)
    }
    clientId = (await db.client.create({ data: { clientId: RUN, name: 'Synthetic CRM boundary client', pipelineStage: 'NEW' } })).id
    projectId = (await db.project.create({ data: { clientId, code: RUN, name: 'Synthetic CRM project', totalAmount: 1234.5, paidAmount: 137.25 } })).id
    await db.payment.create({ data: { clientId, projectId, amount: 137.25, notes: 'PRIVATE_FINANCE_SENTINEL' } })
    await db.invoice.create({ data: { clientId, projectId, number: RUN, amount: 1234.5, internalNotes: 'PRIVATE_INVOICE_SENTINEL' } })
    await db.aiMemory.create({ data: { clientId, scope: 'CLIENT', key: RUN, content: 'PRIVATE_MEMORY_SENTINEL', accessLevel: 'HIGHLY_SENSITIVE' } })
    await db.automationLog.create({ data: { clientId, workflow: RUN, trigger: 'AUDIT', correlationId: RUN, steps: '[]', output: 'PRIVATE_AUTOMATION_SENTINEL' } })
    await db.approvalRequest.create({ data: { clientId, type: 'AGENT_CREATE', title: 'PRIVATE_WORKFORCE_APPROVAL_SENTINEL', payload: JSON.stringify({ prompt: 'PRIVATE_APPROVAL_PAYLOAD_SENTINEL' }) } })
    await db.approvalRequest.create({ data: { clientId, type: 'PAYMENT_INSTRUCTION', title: 'FINANCE_APPROVAL_TITLE_SENTINEL', payload: JSON.stringify({ instruction: 'PRIVATE_APPROVAL_PAYLOAD_SENTINEL' }) } })
    await db.approvalRequest.create({ data: { clientId, type: 'FINAL_SCOPE_SEND', title: 'Synthetic scope review status', payload: JSON.stringify({ content: 'PRIVATE_APPROVAL_PAYLOAD_SENTINEL' }), description: 'PRIVATE_APPROVAL_PAYLOAD_SENTINEL', result: 'PRIVATE_APPROVAL_PAYLOAD_SENTINEL', decisionNote: 'PRIVATE_APPROVAL_PAYLOAD_SENTINEL' } })
    for (const tenantId of ['tech360', `${RUN}-other-tenant`]) {
      const conversation = await db.chatConversation.create({ data: { tenantId, clientId, anonId: randomBytes(24).toString('hex'), subject: tenantId === 'tech360' ? 'Synthetic owned thread' : 'OTHER_TENANT_CONVERSATION_SENTINEL' } })
      conversations.push(conversation.id)
    }
    ;({ GET: clientGet } = await import('../src/app/api/admin/clients/[id]/route'))
    ;({ GET: conversationGet } = await import('../src/app/api/admin/conversations/[id]/route'))
    ;({ GET: projectGet } = await import('../src/app/api/admin/projects/[id]/route'))
    ;({ GET: projectsGet } = await import('../src/app/api/admin/projects/route'))
    ;({ PATCH: projectMove } = await import('../src/app/api/admin/projects/[id]/status/route'))
    ;({ PATCH: clientMove } = await import('../src/app/api/admin/clients/[id]/stage/route'))
    ;({ POST: clientsPost } = await import('../src/app/api/admin/clients/route'))
    ;({ GET: approvalsGet } = await import('../src/app/api/admin/approvals/route'))
  })
  after(async () => {
    if (conversations.length) await db.chatConversation.deleteMany({ where: { id: { in: conversations } } })
    if (clientId) await db.client.deleteMany({ where: { id: clientId } })
    if (users.length) { await db.session.deleteMany({ where: { userId: { in: users } } }); await db.user.deleteMany({ where: { id: { in: users } } }) }
  })

  for (const role of ROLES) {
    it(`applies declared CRM, finance and private-memory access for ${role}`, async () => {
      currentRole = role
      const response = await clientGet(request(`clients/${clientId}`), { params: Promise.resolve({ id: clientId }) })
      if (!hasCapability({ role }, 'crm.read')) { assert.equal(response.status, 403); return }
      assert.equal(response.status, 200)
      const data = await response.json()
      const serialized = JSON.stringify(data)
      const finance = hasCapability({ role }, 'finance.read')
      assert.equal(serialized.includes('PRIVATE_FINANCE_SENTINEL'), finance)
      assert.equal(serialized.includes('PRIVATE_INVOICE_SENTINEL'), finance)
      assert.equal(serialized.includes('PRIVATE_MEMORY_SENTINEL'), role === 'SUPER_ADMIN')
      assert.equal(serialized.includes('PRIVATE_AUTOMATION_SENTINEL'), role === 'SUPER_ADMIN')
      assert.equal(serialized.includes('PRIVATE_WORKFORCE_APPROVAL_SENTINEL'), role === 'SUPER_ADMIN')
      assert.equal(serialized.includes('PRIVATE_APPROVAL_PAYLOAD_SENTINEL'), role === 'SUPER_ADMIN')
      assert.equal(serialized.includes('FINANCE_APPROVAL_TITLE_SENTINEL'), finance)
      assert.ok(data.approvals.some((approval: { title: string }) => approval.title === 'Synthetic scope review status'), 'authorized staff can still track operational approval status')
      assert.equal(data.projects[0].totalAmount, finance ? 1234.5 : null)
      assert.equal(data.projects[0].paidAmount, finance ? 137.25 : null)
      assert.equal(data.access.financeRead, finance)
      assert.equal(data.access.privateWorkforceRead, role === 'SUPER_ADMIN')
      if (!finance) { assert.equal(data.payments, null); assert.equal(data.invoices, null); assert.ok(!data.timeline.some((item: { type: string }) => item.type === 'PAYMENT')) }
      if (role !== 'SUPER_ADMIN') { assert.equal(data.memories, null); assert.equal(data.automationLogs, null) }
    })
  }

  it('does not leak another tenant\'s sibling conversation through an authorized inbox CRM profile', async () => {
    currentRole = 'STAFF'
    const direct = await conversationGet(request(`conversations/${conversations[1]}`), { params: Promise.resolve({ id: conversations[1] }) })
    assert.equal(direct.status, 404)
    const own = await conversationGet(request(`conversations/${conversations[0]}`), { params: Promise.resolve({ id: conversations[0] }) })
    assert.equal(own.status, 200)
    const data = await own.json()
    assert.ok(data.crm.conversations.some((conversation: { id: string }) => conversation.id === conversations[0]))
    assert.ok(!JSON.stringify(data).includes(conversations[1]))
    assert.doesNotMatch(JSON.stringify(data), /OTHER_TENANT_CONVERSATION_SENTINEL/)
  })

  it('applies the same private-payload and financial boundaries to the dedicated approval list', async () => {
    for (const role of [...ROLES].reverse()) {
      currentRole = role
      const response = await approvalsGet(request(`approvals?status=ALL&clientId=${clientId}`))
      if (!hasRole({ role }, 'MANAGER') || !hasCapability({ role }, 'crm.read')) { assert.equal(response.status, 403, role); continue }
      assert.equal(response.status, 200, role)
      const data = await response.json(), serialized = JSON.stringify(data)
      assert.equal(serialized.includes('PRIVATE_WORKFORCE_APPROVAL_SENTINEL'), role === 'SUPER_ADMIN', role)
      assert.equal(serialized.includes('PRIVATE_APPROVAL_PAYLOAD_SENTINEL'), role === 'SUPER_ADMIN', role)
      assert.equal(serialized.includes('FINANCE_APPROVAL_TITLE_SENTINEL'), hasCapability({ role }, 'finance.read'), role)
      assert.equal(data.access.detailsRead, role === 'SUPER_ADMIN')
      assert.ok(data.approvals.some((approval: { title: string }) => approval.title === 'Synthetic scope review status'))
      for (const approval of data.approvals) assert.equal(approval.detailsRestricted, role !== 'SUPER_ADMIN')
    }
  })

  it('does not expose financial relations or totals through PROJECT_MANAGER project detail/list', async () => {
    currentRole = 'PROJECT_MANAGER'
    const detail = await projectGet(request(`projects/${projectId}`), { params: Promise.resolve({ id: projectId }) })
    assert.equal(detail.status, 200)
    const data = await detail.json()
    assert.equal(data.project.totalAmount, null)
    assert.equal(data.payments, null)
    assert.equal(data.invoices, null)
    assert.doesNotMatch(JSON.stringify(data), /PRIVATE_FINANCE_SENTINEL|PRIVATE_INVOICE_SENTINEL/)
    const list = await projectsGet(request(`projects?clientId=${clientId}`))
    assert.equal(list.status, 200)
    const listData = await list.json()
    assert.equal(listData.projects[0].totalAmount, null)
    assert.equal(listData.projects[0].paidAmount, null)
    assert.equal(listData.projects[0].financeRead, false)
  })

  for (const role of ['FINANCE', 'SUPPORT', 'DESIGNER']) {
    it(`does not let read-only CRM capability ${role} mutate a lead through a bulk route or stage route`, async () => {
      currentRole = role
      const bulk = await clientsPost(request('clients', 'POST', { action: 'bulk_update', ids: [clientId], status: 'LOST' }))
      assert.equal(bulk.status, 403)
      const stage = await clientMove(request(`clients/${clientId}/stage`, 'PATCH', { pipelineStage: 'CONTACTED' }), { params: Promise.resolve({ id: clientId }) })
      assert.equal(stage.status, 403)
      assert.equal((await db.client.findUniqueOrThrow({ where: { id: clientId } })).pipelineStage, 'NEW')
    })
  }

  for (const role of ['STAFF', 'SUPPORT', 'SALES', 'FINANCE']) {
    it(`does not let ${role} change project status without project.write`, async () => {
      currentRole = role
      await db.project.update({ where: { id: projectId }, data: { status: 'PLANNING' } })
      const response = await projectMove(request(`projects/${projectId}/status`, 'PATCH', { status: 'ACTIVE' }), { params: Promise.resolve({ id: projectId }) })
      assert.equal(response.status, 403)
      assert.equal((await db.project.findUniqueOrThrow({ where: { id: projectId } })).status, 'PLANNING')
    })
  }
})
