import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { guard, isResponse } from '@/lib/api-guard'
import { audit, readJson, sanitizeText } from '@/lib/security'
import { AI_WORKFORCE_MIN_ROLE } from '@/lib/ai-workforce-policy'
import { tenantFor, type GuardedUser } from '@/lib/automation/admin-shared'

export const dynamic = 'force-dynamic'

const WEBHOOK_PATH = /^[A-Za-z0-9][A-Za-z0-9/_-]{0,190}$/
const CREDENTIAL_NAME = /^[A-Za-z0-9 ._-]{1,80}$/
// Strings that look like secret material are refused: the registry stores NAMES only.
const LOOKS_SECRET = /(sk-|xox[bap]-|ghp_|AKIA|-----BEGIN|bearer\s|[A-Za-z0-9+/]{40,})/i

// SUPER ADMIN — update a workflow's registry entry: enabled flag, webhook
// path (relative to N8N_BASE_URL/webhook/), timeout and credential NAMES.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const g = await guard(req, { minRole: AI_WORKFORCE_MIN_ROLE })
  if (isResponse(g)) return g
  const user = g.user as GuardedUser
  const { code } = await params
  const workflow = await db.n8nWorkflow.findFirst({ where: { code: sanitizeText(code, 80), tenantId: tenantFor(user) } })
  if (!workflow) return Response.json({ error: 'Workflow not found', code: 'NOT_FOUND' }, { status: 404 })
  const raw = await readJson(req)
  const data: { enabled?: boolean; webhookPath?: string | null; timeoutMs?: number; credentialRefs?: string } = {}
  const issues: string[] = []

  if (raw.enabled !== undefined) data.enabled = raw.enabled === true
  if (raw.webhookPath !== undefined) {
    const path = sanitizeText(raw.webhookPath, 200).replace(/^\/+/, '')
    if (path && (!WEBHOOK_PATH.test(path) || path.includes('..') || /^https?:/i.test(path))) issues.push('webhookPath must be a relative path like "tech360/lead-intake" (no host, no query).')
    else data.webhookPath = path || null
  }
  if (raw.timeoutMs !== undefined) {
    const t = Number(raw.timeoutMs)
    if (!Number.isInteger(t) || t < 1000 || t > 60_000) issues.push('timeoutMs must be between 1000 and 60000.')
    else data.timeoutMs = t
  }
  if (raw.credentialRefs !== undefined) {
    const refs = Array.isArray(raw.credentialRefs) ? raw.credentialRefs.map((r) => sanitizeText(r, 80)).filter(Boolean) : []
    if (refs.some((r) => !CREDENTIAL_NAME.test(r) || LOOKS_SECRET.test(r))) issues.push('credentialRefs are n8n credential NAMES only — never paste secret values here.')
    else data.credentialRefs = JSON.stringify([...new Set(refs)].slice(0, 20))
  }
  if (issues.length) return Response.json({ error: 'Invalid workflow settings.', code: 'INVALID', issues }, { status: 422 })
  if (data.enabled && !(data.webhookPath ?? workflow.webhookPath)) {
    return Response.json({ error: 'Register a webhook path before enabling this workflow.', code: 'WEBHOOK_PATH_REQUIRED' }, { status: 422 })
  }
  const updated = await db.n8nWorkflow.update({ where: { id: workflow.id }, data })
  await audit({ actor: user.email, action: 'N8N_WORKFLOW_UPDATED', userId: user.id, entityType: 'N8nWorkflow', entityId: workflow.code, details: { enabled: updated.enabled, webhookPath: updated.webhookPath, timeoutMs: updated.timeoutMs }, ip: g.ip })
  return Response.json({ ok: true, workflow: { code: updated.code, enabled: updated.enabled, webhookPath: updated.webhookPath, timeoutMs: updated.timeoutMs, credentialRefs: JSON.parse(updated.credentialRefs || '[]') } })
}
