import { NextRequest } from 'next/server'
import { POST as decide } from '@/app/api/admin/approvals/[id]/decision/route'

export const dynamic = 'force-dynamic'

/**
 * POST /api/approvals/{id}/approve
 *
 * Approves a pending sensitive action and executes it.
 *
 * It delegates to the EXISTING admin decision route with the decision
 * forced to APPROVED, so the RBAC rule, the atomic claim, the audit
 * trail and the gated execution are literally the same code path — one
 * implementation, not two that can drift apart.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const body = await readBody(req)
  body.decision = 'APPROVED'
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
