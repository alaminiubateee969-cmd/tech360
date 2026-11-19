import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { guard, isResponse } from '@/lib/api-guard'
import { audit, readJson, sanitizeText } from '@/lib/security'
import { hasCapability } from '@/lib/access-policy'
import { RuleValidationError, saveRule, serializeRule, type RuleInput } from '@/lib/automation/rules'
import { isTriggerType, ruleNeedsApproval, type Condition, type RuleAction } from '@/lib/automation/catalog'
import { tenantFor, type GuardedUser } from '@/lib/automation/admin-shared'

export const dynamic = 'force-dynamic'

// ADMIN — automation rules for the caller's tenant, with last-run summary.
export async function GET(req: NextRequest) {
  const g = await guard(req, { minRole: 'ADMIN' })
  if (isResponse(g)) return g
  const tenantId = tenantFor(g.user as GuardedUser)
  const rules = await db.automationRule.findMany({ where: { tenantId }, orderBy: [{ status: 'asc' }, { updatedAt: 'desc' }], take: 200 })
  const ids = rules.map((r) => r.id)
  const lastRuns: Array<{ ruleId: string; status: string; createdAt: Date }> = ids.length
    ? await db.automationRun.findMany({ where: { tenantId, ruleId: { in: ids } }, orderBy: { createdAt: 'desc' }, take: 500, select: { ruleId: true, status: true, createdAt: true } })
    : []
  const failedRuns: Array<{ ruleId: string }> = ids.length
    ? await db.automationRun.findMany({ where: { tenantId, ruleId: { in: ids }, status: { in: ['FAILED', 'DEAD_LETTER'] } }, select: { ruleId: true }, take: 5000 })
    : []
  const lastByRule = new Map<string, { status: string; createdAt: Date }>()
  for (const r of lastRuns) if (!lastByRule.has(r.ruleId)) lastByRule.set(r.ruleId, { status: r.status, createdAt: r.createdAt })
  const failedByRule = new Map<string, number>()
  for (const f of failedRuns) failedByRule.set(f.ruleId, (failedByRule.get(f.ruleId) ?? 0) + 1)
  return Response.json({
    rules: rules.map((r) => {
      const s = serializeRule(r)
      return { ...s, needsApproval: ruleNeedsApproval({ requiresApproval: s.requiresApproval, actions: s.actions }), lastRun: lastByRule.get(r.id) ?? null, failedRuns: failedByRule.get(r.id) ?? 0 }
    }),
  })
}

// ADMIN — create or update a rule. New rules start as DRAFT. Any change to the
// trigger/conditions/actions/approval policy creates a new immutable version.
export async function POST(req: NextRequest) {
  const g = await guard(req, { minRole: 'ADMIN', capability: 'crm.write' })
  if (isResponse(g)) return g
  const user = g.user as GuardedUser
  const tenantId = tenantFor(user)
  const raw = await readJson(req)
  const triggerType = sanitizeText(raw.triggerType, 60)
  if (!isTriggerType(triggerType)) return Response.json({ error: 'Unknown trigger type.', code: 'BAD_TRIGGER' }, { status: 400 })
  const input: RuleInput = {
    id: raw.id ? sanitizeText(raw.id, 40) : undefined,
    key: sanitizeText(raw.key, 60).toLowerCase(),
    name: sanitizeText(raw.name, 120),
    description: raw.description ? sanitizeText(raw.description, 1000) : null,
    triggerType,
    conditions: Array.isArray(raw.conditions) ? (raw.conditions as Condition[]) : [],
    actions: Array.isArray(raw.actions) ? (raw.actions as RuleAction[]) : [],
    requiresApproval: raw.requiresApproval === true,
    maxAttempts: typeof raw.maxAttempts === 'number' ? raw.maxAttempts : undefined,
  }
  try {
    // Editing an ACTIVE rule's behaviour requires the same authority as activating it.
    if (input.id) {
      const existing = await db.automationRule.findFirst({ where: { id: input.id, tenantId }, select: { status: true } })
      if (!existing) return Response.json({ error: 'Rule not found', code: 'NOT_FOUND' }, { status: 404 })
      if (existing.status === 'ACTIVE' && !hasCapability(user, 'settings.manage')) {
        return Response.json({ error: 'Only a Super Admin can change an active rule. Disable it first or ask a Super Admin.', code: 'FORBIDDEN' }, { status: 403 })
      }
    }
    const { rule, versionCreated } = await saveRule(tenantId, input, user.email)
    await audit({ actor: user.email, action: input.id ? 'AUTOMATION_RULE_UPDATED' : 'AUTOMATION_RULE_CREATED', userId: user.id, entityType: 'AutomationRule', entityId: rule.id, details: { key: rule.key, version: rule.version, versionCreated }, ip: g.ip })
    return Response.json({ ok: true, rule: serializeRule(rule), versionCreated }, { status: input.id ? 200 : 201 })
  } catch (error) {
    if (error instanceof RuleValidationError) return Response.json({ error: 'The rule is invalid.', code: 'RULE_INVALID', issues: error.issues }, { status: 422 })
    if ((error as { code?: string })?.code === 'P2002') return Response.json({ error: 'A rule with this key already exists.', code: 'DUPLICATE_KEY' }, { status: 409 })
    throw error
  }
}
