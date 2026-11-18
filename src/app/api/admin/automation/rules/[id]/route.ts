import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { guard, isResponse } from '@/lib/api-guard'
import { audit, readJson, sanitizeText } from '@/lib/security'
import { hasCapability } from '@/lib/access-policy'
import { serializeRule, setRuleStatus } from '@/lib/automation/rules'
import { safeParse, serializeRun, tenantFor, type GuardedUser } from '@/lib/automation/admin-shared'

export const dynamic = 'force-dynamic'
type Ctx = { params: Promise<{ id: string }> }

// ADMIN — one rule with its version history and recent runs (tenant-scoped).
export async function GET(req: NextRequest, { params }: Ctx) {
  const g = await guard(req, { minRole: 'ADMIN' })
  if (isResponse(g)) return g
  const tenantId = tenantFor(g.user as GuardedUser)
  const { id } = await params
  const rule = await db.automationRule.findFirst({ where: { id: sanitizeText(id, 40), tenantId } })
  if (!rule) return Response.json({ error: 'Rule not found', code: 'NOT_FOUND' }, { status: 404 })
  const [versions, runs] = await Promise.all([
    db.automationRuleVersion.findMany({ where: { ruleId: rule.id }, orderBy: { version: 'desc' }, take: 50 }),
    db.automationRun.findMany({ where: { tenantId, ruleId: rule.id }, orderBy: { createdAt: 'desc' }, take: 25 }),
  ])
  return Response.json({
    rule: serializeRule(rule),
    versions: versions.map((v) => ({ version: v.version, createdBy: v.createdBy, createdAt: v.createdAt, snapshot: safeParse<unknown>(v.snapshot, null) })),
    runs: runs.map((r) => serializeRun(r, rule.name)),
  })
}

// ADMIN — change rule status. Activation is a Super Admin decision
// (automation policy); anyone allowed here may DISABLE a rule immediately.
export async function PATCH(req: NextRequest, { params }: Ctx) {
  const g = await guard(req, { minRole: 'ADMIN', capability: 'crm.write' })
  if (isResponse(g)) return g
  const user = g.user as GuardedUser
  const tenantId = tenantFor(user)
  const { id } = await params
  const raw = await readJson(req)
  const status = sanitizeText(raw.status, 12).toUpperCase()
  if (status !== 'ACTIVE' && status !== 'DISABLED' && status !== 'DRAFT') {
    return Response.json({ error: 'status must be ACTIVE, DISABLED or DRAFT', code: 'BAD_STATUS' }, { status: 400 })
  }
  if (status === 'ACTIVE' && !hasCapability(user, 'settings.manage')) {
    return Response.json({ error: 'Only a Super Admin can activate automation rules.', code: 'FORBIDDEN' }, { status: 403 })
  }
  const updated = await setRuleStatus(tenantId, sanitizeText(id, 40), status, user.email)
  if (!updated) return Response.json({ error: 'Rule not found', code: 'NOT_FOUND' }, { status: 404 })
  await audit({ actor: user.email, action: `AUTOMATION_RULE_${status}`, userId: user.id, entityType: 'AutomationRule', entityId: updated.id, details: { key: updated.key, version: updated.version }, ip: g.ip })
  return Response.json({ ok: true, rule: serializeRule(updated) })
}
