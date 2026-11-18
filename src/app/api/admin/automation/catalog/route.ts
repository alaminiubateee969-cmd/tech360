import { NextRequest } from 'next/server'
import { guard, isResponse } from '@/lib/api-guard'
import { ACTION_TYPES, CONDITION_OPS, TRIGGER_TYPES } from '@/lib/automation/catalog'

export const dynamic = 'force-dynamic'

// ADMIN — trigger/action/condition vocabulary for the rule builder (no secrets).
export async function GET(req: NextRequest) {
  const g = await guard(req, { minRole: 'ADMIN' })
  if (isResponse(g)) return g
  return Response.json({
    triggers: Object.entries(TRIGGER_TYPES).map(([type, label]) => ({ type, label })),
    actions: Object.entries(ACTION_TYPES).map(([type, spec]) => ({ type, ...spec })),
    conditionOps: CONDITION_OPS,
  })
}
