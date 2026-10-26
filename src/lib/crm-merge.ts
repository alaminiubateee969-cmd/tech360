import { db } from '@/lib/db'
import { audit } from '@/lib/security'

// ============================================================
// CRM DUPLICATE DETECTION & AUDITABLE CLIENT MERGE ENGINE
//
// Enforces:
//   1. Zero silent auto-merges on unverified contact claims —
//      duplicates are surfaced for explicit human review.
//   2. Auditable merge (`crm.merge` capability) preserves BOTH
//      original `TECH-YYYY-NNNNNN` IDs permanently, transfers
//      every message/scope/project/invoice/payment/receipt/file
//      without data loss, and records immutable audit + memory
//      trails on both canonical Client IDs.
// ============================================================

export type DuplicateMatchReason =
  | 'EMAIL_MATCH'
  | 'WHATSAPP_MATCH'
  | 'PHONE_MATCH'
  | 'BUSINESS_NAME_MATCH'

export interface MergeableClientSummary {
  id: string
  clientId: string
  name: string
  businessName?: string | null
  email?: string | null
  phone?: string | null
  whatsapp?: string | null
  status: string
  pipelineStage: string
  mergedIntoId?: string | null
  deletedAt?: Date | string | null
  createdAt?: Date | string
}

export interface DuplicateCandidate {
  client: MergeableClientSummary
  reasons: DuplicateMatchReason[]
  confidenceScore: number
}

export function normalizeCrmEmail(email: string | null | undefined): string | null {
  if (!email) return null
  const clean = email.trim().toLowerCase()
  return clean.includes('@') && clean.length >= 5 ? clean : null
}

export function normalizeCrmPhone(phone: string | null | undefined): string | null {
  if (!phone) return null
  const digits = phone.replace(/[^\d]/g, '')
  return digits.length >= 8 ? digits : null
}

export function normalizeBusinessName(name: string | null | undefined): string | null {
  if (!name) return null
  const clean = name.trim().replace(/\s+/g, ' ').toLowerCase()
  return clean.length >= 4 ? clean : null
}

/**
 * Pure duplicate-detection policy — compares `subject` against candidate active
 * clients and returns matches ranked by confidence without performing any
 * automatic mutation.
 */
export function detectDuplicateClients(
  subject: MergeableClientSummary,
  candidates: MergeableClientSummary[],
): DuplicateCandidate[] {
  const subjEmail = normalizeCrmEmail(subject.email)
  const subjPhone = normalizeCrmPhone(subject.phone)
  const subjWhatsapp = normalizeCrmPhone(subject.whatsapp)
  const subjPhones = new Set([subjPhone, subjWhatsapp].filter((v): v is string => Boolean(v)))
  const subjBiz = normalizeBusinessName(subject.businessName)

  const results: DuplicateCandidate[] = []

  for (const cand of candidates) {
    if (cand.id === subject.id || cand.clientId === subject.clientId) continue
    if (cand.deletedAt || cand.mergedIntoId) continue

    const reasons: DuplicateMatchReason[] = []
    let score = 0

    const candEmail = normalizeCrmEmail(cand.email)
    if (subjEmail && candEmail && subjEmail === candEmail) {
      reasons.push('EMAIL_MATCH')
      score += 60
    }

    const candWhatsapp = normalizeCrmPhone(cand.whatsapp)
    if (candWhatsapp && subjPhones.has(candWhatsapp)) {
      reasons.push('WHATSAPP_MATCH')
      score += 50
    }

    const candPhone = normalizeCrmPhone(cand.phone)
    if (candPhone && subjPhones.has(candPhone) && !reasons.includes('WHATSAPP_MATCH')) {
      reasons.push('PHONE_MATCH')
      score += 45
    }

    const candBiz = normalizeBusinessName(cand.businessName)
    if (subjBiz && candBiz && subjBiz === candBiz) {
      reasons.push('BUSINESS_NAME_MATCH')
      score += 25
    }

    if (reasons.length > 0) {
      results.push({ client: cand, reasons, confidenceScore: Math.min(100, score) })
    }
  }

  results.sort((a, b) => b.confidenceScore - a.confidenceScore)
  return results
}

export function validateClientMergeRequest(input: {
  target: Pick<MergeableClientSummary, 'id' | 'clientId' | 'deletedAt' | 'mergedIntoId'> | null
  source: Pick<MergeableClientSummary, 'id' | 'clientId' | 'deletedAt' | 'mergedIntoId'> | null
  reason: string
}): { ok: true } | { ok: false; code: string; error: string; status: number } {
  if (!input.target) {
    return { ok: false, code: 'TARGET_NOT_FOUND', error: 'Primary target client not found.', status: 404 }
  }
  if (!input.source) {
    return { ok: false, code: 'SOURCE_NOT_FOUND', error: 'Duplicate source client not found.', status: 404 }
  }
  if (input.target.id === input.source.id || input.target.clientId === input.source.clientId) {
    return { ok: false, code: 'SELF_MERGE_FORBIDDEN', error: 'Cannot merge a client record into itself.', status: 400 }
  }
  if (input.target.deletedAt || input.target.mergedIntoId) {
    return {
      ok: false,
      code: 'TARGET_INACTIVE',
      error: 'Primary target client is archived or already merged into another record.',
      status: 409,
    }
  }
  if (input.source.mergedIntoId) {
    return {
      ok: false,
      code: 'SOURCE_ALREADY_MERGED',
      error: `Source client ${input.source.clientId} has already been merged.`,
      status: 409,
    }
  }
  const cleanReason = input.reason.trim()
  if (cleanReason.length < 10 || cleanReason.length > 1000) {
    return {
      ok: false,
      code: 'MERGE_REASON_REQUIRED',
      error: 'Provide an explicit merge reason between 10 and 1000 characters for the audit log.',
      status: 400,
    }
  }
  return { ok: true }
}

export async function findDuplicateCandidatesForClient(clientIdOrRef: string) {
  const subject = await db.client.findFirst({
    where: { OR: [{ id: clientIdOrRef }, { clientId: clientIdOrRef }] },
    select: {
      id: true,
      clientId: true,
      name: true,
      businessName: true,
      email: true,
      phone: true,
      whatsapp: true,
      status: true,
      pipelineStage: true,
      mergedIntoId: true,
      deletedAt: true,
      createdAt: true,
    },
  })
  if (!subject) return null

  const email = normalizeCrmEmail(subject.email)
  const phone = normalizeCrmPhone(subject.phone)
  const whatsapp = normalizeCrmPhone(subject.whatsapp)
  const biz = subject.businessName?.trim()

  const orClauses: Record<string, unknown>[] = []
  if (email) orClauses.push({ email })
  if (phone) {
    orClauses.push({ phone: { contains: phone.slice(-8) } })
    orClauses.push({ whatsapp: { contains: phone.slice(-8) } })
  }
  if (whatsapp && whatsapp !== phone) {
    orClauses.push({ whatsapp: { contains: whatsapp.slice(-8) } })
    orClauses.push({ phone: { contains: whatsapp.slice(-8) } })
  }
  if (biz && biz.length >= 4) {
    orClauses.push({ businessName: biz })
  }

  const [pool, mergedChildren] = await Promise.all([
    orClauses.length > 0
      ? db.client.findMany({
          where: {
            id: { not: subject.id },
            deletedAt: null,
            mergedIntoId: null,
            OR: orClauses,
          },
          take: 50,
          select: {
            id: true,
            clientId: true,
            name: true,
            businessName: true,
            email: true,
            phone: true,
            whatsapp: true,
            status: true,
            pipelineStage: true,
            mergedIntoId: true,
            deletedAt: true,
            createdAt: true,
          },
        })
      : Promise.resolve([]),
    db.client.findMany({
      where: { mergedIntoId: subject.id },
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true,
        clientId: true,
        name: true,
        businessName: true,
        email: true,
        phone: true,
        whatsapp: true,
        status: true,
        updatedAt: true,
      },
    }),
  ])

  return {
    subject,
    duplicates: detectDuplicateClients(subject, pool),
    mergedChildren,
  }
}

export async function executeClientMerge(input: {
  targetRef: string
  sourceRef: string
  reason: string
  actorId: string
  actorEmail: string
  ip?: string
}) {
  const [target, source] = await Promise.all([
    db.client.findFirst({
      where: { OR: [{ id: input.targetRef }, { clientId: input.targetRef }] },
      include: { lead: true },
    }),
    db.client.findFirst({
      where: { OR: [{ id: input.sourceRef }, { clientId: input.sourceRef }] },
      include: { lead: true },
    }),
  ])

  const check = validateClientMergeRequest({ target, source, reason: input.reason })
  if (!check.ok) return check
  if (!target || !source) {
    return { ok: false as const, code: 'CLIENT_NOT_FOUND', error: 'Client not found.', status: 404 }
  }

  const now = new Date()
  const cleanReason = input.reason.trim()

  const summary = await db.$transaction(async (tx) => {
    // 1. Enrich missing primary fields on target without overwriting non-empty values
    await tx.client.update({
      where: { id: target.id },
      data: {
        businessName: target.businessName || source.businessName,
        businessType: target.businessType || source.businessType,
        email: target.email || source.email,
        phone: target.phone || source.phone,
        whatsapp: target.whatsapp || source.whatsapp,
        country: target.country || source.country,
        preferredContact: target.preferredContact || source.preferredContact,
      },
    })

    // 2. Preserve Lead requirements without violating Lead.clientId @unique
    if (source.lead) {
      if (target.lead) {
        const mergedReq = `${target.lead.requirements ?? ''}\n\n[Merged from ${source.clientId} on ${now.toISOString().slice(0, 10)}]\n${source.lead.requirements ?? ''}`.slice(0, 16_000)
        await tx.lead.update({
          where: { id: target.lead.id },
          data: {
            requirements: mergedReq,
            budgetRange: target.lead.budgetRange || source.lead.budgetRange,
            projectType: target.lead.projectType || source.lead.projectType,
          },
        })
      } else {
        await tx.lead.update({
          where: { id: source.lead.id },
          data: { clientId: target.id },
        })
      }
    }

    // 3. Re-sequence ScopeOfWork versions if needed so @@unique([clientId, version]) never collides
    const [targetScopes, sourceScopes] = await Promise.all([
      tx.scopeOfWork.findMany({ where: { clientId: target.id }, select: { version: true } }),
      tx.scopeOfWork.findMany({ where: { clientId: source.id }, orderBy: { version: 'asc' }, select: { id: true, version: true } }),
    ])
    let maxVersion = targetScopes.reduce((m, s) => Math.max(m, s.version), 0)
    const usedVersions = new Set(targetScopes.map((s) => s.version))
    for (const sc of sourceScopes) {
      const nextVer = usedVersions.has(sc.version) ? ++maxVersion : sc.version
      usedVersions.add(nextVer)
      if (nextVer > maxVersion) maxVersion = nextVer
      await tx.scopeOfWork.update({
        where: { id: sc.id },
        data: { clientId: target.id, version: nextVer },
      })
    }

    // 4. Re-parent all relational records atomically (preserving every message, project, invoice, payment & receipt)
    const [
      comms,
      projects,
      invoices,
      payments,
      receipts,
      refunds,
      previews,
      files,
      identities,
      chats,
    ] = await Promise.all([
      tx.communication.updateMany({ where: { clientId: source.id }, data: { clientId: target.id } }),
      tx.project.updateMany({ where: { clientId: source.id }, data: { clientId: target.id } }),
      tx.invoice.updateMany({ where: { clientId: source.id }, data: { clientId: target.id } }),
      tx.payment.updateMany({ where: { clientId: source.id }, data: { clientId: target.id } }),
      tx.paymentReceipt.updateMany({ where: { clientId: source.id }, data: { clientId: target.id } }),
      tx.refundCase.updateMany({ where: { clientId: source.id }, data: { clientId: target.id } }),
      tx.preview.updateMany({ where: { clientId: source.id }, data: { clientId: target.id } }),
      tx.fileRecord.updateMany({ where: { clientId: source.id }, data: { clientId: target.id } }),
      tx.clientIdentity.updateMany({ where: { clientId: source.id }, data: { clientId: target.id } }),
      tx.chatConversation.updateMany({ where: { clientId: source.id }, data: { clientId: target.id } }),
    ])

    await Promise.all([
      tx.scopeApproval.updateMany({ where: { clientId: source.id }, data: { clientId: target.id } }),
      tx.meeting.updateMany({ where: { clientId: source.id }, data: { clientId: target.id } }),
      tx.delivery.updateMany({ where: { clientId: source.id }, data: { clientId: target.id } }),
      tx.handoverRecord.updateMany({ where: { clientId: source.id }, data: { clientId: target.id } }),
      tx.review.updateMany({ where: { clientId: source.id }, data: { clientId: target.id } }),
      tx.referral.updateMany({ where: { clientId: source.id }, data: { clientId: target.id } }),
      tx.referral.updateMany({ where: { convertedClientId: source.id }, data: { convertedClientId: target.id } }),
      tx.formSubmission.updateMany({ where: { clientId: source.id }, data: { clientId: target.id } }),
      tx.agentJob.updateMany({ where: { clientId: source.id }, data: { clientId: target.id } }),
      tx.inboundWebhookReceipt.updateMany({ where: { clientId: source.id }, data: { clientId: target.id } }),
      tx.aiMemory.updateMany({ where: { clientId: source.id }, data: { clientId: target.id } }),
      tx.contentAsset.updateMany({ where: { clientId: source.id }, data: { clientId: target.id } }),
      tx.approvalRequest.updateMany({ where: { clientId: source.id }, data: { clientId: target.id } }),
      tx.automationLog.updateMany({ where: { clientId: source.id }, data: { clientId: target.id } }),
    ])

    // 5. Record permanent merge lineage memory on target
    await tx.aiMemory.create({
      data: {
        scope: 'CLIENT',
        key: `MERGED_CLIENT_${source.clientId}`,
        content: JSON.stringify({
          mergedClientId: source.clientId,
          mergedInternalId: source.id,
          intoClientId: target.clientId,
          mergedAt: now.toISOString(),
          mergedBy: input.actorEmail,
          reason: cleanReason,
          preservedSnapshot: {
            name: source.name,
            businessName: source.businessName,
            email: source.email,
            phone: source.phone,
            whatsapp: source.whatsapp,
          },
        }),
        clientId: target.id,
        importance: 9,
      },
    })

    // 6. Archive source record with mergedIntoId pointer (NEVER delete its TECH-YYYY-NNNNNN row!)
    await tx.client.update({
      where: { id: source.id },
      data: {
        mergedIntoId: target.id,
        status: 'MERGED',
        deletedAt: now,
      },
    })

    return {
      communicationsMoved: comms.count,
      scopesMoved: sourceScopes.length,
      projectsMoved: projects.count,
      invoicesMoved: invoices.count,
      paymentsMoved: payments.count,
      receiptsMoved: receipts.count,
      refundCasesMoved: refunds.count,
      previewsMoved: previews.count,
      filesMoved: files.count,
      identitiesMoved: identities.count,
      chatsMoved: chats.count,
    }
  })

  const auditPayload = {
    primaryClientId: target.clientId,
    mergedDuplicateClientId: source.clientId,
    reason: cleanReason,
    ...summary,
  }

  await Promise.all([
    audit({
      userId: input.actorId,
      actor: input.actorEmail,
      action: 'CLIENT_MERGED_PRIMARY',
      entityType: 'Client',
      entityId: target.id,
      clientId: target.clientId,
      details: auditPayload,
      ip: input.ip,
    }),
    audit({
      userId: input.actorId,
      actor: input.actorEmail,
      action: 'CLIENT_MERGED_INTO_PRIMARY',
      entityType: 'Client',
      entityId: source.id,
      clientId: source.clientId,
      details: auditPayload,
      ip: input.ip,
    }),
  ])

  return {
    ok: true as const,
    primaryClientId: target.clientId,
    mergedClientId: source.clientId,
    summary,
  }
}
