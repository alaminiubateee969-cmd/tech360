import { NextRequest } from 'next/server'
import { guard, isResponse } from '@/lib/api-guard'
import { readJson, sanitizeText } from '@/lib/security'
import { executeClientMerge, findDuplicateCandidatesForClient } from '@/lib/crm-merge'

export const dynamic = 'force-dynamic'

// GET /api/admin/clients/[id]/merge — surface potential duplicate leads/clients + merge history
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const g = await guard(req, { capability: 'crm.read', capabilityOnly: true })
  if (isResponse(g)) return g

  const { id } = await params
  const ref = sanitizeText(id, 40)
  const result = await findDuplicateCandidatesForClient(ref)
  if (!result) return Response.json({ error: 'Client not found' }, { status: 404 })

  return Response.json({
    ok: true,
    clientId: result.subject.clientId,
    mergedIntoId: result.subject.mergedIntoId,
    duplicates: result.duplicates,
    mergedChildren: result.mergedChildren,
  })
}

// POST /api/admin/clients/[id]/merge — auditable merge of duplicate `sourceClientId` INTO `[id]`
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const g = await guard(req, { capability: 'crm.merge', capabilityOnly: true })
  if (isResponse(g)) return g

  const { id } = await params
  const targetRef = sanitizeText(id, 40)
  const raw = await readJson(req)
  const sourceRef = sanitizeText(raw.sourceClientId, 40)
  const reason = sanitizeText(raw.reason, 1000)

  if (!sourceRef) {
    return Response.json({ ok: false, code: 'SOURCE_REQUIRED', error: 'sourceClientId is required.' }, { status: 400 })
  }

  const outcome = await executeClientMerge({
    targetRef,
    sourceRef,
    reason,
    actorId: g.user.id,
    actorEmail: g.user.email,
    ip: g.ip,
  })

  if (!outcome.ok) {
    return Response.json({ ok: false, code: outcome.code, error: outcome.error }, { status: outcome.status })
  }

  return Response.json(outcome)
}
