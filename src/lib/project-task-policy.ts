export type ProjectTaskStatus = 'TODO' | 'IN_PROGRESS' | 'REVIEW' | 'DONE' | 'BLOCKED'

export function canQueueAgentDraft(input: {
  assigneeType: string
  status: string
  linkedJobStatus?: string | null
}): boolean {
  if (input.assigneeType !== 'AGENT' || !['TODO', 'BLOCKED'].includes(input.status)) return false
  return !input.linkedJobStatus || ['FAILED', 'TIMED_OUT', 'CANCELLED'].includes(input.linkedJobStatus)
}

export function canHumanAcceptAgentDraft(input: {
  assigneeType: string
  taskStatus: string
  jobStatus?: string | null
}): boolean {
  return input.assigneeType === 'AGENT' && input.taskStatus === 'REVIEW' && input.jobStatus === 'COMPLETED'
}

export function statusAfterAgentJob(status: string, retryScheduled: boolean): ProjectTaskStatus | null {
  if (status === 'COMPLETED') return 'REVIEW'
  if (retryScheduled) return 'IN_PROGRESS'
  if (['FAILED', 'TIMED_OUT', 'CANCELLED'].includes(status)) return 'BLOCKED'
  return null
}
