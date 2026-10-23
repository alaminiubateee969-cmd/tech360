import { PIPELINE_STAGES } from '@/lib/constants'

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

/**
 * Terminal preview states (`APPROVED`, `REVISION_REQUESTED`, `EXPIRED`) are
 * locked against repeat or conflicting client decisions.
 */
export function canDecidePreview(currentStatus: string): boolean {
  return currentStatus === 'GENERATED' || currentStatus === 'SENT' || currentStatus === 'VIEWED'
}

/**
 * Forward-only pipeline progression helper: returns `targetStage` only when the
 * client has not already advanced beyond `targetStage`.
 */
export function forwardPipelineStage(currentStage: string, targetStage: string): string {
  const stages = PIPELINE_STAGES as readonly string[]
  const currentIdx = stages.indexOf(currentStage)
  const targetIdx = stages.indexOf(targetStage)
  if (targetIdx === -1) return currentStage
  if (currentIdx === -1) return targetStage
  return currentIdx >= targetIdx ? currentStage : targetStage
}
