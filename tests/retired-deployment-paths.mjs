#!/usr/bin/env node
/** Ensure unsupported legacy deployment/backup entrypoints fail before side effects. */
import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const scripts = [
  'deployment/deploy.sh',
  'deployment/backup.sh',
  'scripts/deploy-hostinger.sh',
]

for (const relativePath of scripts) {
  const result = spawnSync('/bin/bash', [path.join(root, relativePath)], {
    cwd: root,
    encoding: 'utf8',
  })
  const output = `${result.stdout ?? ''}\n${result.stderr ?? ''}`
  if (result.error || result.status === 0 || !/retired/i.test(output)) {
    console.error(`[retired-deployments] FAILED: ${relativePath} did not fail with a retirement notice`)
    process.exitCode = 1
  }
}

const cloudBuild = readFileSync(path.join(root, 'deployment/cloudbuild.yaml'), 'utf8')
if (!/exit 1/.test(cloudBuild) || /run\s+deploy|--set-secrets/i.test(cloudBuild)) {
  console.error('[retired-deployments] FAILED: legacy Cloud Build config is not fail-closed')
  process.exitCode = 1
}

const dockerfile = readFileSync(path.join(root, 'deployment/Dockerfile'), 'utf8')
if (!/RUN .*exit 1/.test(dockerfile)) {
  console.error('[retired-deployments] FAILED: legacy Dockerfile does not fail the image build')
  process.exitCode = 1
}

if (process.exitCode) process.exit(1)
console.log('[retired-deployments] unsupported deploy/backup paths fail closed before deployment side effects')
