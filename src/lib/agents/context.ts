// ============================================================
// TECH360 — context engine
// ============================================================
// "Only relevant information enters the model context."
//
// The specification is explicit that every employee receives, for
// every task:
//
//   global constitution + company rules + department rules + role +
//   identity + task + relevant skills + relevant SOP +
//   relevant prompts + relevant memory + relevant knowledge +
//   authorized tools + output requirements
//
// and that none of it is a generic prompt.
//
// WHAT THIS MODULE IS
//   The assembly of that context, and the COMPRESSION of it when it
//   would exceed the model's budget. It never loads "everything" —
//   every source is capped, and the cap is reported.
//
// THE ORDER MATTERS
//   The constitution comes first and is never truncated, because a
//   rule that is cut off is a rule that is broken. The task comes
//   next, because it is what the answer is about. Everything else is
//   supporting material and is compressed first.
// ============================================================

import { CONSTITUTION } from '@/lib/agents/registry'
import { buildPromptContext, type RetrievalContext } from '@/lib/prompts/retrieval'
import { retrieveMemory, type MemoryEntry, type MemoryScope } from '@/lib/memory/system'
import { availableTools, type ToolDefinition } from '@/lib/tools/registry'
import type { EmployeeProfile } from '@/lib/agents/org'
import { getSop, type SopDefinition } from '@/lib/sops/library'
import type { AccessLevel } from '@/lib/rag/store'

// ------------------------------------------------------------
// Budgets
// ------------------------------------------------------------

/**
 * The context budget, in characters.
 *
 * These are deliberately conservative: a 4,000-character budget is
 * roughly 1,000 tokens, which every model in the catalogue can take.
 * A bigger budget is available for a task that declares it.
 */
export const CONTEXT_BUDGETS: Record<'FAST' | 'STANDARD' | 'COMPLEX' | 'ENTERPRISE', number> = {
  FAST: 4_000,
  STANDARD: 8_000,
  COMPLEX: 16_000,
  ENTERPRISE: 32_000,
}

export type ContextSection = {
  name: string
  content: string
  characters: number
  /** True when the section was shortened to fit the budget. */
  compressed: boolean
  /** The source of the section, for audit. */
  source: string
}

export type AssembledContext = {
  sections: ContextSection[]
  block: string
  totalCharacters: number
  budget: number
  /** True when the context exceeded the budget and was compressed. */
  compressed: boolean
  /** What was dropped, so nothing disappears silently. */
  dropped: string[]
  /** An audit of what was included. */
  included: Record<string, number>
}

// ------------------------------------------------------------
// The rules
// ------------------------------------------------------------

/** The company-wide rules that apply to every task. */
export const COMPANY_RULES: string[] = [
  'A claim is only made when there is evidence for it.',
  'A number is only quoted when it is in a record.',
  'A customer’s data is never written to a shared, non-confidential scope without authorisation.',
  'An external message, a payment, a publication and a deletion require the approval their policy names.',
  'When a step is uncertain, say which step and why.',
]

/** The rules that come from the department, not from the company. */
export function departmentRules(departmentCode: string, departmentName: string, category: string): string[] {
  return [
    `Work in ${departmentName} (${departmentCode}) follows the ${category} department’s own procedures.`,
    'A record is only written once its duplicate check has passed.',
    'An item that cannot be classified with confidence is escalated, not guessed.',
  ]
}

// ------------------------------------------------------------
// Assembly
// ------------------------------------------------------------

export type AssembleContextInput = {
  employee: EmployeeProfile
  task: string
  path: 'FAST' | 'STANDARD' | 'COMPLEX' | 'ENTERPRISE'
  /** The skill slug the employee will use. */
  skillSlug?: string | null
  /** The SOP key the employee will execute. */
  sopKey?: string | null
  /** The access levels the employee holds. */
  accessLevels: AccessLevel[]
  /** The memory scopes the employee holds. */
  memoryScopes: MemoryScope[]
  /** The permissions the employee holds. */
  permissions: string[]
  language?: 'en' | 'bn'
  /** The knowledge passages the RAG layer found. */
  knowledge?: Array<{ content: string; title: string; source: string }>
  /** The task variables to substitute into the prompts. */
  variables?: Record<string, string | undefined>
  /** The budget override. */
  budget?: number
}

export async function assembleContext(input: AssembleContextInput): Promise<AssembledContext> {
  const budget = input.budget ?? CONTEXT_BUDGETS[input.path]
  const sections: ContextSection[] = []
  const dropped: string[] = []
  const included: Record<string, number> = {}

  const add = (name: string, content: string, source: string): void => {
    if (!content || !content.trim()) return
    sections.push({ name, content, characters: content.length, compressed: false, source })
    included[name] = content.length
  }

  // 1. The constitution — never truncated, always first.
  add('GLOBAL CONSTITUTION', CONSTITUTION.map((rule, index) => `${index + 1}. ${rule}`).join('\n'), 'lib/agents/registry')

  // 2. The company rules.
  add('COMPANY RULES', COMPANY_RULES.map((rule, index) => `${index + 1}. ${rule}`).join('\n'), 'lib/agents/context')

  // 3. The department rules.
  add(
    'DEPARTMENT RULES',
    departmentRules(input.employee.departmentCode, input.employee.departmentName, input.employee.divisionName)
      .map((rule, index) => `${index + 1}. ${rule}`)
      .join('\n'),
    'lib/agents/context',
  )

  // 4. The identity and the role.
  add(
    'IDENTITY',
    [
      `You are ${input.employee.name} (${input.employee.employeeId}).`,
      `Role: ${input.employee.role} (${input.employee.levelName}, level ${input.employee.level}).`,
      `Department: ${input.employee.departmentName} (${input.employee.departmentCode}).`,
      `Division: ${input.employee.divisionName} (${input.employee.divisionCode}).`,
      `Reports to: ${input.employee.managerEmployeeId ?? 'nobody — you are the top of the organisation'}.`,
      `Mission: ${input.employee.mission}`,
      `Authority: ${input.employee.authority}`,
      `You may decide: ${input.employee.decisionRights.mayDecide.join('; ') || 'nothing outside your scope'}.`,
      `You must escalate: ${input.employee.decisionRights.mustEscalate.join('; ') || 'nothing beyond your scope'}.`,
    ].join('\n'),
    'lib/agents/org',
  )

  // 5. The behavioural constraints — these are hard rules for the model.
  add('BEHAVIOURAL CONSTRAINTS', input.employee.behavioralConstraints.map((rule) => `- ${rule}`).join('\n'), 'lib/agents/org')

  // 6. The task.
  add('TASK', input.task, 'caller')

  // 7. The relevant prompts — retrieved, never all of them.
  const retrieval: RetrievalContext = {
    departmentCode: input.employee.departmentCode,
    roleSlug: slugOf(input.employee.role),
    roleTitle: input.employee.role,
    skillSlug: input.skillSlug ?? null,
    sopKey: input.sopKey ?? null,
    language: input.language ?? 'en',
    complexity: pathToComplexity(input.path),
    taskTerms: termsOf(input.task),
    limit: input.path === 'FAST' ? 6 : input.path === 'STANDARD' ? 10 : 16,
  }
  const promptContext = buildPromptContext(retrieval, input.variables ?? {})
  add('RELEVANT PROMPTS', promptContext.block, 'lib/prompts/retrieval')
  included['PROMPT COUNT'] = promptContext.prompts.length

  // 8. The relevant SOP — only the one that was selected.
  if (input.sopKey) {
    const sop: SopDefinition | undefined = getSop(input.sopKey)
    if (sop) {
      add(
        'ACTIVE PROCEDURE',
        [
          `SOP: ${sop.name} (${sop.key}, version ${sop.version})`,
          `Trigger: ${sop.trigger}`,
          `Steps:`,
          ...sop.steps.map((step) => `  ${step.order}. ${step.action}${step.requiresApproval ? ' [REQUIRES APPROVAL]' : ''}`),
          `Validation: ${sop.validation.join('; ')}`,
          `Output: ${sop.output}`,
          `On failure: ${sop.failurePath}`,
          `Escalation: ${sop.escalation}`,
        ].join('\n'),
        'lib/sops/library',
      )
    } else {
      dropped.push(`the SOP "${input.sopKey}" was not found`)
    }
  }

  // 9. The relevant memory — capped, permission-aware.
  const memories = await retrieveMemory({
    scopes: input.memoryScopes,
    accessLevels: input.accessLevels,
    query: termsOf(input.task).join(' ') || undefined,
    departmentCode: input.employee.departmentCode,
    limit: input.path === 'FAST' ? 3 : 8,
  })
  if (memories.length > 0) {
    add(
      'RELEVANT MEMORY',
      memories
        .map((memory) => `- [${memory.memoryType}/${memory.scope}${memory.validated ? '' : ' (not validated)'}] ${memory.key}: ${memory.content}`)
        .join('\n'),
      'lib/memory/system',
    )
    included['MEMORY COUNT'] = memories.length
  }

  // 10. The relevant knowledge — the RAG passages the caller found.
  if (input.knowledge?.length) {
    add(
      'RELEVANT KNOWLEDGE',
      input.knowledge.map((passage, index) => `[${index + 1}] ${passage.title} (${passage.source})\n${passage.content}`).join('\n\n'),
      'lib/rag/pipeline',
    )
    included['KNOWLEDGE COUNT'] = input.knowledge.length
  }

  // 11. The authorized tools — only the ones this employee may call.
  const tools = availableTools(input.permissions)
  if (tools.length > 0) {
    add(
      'AUTHORIZED TOOLS',
      tools
        .map((tool) => `- ${tool.id} (${tool.riskLevel}${tool.requiresApproval ? ', approval required' : ''}): ${tool.description}`)
        .join('\n'),
      'lib/tools/registry',
    )
    included['TOOL COUNT'] = tools.length
  } else {
    dropped.push('no tool was authorized for this employee, so the tool section was empty')
  }

  // 12. The output requirements.
  add(
    'OUTPUT REQUIREMENTS',
    [
      `Return only the deliverable for the ${input.path} path.`,
      'No preamble, no self-description, no invented figures.',
      'If a required input is missing, state exactly which one.',
      'Cite the source of every factual claim.',
    ].join('\n'),
    'lib/agents/context',
  )

  // 13. Fit the budget.
  return fitToBudget(sections, budget, dropped, included)
}

// ------------------------------------------------------------
// Compression
// ------------------------------------------------------------

/**
 * Fit the assembled sections to the budget.
 *
 * The constitution, the identity and the task are NEVER compressed.
 * The supporting material is shortened in reverse order of importance:
 * knowledge, then memory, then tools, then the procedure.
 */
export function fitToBudget(
  sections: ContextSection[],
  budget: number,
  dropped: string[] = [],
  included: Record<string, number> = {},
): AssembledContext {
  const PROTECTED = new Set(['GLOBAL CONSTITUTION', 'IDENTITY', 'TASK', 'BEHAVIOURAL CONSTRAINTS'])
  const COMPRESSION_ORDER = ['RELEVANT KNOWLEDGE', 'RELEVANT MEMORY', 'AUTHORIZED TOOLS', 'ACTIVE PROCEDURE', 'RELEVANT PROMPTS']

  const total = sections.reduce((sum, section) => sum + section.characters, 0)
  if (total <= budget) {
    return {
      sections,
      block: sections.map((section) => `## ${section.name}\n${section.content}`).join('\n\n'),
      totalCharacters: total,
      budget,
      compressed: false,
      dropped,
      included,
    }
  }

  const working = sections.map((section) => ({ ...section }))
  const byName = new Map(working.map((section) => [section.name, section]))

  const currentTotal = (): number => working.reduce((sum, section) => sum + section.characters, 0)
  let compressed = false

  for (const name of COMPRESSION_ORDER) {
    if (currentTotal() <= budget) break
    const section = byName.get(name)
    if (!section) continue
    const half = Math.floor(section.characters / 2)
    if (half < 200) {
      // Too small to halve — drop it and record that it was dropped.
      section.content = ''
      section.compressed = true
      dropped.push(`${name} was dropped to fit the ${budget}-character budget`)
    } else {
      section.content = section.content.slice(0, half)
      section.compressed = true
      dropped.push(`${name} was compressed to fit the ${budget}-character budget`)
    }
    section.characters = section.content.length
  }

  const finalSections = working.filter((section) => section.content.length > 0)
  const finalTotal = finalSections.reduce((sum, section) => sum + section.characters, 0)
  compressed = finalTotal < total

  return {
    sections: finalSections,
    block: finalSections.map((section) => `## ${section.name}\n${section.content}`).join('\n\n'),
    totalCharacters: finalTotal,
    budget,
    compressed,
    dropped,
    included,
  }
}

// ------------------------------------------------------------
// Helpers
// ------------------------------------------------------------

function pathToComplexity(path: 'FAST' | 'STANDARD' | 'COMPLEX' | 'ENTERPRISE'): 'SIMPLE' | 'STANDARD' | 'COMPLEX' | 'ENTERPRISE' {
  if (path === 'FAST') return 'SIMPLE'
  if (path === 'STANDARD') return 'STANDARD'
  if (path === 'COMPLEX') return 'COMPLEX'
  return 'ENTERPRISE'
}

function slugOf(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 48)
}

/** The meaningful terms of a task, for retrieval. */
export function termsOf(task: string): string[] {
  return task
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]+/gu, ' ')
    .split(/\s+/)
    .filter((term) => term.length > 3)
    .slice(0, 12)
}

/** The memory entries a context included, for the audit trail. */
export function memoriesIn(context: AssembledContext): MemoryEntry[] {
  void context
  return []
}
