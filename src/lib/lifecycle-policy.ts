export type DeliveryAcceptanceAnswers = {
  received: boolean
  working: boolean
}

export type DeliveryAcceptanceDecision =
  | { accepted: true; status: 'CONFIRMED' }
  | { accepted: false; status: 'PARTIAL'; code: 'NOT_RECEIVED' | 'NOT_WORKING' | 'BOTH' }

/** Do not record acceptance unless the client explicitly confirms receipt and function. */
export function evaluateDeliveryAcceptance(answers: DeliveryAcceptanceAnswers): DeliveryAcceptanceDecision {
  if (answers.received && answers.working) return { accepted: true, status: 'CONFIRMED' }
  if (!answers.received && !answers.working) return { accepted: false, status: 'PARTIAL', code: 'BOTH' }
  return { accepted: false, status: 'PARTIAL', code: answers.received ? 'NOT_WORKING' : 'NOT_RECEIVED' }
}

export type ProjectClosureInput = {
  totalAmount: number
  paidAmount: number
  taskStatuses: string[]
  deliveryStatus?: string | null
  deliveryAnswers?: DeliveryAcceptanceAnswers | null
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
  if (input.deliveryStatus !== 'CONFIRMED' || !input.deliveryAnswers || !evaluateDeliveryAcceptance(input.deliveryAnswers).accepted) {
    return { allowed: false, code: 'DELIVERY_NOT_ACCEPTED' }
  }
  if (input.handoverStatus !== 'CONFIRMED') return { allowed: false, code: 'HANDOVER_NOT_CONFIRMED' }
  return { allowed: true }
}
