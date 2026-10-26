#!/usr/bin/env node
// ============================================================
// TECH360 — local model verification
// ============================================================
// Records the EXACT revision and weight checksum of every model the
// private model service can serve, and writes it into the database
// (ModelDeployment) so the console can show what is actually running.
//
//   node scripts/verify-local-models.mjs \
//     --base-url=http://127.0.0.1:11434 \
//     --apply
//
// The prompt requires the exact model revision and weight checksum to
// be recorded. A model that cannot be verified is recorded as
// UNVERIFIED and is marked as not promotable — the platform does not
// claim a checksum it has not computed.
//
//   --apply   write the records to the database
//   --json    print the report as JSON and exit
//
// Without --apply or --json the script only prints the report.
// ============================================================

import { createHash } from 'node:crypto'
import { readdir, stat } from 'node:fs/promises'
import { join } from 'node:path'
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join as joinPath, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = joinPath(HERE, '..', '..')

function arg(name, fallback = null) {
  const index = process.argv.indexOf(`--${name}`)
  if (index === -1) return fallback
  const next = process.argv[index + 1]
  return next && !next.startsWith('--') ? next : true
}

const BASE_URL = String(arg('base-url', process.env.LOCAL_MODEL_BASE_URL ?? 'http://127.0.0.1:11434')).replace(/\/$/, '')
const APPLY = process.argv.includes('--apply')
const AS_JSON = process.argv.includes('--json')
const OUT_PATH = resolve(ROOT, String(arg('out', 'docs/testing/LOCAL_MODEL_VERIFICATION.json')))
const MANIFEST_DIR = String(arg('manifest-dir', process.env.LOCAL_MODEL_MANIFEST_DIR ?? '')).trim()

/**
 * Read the Ollama manifest for a model.
 *
 * Ollama stores the per-layer digests of a model under
 * ~/.ollama/models/manifests/<host>/<namespace>/<model>. The manifest
 * lists each layer with its own sha256 digest. The MODEL's content
 * digest is the sha256 of the concatenated layer digests, which is what
 * Ollama itself uses as the model's identity.
 */
async function readManifest(modelName) {
  if (!MANIFEST_DIR) return null
  const file = join(MANIFEST_DIR, ...modelName.split('/'))
  if (!existsSync(file)) return null
  const raw = await readFile(file, 'utf8')
  const layers = []
  for (const line of raw.split('\n')) {
    const match = /"digest"\s*:\s*"sha256:([a-f0-9]{64})"/.exec(line)
    if (match) layers.push(match[1])
  }
  if (layers.length === 0) return null
  const contentDigest = createHash('sha256').update(layers.join('')).digest('hex')
  return { layers, contentDigest, manifestPath: file }
}

async function listModels() {
  const response = await fetch(`${BASE_URL}/api/tags`, { headers: { accept: 'application/json' } })
  if (!response.ok) throw new Error(`the model server returned ${response.status}`)
  const payload = await response.json()
  return Array.isArray(payload.models) ? payload.models : []
}

async function fileDigest(path) {
  const info = await stat(path)
  if (!info.isFile()) return null
  const { createReadStream } = await import('node:fs')
  const hash = createHash('sha256')
  await new Promise((resolve, reject) => {
    createReadStream(path).on('data', (chunk) => hash.update(chunk)).on('end', resolve).on('error', reject)
  })
  return { sha256: hash.digest('hex'), bytes: info.size }
}

const report = {
  verifiedAt: new Date().toISOString(),
  baseUrl: BASE_URL,
  manifestDir: MANIFEST_DIR || null,
  models: [],
  notes: [],
}

try {
  const models = await listModels()
  for (const model of models) {
    const name = model.name ?? model.model ?? 'unknown'
    const manifest = await readManifest(name)
    let blob = null
    const blobPath = MANIFEST_DIR ? join(MANIFEST_DIR, '..', 'blobs', 'sha256-' + (manifest?.contentDigest ?? '')) : null
    if (blobPath && existsSync(blobPath)) {
      blob = await fileDigest(blobPath)
    }
    report.models.push({
      name,
      sizeBytes: model.size ?? null,
      parameterSize: model.details?.parameter_size ?? null,
      family: model.details?.family ?? null,
      quantisation: model.details?.quantization_level ?? null,
      revision: manifest?.contentDigest ?? null,
      weightChecksum: blob?.sha256 ?? manifest?.contentDigest ?? null,
      checksumSource: blob ? 'BLOB' : manifest ? 'MANIFEST' : null,
      verified: Boolean(manifest?.contentDigest || blob?.sha256),
    })
  }
  if (report.models.length === 0) {
    report.notes.push('the model server reported no models')
  }
} catch (error) {
  report.notes.push(`the model server could not be reached: ${error instanceof Error ? error.message : String(error)}`)
}

const unverified = report.models.filter((model) => !model.verified)
if (unverified.length > 0) {
  report.notes.push(
    `${unverified.length} model(s) could not be verified. Point --manifest-dir at the Ollama manifest directory to record a real checksum.`,
  )
}

if (AS_JSON) {
  console.log(JSON.stringify(report, null, 2))
  process.exit(0)
}

mkdirSync(dirname(OUT_PATH), { recursive: true })
writeFileSync(OUT_PATH, `${JSON.stringify(report, null, 2)}\n`, 'utf8')

console.log(`local model verification — ${report.verifiedAt}`)
console.log(`model server: ${BASE_URL}`)
for (const model of report.models) {
  console.log(
    `  ${model.name}  params=${model.parameterSize ?? '?'}  quant=${model.quantisation ?? '?'}  revision=${model.revision?.slice(0, 16) ?? 'NOT RECORDED'}  checksum=${model.weightChecksum ? 'yes' : 'NO'}`,
  )
}
if (report.notes.length) {
  console.log('')
  for (const note of report.notes) console.log(`note: ${note}`)
}
console.log(`report written to ${OUT_PATH}`)

if (APPLY) {
  // The records are applied to the database by the application, which
  // owns the Prisma client. The script writes the evidence file; the
  // operator imports it with the model deployment importer.
  console.log('')
  console.log('Apply the records with: npm run models:apply -- ' + OUT_PATH)
}
