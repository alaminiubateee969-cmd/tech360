import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { nextInvoiceNumber } from '@/lib/ids'
import { guard, isResponse } from '@/lib/api-guard'
import { audit, readJson, sanitizeText } from '@/lib/security'
import { isInvoiceCurrency, parseInvoiceAmount } from '@/lib/invoice-policy'

export const dynamic = 'force-dynamic'

/**
 * Create a non-payable invoice draft using the existing invoice schema.
 * This endpoint never emails the draft, publishes payment instructions,
 * records a payment, or marks an invoice paid.
 *
 * The existing schema has one Float amount and a notes field rather than
 * decimal-safe invoice line items. Keep this conservative until an additive
 * line-item/money migration is reviewed and tested against disposable MySQL.
 */
export async function POST(req: NextRequest) {
  const g = await guard(req, { minRole: 'MANAGER' })
  if (isResponse(g)) return g

  const raw = await readJson(req)
  const clientRef = sanitizeText(raw.clientId, 40)
  const projectRef = sanitizeText(raw.projectId, 80)
  const description = sanitizeText(raw.description, 500)
  const amount = parseInvoiceAmount(raw.amount)
  const currency = raw.currency === undefined ? 'USD' : sanitizeText(raw.currency, 3)

  const errors: Record<string, string> = {}
  if (!clientRef) errors.clientId = 'Select a client.'
  if (!description) errors.description = 'Add a clear invoice description.'
  if (!amount) errors.amount = 'Enter an amount greater than zero with no more than two decimal places.'
  if (!isInvoiceCurrency(currency)) errors.currency = 'Choose a supported currency.'
  if (Object.keys(errors).length) return Response.json({ error: 'Validation failed.', fields: errors }, { status: 400 })
  if (!isInvoiceCurrency(currency)) return Response.json({ error: 'Choose a supported currency.' }, { status: 400 })

  const client = await db.client.findFirst({
    where: { OR: [{ id: clientRef }, { clientId: clientRef }], deletedAt: null },
    select: { id: true, clientId: true },
  })
  if (!client) return Response.json({ error: 'Client not found.' }, { status: 404 })

  let projectId: string | null = null
  if (projectRef) {
    const project = await db.project.findFirst({
      where: { OR: [{ id: projectRef }, { code: projectRef }], clientId: client.id, deletedAt: null },
      select: { id: true },
    })
    if (!project) return Response.json({ error: 'Project not found for this client.' }, { status: 404 })
    projectId = project.id
  }

  const dueRaw = sanitizeText(raw.dueAt, 10)
  let dueAt: Date | null = null
  if (dueRaw) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dueRaw)) {
      return Response.json({ error: 'Due date must use YYYY-MM-DD.' }, { status: 400 })
    }
    dueAt = new Date(`${dueRaw}T00:00:00.000Z`)
    if (Number.isNaN(dueAt.getTime()) || dueAt.toISOString().slice(0, 10) !== dueRaw) {
      return Response.json({ error: 'Due date is invalid.' }, { status: 400 })
    }
  }

  // Invoice number has a unique database constraint. Retry only a collision;
  // never convert unrelated database errors into a second invoice attempt.
  let invoice: Awaited<ReturnType<typeof db.invoice.create>> | null = null
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const number = await nextInvoiceNumber()
    try {
      invoice = await db.invoice.create({
        data: {
          number,
          clientId: client.id,
          projectId,
          amount: amount!.amount,
          currency,
          status: 'DRAFT',
          notes: description,
          dueAt,
        },
      })
      break
    } catch (error) {
      const code = typeof error === 'object' && error !== null && 'code' in error
        ? String((error as { code?: unknown }).code)
        : ''
      if (code !== 'P2002' || attempt === 4) throw error
    }
  }
  if (!invoice) return Response.json({ error: 'Could not allocate a unique invoice number.' }, { status: 409 })

  await audit({
    actor: g.user.email,
    userId: g.user.id,
    action: 'INVOICE_DRAFT_CREATED',
    entityType: 'Invoice',
    entityId: invoice.id,
    clientId: client.clientId,
    details: { number: invoice.number, amountCents: amount!.cents.toString(), currency, projectId, status: 'DRAFT' },
    ip: g.ip,
  })

  return Response.json({
    ok: true,
    invoice: { id: invoice.id, number: invoice.number, amount: invoice.amount, currency: invoice.currency, status: invoice.status, dueAt: invoice.dueAt },
    message: 'Draft saved. It has not been issued, emailed, or treated as a payment request.',
  }, { status: 201 })
}
