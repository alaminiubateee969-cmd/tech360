/**
 * TECH360 — AI-EOS workforce tests.
 *
 * These cover the unification work: the organisation, the skills
 * catalogue, the SOP library and its executor, the prompt library and
 * its retriever, the tool registry, the orchestrator, the quality
 * chain, the learning engine, the self-healing ladder, the governance
 * rules, the knowledge graph helpers, the memory rules and the model
 * hub.
 *
 * Everything here runs WITHOUT a database: the modules under test are
 * the pure ones plus the ones whose persistence is explicitly
 * optional. The database-backed paths are covered by the separate
 * integration suite.
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, it } from 'node:test'

import { DEPARTMENTS, CONSTITUTION } from '../src/lib/agents/registry'
import {
  buildOrgChart,
  divisionForCategory,
  DIVISIONS,
  ORG_LEVELS,
  ROLE_LEVEL_PLAN,
  type EmployeeProfile,
} from '../src/lib/agents/org'
import { ROLE_ARCHETYPES, LOGICAL_AGENT_CATALOGUE } from '../src/lib/agents/catalogue'
import { WORKFORCE, workforceStats, validateWorkforce, getEmployee, employeesInDepartment } from '../src/lib/agents/workforce'
import { CAPABILITY_TEMPLATES, DOMAIN_PROFILES, SKILL_CATALOG, departmentSlug } from '../src/lib/skills/catalog'
import { SKILL_HANDLERS, hasSkillHandler } from '../src/lib/skills/primitives'
import { SOP_LIBRARY, SOP_LIBRARY_SIZE, getSop, sopsForDepartment, sopsUsingSkill } from '../src/lib/sops/library'
import { executeSop, resolveDecision, sopSkillId } from '../src/lib/sops/executor'
import { buildPromptsForBinding, PROMPT_STAGES, promptLibraryIndex, renderPrompt, stagesForTask } from '../src/lib/prompts/library'
import { retrievePrompts, scorePrompt, stagesRetrieved } from '../src/lib/prompts/retrieval'
import { TOOL_REGISTRY, checkToolUse, availableTools, validateToolRegistry } from '../src/lib/tools/registry'
import { AGENT_TOOLS, PRIVILEGED_AGENT_TOOLS } from '../src/lib/ai-workforce-policy'
import { buildOrchestrationPlan, classifyTask, selectAgents, scoreCandidate } from '../src/lib/agents/orchestrator'
import { chainDepth, runQualityChain, standardCriteria, averageScore } from '../src/lib/agents/quality'
import { runLearningChain, isProtectedTarget, findPattern } from '../src/lib/agents/learning'
import { classifyFailure, repairPlan, selfHeal } from '../src/lib/agents/self-healing'
import { shouldReflect, reflect } from '../src/lib/agents/reflection'
import { evaluateGovernance, defaultGovernanceRules, ALWAYS_HUMAN_ACTIONS, ruleApplies } from '../src/lib/governance/rules'
import { combineConfidence } from '../src/lib/knowledge/graph'
import { defaultAccessFor, defaultImportance, validateWrite, scoreMemory, MEMORY_RETRIEVAL_CAP } from '../src/lib/memory/system'
import { routeToModel, scoreEntry, MODEL_CATEGORIES, emptyMeasurements } from '../src/lib/model/hub'
import { MODEL_CATALOG } from '../src/lib/model/registry'
import { resolveState } from '../src/lib/agents/availability'
import { assembleContext, fitToBudget, termsOf, CONTEXT_BUDGETS } from '../src/lib/agents/context'

// ------------------------------------------------------------
// Organisation
// ------------------------------------------------------------

describe('organisation', () => {
  it('has nine levels, eight divisions and 110 departments', () => {
    assert.equal(ORG_LEVELS.length, 9)
    assert.equal(DIVISIONS.length, 8)
    assert.equal(DEPARTMENTS.length, 110)
  })

  it('maps every department category to a division', () => {
    for (const department of DEPARTMENTS) {
      const division = divisionForCategory(department.category)
      assert.ok(division.code, `department ${department.code} has no division`)
    }
  })

  it('gives every employee the full attribute set', () => {
    const validation = validateWorkforce()
    assert.equal(validation.valid, true, JSON.stringify(validation.issues.slice(0, 5)))
  })

  it('has more than 2,000 employees and keeps a real reporting line', () => {
    const stats = workforceStats()
    assert.ok(stats.total >= 2000, `expected at least 2,000 employees, got ${stats.total}`)
    assert.equal(stats.departments, 110)
    assert.equal(stats.divisions, 8)
    assert.equal(stats.byLevel.MASTER_AI_CEO, 1)

    for (const employee of WORKFORCE) {
      if (employee.employeeId === 'EMP-MASTER-001') {
        assert.equal(employee.profile.managerEmployeeId, null)
        continue
      }
      assert.ok(employee.profile.managerEmployeeId, `${employee.employeeId} has no manager`)
      assert.ok(getEmployee(employee.profile.managerEmployeeId), `${employee.employeeId} has an orphan manager`)
    }
  })

  it('gives every department employees', () => {
    for (const department of DEPARTMENTS) {
      const employees = employeesInDepartment(department.code)
      assert.ok(employees.length > 0, `department ${department.code} has no employees`)
    }
  })

  it('keeps the Master AI as the pre-existing CEO agent, not a parallel system', () => {
    const master = getEmployee('EMP-MASTER-001')
    assert.ok(master)
    assert.equal(master.profile.levelName, 'MASTER_AI_CEO')
    assert.equal(master.profile.name, 'Atlas')
  })

  it('declares a level plan that covers every role archetype', () => {
    assert.equal(ROLE_LEVEL_PLAN.length, ROLE_ARCHETYPES.length)
    for (const level of ROLE_LEVEL_PLAN) {
      assert.ok(level >= 1 && level <= 9)
    }
  })

  it('assigns every employee a knowledge access, a memory scope and a KPI set', () => {
    for (const employee of WORKFORCE) {
      assert.ok(employee.profile.knowledgeAccess.length > 0, `${employee.employeeId} has no knowledge access`)
      assert.ok(employee.profile.memoryScopes.length > 0, `${employee.employeeId} has no memory scope`)
      assert.ok(employee.profile.kpis.length > 0, `${employee.employeeId} has no KPIs`)
      assert.ok(employee.profile.learningProfile.reviewCadence, `${employee.employeeId} has no review cadence`)
    }
  })
})

// ------------------------------------------------------------
// Skills
// ------------------------------------------------------------

describe('skills catalogue', () => {
  it('has more than 10,000 skills', () => {
    assert.ok(SKILL_CATALOG.length >= 10000, `expected at least 10,000 skills, got ${SKILL_CATALOG.length}`)
  })

  it('gives every skill a registered handler', () => {
    const missing = SKILL_CATALOG.filter((skill) => !hasSkillHandler(skill.handler))
    assert.equal(missing.length, 0, `${missing.length} skills have no handler`)
  })

  it('gives every skill a unique id', () => {
    const seen = new Set<string>()
    for (const skill of SKILL_CATALOG) {
      assert.ok(!seen.has(skill.id), `duplicate skill id ${skill.id}`)
      seen.add(skill.id)
    }
  })

  it('registers 91 capability templates across 110 departments', () => {
    assert.equal(CAPABILITY_TEMPLATES.length, 91)
    assert.equal(SKILL_CATALOG.length, 91 * 110)
  })

  it('exposes a working handler for every primitive the catalogue uses', () => {
    for (const template of CAPABILITY_TEMPLATES) {
      assert.ok(SKILL_HANDLERS[template.primitive], `no handler for ${template.primitive}`)
    }
  })
})

// ------------------------------------------------------------
// SOPs
// ------------------------------------------------------------

describe('SOP library', () => {
  it('has more than 500 procedures', () => {
    assert.ok(SOP_LIBRARY_SIZE >= 500, `expected at least 500 SOPs, got ${SOP_LIBRARY_SIZE}`)
  })

  it('gives every SOP a trigger, steps, validation, a failure path and an escalation', () => {
    for (const sop of SOP_LIBRARY) {
      assert.ok(sop.trigger.length > 0, `${sop.key} has no trigger`)
      assert.ok(sop.steps.length > 0, `${sop.key} has no steps`)
      assert.ok(sop.validation.length > 0, `${sop.key} has no validation`)
      assert.ok(sop.failurePath.length > 0, `${sop.key} has no failure path`)
      assert.ok(sop.escalation.length > 0, `${sop.key} has no escalation`)
      assert.ok(sop.inputs.some((input) => input.required), `${sop.key} has no required input`)
    }
  })

  it('orders the steps and numbers the decision points', () => {
    for (const sop of SOP_LIBRARY) {
      const orders = sop.steps.map((step) => step.order)
      assert.deepEqual(orders, [...orders].sort((a, b) => a - b), `${sop.key} steps are not ordered`)
      for (const decision of sop.decisionPoints) {
        assert.ok(decision.afterStep >= 1 && decision.afterStep <= sop.steps.length, `${sop.key} has a decision after an unknown step`)
      }
    }
  })

  it('only references skills that exist', () => {
    for (const sop of SOP_LIBRARY) {
      for (const step of sop.steps) {
        if (!step.skill) continue
        const id = sopSkillId(sop, step.skill)
        assert.ok(
          SKILL_CATALOG.some((skill) => skill.id === id),
          `${sop.key} step ${step.order} references the unknown skill "${id}"`,
        )
      }
    }
  })

  it('gives every department procedures and every procedure a department', () => {
    for (const department of DEPARTMENTS) {
      assert.ok(sopsForDepartment(department.code).length > 0, `${department.code} has no SOPs`)
    }
    for (const sop of SOP_LIBRARY) {
      assert.ok(getSop(sop.key))
    }
  })

  it('finds the procedures that use a skill', () => {
    const using = sopsUsingSkill('classify_intent')
    assert.ok(using.length > 0)
  })
})

describe('SOP executor', () => {
  // The skills the procedures call require the department's own
  // permission. The permission comes from the domain profile, never
  // from a guess.
  const EXECUTIVE_PERMISSION = DOMAIN_PROFILES.EXECUTIVE.permission

  it('refuses a procedure whose required inputs are missing', async () => {
    const result = await executeSop('D001-INTAKE', { subject: 'only a subject' }, { grantedPermissions: [], persist: false })
    assert.equal(result.ok, false)
    assert.equal(result.errorCode, 'MISSING_INPUTS')
  })

  it('refuses an unknown procedure', async () => {
    const result = await executeSop('NOPE-NOPE', { subject: 'x', identifier: 'y' }, { grantedPermissions: [], persist: false })
    assert.equal(result.errorCode, 'SOP_NOT_FOUND')
  })

  it('runs the steps, records the transcript and reports the declared checks', async () => {
    const result = await executeSop(
      'D001-INTAKE',
      { subject: 'A new enquiry from Acme about a website', identifier: 'ACME-1', payload: { message: 'We need a website for our company.' } },
      { grantedPermissions: [EXECUTIVE_PERMISSION], persist: false },
    )
    assert.ok(result.steps.length > 0, 'the procedure produced no steps')
    assert.ok(result.validation.declaredChecks.length > 0, 'the procedure declared no checks')
    assert.ok(result.correlationId.length > 0)
    // The procedure either succeeded or failed for an honest reason.
    if (!result.ok) {
      assert.ok(result.error, 'a failed procedure carried no reason')
    }
  })

  it('refuses a tool step when no governed tool gateway is supplied', async () => {
    const intake = getSop('D001-INTAKE')!
    assert.ok(intake.steps.some((step) => step.tool), 'the intake procedure has no tool step')
    const result = await executeSop(
      'D001-INTAKE',
      { subject: 'A new enquiry from Acme about a website', identifier: 'ACME-1', payload: { message: 'We need a website for our company.' } },
      { grantedPermissions: [EXECUTIVE_PERMISSION], persist: false },
    )
    assert.equal(result.errorCode, 'TOOL_GATEWAY_UNAVAILABLE')
    assert.ok(result.error?.includes('tool gateway'), 'the refusal did not name the missing gateway')
  })

  it('stops at an approval step and never self-approves', async () => {
    const approval = getSop('D001-APPROVAL')!
    const approvalStep = approval.steps.find((step) => step.requiresApproval)
    assert.ok(approvalStep, 'the approval SOP has no approval step')
    const result = await executeSop(
      'D001-APPROVAL',
      { subject: 'A handover', identifier: 'HO-1', payload: { message: 'A handover for the Acme website project.' } },
      { grantedPermissions: [EXECUTIVE_PERMISSION], persist: false },
    )
    assert.equal(result.status, 'AWAITING_APPROVAL')
    assert.equal(result.errorCode, 'APPROVAL_REQUIRED')
  })

  it('resolves a decision from a real signal and marks an unknown one undetermined', () => {
    assert.equal(resolveDecision({ ok: true }).answer, 'YES')
    assert.equal(resolveDecision({ ok: false }).answer, 'NO')
    assert.equal(resolveDecision({ band: 'PASS' }).answer, 'YES')
    assert.equal(resolveDecision({ band: 'FAIL' }).answer, 'NO')
    assert.equal(resolveDecision({ score: 0.8 }).answer, 'YES')
    assert.equal(resolveDecision({ score: 0.2 }).answer, 'NO')
    assert.equal(resolveDecision({ nothing: true }).answer, 'UNDETERMINED')
    assert.equal(resolveDecision(null).answer, 'UNDETERMINED')
  })
})

// ------------------------------------------------------------
// Prompts
// ------------------------------------------------------------

describe('prompt library', () => {
  it('declares the sixteen stages', () => {
    assert.equal(PROMPT_STAGES.length, 16)
  })

  it('indexes a library of more than 50,000 prompts', () => {
    const index = promptLibraryIndex(ROLE_ARCHETYPES.length)
    assert.ok(index.size > 50000, `expected more than 50,000 prompt slots, got ${index.size}`)
    assert.equal(index.departments, 110)
    assert.equal(index.stages, 16)
    assert.equal(index.languages, 2)
  })

  it('materialises a specialised prompt per stage and language', () => {
    const records = buildPromptsForBinding({
      departmentCode: 'D010',
      roleSlug: 'lead_qualification',
      roleTitle: 'Lead Qualification Agent',
    })
    assert.equal(records.length, PROMPT_STAGES.length * 2)
    for (const record of records) {
      assert.ok(record.template.includes('GLOBAL CONSTITUTION'), 'the prompt carries no constitution')
      assert.ok(record.template.length > 200, 'the prompt is too short to be real')
      assert.ok(!/you are a helpful assistant/i.test(record.template), 'the prompt is generic')
    }
  })

  it('leaves a missing variable visible instead of silently emptying it', () => {
    const rendered = renderPrompt('Hello {{name}} and {{other}}', { name: 'Atlas' })
    assert.ok(rendered.includes('Atlas'))
    assert.ok(rendered.includes('{{other}}'), 'a missing variable was silently removed')
  })

  it('never loads the whole library into a retrieval', () => {
    const retrieved = retrievePrompts({
      departmentCode: 'D010',
      roleSlug: 'lead_qualification',
      roleTitle: 'Lead Qualification Agent',
      language: 'en',
      complexity: 'STANDARD',
      limit: 10,
    })
    assert.ok(retrieved.length > 0)
    assert.ok(retrieved.length <= 10, 'the retriever returned more than its limit')
    assert.ok(retrieved.length < 100, 'the retriever loaded too much')
  })

  it('prefers the department and the role', () => {
    const retrieved = retrievePrompts({
      departmentCode: 'D010',
      roleSlug: 'lead_qualification',
      roleTitle: 'Lead Qualification Agent',
      language: 'en',
      complexity: 'STANDARD',
      limit: 8,
    })
    for (const entry of retrieved) {
      assert.equal(entry.prompt.departmentCode, 'D010')
      assert.equal(entry.prompt.role, 'lead_qualification')
    }
  })

  it('gives every score a reason', () => {
    const [prompt] = buildPromptsForBinding({ departmentCode: 'D010', roleSlug: 'r', roleTitle: 'R' })
    const scored = scorePrompt(prompt, { departmentCode: 'D010', roleSlug: 'r', roleTitle: 'R', complexity: 'STANDARD' })
    assert.ok(scored.reasons.length > 0, 'a score was given without a reason')
  })

  it('scales the stages with the complexity', () => {
    assert.ok(stagesForTask('SIMPLE').length < stagesForTask('STANDARD').length)
    assert.ok(stagesForTask('STANDARD').length < stagesForTask('COMPLEX').length)
    assert.ok(stagesForTask('COMPLEX').length <= stagesForTask('ENTERPRISE').length)
  })

  it('reports the stages it used', () => {
    const retrieved = retrievePrompts({
      departmentCode: 'D010',
      roleSlug: 'r',
      roleTitle: 'R',
      complexity: 'STANDARD',
      limit: 5,
    })
    assert.ok(stagesRetrieved(retrieved).length > 0)
  })
})

// ------------------------------------------------------------
// Tool registry
// ------------------------------------------------------------

describe('tool registry', () => {
  it('describes every tool the policy module allows', () => {
    // `capability:all` is a capability marker, not an invokable tool.
    assert.equal(TOOL_REGISTRY.length, AGENT_TOOLS.length - 1)
    for (const tool of TOOL_REGISTRY) {
      assert.ok(tool.description.length > 0)
      assert.ok(tool.permission.length > 0)
      assert.ok(tool.rateLimitPerMinute > 0)
      assert.ok(tool.auditRequired)
    }
  })

  it('passes its own consistency check', () => {
    const result = validateToolRegistry()
    assert.equal(result.valid, true, JSON.stringify(result.issues.slice(0, 8)))
  })

  it('marks every privileged tool as risky and approval-gated', () => {
    for (const id of PRIVILEGED_AGENT_TOOLS) {
      const tool = TOOL_REGISTRY.find((entry) => entry.id === id)
      assert.ok(tool, `${id} is not in the registry`)
      assert.notEqual(tool.riskLevel, 'LOW', `${id} is privileged but marked LOW`)
      assert.equal(tool.requiresApproval, true, `${id} is privileged but needs no approval`)
    }
  })

  it('refuses a tool the caller was not granted', () => {
    const result = checkToolUse('payment.verify', ['crm.read'])
    assert.equal(result.allowed, false)
    assert.equal(result.code, 'TOOL_NOT_GRANTED')
  })

  it('refuses an unknown tool', () => {
    const result = checkToolUse('not.a.tool', ['crm.read'])
    assert.equal(result.code, 'UNKNOWN_TOOL')
  })

  it('never offers an approval-gated tool as autonomous', () => {
    const tools = availableTools(['comms.email.send', 'finance.payment.verify', 'crm.read'])
    const ids = tools.map((tool) => tool.id)
    assert.ok(!ids.includes('email.send'), 'an approval-gated tool was offered as autonomous')
    assert.ok(!ids.includes('payment.verify'), 'an approval-gated tool was offered as autonomous')
  })
})

// ------------------------------------------------------------
// Orchestrator
// ------------------------------------------------------------

describe('orchestrator', () => {
  it('classifies a question as the fast path', () => {
    const classification = classifyTask({ task: 'What is our refund policy?' })
    assert.equal(classification.path, 'FAST')
    assert.ok(classification.rationale.length > 0)
  })

  it('classifies a strategy request as the complex path', () => {
    const classification = classifyTask({ task: 'Plan a strategy across all departments for next quarter' })
    assert.equal(classification.path, 'COMPLEX')
  })

  it('never uses the fast path for an action that needs approval', () => {
    const classification = classifyTask({ task: 'Send the email to the client', requiresApproval: true })
    assert.notEqual(classification.path, 'FAST')
  })

  it('builds a one-step plan for the fast path and a fan-out for the enterprise path', () => {
    const employees = WORKFORCE.slice(0, 8).map((employee) => ({ employee: employee.profile, score: 50 }))

    const fast = buildOrchestrationPlan({
      task: 'Answer a question',
      classification: classifyTask({ task: 'Answer a question' }),
      employees,
    })
    assert.equal(fast.steps.length, 1)
    assert.equal(fast.steps[0].parallel, false)

    const enterprise = buildOrchestrationPlan({
      task: 'Company-wide strategy',
      classification: {
        type: 'ORCHESTRATION',
        complexity: 'ENTERPRISE',
        path: 'ENTERPRISE',
        confidence: 0.9,
        requiredCapabilities: ['orchestration'],
        requiredTools: [],
        rationale: 'enterprise',
      },
      employees,
    })
    const research = enterprise.steps.filter((step) => step.kind === 'RESEARCH')
    assert.ok(research.length > 1, 'the enterprise path did not fan out')
    assert.ok(research.every((step) => step.parallel))
    assert.ok(enterprise.steps.some((step) => step.kind === 'SYNTHESISE'))
    assert.ok(enterprise.steps.some((step) => step.kind === 'REVIEW'))
    assert.ok(enterprise.steps.some((step) => step.kind === 'EXECUTIVE'))
  })

  it('scores a candidate on capability, permission and availability', () => {
    const employee = WORKFORCE[10].profile
    const candidate = {
      employee,
      availability: 'AVAILABLE' as const,
      successRate: 0.9,
      workload: 0.2,
      meanLatencyMs: 1200,
    }
    const scored = scoreCandidate(candidate, {
      capability: 'crm',
      departmentCode: employee.departmentCode,
      grantedPermissions: ['crm.read'],
      availability: ['AVAILABLE'],
    })
    assert.ok(scored.score > 0)
    assert.ok(scored.reasons.length > 0)
  })

  it('does not give a never-run agent a performance bonus', () => {
    const employee = WORKFORCE[11].profile
    const never = scoreCandidate(
      { employee, availability: 'AVAILABLE', successRate: null, workload: 0, meanLatencyMs: null },
      { capability: 'crm', grantedPermissions: ['crm.read'] },
    )
    const measured = scoreCandidate(
      { employee, availability: 'AVAILABLE', successRate: 1, workload: 0, meanLatencyMs: null },
      { capability: 'crm', grantedPermissions: ['crm.read'] },
    )
    assert.ok(measured.score > never.score, 'a measured agent did not out-score an unmeasured one')
  })

  it('selects the better candidate', () => {
    const employee = WORKFORCE[12].profile
    const selected = selectAgents(
      [
        { employee, availability: 'AVAILABLE', successRate: 0.2, workload: 0.9, meanLatencyMs: 9000 },
        { employee, availability: 'AVAILABLE', successRate: 0.99, workload: 0.05, meanLatencyMs: 300 },
      ],
      { capability: 'crm', grantedPermissions: ['crm.read'], availability: ['AVAILABLE'], limit: 1 },
    )
    assert.equal(selected.length, 1)
    assert.equal(selected[0].successRate, 0.99)
  })
})

// ------------------------------------------------------------
// Quality engine
// ------------------------------------------------------------

describe('quality engine', () => {
  it('runs only the worker for a simple, low-risk task', () => {
    assert.deepEqual(chainDepth({ complexity: 'SIMPLE', risk: 'LOW' }), ['WORKER'])
  })

  it('adds the reviewer for a standard task', () => {
    assert.deepEqual(chainDepth({ complexity: 'STANDARD', risk: 'LOW' }), ['WORKER', 'REVIEWER'])
  })

  it('adds the validator for a complex or high-risk task', () => {
    assert.deepEqual(chainDepth({ complexity: 'COMPLEX', risk: 'LOW' }), ['WORKER', 'REVIEWER', 'VALIDATOR'])
    assert.deepEqual(chainDepth({ complexity: 'SIMPLE', risk: 'CRITICAL' }), ['WORKER', 'REVIEWER', 'VALIDATOR'])
  })

  it('passes a good piece of work and fails a bad one', async () => {
    const good = await runQualityChain({
      task: 'write a summary',
      complexity: 'STANDARD',
      risk: 'LOW',
      worker: async () => ({ ok: true, output: 'The client asked for a website. The estimate is 150000 BDT. Source: the brief.' }),
      reviewer: async (work) => ({ criteria: standardCriteria(work) }),
      persist: false,
    })
    assert.equal(good.ok, true)
    assert.equal(good.failedAt, null)

    const bad = await runQualityChain({
      task: 'write a summary',
      complexity: 'STANDARD',
      risk: 'LOW',
      worker: async () => ({ ok: true, output: 'TODO: write this later' }),
      reviewer: async (work) => ({ criteria: standardCriteria(work) }),
      persist: false,
    })
    assert.equal(bad.ok, false)
    assert.equal(bad.failedAt, 'REVIEWER')
  })

  it('stops at the first failing stage', async () => {
    const result = await runQualityChain({
      task: 'x',
      complexity: 'ENTERPRISE',
      risk: 'CRITICAL',
      worker: async () => ({ ok: true, output: 'ok' }),
      reviewer: async () => ({ criteria: [{ id: 'a', description: 'd', score: 0, evidence: 'failed', blocking: true }] }),
      validator: async () => {
        throw new Error('the validator must not run after a failed review')
      },
      persist: false,
    })
    assert.equal(result.failedAt, 'REVIEWER')
    assert.equal(result.stages.length, 2)
  })

  it('scores an empty criterion set as zero, not one', () => {
    assert.equal(averageScore([]), 0)
  })
})

// ------------------------------------------------------------
// Learning engine
// ------------------------------------------------------------

describe('learning engine', () => {
  it('protects the constitution, the policies, the permissions and the approvals', () => {
    for (const target of ['constitution:global', 'policy:payments', 'security:api-key', 'permission:payment', 'approval:42', 'rbac:admin']) {
      assert.equal(isProtectedTarget(target).protected, true, `${target} is not protected`)
    }
    assert.equal(isProtectedTarget('skill:office_of_the_ceo_classify_text').protected, false)
  })

  it('needs three observations before it calls something a pattern', () => {
    const one = findPattern([{ target: 't', observation: 'o', evidence: ['e'] }])
    assert.equal(one.sufficient, false)
    const three = findPattern(
      Array.from({ length: 3 }, () => ({ target: 't', observation: 'o', evidence: ['e'] })),
    )
    assert.equal(three.sufficient, true)
  })

  it('refuses to integrate a proposal that nobody approved', async () => {
    const result = await runLearningChain({
      observations: Array.from({ length: 3 }, () => ({ target: 'skill:x', observation: 'the same thing', evidence: ['e'] })),
      artefact: 'SKILL',
      change: 'change the skill',
      measuredEffect: 0.2,
      approvedBy: null,
      approved: false,
    })
    assert.equal(result.integrated, false)
    assert.ok(result.proposal.refusalReason)
  })

  it('refuses to integrate a change to a protected artefact even when it was approved', async () => {
    let applied = false
    const result = await runLearningChain({
      observations: Array.from({ length: 3 }, () => ({ target: 'constitution:global', observation: 'the same thing', evidence: ['e'] })),
      artefact: 'BEHAVIOUR',
      change: 'rewrite the constitution',
      measuredEffect: 0.5,
      approvedBy: 'admin@example.com',
      approved: true,
      apply: async () => {
        applied = true
      },
    })
    assert.equal(result.integrated, false)
    assert.equal(applied, false, 'the protected change was applied')
    assert.equal(result.proposal.status, 'REFUSED')
  })

  it('rejects a hypothesis whose effect was never measured', async () => {
    const result = await runLearningChain({
      observations: Array.from({ length: 3 }, () => ({ target: 'skill:x', observation: 'o', evidence: ['e'] })),
      artefact: 'SKILL',
      change: 'c',
      measuredEffect: null,
      approvedBy: 'a@b.c',
      approved: true,
    })
    assert.equal(result.integrated, false)
    assert.match(result.proposal.refusalReason ?? '', /never measured/)
  })

  it('integrates an approved, validated, unprotected proposal', async () => {
    let applied = false
    const result = await runLearningChain({
      observations: Array.from({ length: 3 }, () => ({ target: 'skill:x', observation: 'o', evidence: ['e'] })),
      artefact: 'SKILL',
      change: 'c',
      measuredEffect: 0.5,
      approvedBy: 'a@b.c',
      approved: true,
      apply: async () => {
        applied = true
      },
    })
    assert.equal(result.integrated, true)
    assert.equal(applied, true)
    assert.ok(result.stages.includes('KNOWLEDGE_UPDATE'))
  })
})

// ------------------------------------------------------------
// Self-healing
// ------------------------------------------------------------

describe('self-healing', () => {
  it('classifies the common failures', () => {
    assert.equal(classifyFailure({ code: 'ETIMEDOUT', message: 'x' }).classification, 'TIMEOUT')
    assert.equal(classifyFailure({ code: 'RATE_LIMITED', message: 'x' }).classification, 'RATE_LIMITED')
    assert.equal(classifyFailure({ code: 'PROVIDER_ERROR', message: 'x' }).classification, 'PROVIDER_UNAVAILABLE')
    assert.equal(classifyFailure({ code: 'PERMISSION_DENIED', message: 'x' }).classification, 'TOOL_PERMISSION_DENIED')
    assert.equal(classifyFailure({ message: 'weird' }).classification, 'UNKNOWN')
  })

  it('escalates a permission refusal straight to a human', () => {
    const plan = repairPlan('TOOL_PERMISSION_DENIED')
    assert.deepEqual(plan, ['ESCALATE_HUMAN'])
  })

  it('retries a transient failure and recovers', async () => {
    let attempts = 0
    const result = await selfHeal({
      error: { code: 'ETIMEDOUT', message: 'timed out' },
      retry: async () => {
        attempts += 1
        return attempts >= 2 ? { ok: true, output: 'done' } : { ok: false, error: 'still timing out' }
      },
      persist: false,
    })
    assert.equal(result.recovered, true)
    assert.equal(result.attempts, 2)
  })

  it('is bounded and escalates to a human when the plan is exhausted', async () => {
    const result = await selfHeal({
      error: { code: 'ETIMEDOUT', message: 'timed out' },
      retry: async () => ({ ok: false, error: 'still timing out' }),
      alternativeStrategy: async () => ({ ok: false, error: 'no' }),
      alternativeModel: async () => ({ ok: false, error: 'no' }),
      escalateToSpecialist: async () => ({ ok: false, error: 'no' }),
      escalateToHuman: async () => ({ ok: true, output: 'a human took it' }),
      persist: false,
    })
    assert.equal(result.recovered, true)
    assert.equal(result.escalatedToHuman, true)
    assert.ok(result.attempts <= 8, 'the repair loop exceeded its ceiling')
  })

  it('never attempts an action that is not on the safe list', async () => {
    const result = await selfHeal({
      error: { code: 'PERMISSION_DENIED', message: 'denied' },
      retry: async () => {
        throw new Error('the retry must not run for a permission refusal')
      },
      escalateToHuman: async () => ({ ok: true, output: 'handed over' }),
      persist: false,
    })
    assert.equal(result.escalatedToHuman, true)
  })
})

// ------------------------------------------------------------
// Reflection
// ------------------------------------------------------------

describe('reflection', () => {
  it('does not reflect on a simple successful task', () => {
    const decision = shouldReflect({ complexity: 'SIMPLE', risk: 'LOW', succeeded: true })
    assert.equal(decision.reflect, false)
  })

  it('reflects on a failure and on a complex task', () => {
    assert.equal(shouldReflect({ complexity: 'SIMPLE', risk: 'LOW', succeeded: false }).reflect, true)
    assert.equal(shouldReflect({ complexity: 'COMPLEX', risk: 'LOW', succeeded: true }).reflect, true)
  })

  it('names one concrete change', () => {
    const reflection = reflect({
      objective: 'answer the client',
      outcome: 'failed',
      succeeded: false,
      whatWorked: ['read the record'],
      whatFailed: ['sent without approval'],
    })
    assert.ok(reflection.nextChange.length > 0)
    assert.ok(reflection.why.length > 0)
  })
})

// ------------------------------------------------------------
// Governance
// ------------------------------------------------------------

describe('governance', () => {
  it('always sends a financial transfer to a human', () => {
    const decision = evaluateGovernance({
      departmentCode: 'D030',
      role: 'Operations Manager',
      agentId: 'EMP-D030-005',
      taskType: 'EXECUTION',
      tool: 'payment.verify',
      riskLevel: 'CRITICAL',
      amount: 50000,
      rules: defaultGovernanceRules(),
    })
    assert.equal(decision.allowed, false)
    assert.equal(decision.requiresApproval, true)
    assert.match(decision.reason, /human/i)
  })

  it('always sends a sensitive external communication to a human', () => {
    const decision = evaluateGovernance({
      departmentCode: 'D030',
      role: 'Operations Manager',
      agentId: 'EMP-D030-005',
      taskType: 'EXECUTION',
      tool: 'email.send',
      riskLevel: 'HIGH',
      rules: defaultGovernanceRules(),
    })
    assert.equal(decision.allowed, false)
  })

  it('does not let a narrower rule re-permit a forbidden action', () => {
    const decision = evaluateGovernance({
      departmentCode: 'D030',
      role: 'Operations Manager',
      agentId: 'EMP-D030-005',
      taskType: 'EXECUTION',
      tool: 'email.send',
      riskLevel: 'LOW',
      rules: [
        {
          id: 'GLOBAL-FORBID',
          layer: 'GLOBAL',
          subject: '*',
          effect: 'FORBID',
          requirement: 'no external mail from this platform',
          active: true,
          setBy: 'test',
          createdAt: new Date(),
        },
        {
          id: 'AGENT-ALLOW',
          layer: 'AGENT',
          subject: 'EMP-D030-005',
          effect: 'ALLOW',
          requirement: 'this agent may send mail',
          active: true,
          setBy: 'test',
          createdAt: new Date(),
        },
      ],
    })
    assert.equal(decision.allowed, false)
    assert.equal(decision.decidedBy, 'GLOBAL-FORBID')
  })

  it('lets a narrower rule add a requirement', () => {
    const decision = evaluateGovernance({
      departmentCode: 'D030',
      role: 'Operations Manager',
      agentId: 'EMP-D030-005',
      taskType: 'EXECUTION',
      tool: 'crm.query',
      riskLevel: 'LOW',
      rules: [
        ...defaultGovernanceRules(),
        {
          id: 'DEPT-001',
          layer: 'DEPARTMENT',
          subject: 'D030',
          effect: 'REQUIRE_APPROVAL',
          requirement: 'operations reads need a ticket',
          active: true,
          setBy: 'test',
          createdAt: new Date(),
        },
      ],
    })
    assert.equal(decision.allowed, true)
    assert.equal(decision.requiresApproval, true)
  })

  it('matches a rule only at its own layer', () => {
    const rule = {
      id: 'X',
      layer: 'ROLE' as const,
      subject: 'Operations Manager',
      effect: 'FORBID' as const,
      requirement: 'r',
      active: true,
      setBy: 't',
      createdAt: new Date(),
    }
    assert.equal(ruleApplies(rule, {
      departmentCode: 'D030',
      role: 'Operations Manager',
      agentId: 'a',
      taskType: 't',
      tool: 'crm.query',
      riskLevel: 'LOW',
      rules: [],
    }), true)
    assert.equal(ruleApplies(rule, {
      departmentCode: 'D030',
      role: 'Other',
      agentId: 'a',
      taskType: 't',
      tool: 'crm.query',
      riskLevel: 'LOW',
      rules: [],
    }), false)
  })

  it('names a human-controlled action for every category the specification lists', () => {
    const ids = ALWAYS_HUMAN_ACTIONS.map((action) => action.id)
    for (const id of [
      'FINANCIAL_TRANSFER',
      'LEGAL_COMMITMENT',
      'IRREVERSIBLE_DELETION',
      'HIGH_IMPACT_SECURITY',
      'SENSITIVE_EXTERNAL_COMMUNICATION',
      'MAJOR_GOVERNANCE_CHANGE',
    ]) {
      assert.ok(ids.includes(id), `${id} is missing`)
    }
  })
})

// ------------------------------------------------------------
// Knowledge graph
// ------------------------------------------------------------

describe('knowledge graph', () => {
  it('does not let one assertion become certainty', () => {
    const combined = combineConfidence(0.5, 0.5)
    assert.ok(combined < 1, 'two 0.5 claims became certainty')
    assert.ok(combined > 0.5, 'a corroborating claim did not raise the confidence')
  })

  it('never lowers the confidence below the existing one', () => {
    assert.ok(combineConfidence(0.9, 0.1) >= 0.9)
  })

  it('writes the tool entities before the SOP→tool edges that reference them', () => {
    // A relation row carries a real foreign key to KnowledgeEntity.key,
    // so a `sop -> tool` edge cannot be written before the tool entity
    // exists. The wrong order made the production seed fail with a
    // foreign-key violation; the seed-safety check caught it.
    const source = readFileSync(join(__dirname, '../src/lib/knowledge/graph.ts'), 'utf8')
    const body = source.slice(source.indexOf('export async function buildStructuralGraph'))
    const toolLoop = body.indexOf('for (const tool of TOOL_REGISTRY)')
    const sopLoop = body.indexOf('for (const sop of SOP_LIBRARY)')
    assert.ok(toolLoop > -1, 'the tool entity loop was not found')
    assert.ok(sopLoop > -1, 'the SOP loop was not found')
    assert.ok(toolLoop < sopLoop, 'the tool entities must be written before the SOP edges that reference them')
  })
})

// ------------------------------------------------------------
// Memory
// ------------------------------------------------------------

describe('memory system', () => {
  it('rejects a write with no key or no content', () => {
    const problems = validateWrite({ scope: 'LESSON', key: '', content: '', memoryType: 'SEMANTIC' })
    assert.ok(problems.length >= 2)
  })

  it('rejects an unknown memory type and an unknown access level', () => {
    assert.ok(validateWrite({ scope: 'LESSON', key: 'k', content: 'c', memoryType: 'NOPE' as never }).length > 0)
    assert.ok(
      validateWrite({ scope: 'LESSON', key: 'k', content: 'c', memoryType: 'SEMANTIC', accessLevel: 'NOPE' as never }).length > 0,
    )
  })

  it('gives the sensitive scope the strictest access', () => {
    assert.equal(defaultAccessFor('SENSITIVE'), 'RESTRICTED')
    assert.equal(defaultAccessFor('STRATEGIC'), 'CONFIDENTIAL')
    assert.equal(defaultAccessFor('LESSON'), 'INTERNAL')
  })

  it('ranks a procedural memory above a working one', () => {
    assert.ok(defaultImportance('PROCEDURAL') > defaultImportance('WORKING'))
  })

  it('prefers a validated memory over an unvalidated one', () => {
    const row = { key: 'k', content: 'c', validated: true, importance: 5, updatedAt: new Date() }
    const validated = scoreMemory(row, 'k')
    const unvalidated = scoreMemory({ ...row, validated: false }, 'k')
    assert.ok(validated > unvalidated)
  })

  it('caps the retrieval so a context cannot be flooded', () => {
    assert.ok(MEMORY_RETRIEVAL_CAP <= 50)
  })
})

// ------------------------------------------------------------
// Model hub
// ------------------------------------------------------------

describe('model hub', () => {
  it('declares the model categories the specification names', () => {
    for (const category of ['general', 'reasoning', 'coding', 'vision', 'image', 'speech', 'embedding', 'classification', 'fast', 'premium']) {
      assert.ok(MODEL_CATEGORIES.includes(category as never), `${category} is missing`)
    }
  })

  it('does not promote a model whose weights were never verified', () => {
    const unverified = MODEL_CATALOG.find((entry) => !entry.weightsVerified)
    assert.ok(unverified, 'the catalogue has no unverified model to test with')
    const { reasons } = scoreEntry(unverified, {
      taskType: 'general',
      complexity: 'SIMPLE',
      language: 'en',
      contextCharacters: 1000,
      requiresStructuredOutput: false,
      requiresToolSelection: false,
      requiresGroundedAnswer: false,
    }, { firstTokenMs: null, quality: null, costPer1k: null })
    assert.ok(reasons.some((reason) => reason.includes('not checksummed')))
  })

  it('says plainly when a model was not measured on this host', () => {
    const entry = MODEL_CATALOG[0]
    const { reasons } = scoreEntry(entry, {
      taskType: 'general',
      complexity: 'SIMPLE',
      language: 'en',
      contextCharacters: 1000,
      requiresStructuredOutput: false,
      requiresToolSelection: false,
      requiresGroundedAnswer: false,
      maxLatencyMs: 500,
      minQuality: 0.5,
    }, { firstTokenMs: null, quality: null, costPer1k: null })
    assert.ok(reasons.some((reason) => reason.includes('never measured')))
  })

  it('reports that no model is installed when the host has none', () => {
    const decision = routeToModel({
      taskType: 'general',
      complexity: 'SIMPLE',
      language: 'en',
      contextCharacters: 1000,
      requiresStructuredOutput: false,
      requiresToolSelection: false,
      requiresGroundedAnswer: false,
    }, emptyMeasurements())
    assert.match(decision.reason, /UNVERIFIED|no model is installed/i)
  })

  it('prefers an installed model over a catalogued one', () => {
    const measurements = emptyMeasurements()
    measurements.installed.add(MODEL_CATALOG[MODEL_CATALOG.length - 1].upstreamModel)
    const decision = routeToModel({
      taskType: 'general',
      complexity: 'SIMPLE',
      language: 'en',
      contextCharacters: 1000,
      requiresStructuredOutput: false,
      requiresToolSelection: false,
      requiresGroundedAnswer: false,
    }, measurements)
    assert.equal(decision.selected?.entry.upstreamModel, MODEL_CATALOG[MODEL_CATALOG.length - 1].upstreamModel)
  })
})

// ------------------------------------------------------------
// Availability
// ------------------------------------------------------------

describe('availability', () => {
  it('reports BUSY when a job is running', () => {
    assert.equal(resolveState({ running: 2, queued: 0, awaitingApproval: 0, recentFailures: 0, lastStatus: 'SUCCESS' }).state, 'BUSY')
  })

  it('reports ESCALATED when an approval is pending', () => {
    assert.equal(resolveState({ running: 0, queued: 0, awaitingApproval: 1, recentFailures: 0, lastStatus: 'SUCCESS' }).state, 'ESCALATED')
  })

  it('reports QUEUED when work is waiting', () => {
    assert.equal(resolveState({ running: 0, queued: 3, awaitingApproval: 0, recentFailures: 0, lastStatus: 'SUCCESS' }).state, 'QUEUED')
  })

  it('reports ERROR after a failure', () => {
    assert.equal(resolveState({ running: 0, queued: 0, awaitingApproval: 0, recentFailures: 1, lastStatus: 'SUCCESS' }).state, 'ERROR')
  })

  it('reports AVAILABLE only when there is genuinely nothing to do', () => {
    assert.equal(resolveState({ running: 0, queued: 0, awaitingApproval: 0, recentFailures: 0, lastStatus: 'SUCCESS' }).state, 'AVAILABLE')
  })
})

// ------------------------------------------------------------
// Context engine
// ------------------------------------------------------------

describe('context engine', () => {
  it('never compresses the constitution, the identity or the task', () => {
    const sections = [
      { name: 'GLOBAL CONSTITUTION', content: 'x'.repeat(500), characters: 500, compressed: false, source: 's' },
      { name: 'IDENTITY', content: 'y'.repeat(200), characters: 200, compressed: false, source: 's' },
      { name: 'TASK', content: 'z'.repeat(100), characters: 100, compressed: false, source: 's' },
      { name: 'RELEVANT KNOWLEDGE', content: 'k'.repeat(2000), characters: 2000, compressed: false, source: 's' },
    ]
    const result = fitToBudget(sections, 1000)
    const constitution = result.sections.find((section) => section.name === 'GLOBAL CONSTITUTION')
    assert.ok(constitution, 'the constitution was dropped')
    assert.equal(constitution.compressed, false)
    assert.ok(result.compressed)
    assert.ok(result.dropped.length > 0, 'a compression was not reported')
  })

  it('extracts the meaningful terms of a task', () => {
    const terms = termsOf('Draft a proposal for the Acme website project')
    assert.ok(terms.includes('draft'))
    assert.ok(terms.includes('proposal'))
    assert.ok(!terms.includes('for'), 'a stop word leaked into the terms')
  })

  it('declares a budget for every execution path', () => {
    for (const path of ['FAST', 'STANDARD', 'COMPLEX', 'ENTERPRISE'] as const) {
      assert.ok(CONTEXT_BUDGETS[path] > 0, `${path} has no budget`)
    }
    assert.ok(CONTEXT_BUDGETS.FAST < CONTEXT_BUDGETS.ENTERPRISE)
  })
})
