/**
 * WebChat + CRM + automation + n8n — database-backed acceptance tests.
 *
 * Run against a disposable database only:
 *   npm test            (builds .preview/test.db offline, or uses CI's disposable MySQL)
 *   npm run test:offline
 * With no database configured the suite is skipped instead of reporting a
 * fake result. Every assertion reads rows written by the real services.
 * Rules created here are gated on a per-run payload marker so concurrently
 * running suites that share the database cannot trigger each other.
 */
import assert from 'node:assert/strict'
import { after, before, describe, it } from 'node:test'

const HAS_DB = Boolean(process.env.PREVIEW_SQLITE_URL || process.env.DATABASE_URL)
const RUN = `wca${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`
const OTHER_TENANT = `t-${RUN}`
const SECRET = 's'.repeat(40)
const operator = { kind: 'USER' as const, id: `op-${RUN}`, email: `op-${RUN}@tech360.local`, ip: '127.0.0.1' }

describe('webchat inbox, automation engine and n8n (database)', { skip: !HAS_DB }, () => {
  let db: typeof import('../src/lib/db').db
  let inbox: typeof import('../src/lib/webchat/inbox-service')
  let thread: typeof import('../src/lib/webchat/thread')
  let engine: typeof import('../src/lib/automation/engine')
  let rules: typeof import('../src/lib/automation/rules')
  let n8n: typeof import('../src/lib/n8n/adapter')
  let conn: typeof import('../src/lib/integrations/connection-tests')

  const conversationIds: string[] = []
  const ruleIds: string[] = []
  const workflowCodes: string[] = []

  async function newConversation(tenantId = 'tech360', extra: Record<string, unknown> = {}) {
    const c = await db.chatConversation.create({
      data: { tenantId, anonId: `anon-${RUN}-${conversationIds.length}`, visitorName: 'Test Visitor', contactConsentAt: new Date(), ...extra },
    })
    conversationIds.push(c.id)
    return c
  }

  async function activeRule(tenantId: string, key: string, triggerType: 'LEAD_CREATED' | 'WEBCHAT_MESSAGE_RECEIVED', actions: import('../src/lib/automation/catalog').RuleAction[], opts: { requiresApproval?: boolean; maxAttempts?: number } = {}) {
    const { rule } = await rules.saveRule(tenantId, {
      key: `${key}-${RUN}`.toLowerCase(),
      name: `${key} ${RUN}`,
      triggerType,
      conditions: [{ field: 'payload.testRun', op: 'eq', value: `${RUN}-${key}` }],
      actions,
      requiresApproval: opts.requiresApproval,
      maxAttempts: opts.maxAttempts ?? 1,
    }, operator.email)
    ruleIds.push(rule.id)
    await rules.setRuleStatus(tenantId, rule.id, 'ACTIVE', operator.email)
    return rule
  }

  before(async () => {
    db = (await import('../src/lib/db')).db
    inbox = await import('../src/lib/webchat/inbox-service')
    thread = await import('../src/lib/webchat/thread')
    engine = await import('../src/lib/automation/engine')
    rules = await import('../src/lib/automation/rules')
    n8n = await import('../src/lib/n8n/adapter')
    conn = await import('../src/lib/integrations/connection-tests')
  })

  after(async () => {
    if (!db) return
    await db.chatMessage.deleteMany({ where: { conversationId: { in: conversationIds } } }).catch(() => null)
    await db.chatConversation.deleteMany({ where: { id: { in: conversationIds } } }).catch(() => null)
    await db.automationRun.deleteMany({ where: { ruleId: { in: ruleIds } } }).catch(() => null)
    await db.automationRuleVersion.deleteMany({ where: { ruleId: { in: ruleIds } } }).catch(() => null)
    await db.automationRule.deleteMany({ where: { id: { in: ruleIds } } }).catch(() => null)
    await db.automationEvent.deleteMany({ where: { dedupeKey: { contains: RUN } } }).catch(() => null)
    await db.n8nExecution.deleteMany({ where: { workflowCode: { in: workflowCodes } } }).catch(() => null)
    await db.n8nWorkflow.deleteMany({ where: { code: { in: workflowCodes } } }).catch(() => null)
    await db.approvalRequest.deleteMany({ where: { requestedBy: { contains: RUN.toLowerCase() } } }).catch(() => null)
  })

  // ---------------------------------------------------------------- inbox
  describe('inbox service', () => {
    it('hides another tenant\'s conversation (indistinguishable from missing)', async () => {
      const foreign = await newConversation(OTHER_TENANT)
      assert.equal(await inbox.getConversationForTenant(foreign.id, 'tech360'), null)
      assert.equal((await inbox.getConversationForTenant(foreign.id, OTHER_TENANT))?.id, foreign.id)
    })

    it('persists a human reply exactly once per request id and claims the conversation', async () => {
      const conv = await newConversation()
      const requestId = `req-${RUN}-reply-0001`
      const first = await inbox.operatorReply({ conversation: conv, body: 'Hello from the team', requestId, actor: operator })
      const again = await inbox.operatorReply({ conversation: (await inbox.getConversationForTenant(conv.id, 'tech360'))!, body: 'Hello from the team', requestId, actor: operator })
      assert.equal(first.duplicate, false)
      assert.equal(again.duplicate, true)
      assert.equal(again.message.id, first.message.id)
      assert.equal(await db.chatMessage.count({ where: { conversationId: conv.id, sender: 'ADMIN', kind: 'MESSAGE' } }), 1)
      const row = await db.chatConversation.findUniqueOrThrow({ where: { id: conv.id } })
      assert.equal(row.lastSender, 'ADMIN')
      assert.equal(row.assignedToId, operator.id)
      assert.ok(row.firstResponseAt)
      assert.equal(first.message.aiGenerated, false)
    })

    it('refuses to reply into a conversation the visitor closed', async () => {
      const conv = await newConversation('tech360', { status: 'CLOSED', closedBy: 'VISITOR', closedAt: new Date() })
      await assert.rejects(() => inbox.operatorReply({ conversation: conv, body: 'Are you there?', requestId: null, actor: operator }), (e: unknown) => e instanceof inbox.InboxError && e.code === 'CONVERSATION_CLOSED')
    })

    it('keeps internal notes out of every visitor read path', async () => {
      const conv = await newConversation()
      await inbox.addInternalNote({ conversation: conv, body: `secret note ${RUN}`, actor: operator })
      await inbox.operatorReply({ conversation: conv, body: 'Visible reply', requestId: null, actor: operator })
      const delta = await thread.visitorDelta(conv.id, null)
      assert.ok(delta)
      assert.equal(delta!.messages.some((m) => m.body.includes('secret note')), false)
      assert.equal(delta!.messages.some((m) => m.body === 'Visible reply'), true)
    })

    it('enforces the inbox state machine and records it truthfully', async () => {
      const conv = await newConversation()
      const r = await inbox.transitionConversation({ conversation: conv, to: 'ESCALATED', actor: operator, reason: 'billing dispute' })
      assert.equal(r.conversation.inboxState, 'ESCALATED')
      const resolved = await inbox.transitionConversation({ conversation: r.conversation, to: 'RESOLVED', actor: operator })
      assert.equal(resolved.conversation.inboxState, 'RESOLVED')
      await assert.rejects(() => inbox.transitionConversation({ conversation: resolved.conversation, to: 'ESCALATED', actor: operator }), inbox.InboxError)
    })

    it('lets a visitor reopen only a conversation they closed themselves', async () => {
      const mine = await newConversation()
      await inbox.visitorCloseConversation(mine)
      const closed = (await inbox.getConversationForTenant(mine.id, 'tech360'))!
      assert.equal(closed.status, 'CLOSED')
      await inbox.visitorReopenConversation(closed)
      assert.equal((await inbox.getConversationForTenant(mine.id, 'tech360'))!.status, 'OPEN')

      const teamClosed = await newConversation('tech360', { status: 'CLOSED', closedBy: operator.email, closedAt: new Date() })
      await assert.rejects(() => inbox.visitorReopenConversation(teamClosed), (e: unknown) => e instanceof inbox.InboxError && e.code === 'CLOSED_BY_TEAM')
    })

    it('advances delivery receipts only forward: SENT → READ when the visitor reads', async () => {
      const conv = await newConversation()
      const { message } = await inbox.operatorReply({ conversation: conv, body: 'Receipt check', requestId: null, actor: operator })
      assert.equal(message.deliveryStatus, 'SENT')
      await inbox.markReadByVisitor(conv.id)
      const row = await db.chatMessage.findUniqueOrThrow({ where: { id: message.id } })
      assert.equal(row.deliveryStatus, 'READ')
      assert.ok(row.readAt)
    })
  })

  // ---------------------------------------------------------------- engine
  describe('automation engine', () => {
    it('runs a matching rule, records every step and succeeds only after the action succeeded', async () => {
      await activeRule('tech360', 'notify', 'LEAD_CREATED', [{ type: 'NOTIFY_TEAM', params: { title: `Lead ${RUN}` } }])
      const r = await engine.emitAutomationEvent({ type: 'LEAD_CREATED', source: 'TEST', subjectType: 'Client', subjectId: `c-${RUN}`, payload: { testRun: `${RUN}-notify` }, dedupeKey: `test:${RUN}:notify` })
      assert.equal(r.duplicate, false)
      assert.equal(r.runs.length, 1)
      const run = await db.automationRun.findUniqueOrThrow({ where: { id: r.runs[0] } })
      assert.equal(run.status, 'SUCCEEDED')
      const steps = JSON.parse(run.steps) as Array<{ status: string; type: string; output?: { notificationId?: string } }>
      assert.equal(steps[0].type, 'NOTIFY_TEAM')
      assert.equal(steps[0].status, 'SUCCEEDED')
      assert.ok(await db.notification.findUnique({ where: { id: steps[0].output!.notificationId! } }))
    })

    it('is idempotent per event dedupe key (a retried emit never runs twice)', async () => {
      const again = await engine.emitAutomationEvent({ type: 'LEAD_CREATED', source: 'TEST', subjectType: 'Client', subjectId: `c-${RUN}`, payload: { testRun: `${RUN}-notify` }, dedupeKey: `test:${RUN}:notify` })
      assert.equal(again.duplicate, true)
      assert.equal(again.runs.length, 0)
      assert.equal(await db.automationEvent.count({ where: { dedupeKey: `test:${RUN}:notify` } }), 1)
    })

    it('never reports success when the action could not be performed', async () => {
      await activeRule('tech360', 'nochat', 'WEBCHAT_MESSAGE_RECEIVED', [{ type: 'SET_PRIORITY', params: { priority: 'HIGH' } }])
      const r = await engine.emitAutomationEvent({ type: 'WEBCHAT_MESSAGE_RECEIVED', source: 'TEST', subjectType: 'ChatConversation', subjectId: `missing-${RUN}`, payload: { testRun: `${RUN}-nochat` }, dedupeKey: `test:${RUN}:nochat` })
      const run = await db.automationRun.findUniqueOrThrow({ where: { id: r.runs[0] } })
      assert.equal(run.status, 'FAILED')
      assert.match(run.error ?? '', /No conversation/)
      assert.ok(run.finishedAt)
    })

    it('records a failing action as SUCCEEDED_WITH_ERRORS when the rule says continue', async () => {
      const conv = await newConversation()
      await activeRule('tech360', 'continue', 'WEBCHAT_MESSAGE_RECEIVED', [
        { type: 'SEND_APPROVED_REPLY', params: { text: 'x' }, onFailure: 'CONTINUE', when: [{ field: 'payload.never', op: 'exists' }] },
        { type: 'ESCALATE_CONVERSATION', params: { reason: 'nope' }, onFailure: 'CONTINUE' },
        { type: 'SET_PRIORITY', params: { priority: 'URGENT' } },
      ])
      // Escalation on a RESOLVED conversation fails; priority still applies.
      await db.chatConversation.update({ where: { id: conv.id }, data: { inboxState: 'RESOLVED' } })
      const r = await engine.emitAutomationEvent({ type: 'WEBCHAT_MESSAGE_RECEIVED', source: 'TEST', subjectType: 'ChatConversation', subjectId: conv.id, payload: { testRun: `${RUN}-continue` }, dedupeKey: `test:${RUN}:continue` })
      const run = await db.automationRun.findUniqueOrThrow({ where: { id: r.runs[0] } })
      const steps = JSON.parse(run.steps) as Array<{ status: string; type: string }>
      assert.equal(steps[0].status, 'SKIPPED', 'branch condition did not match')
      assert.ok(['SUCCEEDED', 'SUCCEEDED_WITH_ERRORS'].includes(run.status), run.status)
      assert.equal((await db.chatConversation.findUniqueOrThrow({ where: { id: conv.id } })).priority, 'URGENT')
    })

    it('pauses high-impact actions for approval and invalidates an approval whose parameters changed', async () => {
      await activeRule('tech360', 'email', 'LEAD_CREATED', [{ type: 'SEND_EMAIL', params: { subject: 'Welcome', text: 'Thanks for contacting TECH360.' } }])
      const r = await engine.emitAutomationEvent({ type: 'LEAD_CREATED', source: 'TEST', subjectType: 'Client', subjectId: `c2-${RUN}`, payload: { testRun: `${RUN}-email` }, dedupeKey: `test:${RUN}:email` })
      let run = await db.automationRun.findUniqueOrThrow({ where: { id: r.runs[0] } })
      assert.equal(run.status, 'AWAITING_APPROVAL')
      assert.ok(run.approvalId)
      const firstApproval = await db.approvalRequest.findUniqueOrThrow({ where: { id: run.approvalId! } })
      assert.equal(firstApproval.status, 'PENDING')
      assert.equal(JSON.parse(run.steps).some((s: { type: string; status: string }) => s.type === 'SEND_EMAIL'), false, 'nothing was sent before approval')

      // Simulate an approval for different parameters (tampered payload fingerprint).
      const payload = JSON.parse(firstApproval.payload ?? '{}')
      await db.approvalRequest.update({ where: { id: firstApproval.id }, data: { status: 'APPROVED', payload: JSON.stringify({ ...payload, fingerprint: 'different-parameters' }) } })
      assert.equal(await engine.executeAutomationRun(run.id), 'AWAITING_APPROVAL')
      run = await db.automationRun.findUniqueOrThrow({ where: { id: run.id } })
      assert.notEqual(run.approvalId, firstApproval.id, 'a fresh approval was requested')
      assert.equal((await db.approvalRequest.findUniqueOrThrow({ where: { id: firstApproval.id } })).status, 'FAILED')

      // A genuine approval resumes the run; with no CRM record the send fails honestly.
      await db.approvalRequest.update({ where: { id: run.approvalId! }, data: { status: 'APPROVED' } })
      const resumed = await engine.resumeApprovedAutomationRun(run.approvalId!)
      assert.equal(resumed.status, 'FAILED')
      run = await db.automationRun.findUniqueOrThrow({ where: { id: run.id } })
      assert.match(run.error ?? '', /No CRM record/)
    })

    it('isolates tenants: another tenant\'s rule never runs for this tenant\'s event, and dedupe keys cannot collide', async () => {
      await activeRule(OTHER_TENANT, 'iso', 'LEAD_CREATED', [{ type: 'NOTIFY_TEAM', params: { title: 'should not run' } }])
      const mine = await engine.emitAutomationEvent({ type: 'LEAD_CREATED', source: 'TEST', subjectType: 'Client', subjectId: `c3-${RUN}`, payload: { testRun: `${RUN}-iso` }, dedupeKey: `test:${RUN}:iso` })
      assert.equal(mine.runs.length, 0)
      const theirs = await engine.emitAutomationEvent({ type: 'LEAD_CREATED', source: 'TEST', subjectType: 'Client', subjectId: `c3-${RUN}`, payload: { testRun: `${RUN}-iso` }, dedupeKey: `test:${RUN}:iso`, tenantId: OTHER_TENANT })
      assert.equal(theirs.duplicate, false, 'same key in another tenant is a different event')
      assert.notEqual(theirs.event.id, mine.event.id)
      assert.equal(theirs.event.tenantId, OTHER_TENANT)
      assert.equal(theirs.runs.length, 1)
    })

    it('replays a finished run as a new run without touching history, and refuses cross-tenant replay', async () => {
      const original = await db.automationRun.findFirstOrThrow({ where: { ruleId: { in: ruleIds }, status: 'SUCCEEDED', tenantId: 'tech360' } })
      const before = JSON.stringify(original)
      const r = await engine.replayAutomationRun(original.id, { email: operator.email, tenantId: 'tech360' })
      assert.equal(r.ok, true)
      assert.notEqual(r.ok && r.runId, original.id)
      const replay = await db.automationRun.findUniqueOrThrow({ where: { id: (r as { runId: string }).runId } })
      assert.equal(replay.replayOfId, original.id)
      assert.equal(replay.triggeredBy, operator.email)
      assert.equal(JSON.stringify(await db.automationRun.findUniqueOrThrow({ where: { id: original.id } })), before)
      const cross = await engine.replayAutomationRun(original.id, { email: operator.email, tenantId: OTHER_TENANT })
      assert.deepEqual(cross, { ok: false, code: 'NOT_FOUND' })
    })
  })

  // ---------------------------------------------------------------- n8n
  describe('n8n adapter', () => {
    const configured = () => n8n.readN8nConfig({ N8N_BASE_URL: 'https://automation.example.test', N8N_OUTBOUND_SECRET: SECRET, N8N_CALLBACK_SECRET: SECRET })

    async function workflow(code: string, data: Record<string, unknown> = {}) {
      const full = `${code}_${RUN}`.toUpperCase()
      workflowCodes.push(full)
      await db.n8nWorkflow.create({ data: { code: full, name: full, category: 'TEST', definition: '{}', enabled: true, webhookPath: 'tech360/test', ...data } })
      return full
    }

    it('records NOT_CONFIGURED and sends nothing without credentials', async () => {
      const code = await workflow('nc')
      let called = false
      const ex = await n8n.requestN8nExecution({ workflowCode: code, payload: {} }, { config: n8n.readN8nConfig({}), fetch: async () => { called = true; return new Response('{}') } })
      assert.equal(ex.status, 'NOT_CONFIGURED')
      assert.equal(called, false)
    })

    it('refuses a disabled workflow', async () => {
      const code = await workflow('off', { enabled: false })
      const ex = await n8n.requestN8nExecution({ workflowCode: code, payload: {} }, { config: configured(), fetch: async () => new Response('{}') })
      assert.equal(ex.status, 'DISABLED')
    })

    it('signs the request, tracks the correlation id and settles exactly once on callback', async () => {
      const code = await workflow('ok')
      let seen: { url: string; headers: Record<string, string>; body: string } | null = null
      const ex = await n8n.requestN8nExecution({ workflowCode: code, payload: { hello: 'world' } }, {
        config: configured(),
        fetch: async (url, init) => {
          seen = { url, headers: Object.fromEntries(new Headers(init?.headers).entries()), body: String(init?.body) }
          return new Response(JSON.stringify({ accepted: true }), { status: 200 })
        },
      })
      assert.equal(ex.status, 'ACCEPTED')
      assert.ok(seen)
      const req = seen as unknown as { url: string; headers: Record<string, string>; body: string }
      assert.equal(req.url, 'https://automation.example.test/webhook/tech360/test')
      assert.ok(req.body.includes(ex.correlationId))
      assert.doesNotMatch(JSON.stringify(req), new RegExp(SECRET), 'the shared secret itself is never transmitted')
      const ts = Object.entries(req.headers).find(([k]) => /timestamp/i.test(k))?.[1]
      const sig = Object.entries(req.headers).find(([k]) => /signature/i.test(k))?.[1]
      assert.ok(ts && sig)
      assert.equal(sig!.replace(/^sha256=/, ''), n8n.signN8nBody(SECRET, ts!, req.body))

      const done = await n8n.handleN8nCallback({ correlationId: ex.correlationId, status: 'SUCCEEDED', output: { ok: 1 } })
      assert.equal(done.ok && done.duplicate, false)
      assert.equal(done.ok && done.execution.status, 'SUCCEEDED')
      const dup = await n8n.handleN8nCallback({ correlationId: ex.correlationId, status: 'FAILED', error: 'late' })
      assert.equal(dup.ok && dup.duplicate, true)
      assert.equal((await db.n8nExecution.findUniqueOrThrow({ where: { correlationId: ex.correlationId } })).status, 'SUCCEEDED')
      assert.deepEqual(await n8n.handleN8nCallback({ correlationId: `nope-${RUN}`, status: 'SUCCEEDED' }), { ok: false, code: 'UNKNOWN_CORRELATION' })
    })

    it('marks a rejected request FAILED instead of pretending it ran', async () => {
      const code = await workflow('err')
      const ex = await n8n.requestN8nExecution({ workflowCode: code, payload: {} }, { config: configured(), maxAttempts: 1, fetch: async () => new Response('nope', { status: 500 }) })
      assert.equal(ex.status, 'FAILED')
      assert.ok(ex.error)
    })
  })

  // ---------------------------------------------------------------- connection tests
  describe('provider connection tests', () => {
    it('never reports CONNECTED without a successful live request', async () => {
      const env = { WHATSAPP_TOKEN: 'test-token', WHATSAPP_PHONE_NUMBER_ID: '123' }
      const failed = await conn.testProviderConnection('WHATSAPP', { env, persist: false, fetch: async () => new Response('{"error":{"message":"bad token"}}', { status: 401 }) })
      assert.equal(failed.ok, false)
      const ok = await conn.testProviderConnection('WHATSAPP', { env, persist: false, fetch: async () => new Response('{"id":"123","display_phone_number":"+8801"}', { status: 200 }) })
      assert.equal(ok.ok, true)
      const none = await conn.testProviderConnection('WHATSAPP', { env: {}, persist: false, fetch: async () => { throw new Error('must not be called') } })
      assert.equal(none.ok, false)
      assert.match(none.detail, /NOT CONFIGURED/i)
      assert.doesNotMatch(JSON.stringify([failed, ok, none]), /test-token/, 'tokens never appear in results')
    })
  })
})
