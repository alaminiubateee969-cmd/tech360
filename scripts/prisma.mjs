#!/usr/bin/env node
/**
 * TECH360 — Prisma engine preparation + execution wrapper
 * (production build hardening for Hostinger Node.js Web App)
 *
 * WHY THIS EXISTS (verified root cause, see docs/HOSTINGER_DEPLOYMENT.md)
 * ------------------------------------------------------------------------
 * Prisma 6.19.3 lazily downloads native engine binaries into
 * node_modules/@prisma/engines/ (e.g. schema-engine-debian-openssl-1.1.x).
 * The bundled fetch-engine code applies `chmod +x` ONLY while downloading
 * (@prisma/fetch-engine: downloadBinary -> chmodPlusX). If the build
 * environment reuses a node_modules tree where the executable bit was
 * lost — which is exactly what the Hostinger build does (observed log:
 *
 *   Error: Schema engine exited
 *   Command failed with EACCES
 *   .../node_modules/@prisma/engines/schema-engine-debian-openssl-1.1.x
 *   spawn .../schema-engine-debian-openssl-1.1.x EACCES
 *
 * — Prisma reuses the non-executable file as-is (it never re-downloads or
 * re-chmods an existing engine file) and the spawn fails with EACCES.
 *
 * WHAT THIS DOES (deterministic, fail-loud, never masks errors)
 * --------------------------------------------------------------
 * 1. Before running the Prisma CLI: restore executable bits only on native
 *    Prisma engine artifacts in the package/client/cache locations, while
 *    making their containing directories traversable. This covers every
 *    Prisma 6.19.3 engine variant (schema-engine-*, migration-engine-*,
 *    query-engine-*, libquery_engine-*.so.node and the bare cache filenames)
 *    without chmodding unrelated package metadata or the filesystem.
 * 2. Verify that every spawnable native engine actually starts (execve
 *    test). If the executable bit cannot be made effective on the current
 *    filesystem (e.g. a noexec volume), copy the engine to a writable temp
 *    directory and point the Prisma CLI at the copy via the official
 *    PRISMA_SCHEMA_ENGINE_BINARY / PRISMA_MIGRATION_ENGINE_BINARY /
 *    PRISMA_QUERY_ENGINE_BINARY overrides.
 * 3. Execute `prisma <args…>` (same CLI, same arguments as before) with
 *    the corrected environment and propagate its exit code.
 * 4. If the command fails with a spawn-permission (EACCES) error because an
 *    engine materialized during the run (lazy download), repair and retry
 *    exactly once.
 *
 * This script never uses `|| true`, never skips a failing migration, and
 * never touches the database itself — migration semantics are unchanged.
 */

import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(__dirname, '..')

const isWindows = process.platform === 'win32'

/** Engine binaries that Prisma SPAWNS (need the executable bit). */
const SPAWNABLE_ENGINE_RE = /^(schema-engine|migration-engine|query-engine)-/

function log(...args) {
  console.log('[prisma-engine-prep]', ...args)
}

function walkFiles(dir, onFile, onDir) {
  let entries
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true })
  } catch {
    return
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      onDir?.(full)
      walkFiles(full, onFile, onDir)
    } else if (entry.isFile()) {
      onFile?.(full)
    }
  }
}

function chmodSafe(file, mode) {
  if (isWindows) return
  try {
    fs.chmodSync(file, mode)
  } catch (err) {
    log(`warning: chmod ${mode.toString(8)} failed on ${file}: ${err.message}`)
  }
}

/** File names of Prisma engine artifacts (any platform/target variant). */
const ENGINE_FILE_RE = /^(schema-engine|migration-engine|query-engine)(?:-|$)|^libquery_engine-.*\.so\.node$/

/**
 * Restore executable bits in every Prisma engine location that exists.
 * Prisma 6.19.3 materializes engine binaries in up to four places:
 *   node_modules/@prisma/engines/  (schema-engine, libquery_engine)
 *   node_modules/prisma/           (libquery_engine — used by `prisma generate`)
 *   node_modules/.prisma/client/   (generated client + engine)
 *   $XDG_CACHE_HOME/prisma or ~/.cache/prisma  (download cache)
 * Returns the list of engine directory roots that were processed.
 */
function hardenEngineLocations() {
  const roots = []

  const enginesDir = path.join(repoRoot, 'node_modules', '@prisma', 'engines')
  if (fs.existsSync(enginesDir)) roots.push(enginesDir)

  const prismaPkgDir = path.join(repoRoot, 'node_modules', 'prisma')
  if (fs.existsSync(prismaPkgDir)) roots.push(prismaPkgDir)

  const generatedClientDir = path.join(repoRoot, 'node_modules', '.prisma', 'client')
  if (fs.existsSync(generatedClientDir)) roots.push(generatedClientDir)

  // Prisma cache (used as the engine source when present):
  //   $XDG_CACHE_HOME/prisma or ~/.cache/prisma  (e.g. engines/<version>/<target>/…)
  const cacheBase = process.env.XDG_CACHE_HOME || path.join(os.homedir(), '.cache')
  const prismaCache = path.join(cacheBase, 'prisma')
  if (fs.existsSync(prismaCache)) roots.push(prismaCache)

  for (const root of roots) {
    walkFiles(
      root,
      (file) => {
        if (!ENGINE_FILE_RE.test(path.basename(file))) return
        // Only native Prisma engine artifacts are executable; leave metadata,
        // JavaScript, checksums, and other package files untouched.
        chmodSafe(file, 0o755)
      },
      (dir) => chmodSafe(dir, 0o755),
    )
    log(`harden: executable bits restored under ${root}`)
  }

  if (roots.length === 0) {
    log('harden: no engine directories present yet (first run — engines are lazily downloaded by Prisma)')
  }
  return roots
}

/** Collect the spawnable native engine files that currently exist. */
function collectSpawnableEngines(roots) {
  const files = []
  for (const root of roots) {
    walkFiles(root, (file) => {
      if (SPAWNABLE_ENGINE_RE.test(path.basename(file))) files.push(file)
    })
  }
  return [...new Set(files)]
}

/**
 * execve test: can this binary actually be spawned?
 * (A failed spawn — EACCES, ENOEXEC, … — sets result.error.)
 */
function isSpawnable(file) {
  const result = spawnSync(file, [], { timeout: 20000, stdio: 'ignore' })
  return !result.error
}

/**
 * If an engine cannot be executed in place (e.g. a noexec volume where the
 * executable bit is not honored), copy it to a writable temp directory and
 * return the environment overrides that make Prisma use the copy.
 * Returns null when execution cannot be made possible (caller must fail).
 */
function buildEnvOverrides(engines) {
  const overrides = {}
  const tmpDir = path.join(os.tmpdir(), 'tech360-prisma-engines')
  const bad = engines.filter((file) => !isSpawnable(file))
  if (bad.length === 0) return overrides

  fs.mkdirSync(tmpDir, { recursive: true })
  for (const file of bad) {
    const target = path.join(tmpDir, path.basename(file))
    try {
      fs.copyFileSync(file, target)
      chmodSafe(target, 0o755)
    } catch (err) {
      log(`ERROR: cannot copy engine to ${target}: ${err.message}`)
      return null
    }
    if (!isSpawnable(target)) {
      log(`ERROR: engine is not executable even from ${target} — the build filesystem blocks native execution; aborting instead of masking the failure.`)
      return null
    }
    const base = path.basename(target)
    log(`fallback: using executable copy of ${base} from ${tmpDir} (in-place file is not spawnable)`)
    if (base.startsWith('schema-engine-')) {
      overrides.PRISMA_SCHEMA_ENGINE_BINARY = target
      overrides.PRISMA_MIGRATION_ENGINE_BINARY = target
    } else if (base.startsWith('migration-engine-')) {
      overrides.PRISMA_MIGRATION_ENGINE_BINARY = target
    } else if (base.startsWith('query-engine-')) {
      overrides.PRISMA_QUERY_ENGINE_BINARY = target
    }
  }
  return overrides
}

/**
 * Repair engines that materialized during a failed run (lazy download race)
 * and re-derive the overrides. Returns null when repair is impossible.
 */
function repairAfterFailedRun(previousOverrides) {
  const roots = hardenEngineLocations()
  const engines = collectSpawnableEngines(roots)
  if (engines.length === 0) return previousOverrides
  const notSpawnable = engines.filter((file) => !isSpawnable(file))
  if (notSpawnable.length === 0) {
    log('retry: all existing engines are now spawnable')
    return previousOverrides
  }
  log(`retry: ${notSpawnable.length} non-executable engine(s) detected; restoring executable bits…`)
  const overrides = buildEnvOverrides(engines)
  if (overrides === null) {
    log('ERROR: unable to produce executable Prisma engine binaries; failing the build (no masking).')
    return null
  }
  return { ...previousOverrides, ...overrides }
}

function outputOf(result) {
  return Buffer.concat([result.stdout ?? Buffer.alloc(0), result.stderr ?? Buffer.alloc(0)]).toString('utf8')
}

/** True when the failure is a Prisma engine spawn-permission problem. */
function detectEngineSpawnFailure(result) {
  if (result.error) {
    return result.error.code === 'EACCES' || result.error.code === 'EPERM'
  }
  if (result.status === 0) return false
  // The Prisma CLI reports a failed schema-engine spawn as
  // "Command failed with EACCES" / "Error: Schema engine exited".
  return /EACCES/.test(outputOf(result)) || /Schema engine exited/i.test(outputOf(result))
}

function runPrisma(args, envOverrides) {
  const prismaCli = require.resolve('prisma/build/index.js')
  log(`running: prisma ${args.join(' ')}`)
  const result = spawnSync(process.execPath, [prismaCli, ...args], {
    cwd: repoRoot,
    env: { ...process.env, ...envOverrides },
    stdio: ['inherit', 'pipe', 'pipe'],
    maxBuffer: 256 * 1024 * 1024,
  })
  if (result.error) {
    if (result.error.code === 'ERR_CHILD_PROCESS_STDIO_MAXBUFFER') {
      console.error('[prisma-engine-prep] ERROR: Prisma CLI output exceeded the capture buffer.')
      process.exit(1)
    }
    console.error(`[prisma-engine-prep] ERROR: failed to start the Prisma CLI: ${result.error.message}`)
    process.exit(result.error.code === 'ENOENT' ? 127 : 1)
  }
  // Forward the captured output exactly as the CLI produced it.
  if (result.stdout?.length) process.stdout.write(result.stdout)
  if (result.stderr?.length) process.stderr.write(result.stderr)
  return result
}

function main() {
  const args = process.argv.slice(2)
  if (args.length === 0 || args[0] === '--help' || args[0] === '-h') {
    console.log('Usage: node scripts/prisma.mjs <prisma-arguments…>')
    console.log('Example: node scripts/prisma.mjs migrate deploy')
    process.exit(args.length === 0 ? 1 : 0)
  }

  // 1) Deterministic permission repair for whatever exists right now.
  const roots = hardenEngineLocations()
  const engines = collectSpawnableEngines(roots)
  if (engines.length > 0) {
    const notSpawnable = engines.filter((file) => !isSpawnable(file))
    if (notSpawnable.length > 0) {
      log(`detected ${notSpawnable.length} non-executable engine(s); preparing fallback copies…`)
      for (const file of notSpawnable) log(`  - ${path.relative(repoRoot, file)}`)
    } else {
      log(`${engines.length} engine binary(ies) present and spawnable`)
    }
  }
  let overrides = buildEnvOverrides(engines)
  if (overrides === null) process.exit(1)

  // 2) Run the real Prisma CLI with the (possibly empty) overrides.
  let result = runPrisma(args, overrides)

  // 3) Bounded one-shot retry for the lazy-download race: if the command
  //    failed with a spawn-permission error and engines materialized during
  //    the run, repair them and retry exactly once.
  if (result.status !== 0 && detectEngineSpawnFailure(result)) {
    log('Prisma command failed with a spawn-permission (EACCES) error; repairing engines and retrying once…')
    const retryOverrides = repairAfterFailedRun(overrides)
    if (retryOverrides === null) process.exit(1)
    result = runPrisma(args, retryOverrides)
  }

  process.exit(result.status ?? 1)
}

main()
