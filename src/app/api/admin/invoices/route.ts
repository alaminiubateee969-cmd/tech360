import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { guard, isResponse } from '@/lib/api-guard'
import { acceptedMethodsPhrase } from '@/lib/features'
import { nextInvoiceNumber } from '@/lib/ids'
import {
  computeInvoiceSettlement,
  computeInvoiceTotals,
  fromMinorUnits,
  parseStoredLineItems,
  resolveInvoiceTotalMinor,
  toMinorUnits,
  type InvoiceLineItemInput,
} from '@/lib/invoice-policy'
import { audit, readJson, sanitizeEmail, sanitizeText } from '@/lib/security'

export const dynamic = 'force-dynamic'

// ============================================================
// ADMIN INVOICES API
//   GET  /api/admin/invoices → list invoices + settlement summary
//   POST /api/admin/invoices → create itemized invoice (DRAFT or AWAITING_APPROVAL)
// ============================================================

export async function GET(req: NextRequest) {
  const g = await guard(req, { capability: 'finance.read', capabilityOnly: true })
  if (isResponse(g)) return g

  const sp = req.nextUrl.searchParams
  const status = sanitizeText(sp.get('status') ?? '', 40).toUpperCase()
  const clientRef = sanitizeText(sp.get('clientId') ?? '', 40)
  const projectId = sanitizeText(sp.get('projectId') ?? '', 40)
  const q = sanitizeText(sp.get('q') ?? '', 120)

  const where: Record<string, unknown> = {}
  if (status && status !== 'ALL') where.status = status
  if (projectId) where.projectId = projectId
  if (clientRef) {
    where.OR = [
      { clientId: clientRef },
      { client: { clientId: clientRef } },
    ]
  }
  if (q) {
    where.AND = [
      {
        OR: [
          { number: { contains: q } },
          { billingEmail: { contains: q } },
          { client: { name: { contains: q } } },
          { client: { clientId: { contains: q } } },
          { client: { businessName: { contains: q } } },
        ],
      },
    ]
  }

  const rows = await db.invoice.findMany({
    where,
    orderBy: { issuedAt: 'desc' },
    take: 200,
    include: {
      client: { select: { id: true, clientId: true, name: true, businessName: true, email: true, country: true } },
      project: { select: { id: true, code: true, name: true, status: true } },
      payments: { select: { id: true, amount: true, status: true, verifiedAt: true } },
    },
  })

  const now = new Date()
  let totalInvoicedMinor = 0
  let totalCollectedMinor = 0
  let totalOutstandingMinor = 0

  const invoices = rows.map((inv) => {
    const totalMinor = resolveInvoiceTotalMinor({ totalMinor: inv.totalMinor, amount: inv.amount })
    const settlement = computeInvoiceSettlement({
      invoiceAmount: inv.amount,
      invoiceTotalMinor: totalMinor,
      currentStatus: inv.status,
      dueAt: inv.dueAt,
      now,
      payments: inv.payments,
    })

    if (inv.status !== 'VOID' && inv.status !== 'CANCELLED' && inv.status !== 'DRAFT') {
      totalInvoicedMinor += totalMinor
      totalCollectedMinor += settlement.paidMinor
      totalOutstandingMinor += settlement.remainingMinor
    }

    return {
      ...inv,
      totalMinor,
      paidMinor: settlement.paidMinor,
      remainingMinor: settlement.remainingMinor,
      paidAmount: settlement.paidAmount,
      remainingAmount: settlement.remainingAmount,
      effectiveStatus: settlement.nextStatus,
      parsedLineItems: parseStoredLineItems(
        inv.lineItems,
        inv.description || inv.customerNotes || inv.notes || 'Software engineering & delivery services',
        totalMinor,
      ),
    }
  })

  return Response.json({
    invoices,
    summary: {
      count: invoices.length,
      totalInvoiced: fromMinorUnits(totalInvoicedMinor),
      totalCollected: fromMinorUnits(totalCollectedMinor),
      totalOutstanding: fromMinorUnits(totalOutstandingMinor),
    },
  })
}

export async function POST(req: NextRequest) {
  const g = await guard(req, { capability: 'finance.invoice.write', capabilityOnly: true })
  if (isResponse(g)) return g

  const raw = await readJson(req)
  const clientRef = sanitizeText(raw.clientId, 40)
  const projectRef = sanitizeText(raw.projectId, 40) || null
  const currency = (sanitizeText(raw.currency, 8) || 'USD').toUpperCase()
  const description = sanitizeText(raw.description, 4000) || null
  const customerNotes = sanitizeText(raw.customerNotes ?? raw.notes, 2000) || null
  const internalNotes = sanitizeText(raw.internalNotes, 2000) || null
  const discountReason = sanitizeText(raw.discountReason, 500) || null
  const taxLabel = sanitizeText(raw.taxLabel, 80) || null
  const paymentTerms =
    sanitizeText(raw.paymentTerms, 1000) ||
    'HTML Preview Before Payment. Source Code Handover After Full Verified Payment.'
  const termsVersion = sanitizeText(raw.termsVersion, 60) || 'TECH360-MSA-2026.1'
  const dueRaw = sanitizeText(raw.dueAt, 40)
  const initialStatus =
    sanitizeText(raw.initialStatus, 30).toUpperCase() === 'AWAITING_APPROVAL'
      ? 'AWAITING_APPROVAL'
      : 'DRAFT'

  if (!clientRef) {
    return Response.json({ error: 'Select a client.', code: 'CLIENT_REQUIRED' }, { status: 400 })
  }

  let dueAt: Date | null = null
  if (dueRaw) {
    const d = new Date(dueRaw)
    if (Number.isNaN(d.getTime())) {
      return Response.json({ error: 'Invalid due date.', code: 'INVALID_DUE_DATE' }, { status: 400 })
    }
    dueAt = d
  }

  // Normalize line items (or synthesize one item from legacy `amount` payload).
  let lineItemsInput: InvoiceLineItemInput[] = []
  if (Array.isArray(raw.lineItems) && raw.lineItems.length > 0) {
    lineItemsInput = raw.lineItems.map((item: unknown) => {
      const rec = (item && typeof item === 'object' ? item : {}) as Record<string, unknown>
      return {
        description: sanitizeText(rec.description, 500),
        quantity: Number(rec.quantity ?? 1),
        ...(rec.unitMinor !== undefined ? { unitMinor: Number(rec.unitMinor) } : {}),
        ...(rec.unitPrice !== undefined ? { unitPrice: Number(rec.unitPrice) } : {}),
        ...(typeof rec.currency === 'string' ? { currency: rec.currency } : {}),
      }
    })
  } else if (raw.amount !== undefined) {
    const legacyAmount = Number(raw.amount)
    if (!Number.isFinite(legacyAmount) || legacyAmount <= 0 || legacyAmount > 10_000_000) {
      return Response.json(
        { error: 'Enter a positive invoice amount (up to 10,000,000).', code: 'INVALID_AMOUNT' },
        { status: 400 },
      )
    }
    lineItemsInput = [
      {
        description: description || customerNotes || 'Software engineering & delivery services',
        quantity: 1,
        unitPrice: legacyAmount,
      },
    ]
  }

  const expectedTotalMinor =
    raw.expectedTotalMinor !== undefined
      ? Number(raw.expectedTotalMinor)
      : raw.expectedTotal !== undefined
        ? toMinorUnits(Number(raw.expectedTotal))
        : undefined

  const calc = computeInvoiceTotals({
    currency,
    lineItems: lineItemsInput,
    ...(raw.discountMinor !== undefined ? { discountMinor: Number(raw.discountMinor) } : {}),
    ...(raw.discountAmount !== undefined ? { discountAmount: Number(raw.discountAmount) } : {}),
    discountReason,
    ...(raw.taxRateBps !== undefined ? { taxRateBps: Number(raw.taxRateBps) } : {}),
    ...(raw.taxRatePercent !== undefined ? { taxRatePercent: Number(raw.taxRatePercent) } : {}),
    taxLabel,
    ...(expectedTotalMinor !== undefined ? { expectedTotalMinor } : {}),
  })

  if (!calc.ok) {
    return Response.json({ error: calc.error, code: calc.code }, { status: 400 })
  }

  const client = await db.client.findFirst({
    where: { OR: [{ id: clientRef }, { clientId: clientRef }], deletedAt: null },
    select: {
      id: true,
      clientId: true,
      name: true,
      businessName: true,
      email: true,
      country: true,
    },
  })
  if (!client) return Response.json({ error: 'Client not found.', code: 'CLIENT_NOT_FOUND' }, { status: 404 })

  let projectId: string | null = null
  if (projectRef) {
    const project = await db.project.findFirst({
      where: {
        OR: [{ id: projectRef }, { code: projectRef }],
        clientId: client.id,
        deletedAt: null,
      },
      select: { id: true },
    })
    if (!project) {
      return Response.json(
        { error: 'Selected project does not belong to that client.', code: 'PROJECT_MISMATCH' },
        { status: 400 },
      )
    }
    projectId = project.id
  }

  let scopeVersion: number | null = null
  if (raw.scopeVersion !== undefined && raw.scopeVersion !== null && raw.scopeVersion !== '') {
    const requestedVersion = Number(raw.scopeVersion)
    if (!Number.isInteger(requestedVersion) || requestedVersion < 1) {
      return Response.json({ error: 'Invalid scope version.', code: 'INVALID_SCOPE_VERSION' }, { status: 400 })
    }
    const scope = await db.scopeOfWork.findUnique({
      where: { clientId_version: { clientId: client.id, version: requestedVersion } },
      select: { version: true },
    })
    if (!scope) {
      return Response.json(
        { error: `Scope version v${requestedVersion} was not found for ${client.clientId}.`, code: 'SCOPE_NOT_FOUND' },
        { status: 400 },
      )
    }
    scopeVersion = scope.version
  } else {
    const latestApprovedScope = await db.scopeOfWork.findFirst({
      where: { clientId: client.id, status: { in: ['APPROVED', 'FINAL'] } },
      orderBy: { version: 'desc' },
      select: { version: true },
    })
    scopeVersion = latestApprovedScope?.version ?? null
  }

  const billingName = sanitizeText(raw.billingName, 120) || client.name
  const billingBusiness = sanitizeText(raw.billingBusiness, 160) || client.businessName || null
  const billingEmail = sanitizeEmail(raw.billingEmail) || client.email || null
  const billingAddress = sanitizeText(raw.billingAddress, 500) || null
  const billingCountry = sanitizeText(raw.billingCountry, 80) || client.country || null
  const methodsSnapshot = (await acceptedMethodsPhrase()) || 'Not Configured — Payment setup required'

  const number = await nextInvoiceNumber()
  const invoice = await db.invoice.create({
    data: {
      number,
      clientId: client.id,
      projectId,
      scopeVersion,
      currency: calc.currency,
      amount: calc.totalMajor,
      subtotalMinor: calc.subtotalMinor,
      discountMinor: calc.discountMinor,
      discountReason,
      taxRateBps: calc.taxRateBps,
      taxLabel: calc.taxLabel,
      taxMinor: calc.taxMinor,
      totalMinor: calc.totalMinor,
      description,
      lineItems: JSON.stringify(calc.lineItems),
      billingName,
      billingBusiness,
      billingEmail,
      billingAddress,
      billingCountry,
      paymentTerms,
      paymentMethodsSnapshot: methodsSnapshot,
      internalNotes,
      customerNotes,
      notes: customerNotes,
      termsVersion,
      status: initialStatus,
      dueAt,
    },
    include: {
      client: { select: { id: true, clientId: true, name: true, businessName: true, email: true, country: true } },
      project: { select: { id: true, code: true, name: true } },
    },
  })

  await audit({
    userId: g.user.id,
    actor: g.user.email,
    action: 'INVOICE_CREATED',
    entityType: 'Invoice',
    entityId: invoice.id,
    clientId: client.clientId,
    projectId: projectId ?? undefined,
    details: {
      number: invoice.number,
      status: invoice.status,
      currency: calc.currency,
      subtotalMinor: calc.subtotalMinor,
      discountMinor: calc.discountMinor,
      taxMinor: calc.taxMinor,
      totalMinor: calc.totalMinor,
      lineItemCount: calc.lineItems.length,
      scopeVersion,
    },
    ip: g.ip,
  })

  return Response.json({ ok: true, invoice }, { status: 201 })
}
