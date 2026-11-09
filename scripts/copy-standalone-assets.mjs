#!/usr/bin/env node
/**
 * Copy the static artifacts into the standalone server bundle — idempotently.
 *
 * WHY THIS EXISTS
 * ---------------
 * `next build` with `output: "standalone"` does not copy `.next/static` or
 * `public/` into `.next/standalone/`. The previous build script did:
 *
 *     cp -r .next/static .next/standalone/.next/ && cp -r public .next/standalone/
 *
 * `cp -r src dst/` copies INSIDE `dst` when `dst/<basename>` already exists.
 * The first build is correct; the SECOND build produces
 * `.next/standalone/public/public/…`, leaving `.next/standalone/public/robots.txt`
 * stale and every subsequently added static file (robots.txt, brand assets,
 * images, .well-known/mcp/server-card.json) missing from the deployed bundle.
 *
 * This script removes the destination first, so a rebuild always produces the
 * same tree as a clean build.
 */
import { cp, rm, stat } from 'node:fs/promises'
import { join } from 'node:path'
import process from 'node:process'

const ROOT = process.cwd()
const STANDALONE = join(ROOT, '.next', 'standalone')

async function exists(path) {
  try {
    await stat(path)
    return true
  } catch {
    return false
  }
}

async function copyInto(source, destination, label) {
  if (!(await exists(source))) {
    // Fail loudly: a missing static tree means a broken deployment, not a
    // warning to scroll past.
    console.error(`[standalone-assets] missing source: ${label} (${source})`)
    process.exit(1)
  }
  await rm(destination, { recursive: true, force: true })
  await cp(source, destination, { recursive: true })
  console.log(`[standalone-assets] ${label} → ${destination.replace(ROOT + '/', '')}`)
}

if (!(await exists(STANDALONE))) {
  console.error('[standalone-assets] .next/standalone not found — run `next build` first.')
  process.exit(1)
}

await copyInto(join(ROOT, '.next', 'static'), join(STANDALONE, '.next', 'static'), '.next/static')
await copyInto(join(ROOT, 'public'), join(STANDALONE, 'public'), 'public')

// Guard the exact regression this script was written for.
if (await exists(join(STANDALONE, 'public', 'public'))) {
  console.error('[standalone-assets] nested public/public detected — refusing to continue.')
  process.exit(1)
}
if (!(await exists(join(STANDALONE, 'public', 'robots.txt')))) {
  console.error('[standalone-assets] public/robots.txt missing from the bundle.')
  process.exit(1)
}
console.log('[standalone-assets] ok — static tree is flat and complete')
