import { NextRequest } from 'next/server'
import { guard, isResponse } from '@/lib/api-guard'
import { DOCUMENT_HTML_HEADERS, renderReceiptDocumentHtml } from '@/lib/invoice-document'
import { ensureVerifiedPaymentReceipt } from '@/lib/receipts'
import { audit, sanitizeText } from '@/lib/security'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const g = await guard(req, { capability: 'finance.read', capabilityOnly: true })
  if (isResponse(g)) return g

  const { id } = await params
  const cleanId = sanitizeText(id, 40)
  const res = await ensureVerifiedPaymentReceipt(cleanId)
  if (!res.ok) {
    return Response.json({ error: res.error, code: res.code }, { status: res.status })
  }

  if (res.created) {
    await audit({
      userId: g.user.id,
      actor: g.user.email,
      action: 'PAYMENT_RECEIPT_ISSUED',
      entityType: 'PaymentReceipt',
      entityId: res.receipt.id,
      clientId: res.payment.client.clientId,
      details: { receiptNumber: res.receipt.receiptNumber, paymentId: res.payment.id },
      ip: g.ip,
    })
  }

  if (req.nextUrl.searchParams.get('format') === 'html') {
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

  return Response.json({ ok: true, receipt: res.receipt })
}
