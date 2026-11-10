// ============================================================
// TECH360 — Payment Verification Lifecycle & Screenshot Evidence Policy
//
// Core Business Policy:
//   HTML Preview Before Payment. Source Code After Verified Full Payment.
//
// Canonical Stage-8 Payment Statuses:
//   - PENDING            -> "Payment Pending"
//   - SUBMITTED          -> "Payment Submitted"
//   - UNDER_VERIFICATION -> "Payment Under Verification"
//   - PAID               -> "Payment Verified" (ONLY with verifiedAt + verifiedBy)
//   - FAILED             -> "Payment Failed"
//   - PARTIAL            -> "Partially Paid"
//   - REFUNDED           -> "Payment Refunded"
//   - CANCELLED          -> "Payment Cancelled"
//
// Non-negotiable invariants:
//   1. Client-provided screenshots / transaction references are recorded as
//      EVIDENCE FOR REVIEW (`SUBMITTED` / `UNDER_VERIFICATION`), NEVER proof
//      of cleared payment.
//   2. Only `PAID` with server-verified `verifiedAt` and `verifiedBy`
//      (recorded via governed `verifyPayment()`) counts as `Payment Verified`
//      and unlocks project settlement, official receipts, or source-code release.
//   3. Status review helpers can transition unverified rows between
//      `PENDING`, `SUBMITTED`, `UNDER_VERIFICATION`, and `FAILED`, but can
//      NEVER set `PAID` directly (bypassing `verifyPayment()` is forbidden).
// ============================================================

export const PAYMENT_DB_STATUSES = [
  'PENDING',
  'SUBMITTED',
  'UNDER_VERIFICATION',
  'PARTIAL',
  'PAID',
  'FAILED',
  'REFUNDED',
  'CANCELLED',
] as const

export type PaymentDbStatus = (typeof PAYMENT_DB_STATUSES)[number]

export type PaymentLifecycleLabel =
  | 'Payment Pending'
  | 'Payment Submitted'
  | 'Payment Under Verification'
  | 'Payment Verified'
  | 'Payment Failed'
  | 'Partially Paid'
  | 'Payment Refunded'
  | 'Payment Cancelled'

export interface PaymentVerificationSlice {
  status: string
  amount: number
  verifiedAt?: Date | string | null
  verifiedBy?: string | null
  proofFileId?: string | null
  transactionId?: string | null
}

/**
 * Map a persisted Payment row to its canonical customer/operator lifecycle label.
 * Fails closed: if a row has status `PAID` without `verifiedAt` + `verifiedBy`,
 * it is reported as `Payment Under Verification`, never `Payment Verified`.
 */
export function formatPaymentLifecycleStatus(payment: Pick<PaymentVerificationSlice, 'status' | 'verifiedAt' | 'verifiedBy'>): PaymentLifecycleLabel {
  const status = (payment.status || 'PENDING').trim().toUpperCase()
  switch (status) {
    case 'PENDING':
      return 'Payment Pending'
    case 'SUBMITTED':
      return 'Payment Submitted'
    case 'UNDER_VERIFICATION':
      return 'Payment Under Verification'
    case 'PAID':
      return payment.verifiedAt && payment.verifiedBy
        ? 'Payment Verified'
        : 'Payment Under Verification'
    case 'FAILED':
      return 'Payment Failed'
    case 'PARTIAL':
      return 'Partially Paid'
    case 'REFUNDED':
      return 'Payment Refunded'
    case 'CANCELLED':
      return 'Payment Cancelled'
    default:
      return 'Payment Pending'
  }
}

/**
 * True ONLY when a payment has cleared governance verification.
 * Screenshots (`proofFileId`), transaction claims (`SUBMITTED`), and in-review
 * payments (`UNDER_VERIFICATION`) always return `false`.
 */
export function isPaymentVerified(payment: Pick<PaymentVerificationSlice, 'status' | 'amount' | 'verifiedAt' | 'verifiedBy'>): boolean {
  return (
    payment.status === 'PAID' &&
    Boolean(payment.verifiedAt) &&
    Boolean(payment.verifiedBy) &&
    Number.isFinite(payment.amount) &&
    payment.amount > 0
  )
}

/**
 * Source-code release gate: requires total verified cleared payments (minus any
 * settled refunds) to cover the full project contract value.
 */
export function isPaymentClearedForSourceRelease(input: {
  projectTotalAmount: number
  payments: ReadonlyArray<Pick<PaymentVerificationSlice, 'status' | 'amount' | 'verifiedAt' | 'verifiedBy'>>
  settledRefundsTotal?: number
}): { cleared: boolean; verifiedPaidAmount: number; requiredAmount: number; reason?: string } {
  const verifiedPaid = input.payments
    .filter((p) => isPaymentVerified(p))
    .reduce((sum, p) => sum + p.amount, 0)
  const netVerified = Math.max(0, Number((verifiedPaid - (input.settledRefundsTotal ?? 0)).toFixed(2)))
  const required = Math.max(0, input.projectTotalAmount)

  if (required > 0 ? netVerified < required : netVerified <= 0) {
    const hasUnverifiedSubmission = input.payments.some((p) =>
      ['SUBMITTED', 'UNDER_VERIFICATION', 'PENDING'].includes(p.status),
    )
    return {
      cleared: false,
      verifiedPaidAmount: netVerified,
      requiredAmount: required,
      reason: hasUnverifiedSubmission
        ? `Submitted payment evidence or pending payments do not unlock source code. Verified cleared amount: ${netVerified} of ${required}.`
        : `Full verified payment required before source-code release. Verified cleared amount: ${netVerified} of ${required}.`,
    }
  }

  return {
    cleared: true,
    verifiedPaidAmount: netVerified,
    requiredAmount: required,
  }
}

export type PaymentReviewAction = 'SUBMIT_EVIDENCE' | 'START_VERIFICATION' | 'MARK_FAILED'

export type PaymentReviewValidation =
  | {
      ok: true
      nextStatus: 'SUBMITTED' | 'UNDER_VERIFICATION' | 'FAILED'
      lifecycleLabel: PaymentLifecycleLabel
      evidenceNotice: string | null
    }
  | {
      ok: false
      code:
        | 'DIRECT_VERIFY_FORBIDDEN'
        | 'ALREADY_SETTLED'
        | 'INVALID_TRANSITION'
        | 'EVIDENCE_REQUIRED'
        | 'FAILURE_REASON_REQUIRED'
      error: string
      status: number
    }

const ALLOWED_REVIEW_FROM: Record<PaymentReviewAction, ReadonlySet<string>> = {
  SUBMIT_EVIDENCE: new Set(['PENDING', 'FAILED', 'SUBMITTED']),
  START_VERIFICATION: new Set(['PENDING', 'SUBMITTED', 'UNDER_VERIFICATION']),
  MARK_FAILED: new Set(['PENDING', 'SUBMITTED', 'UNDER_VERIFICATION']),
}

/**
 * Validate non-settlement review transitions on a Payment row.
 * Direct transition to `PAID` is unconditionally rejected so all settlements
 * pass through `verifyPayment()` + Super Admin governance.
 */
export function validatePaymentReviewTransition(input: {
  currentStatus: string
  requestedAction: string
  proofFileId?: string | null
  transactionId?: string | null
  note?: string | null
}): PaymentReviewValidation {
  const current = (input.currentStatus || 'PENDING').trim().toUpperCase()
  const actionRaw = (input.requestedAction || '').trim().toUpperCase()

  if (actionRaw === 'PAID' || actionRaw === 'VERIFY' || actionRaw === 'PAYMENT_VERIFIED') {
    return {
      ok: false,
      code: 'DIRECT_VERIFY_FORBIDDEN',
      error: 'Payment Verified cannot be set via status update. Use governed /api/admin/payments/verify with Super Admin approval.',
      status: 403,
    }
  }

  if (['PAID', 'REFUNDED', 'CANCELLED'].includes(current)) {
    return {
      ok: false,
      code: 'ALREADY_SETTLED',
      error: `Cannot alter review status of a ${current.toLowerCase()} payment.`,
      status: 409,
    }
  }

  const normalizedAction: PaymentReviewAction | null =
    actionRaw === 'SUBMIT_EVIDENCE' || actionRaw === 'SUBMITTED'
      ? 'SUBMIT_EVIDENCE'
      : actionRaw === 'START_VERIFICATION' || actionRaw === 'UNDER_VERIFICATION'
        ? 'START_VERIFICATION'
        : actionRaw === 'MARK_FAILED' || actionRaw === 'FAILED'
          ? 'MARK_FAILED'
          : null

  if (!normalizedAction || !ALLOWED_REVIEW_FROM[normalizedAction].has(current)) {
    return {
      ok: false,
      code: 'INVALID_TRANSITION',
      error: `Unsupported payment review transition "${input.requestedAction}" from ${current}.`,
      status: 400,
    }
  }

  if (normalizedAction === 'SUBMIT_EVIDENCE') {
    const hasEvidence = Boolean(
      (input.proofFileId && input.proofFileId.trim()) ||
      (input.transactionId && input.transactionId.trim()) ||
      (input.note && input.note.trim().length >= 4),
    )
    if (!hasEvidence) {
      return {
        ok: false,
        code: 'EVIDENCE_REQUIRED',
        error: 'Supply a screenshot file ID, transaction reference, or evidence note when marking Payment Submitted.',
        status: 400,
      }
    }
    return {
      ok: true,
      nextStatus: 'SUBMITTED',
      lifecycleLabel: 'Payment Submitted',
      evidenceNotice: 'Client-provided screenshot or reference recorded as evidence for review — not proof of cleared payment.',
    }
  }

  if (normalizedAction === 'START_VERIFICATION') {
    return {
      ok: true,
      nextStatus: 'UNDER_VERIFICATION',
      lifecycleLabel: 'Payment Under Verification',
      evidenceNotice: 'Payment is under finance/Super Admin verification. Source code remains locked until Payment Verified.',
    }
  }

  const reason = (input.note ?? '').trim()
  if (reason.length < 5) {
    return {
      ok: false,
      code: 'FAILURE_REASON_REQUIRED',
      error: 'Provide a verification failure reason (at least 5 characters) when marking Payment Failed.',
      status: 400,
    }
  }

  return {
    ok: true,
    nextStatus: 'FAILED',
    lifecycleLabel: 'Payment Failed',
    evidenceNotice: null,
  }
}

/** Convenience helper accepting either a Payment slice or a status string. */
export function paymentStatusLabel(
  paymentOrStatus: Pick<PaymentVerificationSlice, 'status' | 'verifiedAt' | 'verifiedBy'> | string,
): PaymentLifecycleLabel {
  if (typeof paymentOrStatus === 'string') {
    const upper = paymentOrStatus.trim().toUpperCase()
    if (upper === 'PAID') return 'Payment Verified'
    return formatPaymentLifecycleStatus({ status: upper, verifiedAt: null, verifiedBy: null })
  }
  return formatPaymentLifecycleStatus(paymentOrStatus)
}

/** Validate client-submitted payment proof (screenshot / transaction reference) as evidence-only (`SUBMITTED`, never `PAID`). */
export function evaluateClientPaymentProofSubmission(input: {
  hasProofFile: boolean
  transactionId?: string | null
  method?: string | null
}):
  | { ok: true; status: 'SUBMITTED'; evidenceOnly: true; notice: string }
  | { ok: false; code: 'EVIDENCE_REQUIRED'; error: string } {
  const txRef = (input.transactionId ?? '').trim()
  if (!input.hasProofFile && txRef.length < 3) {
    return {
      ok: false,
      code: 'EVIDENCE_REQUIRED',
      error: 'Upload a payment screenshot or provide a valid transaction reference.',
    }
  }
  return {
    ok: true,
    status: 'SUBMITTED',
    evidenceOnly: true,
    notice:
      'Payment evidence recorded as Payment Submitted (evidence only). Our finance team will reconcile settlement before marking Payment Verified.',
  }
}

/** Operator status-review transition helper (accepts `targetStatus` + optional `reason`). */
export function validatePaymentLifecycleTransition(input: {
  currentStatus: string
  targetStatus: string
  proofFileId?: string | null
  transactionId?: string | null
  reason?: string | null
}):
  | { ok: true; nextStatus: 'SUBMITTED' | 'UNDER_VERIFICATION' | 'FAILED'; lifecycleLabel: PaymentLifecycleLabel }
  | { ok: false; code: string; error: string; status: number } {
  const res = validatePaymentReviewTransition({
    currentStatus: input.currentStatus,
    requestedAction: input.targetStatus,
    proofFileId: input.proofFileId,
    transactionId: input.transactionId,
    note: input.reason ?? 'Operator status update',
  })
  if (!res.ok) return res
  return { ok: true, nextStatus: res.nextStatus, lifecycleLabel: res.lifecycleLabel }
}

/** Detect whether revision notes introduce out-of-scope commercial additions requiring elevated approval. */
export function detectOutOfScopeRevisionSignals(notes: string): {
  outOfScopeLikely: boolean
  flagged: boolean
  signals: string[]
} {
  if (!notes || !notes.trim()) return { outOfScopeLikely: false, flagged: false, signals: [] }
  const checks: Array<{ label: string; pattern: RegExp }> = [
    { label: 'new mobile app deliverable', pattern: /\b(?:ios|android|mobile\s+app|flutter|react\s+native)\b/i },
    { label: 'additional module or system', pattern: /\b(?:add\s+(?:a\s+)?new\s+module|extra\s+module|additional\s+(?:module|portal|dashboard|system)|also\s+build)\b/i },
    { label: 'new third-party integration', pattern: /\b(?:integrate\s+with|new\s+api|erp\s+integration|sap|salesforce|custom\s+payment\s+gateway|whatsapp\s+bot)\b/i },
    { label: 'commercial/pricing change', pattern: /\b(?:change\s+(?:the\s+)?(?:price|budget|fee|milestone)|discount|reduce\s+cost|extra\s+feature)\b/i },
  ]
  const signals = checks.filter((c) => c.pattern.test(notes)).map((c) => c.label)
  const flagged = signals.length > 0
  return {
    outOfScopeLikely: flagged,
    flagged,
    signals,
  }
}
