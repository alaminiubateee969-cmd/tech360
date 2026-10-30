#!/usr/bin/env node
/**
 * TECH360 — deployment installer / preflight
 * ==========================================
 *
 * Replaces the "install.php wizard" requested in the requirements with the
 * equivalent capability for THIS stack. The application is a Next.js + Prisma
 * + MySQL server; a PHP file cannot configure it, and shipping an `install.php`
 * would be a dead file that only created a false impression of a working
 * installer. This script performs the same four installer duties through the
 * runtime the application actually uses:
 *
 *   1. System configuration   — validate required environment (never prints values)
 *   2. Database setup         — apply committed Prisma migrations
 *   3. Admin creation         — run the idempotent seed (SUPER_ADMIN from env)
 *   4. Integration setup      — report SMTP / WhatsApp / AI configuration state
 *
 * Modes
 * -----
 *   node scripts/install.mjs --check     (default) report only, no mutation
 *   node scripts/install.mjs --migrate   apply pending migrations, then report
 *   node scripts/install.mjs --seed      create/refresh the SUPER_ADMIN, then report
 *   node scripts/install.mjs --all       migrate + seed, then report
 *
 * Exit codes
 * ----------
 *   0  every required check passed
 *   1  a required check failed (details printed, no secret values)
 *
 * This script never edits application code, never drops data, never seeds demo
 * records (the seed is idempotent and creates only required reference data),
 * and never claims an integration is live just because a variable is present.
 */

import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'

const ROOT = path.resolve(import.meta.dirname, '..')
const args = new Set(process.argv.slice(2))

const MODE = {
  migrate: args.has('--migrate') || args.has('--all'),
  seed: args.has('--seed') || args.has('--all'),
  checkOnly: !args.has('--migrate') && !args.has('--seed') && !args.has('--all'),
}

const results = []
function pass(label, detail = '') {
  results.push({ ok: true, label, detail })
}
function fail(label, detail = '') {
  results.push({ ok: false, label, detail })
}
function skip(label, detail = '') {
  results.push({ ok: true, label: `${label} (skipped)`, detail, skipped: true })
}
function has(name) {
  return Boolean((process.env[name] ?? '').trim())
}
function header(title) {
  process.stdout.write(`\n=== ${title} ===\n`)
}

// ---------------------------------------------------------------------------
// 1. System configuration
// ---------------------------------------------------------------------------
header('1/4 System configuration')

const REQUIRED_ENV = [
  ['DATABASE_URL', 'MySQL connection string (mysql://user:pass@host:port/db)'],
  ['SESSION_SECRET', 'session signing secret (32+ random characters)'],
  ['PORTAL_SECRET', 'client-portal code signing secret'],
  ['OPS_SECRET', 'operations-loop shared secret'],
  ['APP_PUBLIC_URL', 'canonical public URL (https://bdtech360.com)'],
  ['APP_ORIGIN', 'canonical origin used for CORS/redirects'],
]

const missing = REQUIRED_ENV.filter(([name]) => !has(name)).map(([name]) => name)
if (missing.length === 0) {
  pass('required environment variables present')
} else {
  fail('required environment variables missing', missing.join(', '))
}

const nodeMajor = Number(process.versions.node.split('.')[0])
if (nodeMajor >= 22 && nodeMajor < 23) {
  pass(`Node.js ${process.versions.node} meets the engines range (>=22 <23)`)
} else {
  fail(`Node.js ${process.versions.node} is outside the supported range (>=22 <23)`)
}

const dbUrl = (process.env.DATABASE_URL ?? '').trim()
if (dbUrl.startsWith('mysql://') || dbUrl.startsWith('mysqls://')) {
  pass('DATABASE_URL targets MySQL')
} else if (dbUrl) {
  fail('DATABASE_URL is not a mysql:// URL', 'SQLite and other engines are not supported in production')
} else {
  fail('DATABASE_URL is not set')
}

if ((process.env.PREVIEW_SQLITE_URL ?? '').trim()) {
  fail('PREVIEW_SQLITE_URL is set', 'this is development-only and must be unset in production')
} else {
  pass('no development-only SQLite override configured')
}

for (const secret of ['SESSION_SECRET', 'PORTAL_SECRET', 'OPS_SECRET']) {
  const value = (process.env[secret] ?? '').trim()
  if (!value) continue
  if (value.length < 32) fail(`${secret} is shorter than 32 characters`, 'generate a longer random value')
  else if (/^(changeme|secret|password|test|dev)/i.test(value)) fail(`${secret} looks like a placeholder value`)
  else pass(`${secret} length and format look acceptable`)
}

const nodeModules = path.join(ROOT, 'node_modules')
if (fs.existsSync(nodeModules)) pass('dependencies installed (node_modules present)')
else fail('node_modules missing', 'run `npm ci` before installing')

const standalone = path.join(ROOT, '.next', 'standalone', 'server.js')
if (fs.existsSync(standalone)) pass('production build present (.next/standalone/server.js)')
else
  skip(
    'production build not found',
    'run `npm run build` before `npm start`; the installer does not build for you',
  )

// ---------------------------------------------------------------------------
// 2. Database setup
// ---------------------------------------------------------------------------
header('2/4 Database setup')

const migrationsDir = path.join(ROOT, 'prisma', 'migrations')
if (fs.existsSync(migrationsDir)) {
  const count = fs.readdirSync(migrationsDir).filter((entry) => fs.statSync(path.join(migrationsDir, entry)).isDirectory()).length
  pass(`${count} committed migration director${count === 1 ? 'y' : 'ies'} found`)
} else {
  fail('prisma/migrations directory missing')
}

if (MODE.migrate) {
  if (!dbUrl.startsWith('mysql://')) {
    fail('migrations not applied', 'DATABASE_URL must be a valid MySQL URL first')
  } else {
    process.stdout.write('Running `prisma migrate deploy` (no schema reset, no data drop)…\n')
    const run = spawnSync(process.execPath, [path.join(ROOT, 'scripts', 'prisma.mjs'), 'migrate', 'deploy'], {
      cwd: ROOT,
      stdio: 'inherit',
      env: process.env,
    })
    if (run.status === 0) pass('migrations applied')
    else fail('migration failed', `prisma exited with code ${run.status}`)
  }
} else {
  skip('migration', 'run with --migrate to apply pending migrations')
}

// ---------------------------------------------------------------------------
// 3. Admin creation
// ---------------------------------------------------------------------------
header('3/4 Super Admin creation')

if (!has('ADMIN_EMAIL') || !has('ADMIN_PASSWORD')) {
  fail('ADMIN_EMAIL and ADMIN_PASSWORD are required to create the first Super Admin')
} else {
  const adminEmail = (process.env.ADMIN_EMAIL ?? '').trim()
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(adminEmail)) fail('ADMIN_EMAIL is not a valid email address')
  else pass(`ADMIN_EMAIL is valid (${adminEmail.replace(/^(.).*(@.*)$/, '$1***$2')})`)

  const password = process.env.ADMIN_PASSWORD ?? ''
  if (password.length < 12) fail('ADMIN_PASSWORD must be at least 12 characters')
  else pass('ADMIN_PASSWORD meets the minimum length')
}

if (MODE.seed) {
  if (!has('ADMIN_EMAIL') || !has('ADMIN_PASSWORD')) {
    fail('seed not run', 'ADMIN_EMAIL and ADMIN_PASSWORD must be set first')
  } else {
    process.stdout.write('Running the idempotent seed (reference data + SUPER_ADMIN upsert)…\n')
    const run = spawnSync(path.join(ROOT, 'node_modules', '.bin', 'tsx'), [path.join(ROOT, 'prisma', 'seed.ts')], {
      cwd: ROOT,
      stdio: 'inherit',
      env: process.env,
    })
    if (run.status === 0) pass('seed completed (SUPER_ADMIN upserted, reference data refreshed)')
    else fail('seed failed', `tsx exited with code ${run.status}`)
  }
} else {
  skip('seed', 'run with --seed to create/refresh the SUPER_ADMIN')
}

// ---------------------------------------------------------------------------
// 4. Integrations — configuration state only, never an "ACTIVE" claim
// ---------------------------------------------------------------------------
header('4/4 Integration configuration')

function reportIntegration(label, requiredVars, notes) {
  const present = requiredVars.filter(has)
  if (present.length === 0) {
    results.push({
      ok: true,
      label: `${label}: not configured`,
      detail: 'the application will report this integration as unavailable',
      skipped: true,
    })
    return
  }
  if (present.length < requiredVars.length) {
    const absent = requiredVars.filter((name) => !has(name))
    fail(`${label}: partially configured`, `missing ${absent.join(', ')}`)
    return
  }
  results.push({
    ok: true,
    label: `${label}: variables present`,
    detail: `${notes} This is a configuration check, not a provider acceptance test.`,
    skipped: true,
  })
}

reportIntegration('SMTP email', ['SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASS', 'SMTP_FROM'], 'Send a real test email to confirm delivery.')
reportIntegration('WhatsApp Cloud API', ['WHATSAPP_TOKEN', 'WHATSAPP_PHONE_ID', 'WHATSAPP_VERIFY_TOKEN'], 'Meta template approval and a live webhook test are still required.')
reportIntegration('AI provider', ['ZAI_BASE_URL', 'ZAI_API_KEY'], 'Run one agent from the admin console to confirm inference.')
reportIntegration('AI Gateway', ['AI_GATEWAY_APPS'], 'Verify /api/ai-gateway/ready returns 200 before relying on it.')

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------
const failures = results.filter((result) => !result.ok)
const advisories = results.filter((result) => result.ok && result.skipped)
const clean = results.filter((result) => result.ok && !result.skipped)

header('Summary')
for (const item of clean) process.stdout.write(`  PASS  ${item.label}${item.detail ? ` — ${item.detail}` : ''}\n`)
for (const item of advisories) process.stdout.write(`  NOTE  ${item.label}${item.detail ? ` — ${item.detail}` : ''}\n`)
for (const item of failures) process.stdout.write(`  FAIL  ${item.label}${item.detail ? ` — ${item.detail}` : ''}\n`)

process.stdout.write(
  `\n${clean.length} passed, ${advisories.length} advisory, ${failures.length} failed.\n` +
    (MODE.checkOnly ? 'Report-only mode: no database or user changes were made.\n' : ''),
)

if (failures.length > 0) {
  process.stdout.write('\nInstallation is NOT complete. Fix the failures above and re-run.\n')
  process.exit(1)
}

process.stdout.write('\nConfiguration checks passed. Next: `npm run build`, then `npm start`.\n')
process.stdout.write('Runtime health is reported by GET /api/health on the deployed host.\n')
process.exit(0)
