import { createHmac } from 'node:crypto'
import { toE164 } from '@/lib/phone'

export type IdentityType = 'EMAIL' | 'PHONE'
export type IdentityVerificationSource = 'WHATSAPP_SIGNATURE' | 'EMAIL_OTP' | 'SMS_OTP' | 'ADMIN_VERIFIED'

export type VerifiedIdentityProof = {
  type: IdentityType
  value: string
  verificationSource: IdentityVerificationSource
  verifiedAt?: Date
}

export type PreparedIdentity = {
  identityType: IdentityType
  normalizedHash: string
  verificationSource: IdentityVerificationSource
  verifiedAt: Date
}

/** Normalize an identity without applying provider- or mailbox-specific alias rules. */
export function normalizeIdentity(type: IdentityType, value: string): string | null {
  if (type === 'EMAIL') {
    const normalized = value.normalize('NFKC').trim().toLowerCase()
    if (normalized.length > 320 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) return null
    return normalized
  }
  return toE164(value)
}

/** Domain-separated HMAC-SHA-256 digest. The normalized PII value is never stored in ClientIdentity. */
export function hashNormalizedIdentity(type: IdentityType, normalized: string): string {
  const secret = process.env.IDENTITY_HASH_SECRET
  if (!secret || Buffer.byteLength(secret, 'utf8') < 32) {
    throw new Error('IDENTITY_HASH_SECRET must be configured with at least 32 bytes before verified identity resolution is enabled.')
  }
  return createHmac('sha256', secret).update(`${type}\0${normalized}`, 'utf8').digest('hex')
}

export function prepareIdentity(proof: VerifiedIdentityProof): PreparedIdentity {
  const normalized = normalizeIdentity(proof.type, proof.value)
  if (!normalized) throw new Error('Verified identity has an invalid value.')
  if (!['WHATSAPP_SIGNATURE', 'EMAIL_OTP', 'SMS_OTP', 'ADMIN_VERIFIED'].includes(proof.verificationSource)) {
    throw new Error('Unsupported identity verification source.')
  }
  const verifiedAt = proof.verifiedAt ?? new Date()
  if (!Number.isFinite(verifiedAt.getTime()) || verifiedAt.getTime() > Date.now() + 60_000) {
    throw new Error('Verified identity timestamp is invalid.')
  }
  return {
    identityType: proof.type,
    normalizedHash: hashNormalizedIdentity(proof.type, normalized),
    verificationSource: proof.verificationSource,
    verifiedAt,
  }
}

export type IdentityPreviewClient = {
  id: string
  clientId?: string
  email: string | null
  phone: string | null
  whatsapp: string | null
}

/** Read-only diagnostic for existing raw contact values; it never creates or links identities. */
export function buildIdentityBackfillPreview(clients: IdentityPreviewClient[]) {
  const groups = new Map<string, { type: IdentityType; clientIds: Set<string>; clientRefs: Map<string, string> }>()
  const candidatePairs: Record<IdentityType, number> = { EMAIL: 0, PHONE: 0 }

  for (const client of clients) {
    const candidates: Array<{ type: IdentityType; value: string | null }> = [
      { type: 'EMAIL', value: client.email },
      { type: 'PHONE', value: client.phone },
      { type: 'PHONE', value: client.whatsapp },
    ]
    const seenForClient = new Set<string>()
    for (const candidate of candidates) {
      if (!candidate.value) continue
      const normalized = normalizeIdentity(candidate.type, candidate.value)
      if (!normalized) continue
      // The normalized value is used only as an ephemeral in-memory preview key;
      // no raw value or digest is returned or persisted by this read-only helper.
      const key = `${candidate.type}\0${normalized}`
      if (seenForClient.has(key)) continue
      seenForClient.add(key)
      candidatePairs[candidate.type]++
      const group = groups.get(key) ?? { type: candidate.type, clientIds: new Set<string>(), clientRefs: new Map<string, string>() }
      group.clientIds.add(client.id)
      group.clientRefs.set(client.id, client.clientId ?? client.id)
      groups.set(key, group)
    }
  }

  const collisions = [...groups.values()].filter((group) => group.clientIds.size > 1)
  const byType = (type: IdentityType) => {
    const typedGroups = [...groups.values()].filter((group) => group.type === type)
    const typedCollisions = typedGroups.filter((group) => group.clientIds.size > 1)
    return {
      candidatePairs: candidatePairs[type],
      collisionGroups: typedCollisions.length,
      clientsInCollisionGroups: new Set(typedCollisions.flatMap((group) => [...group.clientIds])).size,
    }
  }

  return {
    rowsScanned: clients.length,
    candidatePairs: candidatePairs.EMAIL + candidatePairs.PHONE,
    collisionGroups: collisions.length,
    clientsInCollisionGroups: new Set(collisions.flatMap((group) => [...group.clientIds])).size,
    byType: { EMAIL: byType('EMAIL'), PHONE: byType('PHONE') },
    collisionSamples: collisions.slice(0, 50).map((group) => ({ type: group.type, clientRefs: [...group.clientRefs.values()] })),
    collisionSamplesTruncated: collisions.length > 50,
    writesPerformed: 0,
    automaticBackfillEnabled: false,
    note: 'Existing values are unverified claims. No identity is linked until a verification proof is recorded.',
  }
}
