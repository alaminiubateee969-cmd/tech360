import assert from 'node:assert/strict'
import test from 'node:test'
import { checkFactoryScopeGate, type CurrentFactoryScope, type FactoryAppScopeBinding } from '../src/lib/factory/scope-gate'

const hash = 'ab'.repeat(32)
const app: FactoryAppScopeBinding = {
  clientId: 'client-1',
  projectId: 'project-1',
  scopeId: 'scope-1',
  scopeVersion: 3,
  scopeHash: hash,
}
const scope: CurrentFactoryScope = {
  id: 'scope-1',
  clientId: 'client-1',
  projectId: 'project-1',
  version: 3,
  status: 'FINAL',
  approvedAt: new Date('2026-10-28T00:00:00.000Z'),
  latestClientDecision: 'APPROVED',
  latestApprovalClientId: 'client-1',
  contentHash: hash,
}

function blockedCode(appBinding: FactoryAppScopeBinding, currentScope: CurrentFactoryScope | null): string {
  const result = checkFactoryScopeGate(appBinding, currentScope)
  if (result.allowed) throw new Error('Expected factory scope gate to block this case')
  return result.code
}

test('factory client delivery scope gate', async (t) => {
  await t.test('allows only the exact final scope version approved by the same client', () => {
    assert.deepEqual(checkFactoryScopeGate(app, scope), { allowed: true })
  })

  await t.test('blocks internal prototypes and projects without a complete scope binding', () => {
    assert.equal(blockedCode({ ...app, projectId: null }, scope), 'PROJECT_SCOPE_REQUIRED')
    assert.equal(blockedCode({ ...app, scopeHash: null }, scope), 'SCOPE_SNAPSHOT_MISSING')
    assert.equal(blockedCode(app, null), 'SCOPE_SNAPSHOT_MISSING')
  })

  await t.test('blocks a scope from another project, client, id, or version', () => {
    assert.equal(blockedCode(app, { ...scope, projectId: 'other-project' }), 'SCOPE_LINK_MISMATCH')
    assert.equal(blockedCode(app, { ...scope, clientId: 'other-client' }), 'SCOPE_LINK_MISMATCH')
    assert.equal(blockedCode(app, { ...scope, id: 'other-scope' }), 'SCOPE_LINK_MISMATCH')
    assert.equal(blockedCode(app, { ...scope, version: 2 }), 'SCOPE_LINK_MISMATCH')
  })

  await t.test('blocks draft, superseded, or unapproved final scopes', () => {
    assert.equal(blockedCode(app, { ...scope, status: 'SUPERSEDED' }), 'SCOPE_NOT_FINAL')
    assert.equal(blockedCode(app, { ...scope, approvedAt: null }), 'SCOPE_NOT_FINAL')
  })

  await t.test('requires client approval of the same client', () => {
    assert.equal(blockedCode(app, { ...scope, latestClientDecision: null }), 'CLIENT_APPROVAL_REQUIRED')
    assert.equal(blockedCode(app, { ...scope, latestClientDecision: 'REVISION_REQUESTED' }), 'CLIENT_APPROVAL_REQUIRED')
    assert.equal(blockedCode(app, { ...scope, latestApprovalClientId: 'other-client' }), 'CLIENT_APPROVAL_REQUIRED')
  })

  await t.test('detects any mutation to the approved scope content', () => {
    assert.equal(blockedCode(app, { ...scope, contentHash: 'cd'.repeat(32) }), 'SCOPE_CONTENT_CHANGED')
    assert.equal(blockedCode({ ...app, scopeHash: 'not-a-sha256' }, scope), 'SCOPE_CONTENT_CHANGED')
  })
})
