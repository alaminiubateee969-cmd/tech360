import { AI_WORKFORCE_MIN_ROLE } from '@/lib/ai-workforce-policy'
import { featureEnabled } from "@/lib/features"
import { NextRequest } from 'next/server'
import { guard, isResponse } from '@/lib/api-guard'
import { readJson, sanitizeText, audit } from '@/lib/security'
import { runAgent } from '@/lib/agents/engine'

export const dynamic = 'force-dynamic'

// REAL agent execution from the admin console (logged, governed)
export async function POST(req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const g = await guard(req, { minRole: AI_WORKFORCE_MIN_ROLE })
  if (isResponse(g)) return g
  // feature-gate: AI agents switch (Super Admin) — refuses execution,
  // including from the autonomous ops loop trigger path
  if (!(await featureEnabled('ai_agents'))) {
    return Response.json({ error: 'AI agent execution is currently disabled by Super Admin (System → Feature Management).' }, { status: 503 })
  }
  const { code } = await params
  const clean = sanitizeText(code, 20).toUpperCase()
  const raw = await readJson(req)
  const input = sanitizeText(raw.input, 12000)
  if (input.length < 3) return Response.json({ error: 'Input required' }, { status: 400 })

  const run = await runAgent(clean, {
    input, expectJson: raw.expectJson === true,
    contextNote: `Manual execution by admin ${g.user.email} at ${new Date().toISOString()}.`,
    workflow: 'MANUAL_ADMIN',
  })
  await audit({ actor: g.user.email, action: 'AGENT_MANUAL_RUN', userId: g.user.id, entityId: clean, details: { ok: run.ok, executionId: run.executionId } })
  return Response.json({
    ok: run.ok, output: run.output, json: run.json, executionId: run.executionId, status: run.status, error: run.error ?? null,
    message: run.ok ? 'Agent executed. Full log saved in AI executions.' : `Execution failed: ${run.error}`,
  })
}
