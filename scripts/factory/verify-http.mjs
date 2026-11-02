/**
 * Software Factory Control Center — live HTTP acceptance runner.
 *
 * Requires a running dev/preview server with a disposable database:
 *   PREVIEW_SQLITE_URL=file:$PWD/.preview/demo.db PORTAL_OTP=off npm run dev
 *   node scripts/factory/verify-http.mjs
 *
 * It logs in as the seeded SUPER_ADMIN, exercises the real wizard flow and
 * the guarded /api/factory/* endpoints, and fails loudly on any mismatch.
 * No destructive or production operation is performed.
 */
import assert from 'node:assert/strict'

const BASE = process.env.SFCC_BASE_URL ?? 'http://127.0.0.1:3000'
const EMAIL = process.env.SFCC_EMAIL ?? 'admin@tech360.local'
const PASSWORD = process.env.SFCC_PASSWORD ?? 'Tech360-Demo-2026!'

let sessionCookie = ''
let csrf = ''
const checks = []

function check(label, condition, detail = '') {
  checks.push({ label, ok: Boolean(condition), detail })
  console.log(`${condition ? 'PASS' : 'FAIL'} ${label}${detail ? ` — ${String(detail).slice(0, 160)}` : ''}`)
}

async function request(method, path, body, { authenticated = true, csrfToken = true } = {}) {
  const headers = {}
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  if (authenticated && sessionCookie) headers.Cookie = sessionCookie
  if (authenticated && csrfToken && method !== 'GET' && csrf) headers['x-csrf-token'] = csrf
  const res = await fetch(`${BASE}${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) })
  const text = await res.text()
  let data = {}
  try { data = text ? JSON.parse(text) : {} } catch { data = { raw: text } }
  return { status: res.status, data, headers: res.headers, text }
}

async function login() {
  const res = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  })
  const body = await res.json()
  assert.equal(res.status, 200, `login failed: ${JSON.stringify(body)}`)
  const setCookies = res.headers.getSetCookie ? res.headers.getSetCookie() : [res.headers.get('set-cookie') ?? '']
  for (const c of setCookies) {
    const pair = c.split(';')[0].trim()
    if (pair.startsWith('t360_session=')) sessionCookie = `${sessionCookie ? `${sessionCookie}; ` : ''}${pair}`
    if (pair.startsWith('t360_csrf=')) {
      csrf = pair.slice('t360_csrf='.length)
      sessionCookie = `${sessionCookie ? `${sessionCookie}; ` : ''}${pair}`
    }
  }
  assert.ok(csrf, 'CSRF cookie was not issued')
  check('authenticated SUPER_ADMIN session', body.user?.role === 'SUPER_ADMIN', body.user?.role)
}

async function main() {
  await login()
  const denied = await request('GET', '/api/factory/overview', undefined, { authenticated: false })
  check('unauthenticated request denied', denied.status === 401, denied.status)
  const overview = await request('GET', '/api/factory/overview')
  check('overview returns real counts', overview.status === 200 && typeof overview.data.counts?.companies === 'number', JSON.stringify(overview.data.counts))
  const bootstrap = await request('POST', '/api/factory/bootstrap', {})
  check('private library bootstrap', bootstrap.status === 200 && bootstrap.data.ok === true, bootstrap.data.ok)

  const catalog = await request('POST', '/api/factory/companies', { action: 'catalog' })
  check('approved template catalog', catalog.status === 200 && catalog.data.templates?.length >= 1, catalog.data.templates?.length)
  const tpl = (catalog.data.templates ?? []).find((t) => t.code === 'company-in-a-box') ?? catalog.data.templates[0]
  const versionByCode = Object.fromEntries((catalog.data.modules ?? []).map((m) => [m.code, m.version]))
  const slug = `verify-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`
  const definition = {
    identity: { name: 'Verification Company Ltd', slug, kind: 'CLIENT', industry: 'Software', isolationModel: 'SHARED_TENANT', deploymentModel: 'SHARED_TENANT', environment: 'STAGING', domain: `${slug}.example.test` },
    template: { code: tpl.code, version: tpl.version?.version ?? tpl.currentVersion },
    modules: (tpl.modules ?? []).map((m) => ({ code: m.moduleId, version: versionByCode[m.moduleId] ?? 1, enabled: true })),
    branding: { primaryColor: '#123456', accentColor: '#009FE3', productName: 'Verification Suite' },
    organization: { departments: ['Operations'], teams: ['Core'], users: [{ email: `owner-${slug}@example.test`, role: 'COMPANY_ADMIN' }] },
    workflows: { pipelines: ['New', 'Won'], approvalChains: ['Manager'], slaHours: 24, rules: [] },
    policies: { retentionDays: 180, backupPolicy: 'DAILY' },
    integrations: [], navigation: ['Overview', 'Contacts'], customFields: [], extensions: [],
  }
  const preview = await request('POST', '/api/factory/companies', { action: 'preview', definition })
  check('configuration validation passes', preview.status === 200 && preview.data.ok === true, JSON.stringify(preview.data.errors))
  const invalid = await request('POST', '/api/factory/companies', { action: 'preview', definition: { ...definition, identity: { ...definition.identity, name: '' } } })
  check('invalid definition rejected', invalid.status === 200 && invalid.data.ok === false, JSON.stringify(invalid.data.errors))
  const provision = await request('POST', '/api/factory/companies', { action: 'provision', definition })
  check('isolated provisioning with real acceptance steps', provision.status === 201 && provision.data.ok === true, JSON.stringify(provision.data.errors))
  const { companyId, applicationId, jobId } = provision.data
  assert.ok(companyId && applicationId && jobId, 'provisioning did not return identifiers')

  const companies = await request('GET', '/api/factory/companies')
  const row = (companies.data.companies ?? []).find((c) => c.id === companyId)
  check('registry lists the new company', Boolean(row))
  check('tenant identity secret never exposed', row && !('tenantKey' in row))
  const detail = await request('GET', `/api/factory/companies/${companyId}`)
  check('company detail is registry metadata', detail.status === 200 && detail.data.company?.id === companyId && !('tenantKey' in (detail.data.company ?? {})))

  const submit = await request('POST', '/api/factory/applications', { action: 'submit', applicationId })
  check('submit for approval', submit.status === 200 && submit.data.ok === true, submit.data.reason)
  const activate = await request('POST', '/api/factory/applications', { action: 'activate', applicationId, evidence: '' })
  check('authorized activation', activate.status === 200 && activate.data.ok === true, activate.data.reason)
  const app = await request('GET', `/api/factory/applications/${applicationId}`)
  check('application really LIVE', app.data.application?.status === 'LIVE', app.data.application?.status)

  const record = await request('POST', '/api/factory/records', { companyId, applicationId, moduleKey: 'contacts', entityType: 'CONTACT', data: { name: 'Verified Contact', email: 'verify@example.test' } })
  check('company-scoped record created', record.status === 201 && record.data.ok === true, record.data.reason)
  const records = await request('GET', `/api/factory/records?applicationId=${applicationId}&companyId=${companyId}`)
  check('scoped records readable', records.status === 200 && records.data.ok === true, records.data.data?.total)
  const upload = await request('POST', '/api/factory/files', { companyId, applicationId, name: 'note.txt', mimeType: 'text/plain', contentBase64: Buffer.from('verification private document').toString('base64') })
  check('scoped file uploaded', upload.status === 201 && upload.data.ok === true, upload.data.reason)
  const fileId = upload.data.data?.id
  if (fileId) {
    const download = await request('GET', `/api/factory/files?companyId=${companyId}&fileId=${fileId}&download=1`)
    check('secure file download', download.status === 200 && download.text.includes('verification private document'))
  }
  const report = await request('GET', `/api/factory/reports?companyId=${companyId}`)
  check('company report scoped', report.status === 200 && report.data.ok === true)
  const job = await request('POST', '/api/factory/jobs', { companyId, jobId })
  check('company-scoped background job', job.status === 200 && job.data.ok === true, job.data.reason)
  const jobs = await request('GET', '/api/factory/jobs')
  const original = (jobs.data.jobs ?? []).find((j) => j.id === jobId)
  check('provisioning acceptance evidence preserved', Boolean(original && original.steps.includes('acceptance.config')))
  const health = await request('POST', '/api/factory/monitoring', { applicationId })
  check('real health check', health.status === 200 && health.data.status === 'HEALTHY', health.data.status)
  const backup = await request('POST', '/api/factory/backups', { action: 'create', applicationId, kind: 'FULL' })
  const backupId = backup.data.backup?.id
  check('verified backup created', backup.status === 201 && Boolean(backupId))
  if (backupId) {
    const verify = await request('POST', '/api/factory/backups', { action: 'verify', backupId })
    check('backup integrity verified', verify.status === 200 && verify.data.ok === true, JSON.stringify(verify.data.errors))
    const exported = await request('GET', `/api/factory/backups?download=${backupId}`)
    check('portable archive exported', exported.status === 200 && exported.text.includes('restoreInstructions'))
  }
  const deniedScope = await request('GET', '/api/factory/reports?companyId=company-that-does-not-exist')
  check('unknown company scope denied', deniedScope.status === 403, deniedScope.status)

  for (const path of [
    '/api/factory/templates', '/api/factory/modules', '/api/factory/applications', '/api/factory/jobs',
    '/api/factory/releases', '/api/factory/integrations', '/api/factory/monitoring', '/api/factory/backups',
    '/api/factory/engineering', '/api/factory/audit', '/api/factory/docs',
  ]) {
    const r = await request('GET', path)
    check(`GET ${path}`, r.status === 200, r.status)
  }
  const cr = await request('POST', '/api/factory/engineering', { action: 'create', title: 'Verification change request', details: 'Created by the HTTP acceptance runner', type: 'CHANGE' })
  check('engineering change request', cr.status === 201 && Boolean(cr.data.request?.id))
  const page = await fetch(`${BASE}/admin/factory-control`, { headers: { Cookie: sessionCookie } })
  check('control center page compiles', page.status === 200, page.status)

  const failed = checks.filter((c) => !c.ok)
  console.log(`\nSUMMARY ${checks.length - failed.length}/${checks.length} passed`)
  if (failed.length) {
    console.error('FAILED:', failed.map((f) => f.label).join(', '))
    process.exitCode = 1
  }
}

main().catch((error) => { console.error('HTTP verification failed:', error); process.exitCode = 1 })
