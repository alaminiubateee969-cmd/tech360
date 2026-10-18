// ============================================================
// TECH360 — skill registry · type contracts
// ============================================================
// A skill is a reusable, versioned capability with declared inputs,
// declared outputs, declared permissions, an executable implementation
// and tests. A catalogue row without a registered handler and a
// passing test is NOT a working skill, and the registry reports it
// as such.
// ============================================================

export type SkillStatus = 'DRAFT' | 'ACTIVE' | 'SUSPENDED' | 'DEPRECATED' | 'ROLLED_BACK'

export type SkillRiskLevel = 'LOW' | 'MEDIUM' | 'HIGH'

/** The subset of JSON Schema the registry validator enforces. */
export type JsonSchema = {
  type: 'object' | 'array' | 'string' | 'number' | 'integer' | 'boolean'
  required?: string[]
  properties?: Record<string, JsonSchema>
  items?: JsonSchema
  enum?: string[]
  minimum?: number
  maximum?: number
  maxLength?: number
  minLength?: number
  description?: string
}

export type SkillDefinition = {
  id: string
  version: string
  category: string
  departmentCode: string | null
  name: string
  description: string
  owner: string
  /** Key into the executable handler registry (see skills/primitives.ts). */
  handler: string
  /** JSON-serialisable specialisation for the handler. */
  configuration: Record<string, unknown>
  inputSchema: JsonSchema
  outputSchema: JsonSchema
  permissions: string[]
  requiresApproval: boolean
  riskLevel: SkillRiskLevel
  /** Identifiers of the tests that cover this skill. */
  testRefs: string[]
  status: SkillStatus
  /** Maximum tool calls / timeout for one invocation. */
  limits: { maxToolCalls: number; timeoutSeconds: number; maxRetries: number }
}

export type SkillValidationIssue = {
  severity: 'ERROR' | 'WARNING'
  code: string
  message: string
  skillId?: string
}

export type SkillValidationResult = {
  valid: boolean
  issues: SkillValidationIssue[]
  checked: number
}

export type SkillInvocation = {
  skillId: string
  version?: string
  input: Record<string, unknown>
  correlationId: string
  requestedBy?: string
  /** The permission set the caller actually holds. */
  grantedPermissions: string[]
}

export type SkillInvocationResult = {
  ok: boolean
  skillId: string
  version: string
  output: Record<string, unknown> | null
  error: string | null
  errorCode: string | null
  durationMs: number
}

/** Runtime status of a skill, used by the registry API and the dashboard. */
export type SkillOperationalStatus = {
  id: string
  version: string
  status: SkillStatus
  implemented: boolean
  tested: boolean
  enabled: boolean
  operational: boolean
  reason: string | null
}
