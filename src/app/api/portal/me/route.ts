import { NextRequest } from 'next/server'
import { cookies } from 'next/headers'
import { db } from '@/lib/db'
import { getCustomerPaymentReadiness } from '@/lib/features'
import {
  computeInvoiceSettlement,
  isCustomerVisibleInvoiceStatus,
  isPayableInvoiceStatus,
  resolveInvoiceTotalMinor,
} from '@/lib/invoice-policy'
import { verifyPortalToken, PORTAL_COOKIE, portalGate } from "@/lib/portal"
import { PIPELINE_STAGES } from '@/lib/constants'
import { formatScopeForClient } from '@/lib/journey'
import { paymentStatusLabel } from '@/lib/payment-policy'
import { audit, clientIp, rateLimit, readJson, sanitizeText } from '@/lib/security'
import {
  canReadDocument,
  listEmailDestinations,
  listGeneratedDocuments,
  listSentEmailDocumentArchives,
  type DocumentRecord,
} from '@/lib/document-storage'

export const dynamic = 'force-dynamic'

// Client portal summary — SAFE fields only (no internal notes, agent data,
// admin identities, costs beyond their own payments/invoices).
export async function GET(req: NextRequest) {
  const portalDisabled = await portalGate()
  if (portalDisabled) return portalDisabled
  const store = await cookies()
  const clientId = verifyPortalToken(store.get(PORTAL_COOKIE)?.value)
  if (!clientId) return Response.json({ error: 'Session expired. Please sign in again.' }, { status: 401 })

  const client = await db.client.findFirst({
    where: { clientId, deletedAt: null },
    include: {
      lead: true,
      projects: { orderBy: { createdAt: 'desc' }, include: { tasks: { orderBy: { order: 'asc' } } } },
      scopes: { orderBy: { version: 'desc' } },
      previews: { orderBy: { createdAt: 'desc' } },
      payments: { orderBy: { createdAt: 'desc' }, include: { receipt: { select: { receiptNumber: true } } } },
      invoices: {
        orderBy: { issuedAt: 'desc' },
        include: { payments: { select: { amount: true, status: true } } },
      },
      meetings: { orderBy: [{ scheduledAt: { sort: 'asc', nulls: 'last' } }, { createdAt: 'desc' }] },
    },
  })
  if (!client) return Response.json({ error: 'Client not found' }, { status: 404 })

  const stageIndex = PIPELINE_STAGES.indexOf(client.pipelineStage as (typeof PIPELINE_STAGES)[number])
  const progressPct = Math.round(((stageIndex + 1) / PIPELINE_STAGES.length) * 100)

  const finalScope = client.scopes.filter((s) => s.status === 'FINAL')[0]
  const project = client.projects[0]
  const previewsByAge = [...client.previews].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  const latestPreview = previewsByAge[0]
  const activePreview = previewsByAge.find((p) => !['EXPIRED'].includes(p.status))
  const handover = project ? await db.handoverRecord.findFirst({ where: { projectId: project.id, type: 'SOURCE_CODE' }, orderBy: { createdAt: 'desc' } }) : null
  const delivery = project ? await db.delivery.findFirst({ where: { projectId: project.id }, orderBy: { updatedAt: 'desc' } }) : null
  // Review + referral state for the client feedback card (real records only)
  const reviewRow = await db.review.findFirst({ where: { clientId: client.id } })
  const referralRow = await db.referral.findFirst({ where: { clientId: client.id } })

  const communications = await db.communication.findMany({
    where: { clientId: client.id },
    orderBy: { createdAt: 'desc' },
    take: 40,
    select: { channel: true, direction: true, subject: true, body: true, status: true, createdAt: true },
  })

  // Documents hub — the client's own uploads + files shared by the team.
  // REJECTED files are hidden from the client (removed after review).
  const documents = await db.fileRecord.findMany({
    where: { clientId: client.id, relatedType: { in: ['CLIENT_UPLOAD', 'ADMIN_SHARE'] }, scanStatus: { not: 'REJECTED' } },
    orderBy: { createdAt: 'desc' },
    take: 50,
    select: { id: true, originalName: true, mimeType: true, size: true, note: true, scanStatus: true, relatedType: true, classification: true, createdAt: true },
  })

  // Official generated documents — strictly filtered by canReadDocument for CLIENT role
  // so internal DRAFT or REJECTED documents or other tenants' records are never exposed.
  const allClientDocs = await listGeneratedDocuments({ clientPublicId: client.clientId })
  const officialDocuments = allClientDocs
    .filter((d) =>
      canReadDocument(
        { role: 'CLIENT' },
        { ...d, createdAt: new Date(d.createdAt), updatedAt: new Date(d.updatedAt) } as DocumentRecord,
        { clientPublicId: client.clientId },
      ),
    )
    .map((d) => ({
      documentId: d.documentId,
      documentType: d.documentType,
      version: d.version,
      title: d.title,
      approvalStatus: d.approvalStatus,
      finalizationStatus: d.finalizationStatus,
      sha256: d.sha256,
      createdAt: d.createdAt,
    }))

  const [sentDocumentArchives, emailDestinations] = await Promise.all([
    listSentEmailDocumentArchives({ clientPublicId: client.clientId }),
    listEmailDestinations({ clientPublicId: client.clientId, onlyActiveAuthorized: true }),
  ])

  const activityHistory = await db.auditLog.findMany({
    where: {
      clientId: { in: [client.id, client.clientId] },
      action: {
        in: [
          'PORTAL_LOGIN',
          'CLIENT_PROFILE_UPDATED',
          'CLIENT_PORTAL_MESSAGE',
          'CLIENT_SCOPE_FEEDBACK',
          'PAYMENT_PROOF_SUBMITTED',
          'FILE_UPLOADED',
          'PREVIEW_APPROVED',
          'PREVIEW_CHANGE_REQUESTED',
          'HANDOVER_DOWNLOADED',
          'DELIVERY_CONFIRMED',
          'REVIEW_SUBMITTED',
          'REFERRAL_SUBMITTED',
          'STAGE_CHANGED',
          'MEETING_INVITE_RESPONDED',
        ],
      },
    },
    orderBy: { createdAt: 'desc' },
    take: 25,
    select: { id: true, action: true, entityType: true, createdAt: true },
  })

  return Response.json({
    client: {
      clientId: client.clientId,
      name: client.name,
      businessName: client.businessName,
      businessType: client.businessType,
      email: client.email,
      phone: client.phone,
      whatsapp: client.whatsapp,
      preferredContact: client.preferredContact,
      country: client.country,
      stage: client.pipelineStage,
      stageLabel: client.pipelineStage.replace(/_/g, ' ').toLowerCase(),
      progressPct,
    },
    project: project
      ? {
          code: project.code, name: project.name, status: project.status,
          totalAmount: project.totalAmount, paidAmount: project.paidAmount, currency: project.currency,
          paymentStatus: project.paymentStatus,
          startedAt: project.startedAt, timelineWeeks: project.timelineWeeks,
          tasks: project.tasks.map((t) => ({ title: t.title, status: t.status })),
          taskProgress: project.tasks.length > 0 ? Math.round((project.tasks.filter((t) => t.status === 'DONE').length / project.tasks.length) * 100) : null,
        }
      : null,
    scope: finalScope
      ? { version: finalScope.version, approvedAt: finalScope.approvedAt, text: formatScopeForClient(JSON.parse(finalScope.content || '{}') as Record<string, unknown>, client.clientId) }
      : null,
    preview: activePreview
      ? { link: `/api/preview/${activePreview.token}`, status: activePreview.status, version: activePreview.version }
      : null,
    previewExpired: latestPreview ? latestPreview.status === 'EXPIRED' : false,
    review: reviewRow
      ? { status: reviewRow.status, rating: reviewRow.rating, content: reviewRow.content, consent: reviewRow.consent, createdAt: reviewRow.createdAt }
      : null,
    referral: referralRow
      ? { status: referralRow.status, name: referralRow.name, contact: referralRow.contact, createdAt: referralRow.createdAt }
      : null,
    handover: handover
      ? {
          status: handover.status,
          downloadLink: handover.status === 'RELEASED' || handover.status === 'DOWNLOADED' || handover.status === 'CONFIRMED' ? `/api/handover/${handover.packageToken}/download` : null,
          confirmLink: handover.status === 'DOWNLOADED' ? `/api/handover/${handover.packageToken}/confirm` : null,
          passwordChangeRequested: Boolean(handover.passwordChangeRequestedAt),
          passwordChangeConfirmed: handover.status === 'CONFIRMED' && Boolean(handover.passwordChangeConfirmedAt),
        }
      : null,
    delivery: delivery ? { status: delivery.status, confirmedAt: delivery.clientConfirmedAt } : null,
    paymentReadiness: await getCustomerPaymentReadiness(),
    payments: client.payments.map((p) => ({
      id: p.id,
      milestone: p.milestone,
      amount: p.amount,
      currency: p.currency,
      status: p.status,
      statusLabel: paymentStatusLabel(p.status),
      proofSubmitted: Boolean(p.proofFileId || p.transactionId),
      verifiedAt: p.verifiedAt,
      receiptAvailable: Boolean(p.status === 'PAID' && p.verifiedAt && p.verifiedBy),
      receiptNumber: p.receipt?.receiptNumber ?? null,
    })),
    invoices: client.invoices
      .filter((i) => isCustomerVisibleInvoiceStatus(i.status))
      .map((i) => {
        const totalMinor = resolveInvoiceTotalMinor({ totalMinor: i.totalMinor, amount: i.amount })
        const settlement = computeInvoiceSettlement({
          invoiceAmount: i.amount,
          invoiceTotalMinor: totalMinor,
          currentStatus: i.status,
          dueAt: i.dueAt,
          payments: i.payments,
        })
        return {
          number: i.number,
          amount: i.amount,
          remainingAmount: settlement.remainingAmount,
          currency: i.currency,
          status: i.status,
          payable: isPayableInvoiceStatus(i.status) && settlement.remainingMinor > 0,
          dueAt: i.dueAt,
          // Strictly expose customer-facing notes only — never internalNotes!
          notes: i.customerNotes ?? (i.internalNotes ? null : i.notes),
        }
      }),
    communications: communications.map((c) => ({
      channel: c.channel, direction: c.direction, subject: c.subject,
      preview: (c.body ?? '').slice(0, 160), status: c.status, at: c.createdAt,
    })),
    meetings: client.meetings.map((m) => ({
      id: m.id,
      status: m.status,
      scheduledAt: m.scheduledAt,
      reason: m.reason,
      channel: m.channel,
      bookingLink: m.bookingLink,
      notes: m.status === 'COMPLETED' ? m.notes : null,
      clientResponse: m.clientResponse,
      clientRespondedAt: m.clientRespondedAt,
    })),
    documents: documents.map((d) => ({
      id: d.id,
      name: d.originalName,
      mimeType: d.mimeType,
      size: d.size,
      note: d.note,
      scanStatus: d.scanStatus,
      direction: d.relatedType === 'ADMIN_SHARE' ? 'SHARED' : 'UPLOADED',
      classification: d.classification,
      at: d.createdAt,
    })),
    activityHistory: activityHistory.map((a) => ({
      id: a.id,
      action: a.action,
      entityType: a.entityType,
      at: a.createdAt,
    })),
    officialDocuments,
    sentDocumentArchives: sentDocumentArchives.map((a) => ({
      id: a.id,
      subject: a.subject,
      documentId: a.documentId,
      documentVersion: a.documentVersion,
      documentSha256: a.documentSha256,
      portalFileRecordId: a.portalFileRecordId,
      recipientEmail: a.recipientEmail,
      sentAt: a.sentAt,
      deliveryStatus: a.deliveryStatus,
    })),
    emailDestinations: emailDestinations.map((d) => ({
      id: d.id,
      recipientName: d.recipientName,
      email: d.email,
      purpose: d.purpose,
      verified: d.verified,
    })),
    policy: {
      previewBeforePayment: true,
      sourceAfterFullPayment: true,
      supportContact: 'info@bdtech360.com',
    },
  })
}

export async function PATCH(req: NextRequest) {
  const portalDisabled = await portalGate()
  if (portalDisabled) return portalDisabled
  const ip = clientIp(req)
  const rl = rateLimit(`portal-profile:${ip}`, 15, 60_000)
  if (!rl.ok) return Response.json({ error: 'Too many requests. Please wait a moment.' }, { status: 429 })

  const store = await cookies()
  const clientId = verifyPortalToken(store.get(PORTAL_COOKIE)?.value)
  if (!clientId) return Response.json({ error: 'Session expired. Please sign in again.' }, { status: 401 })

  const client = await db.client.findFirst({ where: { clientId, deletedAt: null } })
  if (!client) return Response.json({ error: 'Client not found' }, { status: 404 })

  const body = await readJson(req)
  const data: Record<string, string | null> = {}

  if (typeof body.name === 'string') {
    const cleanName = sanitizeText(body.name, 120)
    if (cleanName.length < 2) return Response.json({ error: 'Name must be at least 2 characters.' }, { status: 400 })
    data.name = cleanName
  }
  if (typeof body.businessName === 'string') {
    data.businessName = sanitizeText(body.businessName, 160) || null
  }
  if (typeof body.businessType === 'string') {
    data.businessType = sanitizeText(body.businessType, 100) || null
  }
  if (typeof body.preferredContact === 'string') {
    const pref = sanitizeText(body.preferredContact, 20).toUpperCase()
    if (['EMAIL', 'WHATSAPP', 'SMS', 'CHAT'].includes(pref)) {
      data.preferredContact = pref
    }
  }
  if (typeof body.country === 'string') {
    data.country = sanitizeText(body.country, 80) || null
  }

  if (Object.keys(data).length === 0) {
    return Response.json({ error: 'No profile fields provided.' }, { status: 400 })
  }

  const updated = await db.client.update({
    where: { id: client.id },
    data,
    select: {
      clientId: true,
      name: true,
      businessName: true,
      businessType: true,
      preferredContact: true,
      country: true,
    },
  })

  await audit({
    actor: `client:${client.clientId}`,
    action: 'CLIENT_PROFILE_UPDATED',
    entityType: 'Client',
    entityId: client.id,
    clientId: client.clientId,
    ip,
    details: { fields: Object.keys(data) },
  })

  return Response.json({ ok: true, client: updated, message: 'Profile and preferences saved.' })
}

export async function POST(req: NextRequest) {
  const portalDisabled = await portalGate()
  if (portalDisabled) return portalDisabled
  const ip = clientIp(req)
  const rl = rateLimit(`portal-action:${ip}`, 10, 60_000)
  if (!rl.ok) return Response.json({ error: 'Too many requests. Please wait a moment.' }, { status: 429 })

  const store = await cookies()
  const clientId = verifyPortalToken(store.get(PORTAL_COOKIE)?.value)
  if (!clientId) return Response.json({ error: 'Session expired. Please sign in again.' }, { status: 401 })

  const client = await db.client.findFirst({
    where: { clientId, deletedAt: null },
    include: { scopes: { orderBy: { version: 'desc' } } },
  })
  if (!client) return Response.json({ error: 'Client not found' }, { status: 404 })

  const body = await readJson(req)
  const action = sanitizeText(body.action, 40) || 'support_ticket'

  if (action === 'scope_feedback') {
    const decision = sanitizeText(body.decision, 30).toUpperCase()
    const notes = sanitizeText(body.notes, 2000)
    if (!['APPROVE', 'REQUEST_CHANGES'].includes(decision)) {
      return Response.json({ error: 'Decision must be APPROVE or REQUEST_CHANGES.' }, { status: 400 })
    }
    if (decision === 'REQUEST_CHANGES' && notes.length < 5) {
      return Response.json({ error: 'Please describe the requested scope changes.' }, { status: 400 })
    }
    const latestScope = client.scopes[0]
    if (!latestScope) {
      return Response.json({ error: 'No scope document found on your record.' }, { status: 404 })
    }

    if (decision === 'APPROVE' && !latestScope.approvedAt) {
      await db.scopeOfWork.update({
        where: { id: latestScope.id },
        data: { approvedAt: new Date() },
      })
      const { emitProposalApproved } = await import('@/lib/automation/domain-events')
      await emitProposalApproved({ scopeId: latestScope.id, version: latestScope.version, clientRowId: client.id, clientId: client.clientId })
    }

    await db.communication.create({
      data: {
        clientId: client.id,
        channel: 'CHAT',
        direction: 'IN',
        subject:
          decision === 'APPROVE'
            ? `Scope v${latestScope.version} approved by client`
            : `Scope v${latestScope.version} revision requested`,
        body: notes || (decision === 'APPROVE' ? 'Approved in Client Portal.' : 'Revision requested in Client Portal.'),
        status: 'RECEIVED',
        messageType: 'SCOPE_FEEDBACK',
      },
    })

    await db.notification.create({
      data: {
        type: 'APPROVAL',
        title:
          decision === 'APPROVE'
            ? `Scope v${latestScope.version} approved by ${client.clientId}`
            : `Scope v${latestScope.version} revision requested by ${client.clientId}`,
        body: (notes || 'Submitted via Client Portal.').slice(0, 280),
        severity: decision === 'APPROVE' ? 'INFO' : 'WARNING',
        link: `/admin?client=${client.id}`,
      },
    }).catch(() => null)

    await audit({
      actor: `client:${client.clientId}`,
      action: 'CLIENT_SCOPE_FEEDBACK',
      entityType: 'Scope',
      entityId: latestScope.id,
      clientId: client.clientId,
      ip,
      details: { version: latestScope.version, decision },
    })

    return Response.json({
      ok: true,
      message:
        decision === 'APPROVE'
          ? `Scope v${latestScope.version} approval recorded.`
          : `Scope v${latestScope.version} revision request sent to your project team.`,
    })
  }

  // Default: support_ticket / direct portal message
  const category = sanitizeText(body.category, 30).toUpperCase() || 'GENERAL'
  const subject = sanitizeText(body.subject, 160) || 'Portal support message'
  const message = sanitizeText(body.message, 4000)
  if (message.length < 5) {
    return Response.json({ error: 'Please enter a message of at least 5 characters.' }, { status: 400 })
  }

  const comm = await db.communication.create({
    data: {
      clientId: client.id,
      channel: 'CHAT',
      direction: 'IN',
      subject: `[${category}] ${subject}`,
      body: message,
      status: 'RECEIVED',
      messageType: 'PORTAL_TICKET',
    },
  })

  await db.notification.create({
    data: {
      type: 'PORTAL_SUPPORT',
      title: `Support ticket from ${client.clientId}: ${subject}`,
      body: message.slice(0, 280),
      severity: category === 'BILLING' || category === 'TECHNICAL' ? 'WARNING' : 'INFO',
      link: `/admin?client=${client.id}`,
    },
  }).catch(() => null)

  await audit({
    actor: `client:${client.clientId}`,
    action: 'CLIENT_PORTAL_MESSAGE',
    entityType: 'Communication',
    entityId: comm.id,
    clientId: client.clientId,
    ip,
    details: { category, subject },
  })

  return Response.json({
    ok: true,
    ticketId: comm.id,
    message: 'Your support ticket / message has been recorded and routed to the project team.',
  })
}

