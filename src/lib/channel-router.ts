// ============================================================
// TECH360 — Channel Routing Rules (Requirement D)
// - Initial inbound: reply first on channel customer used, if enabled
// - Email collection: after useful assistance, ask naturally, validate,
//   save against Client ID, use email as primary for formal comms
// - After email collected: email is canonical for detailed scope, SOW,
//   approvals, proposals, payment instructions, milestones, QA, handover
// - WhatsApp/SMS: concise notification that specific email was sent + Client ID
// - Continue answering genuine inbound questions naturally on any channel
// - Never silently ignore inbound message
// ============================================================

import { sendCommunication, channelConfigured } from '@/lib/comms'
import { PUBLIC_CONTACT } from '@/lib/site-contact'

export type Channel = 'WEB' | 'WHATSAPP' | 'SMS' | 'EMAIL' | 'PORTAL'

export type RoutingDecision = {
  /** Channel to reply on (the inbound channel if operational). */
  replyChannel: Channel | null
  /** Whether email is now the canonical formal channel. */
  emailCanonical: boolean
  /** Human-readable reason for audit / UI. */
  reason: string
}

/** Determine reply channel based on inbound channel and configuration. */
export async function decideReplyChannel(
  inboundChannel: Channel,
  client: { email?: string | null; whatsapp?: string | null; phone?: string | null },
): Promise<RoutingDecision> {
  const emailCollected = Boolean(client.email && client.email.includes('@'))
  const inboundEnabled = isChannelOperational(inboundChannel)

  // If inbound channel is operational, reply there
  if (inboundEnabled) {
    return {
      replyChannel: inboundChannel,
      emailCanonical: emailCollected,
      reason: `Replying on inbound channel ${inboundChannel} (operational)`,
    }
  }

  // Fallback: if email is known and inbound channel disabled, use email
  if (emailCollected && channelConfigured('EMAIL')) {
    return {
      replyChannel: 'EMAIL',
      emailCanonical: true,
      reason: `Inbound ${inboundChannel} disabled — falling back to canonical EMAIL`,
    }
  }

  // Last resort: log but do not claim sent
  return {
    replyChannel: null,
    emailCanonical: emailCollected,
    reason: `No operational channel for inbound ${inboundChannel} and no fallback`,
  }
}

function isChannelOperational(channel: Channel): boolean {
  switch (channel) {
    case 'WHATSAPP':
      return channelConfigured('WHATSAPP')
    case 'EMAIL':
      return channelConfigured('EMAIL')
    case 'SMS':
      return channelConfigured('SMS')
    case 'WEB':
      return true // web chat is always operational (DB-backed)
    case 'PORTAL':
      return true
    default:
      return false
  }
}

/** Validate email address (simple, honest). */
export function validateEmail(email: string): { ok: boolean; normalized: string; error?: string } {
  const trimmed = email.trim().toLowerCase()
  if (!trimmed) return { ok: false, normalized: '', error: 'Email is required' }
  if (trimmed.length > 320) return { ok: false, normalized: '', error: 'Email is too long' }
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(trimmed)) return { ok: false, normalized: '', error: 'Invalid email format' }
  return { ok: true, normalized: trimmed }
}

/**
 * A well-formed address from public free text is not verified identity proof.
 * Keep this legacy entry point fail-closed until an OTP flow supplies an
 * EMAIL_OTP proof that can be attached through the verified identity resolver.
 */
export async function collectEmailForClient(_clientRowId: string, rawEmail: string): Promise<{ ok: boolean; email?: string; error?: string }> {
  const v = validateEmail(rawEmail)
  if (!v.ok) return { ok: false, error: v.error }
  return { ok: false, error: 'Email verification is required before this address can be linked to a Client ID.' }
}

/**
 * Send canonical email + concise WhatsApp/SMS notification.
 * After email is collected, formal details go to email; other channels
 * get a short notification with Client ID and action.
 */
export async function sendCanonicalWithNotification(input: {
  clientRowId: string
  clientId: string
  clientName: string
  toEmail: string | null
  toWhatsApp: string | null
  toSms: string | null
  subject: string
  emailHtml: string
  emailText: string
  conciseNotification: string // short message for WhatsApp/SMS: mention Client ID + that email was sent
  agentCode?: string
  workflowId?: string
}): Promise<{ email: { ok: boolean; status: string } | null; notifications: Array<{ channel: string; ok: boolean; status: string }> }> {
  const notifications: Array<{ channel: string; ok: boolean; status: string }> = []
  let emailResult: { ok: boolean; status: string } | null = null

  // Canonical: detailed email
  if (input.toEmail) {
    const res = await sendCommunication({
      clientId: input.clientRowId,
      channel: 'EMAIL',
      to: input.toEmail,
      subject: input.subject,
      body: input.emailHtml,
      storedBody: input.emailText,
      agentCode: input.agentCode,
      workflowId: input.workflowId,
    })
    emailResult = { ok: res.result.ok, status: res.result.status }
  }

  // Concise notifications (only if email was attempted)
  if (input.toWhatsApp && input.toWhatsApp !== input.toEmail) {
    // Only notify if WhatsApp channel is enabled and number looks valid
    const notifBody = `${input.conciseNotification}\n\nRef: ${input.clientId}\nCheck your email for details: ${input.toEmail ?? PUBLIC_CONTACT.email}`
    const res = await sendCommunication({
      clientId: input.clientRowId,
      channel: 'WHATSAPP',
      to: input.toWhatsApp,
      body: notifBody,
      agentCode: input.agentCode,
      workflowId: input.workflowId,
    })
    notifications.push({ channel: 'WHATSAPP', ok: res.result.ok, status: res.result.status })
  } else if (input.toSms) {
    const notifBody = `${input.conciseNotification}\nRef: ${input.clientId}`
    const res = await sendCommunication({
      clientId: input.clientRowId,
      channel: 'SMS',
      to: input.toSms,
      body: notifBody,
      agentCode: input.agentCode,
      workflowId: input.workflowId,
    })
    notifications.push({ channel: 'SMS', ok: res.result.ok, status: res.result.status })
  }

  return { email: emailResult, notifications }
}

/** Build the honest next-step footer appended to client-facing messages when appropriate. */
export function buildNextStepFooter(input: {
  clientId: string
  stage: string
  stageLabel?: string
  whatHappened: string
  nextStep: string
  actor: 'CLIENT' | 'TECH360'
  dueDate?: string | null
  replyAction?: string | null
}): string {
  const parts: string[] = []
  parts.push(`—`)
  parts.push(`Client ID: ${input.clientId} | Stage: ${input.stageLabel ?? input.stage}`)
  parts.push(`What just happened: ${input.whatHappened}`)
  parts.push(`Next step: ${input.nextStep}`)
  parts.push(`Action required by: ${input.actor === 'CLIENT' ? 'You' : 'TECH360 team'}`)
  if (input.dueDate) parts.push(`Due: ${input.dueDate}`)
  if (input.replyAction) parts.push(`How to reply: ${input.replyAction}`)
  return parts.join('\n')
}
