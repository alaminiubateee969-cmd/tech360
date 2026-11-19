/**
 * WebChat + CRM + automation + n8n — pure policy tests (no database).
 *
 * Covers the decisions that must hold regardless of storage: message ordering
 * and de-duplication, attachment validation (malicious / spoofed files),
 * abuse screening, inbox state machine, visitor-visible serialisation (AI
 * labelling, internal notes), rule validation and approval policy, retry
 * backoff, n8n callback signature verification, rules-based AI triage
 * (Bangla + English, escalation of sensitive intents) and source-level
 * security invariants (no secrets in the browser, guarded admin routes).
 */
import assert from 'node:assert/strict'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, it } from 'node:test'

import { mergeMessages } from '../src/lib/webchat/client-thread'
import {
  canTransition, isTypingFresh, isVisitorVisible, screenVisitorMessage, toOperatorMessage, toVisitorMessage,
  validateChatAttachment, CHAT_ATTACHMENT_MAX_BYTES, inboxViewWhere, parseInboxView,
} from '../src/lib/webchat/policy'
import {
  approvalFingerprint, evaluateConditions, retryDelayMs, ruleNeedsApproval, validateRule, type RuleAction,
} from '../src/lib/automation/catalog'
import { readN8nConfig, signN8nBody, verifyN8nCallbackSignature } from '../src/lib/n8n/adapter'
import { parseSuggestions, triageText } from '../src/lib/ai-support/assist'
import { providerConfigured } from '../src/lib/integrations/connection-tests'

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13])
const SECRET = 'x'.repeat(40)

describe('webchat thread ordering (mergeMessages)', () => {
  const m = (id: string, createdAt: string, extra: Record<string, unknown> = {}) => ({ id, createdAt, body: id, ...extra })

  it('orders by createdAt then id, so equal timestamps are deterministic', () => {
    const merged = mergeMessages([m('b', '2026-01-01T00:00:01Z')], [m('a', '2026-01-01T00:00:01Z'), m('z', '2026-01-01T00:00:00Z')])
    assert.deepEqual(merged.map((x) => x.id), ['z', 'a', 'b'])
  })

  it('de-duplicates by id and lets the newer copy (e.g. a READ receipt) win', () => {
    const merged = mergeMessages([m('a', '2026-01-01T00:00:00Z', { deliveryStatus: 'SENT' })], [m('a', '2026-01-01T00:00:00Z', { deliveryStatus: 'READ' })])
    assert.equal(merged.length, 1)
    assert.equal((merged[0] as { deliveryStatus?: string }).deliveryStatus, 'READ')
  })

  it('returns the same array when nothing arrives (no re-render churn)', () => {
    const cur = [m('a', '2026-01-01T00:00:00Z')]
    assert.equal(mergeMessages(cur, []), cur)
  })
})

describe('chat attachment validation', () => {
  it('accepts a structurally valid PNG', () => {
    const v = validateChatAttachment(PNG, 'image/png', 'shot.png')
    assert.equal(v.ok, true)
  })

  it('rejects empty, oversized and non-allow-listed files', () => {
    assert.deepEqual(validateChatAttachment(Buffer.alloc(0), 'image/png', 'a.png'), { ok: false, code: 'EMPTY', reason: 'The file is empty.' })
    const big = validateChatAttachment(Buffer.alloc(CHAT_ATTACHMENT_MAX_BYTES + 1), 'image/png', 'a.png')
    assert.equal(big.ok, false)
    assert.equal(!big.ok && big.code, 'TOO_LARGE')
    for (const [mime, name] of [['image/svg+xml', 'a.svg'], ['text/html', 'a.html'], ['application/x-msdownload', 'a.exe'], ['application/zip', 'a.zip']]) {
      const v = validateChatAttachment(Buffer.from('hello'), mime, name)
      assert.equal(!v.ok && v.code, 'TYPE_NOT_ALLOWED', mime)
    }
  })

  it('rejects an executable disguised as an image (malicious attachment)', () => {
    const exe = Buffer.concat([Buffer.from([0x4d, 0x5a, 0x90, 0x00]), Buffer.alloc(64)])
    const v = validateChatAttachment(exe, 'image/png', 'invoice.png')
    assert.equal(v.ok, false)
    assert.equal(!v.ok && v.code, 'MALICIOUS')
  })

  it('rejects a text file carrying script markup or credentials', () => {
    const v1 = validateChatAttachment(Buffer.from('<script>alert(1)</script>'), 'text/plain', 'notes.txt')
    assert.equal(!v1.ok && v1.code, 'MALICIOUS')
    // Assembled at runtime so the fake key never appears literally in a tracked
    // file (CI's secret scan must stay strict and must not need an exception).
    const fakeAwsKey = ['AKIA', 'ABCDEFGHIJKLMNOP'].join('')
    const v2 = validateChatAttachment(Buffer.from(`aws ${fakeAwsKey}`), 'text/plain', 'notes.txt')
    assert.equal(!v2.ok && v2.code, 'MALICIOUS')
  })

  it('rejects a PDF whose bytes are not a PDF', () => {
    const v = validateChatAttachment(Buffer.from('not really a pdf'), 'application/pdf', 'quote.pdf')
    assert.equal(!v.ok && v.code, 'MALICIOUS')
  })
})

describe('abuse screening and typing freshness', () => {
  it('lets normal messages (with a link or two) through', () => {
    assert.deepEqual(screenVisitorMessage('Hi, my site is https://example.com — can you help?'), { ok: true })
  })
  it('blocks link spam and repeated-character floods', () => {
    const spam = Array.from({ length: 6 }, (_, i) => `https://spam${i}.test`).join(' ')
    assert.equal((screenVisitorMessage(spam) as { code?: string }).code, 'LINK_SPAM')
    assert.equal((screenVisitorMessage('a'.repeat(60)) as { code?: string }).code, 'REPEATED_CHARACTERS')
  })
  it('expires typing indicators so a crashed tab never shows typing forever', () => {
    const now = Date.now()
    assert.equal(isTypingFresh(new Date(now - 1000), now), true)
    assert.equal(isTypingFresh(new Date(now - 10_000), now), false)
    assert.equal(isTypingFresh(null, now), false)
    assert.equal(isTypingFresh(new Date(now + 60_000), now), false)
  })
})

describe('inbox state machine and views', () => {
  it('allows the operator workflow and blocks nonsense transitions', () => {
    assert.equal(canTransition('OPEN', 'ESCALATED'), true)
    assert.equal(canTransition('ESCALATED', 'RESOLVED'), true)
    assert.equal(canTransition('RESOLVED', 'OPEN'), true)
    assert.equal(canTransition('RESOLVED', 'ESCALATED'), false)
    assert.equal(canTransition('OPEN', 'OPEN'), false)
  })
  it('parses unknown views to a safe default and scopes MINE to the caller', () => {
    assert.equal(parseInboxView('DROP TABLE'), 'ALL')
    const active = { inboxState: { in: ['OPEN', 'PENDING', 'ESCALATED'] } }
    assert.deepEqual(inboxViewWhere('MINE', 'user-1'), { ...active, assignedToId: 'user-1' })
    assert.deepEqual(inboxViewWhere('UNASSIGNED', 'user-1'), { ...active, assignedToId: null })
    assert.deepEqual(inboxViewWhere('RESOLVED', 'user-1'), { inboxState: 'RESOLVED' })
  })
})

describe('visitor-visible serialisation', () => {
  const base = { id: 'm1', body: 'hello', createdAt: new Date('2026-01-01T00:00:00Z') }
  it('labels AI replies distinctly from human replies', () => {
    assert.equal(toVisitorMessage({ ...base, sender: 'ADMIN', aiGenerated: true }).author, 'AI')
    assert.equal(toVisitorMessage({ ...base, sender: 'ADMIN', aiGenerated: false }).author, 'HUMAN')
    assert.equal(toVisitorMessage({ ...base, sender: 'VISITOR' }).author, 'VISITOR')
  })
  it('never exposes operator identity or internal flags to the visitor', () => {
    const v = toVisitorMessage({ ...base, sender: 'ADMIN', agentEmail: 'ops@tech360.local', internal: false }) as Record<string, unknown>
    assert.equal('agentEmail' in v, false)
    assert.equal('internal' in v, false)
    assert.equal(toOperatorMessage({ ...base, sender: 'ADMIN', agentEmail: 'ops@tech360.local' }).agentEmail, 'ops@tech360.local')
  })
  it('treats internal notes as operator-only', () => {
    assert.equal(isVisitorVisible({ internal: true, kind: 'NOTE' }), false)
    assert.equal(isVisitorVisible({ internal: false, kind: 'NOTE' }), false)
    assert.equal(isVisitorVisible({ internal: false, kind: 'MESSAGE' }), true)
  })
})

describe('automation rule validation and approval policy', () => {
  const email: RuleAction = { type: 'SEND_EMAIL', params: { subject: 'Hi', text: 'Thanks for reaching out' } }
  const notify: RuleAction = { type: 'NOTIFY_TEAM', params: { title: 'New lead' } }

  it('accepts a valid rule and rejects unknown triggers, actions and missing params', () => {
    assert.deepEqual(validateRule({ triggerType: 'LEAD_CREATED', conditions: [], actions: [notify] }), [])
    assert.ok(validateRule({ triggerType: 'NOPE', conditions: [], actions: [notify] }).length > 0)
    assert.ok(validateRule({ triggerType: 'LEAD_CREATED', conditions: [], actions: [{ type: 'RM_RF', params: {} }] }).length > 0)
    assert.ok(validateRule({ triggerType: 'LEAD_CREATED', conditions: [], actions: [{ type: 'NOTIFY_TEAM', params: {} }] }).length > 0)
    assert.ok(validateRule({ triggerType: 'LEAD_CREATED', conditions: [], actions: [{ type: 'SET_PRIORITY', params: { priority: 'WHENEVER' } }] }).length > 0)
  })

  it('requires approval for high-impact actions even when the rule does not ask for it', () => {
    assert.equal(ruleNeedsApproval({ requiresApproval: false, actions: [email] }), true)
    assert.equal(ruleNeedsApproval({ requiresApproval: false, actions: [notify] }), false)
    assert.equal(ruleNeedsApproval({ requiresApproval: true, actions: [notify] }), true)
  })

  it('binds an approval to the exact parameters (changed parameters → different fingerprint)', () => {
    const a = approvalFingerprint({ ruleId: 'r1', ruleVersion: 1, actions: [email], subjectType: 'Client', subjectId: 'c1' })
    const same = approvalFingerprint({ ruleId: 'r1', ruleVersion: 1, actions: [{ params: { text: 'Thanks for reaching out', subject: 'Hi' }, type: 'SEND_EMAIL' }], subjectType: 'Client', subjectId: 'c1' })
    const changed = approvalFingerprint({ ruleId: 'r1', ruleVersion: 1, actions: [{ ...email, params: { ...email.params, text: 'Pay now' } }], subjectType: 'Client', subjectId: 'c1' })
    const otherSubject = approvalFingerprint({ ruleId: 'r1', ruleVersion: 1, actions: [email], subjectType: 'Client', subjectId: 'c2' })
    assert.equal(a, same, 'key order must not matter')
    assert.notEqual(a, changed)
    assert.notEqual(a, otherSubject)
  })

  it('evaluates conditions and branches', () => {
    const ctx = { type: 'WEBCHAT_MESSAGE_RECEIVED', payload: { intent: 'BILLING', priority: 3, tags: 'vip' } }
    assert.equal(evaluateConditions(ctx, [{ field: 'payload.intent', op: 'eq', value: 'BILLING' }]), true)
    assert.equal(evaluateConditions(ctx, [{ field: 'payload.intent', op: 'in', value: ['SALES', 'BILLING'] }]), true)
    assert.equal(evaluateConditions(ctx, [{ field: 'payload.priority', op: 'gt', value: 5 }]), false)
    assert.equal(evaluateConditions(ctx, [{ field: 'payload.missing', op: 'exists' }]), false)
    assert.equal(evaluateConditions(ctx, undefined), true)
  })

  it('backs off exponentially with a cap', () => {
    const d = [1, 2, 3, 4, 5, 6, 7, 8].map(retryDelayMs)
    for (let i = 1; i < d.length; i += 1) assert.ok(d[i] >= d[i - 1])
    assert.ok(d[0] > 0)
    assert.ok(d[d.length - 1] <= 6 * 60 * 60 * 1000)
  })
})

describe('n8n adapter configuration and callback signatures', () => {
  it('reports NOT CONFIGURED with variable NAMES (never values) when env is missing', () => {
    const cfg = readN8nConfig({})
    assert.equal(cfg.configured, false)
    assert.deepEqual(cfg.missing, ['N8N_BASE_URL', 'N8N_OUTBOUND_SECRET (32+ chars)', 'N8N_CALLBACK_SECRET (32+ chars)'])
  })

  it('rejects short secrets and accepts a complete configuration', () => {
    assert.equal(readN8nConfig({ N8N_BASE_URL: 'https://automation.example.test', N8N_OUTBOUND_SECRET: 'short', N8N_CALLBACK_SECRET: SECRET }).configured, false)
    const cfg = readN8nConfig({ N8N_BASE_URL: 'https://automation.example.test/', N8N_OUTBOUND_SECRET: SECRET, N8N_CALLBACK_SECRET: SECRET })
    assert.equal(cfg.configured, true)
    assert.equal(cfg.webhookBase, 'https://automation.example.test/webhook')
    assert.equal(cfg.healthUrl, 'https://automation.example.test/healthz')
  })

  const config = readN8nConfig({ N8N_BASE_URL: 'https://automation.example.test', N8N_OUTBOUND_SECRET: SECRET, N8N_CALLBACK_SECRET: SECRET })
  const body = JSON.stringify({ correlationId: 'n8n_1', status: 'SUCCEEDED' })
  const now = Date.now()
  const ts = String(now)

  it('accepts a correctly signed, fresh callback', () => {
    assert.deepEqual(verifyN8nCallbackSignature({ rawBody: body, signature: signN8nBody(SECRET, ts, body), timestamp: ts, now, config }), { ok: true })
    assert.deepEqual(verifyN8nCallbackSignature({ rawBody: body, signature: `sha256=${signN8nBody(SECRET, ts, body)}`, timestamp: ts, now, config }), { ok: true })
  })

  it('rejects tampered bodies, wrong secrets, stale timestamps and missing configuration', () => {
    const sig = signN8nBody(SECRET, ts, body)
    assert.equal((verifyN8nCallbackSignature({ rawBody: body.replace('SUCCEEDED', 'FAILED'), signature: sig, timestamp: ts, now, config }) as { code?: string }).code, 'BAD_SIGNATURE')
    assert.equal((verifyN8nCallbackSignature({ rawBody: body, signature: signN8nBody('y'.repeat(40), ts, body), timestamp: ts, now, config }) as { code?: string }).code, 'BAD_SIGNATURE')
    assert.equal((verifyN8nCallbackSignature({ rawBody: body, signature: null, timestamp: ts, now, config }) as { code?: string }).code, 'BAD_SIGNATURE')
    const old = String(now - 60 * 60 * 1000)
    assert.equal((verifyN8nCallbackSignature({ rawBody: body, signature: signN8nBody(SECRET, old, body), timestamp: old, now, config }) as { code?: string }).code, 'STALE_TIMESTAMP')
    assert.equal((verifyN8nCallbackSignature({ rawBody: body, signature: sig, timestamp: ts, now, config: readN8nConfig({}) }) as { code?: string }).code, 'N8N_NOT_CONFIGURED')
  })
})

describe('provider configuration is not connection', () => {
  it('requires credentials before a provider counts as configured', () => {
    assert.equal(providerConfigured('WHATSAPP', {}), false)
    assert.equal(providerConfigured('WHATSAPP', { WHATSAPP_TOKEN: 't', WHATSAPP_PHONE_NUMBER_ID: '1' }), true)
    assert.equal(providerConfigured('N8N', {}), false)
  })
})

describe('AI support triage (rules, Bangla + English)', () => {
  it('detects Bangla, English and mixed messages', () => {
    assert.equal(triageText('আমার একটি ওয়েবসাইট দরকার').language, 'bn')
    assert.equal(triageText('I need a website for my restaurant').language, 'en')
    assert.equal(triageText('ami ekta website chai, দাম কত?').language, 'mixed')
  })

  it('escalates refunds, payment disputes and complaints to a human', () => {
    for (const text of ['I want a refund for my payment', 'I paid but the payment is not confirmed', 'আমি টাকা ফেরত চাই', 'This is terrible, I want to complain']) {
      const t = triageText(text)
      assert.equal(t.escalationRecommended, true, text)
      assert.ok(t.escalationReason, text)
    }
  })

  it('classifies a plain sales question without escalating it', () => {
    const t = triageText('Can you build an online store for my clothing business?')
    assert.equal(t.method, 'RULES')
    assert.equal(t.escalationRecommended, false)
  })

  it('splits numbered model output into at most three suggestions', () => {
    assert.deepEqual(parseSuggestions('1. First\n2) Second\ncontinued\n- Third\n4. Fourth'), ['First', 'Second continued', 'Third'])
  })
})

describe('security invariants (source level)', () => {
  const walk = (dir: string): string[] => readdirSync(dir).flatMap((name) => {
    const p = join(dir, name)
    return statSync(p).isDirectory() ? walk(p) : [p]
  })

  it('never reads n8n / provider secrets from browser components', () => {
    for (const file of walk('src/components').filter((f) => /\.(tsx?|jsx?)$/.test(f))) {
      const src = readFileSync(file, 'utf8')
      assert.doesNotMatch(src, /process\.env\.(N8N_|WHATSAPP_TOKEN|SMTP_PASS|FACEBOOK_PAGE_TOKEN|INSTAGRAM_TOKEN)/, file)
    }
  })

  it('guards every automation, n8n and conversation admin route server-side', () => {
    const roots = ['src/app/api/admin/automation', 'src/app/api/admin/n8n', 'src/app/api/admin/conversations', 'src/app/api/admin/integrations']
    const files = roots.flatMap(walk).filter((f) => f.endsWith('route.ts'))
    assert.ok(files.length >= 15, `expected the admin route set, found ${files.length}`)
    for (const file of files) {
      const src = readFileSync(file, 'utf8')
      const handlers = src.match(/export async function (GET|POST|PATCH|PUT|DELETE)\b/g) ?? []
      const guards = src.match(/await guard\(req, \{[^}]*minRole/g) ?? []
      assert.ok(handlers.length > 0, file)
      assert.equal(guards.length, handlers.length, `${file}: every handler must call guard() with a minRole`)
    }
  })

  it('requires a signed visitor session on every visitor chat route that reads a thread', () => {
    for (const file of ['src/app/api/chat/stream/route.ts', 'src/app/api/chat/typing/route.ts', 'src/app/api/chat/conversation/route.ts', 'src/app/api/chat/attachment/route.ts', 'src/app/api/chat/attachment/[id]/route.ts']) {
      assert.match(readFileSync(file, 'utf8'), /resolveVisitorConversation\(/, file)
    }
    assert.match(readFileSync('src/app/api/chat/messages/route.ts', 'utf8'), /chatSessionCookieIsValid\(/)
  })

  it('verifies the n8n callback signature before touching the database', () => {
    const src = readFileSync('src/app/api/webhooks/n8n/callback/route.ts', 'utf8')
    const verify = src.indexOf('verifyN8nCallbackSignature(')
    const handle = src.indexOf('handleN8nCallback(')
    assert.ok(verify > 0 && handle > verify)
  })

  it('never auto-links a typed chat email to an existing customer and never mirrors internal notes', () => {
    const src = readFileSync('src/app/api/admin/conversations/[id]/route.ts', 'utf8')
    const convert = src.slice(src.indexOf("if (action === 'convert-to-lead')"), src.indexOf("if (action === 'link-client')"))
    assert.match(convert, /POSSIBLE_DUPLICATE/)
    assert.match(convert, /raw\.createNew !== true/)
    assert.match(convert, /transcriptMessages\(conversationId\)/)
    assert.match(src, /where: \{ conversationId, \.\.\.VISITOR_VISIBLE_WHERE, kind: 'MESSAGE' \}/)
    assert.match(src, /emitLeadCreated\(/)
    const link = src.slice(src.indexOf("if (action === 'link-client')"))
    assert.match(link, /updateMany\(\{ where: \{ id: conversationId, clientId: null \}/, 'linking is race-safe')
    assert.match(link, /tenantId !== DEFAULT_TENANT_ID/, 'other tenants cannot link to primary-workspace CRM records')
  })

  it('labels AI messages in the visitor widget and keeps honest assistant wording', () => {
    const widget = readFileSync('src/components/site/ChatWidget.tsx', 'utf8')
    assert.match(widget, /TECH360 AI assistant/)
    assert.match(widget, /Your message has not been sent yet/)
    assert.doesNotMatch(widget, /AI agents answer instantly/)
  })
})
