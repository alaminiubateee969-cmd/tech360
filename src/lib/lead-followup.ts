/**
 * LEAD FOLLOW-UP — persistence
 *
 * `planFirstFollowUp` (in `lead-followup-policy.ts`) is pure. This module only
 * performs the database writes and reuses the existing human-task mechanism,
 * so there is exactly one task implementation in the codebase.
 *
 * Storage: the schedule is written into `Lead.tracking` (an existing JSON
 * column) as `followUp`. No schema migration is required, and the field is
 * additive — existing readers of `Lead.tracking` are unaffected.
 */

import { db } from './db'
import { sanitizeText } from './security'
import { createHumanTask } from './journey'
import type { FollowUpPlan } from './lead-followup-policy'

export { planFirstFollowUp } from './lead-followup-policy'
export type {
  FollowUpChannel,
  FollowUpInput,
  FollowUpPlan,
  FollowUpPriority,
} from './lead-followup-policy'

/**
 * Persist the follow-up schedule and create the CRM task.
 *
 * Fails soft on task creation (the lead must never be rolled back because a
 * notification insert failed) but always returns what actually happened, so
 * the caller can log the truth rather than assume success.
 */
export async function persistLeadFollowUp(input: {
  clientRowId: string
  clientId: string
  plan: FollowUpPlan
  attribution?: { source?: string | null; medium?: string | null; campaign?: string | null }
  isNewClient?: boolean
}): Promise<{ stored: boolean; taskCreated: boolean; taskRef: string | null; error?: string }> {
  const { plan } = input
  const sourceLabel = [input.attribution?.source, input.attribution?.medium].filter(Boolean).join(' / ') || 'direct'

  let stored = false
  try {
    const lead = await db.lead.findUnique({
      where: { clientId: input.clientRowId },
      select: { id: true, tracking: true },
    })
    if (lead) {
      let tracking: Record<string, unknown> = {}
      if (lead.tracking) {
        try {
          const parsed = JSON.parse(lead.tracking)
          if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) tracking = parsed as Record<string, unknown>
        } catch {
          // A malformed column must not block the schedule; the raw value is
          // preserved under a namespaced key instead of being discarded.
          tracking = { legacyTrackingRaw: sanitizeText(lead.tracking, 2000) }
        }
      }
      tracking.followUp = {
        action: plan.action,
        channel: plan.channel,
        priority: plan.priority,
        dueAt: plan.dueAt,
        dueInHours: plan.dueInHours,
        rationale: plan.rationale,
        source: sourceLabel,
        createdAt: new Date().toISOString(),
        status: 'SCHEDULED',
      }
      await db.lead.update({ where: { id: lead.id }, data: { tracking: JSON.stringify(tracking) } })
      stored = true
    }
  } catch (error) {
    return {
      stored: false,
      taskCreated: false,
      taskRef: null,
      error: error instanceof Error ? error.message : 'follow-up schedule could not be stored',
    }
  }

  let taskCreated = false
  let taskRef: string | null = null
  let error: string | undefined
  try {
    taskRef = await createHumanTask({
      clientRowId: input.clientRowId,
      title: `${plan.action} — ${input.clientId}`,
      description: [
        `Follow-up due ${plan.dueAt} (${plan.channel}, ${plan.priority} priority).`,
        `Source: ${sourceLabel}.`,
        `Rationale: ${plan.rationale}`,
        input.isNewClient === false ? 'Returning client record.' : 'New client record created at intake.',
      ].join(' '),
      link: 'clients',
      priority: plan.priority,
    })
    taskCreated = true
  } catch (err) {
    error = err instanceof Error ? err.message : 'CRM task could not be created'
  }

  return { stored, taskCreated, taskRef, error }
}
