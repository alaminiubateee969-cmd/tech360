/**
 * TECH360 — Evolution Loop policy tests.
 *
 * This is the safety suite for the module that lets the system propose changes
 * to its own governed behaviour. The properties under test are not "does it
 * produce proposals" but:
 *
 *   - the controls that must never move are refused, INCLUDING this policy file
 *   - no actor can approve their own proposal
 *   - risk is computed from the patch, never accepted from the patch, and can
 *     never exceed the surface's declared maximum
 *   - every bound holds at BOTH edges, on every value type
 *   - a heuristic can never be tuned into certainty (ceiling 0.95)
 *   - the loop is deterministic and can never emit an APPLY instruction
 *   - unsupported requests are named and refused, never silently dropped
 *
 * Pure: no database, no network.
 */
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  EVOLUTION_CONTRACT,
  EVOLUTION_SURFACES,
  IMMUTABLE_CONTROLS,
  SURFACE_SPECS,
  UNSUPPORTED_MUTATIONS,
  applyOps,
  assertNotSelfApproval,
  classifyRisk,
  classifyUnsupported,
  isImmutablePath,
  rank,
  touchesImmutableControl,
  validatePatch,
} from '../src/lib/evolution/policy'
import type { EvolutionPatch, EvolutionSurface, PatchOp } from '../src/lib/evolution/policy'
import {
  DEFAULT_HEURISTICS,
  EVOLUTION_LOOP_STEPS,
  nextGeneration,
  proposeMutations,
  summarizeGeneration,
} from '../src/lib/evolution/loop'
import type { Observation } from '../src/lib/evolution/loop'
// Imported from the PURE field-policy module, not from `surfaces.ts`: surfaces
// reads and writes real rows and so imports `@/lib/db`, which would drag a
// generated Prisma client into a suite that must run with no database.
import { FIELD_ALLOWLIST, assertFieldAllowed, assertPatchWritable } from '../src/lib/evolution/field-policy'

/** Builds a patch that satisfies every structural precondition, so a test can
 *  vary exactly one thing and know the failure came from that thing. */
const patch = (surface: EvolutionSurface, ops: PatchOp[], overrides: Partial<EvolutionPatch> = {}): EvolutionPatch => ({
  surface,
  targetKey: 'target.key',
  ops,
  before: { value: 1 },
  after: { value: 2 },
  ...overrides,
})

const set = (path: string, value: string | number | boolean): PatchOp => ({ op: 'set', path, value })
const delta = (path: string, d: number): PatchOp => ({ op: 'delta', path, delta: d })

const observation = (overrides: Partial<Observation>): Observation => ({
  kind: 'FINGERPRINT_FALSE_POSITIVE',
  detail: 'Microsoft Clarity was reported but is not present',
  ref: 'REA-2026-0001',
  subject: 'Microsoft Clarity',
  count: 1,
  at: '2026-11-02T00:00:00.000Z',
  ...overrides,
})

// ------------------------------------------------------------------ controls

describe('evolution: the immutable controls', () => {
  it('protects every control that must never move', () => {
    const ids = IMMUTABLE_CONTROLS.map((c) => c.id)
    for (const required of ['rea.target-policy', 'rea.capture-contract', 'rea.clone-refusal', 'auth.rbac', 'auth.session', 'security.secrets', 'payments.policy', 'approvals.gate', 'ai.gateway', 'audit.log', 'evolution.policy']) {
      assert.ok(ids.includes(required), `${required} must be protected`)
    }
  })

  it('protects this policy file from being edited by the loop itself', () => {
    const self = IMMUTABLE_CONTROLS.find((c) => c.id === 'evolution.policy')
    assert.ok(self, 'the policy must protect itself')
    assert.ok(self!.path.includes('src/lib/evolution/policy.ts'))
    assert.ok(self!.why.includes('Otherwise the boundary is only a suggestion'))
  })

  it('protects the SSRF guard and the clone refusal as legal/security controls', () => {
    const ssrf = IMMUTABLE_CONTROLS.find((c) => c.id === 'rea.target-policy')
    assert.ok(ssrf!.path.includes('src/lib/rea/target-policy.ts'))
    assert.ok(ssrf!.why.includes('metadata service'), 'names the actual risk')
    const clone = IMMUTABLE_CONTROLS.find((c) => c.id === 'rea.clone-refusal')
    assert.ok(clone!.why.includes('legal control, not a preference'))
  })

  it('explains every control and points at real source paths', () => {
    for (const control of IMMUTABLE_CONTROLS) {
      assert.ok(control.label.length > 4, `${control.id} needs a human label`)
      assert.ok(control.why.length > 30, `${control.id} must explain why`)
      assert.ok(control.path.includes('src/'), `${control.id} must cite a path`)
    }
  })

  it('blocks a proposal that names a control, in its path or its text', () => {
    assert.equal(touchesImmutableControl({ path: 'src/lib/rea/target-policy.ts' }).blocked, true)
    assert.equal(touchesImmutableControl({ text: 'rewrite the approval gate' }).blocked, true)
    assert.equal(touchesImmutableControl({ text: 'audit.log' }).blocked, true)
    assert.equal(touchesImmutableControl({ path: 'fingerprint.minConfidenceToReport' }).blocked, false)
    assert.equal(touchesImmutableControl({ text: 'raise the reporting floor' }).blocked, false)
    const blocked = touchesImmutableControl({ text: 'disable the ssrf policy' })
    assert.equal(blocked.blocked, true)
    assert.ok(blocked.reason.includes('immutable control'))
    assert.ok(blocked.control, 'names which control was hit')
  })

  it('refuses control-shaped paths inside a surface value', () => {
    const protectedFragments = [
      'password', 'secret', 'token', 'api_key', 'credential', 'private_key', 'signature',
      'role', 'permissions', 'capabilities', 'minRole',
      'allowlist', 'blocklist', 'ssrf', 'rateLimit', 'maxBytes',
      'amount', 'price', 'total', 'refund', 'iban', 'card',
      'requiresApproval', 'gate', 'bypass', 'override',
    ]
    for (const fragment of protectedFragments) {
      const verdict = isImmutablePath(`settings.${fragment}.value`)
      assert.equal(verdict.immutable, true, `${fragment} must be refused`)
      assert.ok(verdict.reason.includes('protected control pattern'))
    }
    // Ordinary tunable keys are allowed.
    for (const allowed of ['confidence', 'threshold', 'priority', 'quality', 'timeoutMs', 'retries', 'renderModel.spaShellWordThreshold']) {
      assert.equal(isImmutablePath(allowed).immutable, false, `${allowed} must be writable`)
    }
  })

  it('refuses a path that is a filesystem path rather than a value key', () => {
    assert.equal(isImmutablePath('/etc/passwd').immutable, true)
    assert.equal(isImmutablePath('../../secret').immutable, true)
    assert.equal(isImmutablePath('').immutable, true)
    assert.ok(isImmutablePath('/tmp/x').reason.includes('never filesystem paths'))
  })

  it('names every unsupported mutation and refuses requests for it', () => {
    const ids = UNSUPPORTED_MUTATIONS.map((m) => m.id)
    for (const required of ['source-code', 'shell', 'dependencies', 'filesystem', 'self-approval', 'guard-relaxation', 'visibility']) {
      assert.ok(ids.includes(required), `${required} must be named`)
    }
    for (const m of UNSUPPORTED_MUTATIONS) {
      assert.ok(m.request.length > 10)
      assert.ok(m.refusal.length > 40, `${m.id} must explain why`)
    }
  })

  it('recognises an unsupported request phrased naturally', () => {
    const cases: Array<[string, string]> = [
      ['edit its own source code to fix this', 'source-code'],
      ['modify the source code', 'source-code'],
      ['run a shell command to restart', 'shell'],
      ['execute a migration', 'shell'],
      ['add a dependency on lodash', 'dependencies'],
      ['install a package', 'dependencies'],
      ['approve its own proposal', 'self-approval'],
      ['approve itself', 'self-approval'],
      ['relax the rate limit', 'guard-relaxation'],
      ['disable the guard', 'guard-relaxation'],
      ['increase the byte cap', 'guard-relaxation'],
      ['publish this publicly on the website', 'visibility'],
    ]
    for (const [request, expected] of cases) {
      const verdict = classifyUnsupported(request)
      assert.equal(verdict.unsupported, true, `"${request}" must be refused`)
      assert.equal(verdict.id, expected, `"${request}" → ${verdict.id}, expected ${expected}`)
      assert.ok(verdict.refusal.length > 40)
    }
  })

  it('does not refuse an ordinary governed request', () => {
    for (const allowed of ['raise the fingerprint reporting floor', 'append operator guidance to the outreach prompt', 'add a retry to the slow skill']) {
      assert.equal(classifyUnsupported(allowed).unsupported, false, `"${allowed}" is a legitimate governed request`)
    }
  })
})

// ------------------------------------------------------------------ surfaces

describe('evolution: the five governed surfaces', () => {
  it('declares exactly five, each with storage and a risk ceiling', () => {
    assert.deepEqual([...EVOLUTION_SURFACES].sort(), ['AGENT_PARAM', 'PLAYBOOK', 'PROMPT_TEMPLATE', 'REA_HEURISTIC', 'SKILL_CONFIG'])
    for (const surface of EVOLUTION_SURFACES) {
      const spec = SURFACE_SPECS[surface]
      assert.ok(spec, `${surface} needs a spec`)
      assert.equal(spec.surface, surface)
      assert.ok(spec.what.length > 40, `${surface} must say what it is`)
      // Names a table or a source path, so a reviewer knows what will change.
      assert.ok(/[A-Z][A-Za-z]+|src\//.test(spec.storage), `${surface} must name a table or a path: ${spec.storage}`)
      assert.ok(Object.keys(spec.bounds).length > 0, `${surface} must be bounded`)
      assert.ok(rank(spec.maxRisk) >= 1)
    }
  })

  it('requires a second approver for the surfaces that move runtime behaviour', () => {
    assert.equal(SURFACE_SPECS.SKILL_CONFIG.requiresSuperAdmin, true)
    assert.equal(SURFACE_SPECS.AGENT_PARAM.requiresSuperAdmin, true)
    assert.equal(SURFACE_SPECS.PROMPT_TEMPLATE.requiresSuperAdmin, false)
    assert.equal(SURFACE_SPECS.REA_HEURISTIC.requiresSuperAdmin, false)
    assert.equal(SURFACE_SPECS.PLAYBOOK.requiresSuperAdmin, false)
  })

  it('caps the money-adjacent and runtime surfaces below CRITICAL only where safe', () => {
    assert.equal(SURFACE_SPECS.PLAYBOOK.maxRisk, 'LOW')
    assert.equal(SURFACE_SPECS.PROMPT_TEMPLATE.maxRisk, 'MEDIUM')
    assert.equal(SURFACE_SPECS.REA_HEURISTIC.maxRisk, 'MEDIUM')
    assert.equal(SURFACE_SPECS.SKILL_CONFIG.maxRisk, 'HIGH')
    assert.equal(SURFACE_SPECS.AGENT_PARAM.maxRisk, 'HIGH')
  })

  it('declares an allowlist per surface, with a note a reviewer can read', () => {
    for (const surface of EVOLUTION_SURFACES) {
      const allowlist = FIELD_ALLOWLIST[surface]
      assert.ok(allowlist, `no allowlist registered for ${surface}`)
      assert.ok(Object.keys(allowlist.editableFields).length > 0, `${surface} must allow something`)
      assert.ok(allowlist.protectedFields.length > 0, `${surface} must protect something`)
      for (const [field, spec] of Object.entries(allowlist.editableFields)) {
        assert.ok(spec.note.length > 10, `${surface}.${field} needs a note for the reviewer`)
        assert.ok(!allowlist.protectedFields.includes(field), `${surface}.${field} cannot be both editable and protected`)
        assert.ok(['string', 'number', 'json'].includes(spec.type))
      }
    }
  })

  it('keeps the writable allowlist consistent with the proposal-time bounds', () => {
    // Two gates validate the same patch. If their bounds drift, a proposal can
    // pass one and fail the other, and the operator sees a contradiction.
    const prompt = FIELD_ALLOWLIST.PROMPT_TEMPLATE.editableFields.template
    assert.deepEqual([prompt.min, prompt.max], SURFACE_SPECS.PROMPT_TEMPLATE.bounds.template)
    assert.deepEqual(
      [FIELD_ALLOWLIST.AGENT_PARAM.editableFields.dailyQuota.min, FIELD_ALLOWLIST.AGENT_PARAM.editableFields.dailyQuota.max],
      SURFACE_SPECS.AGENT_PARAM.bounds.dailyQuota,
    )
    assert.deepEqual(
      [FIELD_ALLOWLIST.PLAYBOOK.editableFields.steps.min, FIELD_ALLOWLIST.PLAYBOOK.editableFields.steps.max],
      SURFACE_SPECS.PLAYBOOK.bounds.steps,
    )
    assert.equal(FIELD_ALLOWLIST.PLAYBOOK.editableFields.steps.itemMax, SURFACE_SPECS.PLAYBOOK.bounds.step[1])
  })

  it('enforces the allowlist bounds on set, append and delta at write time', () => {
    assert.equal(assertPatchWritable('PROMPT_TEMPLATE', [set('priority', 5)]).ok, true)
    assert.equal(assertPatchWritable('PROMPT_TEMPLATE', [set('priority', 99)]).ok, false)
    assert.equal(assertPatchWritable('PROMPT_TEMPLATE', [set('template', 'too short')]).ok, false)
    assert.equal(assertPatchWritable('PROMPT_TEMPLATE', [{ op: 'append', path: 'template', value: 'x'.repeat(24_001) }]).ok, false)
    assert.equal(assertPatchWritable('SKILL_CONFIG', [delta('timeoutMs', 15_000)]).ok, true)
    assert.equal(assertPatchWritable('SKILL_CONFIG', [delta('timeoutMs', 5_000_000)]).ok, false)
    // A delta on a non-numeric field would slide it into a number.
    const wrongType = assertPatchWritable('PROMPT_TEMPLATE', [delta('template', 1)])
    assert.equal(wrongType.ok, false)
    assert.ok(wrongType.reason.includes('numeric delta cannot be applied'))
  })

  it('refuses protected and unknown fields at the accessor layer', () => {
    assert.equal(assertFieldAllowed('PROMPT_TEMPLATE', 'template').ok, true)
    assert.equal(assertFieldAllowed('PROMPT_TEMPLATE', 'priority').ok, true)
    const handler = assertFieldAllowed('SKILL_CONFIG', 'handler')
    assert.equal(handler.ok, false)
    assert.ok(handler.reason.includes('Editable:'), 'the refusal lists what IS editable')
    assert.ok(handler.reason.includes('Protected:'), 'and what is protected')
    assert.equal(assertFieldAllowed('SKILL_CONFIG', 'permissions').ok, false)
    assert.equal(assertFieldAllowed('PROMPT_TEMPLATE', 'nonexistent').ok, false)
  })

  it('refuses a whole patch when any single op is unwritable', () => {
    assert.equal(assertPatchWritable('PROMPT_TEMPLATE', [set('priority', 5)]).ok, true)
    const mixed = assertPatchWritable('PROMPT_TEMPLATE', [set('priority', 5), set('requiresApproval', false)])
    assert.equal(mixed.ok, false)
    assert.ok(mixed.reason.includes('requiresApproval'))
  })

  it('refuses a surface with no accessor rather than guessing', () => {
    const verdict = validatePatch(patch('NOT_A_SURFACE' as EvolutionSurface, [set('x', 1)]))
    assert.equal(verdict.ok, false)
    if (!verdict.ok) assert.equal(verdict.code, 'SURFACE_UNKNOWN')
  })
})

// ------------------------------------------------------------------ validation

describe('evolution: patch validation', () => {
  it('rejects malformed patches before looking at any value', () => {
    const noOps = validatePatch(patch('PROMPT_TEMPLATE', []))
    assert.equal(noOps.ok, false)
    if (!noOps.ok) {
      assert.equal(noOps.code, 'NO_OPS')
      assert.ok(noOps.reason.includes('refused as noise'))
    }

    const tooMany = validatePatch(patch('PROMPT_TEMPLATE', Array.from({ length: 25 }, () => set('priority', 5))))
    assert.equal(tooMany.ok, false)
    if (!tooMany.ok) {
      assert.equal(tooMany.code, 'TOO_MANY_OPS')
      assert.ok(tooMany.reason.includes('cannot be reviewed'))
    }
    assert.equal(validatePatch(patch('PROMPT_TEMPLATE', Array.from({ length: 24 }, () => set('priority', 5)))).ok, true)

    assert.equal(validatePatch(patch('PROMPT_TEMPLATE', [set('priority', 5)], { targetKey: '' })).ok, false)
    assert.equal(validatePatch(patch('PROMPT_TEMPLATE', [set('priority', 5)], { targetKey: 'x'.repeat(161) })).ok, false)
  })

  it('refuses a patch with no before-snapshot, because it could not be reversed', () => {
    const verdict = validatePatch(patch('PROMPT_TEMPLATE', [set('priority', 5)], { before: undefined as unknown as Record<string, unknown> }))
    assert.equal(verdict.ok, false)
    if (!verdict.ok) {
      assert.equal(verdict.code, 'SNAPSHOT_MISSING')
      assert.ok(verdict.reason.includes('cannot be reversed'))
    }
    const noAfter = validatePatch(patch('PROMPT_TEMPLATE', [set('priority', 5)], { after: undefined as unknown as Record<string, unknown> }))
    assert.equal(noAfter.ok, false)
    if (!noAfter.ok) assert.equal(noAfter.code, 'SNAPSHOT_MISSING')
  })

  it('refuses an op targeting an immutable control path', () => {
    const verdict = validatePatch(patch('SKILL_CONFIG', [set('permissions.admin', true)]))
    assert.equal(verdict.ok, false)
    if (!verdict.ok) assert.equal(verdict.code, 'CONTROL_IMMUTABLE')
  })

  it('enforces the prompt priority and quality bounds at both edges', () => {
    assert.equal(validatePatch(patch('PROMPT_TEMPLATE', [set('priority', 5)])).ok, true)
    assert.equal(validatePatch(patch('PROMPT_TEMPLATE', [set('priority', 1)])).ok, true)
    assert.equal(validatePatch(patch('PROMPT_TEMPLATE', [set('priority', 10)])).ok, true)
    assert.equal(validatePatch(patch('PROMPT_TEMPLATE', [set('priority', 0)])).ok, false)
    assert.equal(validatePatch(patch('PROMPT_TEMPLATE', [set('priority', 11)])).ok, false)
    assert.equal(validatePatch(patch('PROMPT_TEMPLATE', [set('quality', 0)])).ok, true)
    assert.equal(validatePatch(patch('PROMPT_TEMPLATE', [set('quality', 1)])).ok, true)
    assert.equal(validatePatch(patch('PROMPT_TEMPLATE', [set('quality', 1.5)])).ok, false)
  })

  it('enforces the template body bounds at BOTH edges, so a prompt cannot be wiped', () => {
    // A 24,000-character ceiling and a 40-character floor: the floor is what
    // stops an evolved value from emptying an agent's instructions.
    assert.equal(validatePatch(patch('PROMPT_TEMPLATE', [set('template', 'x'.repeat(40))])).ok, true)
    assert.equal(validatePatch(patch('PROMPT_TEMPLATE', [set('template', 'x'.repeat(24_000))])).ok, true)

    const tooShort = validatePatch(patch('PROMPT_TEMPLATE', [set('template', 'hi')]))
    assert.equal(tooShort.ok, false, 'a 2-character template must be refused')
    if (!tooShort.ok) assert.equal(tooShort.code, 'VALUE_OUT_OF_BOUNDS')

    const empty = validatePatch(patch('PROMPT_TEMPLATE', [set('template', '')]))
    assert.equal(empty.ok, false, 'an empty template must be refused')

    const tooLong = validatePatch(patch('PROMPT_TEMPLATE', [set('template', 'x'.repeat(24_001))]))
    assert.equal(tooLong.ok, false)
    if (!tooLong.ok) assert.ok(tooLong.reason.includes('character bound'))
  })

  it('refuses script markup in any evolved string value', () => {
    for (const payload of ['<script>alert(1)</script>', '<img onerror="x()">', 'javascript:alert(1)']) {
      const verdict = validatePatch(patch('PROMPT_TEMPLATE', [set('template', `${'a'.repeat(50)} ${payload}`)]))
      assert.equal(verdict.ok, false, `${payload} must be refused`)
      if (!verdict.ok) assert.ok(verdict.reason.includes('must stay inert'))
    }
  })

  it('bounds deltas within the surface delta bound', () => {
    assert.equal(validatePatch(patch('REA_HEURISTIC', [delta('fingerprint.minConfidenceToReport', 0.1)])).ok, true)
    assert.equal(validatePatch(patch('REA_HEURISTIC', [delta('fingerprint.minConfidenceToReport', 0.25)])).ok, true)
    assert.equal(validatePatch(patch('REA_HEURISTIC', [delta('fingerprint.minConfidenceToReport', 0.26)])).ok, false)
    assert.equal(validatePatch(patch('REA_HEURISTIC', [delta('fingerprint.minConfidenceToReport', -0.25)])).ok, true)
    assert.equal(validatePatch(patch('REA_HEURISTIC', [delta('fingerprint.minConfidenceToReport', -0.26)])).ok, false)
    // SKILL_CONFIG has no weightDelta, so it falls back to the numeric bound.
    assert.equal(validatePatch(patch('SKILL_CONFIG', [delta('timeoutMs', 15_000)])).ok, true)
    assert.equal(validatePatch(patch('SKILL_CONFIG', [delta('timeoutMs', 2_000_000)])).ok, false)
  })

  it('bounds skill runtime values', () => {
    assert.equal(validatePatch(patch('SKILL_CONFIG', [set('timeoutMs', 300_000)])).ok, true)
    assert.equal(validatePatch(patch('SKILL_CONFIG', [set('timeoutMs', 300_001)])).ok, false)
    assert.equal(validatePatch(patch('SKILL_CONFIG', [set('timeoutMs', 999)])).ok, false)
    assert.equal(validatePatch(patch('SKILL_CONFIG', [set('retries', 5)])).ok, true)
    assert.equal(validatePatch(patch('SKILL_CONFIG', [set('retries', 6)])).ok, false)
    assert.equal(validatePatch(patch('SKILL_CONFIG', [set('retries', -1)])).ok, false)
  })

  it('bounds the agent quota and model string', () => {
    assert.equal(validatePatch(patch('AGENT_PARAM', [set('dailyQuota', 10_000)])).ok, true)
    assert.equal(validatePatch(patch('AGENT_PARAM', [set('dailyQuota', 10_001)])).ok, false)
    assert.equal(validatePatch(patch('AGENT_PARAM', [set('dailyQuota', 0)])).ok, false)
    assert.equal(validatePatch(patch('AGENT_PARAM', [set('model', 'gpt-5-mini')])).ok, true)
    assert.equal(validatePatch(patch('AGENT_PARAM', [set('model', 'x'.repeat(65))])).ok, false)
  })

  it('bounds playbook steps in count AND in per-step text length', () => {
    const validSteps = Array.from({ length: 40 }, (_, i) => `Step ${i + 1}: do the thing carefully`)
    assert.equal(validatePatch(patch('PLAYBOOK', [set('steps', validSteps as unknown as string)])).ok, true)

    // 41 steps exceeds the [1,40] count bound — an array value must be checked
    // against the bound like any other, or the count limit is decoration.
    const tooMany = Array.from({ length: 41 }, (_, i) => `Step ${i + 1}`)
    assert.equal(validatePatch(patch('PLAYBOOK', [set('steps', tooMany as unknown as string)])).ok, false)

    // A single step longer than the per-step bound must also be refused.
    const longStep = ['x'.repeat(2_001)]
    assert.equal(validatePatch(patch('PLAYBOOK', [set('steps', longStep as unknown as string)])).ok, false)

    const emptySteps: string[] = []
    assert.equal(validatePatch(patch('PLAYBOOK', [set('steps', emptySteps as unknown as string)])).ok, false)
  })
})

describe('evolution: a heuristic can never be tuned into certainty', () => {
  it('caps the confidence ceiling below 1', () => {
    const bounds = SURFACE_SPECS.REA_HEURISTIC.bounds.confidence
    assert.deepEqual(bounds, [0, 0.95])
    assert.equal(validatePatch(patch('REA_HEURISTIC', [set('fingerprint.inferredConfidenceCap', 0.95)])).ok, true)
    const over = validatePatch(patch('REA_HEURISTIC', [set('fingerprint.inferredConfidenceCap', 0.96)]))
    assert.equal(over.ok, false, 'a heuristic must never reach certainty')
    if (!over.ok) assert.equal(over.code, 'VALUE_OUT_OF_BOUNDS')
    assert.equal(validatePatch(patch('REA_HEURISTIC', [set('threshold', 1)])).ok, true)
    assert.equal(validatePatch(patch('REA_HEURISTIC', [set('threshold', 1.01)])).ok, false)
    assert.equal(validatePatch(patch('REA_HEURISTIC', [set('threshold', -0.01)])).ok, false)
  })

  it('keeps the compiled-in defaults inside every declared bound', () => {
    assert.ok(DEFAULT_HEURISTICS.fingerprint.minConfidenceToReport <= 0.95)
    assert.ok(DEFAULT_HEURISTICS.fingerprint.inferredConfidenceCap <= 0.95)
    assert.ok(DEFAULT_HEURISTICS.routes.bundleLiteralConfidence <= 0.95)
    assert.ok(DEFAULT_HEURISTICS.endpoints.literalConfidence <= 0.95)
    assert.ok(DEFAULT_HEURISTICS.reconstruction.confidenceCeiling <= 0.95)
    assert.ok(DEFAULT_HEURISTICS.version >= 1)
    // Defaults must be a valid starting patch target.
    assert.equal(validatePatch(patch('REA_HEURISTIC', [set('fingerprint.minConfidenceToReport', DEFAULT_HEURISTICS.fingerprint.minConfidenceToReport)])).ok, true)
  })

  it('refuses to tune the SSRF or capture bounds through a heuristic path', () => {
    for (const path of ['allowlist', 'ssrf.exempt', 'maxBytes', 'rateLimit.perMinute', 'redirect.follow']) {
      const verdict = validatePatch(patch('REA_HEURISTIC', [set(path, 999)]))
      assert.equal(verdict.ok, false, `${path} must be refused`)
      if (!verdict.ok) assert.equal(verdict.code, 'CONTROL_IMMUTABLE')
    }
  })
})

// ------------------------------------------------------------------ risk

describe('evolution: risk is computed, never self-declared', () => {
  it('has no risk field a caller can set', () => {
    // The patch type carries ops/before/after only — risk is derived.
    const p = patch('PROMPT_TEMPLATE', [set('priority', 5)])
    assert.ok(!('risk' in p), 'a patch cannot declare its own risk')
    assert.ok(!('riskLevel' in p))
  })

  it('ranks surfaces by consequence', () => {
    const op = set('x', 1)
    assert.ok(rank(classifyRisk({ surface: 'PLAYBOOK', ops: [op] }).level) <= rank(classifyRisk({ surface: 'AGENT_PARAM', ops: [op] }).level))
    assert.ok(rank(classifyRisk({ surface: 'PROMPT_TEMPLATE', ops: [op] }).level) <= rank(classifyRisk({ surface: 'SKILL_CONFIG', ops: [op] }).level))
    assert.deepEqual([rank('LOW'), rank('MEDIUM'), rank('HIGH'), rank('CRITICAL')], [1, 2, 3, 4])
  })

  it('escalates on the factors that actually matter', () => {
    const base = classifyRisk({ surface: 'PROMPT_TEMPLATE', ops: [set('priority', 5)] })
    const money = classifyRisk({ surface: 'PROMPT_TEMPLATE', ops: [set('priority', 5)], affectsMoney: true })
    const outbound = classifyRisk({ surface: 'PROMPT_TEMPLATE', ops: [set('priority', 5)], affectsOutboundCommunication: true })
    assert.ok(money.score > base.score, 'money raises the score')
    assert.ok(outbound.score > base.score, 'client-facing wording raises the score')
    assert.ok(money.reasons.some((r) => r.includes('money')))
    assert.ok(outbound.reasons.some((r) => r.includes('reach a client')))
  })

  it('escalates with patch size and with deltas', () => {
    const one = classifyRisk({ surface: 'PROMPT_TEMPLATE', ops: [set('priority', 5)] })
    const many = classifyRisk({ surface: 'PROMPT_TEMPLATE', ops: Array.from({ length: 9 }, () => set('priority', 5)) })
    assert.ok(many.score > one.score)
    assert.ok(many.reasons.some((r) => r.includes('operations in one patch')))

    const withDelta = classifyRisk({ surface: 'PROMPT_TEMPLATE', ops: [delta('priority', 1)] })
    assert.ok(withDelta.score > one.score, 'a delta shifts a tuned value and scores higher')
    assert.ok(withDelta.reasons.some((r) => r.includes('numeric delta')))
  })

  it('notes the SUPER_ADMIN requirement in the score', () => {
    const agent = classifyRisk({ surface: 'AGENT_PARAM', ops: [set('model', 'x')] })
    assert.ok(agent.reasons.some((r) => r.includes('requires SUPER_ADMIN')))
    assert.ok(agent.score >= 5)
  })

  it('caps the level at the surface maximum and says so', () => {
    // PLAYBOOK is capped at LOW: no combination of flags can make a text
    // procedure look like a critical change, and the cap is disclosed.
    const playbook = classifyRisk({
      surface: 'PLAYBOOK',
      ops: Array.from({ length: 12 }, () => set('steps', 'a step')),
      affectsMoney: true,
      affectsOutboundCommunication: true,
    })
    assert.equal(playbook.level, 'LOW')
    assert.ok(playbook.score > 4, 'the raw score is high')
    assert.ok(playbook.reasons.some((r) => r.includes('capped at LOW')), 'the cap is disclosed, not hidden')

    const prompt = classifyRisk({ surface: 'PROMPT_TEMPLATE', ops: Array.from({ length: 12 }, () => set('priority', 5)), affectsMoney: true, affectsOutboundCommunication: true })
    assert.equal(prompt.level, 'MEDIUM', 'PROMPT_TEMPLATE is capped at MEDIUM')
    assert.ok(prompt.score >= 6)
  })

  it('always returns at least one reason so a reviewer sees the basis', () => {
    for (const surface of EVOLUTION_SURFACES) {
      const verdict = classifyRisk({ surface, ops: [set('x', 1)] })
      assert.ok(verdict.reasons.length >= 1)
      assert.ok(verdict.reasons[0].includes(surface))
    }
  })
})

// ------------------------------------------------------------------ apply

describe('evolution: applyOps', () => {
  it('applies set, append, remove and delta on nested paths', () => {
    const result = applyOps({ a: { b: 1 }, s: 'hello' }, [
      set('a.b', 5),
      { op: 'append', path: 's', value: ' world' },
      delta('a.b', 2),
    ])
    assert.deepEqual(result, { a: { b: 7 }, s: 'hello world' })
    assert.deepEqual(applyOps({ a: 1 }, [{ op: 'remove', path: 'a' }]), {})
  })

  it('creates intermediate objects rather than failing', () => {
    assert.deepEqual(applyOps({}, [set('a.b.c', 1)]), { a: { b: { c: 1 } } })
  })

  it('does not mutate the input document', () => {
    const input = { a: { b: 1 } }
    const snapshot = JSON.stringify(input)
    applyOps(input, [set('a.b', 9)])
    assert.equal(JSON.stringify(input), snapshot)
  })

  it('treats a missing numeric field as zero for a delta', () => {
    assert.deepEqual(applyOps({}, [delta('n', 3)]), { n: 3 })
  })

  it('ignores a delta on a non-numeric field instead of corrupting it', () => {
    assert.deepEqual(applyOps({ s: 'text' }, [delta('s', 3)]), { s: 'text' })
  })

  it('skips an empty path rather than writing to the root', () => {
    assert.deepEqual(applyOps({ a: 1 }, [set('', 'x')]), { a: 1 })
  })
})

// ------------------------------------------------------------------ approval

describe('evolution: an actor can never approve their own proposal', () => {
  it('refuses self-approval', () => {
    const verdict = assertNotSelfApproval({ proposedBy: 'user-1', decidedBy: 'user-1' })
    assert.equal(verdict.ok, false)
    if (!verdict.ok) {
      assert.equal(verdict.code, 'SELF_APPROVAL')
      assert.ok(verdict.reason.includes('cannot decide its own proposal'))
    }
  })

  it('is case- and whitespace-insensitive, so a formatting difference cannot bypass it', () => {
    assert.equal(assertNotSelfApproval({ proposedBy: 'Admin@Tech360.local', decidedBy: '  admin@tech360.local ' }).ok, false)
  })

  it('allows two different humans', () => {
    assert.equal(assertNotSelfApproval({ proposedBy: 'user-1', decidedBy: 'user-2' }).ok, true)
  })

  it('refuses when either identity is missing', () => {
    assert.equal(assertNotSelfApproval({ proposedBy: '', decidedBy: 'user-2' }).ok, false)
    assert.equal(assertNotSelfApproval({ proposedBy: 'user-1', decidedBy: '' }).ok, false)
    const verdict = assertNotSelfApproval({ proposedBy: '', decidedBy: '' })
    assert.equal(verdict.ok, false)
    if (!verdict.ok) assert.ok(verdict.reason.includes('required'))
  })
})

// ------------------------------------------------------------------ the loop

describe('evolution: the loop proposes and never applies', () => {
  const run = (observations: Observation[], generation = 7, now = '2026-11-02T00:00:00.000Z') =>
    proposeMutations({ observations, generation, now })

  it('turns a fingerprint false positive into a bounded heuristic patch', () => {
    const result = run([observation({})])
    assert.equal(result.proposals.length, 1)
    const p = result.proposals[0]
    assert.equal(p.surface, 'REA_HEURISTIC')
    assert.equal(p.targetKey, 'rea.heuristics')
    assert.equal(p.patch.ops[0].op, 'set')
    assert.equal(p.patch.ops[0].path, 'fingerprint.minConfidenceToReport')
    const value = (p.patch.ops[0] as { value: number }).value
    assert.ok(value > DEFAULT_HEURISTICS.fingerprint.minConfidenceToReport, 'tightens the floor')
    assert.ok(value <= 0.95, 'and never past the certainty ceiling')
    assert.equal(p.risk.level, 'MEDIUM')
    assert.ok(p.evidence.length === 1)
    assert.ok(p.rollback.includes(String(DEFAULT_HEURISTICS.fingerprint.minConfidenceToReport)), 'says how to undo it')
    assert.ok(p.effect.length > 20)
  })

  it('weights repeat evidence, but never past the ceiling', () => {
    const once = run([observation({ count: 1 })]).proposals[0]
    const thrice = run([observation({ count: 3 })]).proposals[0]
    const v = (p: { patch: EvolutionPatch }) => (p.patch.ops[0] as { value: number }).value
    assert.ok(v(thrice) > v(once), 'more occurrences tighten more')

    // A huge count must still land inside the bound.
    const extreme = run([observation({ count: 10_000 })]).proposals[0]
    assert.ok(v(extreme) <= 0.95)
  })

  it('lowers the floor on a false negative and discloses the trade', () => {
    const result = run([observation({ kind: 'FINGERPRINT_FALSE_NEGATIVE', detail: 'Stripe was present but not reported' })])
    assert.equal(result.proposals.length, 1)
    const value = (result.proposals[0].patch.ops[0] as { value: number }).value
    assert.ok(value < DEFAULT_HEURISTICS.fingerprint.minConfidenceToReport)
    assert.ok(value >= 0)
    assert.ok(result.proposals[0].rationale.includes('trades precision for recall'), 'tells the reviewer what they are accepting')
  })

  it('declines when the floor is already at its ceiling rather than pretending to tighten', () => {
    const heuristics = JSON.parse(JSON.stringify(DEFAULT_HEURISTICS))
    heuristics.fingerprint.minConfidenceToReport = 0.95
    const result = proposeMutations({ observations: [observation({})], heuristics, generation: 1, now: '2026-11-02T00:00:00.000Z' })
    assert.equal(result.proposals.length, 0)
    assert.ok(result.declined.some((d) => d.reason.includes('already at its ceiling')))
  })

  it('tightens the render-model threshold after operator corrections', () => {
    const result = run([observation({ kind: 'TEARDOWN_CORRECTED', detail: 'the shell was described as the product', subject: 'render-model' })])
    assert.equal(result.proposals.length, 1)
    const op = result.proposals[0].patch.ops[0] as { op: string; delta: number }
    assert.equal(op.op, 'delta')
    assert.ok(op.delta > 0 && op.delta <= 60)
    assert.ok(validatePatch(result.proposals[0].patch).ok, 'the generated patch passes its own validator')
  })

  it('lowers reconstruction confidence after rejected rebuilds', () => {
    const result = run([observation({ kind: 'RECONSTRUCTION_REJECTED', detail: 'operator discarded the brief', subject: 'RR-2026-0001' })])
    const op = result.proposals[0].patch.ops[0] as { delta: number }
    assert.ok(op.delta < 0 && op.delta >= -0.15)
    assert.ok(result.proposals[0].rationale.includes('honest number'))
  })

  it('tunes skill configuration, never the skill handler or schemas', () => {
    const failed = run([observation({ kind: 'SKILL_RUN_FAILED', subject: 'outreach-email', detail: 'provider returned 500 twice' })])
    assert.equal(failed.proposals[0].surface, 'SKILL_CONFIG')
    assert.equal(failed.proposals[0].targetKey, 'outreach-email')
    assert.equal((failed.proposals[0].patch.ops[0] as { path: string }).path, 'retries')
    assert.ok(failed.proposals[0].rationale.includes('never its handler, permissions or input/output schemas'))

    const slow = run([observation({ kind: 'SKILL_RUN_SLOW', subject: 'outreach-email', detail: 'timed out at 30s' })])
    assert.equal((slow.proposals[0].patch.ops[0] as { path: string }).path, 'timeoutMs')
    assert.ok(validatePatch(slow.proposals[0].patch).ok)
  })

  it('appends operator guidance to a prompt rather than rewriting it', () => {
    const result = run([observation({ kind: 'OPERATOR_FEEDBACK', surface: 'PROMPT_TEMPLATE', subject: 'outreach.first_touch', detail: 'Keep the opening under two sentences.' })])
    assert.equal(result.proposals.length, 1)
    const op = result.proposals[0].patch.ops[0] as { op: string; value: string }
    assert.equal(op.op, 'append', 'appends, so the original wording stays reviewable')
    assert.ok(op.value.includes('Keep the opening under two sentences.'))
    assert.ok(result.proposals[0].rationale.includes('never a rewrite'))
  })

  it('flags client-facing wording as higher risk', () => {
    const client = run([observation({ kind: 'OPERATOR_FEEDBACK', surface: 'PROMPT_TEMPLATE', subject: 'email.followup', detail: 'Softer tone for the customer email' })])
    const internal = run([observation({ kind: 'OPERATOR_FEEDBACK', surface: 'PROMPT_TEMPLATE', subject: 'internal.notes', detail: 'Softer tone for the internal note' })])
    assert.ok(client.proposals[0].risk.score > internal.proposals[0].risk.score)
  })

  it('records a guard attempt as a refusal, never as a proposal', () => {
    const result = run([observation({ kind: 'GUARD_ATTEMPT', detail: 'attempted to relax the SSRF policy', subject: 'rea.target-policy' })])
    assert.equal(result.proposals.length, 0)
    assert.equal(result.refused.length, 1)
    assert.ok(result.refused[0].reason.includes('immutable control'))
    assert.ok(result.refused[0].reason.includes('Recorded, not proposed'))
  })

  it('declines a refused capture, because the policy was working as designed', () => {
    const result = run([observation({ kind: 'CAPTURE_REFUSED', detail: 'admission refused a metadata endpoint', subject: '169.254.169.254' })])
    assert.equal(result.proposals.length, 0)
    assert.ok(result.declined[0].reason.includes('working as designed'))
    assert.ok(result.declined[0].reason.includes('immutable control'))
    assert.ok(result.declined[0].reason.includes('through review'), 'names the human path')
  })

  it('declines a network failure as an environment outcome, not a behaviour', () => {
    const result = run([observation({ kind: 'CAPTURE_FAILED', detail: 'ECONNRESET from the target', subject: 'https://x.example' })])
    assert.equal(result.proposals.length, 0)
    assert.ok(result.declined[0].reason.includes('environment outcome'))
  })

  it('declines a signal it has no rule for instead of inventing a patch', () => {
    const result = run([observation({ kind: 'OPERATOR_FEEDBACK', surface: 'AGENT_PARAM', subject: 'x', detail: 'something vague' })])
    assert.equal(result.proposals.length, 0)
    assert.ok(result.declined[0].reason.includes('does not invent patches'))
  })

  it('groups repeat observations into one proposal, citing up to six', () => {
    const many = Array.from({ length: 9 }, (_, i) => observation({ ref: `REA-2026-000${i}`, count: 1 }))
    const result = run(many)
    assert.equal(result.proposals.length, 1, 'same subject groups into one proposal')
    assert.equal(result.proposals[0].evidence.length, 6)
    assert.ok((result.proposals[0].patch.ops[0] as { value: number }).value > DEFAULT_HEURISTICS.fingerprint.minConfidenceToReport)
  })

  it('is deterministic: the same observations yield the same proposals in the same order', () => {
    const observations = [
      observation({}),
      observation({ kind: 'SKILL_RUN_SLOW', subject: 'slow-skill', detail: 'timed out' }),
      observation({ kind: 'TEARDOWN_CORRECTED', subject: 'render', detail: 'corrected' }),
    ]
    const a = run(observations)
    const b = run(observations)
    assert.deepEqual(
      a.proposals.map((p) => [p.surface, p.targetKey, p.patch.ops, p.risk.level]),
      b.proposals.map((p) => [p.surface, p.targetKey, p.patch.ops, p.risk.level]),
    )
    assert.deepEqual(a.proposals.map((p) => p.id), b.proposals.map((p) => p.id))
  })

  it('orders proposals highest-risk first so the reviewer looks there first', () => {
    const result = run([
      observation({}), // REA_HEURISTIC → MEDIUM
      observation({ kind: 'SKILL_RUN_FAILED', subject: 'sk', detail: 'failed' }), // SKILL_CONFIG → HIGH
    ])
    assert.equal(result.proposals.length, 2)
    assert.ok(rank(result.proposals[0].risk.level) >= rank(result.proposals[1].risk.level))
    assert.equal(result.proposals[0].surface, 'SKILL_CONFIG')
  })

  it('validates every proposal it emits against the policy', () => {
    const result = run([
      observation({}),
      observation({ kind: 'SKILL_RUN_FAILED', subject: 'sk', detail: 'failed' }),
      observation({ kind: 'TEARDOWN_CORRECTED', subject: 'r', detail: 'c' }),
      observation({ kind: 'RECONSTRUCTION_REJECTED', subject: 'rr', detail: 'd' }),
    ])
    for (const p of result.proposals) {
      assert.equal(validatePatch(p.patch).ok, true, `${p.title} emitted an invalid patch`)
      assert.ok(p.evidence.length > 0, 'no proposal without evidence')
      assert.equal(p.generation, 7)
    }
  })

  it('never emits an instruction to apply', () => {
    const result = run([observation({}), observation({ kind: 'SKILL_RUN_FAILED', subject: 'sk', detail: 'f' })])
    const serialized = JSON.stringify(result).toLowerCase()
    assert.ok(!serialized.includes('"instruction":"apply"'))
    // The loop's own step table marks APPLY as a separate, later stage.
    assert.equal(EVOLUTION_LOOP_STEPS.find((s) => s.step === 'APPLY')?.autonomous, true)
    assert.equal(EVOLUTION_LOOP_STEPS.find((s) => s.step === 'APPROVE')?.autonomous, false)
    assert.equal(EVOLUTION_LOOP_STEPS.find((s) => s.step === 'ROLLBACK')?.autonomous, false)
  })

  it('reports an empty cycle as empty rather than inventing work', () => {
    const result = run([])
    assert.equal(result.proposals.length, 0)
    assert.equal(result.declined.length, 0)
    assert.equal(result.refused.length, 0)
  })
})

describe('evolution: generation accounting', () => {
  const base = { generation: 3, parentGeneration: 2, observations: 12, startedAt: '2026-11-01T00:00:00.000Z', now: '2026-11-02T00:00:00.000Z' }

  it('advances the generation number deterministically', () => {
    assert.equal(nextGeneration(0), 1)
    assert.equal(nextGeneration(7), 8)
    assert.equal(nextGeneration(7.9), 8)
    assert.equal(nextGeneration(-5), 1, 'a nonsense current value restarts rather than going backwards')
    assert.equal(nextGeneration(Number.NaN), 1)
  })

  it('counts only what happened', () => {
    const summary = summarizeGeneration({
      ...base,
      proposals: [
        { status: 'APPLIED', surface: 'REA_HEURISTIC' },
        { status: 'REJECTED', surface: 'SKILL_CONFIG' },
        { status: 'ROLLED_BACK', surface: 'PROMPT_TEMPLATE' },
        { status: 'PENDING', surface: 'AGENT_PARAM' },
      ],
    })
    assert.equal(summary.proposed, 4)
    assert.equal(summary.applied, 1)
    assert.equal(summary.rejected, 1)
    assert.equal(summary.rolledBack, 1)
    assert.deepEqual(summary.surfaces, ['REA_HEURISTIC'], 'surfaces lists only what was actually applied')
    assert.equal(summary.parentGeneration, 2)
  })

  it('says plainly when the agent did not change', () => {
    const summary = summarizeGeneration({ ...base, proposals: [{ status: 'REJECTED', surface: 'SKILL_CONFIG' }] })
    assert.equal(summary.applied, 0)
    assert.ok(summary.summary.includes('applied nothing'))
    assert.ok(summary.summary.includes('The agent did not change.'))
    assert.deepEqual(summary.surfaces, [])
  })

  it('does not count a rolled-back change as an applied one', () => {
    const summary = summarizeGeneration({ ...base, proposals: [{ status: 'ROLLED_BACK', surface: 'REA_HEURISTIC' }] })
    assert.equal(summary.applied, 0)
    assert.equal(summary.rolledBack, 1)
    assert.ok(summary.summary.includes('applied nothing'))
  })

  it('closes a generation only once something is resolved', () => {
    const open = summarizeGeneration({ ...base, proposals: [{ status: 'PENDING', surface: 'REA_HEURISTIC' }] })
    assert.equal(open.closedAt, null, 'still awaiting a decision')
    const closed = summarizeGeneration({ ...base, proposals: [{ status: 'APPLIED', surface: 'REA_HEURISTIC' }] })
    assert.equal(closed.closedAt, '2026-11-02T00:00:00.000Z')
  })
})

describe('evolution: the published contract matches the code', () => {
  it('states the boundary in terms the code actually enforces', () => {
    const joined = EVOLUTION_CONTRACT.join(' ')
    assert.ok(joined.includes('never writes, patches, executes or deletes application source code'))
    assert.ok(joined.includes('never runs a command'))
    assert.ok(joined.includes('proposing actor can never be the deciding actor'))
    assert.ok(joined.includes('validated AGAIN at apply time'))
    assert.ok(joined.includes('reversible in one call'))
    assert.ok(joined.includes('never self-declared'))
  })

  it('names the real number of immutable controls', () => {
    const joined = EVOLUTION_CONTRACT.join(' ')
    assert.ok(joined.includes(`${IMMUTABLE_CONTROLS.length} registered controls`))
    assert.ok(IMMUTABLE_CONTROLS.length >= 11)
  })

  it('publishes a loop whose human-required steps are exactly approval and rollback', () => {
    assert.deepEqual(EVOLUTION_LOOP_STEPS.map((s) => s.step), ['OBSERVE', 'PROPOSE', 'GATE', 'APPROVE', 'APPLY', 'VERIFY', 'ROLLBACK'])
    const human = EVOLUTION_LOOP_STEPS.filter((s) => !s.autonomous).map((s) => s.step)
    assert.deepEqual(human, ['APPROVE', 'ROLLBACK'])
    assert.ok(EVOLUTION_LOOP_STEPS.find((s) => s.step === 'APPROVE')!.what.includes('proposer can never be the approver'))
  })
})
