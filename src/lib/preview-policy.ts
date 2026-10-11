export type PreviewDeliveryAttempt = {
  channel: string
  status: string
  ok: boolean
}

/**
 * A preview is marked SENT only when a configured provider accepted at least
 * one channel dispatch. Generated links and logged attempts are not delivery.
 */
export function hasAcceptedPreviewDelivery(attempts: readonly PreviewDeliveryAttempt[]): boolean {
  return attempts.some((attempt) => attempt.ok && attempt.status === 'SENT')
}
