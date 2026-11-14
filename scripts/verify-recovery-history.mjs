#!/usr/bin/env node
/** Read-only verification of the failed-run recovery snapshot. Needs full Git history. */
import { execFileSync, spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export function verifyRecovery(manifest, cwd = process.cwd()) {
  const errors = []
  const seen = new Set()
  const ancestor = (sha) => /^[a-f0-9]{40}$/.test(sha ?? '') &&
    spawnSync('git', ['merge-base', '--is-ancestor', sha, 'HEAD'], { cwd, stdio: 'ignore' }).status === 0
  if (!ancestor(manifest.baseCommit)) errors.push('Audited base is missing from HEAD history. Use a full clone (git fetch --unshallow origin main if shallow).')
  for (const run of manifest.runs) {
    if (seen.has(run.id)) errors.push(`Duplicate run ${run.id}`)
    seen.add(run.id)
    if (run.resolution === 'integrated') {
      if (!ancestor(run.sha)) errors.push(`Run ${run.id}: ${run.sha} is not in HEAD history (or the local history is incomplete).`)
    } else if (['superseded-deployment', 'temporary-diagnostic'].includes(run.resolution)) {
      if (!run.reason || !ancestor(run.replacementCommit)) errors.push(`Run ${run.id}: exception needs a reason and an integrated replacement commit.`)
    } else errors.push(`Run ${run.id}: unknown resolution ${run.resolution}`)
  }
  for (const file of manifest.preservedFiles) {
    try {
      const blob = execFileSync('git', ['hash-object', '--', file.path], { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim()
      if (blob !== file.blob) errors.push(`Preserved file changed: ${file.path}`)
    } catch { errors.push(`Preserved file missing: ${file.path}`) }
  }
  return errors
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = fileURLToPath(new URL('../', import.meta.url))
  const manifest = JSON.parse(readFileSync(path.join(root, 'docs/failed-run-recovery-2026-11-14.json'), 'utf8'))
  const errors = verifyRecovery(manifest, root)
  if (errors.length) {
    for (const error of errors) console.error(error)
    process.exitCode = 1
  } else console.log(`Recovery verified: ${manifest.runs.length} historical failed/cancelled runs accounted for; ${manifest.preservedFiles.length} incoming files intact. No remote or database changes made.`)
}
