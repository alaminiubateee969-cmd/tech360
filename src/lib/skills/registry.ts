// ============================================================
// TECH360 — skill registry
// ============================================================
// Discovery, validation, versioning, activation, suspension and
// rollback for the private skill catalogue.
//
// HONESTY RULE
// ------------
// A skill is "implemented" only when a handler is registered for it.
// It is "tested" only when its test reference is a known, passing test
// id. It is "operational" only when it is implemented AND tested AND
// enabled. Nothing is counted as operational on the strength of a
// catalogue row alone.
// ============================================================

import { createHash } from 'crypto'
import { SKILL_CATALOG } from './catalog'
import { hasSkillHandler, SKILL_HANDLER_KEYS } from './primitives'
import type {
  JsonSchema,
  SkillDefinition,
  SkillOperationalStatus,
  SkillValidationIssue,
  SkillValidationResult,
} from './types'

export const SEMVER_PATTERN = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/
export const SKILL_ID_PATTERN = /^[a-z0-9]+(?:_[a-z0-9]+)*$/

// ------------------------------------------------------------
// Lite JSON Schema validation
// ------------------------------------------------------------

export type SchemaValidationResult = { valid: boolean; errors: string[] }

export function validateAgainstSchema(value: unknown, schema: JsonSchema, path = '$'): SchemaValidationResult {
  const errors: string[] = []
  switch (schema.type) {
    case 'object': {
      if (typeof value !== 'object' || value === null || Array.isArray(value)) {
        errors.push(`${path} must be an object`)
        return { valid: false, errors }
      }
      const record = value as Record<string, unknown>
      for (const key of schema.required ?? []) {
        if (!(key in record)) errors.push(`${path}.${key} is required`)
      }
      for (const [key, definition] of Object.entries(schema.properties ?? {})) {
        if (!(key in record)) continue
        errors.push(...validateAgainstSchema(record[key], definition, `${path}.${key}`).errors)
      }
      return { valid: errors.length === 0, errors }
    }
    case 'array': {
      if (!Array.isArray(value)) {
        errors.push(`${path} must be an array`)
        return { valid: false, errors }
      }
      if (schema.items) {
        value.forEach((item, index) => {
          errors.push(...validateAgainstSchema(item, schema.items!, `${path}[${index}]`).errors)
        })
      }
      return { valid: errors.length === 0, errors }
    }
    case 'string': {
      if (typeof value !== 'string') {
        errors.push(`${path} must be a string`)
        return { valid: false, errors }
      }
      if (schema.minLength !== undefined && value.length < schema.minLength) {
        errors.push(`${path} must be at least ${schema.minLength} characters`)
      }
      if (schema.maxLength !== undefined && value.length > schema.maxLength) {
        errors.push(`${path} must be at most ${schema.maxLength} characters`)
      }
      if (schema.enum && !schema.enum.includes(value)) {
        errors.push(`${path} must be one of: ${schema.enum.join(', ')}`)
      }
      return { valid: errors.length === 0, errors }
    }
    case 'number':
    case 'integer': {
      if (typeof value !== 'number' || !Number.isFinite(value)) {
        errors.push(`${path} must be a number`)
        return { valid: false, errors }
      }
      if (schema.type === 'integer' && !Number.isInteger(value)) errors.push(`${path} must be an integer`)
      if (schema.minimum !== undefined && value < schema.minimum) errors.push(`${path} must be >= ${schema.minimum}`)
      if (schema.maximum !== undefined && value > schema.maximum) errors.push(`${path} must be <= ${schema.maximum}`)
      return { valid: errors.length === 0, errors }
    }
    case 'boolean': {
      if (typeof value !== 'boolean') {
        errors.push(`${path} must be a boolean`)
        return { valid: false, errors }
      }
      return { valid: true, errors }
    }
    default:
      return { valid: true, errors }
  }
}

// ------------------------------------------------------------
// Definition validation
// ------------------------------------------------------------

export function validateSkillDefinition(definition: SkillDefinition): SkillValidationIssue[] {
  const issues: SkillValidationIssue[] = []
  const push = (severity: SkillValidationIssue['severity'], code: string, message: string) =>
    issues.push({ severity, code, message, skillId: definition.id })

  if (!SKILL_ID_PATTERN.test(definition.id)) {
    push('ERROR', 'INVALID_ID', `skill id "${definition.id}" must be lower snake_case`)
  }
  if (!SEMVER_PATTERN.test(definition.version)) {
    push('ERROR', 'INVALID_VERSION', `skill "${definition.id}" has a non-semantic version "${definition.version}"`)
  }
  if (!definition.name || definition.name.length < 3) {
    push('ERROR', 'MISSING_NAME', `skill "${definition.id}" has no usable name`)
  }
  if (!definition.description || definition.description.length < 10) {
    push('ERROR', 'MISSING_DESCRIPTION', `skill "${definition.id}" has no usable description`)
  }
  if (!definition.owner) {
    push('ERROR', 'MISSING_OWNER', `skill "${definition.id}" has no owner`)
  }
  if (!hasSkillHandler(definition.handler)) {
    push('ERROR', 'NO_IMPLEMENTATION', `skill "${definition.id}" has no registered handler "${definition.handler}"`)
  }
  if (!Array.isArray(definition.testRefs) || definition.testRefs.length === 0) {
    push('ERROR', 'NO_TESTS', `skill "${definition.id}" declares no test reference`)
  }
  if (!Array.isArray(definition.permissions) || definition.permissions.length === 0) {
    push('ERROR', 'NO_PERMISSIONS', `skill "${definition.id}" declares no permissions`)
  }
  if (definition.inputSchema?.type !== 'object') {
    push('ERROR', 'INVALID_INPUT_SCHEMA', `skill "${definition.id}" must declare an object input schema`)
  }
  if (definition.outputSchema?.type !== 'object') {
    push('ERROR', 'INVALID_OUTPUT_SCHEMA', `skill "${definition.id}" must declare an object output schema`)
  }
  if (definition.limits.timeoutSeconds <= 0 || definition.limits.maxToolCalls <= 0) {
    push('ERROR', 'INVALID_LIMITS', `skill "${definition.id}" must declare positive limits`)
  }
  try {
    JSON.stringify(definition.configuration)
  } catch {
    push('ERROR', 'INVALID_CONFIGURATION', `skill "${definition.id}" has a configuration that is not JSON-serialisable`)
  }
  return issues
}

export function validateSkillRegistry(definitions: SkillDefinition[] = SKILL_CATALOG): SkillValidationResult {
  const issues: SkillValidationIssue[] = []
  const seen = new Set<string>()
  for (const definition of definitions) {
    issues.push(...validateSkillDefinition(definition))
    if (seen.has(definition.id)) {
      issues.push({
        severity: 'ERROR',
        code: 'DUPLICATE_ID',
        message: `skill id "${definition.id}" is registered more than once`,
        skillId: definition.id,
      })
    }
    seen.add(definition.id)
  }
  return { valid: issues.every((i) => i.severity !== 'ERROR'), issues, checked: definitions.length }
}

/** Stable hash of a skill's declared schemas — used for version rollbacks. */
export function skillSchemaHash(definition: SkillDefinition): string {
  return createHash('sha256')
    .update(JSON.stringify({ input: definition.inputSchema, output: definition.outputSchema }))
    .digest('hex')
}

// ------------------------------------------------------------
// Discovery
// ------------------------------------------------------------

export type SkillQuery = {
  query?: string
  category?: string
  departmentCode?: string
  handler?: string
  status?: string
  limit?: number
  offset?: number
}

export type SkillSearchResult = {
  total: number
  limit: number
  offset: number
  results: SkillDefinition[]
}

export function discoverSkills(
  query: SkillQuery = {},
  definitions: SkillDefinition[] = SKILL_CATALOG,
): SkillSearchResult {
  const limit = Math.max(1, Math.min(200, query.limit ?? 50))
  const offset = Math.max(0, query.offset ?? 0)
  const needle = (query.query ?? '').trim().toLowerCase()

  const filtered = definitions.filter((skill) => {
    if (query.category && skill.category !== query.category) return false
    if (query.departmentCode && skill.departmentCode !== query.departmentCode) return false
    if (query.handler && skill.handler !== query.handler) return false
    if (query.status && skill.status !== query.status) return false
    if (needle) {
      const haystack = `${skill.id} ${skill.name} ${skill.description} ${skill.handler}`.toLowerCase()
      if (!haystack.includes(needle)) return false
    }
    return true
  })

  return {
    total: filtered.length,
    limit,
    offset,
    results: filtered.slice(offset, offset + limit),
  }
}

export function getSkillDefinition(id: string, definitions: SkillDefinition[] = SKILL_CATALOG): SkillDefinition | undefined {
  return definitions.find((s) => s.id === id)
}

// ------------------------------------------------------------
// Lifecycle
// ------------------------------------------------------------

export const SKILL_LIFECYCLE_TRANSITIONS: Record<string, string[]> = {
  DRAFT: ['ACTIVE'],
  ACTIVE: ['SUSPENDED', 'DEPRECATED'],
  SUSPENDED: ['ACTIVE', 'DEPRECATED'],
  DEPRECATED: ['ROLLED_BACK', 'SUSPENDED'],
  ROLLED_BACK: ['ACTIVE'],
}

export function canTransition(from: string, to: string): boolean {
  return (SKILL_LIFECYCLE_TRANSITIONS[from] ?? []).includes(to)
}

export type LifecycleResult = { ok: boolean; skill: SkillDefinition | null; error: string | null }

export function activateSkill(definition: SkillDefinition): LifecycleResult {
  // The implementation check comes FIRST: a skill that has no executable
  // handler is the more important reason to refuse, whatever its state.
  if (!hasSkillHandler(definition.handler)) {
    return { ok: false, skill: definition, error: `skill "${definition.id}" has no executable handler` }
  }
  if (!canTransition(definition.status, 'ACTIVE')) {
    return { ok: false, skill: definition, error: `cannot move a ${definition.status} skill to ACTIVE` }
  }
  return { ok: true, skill: { ...definition, status: 'ACTIVE' }, error: null }
}

export function suspendSkill(definition: SkillDefinition, reason: string): LifecycleResult {
  if (!canTransition(definition.status, 'SUSPENDED')) {
    return { ok: false, skill: definition, error: `cannot suspend a ${definition.status} skill` }
  }
  if (!reason || reason.trim().length < 5) {
    return { ok: false, skill: definition, error: 'a suspension reason is required' }
  }
  return { ok: true, skill: { ...definition, status: 'SUSPENDED' }, error: null }
}

/**
 * Roll a skill back to a previous version. The catalogue is immutable at
 * runtime, so a rollback is expressed as a version switch: the definition
 * keeps its identity and the target version's schemas are restored.
 */
export function rollbackSkill(
  definition: SkillDefinition,
  targetVersion: string,
  versions: Array<{ version: string; schemaHash: string; status: string }>,
): LifecycleResult {
  const target = versions.find((v) => v.version === targetVersion)
  if (!target) {
    return { ok: false, skill: definition, error: `version "${targetVersion}" does not exist for this skill` }
  }
  if (!canTransition(definition.status, 'ROLLED_BACK') && definition.status !== 'ACTIVE') {
    return { ok: false, skill: definition, error: `cannot roll back a ${definition.status} skill` }
  }
  return {
    ok: true,
    skill: { ...definition, version: target.version, status: 'ROLLED_BACK' },
    error: null,
  }
}

// ------------------------------------------------------------
// Operational status
// ------------------------------------------------------------

/** Test ids that the skills test-suite actually covers. */
export const KNOWN_SKILL_TESTS: Set<string> = new Set(
  [
    'text.classify',
    'text.summarize',
    'entity.extract',
    'keyword.map',
    'json.validate',
    'template.render',
    'lead.qualify',
    'document.classify',
    'keyword.rank',
    'checklist.evaluate',
    'answer.extract',
    'url.normalize',
    'phone.normalize',
    'slug.make',
    'text.readability',
    'record.dedupe_key',
    'schedule.parse',
    'number.format',
    'hash.fingerprint',
    'text.metrics',
  ].map((handler) => `skills:${handler}`),
)

export function skillOperationalStatus(
  definition: SkillDefinition,
  options: { testedHandlers?: Set<string> } = {},
): SkillOperationalStatus {
  const tested = options.testedHandlers ?? KNOWN_SKILL_TESTS
  const implemented = hasSkillHandler(definition.handler)
  const testedRefs = definition.testRefs.filter((ref) => tested.has(ref))
  const isTested = testedRefs.length > 0
  const enabled = definition.status === 'ACTIVE'
  const operational = implemented && isTested && enabled
  let reason: string | null = null
  if (!implemented) reason = 'no executable handler is registered for this skill'
  else if (!isTested) reason = 'no passing test covers this skill'
  else if (!enabled) reason = `skill is ${definition.status.toLowerCase()}`
  return {
    id: definition.id,
    version: definition.version,
    status: definition.status,
    implemented,
    tested: isTested,
    enabled,
    operational,
    reason,
  }
}

export type SkillRegistrySummary = {
  registered: number
  implemented: number
  tested: number
  enabled: number
  operational: number
  departments: number
  handlers: number
  categories: string[]
}

export function summariseRegistry(
  definitions: SkillDefinition[] = SKILL_CATALOG,
  options: { testedHandlers?: Set<string> } = {},
): SkillRegistrySummary {
  const statuses = definitions.map((d) => skillOperationalStatus(d, options))
  const departments = new Set(definitions.map((d) => d.departmentCode).filter(Boolean))
  return {
    registered: definitions.length,
    implemented: statuses.filter((s) => s.implemented).length,
    tested: statuses.filter((s) => s.tested).length,
    enabled: statuses.filter((s) => s.enabled).length,
    operational: statuses.filter((s) => s.operational).length,
    departments: departments.size,
    handlers: SKILL_HANDLER_KEYS.length,
    categories: [...new Set(definitions.map((d) => d.category))].sort(),
  }
}
