// ============================================================
// TECH360 — automation rule management (versioned)
// ============================================================
// A rule body change (trigger, conditions, actions, approval flag, attempts)
// creates a new immutable AutomationRuleVersion. Runs execute the version they
// matched, and approvals are bound to that version's fingerprint.
// ============================================================

import { db } from '@/lib/db'
import { stableStringify, validateRule, type Condition, type RuleAction, type TriggerType } from '@/lib/automation/catalog'
import type { RuleSnapshot } from '@/lib/automation/engine'

export class RuleValidationError extends Error {
  readonly issues: string[]
  constructor(issues: string[]) { super(issues.join('; ')); this.name = 'RuleValidationError'; this.issues = issues }
}

export type RuleInput = {
  id?: string
  key: string
  name: string
  description?: string | null
  triggerType: TriggerType
  conditions: Condition[]
  actions: RuleAction[]
  requiresApproval?: boolean
  maxAttempts?: number
}

function parse<T>(s: string, fb: T): T { try { return JSON.parse(s) as T } catch { return fb } }

export function serializeRule(rule: NonNullable<Awaited<ReturnType<typeof db.automationRule.findUnique>>>) {
  return {
    id: rule.id,
    key: rule.key,
    name: rule.name,
    description: rule.description,
    triggerType: rule.triggerType,
    conditions: parse<Condition[]>(rule.conditions, []),
    actions: parse<RuleAction[]>(rule.actions, []),
    status: rule.status,
    version: rule.version,
    requiresApproval: rule.requiresApproval,
    maxAttempts: rule.maxAttempts,
    createdBy: rule.createdBy,
    updatedBy: rule.updatedBy,
    createdAt: rule.createdAt.toISOString(),
    updatedAt: rule.updatedAt.toISOString(),
  }
}

export async function saveRule(tenantId: string, input: RuleInput, actorEmail: string) {
  const issues = validateRule({ triggerType: input.triggerType, conditions: input.conditions, actions: input.actions, maxAttempts: input.maxAttempts })
  if (!/^[a-z0-9][a-z0-9_-]{1,58}[a-z0-9]$/.test(input.key)) issues.push('key must be 3–60 lowercase letters, digits, - or _')
  if (!input.name.trim()) issues.push('name is required')
  if (issues.length) throw new RuleValidationError(issues)

  const snapshot: RuleSnapshot = {
    triggerType: input.triggerType,
    conditions: input.conditions,
    actions: input.actions.map((a) => ({ type: a.type, params: a.params ?? {}, ...(a.when ? { when: a.when } : {}), ...(a.onFailure ? { onFailure: a.onFailure } : {}) })),
    requiresApproval: Boolean(input.requiresApproval),
    maxAttempts: input.maxAttempts ?? 3,
  }
  const body = {
    triggerType: snapshot.triggerType,
    conditions: JSON.stringify(snapshot.conditions),
    actions: JSON.stringify(snapshot.actions),
    requiresApproval: snapshot.requiresApproval,
    maxAttempts: snapshot.maxAttempts,
  }

  return db.$transaction(async (tx) => {
    const existing = input.id
      ? await tx.automationRule.findFirst({ where: { id: input.id, tenantId } })
      : await tx.automationRule.findFirst({ where: { key: input.key, tenantId } })
    if (input.id && !existing) throw new RuleValidationError(['rule not found'])
    if (!existing) {
      const created = await tx.automationRule.create({
        data: { tenantId, key: input.key, name: input.name.trim(), description: input.description ?? null, ...body, status: 'DRAFT', version: 1, createdBy: actorEmail, updatedBy: actorEmail },
      })
      await tx.automationRuleVersion.create({ data: { ruleId: created.id, version: 1, snapshot: stableStringify(snapshot), createdBy: actorEmail } })
      return { rule: created, versionCreated: true }
    }
    const prior = parse<RuleSnapshot | null>((await tx.automationRuleVersion.findUnique({ where: { ruleId_version: { ruleId: existing.id, version: existing.version } } }))?.snapshot ?? 'null', null)
    const changed = !prior || stableStringify(prior) !== stableStringify(snapshot)
    const version = changed ? existing.version + 1 : existing.version
    const updated = await tx.automationRule.update({
      where: { id: existing.id },
      data: { name: input.name.trim(), description: input.description ?? null, ...body, version, updatedBy: actorEmail },
    })
    if (changed) await tx.automationRuleVersion.create({ data: { ruleId: existing.id, version, snapshot: stableStringify(snapshot), createdBy: actorEmail } })
    return { rule: updated, versionCreated: changed }
  })
}

export async function setRuleStatus(tenantId: string, ruleId: string, status: 'DRAFT' | 'ACTIVE' | 'DISABLED', actorEmail: string) {
  const rule = await db.automationRule.findFirst({ where: { id: ruleId, tenantId } })
  if (!rule) return null
  return db.automationRule.update({ where: { id: rule.id }, data: { status, updatedBy: actorEmail } })
}
