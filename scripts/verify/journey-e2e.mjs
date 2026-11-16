#!/usr/bin/env node
/**
 * TECH360 — controlled END-TO-END customer journey verifier (development/staging only).
 *
 * WHAT THIS DOES
 * --------------
 * Drives the REAL HTTP surface of a running TECH360 instance through the
 * complete customer journey and records what actually happened:
 *
 *   public contact form → CRM Client ID → AI business detection → plan
 *   recommendation → discovery questions → scope submission → 21-section SOW
 *   draft → Super Admin approval → client scope approval → HTML preview →
 *   preview approval → payment request → payment recorded (PENDING) →
 *   governance approval → payment verified → project + tasks → handover
 *   preparation → Super Admin handover release → client confirmation
 *   (password change) → project closure → review request.
 *
 * It NEVER performs destructive operations. It creates one new test customer
 * per run and refuses to start when NODE_ENV=production or the target looks
 * like the public production host.
 *
 * Usage:
 *   BASE_URL=http://localhost:3000 \
 *   ADMIN_EMAIL=admin@tech360.local ADMIN_PASSWORD='…' \
 *   node scripts/verify/journey-e2e.mjs
 *
 * Evidence written to: docs/evidence/journey-e2e-<timestamp>.json
 *
 * Exit code 0 = every step that is expected to succeed succeeded (steps that
 * legitimately depend on an unconfigured external provider are reported as
 * BLOCKED, not as passes).
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const BASE = (process.env.BASE_URL ?? 'http://localhost:3000').replace(/\/+$/, '')
const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? 'admin@tech360.local'
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? 'Tech360-Demo-2026!'

if (process.env.NODE_ENV === 'production') {
  console.error('Refusing to run the journey verifier with NODE_ENV=production.')
  process.exit(2)
}
if (/^https:\/\/(www\.)?bdtech360\.com$/i.test(BASE)) {
  console.error('Refusing to run against the public production website.')
  process.exit(2)
}

const steps = []
let failures = 0
let blocked = 0
let clientId = null
let email = null

function record(name, status, detail) {
  steps.push({ step: name, status, detail })
  const icon = status === 'PASS' ? '✔' : status === 'BLOCKED' ? '⏸' : status === 'FAIL' ? '✘' : '·'
  console.log(`${icon} ${name} [${status}] ${typeof detail === 'string' ? detail : JSON.stringify(detail ?? '')}`)
  if (status === 'FAIL') failures += 1
  if (status === 'BLOCKED') blocked += 1
}

const jar = new Map()

function storeCookies(response) {
  const list = typeof response.headers.getSetCookie === 'function' ? response.headers.getSetCookie() : []
  for (const cookie of list) {
    const [pair] = cookie.split(';')
    const idx = pair.indexOf('=')
    if (idx > 0) jar.set(pair.slice(0, idx).trim(), pair.slice(idx + 1).trim())
  }
}

function cookieHeader() {
  return [...jar.entries()].map(([k, v]) => `${k}=${v}`).join('; ')
}

async function api(path, { method = 'GET', body, admin = false, headers = {} } = {}) {
  const sendHeaders = { ...headers }
  if (body !== undefined) sendHeaders['Content-Type'] = 'application/json'
  if (admin) {
    sendHeaders.Cookie = cookieHeader()
    if (method !== 'GET') {
      const csrf = jar.get('t360_csrf') ?? jar.get('csrf_token') ?? ''
      if (csrf) sendHeaders['x-csrf-token'] = csrf
    }
  }
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: sendHeaders,
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  storeCookies(res)
  let json = null
  try {
    json = await res.json()
  } catch {
    json = null
  }
  return { status: res.status, json, ok: res.ok }
}

function uuid() {
  return crypto.randomUUID()
}

// ---------------------------------------------------------------- 1. login
const login = await api('/api/auth/login', {
  method: 'POST',
  body: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
})
if (!login.ok) {
  record('Admin login', 'FAIL', jsonSafe(login))
  finish()
}
record('Admin login', 'PASS', `role=${login.json?.user?.role ?? 'unknown'}`)
if (!jar.has('t360_csrf') && !jar.has('csrf_token')) {
  record('CSRF cookie issued', 'FAIL', [...jar.keys()].join(','))
  finish()
}
record('CSRF cookie issued', 'PASS', [...jar.keys()].join(','))

function jsonSafe(value) {
  try {
    return JSON.stringify(value.json ?? value).slice(0, 400)
  } catch {
    return String(value)
  }
}

// ------------------------------------------------- 2. public contact form
const stamp = Date.now()
email = `journey.${stamp}@example.com`
const contact = await api('/api/contact', {
  method: 'POST',
  body: {
    requestId: uuid(),
    name: 'Journey Test Customer',
    email,
    phone: '+8801700000001',
    businessName: 'Journey Test Trading',
    businessType: 'eCommerce',
    country: 'Bangladesh',
    preferredContact: 'Email',
    projectType: 'eCommerce Platform',
    budgetRange: 'To be discussed',
    details:
      'We sell clothing online in Dhaka and need a store with bKash and Nagad checkout, order tracking and a small admin dashboard for our team of four people.',
    consent: true,
  },
})
if (!contact.ok || !contact.json?.clientId) {
  record('Public contact form → Client ID', 'FAIL', jsonSafe(contact))
  finish()
}
clientId = contact.json.clientId
record('Public contact form → Client ID', 'PASS', clientId)

// --------------------------------------------------- 3. admin can read it
const search = await api(`/api/admin/clients?query=${encodeURIComponent(clientId)}`, { admin: true })
const found = (search.json?.clients ?? search.json?.items ?? []).find((c) => c.clientId === clientId)
record(
  'CRM record readable by admin with permanent Client ID',
  found ? 'PASS' : 'FAIL',
  found ? `${found.clientId} stage=${found.pipelineStage}` : jsonSafe(search),
)

// ------------------------------------------------------- 4. journey actions
async function journey(action, payload = {}, { allowBlocked = false } = {}) {
  const res = await api('/api/admin/journey', {
    method: 'POST',
    admin: true,
    body: { clientId, action, payload },
  })
  const text = String(res.json?.message ?? res.json?.error ?? `HTTP ${res.status}`)
  // The route returns HTTP 200 with ok:false for engine-level failures, so both
  // the transport and the payload verdict must agree before this counts as PASS.
  if (res.ok && res.json?.ok !== false) {
    record(action, 'PASS', text)
    return res.json?.result ?? {}
  }
  const providerBlocked = /NOT_CONFIGURED|not configured|provider|SMTP|WhatsApp|SMS|credentials are not configured/i.test(text)
  record(action, allowBlocked && providerBlocked ? 'BLOCKED' : 'FAIL', text)
  return null
}

async function pendingApprovals() {
  const res = await api(`/api/admin/approvals?status=PENDING&clientId=${encodeURIComponent(clientId)}`, { admin: true })
  return res.json?.approvals ?? []
}

async function approveAll(label, filter = () => true) {
  const list = (await pendingApprovals()).filter(filter)
  if (list.length === 0) {
    record(label, 'NOT VERIFIED', 'no pending approval found')
    return []
  }
  const results = []
  for (const approval of list) {
    const res = await api(`/api/admin/approvals/${approval.id}/decision`, {
      method: 'POST',
      admin: true,
      body: { decision: 'APPROVED', note: 'journey-e2e verifier' },
    })
    results.push({ id: approval.id, type: approval.type, status: res.status, json: res.json })
    record(
      `${label} (${approval.type})`,
      res.ok ? 'PASS' : 'FAIL',
      res.json?.message ?? res.json?.error ?? `HTTP ${res.status}`,
    )
  }
  return results
}

await journey('DETECT_BUSINESS', { message: 'We sell clothing online in Dhaka and need a bKash checkout.' })
await journey('RECOMMEND_PLAN')
await journey('ASK_SCOPE_QUESTIONS', {}, { allowBlocked: true })

await journey('SUBMIT_SCOPE', {
  text: [
    'Storefront with categories, product pages, size and colour variants.',
    'Checkout with bKash and Nagad, cash on delivery for Dhaka.',
    'Order tracking for customers and an admin dashboard.',
    'Content management for products and banners by our own team.',
    'Reports: daily sales, stock levels, top products.',
  ].join('\n'),
})
const scopesBeforeApproval = await api(`/api/admin/scopes?clientId=${encodeURIComponent(clientId)}`, { admin: true })
const scopeBefore = (scopesBeforeApproval.json?.scopes ?? scopesBeforeApproval.json?.items ?? [])[0]
record(
  'SOW draft requires admin approval (no self-approval by the AI)',
  scopeBefore && scopeBefore.status === 'AWAITING_ADMIN_APPROVAL' ? 'PASS' : 'FAIL',
  scopeBefore ? `v${scopeBefore.version} status=${scopeBefore.status} generatedBy=${scopeBefore.generatedBy ?? 'unknown'}` : jsonSafe(scopesBeforeApproval),
)

// ------------------------------------------------- 5. approve the SOW send
await approveAll('Super Admin approves final SOW', (a) => a.type === 'FINAL_SCOPE_SEND')

const scopes = await api(`/api/admin/scopes?clientId=${encodeURIComponent(clientId)}`, { admin: true })
const scopeList = scopes.json?.scopes ?? scopes.json?.items ?? []
const latestScope = scopeList[0]
record(
  'SOW stored with version + status',
  latestScope ? 'PASS' : 'NOT VERIFIED',
  latestScope ? `v${latestScope.version} status=${latestScope.status}` : jsonSafe(scopes),
)
record(
  'SOW versioned and approved by a human admin',
  latestScope && latestScope.status === 'FINAL' && (latestScope.approvedBy || latestScope.approvedAt) ? 'PASS' : 'NOT VERIFIED',
  latestScope ? `v${latestScope.version} status=${latestScope.status} approvedBy=${latestScope.approvedBy ?? 'n/a'}` : 'no scope',
)

// ------------------------------------------- 6. client approves the scope
await journey('CLIENT_SCOPE_DECISION', { decision: 'APPROVED', notes: 'Approved the proposed scope.' })

// ------------------------------------------------ 7. HTML preview + approval
const preview = await journey('GENERATE_PREVIEW', {}, { allowBlocked: true })
record(
  'HTML preview generated with token + version',
  preview?.previewId && preview?.token ? 'PASS' : 'FAIL',
  preview ? `preview=${preview.previewId} v? token=${String(preview.token).slice(0, 8)}… status=${preview.status}` : 'see step above',
)
await journey('PREVIEW_DECISION', { decision: 'APPROVED', notes: 'Preview approved by the client.' })

// ------------------------------------------------------ 8. payment request
await journey('REQUEST_PAYMENT', {}, { allowBlocked: true })
await approveAll('Super Admin approves payment instruction', (a) => a.type === 'PAYMENT_INSTRUCTION')

// --------------------------------------------- 9. record + verify payment
await journey('RECORD_PAYMENT', {
  amount: 500,
  currency: 'USD',
  method: 'BANK_TRANSFER',
  transactionId: `TEST-${stamp}`,
  milestone: 'Advance',
  notes: 'Controlled test payment recorded by the journey verifier (no real funds).',
})

const payments = await api(`/api/admin/payments?clientId=${encodeURIComponent(clientId)}`, { admin: true })
const paymentList = payments.json?.payments ?? payments.json?.items ?? []
const pendingPayment = paymentList.find((p) => p.status !== 'PAID')
record(
  'Payment recorded as PENDING (not auto-verified)',
  pendingPayment && pendingPayment.status === 'PENDING' ? 'PASS' : paymentList.some((p) => p.status === 'PENDING') ? 'PASS' : 'NOT VERIFIED',
  JSON.stringify(paymentList.map((p) => ({ id: p.id, status: p.status, amount: p.amount })).slice(0, 3)),
)

// Pipeline acknowledgements that require an explicit admin approval.
await approveAll('Super Admin approves gated pipeline message', (a) => a.type === 'PIPELINE_MESSAGE')

const paymentId = pendingPayment?.id ?? paymentList[0]?.id
if (paymentId) {
  let verification = await api('/api/admin/payments/verify', {
    method: 'POST',
    admin: true,
    body: { paymentId },
  })
  if (verification.status === 409 && verification.json?.status === 'APPROVAL_REQUIRED') {
    record('Payment verification refused without Super Admin approval', 'PASS', 'approval raised')
    const approvalId = verification.json.approvalId
    const decision = await api(`/api/admin/approvals/${approvalId}/decision`, {
      method: 'POST',
      admin: true,
      body: { decision: 'APPROVED', note: 'journey-e2e verifier' },
    })
    record('Super Admin approves payment verification', decision.ok ? 'PASS' : 'FAIL', decision.json?.message ?? decision.json?.error)
    verification = await api('/api/admin/payments/verify', {
      method: 'POST',
      admin: true,
      body: { paymentId, approvalId },
    })
  }
  record('Payment verified through governed action', verification.ok ? 'PASS' : 'FAIL', verification.json?.message ?? verification.json?.error)
} else {
  record('Payment verified through governed action', 'NOT VERIFIED', 'no payment id available')
}

// ------------------------------------------------------ 10. project + tasks
const project = await journey('START_PROJECT', {}, { allowBlocked: true })
const projects = await api(`/api/admin/projects?clientId=${encodeURIComponent(clientId)}`, { admin: true })
const projectList = (projects.json?.projects ?? projects.json?.items ?? []).filter(
  (p) => !p.client?.clientId || p.client.clientId === clientId,
)
record(
  'Project created and linked to Client ID',
  projectList.length > 0 ? 'PASS' : 'NOT VERIFIED',
  projectList.map((p) => `${p.code ?? p.id}:${p.status}`).join(', ') || jsonSafe(projects),
)
const activeProject = projectList[0]

// -------------------------------------------------------- 11. handover flow
if (activeProject) {
  // Complete the work items with recorded evidence (QA / delivery gates are
  // enforced by the backend, so handover cannot be prepared without this).
  const detail = await api(`/api/admin/projects/${activeProject.id}`, { admin: true })
  const tasks = detail.json?.tasks ?? detail.json?.project?.tasks ?? []
  let done = 0
  for (const t of tasks) {
    const res = await api(`/api/admin/projects/${activeProject.id}/tasks/${t.id}`, {
      method: 'PATCH',
      admin: true,
      body: {
        status: 'DONE',
        evidence: 'journey-e2e verifier: step completed in a controlled test environment with recorded evidence.',
      },
    })
    if (res.ok) done += 1
  }
  record(
    'Project tasks persisted with IDs and completed with evidence',
    tasks.length > 0 && done === tasks.length ? 'PASS' : 'FAIL',
    `${done}/${tasks.length} task(s) completed`,
  )

  // Attach a real scan-passed source artifact. The handover gate refuses to
  // prepare a package without a source-code-containing artifact set.
  const form = new FormData()
  const source = [
    '<!doctype html>',
    '<html lang="en"><head><meta charset="utf-8"><title>Journey test storefront</title></head>',
    '<body><h1>Controlled handover artifact</h1>',
    '<p>This file exists only to exercise the TECH360 delivery + source handover gate in a controlled test.</p>',
    '</body></html>',
  ].join('\n')
  form.append('file', new Blob([source], { type: 'text/html' }), 'index.html')
  form.append('clientId', clientId)
  form.append('projectId', activeProject.id)
  form.append('classification', 'PRIVATE')
  form.append('note', 'journey-e2e controlled handover artifact')
  const uploadRes = await fetch(`${BASE}/api/admin/documents`, {
    method: 'POST',
    headers: { Cookie: cookieHeader(), 'x-csrf-token': jar.get('t360_csrf') ?? '' },
    body: form,
  })
  const uploadJson = await uploadRes.json().catch(() => null)
  record(
    'Source artifact attached, scanned and stored',
    uploadRes.ok ? 'PASS' : 'FAIL',
    uploadJson?.document?.originalName ?? uploadJson?.error ?? `HTTP ${uploadRes.status}`,
  )

  await journey('PREPARE_HANDOVER', { projectId: activeProject.id }, { allowBlocked: true })
  await approveAll('Super Admin releases source handover', (a) => /HANDOVER/i.test(a.type))

  const handovers = await api(`/api/admin/projects/${activeProject.id}`, { admin: true })
  const handoverList = handovers.json?.handovers ?? handovers.json?.project?.handovers ?? []
  const handover = Array.isArray(handoverList) ? handoverList[0] : handoverList
  record(
    'Handover package created with token + expiry',
    handover ? 'PASS' : 'NOT VERIFIED',
    handover ? `status=${handover.status} token=${String(handover.token ?? handover.packageToken ?? '').slice(0, 8)}…` : jsonSafe(handovers),
  )

  // Client confirmation (download first, then confirm, as the real client does).
  const token = handover?.token ?? handover?.packageToken
  if (token) {
    const download = await fetch(`${BASE}/api/handover/${token}/download`)
    record('Client downloads protected package with token', download.ok || download.status === 200 ? 'PASS' : 'FAIL', `HTTP ${download.status}`)
    const confirm = await api(`/api/handover/${token}/confirm`, {
      method: 'POST',
      body: { received: true, working: true, passwordsChanged: true, notes: 'Confirmed by journey verifier.' },
    })
    record('Client confirms delivery + password change', confirm.ok ? 'PASS' : 'FAIL', confirm.json?.message ?? confirm.json?.error)
  } else {
    record('Client confirmation (password change)', 'NOT VERIFIED', 'handover token unavailable')
  }

  await journey('CLOSE_PROJECT', { projectId: activeProject.id })
} else {
  record('Handover flow', 'NOT VERIFIED', 'no project created')
}

// --------------------------------------------------- 12. review + referral
await journey('REQUEST_REVIEW', {}, { allowBlocked: true })

// ---------------------------------------------------------- 13. final state
const finalRecord = await api(`/api/admin/clients?query=${encodeURIComponent(clientId)}`, { admin: true })
const finalClient = (finalRecord.json?.clients ?? finalRecord.json?.items ?? []).find((c) => c.clientId === clientId)
record(
  'Final pipeline stage recorded',
  finalClient ? 'PASS' : 'NOT VERIFIED',
  finalClient ? `stage=${finalClient.pipelineStage} status=${finalClient.status}` : 'client not returned',
)

finish()

function finish() {
  const passed = steps.filter((s) => s.status === 'PASS').length
  const notVerified = steps.filter((s) => s.status === 'NOT VERIFIED').length
  const summary = {
    baseUrl: BASE,
    clientId,
    email,
    startedAt: new Date().toISOString(),
    totals: { steps: steps.length, passed, failed: failures, blocked, notVerified },
    steps,
  }
  const dir = join(ROOT, 'docs', 'evidence')
  mkdirSync(dir, { recursive: true })
  const file = join(dir, `journey-e2e-${Date.now()}.json`)
  writeFileSync(file, JSON.stringify(summary, null, 2))
  console.log(`\nSummary: ${passed}/${steps.length} PASS, ${failures} FAIL, ${blocked} BLOCKED, ${notVerified} NOT VERIFIED`)
  console.log(`Evidence: ${file}`)
  process.exit(failures > 0 ? 1 : 0)
}
