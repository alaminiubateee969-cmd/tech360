/**
 * TECH360 — Master Production Readiness Directive Verification Suite
 *
 * Covers Sections 5–14 of the Production Readiness Directive:
 * - Section 5: 110 departments, 44 executable CORE_AGENTS, 2,200 logical catalogue
 *   definitions, 2,201 workforce profiles, bounded hierarchy, fail-closed provider status
 * - Section 6: WebChat HMAC-SHA256 HttpOnly/SameSite/Secure session cookie & expiry
 * - Section 7: Verified customer identity domain-separated HMAC-SHA256 policy
 * - Section 8: Hostinger/Email anti-loop, bounce, no-reply & RFC 3834 guards
 * - Section 10: All 26 n8n workflows (active=false, connected graphs, headerAuth,
 *   retryOnFail, W26 SSRF host guard) + 26/26 /api/webhooks/n8n action coverage +
 *   governed refusal of automated ADMIN_APPROVAL and VERIFY_PAYMENT
 * - Section 11: Canonical 3-layer lifecycle stages + out-of-scope revision signals
 * - Section 12: Payment security (SUBMITTED never auto-becomes PAID; source-release check)
 * - Section 13: Source handover SUPER_ADMIN governance & release checks
 * - Section 14: RBAC across 12 canonical roles + unknown VIEWER fail-closed +
 *   AUDITOR read-only + Software Factory SUPER_ADMIN isolation + secret redaction
 */
import assert from 'node:assert/strict'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, it } from 'node:test'

import { CORE_AGENTS, DEPARTMENTS, validateAgentRegistry } from '../src/lib/agents/registry'
import { LOGICAL_AGENT_CATALOGUE, validateLogicalAgentCatalogue } from '../src/lib/agents/catalogue'
import { WORKFORCE, validateWorkforce } from '../src/lib/agents/workforce'
import { evaluateAgentPlacement, MAX_AGENT_HIERARCHY_DEPTH, MAX_CHILD_AGENTS_PER_PARENT } from '../src/lib/agents/hierarchy-policy'
import { isWellFormedDynamicAgent } from '../src/lib/agents/runtime-policy'
import {
  CHAT_SESSION_COOKIE,
  CHAT_SESSION_TTL_SECONDS,
  signChatSessionToken,
  verifyChatSessionToken,
  withChatSessionCookie,
} from '../src/lib/chat-session'
import { normalizeIdentity, prepareIdentity } from '../src/lib/identity-policy'
import { classifyInboundEmailSafety } from '../src/lib/mail/email-inbound-guard'
import { PIPELINE_STAGES, ROLES } from '../src/lib/constants'
import { SPEC_STAGES } from '../src/lib/pipeline/spec-copy'
import { PUBLIC_JOURNEY } from '../src/lib/public-journey'
import {
  PAYMENT_DB_STATUSES,
  detectOutOfScopeRevisionSignals,
  evaluateClientPaymentProofSubmission,
  isPaymentClearedForSourceRelease,
  isPaymentVerified,
  validatePaymentLifecycleTransition,
} from '../src/lib/payment-policy'
import { canAccessAdminView } from '../src/lib/admin-view-policy'
import { hasCapability, hasRole, isReadOnlyRole } from '../src/lib/access-policy'
import { redactSensitiveCrmData } from '../src/lib/sensitive-redaction'

const ROOT = join(import.meta.dirname, '..')

describe('Section 5 — AI Workforce & Agent Engine truth model', () => {
  it('maintains exact verified counts: 110 departments, 44 core agents, 2,200 logical profiles, 2,201 workforce entries', () => {
    assert.equal(DEPARTMENTS.length, 110)
    assert.equal(CORE_AGENTS.length, 44)
    assert.equal(LOGICAL_AGENT_CATALOGUE.length, 2200)
    assert.equal(WORKFORCE.length, 2201)
    assert.equal(validateAgentRegistry().valid, true)
    assert.equal(validateLogicalAgentCatalogue().valid, true)
    assert.equal(validateWorkforce().valid, true)
  })

  it('enforces bounded child-agent hierarchy (depth <= 2, <= 3 children per active same-department parent)', () => {
    assert.equal(MAX_AGENT_HIERARCHY_DEPTH, 2)
    assert.equal(MAX_CHILD_AGENTS_PER_PARENT, 3)

    const ok = evaluateAgentPlacement({
      parentExists: true,
      parentStatus: 'ACTIVE',
      parentDepartmentCode: 'SAL',
      departmentCode: 'SAL',
      parentDepth: 1,
      existingChildren: 2,
    })
    assert.deepEqual(ok, { allowed: true, depth: 2 })

    const tooDeep = evaluateAgentPlacement({
      parentExists: true,
      parentStatus: 'ACTIVE',
      parentDepartmentCode: 'SAL',
      departmentCode: 'SAL',
      parentDepth: 2,
      existingChildren: 0,
    })
    assert.equal(tooDeep.allowed, false)
    if (!tooDeep.allowed) assert.equal(tooDeep.code, 'MAX_DEPTH_REACHED')

    const crossDept = evaluateAgentPlacement({
      parentExists: true,
      parentStatus: 'ACTIVE',
      parentDepartmentCode: 'SAL',
      departmentCode: 'FIN',
      parentDepth: 1,
      existingChildren: 0,
    })
    assert.equal(crossDept.allowed, false)
    if (!crossDept.allowed) assert.equal(crossDept.code, 'DEPARTMENT_MISMATCH')
  })

  it('rejects dynamic agents that bypass approval or request wildcard permissions', () => {
    assert.equal(
      isWellFormedDynamicAgent({
        code: 'AGT-1A2B3C4D',
        status: 'ACTIVE',
        parentCode: 'SAL-001',
        requiresApproval: false,
        purpose: 'Assist lead triage safely',
        systemPrompt: 'You are a bounded sales intake assistant operating strictly within approved read-only tools.',
        tools: ['crm:read'],
        permissions: ['*'],
        department: { code: 'SAL' },
        departmentId: 'dept-sal',
      }),
      false,
    )
  })
})

describe('Section 6 — WebChat HMAC session cookie security', () => {
  const testSecret = 's'.repeat(48)

  it('binds HMAC-SHA256 chat tokens to a single visitor anonId and rejects tampering or expiry', () => {
    const now = 1_760_000_000
    const token = signChatSessionToken('visitor-abc-123', testSecret, now + 3600)
    assert.equal(verifyChatSessionToken(token, 'visitor-abc-123', testSecret, now), true)
    assert.equal(verifyChatSessionToken(token, 'visitor-other-999', testSecret, now), false)
    assert.equal(verifyChatSessionToken(token, 'visitor-abc-123', testSecret, now + 3601), false)
    assert.equal(verifyChatSessionToken(`${token}x`, 'visitor-abc-123', testSecret, now), false)
  })

  it('sets HttpOnly, SameSite=Strict, Path=/api/chat, and 30-day rolling Max-Age (plus Secure in production)', () => {
    const prevSecret = process.env.SESSION_SECRET
    const prevEnv = process.env.NODE_ENV
    try {
      process.env.SESSION_SECRET = testSecret
      ;(process.env as Record<string, string | undefined>).NODE_ENV = 'production'
      const res = withChatSessionCookie(new Response('ok'), 'visitor-prod-1')
      const cookie = res.headers.get('set-cookie') ?? ''
      assert.ok(cookie.startsWith(`${CHAT_SESSION_COOKIE}=`))
      assert.ok(cookie.includes('HttpOnly'))
      assert.ok(cookie.includes('SameSite=Strict'))
      assert.ok(cookie.includes('Path=/api/chat'))
      assert.ok(cookie.includes(`Max-Age=${CHAT_SESSION_TTL_SECONDS}`))
      assert.ok(cookie.includes('; Secure'))
    } finally {
      if (prevSecret === undefined) delete process.env.SESSION_SECRET
      else process.env.SESSION_SECRET = prevSecret
      ;(process.env as Record<string, string | undefined>).NODE_ENV = prevEnv
    }
  })
})

describe('Section 7 & 8 — Verified Identity & Inbound Email Loop Guards', () => {
  it('requires >=32-byte IDENTITY_HASH_SECRET and produces domain-separated digests only for verified proofs', () => {
    const prev = process.env.IDENTITY_HASH_SECRET
    try {
      process.env.IDENTITY_HASH_SECRET = 'k'.repeat(48)
      assert.equal(normalizeIdentity('EMAIL', '  Founder@Example.COM '), 'founder@example.com')
      const prepared = prepareIdentity({
        type: 'EMAIL',
        value: 'Founder@Example.com',
        verificationSource: 'EMAIL_OTP',
      })
      assert.equal(prepared.identityType, 'EMAIL')
      assert.equal(prepared.normalizedHash.length, 64)
      assert.ok(!prepared.normalizedHash.includes('founder@example.com'))
    } finally {
      if (prev === undefined) delete process.env.IDENTITY_HASH_SECRET
      else process.env.IDENTITY_HASH_SECRET = prev
    }
  })

  it('blocks self-sender @bdtech360.com, Mailer-Daemon bounces, and RFC 3834 Auto-Submitted mail loops', () => {
    const selfVerdict = classifyInboundEmailSafety({
      fromEmail: 'info@bdtech360.com',
      subject: 'Re: Inquiry',
      body: 'Automated confirmation',
    })
    assert.equal(selfVerdict.allowProcess, false)

    const bounceVerdict = classifyInboundEmailSafety({
      fromEmail: 'MAILER-DAEMON@mail.example.org',
      subject: 'Undelivered Mail Returned to Sender',
      body: 'Diagnostic-Code: smtp; 550 5.1.1 user unknown',
    })
    assert.equal(bounceVerdict.allowProcess, false)

    const rfc3834Verdict = classifyInboundEmailSafety({
      fromEmail: 'customer@example.org',
      subject: 'Out of office',
      body: 'I am away from my desk.',
      headers: { 'auto-submitted': 'auto-replied' },
    })
    assert.equal(rfc3834Verdict.allowProcess, false)

    const humanVerdict = classifyInboundEmailSafety({
      fromEmail: 'cto@clientcorp.io',
      subject: 'Need an eCommerce platform quote',
      body: 'Hello TECH360 team, we would like to build a multi-vendor store.',
    })
    assert.equal(humanVerdict.allowProcess, true)
  })
})

describe('Section 10 — n8n W01–W26 Workflows & Webhook Bridge Governance', () => {
  const n8nDir = join(ROOT, 'n8n')
  const files = readdirSync(n8nDir).filter((f) => f.endsWith('.json')).sort()
  const routeSrc = readFileSync(join(ROOT, 'src/app/api/webhooks/n8n/route.ts'), 'utf8')
  const supportedActions = new Set([...routeSrc.matchAll(/case\s+'([A-Z0-9_]+)':/g)].map((m) => m[1]))

  it('ships exactly 26 inactive (active=false), uniquely identified workflows with zero disconnected executable nodes', () => {
    assert.equal(files.length, 26)
    const ids = new Set<string>()
    for (const file of files) {
      const wf = JSON.parse(readFileSync(join(n8nDir, file), 'utf8'))
      assert.equal(wf.active, false, `${file} must remain active=false until owner review`)
      assert.ok(typeof wf.id === 'string' && wf.id.length > 5, `${file} must have a deterministic workflow id`)
      assert.ok(!ids.has(wf.id), `Duplicate workflow id ${wf.id} in ${file}`)
      ids.add(wf.id)

      const connected = new Set<string>()
      for (const [src, targets] of Object.entries((wf.connections ?? {}) as Record<string, Record<string, Array<Array<{ node: string }>>>>)) {
        connected.add(src)
        for (const branch of Object.values(targets)) {
          for (const arr of branch) for (const edge of arr) connected.add(edge.node)
        }
      }
      const executableNodes = (wf.nodes as Array<{ name: string; type: string }>).filter(
        (n) => n.type !== 'n8n-nodes-base.stickyNote',
      )
      if (executableNodes.length > 1) {
        for (const node of executableNodes) {
          assert.ok(connected.has(node.name), `${file} has disconnected executable node "${node.name}"`)
        }
      }
    }
  })

  it('enforces headerAuth on every n8n webhook trigger, retries on every platform bridge call, and supports all 26 workflow codes', () => {
    for (const file of files) {
      const wf = JSON.parse(readFileSync(join(n8nDir, file), 'utf8'))
      for (const node of wf.nodes as Array<Record<string, unknown>>) {
        const params = (node.parameters ?? {}) as Record<string, unknown>
        if (node.type === 'n8n-nodes-base.webhook') {
          assert.equal(params.authentication, 'headerAuth', `${file} webhook trigger must require headerAuth`)
          const opts = (params.options ?? {}) as Record<string, unknown>
          assert.notEqual(opts.allowedOrigins, '*', `${file} webhook must not expose wildcard CORS`)
        }
        if (
          node.type === 'n8n-nodes-base.httpRequest' &&
          String(params.url ?? '').includes('/api/webhooks/n8n')
        ) {
          const retryOpt = ((params.options as Record<string, unknown> | undefined)?.retry as Record<string, unknown> | undefined)?.enabled
          assert.ok(node.retryOnFail === true || retryOpt === true, `${file} bridge request must configure retry`)
          const m = String(params.jsonBody ?? '').match(/"workflow"\s*:\s*"([A-Z0-9_]+)"/)
          if (m) {
            assert.ok(supportedActions.has(m[1]), `/api/webhooks/n8n/route.ts missing case '${m[1]}' for ${file}`)
          }
        }
      }
    }
    // Automation must never auto-approve human gates or auto-verify payments
    assert.ok(routeSrc.includes("action: 'N8N_ADMIN_APPROVAL_REFUSED'"))
    assert.ok(routeSrc.includes("verifyPayment(paymentId, { type: 'AUTOMATION', id: 'n8n' })"))
  })

  it('W26 Normalize and Validate code blocks localhost, RFC1918, link-local 169.254.169.254, and IPv6 literals', () => {
    const w26 = JSON.parse(readFileSync(join(n8nDir, 'W26_LEAD_ENRICHMENT.json'), 'utf8'))
    const normNode = (w26.nodes as Array<{ name: string; parameters?: { jsCode?: string } }>).find(
      (n) => n.name === 'Normalize and Validate',
    )
    assert.ok(normNode?.parameters?.jsCode)
    const runValidator = (website: string) => {
      const fn = new Function('$input', normNode.parameters!.jsCode!)
      return fn({ first: () => ({ json: { body: { businessName: 'Test', website, email: 'a@b.co' } } }) })[0].json.lead.website
    }
    assert.equal(runValidator('http://127.0.0.1:3000/admin'), '')
    assert.equal(runValidator('http://localhost:5678'), '')
    assert.equal(runValidator('http://169.254.169.254/latest/meta-data/'), '')
    assert.equal(runValidator('http://10.0.0.5/internal'), '')
    assert.equal(runValidator('http://192.168.1.10/router'), '')
    assert.equal(runValidator('http://[::1]:3000'), '')
    assert.equal(runValidator('https://acme-commerce.example.com/shop'), 'https://acme-commerce.example.com')
  })
})

describe('Sections 11, 12, 13 & 14 — Lifecycle, Payments, Handover & RBAC', () => {
  it('resolves the 3-layer stage architecture cleanly (20 DB states, 13 spec variants across stages 1..11, 7 public steps)', () => {
    assert.equal(PIPELINE_STAGES.length, 20)
    assert.equal(Object.keys(SPEC_STAGES).length, 13)
    assert.equal(PUBLIC_JOURNEY.length, 7)
    const outOfScope = detectOutOfScopeRevisionSignals('Also add a native iOS mobile app and new ERP module')
    assert.equal(outOfScope.outOfScopeLikely, true)
    assert.equal(outOfScope.flagged, true)
  })

  it('prevents SUBMITTED payment proofs from ever auto-becoming PAID and blocks unpaid source release', () => {
    assert.ok(PAYMENT_DB_STATUSES.includes('SUBMITTED'))
    assert.ok(PAYMENT_DB_STATUSES.includes('UNDER_VERIFICATION'))
    const proof = evaluateClientPaymentProofSubmission({
      hasProofFile: true,
      method: 'BANK_TRANSFER',
      transactionId: 'TXN-998877',
    })
    assert.equal(proof.ok, true)
    if (proof.ok) {
      assert.equal(proof.status, 'SUBMITTED')
      assert.equal(proof.evidenceOnly, true)
    }

    const illegalAutoPaid = validatePaymentLifecycleTransition({
      currentStatus: 'SUBMITTED',
      targetStatus: 'PAID',
      transactionId: 'TXN-998877',
      reason: 'Attempted status shortcut without PAYMENT_VERIFY approval',
    })
    assert.equal(illegalAutoPaid.ok, false)

    assert.equal(
      isPaymentVerified({ status: 'SUBMITTED', amount: 1500, verifiedAt: null, verifiedBy: null }),
      false,
    )
    assert.equal(
      isPaymentClearedForSourceRelease({
        projectTotalAmount: 2000,
        payments: [{ status: 'PAID', amount: 1000, verifiedAt: new Date(), verifiedBy: 'admin-1' }],
      }).cleared,
      false,
    )
  })

  it('enforces RBAC across all 12 canonical roles, fails closed on VIEWER, keeps AUDITOR read-only, and isolates Software Factory to SUPER_ADMIN', () => {
    assert.equal(ROLES.length, 12)
    // Unknown VIEWER role fails closed everywhere
    assert.equal(hasRole({ role: 'VIEWER' }, 'STAFF'), false)
    assert.equal(hasCapability({ role: 'VIEWER' }, 'crm.read'), false)
    assert.equal(canAccessAdminView('VIEWER', 'dashboard'), false)

    // AUDITOR is canonical read-only (dashboard, leads, clients, payments, projects, reports — never factory)
    assert.equal(isReadOnlyRole({ role: 'AUDITOR' }), true)
    assert.equal(canAccessAdminView('AUDITOR', 'payments'), true)
    assert.equal(canAccessAdminView('AUDITOR', 'factory'), false)
    assert.equal(canAccessAdminView('AUDITOR', 'factoryControl'), false)

    // Software Factory is strictly SUPER_ADMIN only (even ADMIN is denied)
    assert.equal(canAccessAdminView('ADMIN', 'factory'), false)
    assert.equal(canAccessAdminView('ADMIN', 'factoryControl'), false)
    assert.equal(canAccessAdminView('SUPER_ADMIN', 'factory'), true)
    assert.equal(canAccessAdminView('SUPER_ADMIN', 'factoryControl'), true)
  })

  it('redacts passwords, bearer/API tokens, PEM private keys, and DB connection credentials before storage or logging', () => {
    const sample = [
      'Client wrote: password: MySuperSecretPassword!123',
      'Authorization: Bearer sk-live-1234567890abcdefghijklmnop',
      'mysql://prod_user:UltraSecretDbPass99@db.internal:3306/tech360',
      '-----BEGIN PRIVATE KEY----- MIIEvgIBADADBgkqhkiG9w0BAQEFAASCBKgw -----END PRIVATE KEY-----',
    ].join('\n')
    const redacted = redactSensitiveCrmData(sample)
    assert.equal(redacted.changed, true)
    assert.ok(!redacted.text.includes('MySuperSecretPassword!123'))
    assert.ok(!redacted.text.includes('sk-live-1234567890abcdefghijklmnop'))
    assert.ok(!redacted.text.includes('UltraSecretDbPass99'))
    assert.ok(!redacted.text.includes('MIIEvgIBADADBgkqhkiG9w0BAQEFAASCBKgw'))
  })
})
