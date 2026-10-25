import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFileSync } from 'node:fs'
import { parseScopeDecision, parsePreviewDecision } from '../src/lib/pipeline/decision-policy'

test('missing, malformed and unknown decisions never approve scope or preview', () => {
  for (const value of [undefined, null, '', ' ', true, 1, {}, ['APPROVED'], 'yes', 'APPROVE', 'typo']) {
    assert.equal(parseScopeDecision(value), null)
    assert.equal(parsePreviewDecision(value), null)
  }
})
test('explicit supported client decisions are accepted', () => {
  assert.equal(parseScopeDecision(' approved '), 'APPROVED')
  assert.equal(parseScopeDecision('REVISION_REQUESTED'), 'REVISION_REQUESTED')
  assert.equal(parseScopeDecision('CLARIFICATION_REQUESTED'), 'CLARIFICATION_REQUESTED')
  assert.equal(parsePreviewDecision('CLARIFICATION_REQUESTED'), null)
  assert.equal(parsePreviewDecision('APPROVED'), 'APPROVED')
})
test('journey HTTP and service boundaries both validate decisions', () => {
  const route = readFileSync('src/app/api/admin/journey/route.ts', 'utf8')
  const service = readFileSync('src/lib/journey.ts', 'utf8')
  for (const parser of ['parseScopeDecision', 'parsePreviewDecision']) {
    assert.ok(route.includes(`${parser}(payload.decision)`))
    assert.ok(service.includes(`const validatedDecision = ${parser}(decision)`))
  }
  assert.ok(!route.includes("decision || 'APPROVED'"))
  assert.ok(service.includes('stage2Sent = scopeRun.sent.deliveries.some((delivery) => delivery.ok)'))
})
test('live pipeline monitoring permits operators and never returns private message bodies', () => {
  const route = readFileSync('src/app/api/admin/pipeline-status/route.ts', 'utf8')
  assert.ok(route.includes('minRole: AI_OPERATOR_MIN_ROLE'))
  assert.ok(route.includes("'Cache-Control': 'private, no-store'"))
  assert.ok(route.includes('status: 503'))
  assert.ok(!route.includes('findMany('))
  const app = readFileSync('src/components/admin/AdminApp.tsx', 'utf8')
  assert.ok(app.includes("agents: 'ADMIN'"))
  assert.ok(app.includes("command: 'ADMIN'"))
})

test('operator command access cannot bypass private workforce data gates', async () => {
  const { commandRequiresSuperAdmin } = await import('../src/lib/pipeline/command-policy')
  for (const action of ['search_memory', 'search_knowledge', 'show_dcc']) assert.equal(commandRequiresSuperAdmin(action), true)
  for (const action of ['show_clients', 'show_projects', 'schedule_meeting', 'show_agent_executions']) assert.equal(commandRequiresSuperAdmin(action), false)
  const source = readFileSync('src/app/api/admin/command/route.ts', 'utf8')
  assert.ok(source.indexOf('commandRequiresSuperAdmin(action)') < source.indexOf('switch (action)'))
  assert.ok(source.includes('where: { sessionId, userId: g.user.id }'))
})
