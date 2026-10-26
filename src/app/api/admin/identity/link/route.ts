import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { guard, isResponse } from '@/lib/api-guard'
import { readJson, sanitizeText } from '@/lib/security'
import { linkVerifiedIdentityToClient, VerifiedIdentityConflictError } from '@/lib/identity-resolver'
import type { IdentityType } from '@/lib/identity-policy'

export const dynamic = 'force-dynamic'

/** Super Admin attests identity verification manually; raw values are never logged or stored in the identity index. */
export async function POST(req: NextRequest) {
  const g = await guard(req, { minRole: 'SUPER_ADMIN' })
  if (isResponse(g)) return g
  const raw = await readJson(req).catch(() => ({} as Record<string, unknown>))
  const clientRef = sanitizeText(raw.clientId, 64)
  const type = raw.type === 'EMAIL' || raw.type === 'PHONE' ? raw.type as IdentityType : null
  const value = sanitizeText(raw.value, 320)
  const reason = sanitizeText(raw.reason, 1000)
  if (!clientRef || !type || !value || reason.length < 10) {
    return Response.json({ error: 'Client, identity type/value, and a verification reason of at least 10 characters are required.' }, { status: 400 })
  }

  const client = await db.client.findFirst({
    where: { OR: [{ id: clientRef }, { clientId: clientRef }], deletedAt: null },
    select: { id: true, clientId: true },
  })
  if (!client) return Response.json({ error: 'Client not found or deleted.' }, { status: 404 })

  try {
    const result = await linkVerifiedIdentityToClient({
      clientId: client.id,
      proof: { type, value, verificationSource: 'ADMIN_VERIFIED' },
      actorId: g.user.id,
      reason,
    })
    return Response.json({ ok: true, linked: result.linked, clientId: client.clientId, identityType: result.identityType })
  } catch (error) {
    if (error instanceof VerifiedIdentityConflictError) {
      return Response.json({ error: 'This verified identity is already linked to a different client. Resolve the duplicate records manually; no records were merged.' }, { status: 409 })
    }
    const message = error instanceof Error ? error.message : ''
    if (message.includes('IDENTITY_HASH_SECRET')) {
      return Response.json({ error: 'Verified identity linking is not configured. Contact the platform administrator.' }, { status: 503 })
    }
    if (message.includes('invalid value') || message.includes('verification reason')) {
      return Response.json({ error: message }, { status: 400 })
    }
    return Response.json({ error: 'Identity could not be linked. No client records were merged.' }, { status: 500 })
  }
}
