import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { guard, isResponse } from '@/lib/api-guard'
import {
  computeNetProjectPaidMinor,
  evaluateRefundSettlement,
  resolveInvoiceTotalMinor,
  toMinorUnits,
} from '@/lib/invoice-policy'
import { audit, readJson, sanitizeText } from '@/lib/security'

export const dynamic = 'force-dynamic'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const g = await guard(req, { capability: 'finance.refund.decide', capabilityOnly: true })
  if (isResponse(g)) return g

  const { id } = await params
  const cleanId = sanitizeText(id, 40)
  const raw = await readJson(req)
  const action = sanitizeText(raw.action, 40).toLowerCase()
  const resolutionNotes = sanitizeText(raw.resolutionNotes ?? raw.notes, 2000) || null
  const providerRefundRef = sanitizeText(raw.providerRefundRef, 120) || null

  const existing = await db.refundCase.findUnique({
    where: { id: cleanId },
    include: {
      client: { select: { id: true, clientId: true, name: true } },
      project: true,
      invoice: true,
      payment: true,
    },
  })
  if (!existing) return Response.json({ error: 'Refund / dispute case not found.' }, { status: 404 })

  if (existing.status === 'REFUNDED' || existing.status === 'PARTIALLY_REFUNDED' || existing.status === 'CLOSED') {
    return Response.json(
      { error: `Case ${existing.caseNumber} is already finalized (${existing.status}).` },
      { status: 409 },
    )
  }

  const now = new Date()

  // ---------------- UNDER REVIEW ----------------
  if (action === 'under_review') {
    const updated = await db.refundCase.update({
      where: { id: existing.id },
      data: { status: 'UNDER_REVIEW', reviewedBy: g.user.email, reviewedAt: now, resolutionNotes },
    })
    await audit({
      userId: g.user.id,
      actor: g.user.email,
      action: 'REFUND_CASE_REVIEWED',
      entityType: 'RefundCase',
      entityId: existing.id,
      clientId: existing.client.clientId,
      details: { caseNumber: existing.caseNumber },
      ip: g.ip,
    })
    return Response.json({ ok: true, refundCase: updated })
  }

  // ---------------- REJECT ----------------
  if (action === 'reject') {
    if (!resolutionNotes || resolutionNotes.length < 3) {
      return Response.json({ error: 'Provide resolution notes explaining why the request was rejected.' }, { status: 400 })
    }
    const updated = await db.refundCase.update({
      where: { id: existing.id },
      data: {
        status: 'REJECTED',
        reviewedBy: g.user.email,
        reviewedAt: now,
        resolutionNotes,
      },
    })
    await audit({
      userId: g.user.id,
      actor: g.user.email,
      action: 'REFUND_CASE_REJECTED',
      entityType: 'RefundCase',
      entityId: existing.id,
      clientId: existing.client.clientId,
      details: { caseNumber: existing.caseNumber, resolutionNotes },
      ip: g.ip,
    })
    return Response.json({ ok: true, refundCase: updated })
  }

  // ---------------- APPROVE (pending settlement) ----------------
  if (action === 'approve') {
    const approvedAmountMinor =
      raw.approvedAmountMinor !== undefined
        ? Number(raw.approvedAmountMinor)
        : raw.approvedAmount !== undefined
          ? toMinorUnits(Number(raw.approvedAmount))
          : existing.requestedAmountMinor

    if (!Number.isInteger(approvedAmountMinor) || approvedAmountMinor < 0) {
      return Response.json({ error: 'Invalid approved amount.' }, { status: 400 })
    }
    if (existing.payment && approvedAmountMinor > toMinorUnits(existing.payment.amount)) {
      return Response.json({ error: 'Approved refund cannot exceed the linked payment amount.' }, { status: 400 })
    }

    const updated = await db.refundCase.update({
      where: { id: existing.id },
      data: {
        status: approvedAmountMinor > 0 ? 'REFUND_PENDING' : 'APPROVED',
        approvedAmountMinor,
        reviewedBy: g.user.email,
        reviewedAt: now,
        resolutionNotes: resolutionNotes ?? existing.resolutionNotes,
      },
    })
    await audit({
      userId: g.user.id,
      actor: g.user.email,
      action: 'REFUND_CASE_APPROVED',
      entityType: 'RefundCase',
      entityId: existing.id,
      clientId: existing.client.clientId,
      details: { caseNumber: existing.caseNumber, approvedAmountMinor },
      ip: g.ip,
    })
    return Response.json({ ok: true, refundCase: updated })
  }

  // ---------------- RESOLVE DISPUTE WITHOUT REFUND ----------------
  if (action === 'resolve_dispute' || action === 'close') {
    if (!resolutionNotes || resolutionNotes.length < 3) {
      return Response.json({ error: 'Provide resolution notes before closing or resolving.' }, { status: 400 })
    }
    const nextStatus = existing.kind === 'DISPUTE' ? 'DISPUTE_RESOLVED' : 'CLOSED'
    const updated = await db.$transaction(async (tx) => {
      if (existing.kind === 'CANCELLATION' && existing.projectId) {
        await tx.project.update({ where: { id: existing.projectId }, data: { status: 'CANCELLED' } })
        await tx.handoverRecord.updateMany({
          where: { projectId: existing.projectId, status: { in: ['PENDING_APPROVAL', 'PREPARED', 'RELEASED'] } },
          data: { status: 'PREPARED', paymentVerifiedAt: null },
        })
      }
      return tx.refundCase.update({
        where: { id: existing.id },
        data: {
          status: nextStatus,
          reviewedBy: g.user.email,
          reviewedAt: existing.reviewedAt ?? now,
          settledAt: now,
          resolutionNotes,
        },
      })
    })
    await audit({
      userId: g.user.id,
      actor: g.user.email,
      action: 'REFUND_CASE_CLOSED',
      entityType: 'RefundCase',
      entityId: existing.id,
      clientId: existing.client.clientId,
      details: { caseNumber: existing.caseNumber, status: nextStatus, resolutionNotes },
      ip: g.ip,
    })
    return Response.json({ ok: true, refundCase: updated })
  }

  // ---------------- SETTLE REFUND (actual verified financial reversal) ----------------
  if (action === 'settle') {
    const approvedAmountMinor =
      raw.approvedAmountMinor !== undefined
        ? Number(raw.approvedAmountMinor)
        : raw.approvedAmount !== undefined
          ? toMinorUnits(Number(raw.approvedAmount))
          : existing.approvedAmountMinor > 0
            ? existing.approvedAmountMinor
            : existing.requestedAmountMinor

    if (!Number.isInteger(approvedAmountMinor) || approvedAmountMinor <= 0) {
      return Response.json({ error: 'Settling a refund requires a positive approved refund amount.' }, { status: 400 })
    }

    if (existing.payment) {
      const priorPaymentRefunds = await db.refundCase.findMany({
        where: {
          paymentId: existing.payment.id,
          id: { not: existing.id },
          status: { in: ['PARTIALLY_REFUNDED', 'REFUNDED'] },
        },
        select: { approvedAmountMinor: true },
      })
      const priorSum = priorPaymentRefunds.reduce((s, r) => s + r.approvedAmountMinor, 0)
      if (priorSum + approvedAmountMinor > toMinorUnits(existing.payment.amount)) {
        return Response.json(
          { error: 'Cumulative refunds would exceed the linked payment amount.' },
          { status: 409 },
        )
      }
    }

    const settledResult = await db.$transaction(async (tx) => {
      let caseFinalStatus: 'PARTIALLY_REFUNDED' | 'REFUNDED' = 'REFUNDED'
      if (existing.payment && approvedAmountMinor < toMinorUnits(existing.payment.amount)) {
        caseFinalStatus = 'PARTIALLY_REFUNDED'
      } else if (existing.invoice) {
        const invTotal = resolveInvoiceTotalMinor({
          totalMinor: existing.invoice.totalMinor,
          amount: existing.invoice.amount,
        })
        if (approvedAmountMinor < invTotal) caseFinalStatus = 'PARTIALLY_REFUNDED'
      }

      const updatedCase = await tx.refundCase.update({
        where: { id: existing.id },
        data: {
          status: caseFinalStatus,
          approvedAmountMinor,
          providerRefundRef: providerRefundRef ?? existing.providerRefundRef,
          resolutionNotes: resolutionNotes ?? existing.resolutionNotes,
          reviewedBy: g.user.email,
          reviewedAt: existing.reviewedAt ?? now,
          settledAt: now,
        },
      })

      if (existing.payment) {
        const allPaymentRefunds = await tx.refundCase.findMany({
          where: { paymentId: existing.payment.id, status: { in: ['PARTIALLY_REFUNDED', 'REFUNDED'] } },
          select: { approvedAmountMinor: true },
        })
        const cumPaymentRefunded = allPaymentRefunds.reduce((s, r) => s + r.approvedAmountMinor, 0)
        if (cumPaymentRefunded >= toMinorUnits(existing.payment.amount)) {
          await tx.payment.update({
            where: { id: existing.payment.id },
            data: { status: 'REFUNDED' },
          })
        }
      }

      if (existing.invoice) {
        const invPayments = await tx.payment.findMany({
          where: { invoiceId: existing.invoice.id, verifiedAt: { not: null }, status: { in: ['PAID', 'REFUNDED'] } },
          select: { amount: true },
        })
        const invRefunds = await tx.refundCase.findMany({
          where: { invoiceId: existing.invoice.id, status: { in: ['PARTIALLY_REFUNDED', 'REFUNDED'] } },
          select: { approvedAmountMinor: true },
        })
        const invGrossMinor = invPayments.reduce((s, p) => s + toMinorUnits(p.amount), 0)
        const invRefundedMinor = invRefunds.reduce((s, r) => s + r.approvedAmountMinor, 0)
        const invTotalMinor = resolveInvoiceTotalMinor({
          totalMinor: existing.invoice.totalMinor,
          amount: existing.invoice.amount,
        })
        const nextInvStatus = invRefundedMinor >= Math.max(invGrossMinor, invTotalMinor) ? 'REFUNDED' : 'PARTIALLY_REFUNDED'
        await tx.invoice.update({
          where: { id: existing.invoice.id },
          data: { status: nextInvStatus, updatedAt: now },
        })
      }

      let handoverSuspended = false
      if (existing.projectId && existing.project) {
        const projPayments = await tx.payment.findMany({
          where: { projectId: existing.projectId },
          select: { amount: true, status: true, verifiedAt: true },
        })
        const projRefunds = await tx.refundCase.findMany({
          where: { projectId: existing.projectId, status: { in: ['PARTIALLY_REFUNDED', 'REFUNDED'] } },
          select: { approvedAmountMinor: true },
        })
        const netCalc = computeNetProjectPaidMinor({
          payments: projPayments,
          settledRefundsMinor: projRefunds.map((r) => r.approvedAmountMinor),
        })
        const evalRes = evaluateRefundSettlement({
          projectTotalAmount: existing.project.totalAmount,
          grossVerifiedMinor: netCalc.grossVerifiedMinor,
          totalSettledRefundsMinor: netCalc.refundedMinor,
        })

        await tx.project.update({
          where: { id: existing.projectId },
          data: {
            paidAmount: evalRes.netProjectPaidMajor,
            paymentStatus: evalRes.projectPaymentStatus,
            ...(existing.kind === 'CANCELLATION' ? { status: 'CANCELLED' } : {}),
          },
        })

        if (existing.revokeHandover && evalRes.shouldSuspendHandover) {
          const suspended = await tx.handoverRecord.updateMany({
            where: {
              projectId: existing.projectId,
              status: { in: ['RELEASED', 'DOWNLOADED'] },
            },
            data: { status: 'PREPARED', paymentVerifiedAt: null },
          })
          handoverSuspended = suspended.count > 0
        }
      }

      return { updatedCase, handoverSuspended }
    })

    await audit({
      userId: g.user.id,
      actor: g.user.email,
      action: 'REFUND_SETTLED',
      entityType: 'RefundCase',
      entityId: existing.id,
      clientId: existing.client.clientId,
      projectId: existing.projectId ?? undefined,
      details: {
        caseNumber: existing.caseNumber,
        approvedAmountMinor,
        providerRefundRef,
        handoverSuspended: settledResult.handoverSuspended,
      },
      ip: g.ip,
    })

    return Response.json({
      ok: true,
      refundCase: settledResult.updatedCase,
      handoverSuspended: settledResult.handoverSuspended,
    })
  }

  return Response.json({ error: `Unknown refund case action "${action}".` }, { status: 400 })
}
