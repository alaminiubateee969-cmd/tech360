/**
 * TECH360 — skill registry and logical agent catalogue tests.
 *
 * The headline test is EXHAUSTIVE: every one of the 10,010 catalogue
 * entries is executed against its real handler with a schema-valid
 * input, and the output is checked against its declared output schema.
 * That is the evidence behind the "tested" count — it is not a
 * placeholder count.
 */
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { buildSkillCatalog, CAPABILITY_TEMPLATES, SKILL_CATALOG } from '../src/lib/skills/catalog'
import {
  activateSkill,
  canTransition,
  discoverSkills,
  getSkillDefinition,
  KNOWN_SKILL_TESTS,
  rollbackSkill,
  skillOperationalStatus,
  summariseRegistry,
  suspendSkill,
  validateAgainstSchema,
  validateSkillDefinition,
  validateSkillRegistry,
} from '../src/lib/skills/registry'
import { SKILL_HANDLERS, SKILL_HANDLER_KEYS, hasSkillHandler, tokenize } from '../src/lib/skills/primitives'
import { checkPermissions, executeSkill } from '../src/lib/skills/executor'
import {
  buildLogicalAgentCatalogue,
  capabilitiesForRole,
  LOGICAL_AGENT_CATALOGUE,
  ROLE_ARCHETYPES,
  toAgentCatalogueYaml,
  toAgentYaml,
  validateLogicalAgentCatalogue,
} from '../src/lib/agents/catalogue'
import { DEPARTMENTS } from '../src/lib/agents/registry'
import type { JsonSchema, SkillDefinition } from '../src/lib/skills/types'

// ------------------------------------------------------------
// A schema-valid sample input for any declared schema
// ------------------------------------------------------------
function sampleFor(schema: JsonSchema): Record<string, unknown> {
  const sample: Record<string, unknown> = {}
  for (const [key, definition] of Object.entries(schema.properties ?? {})) {
    sample[key] = sampleValue(definition)
  }
  return sample
}

function sampleValue(schema: JsonSchema): unknown {
  switch (schema.type) {
    case 'string': {
      if (schema.enum?.length) return schema.enum[0]
      const text = 'Tech360 review sample text about admission and payment 2026-04-01'
      return schema.maxLength ? text.slice(0, schema.maxLength) : text
    }
    case 'number':
    case 'integer':
      return schema.minimum ?? 1
    case 'boolean':
      return true
    case 'array':
      return schema.items ? [sampleValue(schema.items)] : []
    case 'object':
      return sampleFor(schema)
    default:
      return null
  }
}

// ============================================================
describe('skill catalogue — shape and scale', () => {
  it('registers 10,010 skills across 110 departments', () => {
    assert.equal(SKILL_CATALOG.length, 10010)
    assert.equal(DEPARTMENTS.length, 110)
    const departments = new Set(SKILL_CATALOG.map((s) => s.departmentCode))
    assert.equal(departments.size, 110)
    const perDepartment = SKILL_CATALOG.length / departments.size
    assert.equal(perDepartment, 91)
  })

  it('is deterministic — the same catalogue is produced on every build', () => {
    const rebuilt = buildSkillCatalog()
    assert.equal(rebuilt.length, SKILL_CATALOG.length)
    assert.deepEqual(
      rebuilt.map((s) => s.id),
      SKILL_CATALOG.map((s) => s.id),
    )
  })

  it('gives every skill a unique id and a unique slug form', () => {
    const ids = new Set(SKILL_CATALOG.map((s) => s.id))
    assert.equal(ids.size, SKILL_CATALOG.length)
  })

  it('declares permissions, a version, an owner and a test reference for every skill', () => {
    for (const skill of SKILL_CATALOG) {
      assert.ok(skill.permissions.length > 0, `${skill.id} has no permissions`)
      assert.match(skill.version, /^\d+\.\d+\.\d+$/, `${skill.id} has a bad version`)
      assert.ok(skill.owner.length > 0, `${skill.id} has no owner`)
      assert.ok(skill.testRefs.length > 0, `${skill.id} has no test reference`)
      assert.ok(skill.description.length > 20, `${skill.id} has a thin description`)
    }
  })
})

// ============================================================
describe('skill registry — validation', () => {
  it('accepts the whole catalogue with no errors', () => {
    const result = validateSkillRegistry()
    const errors = result.issues.filter((i) => i.severity === 'ERROR')
    assert.equal(errors.length, 0, `catalogue validation errors: ${JSON.stringify(errors.slice(0, 5))}`)
    assert.equal(result.checked, 10010)
  })

  it('rejects a skill with no executable handler', () => {
    const broken: SkillDefinition = { ...SKILL_CATALOG[0], handler: 'does.not.exist' }
    const issues = validateSkillDefinition(broken)
    assert.ok(issues.some((i) => i.code === 'NO_IMPLEMENTATION'))
  })

  it('rejects a skill with no tests, no permissions and a bad version', () => {
    const broken: SkillDefinition = {
      ...SKILL_CATALOG[0],
      version: 'not-a-version',
      testRefs: [],
      permissions: [],
    }
    const issues = validateSkillDefinition(broken)
    const codes = issues.map((i) => i.code)
    assert.ok(codes.includes('INVALID_VERSION'))
    assert.ok(codes.includes('NO_TESTS'))
    assert.ok(codes.includes('NO_PERMISSIONS'))
  })

  it('detects a duplicate skill id', () => {
    const result = validateSkillRegistry([SKILL_CATALOG[0], SKILL_CATALOG[0]])
    assert.ok(result.issues.some((i) => i.code === 'DUPLICATE_ID'))
  })
})

// ============================================================
describe('skill registry — discovery and lifecycle', () => {
  it('finds a skill by id and by free text', () => {
    const definition = getSkillDefinition(SKILL_CATALOG[42].id)
    assert.ok(definition)
    const found = discoverSkills({ query: definition!.id })
    assert.ok(found.total >= 1)
    assert.ok(found.results.some((s) => s.id === definition!.id))
  })

  it('paginates deterministically', () => {
    const first = discoverSkills({ limit: 10, offset: 0 })
    const second = discoverSkills({ limit: 10, offset: 10 })
    assert.equal(first.results.length, 10)
    assert.equal(second.results.length, 10)
    assert.notEqual(first.results[0].id, second.results[0].id)
  })

  it('filters by category, department and handler', () => {
    const byCategory = discoverSkills({ category: 'REVENUE' })
    assert.ok(byCategory.total > 0)
    assert.ok(byCategory.results.every((s) => s.category === 'REVENUE'))
    // `text.classify` backs seven capability templates, each in 110
    // departments.
    const byHandler = discoverSkills({ handler: 'text.classify' })
    assert.equal(byHandler.total, 770)
  })

  it('allows activation, suspension and rollback only through legal transitions', () => {
    const definition = SKILL_CATALOG[0]
    assert.equal(canTransition('ACTIVE', 'SUSPENDED'), true)
    assert.equal(canTransition('ACTIVE', 'DRAFT'), false)

    const suspended = suspendSkill(definition, 'quality review in progress')
    assert.equal(suspended.ok, true)
    assert.equal(suspended.skill?.status, 'SUSPENDED')

    const noReason = suspendSkill(definition, '')
    assert.equal(noReason.ok, false)

    const reactivated = activateSkill(suspended.skill!)
    assert.equal(reactivated.ok, true)
    assert.equal(reactivated.skill?.status, 'ACTIVE')

    const rolled = rollbackSkill(definition, '0.9.0', [{ version: '0.9.0', schemaHash: 'x', status: 'ACTIVE' }])
    assert.equal(rolled.ok, true)
    assert.equal(rolled.skill?.version, '0.9.0')

    const missing = rollbackSkill(definition, '9.9.9', [])
    assert.equal(missing.ok, false)
  })

  it('refuses to activate a skill that has no handler', () => {
    const broken: SkillDefinition = { ...SKILL_CATALOG[0], handler: 'missing.handler' }
    const result = activateSkill(broken)
    assert.equal(result.ok, false)
    assert.match(result.error ?? '', /no executable handler/)
  })
})

// ============================================================
describe('skill execution — every catalogue entry really runs', () => {
  it('executes all 10,010 skills and validates every output against its schema', () => {
    const failures: string[] = []
    for (const definition of SKILL_CATALOG) {
      const handler = SKILL_HANDLERS[definition.handler]
      if (!handler) {
        failures.push(`${definition.id}: no handler`)
        continue
      }
      const input = sampleFor(definition.inputSchema)
      let output: Record<string, unknown>
      try {
        output = handler(input, { configuration: definition.configuration, correlationId: 'test' })
      } catch (error) {
        failures.push(`${definition.id}: threw ${(error as Error).message}`)
        continue
      }
      const check = validateAgainstSchema(output, definition.outputSchema)
      if (!check.valid) {
        failures.push(`${definition.id}: ${check.errors.join('; ')}`)
      }
    }
    assert.equal(failures.length, 0, `skill execution failures:\n${failures.slice(0, 10).join('\n')}`)
  })

  it('reports every skill as implemented and tested', () => {
    const summary = summariseRegistry()
    assert.equal(summary.registered, 10010)
    assert.equal(summary.implemented, 10010)
    assert.equal(summary.tested, 10010)
    assert.equal(summary.enabled, 10010)
    assert.equal(summary.operational, 10010)
    assert.equal(summary.departments, 110)
    // 91 capability templates, bound to 20 real executable handlers.
    assert.equal(summary.handlers, SKILL_HANDLER_KEYS.length)
    assert.equal(SKILL_HANDLER_KEYS.length, 20)
    assert.equal(CAPABILITY_TEMPLATES.length, 91)
  })

  it('marks a skill without a handler as not implemented and not operational', () => {
    const broken: SkillDefinition = { ...SKILL_CATALOG[0], handler: 'nope' }
    const status = skillOperationalStatus(broken)
    assert.equal(status.implemented, false)
    assert.equal(status.operational, false)
    assert.match(status.reason ?? '', /handler/)
  })

  it('marks a skill with an unknown test reference as not tested', () => {
    const untested: SkillDefinition = { ...SKILL_CATALOG[0], testRefs: ['skills:not-a-real-test'] }
    const status = skillOperationalStatus(untested)
    assert.equal(status.tested, false)
    assert.equal(status.operational, false)
  })
})

// ============================================================
describe('skill execution — the governed path', () => {
  const definition = SKILL_CATALOG.find((s) => s.handler === 'text.classify')!

  it('refuses to run when a declared permission is not granted', async () => {
    const result = await executeSkill(
      definition,
      { text: 'I need a quotation for a website' },
      { grantedPermissions: ['some.other.permission'], persist: false },
    )
    assert.equal(result.ok, false)
    assert.equal(result.errorCode, 'PERMISSION_DENIED')
  })

  it('refuses to run when the skill is not active', async () => {
    const suspended = { ...definition, status: 'SUSPENDED' as const }
    const result = await executeSkill(
      suspended,
      { text: 'anything' },
      { grantedPermissions: definition.permissions, persist: false },
    )
    assert.equal(result.ok, false)
    assert.equal(result.errorCode, 'SKILL_NOT_ACTIVE')
  })

  it('rejects input that does not match the declared schema', async () => {
    const result = await executeSkill(
      definition,
      { wrongField: 123 },
      { grantedPermissions: definition.permissions, persist: false },
    )
    assert.equal(result.ok, false)
    assert.equal(result.errorCode, 'INVALID_INPUT')
  })

  it('runs and returns a schema-valid output when everything is granted', async () => {
    const result = await executeSkill(
      definition,
      { text: 'I need a quotation for a website package' },
      { grantedPermissions: definition.permissions, persist: false },
    )
    assert.equal(result.ok, true)
    assert.equal(result.errorCode, null)
    assert.ok(result.output)
    assert.equal(typeof result.output!.label, 'string')
  })

  it('reports a timeout instead of hanging', async () => {
    const result = await executeSkill(
      definition,
      { text: 'quote please' },
      {
        grantedPermissions: definition.permissions,
        persist: false,
        timeoutMs: 25,
        handlerOverride: () => new Promise((resolve) => setTimeout(() => resolve({ label: 'LATE' }), 500)) as never,
      },
    )
    assert.equal(result.ok, false)
    assert.equal(result.errorCode, 'SKILL_TIMEOUT')
  })

  it('reports the missing permissions in the refusal message', () => {
    const check = checkPermissions(['a', 'b'], ['a'])
    assert.equal(check.allowed, false)
    assert.deepEqual(check.missing, ['b'])
  })
})

// ============================================================
describe('skill primitives — behaviour', () => {
  it('classifies English and Bangla text', () => {
    const handler = SKILL_HANDLERS['text.classify']
    const configuration = {
      labels: [
        { label: 'ADMISSION', keywords: ['admission', 'university', 'ভর্তি'] },
        { label: 'PRICING', keywords: ['price', 'cost', 'দাম'] },
      ],
    }
    const english = handler({ text: 'I want university admission' }, { configuration, correlationId: 't' })
    assert.equal(english.label, 'ADMISSION')
    const bangla = handler({ text: 'ভর্তির ফি কত' }, { configuration, correlationId: 't' })
    assert.equal(bangla.label, 'ADMISSION')
  })

  it('extracts emails, phones and amounts', () => {
    const handler = SKILL_HANDLERS['entity.extract']
    const result = handler(
      { text: 'Email me at a.student@example.com or call +8801712345678 about USD 1200 due 2026-04-01' },
      { configuration: {}, correlationId: 't' },
    )
    assert.deepEqual(result.emails, ['a.student@example.com'])
    assert.ok((result.phones as string[]).length >= 1)
    assert.ok((result.amounts as string[]).some((a) => a.includes('1200')))
  })

  it('refuses to answer when the evidence does not support it', () => {
    const handler = SKILL_HANDLERS['answer.extract']
    const result = handler(
      { question: 'what is the refund window', evidence: ['The office is open Sunday to Thursday.'] },
      { configuration: { answerThreshold: 0.3 }, correlationId: 't' },
    )
    assert.equal(result.grounded, false)
    assert.equal(result.insufficientEvidence, true)
    // The answer key is absent — "no answer" must never look like "empty answer".
    assert.equal('answer' in result, false)
  })

  it('rejects a non-http URL', () => {
    const handler = SKILL_HANDLERS['url.normalize']
    const result = handler({ url: 'javascript:alert(1)' }, { configuration: {}, correlationId: 't' })
    assert.equal(result.valid, false)
  })

  it('builds a stable deduplication key', () => {
    const handler = SKILL_HANDLERS['record.dedupe_key']
    const configuration = { fields: ['email', 'phone'] }
    const a = handler({ email: 'A@Example.com', phone: '+8801712345678' }, { configuration, correlationId: 't' })
    const b = handler({ email: 'a@example.com', phone: '+8801712345678' }, { configuration, correlationId: 't' })
    assert.equal(a.key, b.key)
  })

  it('tokenises Bangla text', () => {
    const tokens = tokenize('ভর্তি ফি জানতে চাই')
    assert.ok(tokens.length >= 2)
    assert.ok(tokens.includes('ভর্তি'))
  })
})

// ============================================================
describe('logical agent catalogue', () => {
  it('registers 2,200 logical agents across 110 departments', () => {
    assert.equal(LOGICAL_AGENT_CATALOGUE.length, 2200)
    const departments = new Set(LOGICAL_AGENT_CATALOGUE.map((a) => a.department))
    assert.equal(departments.size, 110)
  })

  it('validates with no issues', () => {
    const result = validateLogicalAgentCatalogue()
    assert.equal(result.issues.length, 0, JSON.stringify(result.issues.slice(0, 5)))
  })

  it('is deterministic', () => {
    const rebuilt = buildLogicalAgentCatalogue()
    assert.deepEqual(rebuilt.map((a) => a.id), LOGICAL_AGENT_CATALOGUE.map((a) => a.id))
  })

  it('gives every agent permissions, skills, approvals and limits', () => {
    for (const agent of LOGICAL_AGENT_CATALOGUE) {
      assert.ok(agent.permissions.length > 0, `${agent.id} has no permissions`)
      assert.ok(agent.skills.length > 0, `${agent.id} has no skills`)
      assert.ok(agent.limits.max_tool_calls > 0, `${agent.id} has no tool limit`)
      assert.ok(agent.limits.timeout_seconds > 0, `${agent.id} has no timeout`)
      assert.ok(['cpu_fast', 'cpu_general', 'cpu_quality', 'embedding'].includes(agent.model_profile))
    }
  })

  it('binds every agent to a skill that exists in the skill catalogue', () => {
    const skillIds = new Set(SKILL_CATALOG.map((s) => s.id))
    for (const agent of LOGICAL_AGENT_CATALOGUE) {
      for (const skill of agent.skills) {
        assert.ok(skillIds.has(skill), `${agent.id} names unknown skill ${skill}`)
      }
    }
  })

  it('requires approval for every risky action it declares', () => {
    const risky = ['messaging.send_external', 'crm.leads.bulk_update', 'content.publish', 'documents.delete']
    let declared = 0
    for (const agent of LOGICAL_AGENT_CATALOGUE) {
      for (const action of risky) {
        if (agent.approval_required.includes(action)) declared += 1
      }
    }
    assert.ok(declared > 0, 'no agent declares an approval-gated action')
  })

  it('exports the specification YAML format', () => {
    const yaml = toAgentYaml(LOGICAL_AGENT_CATALOGUE[0])
    assert.match(yaml, /^id: /m)
    assert.match(yaml, /^department: /m)
    assert.match(yaml, /^model_profile: /m)
    assert.match(yaml, /^permissions:\n  - /m)
    assert.match(yaml, /^skills:\n  - /m)
    assert.match(yaml, /^approval_required:/m)
    assert.match(yaml, /^limits:\n  max_tool_calls: \d+/m)
    assert.match(yaml, /^  timeout_seconds: \d+/m)
    assert.match(yaml, /^  max_retries: \d+/m)
  })

  it('exports the whole catalogue as a multi-document YAML stream', () => {
    const yaml = toAgentCatalogueYaml(LOGICAL_AGENT_CATALOGUE.slice(0, 5))
    assert.equal(yaml.split('---\n').length - 1, 5)
  })

  it('gives every skill capability to at least one role archetype', () => {
    // 91 capabilities, 20 role archetypes: the capabilities are dealt
    // out round-robin, so no capability is owned by nobody.
    assert.equal(CAPABILITY_TEMPLATES.length, 91)
    const owned = new Set<string>()
    for (let index = 0; index < ROLE_ARCHETYPES.length; index++) {
      for (const capability of capabilitiesForRole(index)) owned.add(capability.slug)
    }
    assert.equal(owned.size, CAPABILITY_TEMPLATES.length)
    assert.ok(ROLE_ARCHETYPES.length < CAPABILITY_TEMPLATES.length)
  })
})
