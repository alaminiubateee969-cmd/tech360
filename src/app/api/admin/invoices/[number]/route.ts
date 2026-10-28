import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { hasCapability } from '@/lib/access-policy'
import { guard, isResponse } from '@/lib/api-guard'
import { channelConfigured, escapeHtml, sendCommunication } from '@/lib/comms'
import { acceptedMethodsPhrase, featureEnabled } from '@/lib/features'
import { nextInvoiceNumber } from '@/lib/ids'
import { DOCUMENT_HTML_HEADERS, renderInvoiceDocumentHtml } from '@/lib/invoice-document'
import {
  canEditInvoiceFields,
  canTransitionInvoiceStatus,
  computeInvoiceSettlement,
  computeInvoiceTotals,
  parseStoredLineItems,
  resolveInvoiceTotalMinor,
  type InvoiceLineItemInput,
} from '@/lib/invoice-policy'
import { PAD } from '@/lib/letterhead'
import { audit, readJson, sanitizeEmail, sanitizeText } from '@/lib/security'

export const dynamic = 'force-dynamic'

// ============================================================
// ADMIN SINGLE INVOICE LIFECYCLE
//   GET   /api/admin/invoices/[number]         → JSON or ?format=html printable invoice
//   PATCH /api/admin/invoices/[number]         → edit_draft | submit_for_approval |
//                                                approve | issue | send | mark_overdue |
//                                                void | cancel | reissue | mark_disputed
// ============================================================

export async function GET(req: NextRequest, { params }: { params: Promise<{ number: string }> }) {
  const g = await guard(req, { capability: 'finance.read', capabilityOnly: true })
  if (isResponse(g)) return g

  const { number } = await params
  const cleanNumber = sanitizeText(number, 40)
  const invoice = await db.invoice.findUnique({
    where: { number: cleanNumber },
    include: {
      client: { select: { id: true, clientId: true, name: true, businessName: true, email: true, country: true } },
      project: { select: { id: true, code: true, name: true } },
      payments: { orderBy: { createdAt: 'desc' }, include: { receipt: { select: { receiptNumber: true } } } },
      refundCases: { orderBy: { createdAt: 'desc' } },
    },
  })
  if (!invoice) return Response.json({ error: 'Invoice not found.' }, { status: 404 })

  const totalMinor = resolveInvoiceTotalMinor({ totalMinor: invoice.totalMinor, amount: invoice.amount })
  const settlement = computeInvoiceSettlement({
    invoiceAmount: invoice.amount,
    invoiceTotalMinor: totalMinor,
    currentStatus: invoice.status,
    dueAt: invoice.dueAt,
    payments: invoice.payments,
  })

  if (req.nextUrl.searchParams.get('format') === 'html') {
    const phrase = await acceptedMethodsPhrase()
    const html = renderInvoiceDocumentHtml(
      {
        ...invoice,
        totalMinor,
        paidMinor: settlement.paidMinor,
        remainingMinor: settlement.remainingMinor,
      },
      phrase,
    )
    return new Response(html, { status: 200, headers: DOCUMENT_HTML_HEADERS })
  }

  return Response.json({
    invoice: {
      ...invoice,
      totalMinor,
      paidMinor: settlement.paidMinor,
      remainingMinor: settlement.remainingMinor,
      paidAmount: settlement.paidAmount,
      remainingAmount: settlement.remainingAmount,
      parsedLineItems: parseStoredLineItems(
        invoice.lineItems,
        invoice.description || invoice.customerNotes || invoice.notes || 'Software engineering & delivery services',
        totalMinor,
      ),
    },
  })
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ number: string }> }) {
  const g = await guard(req, { capability: 'finance.invoice.write', capabilityOnly: true })
  if (isResponse(g)) return g

  const { number } = await params
  const cleanNumber = sanitizeText(number, 40)
  const raw = await readJson(req)
  const action = (sanitizeText(raw.action, 40) || 'send').toLowerCase()

  const invoice = await db.invoice.findUnique({
    where: { number: cleanNumber },
    include: {
      client: { select: { id: true, clientId: true, name: true, businessName: true, email: true, whatsapp: true, phone: true, country: true } },
      project: { select: { id: true, code: true, name: true } },
      payments: { select: { id: true, amount: true, status: true, verifiedAt: true } },
    },
  })
  if (!invoice) return Response.json({ error: 'Invoice not found.' }, { status: 404 })

  const totalMinor = resolveInvoiceTotalMinor({ totalMinor: invoice.totalMinor, amount: invoice.amount })
  const settlement = computeInvoiceSettlement({
    invoiceAmount: invoice.amount,
    invoiceTotalMinor: totalMinor,
    currentStatus: invoice.status,
    dueAt: invoice.dueAt,
    payments: invoice.payments,
  })

  // ---------------- 1. EDIT DRAFT (pre-approval only) ----------------
  if (action === 'edit_draft') {
    if (!canEditInvoiceFields(invoice.status)) {
      return Response.json(
        {
          error: `Invoice ${invoice.number} is ${invoice.status} and its financial terms are immutable. Use reissue to create a superseding revision.`,
          code: 'INVOICE_IMMUTABLE',
        },
        { status: 409 },
      )
    }

    const currency = (sanitizeText(raw.currency, 8) || invoice.currency).toUpperCase()
    const existingItems = parseStoredLineItems(
      invoice.lineItems,
      invoice.description || invoice.customerNotes || invoice.notes || 'Software engineering & delivery services',
      totalMinor,
    )
    const lineItemsInput: InvoiceLineItemInput[] =
      Array.isArray(raw.lineItems) && raw.lineItems.length > 0
        ? raw.lineItems.map((item: unknown) => {
            const rec = (item && typeof item === 'object' ? item : {}) as Record<string, unknown>
            return {
              description: sanitizeText(rec.description, 500),
              quantity: Number(rec.quantity ?? 1),
              ...(rec.unitMinor !== undefined ? { unitMinor: Number(rec.unitMinor) } : {}),
              ...(rec.unitPrice !== undefined ? { unitPrice: Number(rec.unitPrice) } : {}),
              ...(typeof rec.currency === 'string' ? { currency: rec.currency } : {}),
            }
          })
        : existingItems.map((it) => ({ description: it.description, quantity: it.quantity, unitMinor: it.unitMinor }))

    const discountReason =
      raw.discountReason !== undefined ? sanitizeText(raw.discountReason, 500) || null : invoice.discountReason
    const taxLabel = raw.taxLabel !== undefined ? sanitizeText(raw.taxLabel, 80) || null : invoice.taxLabel

    const calc = computeInvoiceTotals({
      currency,
      lineItems: lineItemsInput,
      discountMinor: raw.discountMinor !== undefined ? Number(raw.discountMinor) : (invoice.discountMinor ?? 0),
      ...(raw.discountAmount !== undefined ? { discountAmount: Number(raw.discountAmount) } : {}),
      discountReason,
      taxRateBps: raw.taxRateBps !== undefined ? Number(raw.taxRateBps) : (invoice.taxRateBps ?? 0),
      ...(raw.taxRatePercent !== undefined ? { taxRatePercent: Number(raw.taxRatePercent) } : {}),
      taxLabel,
    })
    if (!calc.ok) return Response.json({ error: calc.error, code: calc.code }, { status: 400 })

    let dueAt = invoice.dueAt
    if (raw.dueAt !== undefined) {
      if (!raw.dueAt) dueAt = null
      else {
        const d = new Date(String(raw.dueAt))
        if (Number.isNaN(d.getTime())) return Response.json({ error: 'Invalid due date.' }, { status: 400 })
        dueAt = d
      }
    }

    const customerNotes =
      raw.customerNotes !== undefined
        ? sanitizeText(raw.customerNotes, 2000) || null
        : raw.notes !== undefined
          ? sanitizeText(raw.notes, 2000) || null
          : invoice.customerNotes
    const internalNotes =
      raw.internalNotes !== undefined ? sanitizeText(raw.internalNotes, 2000) || null : invoice.internalNotes

    const updated = await db.invoice.update({
      where: { id: invoice.id },
      data: {
        currency: calc.currency,
        amount: calc.totalMajor,
        subtotalMinor: calc.subtotalMinor,
        discountMinor: calc.discountMinor,
        discountReason,
        taxRateBps: calc.taxRateBps,
        taxLabel: calc.taxLabel,
        taxMinor: calc.taxMinor,
        totalMinor: calc.totalMinor,
        lineItems: JSON.stringify(calc.lineItems),
        description: raw.description !== undefined ? sanitizeText(raw.description, 4000) || null : invoice.description,
        billingName: raw.billingName !== undefined ? sanitizeText(raw.billingName, 120) || invoice.client.name : invoice.billingName,
        billingBusiness: raw.billingBusiness !== undefined ? sanitizeText(raw.billingBusiness, 160) || null : invoice.billingBusiness,
        billingEmail: raw.billingEmail !== undefined ? sanitizeEmail(raw.billingEmail) || null : invoice.billingEmail,
        billingAddress: raw.billingAddress !== undefined ? sanitizeText(raw.billingAddress, 500) || null : invoice.billingAddress,
        billingCountry: raw.billingCountry !== undefined ? sanitizeText(raw.billingCountry, 80) || null : invoice.billingCountry,
        paymentTerms: raw.paymentTerms !== undefined ? sanitizeText(raw.paymentTerms, 1000) || null : invoice.paymentTerms,
        customerNotes,
        notes: customerNotes,
        internalNotes,
        dueAt,
        updatedAt: new Date(),
      },
    })

    await audit({
      userId: g.user.id,
      actor: g.user.email,
      action: 'INVOICE_DRAFT_UPDATED',
      entityType: 'Invoice',
      entityId: invoice.id,
      clientId: invoice.client.clientId,
      details: { number: invoice.number, totalMinor: calc.totalMinor, currency: calc.currency },
      ip: g.ip,
    })
    return Response.json({ ok: true, invoice: updated })
  }

  // ---------------- 2. SUBMIT FOR APPROVAL ----------------
  if (action === 'submit_for_approval') {
    if (!canTransitionInvoiceStatus(invoice.status, 'AWAITING_APPROVAL')) {
      return Response.json({ error: `Cannot submit ${invoice.status} invoice for approval.` }, { status: 409 })
    }
    const updated = await db.invoice.update({
      where: { id: invoice.id },
      data: { status: 'AWAITING_APPROVAL', updatedAt: new Date() },
    })
    await audit({
      userId: g.user.id,
      actor: g.user.email,
      action: 'INVOICE_SUBMITTED_FOR_APPROVAL',
      entityType: 'Invoice',
      entityId: invoice.id,
      clientId: invoice.client.clientId,
      details: { number: invoice.number },
      ip: g.ip,
    })
    return Response.json({ ok: true, invoice: updated })
  }

  // ---------------- 3. APPROVE ----------------
  if (action === 'approve') {
    if (!hasCapability(g.user, 'finance.invoice.approve')) {
      return Response.json({ error: 'Forbidden — requires finance.invoice.approve capability.' }, { status: 403 })
    }
    if (!canTransitionInvoiceStatus(invoice.status, 'APPROVED')) {
      return Response.json({ error: `Cannot approve ${invoice.status} invoice.` }, { status: 409 })
    }
    const methodsSnapshot = (await acceptedMethodsPhrase()) || 'Not Configured — Payment setup required'
    const updated = await db.invoice.update({
      where: { id: invoice.id },
      data: {
        status: 'APPROVED',
        approvedBy: g.user.email,
        approvedAt: new Date(),
        paymentMethodsSnapshot: methodsSnapshot,
        updatedAt: new Date(),
      },
    })
    await audit({
      userId: g.user.id,
      actor: g.user.email,
      action: 'INVOICE_APPROVED',
      entityType: 'Invoice',
      entityId: invoice.id,
      clientId: invoice.client.clientId,
      details: { number: invoice.number, totalMinor },
      ip: g.ip,
    })
    return Response.json({ ok: true, invoice: updated })
  }

  // ---------------- 4. ISSUE (make visible in Client Portal without faking email) ----------------
  if (action === 'issue') {
    if (!canTransitionInvoiceStatus(invoice.status, 'ISSUED')) {
      return Response.json({ error: `Cannot issue ${invoice.status} invoice.` }, { status: 409 })
    }
    const now = new Date()
    const methodsSnapshot = (await acceptedMethodsPhrase()) || 'Not Configured — Payment setup required'
    const updated = await db.invoice.update({
      where: { id: invoice.id },
      data: {
        status: 'ISSUED',
        approvedBy: invoice.approvedBy ?? g.user.email,
        approvedAt: invoice.approvedAt ?? now,
        issuedAt: now,
        paymentMethodsSnapshot: methodsSnapshot,
        updatedAt: now,
      },
    })
    await audit({
      userId: g.user.id,
      actor: g.user.email,
      action: 'INVOICE_ISSUED',
      entityType: 'Invoice',
      entityId: invoice.id,
      clientId: invoice.client.clientId,
      details: { number: invoice.number, totalMinor, paymentMethodsSnapshot: methodsSnapshot },
      ip: g.ip,
    })
    return Response.json({ ok: true, invoice: updated })
  }

  // ---------------- 5. SEND (deliver approved/issued invoice via real configured channel) ----------------
  if (action === 'send') {
    if (invoice.status === 'VOID' || invoice.status === 'CANCELLED' || invoice.status === 'PAID' || invoice.status === 'REFUNDED') {
      return Response.json({ error: `Cannot send a ${invoice.status} invoice.` }, { status: 409 })
    }

    const paymentsOn = await featureEnabled('payments')
    const methodsPhrase = paymentsOn
      ? (await acceptedMethodsPhrase()) || 'Not Configured — Payment setup required'
      : 'Payment collection disabled by Super Admin'

    const recipientEmail = invoice.billingEmail || invoice.client.email
    const recipientPhone = invoice.client.whatsapp || invoice.client.phone
    const emailReady = Boolean(recipientEmail && channelConfigured('EMAIL'))
    const whatsappReady = Boolean(recipientPhone && channelConfigured('WHATSAPP'))

    if (!emailReady && !whatsappReady) {
      await audit({
        userId: g.user.id,
        actor: g.user.email,
        action: 'INVOICE_SEND_BLOCKED_UNCONFIGURED',
        entityType: 'Invoice',
        entityId: invoice.id,
        clientId: invoice.client.clientId,
        details: {
          number: invoice.number,
          hasEmail: Boolean(recipientEmail),
          smtpConfigured: channelConfigured('EMAIL'),
          whatsappConfigured: channelConfigured('WHATSAPP'),
        },
        ip: g.ip,
      })
      return Response.json(
        {
          ok: false,
          code: 'DELIVERY_NOT_CONFIGURED',
          error: !recipientEmail && !recipientPhone
            ? 'Client has no billing email or WhatsApp contact on file.'
            : 'Outbound Email (SMTP) / WhatsApp delivery is Not Configured. Issue the invoice for Client Portal access instead, or configure SMTP credentials first.',
        },
        { status: 503 },
      )
    }

    const dueStr = invoice.dueAt ? invoice.dueAt.toISOString().slice(0, 10) : 'upon receipt'
    const baseUrl = (process.env.APP_PUBLIC_URL || `https://${PAD.domain}`).replace(/\/$/, '')
    const portalUrl = `${baseUrl}/#/portal`
    const customerNote = invoice.customerNotes ?? (invoice.internalNotes ? null : invoice.notes)
    const plain =
      `Invoice ${invoice.number} from ${PAD.legalName}\n` +
      `Client: ${invoice.billingName || invoice.client.name} (${invoice.client.clientId})\n` +
      (invoice.project ? `Project: ${invoice.project.code} — ${invoice.project.name}\n` : '') +
      `Total Amount: ${invoice.currency} ${invoice.amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}\n` +
      `Balance Due: ${invoice.currency} ${settlement.remainingAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}\n` +
      `Due: ${dueStr}\n` +
      `Payment Methods: ${methodsPhrase}\n` +
      (customerNote ? `Notes: ${customerNote}\n` : '') +
      `View your official invoice in the Client Portal: ${portalUrl}`

    const deliveries: Array<{ channel: string; status: string; providerId?: string }> = []
    if (emailReady && recipientEmail) {
      const { result } = await sendCommunication({
        clientId: invoice.client.id,
        channel: 'EMAIL',
        to: recipientEmail,
        subject: `Invoice ${invoice.number} — ${invoice.currency} ${invoice.amount.toFixed(2)} (${PAD.legalName})`,
        body:
          `<p>Dear ${escapeHtml(invoice.billingName || invoice.client.name)},</p>` +
          `<p>Please find your official invoice <strong>${escapeHtml(invoice.number)}</strong> below.</p>` +
          `<table style="border-collapse:collapse;margin:14px 0;font-size:14px">` +
          `<tr><td style="padding:5px 14px 5px 0;color:#64748B">Client ID</td><td><strong>${escapeHtml(invoice.client.clientId)}</strong></td></tr>` +
          (invoice.project ? `<tr><td style="padding:5px 14px 5px 0;color:#64748B">Project</td><td>${escapeHtml(invoice.project.code)} — ${escapeHtml(invoice.project.name)}</td></tr>` : '') +
          `<tr><td style="padding:5px 14px 5px 0;color:#64748B">Total</td><td><strong>${escapeHtml(invoice.currency)} ${invoice.amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong></td></tr>` +
          `<tr><td style="padding:5px 14px 5px 0;color:#64748B">Balance Due</td><td><strong>${escapeHtml(invoice.currency)} ${settlement.remainingAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong></td></tr>` +
          `<tr><td style="padding:5px 14px 5px 0;color:#64748B">Due Date</td><td>${escapeHtml(dueStr)}</td></tr>` +
          `<tr><td style="padding:5px 14px 5px 0;color:#64748B">Payment Methods</td><td>${escapeHtml(methodsPhrase)}</td></tr>` +
          `</table>` +
          (customerNote ? `<p style="color:#334155">${escapeHtml(customerNote)}</p>` : '') +
          `<p><a href="${escapeHtml(portalUrl)}" style="color:#009FE3;font-weight:600">Sign in to the TECH360 Client Portal to view or print your full itemized invoice</a></p>`,
        storedBody: plain,
        templateName: 'INVOICE_SEND',
        messageType: 'DOCUMENT',
        metadata: JSON.stringify({ invoiceId: invoice.id, invoiceNumber: invoice.number, revision: invoice.revision }),
      })
      deliveries.push({ channel: 'EMAIL', status: result.status, providerId: result.providerMessageId })
    }
    if (whatsappReady && recipientPhone) {
      const { result } = await sendCommunication({
        clientId: invoice.client.id,
        channel: 'WHATSAPP',
        to: recipientPhone,
        body: plain,
        templateName: 'INVOICE_SEND',
        messageType: 'DOCUMENT',
        metadata: JSON.stringify({ invoiceId: invoice.id, invoiceNumber: invoice.number, revision: invoice.revision }),
      })
      deliveries.push({ channel: 'WHATSAPP', status: result.status, providerId: result.providerMessageId })
    }

    const anySent = deliveries.some((d) => d.status === 'SENT' || d.status === 'DELIVERED')
    if (!anySent) {
      await audit({
        userId: g.user.id,
        actor: g.user.email,
        action: 'INVOICE_SEND_FAILED',
        entityType: 'Invoice',
        entityId: invoice.id,
        clientId: invoice.client.clientId,
        details: { number: invoice.number, deliveries },
        ip: g.ip,
      })
      return Response.json(
        {
          ok: false,
          code: 'DELIVERY_FAILED',
          error: 'Invoice delivery failed across configured channels; invoice was NOT marked SENT.',
          deliveries,
        },
        { status: 502 },
      )
    }

    const now = new Date()
    const nextStatus = invoice.status === 'PARTIAL' ? 'PARTIAL' : 'SENT'
    const updated = await db.invoice.update({
      where: { id: invoice.id },
      data: {
        status: nextStatus,
        approvedBy: invoice.approvedBy ?? g.user.email,
        approvedAt: invoice.approvedAt ?? now,
        sentAt: now,
        paymentMethodsSnapshot: methodsPhrase,
        updatedAt: now,
      },
    })

    await audit({
      userId: g.user.id,
      actor: g.user.email,
      action: 'INVOICE_SENT',
      entityType: 'Invoice',
      entityId: invoice.id,
      clientId: invoice.client.clientId,
      details: { number: invoice.number, deliveries },
      ip: g.ip,
    })

    return Response.json({ ok: true, invoice: updated, deliveries })
  }

  // ---------------- 6. MARK OVERDUE ----------------
  if (action === 'mark_overdue') {
    if (!canTransitionInvoiceStatus(invoice.status, 'OVERDUE')) {
      return Response.json({ error: `Cannot mark ${invoice.status} invoice as OVERDUE.` }, { status: 409 })
    }
    const updated = await db.invoice.update({
      where: { id: invoice.id },
      data: { status: 'OVERDUE', updatedAt: new Date() },
    })
    await audit({
      userId: g.user.id,
      actor: g.user.email,
      action: 'INVOICE_MARKED_OVERDUE',
      entityType: 'Invoice',
      entityId: invoice.id,
      clientId: invoice.client.clientId,
      details: { number: invoice.number },
      ip: g.ip,
    })
    return Response.json({ ok: true, invoice: updated })
  }

  // ---------------- 7. VOID / CANCEL ----------------
  if (action === 'void' || action === 'cancel') {
    if (settlement.paidMinor > 0) {
      return Response.json(
        {
          error: 'An invoice with verified settled payments cannot be voided directly. Open a Refund / Cancellation case instead.',
          code: 'HAS_SETTLED_PAYMENTS',
        },
        { status: 409 },
      )
    }
    const targetStatus = action === 'void' ? 'VOID' : 'CANCELLED'
    if (!canTransitionInvoiceStatus(invoice.status, targetStatus)) {
      return Response.json({ error: `Cannot ${action} a ${invoice.status} invoice.` }, { status: 409 })
    }
    const reason = sanitizeText(raw.reason ?? raw.voidReason, 500)
    if (reason.length < 3) {
      return Response.json({ error: 'Provide a void/cancellation reason (min 3 characters).' }, { status: 400 })
    }
    const now = new Date()
    const updated = await db.invoice.update({
      where: { id: invoice.id },
      data: { status: targetStatus, voidedAt: now, voidReason: reason, updatedAt: now },
    })
    await audit({
      userId: g.user.id,
      actor: g.user.email,
      action: targetStatus === 'VOID' ? 'INVOICE_VOIDED' : 'INVOICE_CANCELLED',
      entityType: 'Invoice',
      entityId: invoice.id,
      clientId: invoice.client.clientId,
      details: { number: invoice.number, reason },
      ip: g.ip,
    })
    return Response.json({ ok: true, invoice: updated })
  }

  // ---------------- 8. REISSUE (supersede immutable issued invoice with new revision) ----------------
  if (action === 'reissue') {
    if (settlement.paidMinor > 0) {
      return Response.json(
        { error: 'Invoices with verified payments cannot be void-reissued; issue a separate delta invoice or refund case.' },
        { status: 409 },
      )
    }
    const reason = sanitizeText(raw.reason, 500) || `Superseded by revised invoice`
    const existingItems = parseStoredLineItems(
      invoice.lineItems,
      invoice.description || invoice.customerNotes || invoice.notes || 'Software engineering & delivery services',
      totalMinor,
    )
    const lineItemsInput: InvoiceLineItemInput[] =
      Array.isArray(raw.lineItems) && raw.lineItems.length > 0
        ? raw.lineItems.map((item: unknown) => {
            const rec = (item && typeof item === 'object' ? item : {}) as Record<string, unknown>
            return {
              description: sanitizeText(rec.description, 500),
              quantity: Number(rec.quantity ?? 1),
              ...(rec.unitMinor !== undefined ? { unitMinor: Number(rec.unitMinor) } : {}),
              ...(rec.unitPrice !== undefined ? { unitPrice: Number(rec.unitPrice) } : {}),
            }
          })
        : existingItems.map((it) => ({ description: it.description, quantity: it.quantity, unitMinor: it.unitMinor }))

    const calc = computeInvoiceTotals({
      currency: sanitizeText(raw.currency, 8) || invoice.currency,
      lineItems: lineItemsInput,
      discountMinor: raw.discountMinor !== undefined ? Number(raw.discountMinor) : (invoice.discountMinor ?? 0),
      discountReason: raw.discountReason !== undefined ? sanitizeText(raw.discountReason, 500) || null : invoice.discountReason,
      taxRateBps: raw.taxRateBps !== undefined ? Number(raw.taxRateBps) : (invoice.taxRateBps ?? 0),
      taxLabel: raw.taxLabel !== undefined ? sanitizeText(raw.taxLabel, 80) || null : invoice.taxLabel,
    })
    if (!calc.ok) return Response.json({ error: calc.error, code: calc.code }, { status: 400 })

    const newNumber = await nextInvoiceNumber()
    const now = new Date()
    const methodsSnapshot = (await acceptedMethodsPhrase()) || 'Not Configured — Payment setup required'

    const reissued = await db.$transaction(async (tx) => {
      if (invoice.status !== 'VOID' && invoice.status !== 'CANCELLED') {
        await tx.invoice.update({
          where: { id: invoice.id },
          data: {
            status: 'VOID',
            voidedAt: now,
            voidReason: `${reason} (superseded by ${newNumber})`,
            updatedAt: now,
          },
        })
      }
      return tx.invoice.create({
        data: {
          number: newNumber,
          clientId: invoice.clientId,
          projectId: invoice.projectId,
          scopeVersion: invoice.scopeVersion,
          currency: calc.currency,
          amount: calc.totalMajor,
          subtotalMinor: calc.subtotalMinor,
          discountMinor: calc.discountMinor,
          discountReason: raw.discountReason !== undefined ? sanitizeText(raw.discountReason, 500) || null : invoice.discountReason,
          taxRateBps: calc.taxRateBps,
          taxLabel: calc.taxLabel,
          taxMinor: calc.taxMinor,
          totalMinor: calc.totalMinor,
          description: raw.description !== undefined ? sanitizeText(raw.description, 4000) || null : invoice.description,
          lineItems: JSON.stringify(calc.lineItems),
          billingName: invoice.billingName,
          billingBusiness: invoice.billingBusiness,
          billingEmail: invoice.billingEmail,
          billingAddress: invoice.billingAddress,
          billingCountry: invoice.billingCountry,
          paymentTerms: invoice.paymentTerms,
          paymentMethodsSnapshot: methodsSnapshot,
          internalNotes: invoice.internalNotes,
          customerNotes: raw.customerNotes !== undefined ? sanitizeText(raw.customerNotes, 2000) || null : invoice.customerNotes,
          notes: raw.customerNotes !== undefined ? sanitizeText(raw.customerNotes, 2000) || null : invoice.customerNotes,
          termsVersion: invoice.termsVersion,
          revision: (invoice.revision ?? 1) + 1,
          supersedesInvoiceNumber: invoice.number,
          status: 'DRAFT',
          dueAt: invoice.dueAt,
        },
      })
    })

    await audit({
      userId: g.user.id,
      actor: g.user.email,
      action: 'INVOICE_REISSUED',
      entityType: 'Invoice',
      entityId: reissued.id,
      clientId: invoice.client.clientId,
      details: { previousNumber: invoice.number, newNumber: reissued.number, revision: reissued.revision, reason },
      ip: g.ip,
    })

    return Response.json({ ok: true, invoice: reissued, supersededNumber: invoice.number }, { status: 201 })
  }

  // ---------------- 9. MARK DISPUTED ----------------
  if (action === 'mark_disputed') {
    if (!canTransitionInvoiceStatus(invoice.status, 'DISPUTED')) {
      return Response.json({ error: `Cannot mark ${invoice.status} invoice as DISPUTED.` }, { status: 409 })
    }
    const updated = await db.invoice.update({
      where: { id: invoice.id },
      data: { status: 'DISPUTED', updatedAt: new Date() },
    })
    await audit({
      userId: g.user.id,
      actor: g.user.email,
      action: 'INVOICE_MARKED_DISPUTED',
      entityType: 'Invoice',
      entityId: invoice.id,
      clientId: invoice.client.clientId,
      details: { number: invoice.number, reason: sanitizeText(raw.reason, 500) },
      ip: g.ip,
    })
    return Response.json({ ok: true, invoice: updated })
  }

  return Response.json({ error: `Unknown invoice action "${action}".` }, { status: 400 })
}
