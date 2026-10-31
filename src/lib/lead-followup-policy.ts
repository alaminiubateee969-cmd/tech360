/**
 * LEAD FOLLOW-UP POLICY (pure)
 *
 * No database, no network, no Node built-ins — so the decision logic can be
 * unit-tested in isolation and reasoned about during review.
 *
 * Storage note: the schedule itself is written into `Lead.tracking` (an
 * existing JSON column) by `persistLeadFollowUp`, so no schema migration is
 * required.
 */

export type FollowUpChannel = 'CALL' | 'WHATSAPP' | 'EMAIL' | 'SMS'
export type FollowUpPriority = 'LOW' | 'MEDIUM' | 'HIGH'

export interface FollowUpPlan {
  /** Short instruction for the assigned human. */
  action: string
  channel: FollowUpChannel
  priority: FollowUpPriority
  dueInHours: number
  /** ISO timestamp, computed from the supplied `now`. */
  dueAt: string
  /** Why this plan was chosen — stored so the decision is auditable. */
  rationale: string
}

export interface FollowUpInput {
  source: string
  businessType?: string | null
  projectType?: string | null
  budgetRange?: string | null
  preferredContact?: string | null
  hasEmail?: boolean
  hasWhatsapp?: boolean
  hasPhone?: boolean
  now?: Date
}

const HOUR_MS = 60 * 60 * 1000

/** Minimal, dependency-free text cleaner (mirror of lib/security sanitizeText). */
function clean(input: unknown, maxLength: number): string {
  if (typeof input !== 'string') return ''
  return input
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .trim()
    .slice(0, maxLength)
}

/**
 * Deterministic first-follow-up policy.
 *
 * Ordering of rules matters and is asserted by tests:
 *  1. A lead with stated project type AND budget is commercially hot → 4h, HIGH.
 *  2. A lead with a stated project type → 12h, HIGH.
 *  3. A lead with only a business type → 24h, MEDIUM.
 *  4. Everything else → 2h, HIGH (the first response is the one that matters).
 */
export function planFirstFollowUp(input: FollowUpInput): FollowUpPlan {
  const now = input.now ?? new Date()
  const preferred = clean(input.preferredContact ?? '', 40).toLowerCase()
  const channel: FollowUpChannel =
    preferred === 'whatsapp' && input.hasWhatsapp
      ? 'WHATSAPP'
      : preferred === 'email' && input.hasEmail
        ? 'EMAIL'
        : preferred === 'sms' && input.hasPhone
          ? 'SMS'
          : preferred === 'phone' && input.hasPhone
            ? 'CALL'
            : input.hasWhatsapp
              ? 'WHATSAPP'
              : input.hasPhone
                ? 'CALL'
                : 'EMAIL'

  const hasProjectType = Boolean(clean(input.projectType ?? '', 120))
  const hasBudget = Boolean(clean(input.budgetRange ?? '', 80))
  const hasBusinessType = Boolean(clean(input.businessType ?? '', 80))

  let dueInHours: number
  let priority: FollowUpPriority
  let action: string
  let rationale: string

  if (hasProjectType && hasBudget) {
    dueInHours = 4
    priority = 'HIGH'
    action = 'Call the decision maker to confirm scope, budget band and launch date'
    rationale = 'Project type and budget band were supplied on the enquiry.'
  } else if (hasProjectType) {
    dueInHours = 12
    priority = 'HIGH'
    action = 'Confirm required modules and send the scope question set'
    rationale = 'Project type was supplied; budget band is still unknown.'
  } else if (hasBusinessType) {
    dueInHours = 24
    priority = 'MEDIUM'
    action = 'Qualify the requirement and recommend a plan for this business type'
    rationale = 'Business type was supplied but the project requirement is not yet clear.'
  } else {
    dueInHours = 2
    priority = 'HIGH'
    action = 'Reply with the Client ID and ask the six intake questions'
    rationale = 'No business or project detail yet; the first reply is time-critical.'
  }

  return {
    action,
    channel,
    priority,
    dueInHours,
    dueAt: new Date(now.getTime() + dueInHours * HOUR_MS).toISOString(),
    rationale,
  }
}
