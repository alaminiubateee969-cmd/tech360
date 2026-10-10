#!/usr/bin/env node
/**
 * TECH360 E2E verification harness — real HTTP against a real (SQLite) database.
 *
 * Purpose: production-audit evidence for the flows that do not depend on
 * external providers (Super Admin login + RBAC, visitor chat -> saved
 * conversation -> admin inbox triage -> convert-to-lead, customer portal,
 * newsletter, public content APIs). The production database is MySQL on
 * Hostinger; this sandbox has no MySQL and no outbound access to it, so this
 * harness runs the SAME application code (same routes, same guards, same
 * Prisma models) against a throwaway SQLite database generated from the same
 * schema.prisma with only the MySQL `@db.*` column annotations stripped.
 *
 * What this proves: the wiring, persistence, auth, RBAC, CSRF and honest
 * behavior of every flow below. What it does NOT prove: MySQL-specific
 * behavior in production (covered separately by CI `migrate deploy` gates)
 * and provider-backed AI replies / SMTP delivery (NOT_CONFIGURED here).
 *
 * Usage:
 *   node scripts/e2e-sqlite.mjs
 * Optional env passthrough (offline sandboxes only):
 *   PRISMA_ENGINES_MIRROR=http://127.0.0.1:PORT PRISMA_ENGINES_CHECKSUM_IGNORE_MISSING=1
 *
 * The throwaway database and converted schema live in /tmp and are never
 * committed. The real MySQL Prisma client is ALWAYS regenerated afterwards.
 */
import { execFileSync, spawn } from 'node:child_process'
import { mkdirSync, rmSync, readFileSync, writeFileSync, existsSync } from 'node:fs'
import { join, resolve } from 'node:path'

const ROOT = process.cwd()
const WORK = join(ROOT, '.e2e-tmp')
const PORT = Number(process.env.E2E_PORT || 3200)
const BASE = `http://127.0.0.1:${PORT}`
const DB_FILE = `${WORK}/e2e.db`
const DATABASE_URL = `file:${DB_FILE}`

const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL || 'super.admin@e2e.tech360.internal'
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD || 'E2e-Root-2026!'
const CLIENT_ID = 'TECH-2026-000001'
const CLIENT_EMAIL = 'rahim@dhakaroasters.example'

const evidence = []
let step = 0
const note = (name, data) => {
  step += 1
  evidence.push({ step, name, ...data })
  const ok = data.checks ? data.checks.every((c) => c.pass) : data.ok !== false
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${String(step).padStart(2, '0')} ${name}`)
  for (const c of data.checks ?? []) console.log(`        ${c.pass ? '✓' : '✗'} ${c.label}`)
}

function run(cmd, args, env = {}) {
  return execFileSync(cmd, args, {
    cwd: ROOT,
    env: { ...process.env, ...env },
    stdio: ['ignore', 'pipe', 'pipe'],
    encoding: 'utf8',
  })
}

// cookie-jar helpers -------------------------------------------------------
function cookieOf(res, name) {
  const setCookies = res.headers.getSetCookie ? res.headers.getSetCookie() : [res.headers.get('set-cookie')].filter(Boolean)
  for (const sc of setCookies) {
    const m = sc.match(new RegExp(`^${name}=([^;]+)`))
    if (m) return m[1]
  }
  return null
}

async function req(method, path, { body, cookies, csrf, headers } = {}) {
  const h = { ...(headers ?? {}) }
  if (body !== undefined) h['content-type'] = 'application/json'
  if (cookies) h.cookie = Object.entries(cookies).map(([k, v]) => `${k}=${v}`).join('; ')
  if (csrf) h['x-csrf-token'] = csrf
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: h,
    body: body !== undefined ? JSON.stringify(body) : undefined,
    redirect: 'manual',
  })
  const text = await res.text()
  let json = null
  try { json = JSON.parse(text) } catch { /* html etc */ }
  return { res, text, json }
}

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)) }

// --------------------------------------------------------------------------
async function main() {
  console.log(`E2E harness — workdir ${WORK}, server ${BASE}`)

  // 1. throwaway workdir + converted schema (strip MySQL @db annotations)
  rmSync(WORK, { recursive: true, force: true })
  mkdirSync(WORK, { recursive: true })
  let schema = readFileSync(join(ROOT, 'prisma/schema.prisma'), 'utf8')
  schema = schema
    .replace('provider = "mysql"', 'provider = "sqlite"')
    .replace(/ @db\.(Text|LongText|LongBlob|VarChar\(\d+\))/g, '')
  writeFileSync(join(WORK, 'schema.prisma'), schema)
  note('schema converted mysql->sqlite (annotations only)', {
    checks: [{ pass: !schema.includes('@db.'), label: 'no MySQL-native annotations remain' }],
  })

  try {
    // 2. create + push throwaway database, generate SQLite client in place
    run('npx', ['prisma', 'db', 'push', '--schema', `${WORK}/schema.prisma`, '--skip-generate'], { DATABASE_URL })
    run('npx', ['prisma', 'generate', '--schema', `${WORK}/schema.prisma`], { DATABASE_URL })
    console.log('     sqlite database pushed, client generated')

    // 3. seed
    const seeded = JSON.parse(run('npx', ['tsx', 'scripts/e2e-seed.ts'], { DATABASE_URL }))
    note('seeded super admin, client, agent execution, blog post', {
      checks: [{ pass: seeded.seeded !== false, label: `seed ok (${JSON.stringify(seeded)})` }],
    })

    // 4. dev server on the throwaway database
    rmSync(join(ROOT, '.next'), { recursive: true, force: true })
    const server = spawn('npx', ['next', 'dev', '-p', String(PORT), '--hostname', '127.0.0.1'], {
      cwd: ROOT,
      env: { ...process.env, DATABASE_URL },
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    server.stdout.on('data', (d) => process.stdout.write(`[srv] ${d}`))
    server.stderr.on('data', (d) => process.stderr.write(`[srv] ${d}`))

    let up = false
    for (let i = 0; i < 90 && !up; i++) {
      await sleep(2000)
      try {
        await fetch(`${BASE}/api/health`)
        up = true // any HTTP answer means the server is listening
      } catch { /* not listening yet */ }
    }
    if (!up) throw new Error('dev server never became ready')
    console.log('     dev server ready')

    // ---------------- public surface ----------------
    {
      const { res, text } = await req('GET', '/')
      note('homepage renders server-side', {
        status: res.status,
        checks: [
          { pass: res.status === 200, label: 'HTTP 200' },
          { pass: text.includes('Tech360'), label: 'branded HTML served' },
          { pass: !/\b0\+/.test(text), label: 'no zero-stats on the served page' },
        ],
      })
    }
    {
      const { res, json } = await req('GET', '/api/health')
      note('health endpoint honest', {
        status: res.status,
        checks: [
          { pass: res.status === 200, label: 'HTTP 200 with a live database' },
          { pass: json?.checks?.database?.status === 'UP', label: `database=${json?.checks?.database?.detail}` },
          { pass: typeof json?.checks?.aiProvider?.status === 'string', label: `aiProvider=${json?.checks?.aiProvider?.status}` },
        ],
      })
    }
    {
      const { res, json } = await req('GET', '/api/blog')
      note('public blog API serves persisted rows', {
        status: res.status,
        checks: [
          { pass: res.status === 200, label: 'HTTP 200' },
          { pass: Array.isArray(json?.posts) && json.posts.some((p) => p.slug === 'e2e-verification-post'), label: 'seeded post present' },
        ],
      })
    }

    // ---------------- visitor chat -> CRM ----------------
    let anonId = null
    let conversationId = null
    {
      anonId = `e2e-visitor-${Date.now().toString(36)}`
      const { res, json } = await req('POST', '/api/chat/session', {
        body: { anonId, name: 'Rahim Uddin', email: CLIENT_EMAIL, subject: 'Online store for coffee brand' },
      })
      conversationId = json?.conversation?.id ?? null
      note('visitor starts a chat session', {
        status: res.status,
        checks: [
          { pass: res.status === 201, label: `HTTP ${res.status}` },
          { pass: Boolean(conversationId), label: `conversationId issued (${conversationId})` },
          { pass: json?.conversation?.status === 'OPEN', label: 'status=OPEN' },
        ],
      })
    }
    {
      const { res, json } = await req('POST', '/api/chat/message', {
        body: { anonId, body: 'Hi, I need an online store for my coffee brand. Budget is moderate.', name: 'Rahim Uddin', email: CLIENT_EMAIL },
      })
      note('visitor message persisted', {
        status: res.status,
        checks: [
          { pass: res.status === 201, label: 'HTTP 201 created' },
          { pass: json?.message?.sender === 'VISITOR', label: 'sender=VISITOR' },
          { pass: typeof json?.message?.id === 'string', label: 'message row id returned' },
        ],
      })
    }
    {
      const { res, json } = await req('GET', `/api/chat/messages?anonId=${encodeURIComponent(anonId)}`)
      note('visitor can read their own thread back', {
        status: res.status,
        checks: [
          { pass: res.status === 200, label: 'HTTP 200' },
          { pass: (json?.messages ?? []).some((m) => m.body.includes('online store')), label: 'message round-trips from the database' },
        ],
      })
    }

    // ---------------- super admin ----------------
    let adminCookies = null
    let csrf = null
    {
      const { res, json } = await req('POST', '/api/auth/login', { body: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD } })
      adminCookies = { t360_session: cookieOf(res, 't360_session'), t360_csrf: cookieOf(res, 't360_csrf') }
      csrf = adminCookies.t360_csrf
      note('super admin login', {
        status: res.status,
        checks: [
          { pass: res.status === 200, label: 'HTTP 200' },
          { pass: json?.user?.role === 'SUPER_ADMIN', label: 'role=SUPER_ADMIN' },
          { pass: Boolean(adminCookies.t360_session), label: 'session cookie set' },
          { pass: Boolean(csrf), label: 'csrf cookie set' },
        ],
      })
    }
    {
      const { res } = await req('GET', '/api/admin/conversations') // no cookies at all
      note('unauthenticated admin API is rejected', {
        status: res.status,
        checks: [{ pass: res.status === 401, label: `HTTP ${res.status} without session` }],
      })
    }
    {
      const { res, json } = await req('GET', '/api/admin/conversations', { cookies: adminCookies })
      const conv = (json?.conversations ?? []).find((c) => c.id === conversationId)
      note('admin inbox sees the visitor conversation (triage signal)', {
        status: res.status,
        checks: [
          { pass: res.status === 200, label: 'HTTP 200' },
          { pass: Boolean(conv), label: 'conversation listed' },
          { pass: conv?.lastSender === 'VISITOR', label: `lastSender=${conv?.lastSender} (needs-reply triage)` },
          { pass: conv?.unreadCount === 1, label: `unreadCount=${conv?.unreadCount}` },
          { pass: conv?.visitorEmail === CLIENT_EMAIL, label: 'visitor enrichment captured' },
        ],
      })
    }
    {
      const { res } = await req('POST', `/api/admin/conversations/${conversationId}`, {
        body: { action: 'reply', body: 'Welcome Rahim — we will scope your online store today.' },
        cookies: adminCookies,
        csrf,
      })
      note('admin reply requires CSRF', {
        status: res.status,
        checks: [{ pass: res.status === 200, label: 'HTTP 200 with x-csrf-token' }],
      })
    }
    {
      const { res: noCsrf } = await req('POST', `/api/admin/conversations/${conversationId}`, {
        body: { action: 'reply', body: 'should be rejected without csrf' },
        cookies: adminCookies,
      })
      note('admin reply without CSRF token is rejected', {
        status: noCsrf.status,
        checks: [{ pass: noCsrf.status === 403, label: `HTTP ${noCsrf.status}` }],
      })
    }
    {
      const { res, json } = await req('GET', '/api/admin/conversations', { cookies: adminCookies })
      const conv = (json?.conversations ?? []).find((c) => c.id === conversationId)
      note('after the reply the triage signal flips to the admin', {
        status: res.status,
        checks: [
          { pass: conv?.lastSender === 'ADMIN', label: `lastSender=${conv?.lastSender}` },
          { pass: conv?.unreadCount === 0, label: `unreadCount=${conv?.unreadCount}` },
        ],
      })
    }
    {
      const { res, json } = await req('POST', `/api/admin/conversations/${conversationId}`, {
        body: { action: 'convert-to-lead' },
        cookies: adminCookies,
        csrf,
      })
      note('conversation converts into a CRM lead from visitor messages', {
        status: res.status,
        checks: [
          { pass: res.status === 200, label: 'HTTP 200' },
          { pass: typeof json?.clientId === 'string' && json.clientId.startsWith('TECH-'), label: `new Client ID ${json?.clientId}` },
        ],
      })
    }

    // ---------------- customer portal ----------------
    let portalCookies = null
    {
      const { res, json } = await req('POST', '/api/portal/login', { body: { clientId: CLIENT_ID, contact: CLIENT_EMAIL } })
      portalCookies = { t360_portal: cookieOf(res, 't360_portal') }
      note('client portal sign-in (contact match; SMTP not configured => legacy step)', {
        status: res.status,
        checks: [
          { pass: res.status === 200, label: 'HTTP 200' },
          { pass: json?.ok === true, label: 'ok=true' },
          { pass: Boolean(portalCookies.t360_portal), label: 'portal session cookie set' },
        ],
      })
    }
    {
      const { res } = await req('GET', '/api/portal/me')
      note('portal API requires a session', {
        status: res.status,
        checks: [{ pass: res.status === 401, label: `HTTP ${res.status} without cookie` }],
      })
    }
    {
      const { res, json } = await req('GET', '/api/portal/me', { cookies: portalCookies })
      note('portal summary (client, project state, AI workforce feed)', {
        status: res.status,
        checks: [
          { pass: res.status === 200, label: 'HTTP 200' },
          { pass: json?.client?.clientId === CLIENT_ID, label: `client=${json?.client?.clientId}` },
          { pass: Array.isArray(json?.workforce) && json.workforce.some((w) => w.agentName === 'Atlas'), label: `workforce feed has ${json?.workforce?.length} execution(s) from Atlas` },
          { pass: json?.workforce?.[0]?.status === 'SUCCESS', label: 'execution status surfaces honestly' },
        ],
      })
    }

    // ---------------- newsletter ----------------
    {
      const { res, json } = await req('POST', '/api/newsletter', { body: { email: 'e2e-subscriber@example.com' } })
      note('newsletter subscription persists', {
        status: res.status,
        checks: [
          { pass: res.status === 200 || res.status === 201, label: `HTTP ${res.status}` },
          { pass: json?.ok === true || json?.subscribed === true, label: 'honest success payload' },
        ],
      })
    }

    server.kill('SIGTERM')

    // ---------------- database truth (direct) ----------------
    const truth = JSON.parse(run('node', ['-e', `
      const { PrismaClient } = require('@prisma/client');
      const db = new PrismaClient();
      (async () => {
        const conv = await db.chatConversation.findFirst({ orderBy: { createdAt: 'desc' } });
        const msgCount = await db.chatMessage.count();
        const sub = await db.newsletterSubscriber.findFirst({ where: { email: 'e2e-subscriber@example.com' } });
        const clients = await db.client.count();
        const leads = await db.lead.count();
        const sessions = await db.session.count();
        console.log(JSON.stringify({
          conversationLastSender: conv?.lastSender,
          conversationUnread: conv?.unreadCount,
          chatMessages: msgCount,
          newsletterRow: Boolean(sub),
          clients, leads, adminSessions: sessions,
        }));
        await db.$disconnect();
      })();
    `], { DATABASE_URL }))
    note('database truth matches the API responses', {
      checks: [
        { pass: truth.conversationLastSender === 'ADMIN', label: `ChatConversation.lastSender=${truth.conversationLastSender}` },
        { pass: truth.chatMessages >= 2, label: `ChatMessage rows=${truth.chatMessages} (visitor + admin reply)` },
        { pass: truth.newsletterRow === true, label: 'NewsletterSubscriber row exists' },
        { pass: truth.clients >= 2, label: `Client rows=${truth.clients} (seeded + converted lead)` },
        { pass: truth.leads >= 1, label: `Lead rows=${truth.leads} (converted from chat)` },
        { pass: truth.adminSessions >= 1, label: `Session rows=${truth.adminSessions}` },
      ],
    })
  } finally {
    // ALWAYS restore the real MySQL client
    try {
      run('npx', ['prisma', 'generate'], { DATABASE_URL: 'mysql://e2e:e2e@127.0.0.1:3306/e2e' })
      console.log('     mysql prisma client restored')
    } catch (err) {
      console.error('FAILED to restore mysql client — run `npx prisma generate` before anything else!', err)
    }
    if (existsSync(DB_FILE)) {
      rmSync(WORK, { recursive: true, force: true })
      console.log('     throwaway database removed')
    }
  }

  const out = join(ROOT, 'docs/e2e-sqlite-evidence-2026-10-10.json')
  writeFileSync(out, JSON.stringify({
    generatedAt: new Date().toISOString(),
    harness: 'scripts/e2e-sqlite.mjs (SQLite throwaway database, same schema + same application code)',
    environment: 'sandbox; production MySQL + external providers unreachable by network policy',
    steps: evidence,
  }, null, 2))
  const failed = evidence.flatMap((e) => (e.checks ?? []).filter((c) => !c.pass))
  console.log(`\n${evidence.length} steps, ${failed.length} failed checks`)
  console.log(`evidence written to ${out}`)
  process.exit(failed.length ? 1 : 0)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
