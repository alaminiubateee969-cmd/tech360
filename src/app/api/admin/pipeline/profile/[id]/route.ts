import { NextRequest } from 'next/server'
import { guard, isResponse } from '@/lib/api-guard'
import { sanitizeText } from '@/lib/security'
import { clientProfile } from '@/lib/pipeline/profile'

export const dynamic = 'force-dynamic'

/**
 * GET /api/admin/pipeline/profile/{clientId}
 *
 * The client profile the communication pipeline is required to keep:
 * the Client ID, the contact details, the lead source and the six
 * histories (message, scope, approval, payment, delivery, review).
 *
 * Accepts the human Client ID (TECH-2026-000001) or the row id.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const g = await guard(req, { minRole: 'STAFF' })
  if (isResponse(g)) return g
  const { id } = await params
  const ref = sanitizeText(id, 60)
  if (!ref) return Response.json({ error: 'Client reference required' }, { status: 400 })

  try {
    const profile = await clientProfile(ref)
    return Response.json({ ok: true, profile })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'unknown'
    if (message === 'Client not found') return Response.json({ error: 'Client not found' }, { status: 404 })
    return Response.json({ error: message }, { status: 500 })
  }
}
