import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { guard, isResponse } from '@/lib/api-guard'
import { readJson, sanitizeText, audit } from '@/lib/security'
import { runAgent } from '@/lib/agents/engine'

export const dynamic = 'force-dynamic'

// Governed agent creation: Midwife drafts, Super Admin approval activates
export async function POST(req: NextRequest) {
  const g = await guard(req, { minRole: 'SUPER_ADMIN' })
  if (isResponse(g)) return g
  const raw = await readJson(req)
  const purpose = sanitizeText(raw.purpose, 300)
  const description = sanitizeText(raw.description, 2000)
  if (purpose.length < 10) return Response.json({ error: 'Describe the agent purpose (at least 10 chars)' }, { status: 400 })

  const run = await runAgent('AGC-041', { input: `Create a new Tech360 AI agent.\nPurpose: ${purpose}\nDetails: ${description}\nProposed by: ${g.user.email}`, expectJson: true, workflow: 'AGENT_CREATION' })
  if (!run.ok || !run.json) {
    return Response.json({ ok: false, message: `Agent drafting failed: ${run.error ?? 'no structured output'}` }, { status: 500 })
  }
  const code = sanitizeText(String(run.json.code ?? `AGT-${Date.now()}`), 20).toUpperCase()
  const deptCode = sanitizeText(String(run.json.department ?? 'D067'), 10).toUpperCase()
  const dept = await db.department.findUnique({ where: { code: deptCode } })
  const agent = await db.aiAgent.upsert({
    where: { code },
    update: {},
    create: {
      code, name: sanitizeText(String(run.json.name ?? 'New Agent'), 60),
      title: sanitizeText(String(run.json.title ?? purpose.slice(0, 80)), 120),
      departmentId: dept?.id ?? null,
      purpose,
      systemPrompt: String(run.json.systemPrompt ?? `You are a Tech360 agent for: ${purpose}`),
      tools: JSON.stringify(Array.isArray(run.json.tools) ? run.json.tools : []),
      permissions: JSON.stringify(Array.isArray(run.json.permissions) ? run.json.permissions : ['read:leads']),
      requiresApproval: run.json.requiresApproval !== false,
      status: 'PAUSED', // never auto-active: Super Admin must activate
    },
  })
  await audit({ actor: g.user.email, action: 'AGENT_CREATED', userId: g.user.id, entityId: code, details: { purpose } })
  return Response.json({ ok: true, agent: { code: agent.code, name: agent.name, status: agent.status }, message: `Agent ${code} drafted and saved as PAUSED. Activate it from the workforce registry after review.` })
}
