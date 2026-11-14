#!/usr/bin/env node
/**
 * TECH360 Master SOP v1.0 evidence collector.
 *
 * This is deliberately read-only. It never reads or prints secret values, never
 * mutates a database, and never promotes configuration presence to provider
 * acceptance. Use --live only from an external network that can reach production.
 */
import { access, readFile, readdir, stat } from 'node:fs/promises'
import { execFileSync } from 'node:child_process'
import process from 'node:process'

const ROOT = new URL('../', import.meta.url)
const args = new Set(process.argv.slice(2))
const wantsJson = args.has('--json')
const live = args.has('--live')
const strict = args.has('--strict')

const exists = async path => access(new URL(path, ROOT)).then(() => true, () => false)
const text = path => readFile(new URL(path, ROOT), 'utf8')
const command = (...argv) => {
  try {
    return execFileSync(argv[0], argv.slice(1), { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim()
  } catch {
    return null
  }
}
const result = (id, area, status, evidence, action = null) => ({ id, area, status, evidence, ...(action ? { action } : {}) })

const packageJson = JSON.parse(await text('package.json'))
const schema = await text('prisma/schema.prisma')
const migrationEntries = await readdir(new URL('prisma/migrations/', ROOT), { withFileTypes: true })
const envExample = await text('.env.example')
const envNames = envExample.split(/\r?\n/).map(line => line.match(/^([A-Z][A-Z0-9_]*)=$/)?.[1]).filter(Boolean)
const head = command('git', 'rev-parse', 'HEAD') ?? 'UNKNOWN'
const branch = command('git', 'branch', '--show-current') ?? 'UNKNOWN'
const remote = command('git', 'remote', 'get-url', 'origin') ?? 'UNKNOWN'
const modelCount = (schema.match(/^model\s+/gm) ?? []).length
const migrationCount = migrationEntries.filter(entry => entry.isDirectory()).length
const requiredDocs = [
  'DEPLOYMENT.md',
  'docs/HOSTINGER_DEPLOYMENT.md',
  'docs/HOSTINGER_ENVIRONMENT_VARIABLES.md',
  'docs/OPERATIONS_GUIDEBOOK.md',
  'docs/BACKUP_AND_RESTORE.md',
  'docs/SECURITY_AUDIT_REPORT.md',
  'docs/TEST_AND_QA_REPORT.md',
]
const missingDocs = []
for (const path of requiredDocs) if (!(await exists(path))) missingDocs.push(path)

const checks = [
  result('SRC-01', 'Source identity', head !== 'UNKNOWN' && remote !== 'UNKNOWN' ? 'PASS' : 'FAIL', `${remote} @ ${head} on ${branch}`),
  result('SRC-02', 'Repository license', await exists('LICENSE') || await exists('LICENSE.md') ? 'PASS' : 'BLOCKED', 'No root LICENSE file is present.', 'Repository owner must select and approve a license; public visibility does not grant commercial reuse rights.'),
  result('SRC-03', 'Release identity', command('git', 'tag', '--points-at', 'HEAD') ? 'PASS' : 'BLOCKED', `Application version ${packageJson.version}; HEAD has no Git tag.`, 'Owner must approve and create the production release/tag after acceptance.'),
  result('ARC-01', 'Production architecture', /provider\s*=\s*"mysql"/.test(schema) ? 'PASS' : 'FAIL', `Next.js ${packageJson.dependencies.next}; Node ${packageJson.engines.node}; Prisma ${packageJson.dependencies['@prisma/client']}; MySQL; ${modelCount} models; ${migrationCount} migrations.`),
  result('ENV-01', 'Environment register', envNames.length > 0 ? 'PASS' : 'FAIL', `${envNames.length} value-free variable names are registered in .env.example.`),
  result('SEC-01', 'Secret handling', envExample.split(/\r?\n/).every(line => !line || line.startsWith('#') || /^[A-Z][A-Z0-9_]*=$/.test(line)) ? 'PASS' : 'FAIL', '.env.example contains names with empty values only; production validator is fail-closed.'),
  result('DB-01', 'Database schema and migrations', modelCount > 0 && migrationCount > 0 ? 'PASS' : 'FAIL', `${modelCount} Prisma models and ${migrationCount} migration directories; production provider is MySQL.`),
  result('DB-02', 'Production backup and restore', 'BLOCKED', 'Backup and isolated restore-drill tooling exists, but repository evidence does not prove a current production dump or successful production-host drill.', 'Run the documented host backup and restore drill; retain last-run.json and last-drill.json outside the web root.'),
  result('OPS-01', 'Monitoring and alerts', 'BLOCKED', 'Health, deep-health, metrics, audit/error logs, backup evidence and operations views exist; active external alert routing is not provable from source.', 'Owner must provide uptime monitor, alert destination, SSL-expiry alert and escalation evidence.'),
  result('INT-01', 'External integrations', 'BLOCKED', 'Adapters fail closed and expose honest states. Live/sandbox transactions, provider approvals and credential rotation cannot be certified from source.', 'Authorize and test each applicable provider separately; never submit credentials to Git or chat.'),
  result('DEP-01', 'Hostinger deployment identity', 'BLOCKED', 'Source cannot prove the exact SHA currently running in Hostinger.', 'Capture hPanel repository/branch/SHA, Node 22, build command, start command, environment-name inventory and runtime logs.'),
  result('GOV-01', 'Protected release governance', 'BLOCKED', 'Repository code cannot prove required branch reviews/status checks.', 'Enable and verify main branch protection/rulesets with required CI and approval.'),
  result('DOC-01', 'Documentation set', missingDocs.length === 0 ? 'PASS' : 'FAIL', missingDocs.length === 0 ? `${requiredDocs.length} required operational documents found.` : `Missing: ${missingDocs.join(', ')}`),
  result('ACC-01', 'Final production acceptance', 'BLOCKED', 'Critical external evidence remains unresolved. Production Ready must not be declared.', 'Close every BLOCKED critical gate and record owner acceptance.'),
]

const liveChecks = []
async function probe(id, url, options = {}) {
  const started = Date.now()
  try {
    const response = await fetch(url, { redirect: options.redirect ?? 'manual', signal: AbortSignal.timeout(15_000) })
    const body = (await response.text()).slice(0, 2_000)
    liveChecks.push({ id, url, status: response.status, location: response.headers.get('location'), contentType: response.headers.get('content-type'), latencyMs: Date.now() - started, body })
  } catch (error) {
    liveChecks.push({ id, url, error: error instanceof Error ? error.message : String(error), latencyMs: Date.now() - started })
  }
}
if (live) {
  await Promise.all([
    probe('LIVE-HTTP', 'http://bdtech360.com/'),
    probe('LIVE-APEX', 'https://bdtech360.com/', { redirect: 'follow' }),
    probe('LIVE-WWW', 'https://www.bdtech360.com/'),
    probe('LIVE-HEALTH', 'https://bdtech360.com/api/health', { redirect: 'follow' }),
    probe('LIVE-FEATURES', 'https://bdtech360.com/api/features', { redirect: 'follow' }),
    probe('LIVE-PUBLIC-API', 'https://bdtech360.com/api/pipeline/public', { redirect: 'follow' }),
    probe('LIVE-GATEWAY-READY', 'https://bdtech360.com/api/ai-gateway/ready', { redirect: 'follow' }),
  ])
}

const report = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  masterSopVersion: '1.0',
  repository: { remote, branch, head, applicationVersion: packageJson.version },
  inventory: { nodeRange: packageJson.engines.node, models: modelCount, migrations: migrationCount, environmentVariables: envNames.length },
  verdict: checks.some(item => item.status === 'FAIL') ? 'NOT_READY_FAILURES' : checks.some(item => item.status === 'BLOCKED') ? 'NOT_PRODUCTION_READY_BLOCKED' : 'PRODUCTION_READY_CANDIDATE',
  checks,
  liveChecks,
  safety: 'Read-only evidence collection. Secret values are never inspected or emitted.',
}

if (wantsJson) {
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`)
} else {
  console.log(`TECH360 Master SOP v1.0 readiness — ${report.verdict}`)
  console.log(`Source: ${remote} @ ${head} (${branch})`)
  for (const item of checks) console.log(`${item.status.padEnd(7)} ${item.id.padEnd(8)} ${item.area}: ${item.evidence}`)
  if (live) {
    console.log('\nLive probes:')
    for (const item of liveChecks) console.log(`${item.id.padEnd(20)} ${item.status ?? 'ERROR'} ${item.location ?? item.error ?? ''}`)
  }
}

if (strict && report.verdict !== 'PRODUCTION_READY_CANDIDATE') process.exitCode = 2
