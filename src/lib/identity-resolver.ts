import { createHash, randomUUID } from 'node:crypto'
import { db } from '@/lib/db'
import { prepareIdentity, type PreparedIdentity, type VerifiedIdentityProof } from '@/lib/identity-policy'

export { buildIdentityBackfillPreview, hashNormalizedIdentity, normalizeIdentity } from '@/lib/identity-policy'
export type { IdentityPreviewClient, IdentityType, IdentityVerificationSource, VerifiedIdentityProof } from '@/lib/identity-policy'

type ClientCreateData = {
  clientId: string
  name: string
  businessName: string | null
  businessType: string | null
  email: string | null
  phone: string | null
  whatsapp: string | null
  country: string | null
  source: string
  status: string
  pipelineStage: string
  preferredContact: string | null
}
type ClientRow = NonNullable<Awaited<ReturnType<typeof db.client.findUnique>>>

export class VerifiedIdentityConflictError extends Error {
  constructor() {
    super('Verified identity needs manual review because it is linked to conflicting or deleted client records.')
    this.name = 'VerifiedIdentityConflictError'
  }
}

function uniqueConflict(error: unknown): boolean {
  return !!error && typeof error === 'object' && 'code' in error && (error as { code?: unknown }).code === 'P2002'
}

function identityWhere(identities: PreparedIdentity[]) {
  return {
    OR: identities.map((identity) => ({
      identityType: identity.identityType,
      normalizedHash: identity.normalizedHash,
    })),
  }
}

async function clientForMatches(matches: Array<{ clientId: string }>): Promise<ClientRow | null> {
  const clientIds = [...new Set(matches.map((identity) => identity.clientId))]
  if (clientIds.length > 1) throw new VerifiedIdentityConflictError()
  if (clientIds.length === 0) return null
  const client = await db.client.findUnique({ where: { id: clientIds[0] } })
  if (!client || client.deletedAt) throw new VerifiedIdentityConflictError()
  return client
}

/** Resolve a verified identity without ever matching raw, unverified PII. */
export async function resolveVerifiedClientIdentity(proof: VerifiedIdentityProof): Promise<ClientRow | null> {
  const identity = prepareIdentity(proof)
  const match = await db.clientIdentity.findUnique({
    where: { identityType_normalizedHash: { identityType: identity.identityType, normalizedHash: identity.normalizedHash } },
    select: { clientId: true },
  })
  if (!match) return null
  return clientForMatches([match])
}

/**
 * Atomically find-or-create a client and attach verified identity digests.
 * Concurrent first-contact requests converge on the unique identity row;
 * conflicting identities fail closed; no automatic client merge is performed.
 */
export async function resolveOrCreateVerifiedClient(
  createData: ClientCreateData,
  proofs: VerifiedIdentityProof[],
): Promise<{ client: ClientRow; created: boolean }> {
  if (proofs.length === 0 || proofs.length > 8) throw new Error('One to eight verified identities are required.')
  const identities = proofs.map(prepareIdentity)
  const unique = new Map(identities.map((identity) => [`${identity.identityType}:${identity.normalizedHash}`, identity]))
  const prepared = [...unique.values()]

  try {
    return await db.$transaction(async (tx) => {
      const matches = await tx.clientIdentity.findMany({ where: identityWhere(prepared), select: { clientId: true, identityType: true, normalizedHash: true } })
      const clientIds = [...new Set(matches.map((identity) => identity.clientId))]
      if (clientIds.length > 1) throw new VerifiedIdentityConflictError()

      let client: ClientRow
      let created = false
      if (clientIds.length === 1) {
        const existing = await tx.client.findUnique({ where: { id: clientIds[0] } })
        if (!existing || existing.deletedAt) throw new VerifiedIdentityConflictError()
        client = existing
      } else {
        client = await tx.client.create({ data: createData })
        created = true
      }

      const matchKeys = new Set(matches.map((identity) => `${identity.identityType}:${identity.normalizedHash}`))
      for (const identity of prepared) {
        const key = `${identity.identityType}:${identity.normalizedHash}`
        if (matchKeys.has(key)) continue
        await tx.clientIdentity.create({
          data: {
            clientId: client.id,
            identityType: identity.identityType,
            normalizedHash: identity.normalizedHash,
            verificationSource: identity.verificationSource,
            verifiedAt: identity.verifiedAt,
          },
        })
      }
      return { client, created }
    })
  } catch (error) {
    if (!uniqueConflict(error)) throw error
    const matches = await db.clientIdentity.findMany({ where: identityWhere(prepared), select: { clientId: true } })
    const client = await clientForMatches(matches)
    if (!client) throw error
    return { client, created: false }
  }
}

/**
 * Persist a provider-verified identity for an already authenticated client.
 * Unlike resolveOrCreateVerifiedClient, this function never creates a Client.
 */
export async function recordVerifiedIdentityForClient(input: {
  clientRowId: string
  proof: VerifiedIdentityProof
}): Promise<{ recorded: boolean; identityType: string }> {
  const identity = prepareIdentity(input.proof)
  try {
    return await db.$transaction(async (tx) => {
      const client = await tx.client.findUnique({ where: { id: input.clientRowId }, select: { id: true, deletedAt: true } })
      if (!client || client.deletedAt) throw new Error('Client not found or deleted.')
      const existing = await tx.clientIdentity.findUnique({
        where: { identityType_normalizedHash: { identityType: identity.identityType, normalizedHash: identity.normalizedHash } },
        select: { id: true, clientId: true },
      })
      if (existing) {
        if (existing.clientId !== client.id) throw new VerifiedIdentityConflictError()
        return { recorded: false, identityType: identity.identityType }
      }
      const created = await tx.clientIdentity.create({
        data: {
          clientId: client.id,
          identityType: identity.identityType,
          normalizedHash: identity.normalizedHash,
          verificationSource: identity.verificationSource,
          verifiedAt: identity.verifiedAt,
        },
        select: { id: true },
      })
      await tx.auditLog.create({
        data: {
          actor: `system:${identity.verificationSource.toLowerCase()}`,
          action: 'CLIENT_IDENTITY_VERIFIED',
          entityType: 'ClientIdentity',
          entityId: created.id,
          clientId: client.id,
          details: JSON.stringify({ identityType: identity.identityType, verificationSource: identity.verificationSource }),
        },
      })
      return { recorded: true, identityType: identity.identityType }
    })
  } catch (error) {
    if (!uniqueConflict(error)) throw error
    const existing = await db.clientIdentity.findUnique({
      where: { identityType_normalizedHash: { identityType: identity.identityType, normalizedHash: identity.normalizedHash } },
      select: { clientId: true },
    })
    if (existing?.clientId === input.clientRowId) {
      return { recorded: false, identityType: identity.identityType }
    }
    throw new VerifiedIdentityConflictError()
  }
}

/** Manually verify and attach one identity with a reason and immutable audit entry. */
export async function linkVerifiedIdentityToClient(input: {
  clientId: string
  proof: VerifiedIdentityProof
  actorId: string
  reason: string
}): Promise<{ linked: boolean; identityType: string }> {
  if (input.reason.trim().length < 10 || input.reason.length > 1000) throw new Error('A verification reason of 10–1000 characters is required.')
  const identity = prepareIdentity({ ...input.proof, verificationSource: 'ADMIN_VERIFIED' })

  try {
    return await db.$transaction(async (tx) => {
      const client = await tx.client.findUnique({ where: { id: input.clientId }, select: { id: true, deletedAt: true } })
      if (!client || client.deletedAt) throw new Error('Client not found or deleted.')
      const existing = await tx.clientIdentity.findUnique({
        where: { identityType_normalizedHash: { identityType: identity.identityType, normalizedHash: identity.normalizedHash } },
        select: { id: true, clientId: true },
      })
      if (existing) {
        if (existing.clientId !== client.id) throw new VerifiedIdentityConflictError()
        return { linked: false, identityType: identity.identityType }
      }
      const linked = await tx.clientIdentity.create({
        data: {
          clientId: client.id,
          identityType: identity.identityType,
          normalizedHash: identity.normalizedHash,
          verificationSource: 'ADMIN_VERIFIED',
          verifiedAt: identity.verifiedAt,
        },
        select: { id: true },
      })
      await tx.auditLog.create({
        data: {
          actor: input.actorId,
          action: 'CLIENT_IDENTITY_MANUALLY_VERIFIED',
          entityType: 'ClientIdentity',
          entityId: linked.id,
          clientId: client.id,
          details: JSON.stringify({ identityType: identity.identityType, verificationSource: 'ADMIN_VERIFIED', reason: input.reason.trim().slice(0, 1000) }),
        },
      })
      return { linked: true, identityType: identity.identityType }
    })
  } catch (error) {
    if (!uniqueConflict(error)) throw error
    const existing = await db.clientIdentity.findUnique({
      where: { identityType_normalizedHash: { identityType: identity.identityType, normalizedHash: identity.normalizedHash } },
      select: { clientId: true },
    })
    if (existing?.clientId === input.clientId) return { linked: false, identityType: identity.identityType }
    throw new VerifiedIdentityConflictError()
  }
}

export type InboundWebhookClaim = {
  claimed: boolean
  receiptId: string | null
  claimToken: string | null
}

/** Create or reclaim an idempotent webhook receipt using a token-fenced lease. */
export async function claimInboundWebhookEvent(input: {
  provider: string
  providerEventId: string
  eventType?: string
  leaseMs?: number
}): Promise<InboundWebhookClaim> {
  const provider = input.provider.trim().toUpperCase()
  const providerEventId = input.providerEventId.trim()
  if (!/^[A-Z0-9_]{1,16}$/.test(provider) || !providerEventId || providerEventId.length > 175) {
    throw new Error('Webhook provider or event identifier is invalid.')
  }
  const eventIdHash = createHash('sha256').update(provider + '\0' + providerEventId, 'utf8').digest('hex')
  const now = new Date()
  const leaseMs = Math.max(30_000, Math.min(input.leaseMs ?? 5 * 60_000, 15 * 60_000))
  const leaseExpiresAt = new Date(now.getTime() + leaseMs)
  const claimToken = randomUUID()

  try {
    const receipt = await db.inboundWebhookReceipt.create({
      data: { provider, eventIdHash, eventType: input.eventType ?? 'MESSAGE', claimToken, leaseExpiresAt },
      select: { id: true },
    })
    return { claimed: true, receiptId: receipt.id, claimToken }
  } catch (error) {
    if (!uniqueConflict(error)) throw error
    const existing = await db.inboundWebhookReceipt.findUnique({
      where: { provider_eventIdHash: { provider, eventIdHash } },
    })
    if (!existing || existing.status === 'PROCESSED' || (existing.status === 'PROCESSING' && existing.leaseExpiresAt && existing.leaseExpiresAt > now)) {
      return { claimed: false, receiptId: existing?.id ?? null, claimToken: null }
    }

    const reclaimed = await db.inboundWebhookReceipt.updateMany({
      where: { id: existing.id, updatedAt: existing.updatedAt },
      data: {
        status: 'PROCESSING',
        attempts: { increment: 1 },
        claimToken,
        leaseExpiresAt,
        lastError: null,
        processedAt: null,
      },
    })
    return reclaimed.count === 1
      ? { claimed: true, receiptId: existing.id, claimToken }
      : { claimed: false, receiptId: existing.id, claimToken: null }
  }
}

/** Finalize only the receipt claim still owned by this worker token. */
export async function finishInboundWebhookEvent(input: {
  receiptId: string
  claimToken: string
  success: boolean
  clientId?: string | null
  errorCode?: string
}): Promise<boolean> {
  const safeErrorCode = input.errorCode?.replace(/[^A-Za-z0-9_.-]/g, '').slice(0, 80) || null
  const result = await db.inboundWebhookReceipt.updateMany({
    where: { id: input.receiptId, claimToken: input.claimToken, status: 'PROCESSING' },
    data: input.success
      ? { status: 'PROCESSED', clientId: input.clientId ?? null, leaseExpiresAt: null, lastError: null, processedAt: new Date() }
      : { status: 'FAILED', leaseExpiresAt: null, lastError: safeErrorCode ?? 'PROCESSING_FAILED', processedAt: null },
  })
  return result.count === 1
}
