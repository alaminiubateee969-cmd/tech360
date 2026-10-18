import { NextRequest } from 'next/server'
import { guard, isResponse } from '@/lib/api-guard'
import { sanitizeText } from '@/lib/security'
import { getWorkflow } from '@/lib/workflows/definitions'

export const dynamic = 'force-dynamic'

/**
 * GET /api/admin/workflows/{id} — reload one persisted workflow diagram.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const g = await guard(req, { minRole: 'SUPER_ADMIN' })
  if (isResponse(g)) return g
  const { id } = await params
  const workflow = await getWorkflow(sanitizeText(id, 64))
  if (!workflow) return Response.json({ error: 'Workflow not found.', code: 'UNKNOWN_WORKFLOW' }, { status: 404 })
  return Response.json({ workflow })
}
