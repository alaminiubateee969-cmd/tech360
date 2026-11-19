import assert from 'node:assert/strict'
import { before, beforeEach, describe, it, mock } from 'node:test'
import { NextRequest } from 'next/server'

let POST: (req: NextRequest, context: { params: Promise<{ id: string }> }) => Promise<Response>
let delegatedStatus = 200
let delegatedBody: Record<string, unknown> = { ok: true }
let actorId = 'reviewer'
let mirrorCount = 1
let mirrored: string[] = []
let rejectionIncrements = 0
let summaryRefreshes = 0
let delegatedCalls = 0
let refusalAudits = 0

before(async () => {
  mock.module('@/lib/db', { namedExports: { db: {
    reaTarget: { findUnique: async () => ({ id: 'target', code: 'REA-001', host: 'example.test', status: 'ANALYZED' }) },
    evolutionProposal: {
      findUnique: async () => ({ id: 'proposal', approvalId: 'approval', status: 'PENDING', generation: 2 }),
      updateMany: async ({ data }: { data: { status: string } }) => {
        mirrored.push(data.status)
        return { count: mirrorCount }
      },
    },
    approvalRequest: { findUnique: async () => ({ requestedBy: 'proposer' }) },
    evolutionGeneration: { update: async () => { rejectionIncrements++; return {} } },
  } } })
  mock.module('@/lib/api-guard', { namedExports: {
    guard: async () => ({ user: { id: actorId, email: `${actorId}@example.test` } }),
    isResponse: (value: unknown) => value instanceof Response,
  } })
  mock.module('@/lib/security', { namedExports: {
    sanitizeText: (value: unknown, max: number) => String(value ?? '').slice(0, max),
    audit: async () => { refusalAudits++ },
    clientIp: () => 'test',
  } })
  mock.module('@/lib/evolution/observations', { namedExports: {
    refreshGenerationSummary: async () => { summaryRefreshes++ },
    recordObservation: async (input: unknown) => input,
  } })
  mock.module('@/lib/evolution/surfaces', { namedExports: { previewSurface: async () => ({ ok: false }) } })
  mock.module('@/app/api/admin/approvals/[id]/decision/route', { namedExports: {
    POST: async () => {
      delegatedCalls++
      return Response.json(delegatedBody, { status: delegatedStatus })
    },
  } })
  POST = (await import('../src/app/api/admin/evolution/proposals/[id]/route')).POST
})

beforeEach(() => {
  delegatedStatus = 200
  delegatedBody = { ok: true }
  actorId = 'reviewer'
  mirrorCount = 1
  mirrored = []
  rejectionIncrements = 0
  summaryRefreshes = 0
  delegatedCalls = 0
  refusalAudits = 0
})

function decide(decision: string) {
  return POST(new NextRequest('https://example.test/api/admin/evolution/proposals/proposal', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ decision }),
  }), { params: Promise.resolve({ id: 'proposal' }) })
}

describe('evolution proposal decision delegation', () => {
  for (const decision of ['APPROVED', 'REJECTED']) {
    for (const status of [403, 409]) {
      it(`does not mirror ${decision} or claim success after delegated ${status}`, async () => {
        delegatedStatus = status
        delegatedBody = { error: 'Decision refused' }
        const response = await decide(decision)
        assert.equal(response.status, status)
        assert.deepEqual(await response.json(), { error: 'Decision refused', proposalId: 'proposal' })
        assert.deepEqual(mirrored, [])
        assert.equal(rejectionIncrements, 0)
        assert.equal(summaryRefreshes, 0)
      })
    }
  }
  it('requires explicit success, not merely an HTTP 200 or a truthy value', async () => {
    for (const ok of [undefined, false, 'true']) {
      delegatedBody = { ok }
      const response = await decide('REJECTED')
      assert.equal((await response.json()).nextStep, undefined)
    }
    assert.deepEqual(mirrored, [])
  })
  it('does not accept an ok payload on an HTTP error', async () => {
    delegatedStatus = 500
    const response = await decide('APPROVED')
    assert.equal(response.status, 500)
    assert.equal((await response.json()).proposalStatus, undefined)
    assert.deepEqual(mirrored, [])
  })
  it('mirrors a successful approval without applying any mutation', async () => {
    const response = await decide('APPROVED')
    const body = await response.json()
    assert.deepEqual(mirrored, ['APPROVED'])
    assert.equal(body.proposalStatus, 'APPROVED')
    assert.match(body.nextStep, /NOT changed yet/)
    assert.equal(rejectionIncrements, 0)
  })
  it('counts a rejection only when the pending proposal was actually transitioned', async () => {
    await decide('REJECTED')
    assert.equal(rejectionIncrements, 1)
    assert.equal(summaryRefreshes, 1)
    mirrorCount = 0
    await decide('REJECTED')
    assert.equal(rejectionIncrements, 1)
    assert.equal(summaryRefreshes, 1)
  })
  it('directs a REA correction to the real cycle endpoint, not a missing proposals collection', async () => {
    const { POST: correct } = await import('../src/app/api/admin/rea/targets/[id]/route')
    const response = await correct(new NextRequest('https://example.test/api/admin/rea/targets/target', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ detail: 'The inferred stack was incorrect.' }),
    }), { params: Promise.resolve({ id: 'target' }) })
    assert.equal(response.status, 201)
    const body = await response.json()
    assert.match(body.nextStep, /SUPER_ADMIN can POST \/api\/admin\/evolution to/)
    assert.match(body.note, /changes nothing/)
    assert.deepEqual(mirrored, [])
  })
  it('refuses self-approval before delegation, but permits self-rejection', async () => {
    actorId = 'proposer'
    assert.equal((await decide('APPROVED')).status, 409)
    assert.equal(delegatedCalls, 0)
    assert.equal(refusalAudits, 1)
    assert.equal((await decide('REJECTED')).status, 200)
    assert.equal(delegatedCalls, 1)
    assert.deepEqual(mirrored, ['REJECTED'])
  })
})
