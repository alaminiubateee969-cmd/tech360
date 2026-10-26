// ============================================================
// INVOICE, RECEIPT & REFUND FINANCIAL POLICY — pure, deterministic
// minor-unit (cents / poisha) domain rules.
//
// Invariants enforced here:
//   1. All monetary math runs in integer minor units (1 major = 100 minor)
//      to eliminate IEEE-754 floating-point drift.
//   2. Browser-supplied totals are never trusted; mismatched client totals
//      or mixed line-item currencies are rejected.
//   3. Internal pre-issue states (DRAFT, AWAITING_APPROVAL, APPROVED) are
//      hidden from the Client Portal and blocked from payment collection.
//   4. Once an invoice leaves DRAFT / AWAITING_APPROVAL, its financial
//      terms and line items are immutable — changes require void + reissue.
//   5. Official payment receipts are permitted ONLY for verified PAID
//      payments (status === 'PAID', verifiedAt, verifiedBy).
//   6. Settled refunds reduce net verified project paid balance and
//      revoke source-code handover eligibility whenever net paid drops
//      below total project value.
// ============================================================

export const SUPPORTED_CURRENCIES = ['USD', 'EUR', 'GBP', 'BDT', 'CAD', 'AUD', 'SGD', 'AED'] as const
export type SupportedCurrency = (typeof SUPPORTED_CURRENCIES)[number]

export const INVOICE_STATUSES = [
  'DRAFT',
  'AWAITING_APPROVAL',
  'APPROVED',
  'ISSUED',
  'SENT',
  'VIEWED',
  'PARTIAL',
  'PAID',
  'OVERDUE',
  'VOID',
  'CANCELLED',
  'REFUND_PENDING',
  'PARTIALLY_REFUNDED',
  'REFUNDED',
  'DISPUTED',
] as const

export type InvoiceStatus = (typeof INVOICE_STATUSES)[number]

export interface InvoiceLineItemInput {
  description: string
  quantity: number
  unitPrice?: number
  unitMinor?: number
  currency?: string
}

export interface InvoiceLineItem {
  description: string
  quantity: number
  unitMinor: number
  amountMinor: number
}

export interface InvoiceCalculationInput {
  currency: string
  lineItems: InvoiceLineItemInput[]
  discountMinor?: number
  discountAmount?: number
  discountReason?: string | null
  taxRateBps?: number
  taxRatePercent?: number
  taxLabel?: string | null
  expectedTotalMinor?: number
}

export type InvoiceCalculationResult =
  | {
      ok: true
      currency: SupportedCurrency
      lineItems: InvoiceLineItem[]
      subtotalMinor: number
      discountMinor: number
      taxRateBps: number
      taxLabel: string | null
      taxMinor: number
      totalMinor: number
      totalMajor: number
    }
  | {
      ok: false
      code:
        | 'UNSUPPORTED_CURRENCY'
        | 'MIXED_CURRENCY'
        | 'NO_LINE_ITEMS'
        | 'INVALID_LINE_ITEM'
        | 'INVALID_DISCOUNT'
        | 'DISCOUNT_REASON_REQUIRED'
        | 'INVALID_TAX_RATE'
        | 'TAX_LABEL_REQUIRED'
        | 'ZERO_OR_NEGATIVE_TOTAL'
        | 'CLIENT_TOTAL_MISMATCH'
      error: string
    }

export function isValidCurrency(currency: string): currency is SupportedCurrency {
  return (SUPPORTED_CURRENCIES as readonly string[]).includes(currency.trim().toUpperCase())
}

export function toMinorUnits(majorAmount: number): number {
  if (!Number.isFinite(majorAmount)) throw new Error('Invalid monetary amount')
  return Math.round((majorAmount + Number.EPSILON) * 100)
}

export function fromMinorUnits(minorAmount: number): number {
  return Number((minorAmount / 100).toFixed(2))
}

export function resolveInvoiceTotalMinor(invoice: { totalMinor?: number | null; amount: number }): number {
  if (typeof invoice.totalMinor === 'number' && Number.isInteger(invoice.totalMinor) && invoice.totalMinor > 0) {
    return invoice.totalMinor
  }
  return toMinorUnits(invoice.amount)
}

export function parseStoredLineItems(raw: string | null | undefined, fallbackDescription: string, fallbackTotalMinor: number): InvoiceLineItem[] {
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as unknown
      if (Array.isArray(parsed) && parsed.length > 0) {
        const clean: InvoiceLineItem[] = []
        for (const item of parsed) {
          if (!item || typeof item !== 'object') continue
          const rec = item as Record<string, unknown>
          const description = typeof rec.description === 'string' ? rec.description.trim() : ''
          const quantity = Number(rec.quantity)
          const unitMinor = Number(rec.unitMinor)
          const amountMinor = Number(rec.amountMinor)
          if (description && Number.isFinite(quantity) && quantity > 0 && Number.isInteger(unitMinor) && Number.isInteger(amountMinor)) {
            clean.push({ description, quantity, unitMinor, amountMinor })
          }
        }
        if (clean.length > 0) return clean
      }
    } catch {
      // fall through to synthesized item
    }
  }
  return [
    {
      description: fallbackDescription.trim() || 'Software engineering & delivery services',
      quantity: 1,
      unitMinor: fallbackTotalMinor,
      amountMinor: fallbackTotalMinor,
    },
  ]
}

export function computeInvoiceTotals(input: InvoiceCalculationInput): InvoiceCalculationResult {
  const normalizedCurrency = (input.currency || '').trim().toUpperCase()
  if (!isValidCurrency(normalizedCurrency)) {
    return {
      ok: false,
      code: 'UNSUPPORTED_CURRENCY',
      error: `Unsupported currency "${input.currency}". Supported: ${SUPPORTED_CURRENCIES.join(', ')}.`,
    }
  }

  if (!Array.isArray(input.lineItems) || input.lineItems.length === 0 || input.lineItems.length > 100) {
    return {
      ok: false,
      code: 'NO_LINE_ITEMS',
      error: 'At least one line item (and at most 100) is required.',
    }
  }

  const computedItems: InvoiceLineItem[] = []
  let subtotalMinor = 0

  for (let i = 0; i < input.lineItems.length; i += 1) {
    const raw = input.lineItems[i]
    if (raw.currency && raw.currency.trim().toUpperCase() !== normalizedCurrency) {
      return {
        ok: false,
        code: 'MIXED_CURRENCY',
        error: `Line item #${i + 1} currency (${raw.currency}) does not match invoice currency (${normalizedCurrency}).`,
      }
    }
    const description = typeof raw.description === 'string' ? raw.description.trim().slice(0, 500) : ''
    const quantity = Number(raw.quantity)
    if (!description || !Number.isFinite(quantity) || quantity <= 0 || quantity > 1_000_000) {
      return {
        ok: false,
        code: 'INVALID_LINE_ITEM',
        error: `Line item #${i + 1} requires a description and a positive quantity.`,
      }
    }
    // Quantity supports up to 4 decimal places (e.g. fractional hours).
    const roundedQty = Math.round((quantity + Number.EPSILON) * 10_000) / 10_000

    let unitMinor: number
    if (raw.unitMinor !== undefined) {
      if (!Number.isInteger(raw.unitMinor) || raw.unitMinor < 0 || raw.unitMinor > 1_000_000_000) {
        return {
          ok: false,
          code: 'INVALID_LINE_ITEM',
          error: `Line item #${i + 1} has an invalid unit price.`,
        }
      }
      unitMinor = raw.unitMinor
    } else if (raw.unitPrice !== undefined && Number.isFinite(raw.unitPrice) && raw.unitPrice >= 0 && raw.unitPrice <= 10_000_000) {
      unitMinor = toMinorUnits(raw.unitPrice)
    } else {
      return {
        ok: false,
        code: 'INVALID_LINE_ITEM',
        error: `Line item #${i + 1} requires a non-negative unit price.`,
      }
    }

    const amountMinor = Math.round(roundedQty * unitMinor)
    if (!Number.isSafeInteger(amountMinor) || amountMinor < 0) {
      return {
        ok: false,
        code: 'INVALID_LINE_ITEM',
        error: `Line item #${i + 1} produced an invalid line amount.`,
      }
    }
    subtotalMinor += amountMinor
    computedItems.push({ description, quantity: roundedQty, unitMinor, amountMinor })
  }

  let discountMinor = 0
  if (input.discountMinor !== undefined) {
    if (!Number.isInteger(input.discountMinor) || input.discountMinor < 0) {
      return { ok: false, code: 'INVALID_DISCOUNT', error: 'Discount must be a non-negative amount.' }
    }
    discountMinor = input.discountMinor
  } else if (input.discountAmount !== undefined) {
    if (!Number.isFinite(input.discountAmount) || input.discountAmount < 0) {
      return { ok: false, code: 'INVALID_DISCOUNT', error: 'Discount must be a non-negative amount.' }
    }
    discountMinor = toMinorUnits(input.discountAmount)
  }

  if (discountMinor > subtotalMinor) {
    return {
      ok: false,
      code: 'INVALID_DISCOUNT',
      error: 'Discount cannot exceed invoice subtotal.',
    }
  }
  if (discountMinor > 0 && !(input.discountReason ?? '').trim()) {
    return {
      ok: false,
      code: 'DISCOUNT_REASON_REQUIRED',
      error: 'An approved discount reason is required when applying a discount.',
    }
  }

  let taxRateBps = 0
  if (input.taxRateBps !== undefined) {
    if (!Number.isInteger(input.taxRateBps) || input.taxRateBps < 0 || input.taxRateBps > 5_000) {
      return { ok: false, code: 'INVALID_TAX_RATE', error: 'Tax rate must be between 0% and 50%.' }
    }
    taxRateBps = input.taxRateBps
  } else if (input.taxRatePercent !== undefined) {
    if (!Number.isFinite(input.taxRatePercent) || input.taxRatePercent < 0 || input.taxRatePercent > 50) {
      return { ok: false, code: 'INVALID_TAX_RATE', error: 'Tax rate must be between 0% and 50%.' }
    }
    taxRateBps = Math.round((input.taxRatePercent + Number.EPSILON) * 100)
  }

  const taxLabel = (input.taxLabel ?? '').trim() || null
  if (taxRateBps > 0 && !taxLabel) {
    return {
      ok: false,
      code: 'TAX_LABEL_REQUIRED',
      error: 'A tax treatment / label (e.g. Sales Tax, VAT) is required when a non-zero tax rate is applied.',
    }
  }

  const taxableMinor = subtotalMinor - discountMinor
  const taxMinor = taxRateBps > 0 ? Math.round((taxableMinor * taxRateBps) / 10_000) : 0
  const totalMinor = taxableMinor + taxMinor

  if (totalMinor <= 0) {
    return {
      ok: false,
      code: 'ZERO_OR_NEGATIVE_TOTAL',
      error: 'Invoice total must be greater than zero.',
    }
  }

  if (input.expectedTotalMinor !== undefined && input.expectedTotalMinor !== totalMinor) {
    return {
      ok: false,
      code: 'CLIENT_TOTAL_MISMATCH',
      error: `Client-submitted total (${fromMinorUnits(input.expectedTotalMinor)}) does not match server-calculated total (${fromMinorUnits(totalMinor)}).`,
    }
  }

  return {
    ok: true,
    currency: normalizedCurrency,
    lineItems: computedItems,
    subtotalMinor,
    discountMinor,
    taxRateBps,
    taxLabel,
    taxMinor,
    totalMinor,
    totalMajor: fromMinorUnits(totalMinor),
  }
}

// ---------- State Machine & Immutability ----------

const ALLOWED_TRANSITIONS: Readonly<Record<string, ReadonlySet<string>>> = {
  DRAFT: new Set(['AWAITING_APPROVAL', 'APPROVED', 'ISSUED', 'SENT', 'VOID', 'CANCELLED']),
  AWAITING_APPROVAL: new Set(['DRAFT', 'APPROVED', 'VOID', 'CANCELLED']),
  APPROVED: new Set(['ISSUED', 'SENT', 'VOID', 'CANCELLED']),
  ISSUED: new Set(['SENT', 'VIEWED', 'PARTIAL', 'PAID', 'OVERDUE', 'VOID', 'CANCELLED', 'DISPUTED']),
  SENT: new Set(['VIEWED', 'PARTIAL', 'PAID', 'OVERDUE', 'VOID', 'CANCELLED', 'DISPUTED']),
  VIEWED: new Set(['PARTIAL', 'PAID', 'OVERDUE', 'VOID', 'CANCELLED', 'DISPUTED']),
  OVERDUE: new Set(['PARTIAL', 'PAID', 'VOID', 'CANCELLED', 'DISPUTED']),
  PARTIAL: new Set(['PAID', 'OVERDUE', 'REFUND_PENDING', 'PARTIALLY_REFUNDED', 'REFUNDED', 'DISPUTED']),
  PAID: new Set(['REFUND_PENDING', 'PARTIALLY_REFUNDED', 'REFUNDED', 'DISPUTED']),
  REFUND_PENDING: new Set(['PARTIAL', 'PAID', 'PARTIALLY_REFUNDED', 'REFUNDED', 'DISPUTED']),
  PARTIALLY_REFUNDED: new Set(['REFUND_PENDING', 'REFUNDED', 'PAID', 'DISPUTED']),
  DISPUTED: new Set(['ISSUED', 'SENT', 'PARTIAL', 'PAID', 'REFUND_PENDING', 'PARTIALLY_REFUNDED', 'REFUNDED', 'VOID']),
  REFUNDED: new Set([]),
  VOID: new Set([]),
  CANCELLED: new Set([]),
}

export function canTransitionInvoiceStatus(fromStatus: string, toStatus: string): boolean {
  if (fromStatus === toStatus) return true
  const allowed = ALLOWED_TRANSITIONS[fromStatus]
  return Boolean(allowed?.has(toStatus))
}

/**
 * Only pre-approval invoices (`DRAFT`, `AWAITING_APPROVAL`) may have their
 * line items, pricing, billing identity, or currency edited in place.
 * Once `APPROVED` or `ISSUED`/`SENT`, historical figures are immutable.
 */
export function canEditInvoiceFields(status: string): boolean {
  return status === 'DRAFT' || status === 'AWAITING_APPROVAL'
}

/**
 * Internal pre-issuance invoices (`DRAFT`, `AWAITING_APPROVAL`, `APPROVED`)
 * are never exposed to clients in the Client Portal.
 */
export function isCustomerVisibleInvoiceStatus(status: string): boolean {
  return status !== 'DRAFT' && status !== 'AWAITING_APPROVAL' && status !== 'APPROVED'
}

/**
 * Only issued, active, non-disputed, unpaid/partially-paid invoices may
 * accept new payment allocations or online checkout sessions.
 */
export function isPayableInvoiceStatus(status: string): boolean {
  return (
    status === 'ISSUED' ||
    status === 'SENT' ||
    status === 'VIEWED' ||
    status === 'PARTIAL' ||
    status === 'OVERDUE'
  )
}

export type InvoicePaymentSlice = {
  amount: number
  status: string
  verifiedAt?: Date | null
}

/**
 * Compute settled balance and next status for an invoice from ALL linked
 * payments. Only verified `PAID` payments count toward settlement — `PENDING`,
 * `FAILED`, `CANCELLED` and `REFUNDED` rows never mark an invoice paid.
 */
export function computeInvoiceSettlement(input: {
  invoiceAmount: number
  invoiceTotalMinor?: number | null
  currentStatus: string
  dueAt?: Date | null
  now?: Date
  payments: readonly InvoicePaymentSlice[]
}): {
  paidAmount: number
  remainingAmount: number
  paidMinor: number
  remainingMinor: number
  nextStatus: InvoiceStatus
} {
  const totalMinor = resolveInvoiceTotalMinor({
    totalMinor: input.invoiceTotalMinor,
    amount: input.invoiceAmount,
  })
  const paidMinor = input.payments
    .filter((p) => p.status === 'PAID' && p.verifiedAt !== null && Number.isFinite(p.amount) && p.amount > 0)
    .reduce((sum, p) => sum + toMinorUnits(p.amount), 0)

  const remainingMinor = Math.max(0, totalMinor - paidMinor)
  const paidAmount = fromMinorUnits(paidMinor)
  const remainingAmount = fromMinorUnits(remainingMinor)
  const now = input.now ?? new Date()

  if (
    input.currentStatus === 'CANCELLED' ||
    input.currentStatus === 'VOID' ||
    input.currentStatus === 'REFUNDED' ||
    input.currentStatus === 'DISPUTED'
  ) {
    return {
      paidAmount,
      remainingAmount,
      paidMinor,
      remainingMinor,
      nextStatus: input.currentStatus as InvoiceStatus,
    }
  }

  let nextStatus: InvoiceStatus
  if (totalMinor > 0 && remainingMinor === 0) {
    nextStatus = 'PAID'
  } else if (paidMinor > 0) {
    nextStatus = 'PARTIAL'
  } else if (
    input.dueAt &&
    input.dueAt.getTime() < now.getTime() &&
    input.currentStatus !== 'DRAFT' &&
    input.currentStatus !== 'AWAITING_APPROVAL' &&
    input.currentStatus !== 'APPROVED'
  ) {
    nextStatus = 'OVERDUE'
  } else if (INVOICE_STATUSES.includes(input.currentStatus as InvoiceStatus)) {
    nextStatus = input.currentStatus as InvoiceStatus
  } else {
    nextStatus = 'SENT'
  }

  return { paidAmount, remainingAmount, paidMinor, remainingMinor, nextStatus }
}

// ---------- Official Payment Receipt Gate ----------

export type ReceiptEligibility =
  | { allowed: true; amountMinor: number }
  | { allowed: false; code: 'PAYMENT_NOT_PAID' | 'PAYMENT_UNVERIFIED' | 'INVALID_AMOUNT'; error: string }

export function evaluateReceiptEligibility(payment: {
  status: string
  amount: number
  verifiedAt: Date | null
  verifiedBy: string | null
}): ReceiptEligibility {
  if (!Number.isFinite(payment.amount) || payment.amount <= 0) {
    return { allowed: false, code: 'INVALID_AMOUNT', error: 'Payment amount must be positive.' }
  }
  if (payment.status !== 'PAID') {
    return {
      allowed: false,
      code: 'PAYMENT_NOT_PAID',
      error: `Official receipts cannot be generated for ${payment.status} payments — only settled PAID payments qualify.`,
    }
  }
  if (!payment.verifiedAt || !payment.verifiedBy) {
    return {
      allowed: false,
      code: 'PAYMENT_UNVERIFIED',
      error: 'Official receipts require server-verified settlement (verifiedAt and verifiedBy).',
    }
  }
  return { allowed: true, amountMinor: toMinorUnits(payment.amount) }
}

// ---------- Refund, Cancellation & Dispute Settlement ----------

export function computeNetProjectPaidMinor(input: {
  payments: ReadonlyArray<{ amount: number; status: string; verifiedAt: Date | null }>
  settledRefundsMinor: ReadonlyArray<number>
}): {
  grossVerifiedMinor: number
  refundedMinor: number
  netPaidMinor: number
  netPaidMajor: number
} {
  // Note: when a full payment refund sets Payment.status = 'REFUNDED', its amount
  // is no longer in `status === 'PAID'`. To avoid double-subtracting full refunds,
  // callers pass either ALL originally-verified payments (`PAID` + `REFUNDED` with
  // verifiedAt != null) minus all settled refund amounts!
  const grossVerifiedMinor = input.payments
    .filter((p) => (p.status === 'PAID' || p.status === 'REFUNDED') && p.verifiedAt !== null && Number.isFinite(p.amount) && p.amount > 0)
    .reduce((sum, p) => sum + toMinorUnits(p.amount), 0)
  const refundedMinor = input.settledRefundsMinor
    .filter((n) => Number.isInteger(n) && n > 0)
    .reduce((sum, n) => sum + n, 0)
  const netPaidMinor = Math.max(0, grossVerifiedMinor - refundedMinor)
  return {
    grossVerifiedMinor,
    refundedMinor,
    netPaidMinor,
    netPaidMajor: fromMinorUnits(netPaidMinor),
  }
}

export function evaluateRefundSettlement(input: {
  projectTotalAmount: number
  grossVerifiedMinor: number
  totalSettledRefundsMinor: number
  invoiceTotalMinor?: number | null
  invoicePaidMinorBeforeRefunds?: number
  invoiceRefundedMinor?: number
}): {
  netProjectPaidMinor: number
  netProjectPaidMajor: number
  projectPaymentStatus: 'PAID' | 'PARTIAL' | 'PENDING'
  shouldSuspendHandover: boolean
  nextInvoiceStatus: 'REFUNDED' | 'PARTIALLY_REFUNDED' | null
} {
  const projectTotalMinor = toMinorUnits(Math.max(0, input.projectTotalAmount))
  const netProjectPaidMinor = Math.max(0, input.grossVerifiedMinor - input.totalSettledRefundsMinor)
  const netProjectPaidMajor = fromMinorUnits(netProjectPaidMinor)

  let projectPaymentStatus: 'PAID' | 'PARTIAL' | 'PENDING'
  if (projectTotalMinor > 0 && netProjectPaidMinor >= projectTotalMinor) {
    projectPaymentStatus = 'PAID'
  } else if (netProjectPaidMinor > 0) {
    projectPaymentStatus = 'PARTIAL'
  } else {
    projectPaymentStatus = 'PENDING'
  }

  const shouldSuspendHandover = projectTotalMinor === 0 || netProjectPaidMinor < projectTotalMinor

  let nextInvoiceStatus: 'REFUNDED' | 'PARTIALLY_REFUNDED' | null = null
  if (input.invoiceRefundedMinor && input.invoiceRefundedMinor > 0) {
    const paidBase = input.invoicePaidMinorBeforeRefunds ?? input.invoiceTotalMinor ?? 0
    nextInvoiceStatus = paidBase > 0 && input.invoiceRefundedMinor >= paidBase ? 'REFUNDED' : 'PARTIALLY_REFUNDED'
  }

  return {
    netProjectPaidMinor,
    netProjectPaidMajor,
    projectPaymentStatus,
    shouldSuspendHandover,
    nextInvoiceStatus,
  }
}

// ============================================================
// BACKWARD-COMPATIBLE STRING-AMOUNT PARSER & CURRENCY HELPERS
// ============================================================

export function parseInvoiceAmount(input: unknown): { cents: number; amount: number } | null {
  if (typeof input !== 'string') return null
  const value = input.trim()
  if (!/^\d{1,10}(?:\.\d{1,2})?$/.test(value)) return null

  const [whole = '', fractional = ''] = value.split('.')
  const cents = Number(whole) * 100 + Number(fractional.padEnd(2, '0'))
  if (!Number.isSafeInteger(cents) || cents <= 0 || cents > 999_999_999_999) return null

  return { cents, amount: cents / 100 }
}

export const INVOICE_CURRENCIES = ['USD', 'BDT', 'EUR', 'GBP'] as const
export type InvoiceCurrency = (typeof INVOICE_CURRENCIES)[number]

export function isInvoiceCurrency(input: unknown): input is InvoiceCurrency {
  return typeof input === 'string' && INVOICE_CURRENCIES.includes(input as InvoiceCurrency)
}

