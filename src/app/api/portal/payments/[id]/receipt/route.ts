import { NextRequest } from 'next/server'
import { cookies } from 'next/headers'
import { db } from '@/lib/db'
import { DOCUMENT_HTML_HEADERS, renderReceiptDocumentHtml } from '@/lib/invoice-document'
import { PORTAL_COOKIE, portalGate, verifyPortalToken } from '@/lib/portal'
import { ensureVerifiedPaymentReceipt } from '@/lib/receipts'
import { audit, clientIp, rateLimit, sanitizeText } from '@/lib/security'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const portalDisabled = await portalGate()
  if (portalDisabled) return portalDisabled

  const ip = clientIp(req)
  const rl = rateLimit(`portal-receipt:${ip}`, 30, 60_000)
  if (!rl.ok) return Response.json({ error: 'Too many requests.' }, { status: 429 })

  const store = await cookies()
  const clientCode = verifyPortalToken(store.get(PORTAL_COOKIE)?.value)
  if (!clientCode) return Response.json({ error: 'Not signed in.' }, { status: 401 })

  const client = await db.client.findFirst({
    where: { clientId: clientCode, deletedAt: null },
    select: { id: true, clientId: true },
  })
  if (!client) return Response.json({ error: 'Client not found.' }, { status: 404 })

  const { id } = await params
  const cleanId = sanitizeText(id, 40)

  // Tenant boundary enforced BEFORE receipt lookup — 404 on cross-tenant probe.
  const ownedPayment = await db.payment.findFirst({
    where: { id: cleanId, clientId: client.id },
    select: { id: true },
  })
  if (!ownedPayment) return Response.json({ error: 'Receipt not found.' }, { status: 404 })

  const res = await ensureVerifiedPaymentReceipt(cleanId)
  if (!res.ok) {
    return Response.json({ error: res.error, code: res.code }, { status: res.status })
  }

  await audit({
    actor: `client:${client.clientId}`,
    action: 'RECEIPT_VIEWED_BY_CLIENT',
    entityType: 'PaymentReceipt',
    entityId: res.receipt.id,
    clientId: client.clientId,
    details: { receiptNumber: res.receipt.receiptNumber, paymentId: cleanId },
    ip,
  })

  if (req.nextUrl.searchParams.get('format') !== 'json') {
    const html = renderReceiptDocumentHtml({
      receiptNumber: res.receipt.receiptNumber,
      amountMinor: res.receipt.amountMinor,
      currency: res.receipt.currency,
      method: res.receipt.method,
      transactionId: res.receipt.transactionId,
      verifiedBy: res.receipt.verifiedBy,
      verifiedAt: res.receipt.verifiedAt,
      issuedAt: res.receipt.issuedAt,
      invoiceNumber: res.payment.invoice?.number ?? null,
      milestone: res.payment.milestone ?? null,
      client: res.payment.client,
      project: res.payment.project,
    })
    return new Response(html, { status: 200, headers: DOCUMENT_HTML_HEADERS })
  }

  return Response.json({
    ok: true,
    receipt: {
      receiptNumber: res.receipt.receiptNumber,
      amountMinor: res.receipt.amountMinor,
      currency: res.receipt.currency,
      method: res.receipt.method,
      transactionId: res.receipt.transactionId,
      verifiedAt: res.receipt.verifiedAt,
      issuedAt: res.receipt.issuedAt,
      invoiceNumber: res.payment.invoice?.number ?? null,
    },
  })
}
