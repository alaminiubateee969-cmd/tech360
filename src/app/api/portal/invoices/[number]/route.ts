import { NextRequest } from 'next/server'
import { cookies } from 'next/headers'
import { db } from '@/lib/db'
import { acceptedMethodsPhrase } from '@/lib/features'
import { DOCUMENT_HTML_HEADERS, renderInvoiceDocumentHtml } from '@/lib/invoice-document'
import {
  computeInvoiceSettlement,
  isCustomerVisibleInvoiceStatus,
  parseStoredLineItems,
  resolveInvoiceTotalMinor,
} from '@/lib/invoice-policy'
import { PORTAL_COOKIE, portalGate, verifyPortalToken } from '@/lib/portal'
import { audit, clientIp, rateLimit, sanitizeText } from '@/lib/security'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest, { params }: { params: Promise<{ number: string }> }) {
  const portalDisabled = await portalGate()
  if (portalDisabled) return portalDisabled

  const ip = clientIp(req)
  const rl = rateLimit(`portal-invoice:${ip}`, 30, 60_000)
  if (!rl.ok) return Response.json({ error: 'Too many requests.' }, { status: 429 })

  const store = await cookies()
  const clientCode = verifyPortalToken(store.get(PORTAL_COOKIE)?.value)
  if (!clientCode) return Response.json({ error: 'Not signed in.' }, { status: 401 })

  const client = await db.client.findFirst({
    where: { clientId: clientCode, deletedAt: null },
    select: { id: true, clientId: true, name: true, businessName: true, email: true, country: true },
  })
  if (!client) return Response.json({ error: 'Client not found.' }, { status: 404 })

  const { number } = await params
  const cleanNumber = sanitizeText(number, 40)

  const invoice = await db.invoice.findFirst({
    where: { number: cleanNumber, clientId: client.id },
    include: {
      project: { select: { code: true, name: true } },
      payments: { select: { id: true, amount: true, status: true, verifiedAt: true } },
    },
  })

  // Return 404 for both non-existent, cross-tenant, and pre-issuance DRAFT invoices.
  if (!invoice || !isCustomerVisibleInvoiceStatus(invoice.status)) {
    return Response.json({ error: 'Invoice not found.' }, { status: 404 })
  }

  let currentStatus = invoice.status
  let viewedAt = invoice.viewedAt
  if (invoice.status === 'ISSUED' || invoice.status === 'SENT') {
    viewedAt = viewedAt ?? new Date()
    currentStatus = 'VIEWED'
    await db.invoice.update({
      where: { id: invoice.id },
      data: { status: 'VIEWED', viewedAt, updatedAt: new Date() },
    })
    await audit({
      actor: `client:${client.clientId}`,
      action: 'INVOICE_VIEWED_BY_CLIENT',
      entityType: 'Invoice',
      entityId: invoice.id,
      clientId: client.clientId,
      details: { number: invoice.number },
      ip,
    })
  }

  const totalMinor = resolveInvoiceTotalMinor({ totalMinor: invoice.totalMinor, amount: invoice.amount })
  const settlement = computeInvoiceSettlement({
    invoiceAmount: invoice.amount,
    invoiceTotalMinor: totalMinor,
    currentStatus,
    dueAt: invoice.dueAt,
    payments: invoice.payments,
  })

  if (req.nextUrl.searchParams.get('format') !== 'json') {
    const phrase = await acceptedMethodsPhrase()
    const html = renderInvoiceDocumentHtml(
      {
        ...invoice,
        status: currentStatus,
        viewedAt,
        // Strictly omit internalNotes from customer-rendered output!
        customerNotes: invoice.customerNotes ?? (invoice.internalNotes ? null : invoice.notes),
        notes: null,
        client,
        totalMinor,
        paidMinor: settlement.paidMinor,
        remainingMinor: settlement.remainingMinor,
      },
      phrase,
    )
    return new Response(html, { status: 200, headers: DOCUMENT_HTML_HEADERS })
  }

  return Response.json({
    ok: true,
    invoice: {
      number: invoice.number,
      status: currentStatus,
      currency: invoice.currency,
      amount: invoice.amount,
      subtotalMinor: invoice.subtotalMinor,
      discountMinor: invoice.discountMinor,
      discountReason: invoice.discountReason,
      taxRateBps: invoice.taxRateBps,
      taxLabel: invoice.taxLabel,
      taxMinor: invoice.taxMinor,
      totalMinor,
      paidMinor: settlement.paidMinor,
      remainingMinor: settlement.remainingMinor,
      paidAmount: settlement.paidAmount,
      remainingAmount: settlement.remainingAmount,
      description: invoice.description,
      lineItems: parseStoredLineItems(
        invoice.lineItems,
        invoice.description || invoice.customerNotes || 'Software engineering & delivery services',
        totalMinor,
      ),
      billingName: invoice.billingName || client.name,
      billingBusiness: invoice.billingBusiness ?? client.businessName,
      billingEmail: invoice.billingEmail ?? client.email,
      billingAddress: invoice.billingAddress,
      billingCountry: invoice.billingCountry ?? client.country,
      paymentTerms: invoice.paymentTerms,
      paymentMethodsSnapshot: invoice.paymentMethodsSnapshot,
      customerNotes: invoice.customerNotes ?? (invoice.internalNotes ? null : invoice.notes),
      termsVersion: invoice.termsVersion,
      scopeVersion: invoice.scopeVersion,
      revision: invoice.revision,
      supersedesInvoiceNumber: invoice.supersedesInvoiceNumber,
      issuedAt: invoice.issuedAt,
      dueAt: invoice.dueAt,
      viewedAt,
      paidAt: invoice.paidAt,
    },
  })
}
