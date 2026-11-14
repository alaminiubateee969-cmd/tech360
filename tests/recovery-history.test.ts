import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { before, describe, it } from 'node:test'

const moduleUrl = pathToFileURL(path.resolve('scripts/verify-recovery-history.mjs')).href
let verifyRecovery: (input: ReturnType<typeof manifest>) => string[]
before(async () => { ({ verifyRecovery } = await import(moduleUrl)) })
const sha = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim()
const manifest = () => ({
  baseCommit: sha,
  runs: [{ id: 1, sha, resolution: 'integrated', reason: '', replacementCommit: '' }],
  preservedFiles: [] as { path: string; blob: string }[],
})

describe('failed-run recovery verifier', () => {
  it('accepts a commit reachable from the checkout', () => {
    assert.deepEqual(verifyRecovery(manifest()), [])
  })
  it('fails on an absent commit, rather than claiming it was merged', () => {
    const data = manifest()
    data.runs[0].sha = 'f'.repeat(40)
    assert.match(verifyRecovery(data).join('\n'), /not in HEAD history/)
  })
  it('requires integrated replacement evidence for an exception', () => {
    const data = manifest()
    data.runs[0].resolution = 'superseded-deployment'
    assert.match(verifyRecovery(data).join('\n'), /exception needs/)
    data.runs[0].reason = 'The maintained deployment replaced this workflow.'
    data.runs[0].replacementCommit = sha
    assert.deepEqual(verifyRecovery(data), [])
  })
  it('rejects unknown dispositions and duplicate run IDs', () => {
    const data = manifest()
    data.runs.push({ ...data.runs[0], resolution: 'ignored' })
    const errors = verifyRecovery(data).join('\n')
    assert.match(errors, /Duplicate run/)
    assert.match(errors, /unknown resolution/)
  })
  it('detects missing or changed preserved incoming files', () => {
    const data = manifest()
    data.preservedFiles = [{ path: 'package.json', blob: 'f'.repeat(40) }, { path: 'does-not-exist.recovery', blob: sha }]
    const errors = verifyRecovery(data).join('\n')
    assert.match(errors, /Preserved file changed/)
    assert.match(errors, /Preserved file missing/)
  })
  it('pins every archived incoming version from the PR #43 manifest', () => {
    const data = manifest()
    const archive = JSON.parse(readFileSync('docs/integration-merge-manifest.json', 'utf8'))
    data.preservedFiles = archive.preservedIncomingFiles.map((file: { preservedPath: string; preservedSha: string }) => ({ path: file.preservedPath, blob: file.preservedSha }))
    assert.equal(data.preservedFiles.length, 95)
    assert.deepEqual(verifyRecovery(data), [])
  })
})
