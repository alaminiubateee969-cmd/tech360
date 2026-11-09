#!/usr/bin/env node
/**
 * Copy the static artifacts into the standalone server bundle — idempotently.
 *
 * WHY THIS EXISTS
 * ---------------
 * `next build` with `output: "standalone"` does not copy `.next/static` or
 * `public/` into `.next/standalone/`. Serving `.next/standalone` without this
 * step yields a site with no CSS/JS and no `robots.txt`, so the copy is
 * mandatory, not cosmetic. The previous build script did:
 *
 *     cp -r .next/static .next/standalone/.next/ && cp -r public .next/standalone/
 *
 * The defect is that `cp -r` MERGES into an existing destination and never
 * removes anything. It does not nest (GNU cp merges `src` into `dst/src`
 * when `dst/src` exists); it accumulates. Every file deleted from the source
 * tree therefore survives in `.next/standalone/` forever, and a rebuild can
 * ship files the repository no longer contains.
 *
 * That is not hypothetical on this repo: the agent-readiness work moved
 * `public/llms.txt` to `content/llms.txt` and deleted the original. With the
 * old build step, any rebuild on a working tree that still held a previous
 * `public/` copy kept `.next/standalone/public/llms.txt` — a stale static file
 * that shadows the new `src/app/llms.txt/route.ts` handler and serves
 * superseded content to crawlers. Reproduced directly in review: after
 * removing `public/llms.txt` from the source, `cp -r` left the standalone copy
 * in place, while remove-then-copy did not.
 *
 * This script removes each destination before copying, so a rebuild always
 * produces the same tree as a clean build, and then asserts the copied tree
 * matches the source exactly — the invariant that actually fails when the
 * destination is stale.
 */
import { cp, readdir, rm, stat } from 'node:fs/promises'
import { join, relative } from 'node:path'
import process from 'node:process'
import { pathToFileURL } from 'node:url'

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

/** Every file below `root`, as sorted paths relative to `root`. */
async function listFiles(root) {
  const found = []
  async function walk(dir) {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name)
      if (entry.isDirectory()) await walk(full)
      else if (entry.isFile()) found.push(relative(root, full))
    }
  }
  await walk(root)
  return found.sort()
}

/**
 * Compare a source tree against its copy. Pure, so the guard that protects
 * production bundles can itself be tested: `extra` is a stale file that a
 * merge-style copy left behind, `missing` is a copy that did not complete.
 */
export function diffTrees(expected, actual) {
  const expectedSet = new Set(expected)
  const actualSet = new Set(actual)
  return {
    extra: [...actual].filter((file) => !expectedSet.has(file)).sort(),
    missing: [...expected].filter((file) => !actualSet.has(file)).sort(),
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

  // The real regression guard: the bundle must be a faithful copy. A stale
  // destination shows up here as extra files, a partial copy as missing ones.
  const [expected, actual] = await Promise.all([listFiles(source), listFiles(destination)])
  const { extra, missing } = diffTrees(expected, actual)
  if (extra.length || missing.length) {
    console.error(`[standalone-assets] ${label} does not match its source.`)
    for (const file of extra) console.error(`  stale/extra: ${file}`)
    for (const file of missing) console.error(`  missing: ${file}`)
    process.exit(1)
  }
}

async function main() {
  if (!(await exists(STANDALONE))) {
    console.error('[standalone-assets] .next/standalone not found — run `next build` first.')
    process.exit(1)
  }

  await copyInto(join(ROOT, '.next', 'static'), join(STANDALONE, '.next', 'static'), '.next/static')
  await copyInto(join(ROOT, 'public'), join(STANDALONE, 'public'), 'public')

  // Defensive assertion, kept because a wrong destination path would produce
  // this shape. A sanity net, not the failure mode described above.
  if (await exists(join(STANDALONE, 'public', 'public'))) {
    console.error('[standalone-assets] unexpected nested public/public in the bundle.')
    process.exit(1)
  }
  if (!(await exists(join(STANDALONE, 'public', 'robots.txt')))) {
    console.error('[standalone-assets] public/robots.txt missing from the bundle.')
    process.exit(1)
  }
  console.log('[standalone-assets] ok — static tree matches source')
}

// Guard against top-level await: the test suite imports `diffTrees` from this
// module under a CommonJS transform, which rejects a module that awaits at the
// top level. Keeping the work inside `main()` makes the file importable.
const invokedDirectly =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href

if (invokedDirectly) {
  main().catch((error) => {
    console.error('[standalone-assets] failed:', error)
    process.exit(1)
  })
}
