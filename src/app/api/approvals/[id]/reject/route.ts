import { NextRequest } from 'next/server'
import { POST as decide } from '@/app/api/admin/approvals/[id]/decision/route'

export const dynamic = 'force-dynamic'

/**
 * POST /api/approvals/{id}/reject
 *
 * Rejects a pending sensitive action. Nothing is executed.
 *
 * Like the approve route, it delegates to the EXISTING admin decision
 * route with the decision forced to REJECTED, so there is one decision
 * implementation with one RBAC rule and one audit trail.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const body = await readBody(req)
  body.decision = 'REJECTED'
  const forwarded = new NextRequest(req.url, {
    method: 'POST',
    headers: req.headers,
    body: JSON.stringify(body),
  })
  return decide(forwarded, { params })
}

async function readBody(req: NextRequest): Promise<Record<string, unknown>> {
  try {
    const parsed = (await req.json()) as unknown
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed as Record<string, unknown>
    return {}
  } catch {
    return {}
  }
}
