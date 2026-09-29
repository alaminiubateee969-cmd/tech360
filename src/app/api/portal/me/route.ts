import { NextRequest } from 'next/server'
import { cookies } from 'next/headers'
import { db } from '@/lib/db'
import { verifyPortalToken, PORTAL_COOKIE, portalGate } from "@/lib/portal"
import { PIPELINE_STAGES } from '@/lib/constants'
import { formatScopeForClient } from '@/lib/journey'

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
      payments: { orderBy: { createdAt: 'desc' } },
      invoices: { orderBy: { issuedAt: 'desc' } },
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
  const handover = project ? await db.handoverRecord.findFirst({ where: { projectId: project.id, type: 'SOURCE_CODE' } }) : null
  const delivery = project ? await db.delivery.findFirst({ where: { projectId: project.id } }) : null
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

  return Response.json({
    client: {
      clientId: client.clientId,
      name: client.name,
      businessName: client.businessName,
      businessType: client.businessType,
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
          confirmLink: handover.status === 'RELEASED' || handover.status === 'DOWNLOADED' ? `/api/handover/${handover.packageToken}/confirm` : null,
          passwordChangeRequested: Boolean(handover.passwordChangeRequestedAt),
          passwordChangeConfirmed: Boolean(handover.passwordChangeConfirmedAt),
        }
      : null,
    delivery: delivery ? { status: delivery.status, confirmedAt: delivery.clientConfirmedAt } : null,
    payments: client.payments.map((p) => ({ milestone: p.milestone, amount: p.amount, currency: p.currency, status: p.status, verifiedAt: p.verifiedAt })),
    invoices: client.invoices.map((i) => ({ number: i.number, amount: i.amount, currency: i.currency, status: i.status, notes: i.notes })),
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
    policy: {
      previewBeforePayment: true,
      sourceAfterFullPayment: true,
      supportContact: 'info@bdtech360.com',
    },
  })
}
