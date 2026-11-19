#!/usr/bin/env node
// Read-only, on-host evidence collection. This script does NOT write Prisma
// records, modify the model catalogue, promote a model or accept --apply.
// Example: node scripts/verify-local-models.mjs --manifest-dir=/var/lib/ollama/models/manifests
// --json prints without writing a report. Exit 1 means absent/incomplete or
// mismatched evidence, not verified weights. No weights are downloaded.
import { createHash } from 'node:crypto'
import { createReadStream, existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { readFile, realpath, stat } from 'node:fs/promises'
import { dirname, join, relative, resolve, sep } from 'node:path'
import { ROOT, argument, modelHeaders, privateModelBaseUrl, timeoutMs } from './lib/model-evidence.mjs'

if (process.argv.includes('--apply')) {
  console.error('--apply is not implemented: this read-only evidence tool cannot update deployment or catalogue records. An owner-reviewed import/promotion workflow is required.')
  process.exit(2)
}

let baseUrl, outPath, manifestDir, timeout
try {
  baseUrl = privateModelBaseUrl(String(argument('base-url', process.env.LOCAL_MODEL_BASE_URL || 'http://127.0.0.1:11434')))
  outPath = resolve(ROOT, String(argument('out', 'docs/testing/LOCAL_MODEL_VERIFICATION.json')))
  manifestDir = String(argument('manifest-dir', process.env.LOCAL_MODEL_MANIFEST_DIR || '')).trim()
  timeout = timeoutMs()
} catch (error) {
  console.error(error.message)
  process.exit(2)
}
const asJson = process.argv.includes('--json')
const digestPattern = /^(?:sha256:)?([a-f0-9]{64})$/
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex')

function manifestParts(name) {
  if (typeof name !== 'string') throw new Error('invalid model reference')
  const parts = name.split('/')
  const last = parts.pop()
  const colon = last.lastIndexOf(':')
  const model = colon < 0 ? last : last.slice(0, colon)
  const tag = colon < 0 ? 'latest' : last.slice(colon + 1)
  let registry = 'registry.ollama.ai'
  if (parts.length && /[.:]/.test(parts[0])) registry = parts.shift()
  const namespace = parts.length ? parts : ['library']
  const result = [registry, ...namespace, model, tag]
  if (result.some((part) => !part || part === '.' || part === '..' || !/^[a-zA-Z0-9_.:-]+$/.test(part))) {
    throw new Error('invalid model reference path')
  }
  return result
}

async function containedFile(root, parts) {
  const [base, file] = await Promise.all([realpath(root), realpath(join(root, ...parts))])
  const rel = relative(base, file)
  if (!rel || rel === '..' || rel.startsWith(`..${sep}`) || rel.startsWith(sep) || !(await stat(file)).isFile()) {
    throw new Error('evidence path escapes its declared directory or is not a regular file')
  }
  return file
}
async function fileDigest(file) {
  const hash = createHash('sha256')
  let bytes = 0
  for await (const chunk of createReadStream(file)) { hash.update(chunk); bytes += chunk.length }
  return { sha256: hash.digest('hex'), bytes }
}

async function inspectModel(model) {
  const record = {
    name: model.name ?? model.model ?? 'unknown', sizeBytes: model.size ?? null,
    parameterSize: model.details?.parameter_size ?? null, family: model.details?.family ?? null,
    quantisation: model.details?.quantization_level ?? null, revision: null,
    weightChecksum: null, checksumSource: null, blobs: [], verified: false, limitations: [],
  }
  if (!manifestDir) { record.limitations.push('No local manifest directory was supplied; weight bytes were not verified.'); return record }
  try {
    const file = await containedFile(manifestDir, manifestParts(record.name))
    const raw = await readFile(file)
    const manifest = JSON.parse(raw.toString('utf8'))
    const revision = sha(raw)
    record.revision = revision
    const reported = typeof model.digest === 'string' ? digestPattern.exec(model.digest)?.[1] : null
    if (!reported || reported !== revision) record.limitations.push('The raw manifest SHA-256 does not match the digest reported by the model server.')
    const layers = [...(manifest.config ? [manifest.config] : []), ...(Array.isArray(manifest.layers) ? manifest.layers : [])]
    const weights = []
    for (const layer of layers) {
      const digest = typeof layer?.digest === 'string' ? /^sha256:([a-f0-9]{64})$/.exec(layer.digest)?.[1] : null
      if (!digest || !Number.isSafeInteger(layer.size) || layer.size < 0) throw new Error('manifest contains an invalid layer digest or size')
      const blobRoot = resolve(manifestDir, '..', 'blobs')
      const blob = await containedFile(blobRoot, [`sha256-${digest}`])
      const actual = await fileDigest(blob)
      const matched = actual.sha256 === digest && actual.bytes === layer.size
      const isWeight = layer.mediaType === 'application/vnd.ollama.image.model' || layer.mediaType === 'application/vnd.ollama.image.adapter'
      record.blobs.push({ digest, sha256: actual.sha256, bytes: actual.bytes, mediaType: layer.mediaType ?? null, matched })
      if (!matched) record.limitations.push('A local blob hash or byte length does not match its manifest layer.')
      if (isWeight) weights.push(actual.sha256)
    }
    if (!weights.length) record.limitations.push('No model-weight layer was verified.')
    record.verified = layers.length > 0 && record.limitations.length === 0
    if (record.verified) {
      // A manifest digest is not a weight-file checksum. For multi-file
      // models the individual checksums live in blobs; never invent one.
      record.weightChecksum = weights.length === 1 ? weights[0] : null
      record.checksumSource = 'BLOB'
    }
  } catch {
    record.limitations.push('The local manifest or one of its blobs could not be read and verified. Check the manifest layout, file access and blob directory; no weight verification is claimed.')
  }
  return record
}

const report = { verifiedAt: new Date().toISOString(), baseUrl, manifestDir: manifestDir || null, models: [], notes: [
  'Read-only evidence only: no catalogue/deployment record or promotion state is updated. Runtime acceptance and quality remain separate owner checks.',
] }
try {
  const response = await fetch(`${baseUrl}/api/tags`, { headers: modelHeaders(), redirect: 'error', signal: AbortSignal.timeout(timeout) })
  if (!response.ok) throw new Error(`model server returned HTTP ${response.status}`)
  const payload = await response.json()
  if (!Array.isArray(payload?.models)) throw new Error('model catalogue response is malformed')
  for (const model of payload.models) report.models.push(await inspectModel(model))
  if (!report.models.length) report.notes.push('The model server reported no models; no weights were verified.')
} catch {
  report.notes.push('The model catalogue could not be read from the private endpoint; no model availability or weight acceptance is claimed.')
}
const passed = report.models.length > 0 && report.models.every((model) => model.verified)
if (asJson) console.log(JSON.stringify(report, null, 2))
else {
  mkdirSync(dirname(outPath), { recursive: true })
  writeFileSync(outPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8')
  console.log(`Local model weight evidence: ${passed ? 'VERIFIED FILE HASHES' : 'UNVERIFIED / INCOMPLETE'}`)
  console.log(`Report written to ${outPath}. No database/catalogue changes were made.`)
}
process.exitCode = passed ? 0 : 1
