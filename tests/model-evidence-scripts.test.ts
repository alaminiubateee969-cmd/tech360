import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { describe, it } from 'node:test'

const ROOT = resolve(__dirname, '..')
const sha = (value: string) => createHash('sha256').update(value).digest('hex')

function fixture(run: (directory: string, preload: string) => void) {
  const directory = mkdtempSync(join(tmpdir(), 'tech360-model-evidence-'))
  const preload = join(directory, 'network-fixture.cjs')
  writeFileSync(preload, `
    const { appendFileSync } = require('node:fs');
    globalThis.fetch = async (url, init) => {
      appendFileSync(process.env.AUDIT_CALLS, JSON.stringify({url, redirect:init?.redirect})+'\\n');
      if (String(url).endsWith('/api/tags')) return new Response(process.env.AUDIT_TAGS, {status:200});
      const request = JSON.parse(init.body);
      const user = request.messages.find(m=>m.role==='user')?.content ?? '';
      if (process.env.AUDIT_FAIL_BANGLA && /[ঀ-৿]/.test(user)) throw new Error('synthetic unavailable probe');
      const content = /[ঀ-৿]/.test(user) ? 'পাসপোর্ট ছবি ট্রান্সক্রিপ্ট আবেদন ফরম' : 'Synthetic fixture reply.';
      return new Response(JSON.stringify({message:{content},done:false})+'\\n'+JSON.stringify({done:true,eval_count:10,eval_duration:1000000000})+'\\n', {status:200});
    };
  `)
  try { run(directory, preload) } finally { rmSync(directory, { recursive: true, force: true }) }
}
function invoke(script: string, directory: string, preload: string, args: string[], extraEnv: Record<string, string> = {}) {
  return spawnSync(process.execPath, ['--require', preload, join(ROOT, 'scripts', script), ...args], {
    cwd: ROOT, encoding: 'utf8', timeout: 12_000,
    env: { ...process.env, NODE_ENV: 'test', AUDIT_CALLS: join(directory, 'calls.jsonl'), AUDIT_TAGS: '{"models":[]}', ...extraEnv },
  })
}
function weights(directory: string, withBlob: boolean) {
  const blob = 'Synthetic weight bytes, not a real model.'
  const digest = sha(blob)
  const manifest = JSON.stringify({ schemaVersion: 2, layers: [{ mediaType: 'application/vnd.ollama.image.model', size: Buffer.byteLength(blob), digest: `sha256:${digest}` }] })
  const manifests = join(directory, 'models/manifests')
  const file = join(manifests, 'registry.ollama.ai/library/audit/fixture')
  mkdirSync(dirname(file), { recursive: true })
  writeFileSync(file, manifest)
  // Also provide the old script's nonstandard path: it must not be enough to
  // mark a manifest digest as verified weight bytes when the blob is absent.
  writeFileSync(join(manifests, 'audit:fixture'), manifest)
  if (withBlob) {
    mkdirSync(join(directory, 'models/blobs'), { recursive: true })
    writeFileSync(join(directory, 'models/blobs', `sha256-${digest}`), blob)
  }
  return { manifests, digest, revision: sha(manifest), tags: JSON.stringify({ models: [{ name: 'audit:fixture', digest: sha(manifest), size: blob.length }] }) }
}

describe('model evidence tooling: real file hashes with intercepted HTTP, never real model acceptance', () => {
  it('verifies actual model-layer bytes and the exact raw manifest revision', () => fixture((dir, preload) => {
    const data = weights(dir, true)
    const result = invoke('verify-local-models.mjs', dir, preload, ['--manifest-dir', data.manifests, '--json'], { AUDIT_TAGS: data.tags })
    assert.equal(result.status, 0, result.stderr)
    const report = JSON.parse(result.stdout)
    assert.equal(report.models.length, 1)
    assert.equal(report.models[0].verified, true)
    assert.equal(report.models[0].revision, data.revision)
    assert.equal(report.models[0].weightChecksum, data.digest)
    assert.equal(report.models[0].checksumSource, 'BLOB')
  }))

  it('never calls a manifest digest a verified weight checksum when the weight file is missing', () => fixture((dir, preload) => {
    const data = weights(dir, false)
    const result = invoke('verify-local-models.mjs', dir, preload, ['--manifest-dir', data.manifests, '--json'], { AUDIT_TAGS: data.tags })
    assert.equal(result.status, 1)
    const report = JSON.parse(result.stdout)
    assert.equal(report.models.length, 1)
    assert.equal(report.models[0].verified, false)
    assert.equal(report.models[0].weightChecksum, null)
    assert.ok(report.models[0].limitations.length)
  }))

  it('rejects corrupted weight bytes rather than trusting the file name', () => fixture((dir, preload) => {
    const data = weights(dir, true)
    writeFileSync(join(dir, 'models/blobs', `sha256-${data.digest}`), 'corrupted synthetic bytes')
    const result = invoke('verify-local-models.mjs', dir, preload, ['--manifest-dir', data.manifests, '--json'], { AUDIT_TAGS: data.tags })
    assert.equal(result.status, 1)
    assert.equal(JSON.parse(result.stdout).models[0].verified, false)
  }))

  it('refuses a public model URL before even the intercepted network boundary', () => fixture((dir, preload) => {
    const result = invoke('verify-local-models.mjs', dir, preload, ['--base-url', 'https://public-model.invalid', '--json'])
    assert.notEqual(result.status, 0)
    assert.equal(existsSync(join(dir, 'calls.jsonl')), false)
  }))

  it('does not advertise a nonexistent --apply importer or pretend database records were updated', () => fixture((dir, preload) => {
    const out = join(dir, 'verification.json')
    const result = invoke('verify-local-models.mjs', dir, preload, ['--apply', '--out', out])
    assert.equal(result.status, 2)
    assert.equal(existsSync(out), false)
    assert.equal(existsSync(join(dir, 'calls.jsonl')), false)
  }))

  it('reports an empty model catalogue as unverified, with a failing exit code', () => fixture((dir, preload) => {
    const result = invoke('verify-local-models.mjs', dir, preload, ['--json'])
    assert.equal(result.status, 1)
    assert.deepEqual(JSON.parse(result.stdout).models, [])
  }))

  it('accepts documented --name=value arguments and measures first content from an actual streamed fixture', () => fixture((dir, preload) => {
    const out = join(dir, 'benchmark.json')
    const result = invoke('benchmark-local-models.mjs', dir, preload, ['--model=audit:fixture', `--out=${out}`, '--base-url=http://127.0.0.1:11434'])
    assert.equal(result.status, 0, result.stderr)
    const report = JSON.parse(readFileSync(out, 'utf8'))
    assert.equal(report.metrics.probesRun, 7)
    assert.equal(report.metrics.probesFailed, 0)
    assert.equal(typeof report.metrics.firstTokenMs, 'number')
    assert.equal(report.metrics.modelResidentMemoryMb, null)
    assert.ok(report.notes.some((note: string) => /not.*quality|heuristic/i.test(note)))
    const calls = readFileSync(join(dir, 'calls.jsonl'), 'utf8').trim().split('\n').map((line) => JSON.parse(line))
    assert.ok(calls.every((call) => call.redirect === 'error'))
  }))

  it('does not turn an unexecuted Bangla category into zero quality or successful benchmark acceptance', () => fixture((dir, preload) => {
    const out = join(dir, 'partial.json')
    const result = invoke('benchmark-local-models.mjs', dir, preload, ['--model', 'audit:fixture', '--out', out], { AUDIT_FAIL_BANGLA: '1' })
    assert.equal(result.status, 1)
    const report = JSON.parse(readFileSync(out, 'utf8'))
    assert.equal(report.metrics.probesRun, 6)
    assert.equal(report.metrics.probesFailed, 1)
    assert.equal(report.metrics.banglaResponseRate, null)
  }))
})
