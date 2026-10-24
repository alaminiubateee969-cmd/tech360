#!/usr/bin/env node
/**
 * TECH360 — production start wrapper.
 *
 * WHY THIS EXISTS
 * ---------------
 * `npm start` runs `prestart` and then `node .next/standalone/server.js`.
 * Hostinger's Next.js preset manages the server process itself, so whether the
 * npm lifecycle (and therefore the environment preflight) actually runs is NOT
 * verifiable from this repository. If it does not run, a misconfigured
 * production environment boots "successfully" and fails later in confusing
 * ways — or worse, runs without a required secret.
 *
 * This wrapper makes the preflight independent of the process manager: it
 * validates the configuration, refuses preview-only SQLite settings, prints a
 * redacted summary, and only then starts the standalone server in the SAME
 * process (so signals and the port behave exactly as before).
 *
 * Nothing here prints a secret value. Only names and OK/MISSING states.
 *
 * Usage:  node scripts/start-production.mjs
 * Check:  node scripts/start-production.mjs --check   (validate, do not start)
 */
import { existsSync } from 'node:fs'
import { spawn } from 'node:child_process'
import process from 'node:process'

const CHECK_ONLY = process.argv.includes('--check')

function fail(title, lines) {
  console.error(`[startup-config] ${title}`)
  for (const line of lines) console.error(`- ${line}`)
  process.exit(1)
}

// ---------------------------------------------------------------- validation
// The canonical rules live in validate-production-env.mjs; it is executed as a
// child process so there is one source of truth for the policy.
function runPreflight() {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, ['scripts/validate-production-env.mjs'], {
      stdio: 'inherit',
      env: process.env,
    })
    child.on('exit', (code) => resolve(code ?? 1))
    child.on('error', () => resolve(1))
  })
}

function summary() {
  const yes = (name) => (process.env[name]?.trim() ? 'set' : 'MISSING')
  const lines = [
    `NODE_ENV=${process.env.NODE_ENV ?? '(unset)'}`,
    `DATABASE_URL=${process.env.DATABASE_URL ? 'set' : 'MISSING'}`,
    `SESSION_SECRET=${yes('SESSION_SECRET')}`,
    `PORTAL_SECRET=${yes('PORTAL_SECRET')}`,
    `OPS_SECRET=${yes('OPS_SECRET')}`,
    `IDENTITY_HASH_SECRET=${yes('IDENTITY_HASH_SECRET')}`,
    `ZAI_BASE_URL=${yes('ZAI_BASE_URL')} / ZAI_API_KEY=${yes('ZAI_API_KEY')}`,
    `AI_OPS_DRIVER=${process.env.AI_OPS_DRIVER?.trim() || '(default: on)'}`,
    `PREVIEW_SQLITE_URL=${process.env.PREVIEW_SQLITE_URL ? 'SET (refused in production)' : 'not set'}`,
  ]
  console.log('[startup-config] configuration summary (names only, no values):')
  for (const line of lines) console.log(`  ${line}`)
}

async function main() {
  // 1. Preview-only SQLite must never be usable in production. Refuse before
  //    importing the application so a mis-set variable can never serve traffic.
  if (process.env.PREVIEW_SQLITE_URL?.trim()) {
    fail('preview-only configuration is refused in production', [
      'PREVIEW_SQLITE_URL is set. This variable switches Prisma to a local SQLite file',
      'through the development-only libSQL adapter (src/lib/preview-db.ts).',
      'Unset it and provide a mysql:// DATABASE_URL.',
    ])
  }

  // 2. Canonical environment policy.
  const preflight = await runPreflight()
  if (preflight !== 0) {
    fail('production environment validation failed (see the lines above)', [
      'The process is NOT started. Fix the configuration and try again.',
    ])
  }

  summary()

  if (CHECK_ONLY) {
    console.log('[startup-config] --check passed; the server was not started.')
    return
  }

  // 3. Start the real standalone server in this process.
  const server = '.next/standalone/server.js'
  if (!existsSync(server)) {
    fail('the production build is missing', [
      `${server} does not exist. Run "npm run build" first.`,
    ])
  }

  // Next's standalone server reads PORT/HOSTNAME from the environment.
  if (!process.env.PORT) process.env.PORT = '3000'
  if (!process.env.HOSTNAME) process.env.HOSTNAME = '0.0.0.0'

  console.log(`[startup] starting ${server} on ${process.env.HOSTNAME}:${process.env.PORT}`)
  await import(new URL(`../${server}`, import.meta.url).href)
}

main().catch((error) => {
  console.error('[startup] fatal:', error instanceof Error ? error.message : String(error))
  process.exit(1)
})
