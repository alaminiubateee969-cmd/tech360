export type ProjectClosureInput = {
  totalAmount: number
  paidAmount: number
  taskStatuses: string[]
  deliveryStatus?: string | null
  handoverStatus?: string | null
}

export type ProjectClosureDecision =
  | { allowed: true }
  | { allowed: false; code: 'PAYMENT_INCOMPLETE' | 'TASKS_INCOMPLETE' | 'DELIVERY_NOT_ACCEPTED' | 'HANDOVER_NOT_CONFIRMED' }

/** Final closure requires financial, work, delivery and client-acceptance evidence. */
export function evaluateProjectClosure(input: ProjectClosureInput): ProjectClosureDecision {
  const fullyPaid = input.totalAmount > 0 ? input.paidAmount >= input.totalAmount : input.paidAmount > 0
  if (!fullyPaid) return { allowed: false, code: 'PAYMENT_INCOMPLETE' }
  if (input.taskStatuses.some((status) => status !== 'DONE')) return { allowed: false, code: 'TASKS_INCOMPLETE' }
  if (input.deliveryStatus !== 'CONFIRMED') return { allowed: false, code: 'DELIVERY_NOT_ACCEPTED' }
  if (input.handoverStatus !== 'CONFIRMED') return { allowed: false, code: 'HANDOVER_NOT_CONFIRMED' }
  return { allowed: true }
}
