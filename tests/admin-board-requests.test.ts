import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { afterEach, beforeEach, describe, it, mock } from 'node:test'
import { api, ApiError } from '../src/lib/admin-client'

const originalDocument = Object.getOwnPropertyDescriptor(globalThis, 'document')

describe('admin board mutations use the real CSRF-aware request layer', () => {
  beforeEach(() => { Object.defineProperty(globalThis, 'document', { configurable: true, value: { cookie: 'other=1; t360_csrf=synthetic-csrf-token' } }) })
  afterEach(() => {
    mock.restoreAll()
    if (originalDocument) Object.defineProperty(globalThis, 'document', originalDocument)
    else Reflect.deleteProperty(globalThis, 'document')
  })
  it('sends lead-stage changes with CSRF and an encoded record path', async () => {
    const send = mock.method(globalThis, 'fetch', async () => Response.json({ ok: true, pipelineStage: 'CONTACTED' }))
    const result = await api.moveClientStage('record/1', 'CONTACTED')
    assert.equal(result.pipelineStage, 'CONTACTED')
    const [url, init] = send.mock.calls[0].arguments
    assert.equal(url, '/api/admin/clients/record%2F1/stage')
    assert.equal(init?.method, 'PATCH')
    assert.equal(new Headers(init?.headers).get('x-csrf-token'), 'synthetic-csrf-token')
    assert.deepEqual(JSON.parse(String(init?.body)), { pipelineStage: 'CONTACTED' })
  })
  it('sends project-status changes with CSRF and propagates conflicts honestly', async () => {
    const send = mock.method(globalThis, 'fetch', async () => Response.json({ error: 'Another operator moved this project' }, { status: 409 }))
    await assert.rejects(() => api.moveProjectStatus('project/2', 'TESTING'), (error: unknown) => error instanceof ApiError && error.status === 409)
    const [url, init] = send.mock.calls[0].arguments
    assert.equal(url, '/api/admin/projects/project%2F2/status')
    assert.equal(init?.method, 'PATCH')
    assert.equal(new Headers(init?.headers).get('x-csrf-token'), 'synthetic-csrf-token')
    assert.deepEqual(JSON.parse(String(init?.body)), { status: 'TESTING' })
  })
  it('wires the lead board to the tested CSRF helper, rather than an unprotected raw PATCH', () => {
    const board = readFileSync('src/components/admin/LeadsBoard.tsx', 'utf8')
    assert.match(board, /api\.moveClientStage\(activeId, targetStage\)/)
    assert.doesNotMatch(board, /await fetch\(/)
  })
  it('wires the project board to the tested CSRF helper, retaining its rollback/error path', () => {
    const board = readFileSync('src/components/admin/ProjectsView.tsx', 'utf8')
    assert.match(board, /api\.moveProjectStatus\(projectId, nextStatus\)/)
    assert.doesNotMatch(board, /await fetch\(/)
    assert.match(board, /setLocalProjects\(prev\)/)
    assert.match(board, /toast\.error\(msg\)/)
  })
})
