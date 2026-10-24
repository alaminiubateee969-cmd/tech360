import assert from 'node:assert/strict'
import { after, before, describe, it } from 'node:test'
import { PrismaClient } from '@prisma/client'

import { retryCommunicationOutbox } from '../src/lib/comms'
import { executeGoverned, GovernanceDeniedError, type GovernedActionInput } from '../src/lib/governance/enforce'
import { outboundContentHash } from '../src/lib/governance/outbound'

// DB-backed tests for consequential outbound messages. They run against the
// disposable MySQL in CI. No provider is contacted: the lifecycle tests use a
// stub side effect, and the retry test is refused before any dispatch.

const db = new PrismaClient()
const run = `OUT-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
let clientRowId = ''
let superAdminId = ''
let senderId = ''
const approvalIds: string[] = []
const commIds: string[] = []

before(async () => {
  const client = await db.client.create({
    data: { clientId: `${run}-C`, name: 'Outbound Test Client', email: `${run.toLowerCase()}@example.test`, source: 'TEST' },
  })
  clientRowId = client.id
  const [sa, sender] = await Promise.all([
    db.user.create({ data: { email: `${run.toLowerCase()}-super@example.test`, name: 'Super', role: 'SUPER_ADMIN', passwordHash: 'x' } }),
    db.user.create({ data: { email: `${run.toLowerCase()}-mgr@example.test`, name: 'Manager', role: 'MANAGER', passwordHash: 'x' } }),
  ])
  superAdminId = sa.id
  senderId = sender.id
})

after(async () => {
  await db.auditLog.deleteMany({ where: { clientId: clientRowId } })
  await db.communication.deleteMany({ where: { id: { in: commIds } } })
  await db.approvalRequest.deleteMany({ where: { id: { in: approvalIds } } })
  await db.client.deleteMany({ where: { id: clientRowId } })
  await db.user.deleteMany({ where: { id: { in: [superAdminId, senderId].filter(Boolean) } } })
  await db.$disconnect()
})

const BODY = 'Please pay 12,000 USD to the account below and send us the reference.'
const RECIPIENT = 'client@example.test'

function commKey(body = BODY): string {
  return `comm:${outboundContentHash({ channel: 'EMAIL', to: RECIPIENT, subject: 'Payment', body })}`
}

async function makeApproval(resourceKey: string): Promise<string> {
  const approval = await db.approvalRequest.create({
    data: {
      type: 'MANUAL_COMMUNICATION',
      title: `${run} send`,
      clientId: clientRowId,
      payload: JSON.stringify({ action: 'communication.send', resourceKey }),
      risk: 'HIGH',
      status: 'APPROVED',
      requestedBy: senderId,
      decidedBy: superAdminId,
      updatedAt: new Date(),
    },
  })
  approvalIds.push(approval.id)
  return approval.id
}

function sendInput(approvalId: string | null, resourceKey: string): GovernedActionInput {
  return {
    action: 'communication.send',
    actor: { type: 'HUMAN', id: senderId, role: 'MANAGER' },
    resourceKey,
    approvalId,
    clientId: clientRowId,
  }
}

describe('consequential outbound lifecycle (database)', () => {
  it('lets an approved message send once, then refuses the replay', async () => {
    const key = commKey()
    const approvalId = await makeApproval(key)
    let sent = 0
    await executeGoverned(sendInput(approvalId, key), async () => { sent += 1; return {} })
    assert.equal(sent, 1)
    await assert.rejects(
      executeGoverned(sendInput(approvalId, key), async () => { sent += 1; return {} }),
      (error: unknown) => error instanceof GovernanceDeniedError,
    )
    assert.equal(sent, 1, 'a replayed approval must not send again')
  })

  it('refuses a changed body and leaves the approval unspent', async () => {
    const key = commKey()
    const approvalId = await makeApproval(key)
    const changedKey = commKey(`${BODY} Edited.`)
    await assert.rejects(executeGoverned(sendInput(approvalId, changedKey), async () => ({})))
    const row = await db.approvalRequest.findUnique({ where: { id: approvalId } })
    assert.equal(row?.status, 'APPROVED', 'a mismatched request must not spend the approval')
  })

  it('lets exactly one of two concurrent sends consume a single approval', async () => {
    const key = commKey()
    const approvalId = await makeApproval(key)
    let sent = 0
    const attempt = () => executeGoverned(sendInput(approvalId, key), async () => { sent += 1; return {} })
    const results = await Promise.allSettled([attempt(), attempt()])
    assert.equal(results.filter((r) => r.status === 'fulfilled').length, 1)
    assert.equal(sent, 1)
  })

  it('rolls back consumption when the send fails, so the same approval can be used again', async () => {
    const key = commKey()
    const approvalId = await makeApproval(key)
    await assert.rejects(
      executeGoverned(sendInput(approvalId, key), async () => { throw new Error('provider timeout') }),
      /provider timeout/,
    )
    let sent = 0
    await executeGoverned(sendInput(approvalId, key), async () => { sent += 1; return {} })
    assert.equal(sent, 1)
  })
})

describe('consequential outbound retry refusal (database)', () => {
  async function makeFailedComm(body: string, approvalId: string | null = null): Promise<string> {
    const comm = await db.communication.create({
      data: {
        clientId: clientRowId,
        channel: 'EMAIL',
        direction: 'OUT',
        recipient: RECIPIENT,
        subject: 'Payment',
        body,
        status: 'FAILED',
        attempts: 0,
        error: 'timeout',
        approvalId,
      },
    })
    commIds.push(comm.id)
    return comm.id
  }

  it('refuses to retry a failed consequential message and changes nothing', async () => {
    const id = await makeFailedComm(BODY)
    const outcome = await retryCommunicationOutbox(id, { force: true, actor: 'test' })
    assert.equal(outcome.ok, false)
    assert.equal(outcome.action, 'NOT_RETRYABLE')
    const row = await db.communication.findUnique({ where: { id } })
    assert.equal(row?.status, 'FAILED')
    assert.equal(row?.attempts, 0, 'no re-dispatch attempt may be recorded')
  })

  it('refuses to retry a message that is linked to an approval, even when its text is routine', async () => {
    const approvalId = await makeApproval(commKey('Routine text.'))
    const id = await makeFailedComm('Routine text.', approvalId)
    const outcome = await retryCommunicationOutbox(id, { force: true, actor: 'test' })
    assert.equal(outcome.action, 'NOT_RETRYABLE')
    const row = await db.communication.findUnique({ where: { id } })
    assert.equal(row?.attempts, 0)
  })
})
