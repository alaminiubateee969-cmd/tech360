import { toMinorUnits } from '@/lib/invoice-policy'

/** Recompute release eligibility from verified records, not cached project totals. */
export function sourcePaymentEvidence(input: {
  totalAmount: number
  currency: string
  payments: ReadonlyArray<{ amount: number; currency: string; status: string; verifiedAt: Date | null; verifiedBy: string | null }>
  refunds: ReadonlyArray<{ approvedAmountMinor: number; currency: string; settledAt: Date | null; status: string }>
}): { cleared: boolean; netPaid: number } {
  if (!Number.isFinite(input.totalAmount) || input.totalAmount <= 0) return { cleared: false, netPaid: 0 }
  const totalMinor = toMinorUnits(input.totalAmount)
  if (!Number.isSafeInteger(totalMinor) || totalMinor <= 0) return { cleared: false, netPaid: 0 }
  const currency = input.currency.toUpperCase()
  // A case may be CLOSED after a refund; do not lose its settlement merely
  // because its workflow status changed. Zero-amount dispute closures are not refunds.
  const settled = input.refunds.filter((r) => r.settledAt && r.approvedAmountMinor !== 0)
  // No exchange rate or ambiguous refund interpretation is assumed.
  if (settled.some((r) => r.currency.toUpperCase() !== currency || !Number.isSafeInteger(r.approvedAmountMinor) || r.approvedAmountMinor <= 0)) {
    return { cleared: false, netPaid: 0 }
  }
  const gross = input.payments
    // Exclude fully REFUNDED payments even if their refund case is missing.
    // Subtracting their cases too may conservatively undercount; never over-release.
    .filter((p) => p.status === 'PAID' && p.verifiedAt && p.verifiedBy?.trim() && p.currency.toUpperCase() === currency && Number.isFinite(p.amount) && p.amount > 0)
    .reduce((sum, p) => sum + toMinorUnits(p.amount), 0)
  const refunded = settled.reduce((sum, r) => sum + r.approvedAmountMinor, 0)
  if (!Number.isSafeInteger(gross) || !Number.isSafeInteger(refunded)) return { cleared: false, netPaid: 0 }
  const net = Math.max(0, gross - refunded)
  return { cleared: net >= totalMinor, netPaid: net / 100 }
}
