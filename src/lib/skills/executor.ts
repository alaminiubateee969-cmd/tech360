// ============================================================
// TECH360 — skill executor
// ============================================================
// Executes a skill definition and records the run.
//
// EXECUTION CONTRACT
//   1. The skill must be enabled and have a registered handler.
//   2. The caller must hold EVERY permission the skill declares.
//      A missing permission is a refusal, not a warning.
//   3. The input is validated against the skill's declared input schema.
//   4. The handler runs under a wall-clock timeout.
//   5. The output is validated against the skill's declared output
//      schema. An invalid output is a failure, never a silent success.
//   6. The run is recorded (SkillRun) and audited.
//
// The skill executor NEVER performs a side effect. It is a pure
// capability. Side effects happen only through the governed tool
// gateway, which is approval-gated.
// ============================================================

import { newCorrelationId } from '@/lib/correlation'
import { SKILL_HANDLERS } from './primitives'
import { validateAgainstSchema } from './registry'
import type { SkillDefinition, SkillInvocationResult } from './types'

export type ExecuteSkillOptions = {
  /** Permissions the caller actually holds. */
  grantedPermissions: string[]
  correlationId?: string
  requestedBy?: string
  /** Overrides the skill's declared timeout (milliseconds). */
  timeoutMs?: number
  /**
   * Diagnostic seam: run a specific handler instead of the one bound to
   * the definition. Used by the test-suite to exercise the timeout and
   * failure paths, and by a future reviewed plugin loader. It is never
   * populated from request input.
   */
  handlerOverride?: (input: Record<string, unknown>, ctx: { configuration: Record<string, unknown>; correlationId: string }) => Record<string, unknown>
  /** Persist the run row. Disabled in unit tests that have no database. */
  persist?: boolean
}

export type PermissionCheck = {
  allowed: boolean
  missing: string[]
}

export function checkPermissions(
  required: string[],
  granted: string[],
): PermissionCheck {
  const grantedSet = new Set(granted)
  const missing = required.filter((permission) => !grantedSet.has(permission))
  return { allowed: missing.length === 0, missing }
}

function withTimeout<T>(work: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`SKILL_TIMEOUT: skill exceeded ${timeoutMs}ms`))
    }, timeoutMs)
    work.then(
      (value) => {
        clearTimeout(timer)
        resolve(value)
      },
      (error) => {
        clearTimeout(timer)
        reject(error)
      },
    )
  })
}

/**
 * Execute a skill. Returns an honest result: on any failure the output
 * is null and an error code is set.
 */
export async function executeSkill(
  definition: SkillDefinition,
  input: Record<string, unknown>,
  options: ExecuteSkillOptions,
): Promise<SkillInvocationResult> {
  const started = Date.now()
  const correlationId = options.correlationId ?? newCorrelationId()

  const fail = (errorCode: string, error: string): SkillInvocationResult => ({
    ok: false,
    skillId: definition.id,
    version: definition.version,
    output: null,
    error,
    errorCode,
    durationMs: Date.now() - started,
  })

  if (definition.status !== 'ACTIVE') {
    return fail('SKILL_NOT_ACTIVE', `skill "${definition.id}" is ${definition.status}`)
  }
  const handler = options.handlerOverride ?? SKILL_HANDLERS[definition.handler]
  if (!handler) {
    return fail('SKILL_NOT_IMPLEMENTED', `skill "${definition.id}" has no executable handler`)
  }

  const permission = checkPermissions(definition.permissions, options.grantedPermissions)
  if (!permission.allowed) {
    return fail(
      'PERMISSION_DENIED',
      `skill "${definition.id}" requires permissions that were not granted: ${permission.missing.join(', ')}`,
    )
  }

  const inputCheck = validateAgainstSchema(input, definition.inputSchema)
  if (!inputCheck.valid) {
    return fail('INVALID_INPUT', `skill "${definition.id}" input rejected: ${inputCheck.errors.join('; ')}`)
  }

  const timeoutMs = options.timeoutMs ?? definition.limits.timeoutSeconds * 1000
  let raw: Record<string, unknown>
  try {
    raw = await withTimeout(
      Promise.resolve(handler(input, { configuration: definition.configuration, correlationId })),
      timeoutMs,
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : 'skill handler failed'
    return fail(message.startsWith('SKILL_TIMEOUT') ? 'SKILL_TIMEOUT' : 'HANDLER_ERROR', message)
  }

  const outputCheck = validateAgainstSchema(raw, definition.outputSchema)
  if (!outputCheck.valid) {
    return fail(
      'INVALID_OUTPUT',
      `skill "${definition.id}" produced an output that does not match its declared schema: ${outputCheck.errors.join('; ')}`,
    )
  }

  const result: SkillInvocationResult = {
    ok: true,
    skillId: definition.id,
    version: definition.version,
    output: raw,
    error: null,
    errorCode: null,
    durationMs: Date.now() - started,
  }

  if (options.persist !== false) {
    await recordSkillRun(definition, input, result, correlationId, options.requestedBy)
  }

  return result
}

async function recordSkillRun(
  definition: SkillDefinition,
  input: Record<string, unknown>,
  result: SkillInvocationResult,
  correlationId: string,
  requestedBy: string | undefined,
): Promise<void> {
  try {
    // The Prisma client and the audit writer are imported lazily so the
    // pure execution path (validate → run → validate) never requires a
    // database connection or a Prisma client to be generated.
    const [{ db }, { audit }] = await Promise.all([import('@/lib/db'), import('@/lib/security')])
    const skill = await db.skill.findUnique({ where: { slug: definition.id }, select: { id: true } })
    if (!skill) return
    await db.skillRun.create({
      data: {
        skillId: skill.id,
        skillSlug: definition.id,
        version: definition.version,
        status: result.ok ? 'SUCCESS' : 'FAILED',
        input: JSON.stringify(input).slice(0, 20_000),
        output: result.output ? JSON.stringify(result.output).slice(0, 20_000) : null,
        error: result.error,
        correlationId,
        durationMs: result.durationMs,
        requestedBy: requestedBy ?? null,
        completedAt: new Date(),
      },
    })
  } catch (error) {
    // A failure to record the run must not be reported as a skill failure,
    // but it must be visible.
    console.error('[skills] failed to record skill run', error)
  }

  const { audit } = await import('@/lib/security')
  await audit({
    actor: requestedBy ? `user:${requestedBy}` : 'system:skills',
    action: 'SKILL_EXECUTED',
    entityType: 'Skill',
    entityId: definition.id,
    details: {
      correlationId,
      ok: result.ok,
      errorCode: result.errorCode,
      durationMs: result.durationMs,
      version: definition.version,
    },
  })
}
