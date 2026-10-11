import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { describe, it } from 'node:test'

import { createHandoverManifest, parseHandoverManifest, verifyHandoverArtifacts } from '../src/lib/handover-artifacts'

function artifact(content = Buffer.from('actual project deliverable')) {
  return {
    id: 'file-1',
    originalName: 'app.ts',
    mimeType: 'text/markdown',
    size: content.length,
    sha256: createHash('sha256').update(content).digest('hex'),
    clientId: 'client-row-1',
    projectId: 'project-1',
    relatedType: 'DELIVERY',
    scanStatus: 'CLEAN',
    classification: 'PRIVATE',
    content,
  }
}

describe('approved handover artifact manifest', () => {
  it('binds a manifest to an actual project artifact and its exact bytes', () => {
    const file = artifact()
    const manifest = createHandoverManifest('project-1', [file], '2026-10-11T00:00:00.000Z')
    assert.ok(manifest)
    const parsed = parseHandoverManifest(JSON.stringify(manifest), 'project-1')
    assert.deepEqual(parsed, manifest)
    assert.equal(verifyHandoverArtifacts(parsed!, [file], 'client-row-1'), true)
  })

  it('rejects manifests without a source-code file, legacy AI text, wrong project and path traversal', () => {
    const file = artifact()
    assert.equal(createHandoverManifest('project-1', [{ ...file, originalName: 'brief.pdf' }]), null)
    const manifest = createHandoverManifest('project-1', [file])
    assert.ok(manifest)
    assert.equal(parseHandoverManifest('AI-generated source package ready', 'project-1'), null)
    assert.equal(parseHandoverManifest(JSON.stringify({ ...manifest, files: [{ ...manifest.files[0], name: 'brief.pdf' }] }), 'project-1'), null)
    assert.equal(parseHandoverManifest(JSON.stringify(manifest), 'project-2'), null)
    assert.equal(parseHandoverManifest(JSON.stringify({
      ...manifest,
      files: [{ ...manifest.files[0], name: '../outside.txt' }],
    }), 'project-1'), null)
  })

  it('rejects missing, quarantined, cross-tenant, changed or incomplete artifact bytes', () => {
    const file = artifact()
    const manifest = createHandoverManifest('project-1', [file])!
    assert.equal(verifyHandoverArtifacts(manifest, [], 'client-row-1'), false)
    assert.equal(verifyHandoverArtifacts(manifest, [{ ...file, clientId: 'other-client' }], 'client-row-1'), false)
    assert.equal(verifyHandoverArtifacts(manifest, [{ ...file, scanStatus: 'QUARANTINED' }], 'client-row-1'), false)
    assert.equal(verifyHandoverArtifacts(manifest, [{ ...file, content: Buffer.from('changed') }], 'client-row-1'), false)
    assert.equal(verifyHandoverArtifacts(manifest, [{ ...file, classification: 'HIGHLY_SENSITIVE' }], 'client-row-1'), false)
  })
})
