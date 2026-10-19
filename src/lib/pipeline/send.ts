// ============================================================
// TECH360 — the pipeline sender.
//
// One place that turns a pipeline stage into real, saved client
// messages. It enforces the three rules from the specification:
//
//   1. AUTO-SEND vs ADMIN APPROVAL — a gated message is never
//      sent; an approval request is raised instead and the
//      message is composed, saved and queued.
//   2. NO PHONE NUMBER IN AI CONTENT — every body is screened
//      before it is sent; a number is redacted and reported.
//   3. ALWAYS SAVE — the outbound body is written to the CRM
//      (Communication rows) whether or not a provider accepted it.
//
// The existing `sendCommunication()` in @/lib/comms performs the
// actual dispatch and already writes a Communication row per
// message, so this module never sends anything that is not saved.
// ============================================================

import { db } from '@/lib/db'
import { sendCommunication } from '@/lib/comms'
import { audit, logError } from '@/lib/security'
import { pipelineMessage, renderEmailBody, type PipelineMessage, type PipelineMessageStage, type PipelineVariables } from './templates'
import {
  assertNoSensitiveFilesInPublicContent,
  classifyContentCategory,
  effectiveGate,
  gateReason,
  screenAiContent,
  type AdminApprovalCategory,
  type MessageGate,
} from './rules'

export type PipelineChannel = 'WHATSAPP' | 'SMS' | 'EMAIL'

/**
 * The agent that owns each channel.
 *
 * These are the existing catalogue codes — the WhatsApp agent, the SMS
 * agent and the email agent — so a pipeline message is attributed to
 * the agent that owns its channel, exactly as the pre-pipeline code
 * did.
 */
export const PIPELINE_AGENT_BY_CHANNEL: Record<PipelineChannel, string> = {
  WHATSAPP: 'WAP-011',
  SMS: 'SMS-013',
  EMAIL: 'EML-012',
}

export type PipelineDelivery = {
  channel: PipelineChannel | 'WEB'
  status: string
  ok: boolean
  communicationId: string | null
  /** Phone numbers that were found in the body and removed. */
  redacted: string[]
  error?: string
}

export type PipelineSendResult = {
  status: 'SENT' | 'PARTIAL' | 'AWAITING_APPROVAL' | 'NO_CHANNEL'
  gate: MessageGate
  /** Why the message was gated (or why it may be sent). */
  gateReason: string
  approvalId: string | null
  deliveries: PipelineDelivery[]
  messages: { whatsapp: PipelineMessage; email: PipelineMessage }
  /** The client ID the messages were saved under. */
  clientId: string
}

export type PipelineSendRequest = {
  clientRowId: string
  stage: PipelineMessageStage
  variables: PipelineVariables
  /** Restrict the channels. Defaults to every channel the client can receive. */
  channels?: PipelineChannel[]
  agentCode?: string
  workflowId?: string
  approvalId?: string
  /** A non-stage approval category (invoice, refund, dispute…). */
  category?: AdminApprovalCategory
  /**
   * Set ONLY by the approval execution path. When true the gate is
   * satisfied and the message is sent.
   */
  approved?: boolean
}

// ------------------------------------------------------------
// Channel selection
// ------------------------------------------------------------

type ClientContact = {
  id: string
  clientId: string
  name: string
  email: string | null
  phone: string | null
  whatsapp: string | null
  source: string
  preferredContact: string | null
}

/**
 * The channels this client may receive.
 *
 * WhatsApp and email follow the contact details on the client row.
 * SMS is only used when the client actually came from (or asked
 * for) a phone/SMS channel — the platform never silently changes
 * the channel a client chose.
 */
export function resolveChannels(client: ClientContact, requested?: PipelineChannel[]): PipelineChannel[] {
  const available: PipelineChannel[] = []
  if (client.whatsapp) available.push('WHATSAPP')
  if (client.email) available.push('EMAIL')
  const wantsSms = /SMS|PHONE|CALL/i.test(client.source ?? '') || (client.preferredContact ?? '').toUpperCase() === 'SMS'
  if (client.phone && wantsSms) available.push('SMS')
  if (!requested || requested.length === 0) return available
  return requested.filter((channel) => available.includes(channel))
}

// ------------------------------------------------------------
// The sender
// ------------------------------------------------------------

export async function sendPipelineMessage(request: PipelineSendRequest): Promise<PipelineSendResult> {
  const client = await db.client.findUnique({ where: { id: request.clientRowId } })
  if (!client) throw new Error('Client not found')

  const composed = pipelineMessage(request.stage, request.variables)
  const messages = {
    whatsapp: composed.whatsapp,
    email: composed.email,
  }

  // ---- RULE 2 — screen the AI content for phone numbers ----
  const redactedAll: string[] = []
  for (const message of [messages.whatsapp, messages.email]) {
    const screened = screenAiContent(message.body)
    if (screened.redacted.length > 0) {
      redactedAll.push(...screened.redacted)
      message.body = screened.text
    }
    // A public AI message must never carry a file link.
    assertNoSensitiveFilesInPublicContent(message.body)
  }
  // The email HTML is rendered from the (already screened) plain body, so
  // the two can never drift and a redacted number cannot survive in the
  // markup.
  messages.email.html = renderEmailBody(messages.email.body)
  if (redactedAll.length > 0) {
    await logError({
      source: 'PIPELINE',
      code: 'PHONE_NUMBER_IN_AI_CONTENT',
      message: `Phone number(s) removed from the ${request.stage} message before sending.`,
      clientId: client.clientId,
      workflow: 'PIPELINE_MESSAGE',
    }).catch(() => null)
    await audit({
      actor: 'system',
      action: 'PHONE_NUMBER_REDACTED_FROM_AI_CONTENT',
      clientId: client.clientId,
      details: { stage: request.stage, redacted: redactedAll },
    }).catch(() => null)
  }

  // ---- RULE 1 — the gate ----
  const gate = effectiveGate(request.stage, messages.whatsapp.body, request.category)
  const reason = gateReason(request.stage, messages.whatsapp.body, request.category)
  if (gate === 'ADMIN_APPROVAL_REQUIRED' && !request.approved) {
    const approval = await db.approvalRequest.create({
      data: {
        type: 'PIPELINE_MESSAGE',
        title: `Approve ${request.stage} message for ${client.clientId} (${client.name})`,
        description:
          `The AI prepared a client message that the communication policy requires an admin to approve before it is sent. Reason: ${reason}.`,
        clientId: client.id,
        agentCode: request.agentCode ?? null,
        payload: JSON.stringify({
          stage: request.stage,
          clientRowId: client.id,
          variables: request.variables,
          channels: request.channels ?? null,
          agentCode: request.agentCode ?? null,
          category: request.category ?? null,
          gateReason: reason,
          detectedCategories: classifyContentCategory(messages.whatsapp.body),
          bodyPreview: messages.whatsapp.body.slice(0, 2000),
        }),
        risk: 'MEDIUM',
        requestedBy: request.agentCode ?? 'PIPELINE',
      },
    })
    await db.notification.create({
      data: {
        type: 'APPROVAL',
        title: 'Client message awaiting admin approval',
        body: `${client.clientId} — ${request.stage}`,
        severity: 'INFO',
      },
    }).catch(() => null)
    await audit({
      actor: request.agentCode ?? 'system',
      action: 'PIPELINE_MESSAGE_AWAITING_APPROVAL',
      clientId: client.clientId,
      entityId: approval.id,
      details: { stage: request.stage, category: request.category ?? null },
    })
    return {
      status: 'AWAITING_APPROVAL',
      gate,
      gateReason: reason,
      approvalId: approval.id,
      deliveries: [],
      messages,
      clientId: client.clientId,
    }
  }

  // ---- RULE 3 — always save, then dispatch ----
  const channels = resolveChannels(client, request.channels)
  const deliveries: PipelineDelivery[] = []

  if (channels.length === 0) {
    // No channel is available. The composed body is STILL saved, so the
    // message is never lost — an operator can send it by hand.
    const comm = await db.communication.create({
      data: {
        clientId: client.id,
        channel: 'WEB',
        direction: 'OUT',
        body: messages.whatsapp.body.slice(0, 20000),
        subject: messages.email.subject ?? null,
        agentCode: request.agentCode ?? null,
        workflowId: request.workflowId ?? null,
        approvalId: request.approvalId ?? null,
        templateName: request.stage,
        messageType: 'TEMPLATE',
        status: 'NOT_CONFIGURED',
        metadata: JSON.stringify({
          stage: request.stage,
          plainText: messages.whatsapp.body.slice(0, 20000),
          emailBody: messages.email.body.slice(0, 20000),
        }),
        error: 'No WhatsApp, SMS or email contact is recorded for this client. The message body was preserved in the CRM for a manual send.',
      },
    })
    deliveries.push({ channel: 'WEB', status: 'NOT_CONFIGURED', ok: false, communicationId: comm.id, redacted: redactedAll })
    return { status: 'NO_CHANNEL', gate, gateReason: reason, approvalId: null, deliveries, messages, clientId: client.clientId }
  }

  for (const channel of channels) {
    const message = channel === 'EMAIL' ? messages.email : messages.whatsapp
    const to = channel === 'EMAIL' ? client.email : channel === 'WHATSAPP' ? client.whatsapp : client.phone
    if (!to) {
      deliveries.push({ channel, status: 'NOT_CONFIGURED', ok: false, communicationId: null, redacted: redactedAll, error: 'No recipient address for this channel.' })
      continue
    }
    const isEmail = channel === 'EMAIL'
    const result = await sendCommunication({
      clientId: client.id,
      channel,
      to,
      subject: isEmail ? message.subject : undefined,
      // The email channel is dispatched as HTML (the convention used by
      // every other email in the system); the exact plain-text body from
      // the specification is preserved alongside it in the metadata.
      body: isEmail ? (message.html ?? renderEmailBody(message.body)) : message.body,
      metadata: JSON.stringify({
        stage: request.stage,
        plainText: message.body.slice(0, 20000),
        originatingAgent: request.agentCode ?? null,
      }),
      agentCode: PIPELINE_AGENT_BY_CHANNEL[channel],
      workflowId: request.workflowId,
      approvalId: request.approvalId,
      templateName: request.stage,
      messageType: 'TEMPLATE',
    })
    deliveries.push({
      channel,
      status: result.result.status,
      ok: result.result.ok,
      communicationId: result.communicationId,
      redacted: redactedAll,
      error: result.result.error,
    })
  }

  const accepted = deliveries.filter((d) => d.ok).length
  const status = accepted === 0 ? 'NO_CHANNEL' : accepted === deliveries.length ? 'SENT' : 'PARTIAL'
  return { status, gate, gateReason: reason, approvalId: null, deliveries, messages, clientId: client.clientId }
}

// ------------------------------------------------------------
// The stage-change record (status change + timestamp, always saved)
// ------------------------------------------------------------

/**
 * Record a pipeline stage change.
 *
 * The specification requires the CRM to hold the status change and
 * the timestamp for every step. The client row carries the current
 * stage, but a queryable per-change record with its own timestamp
 * is what an operator needs.
 */
export async function recordStageChange(input: {
  clientRowId: string
  clientId: string
  from: string
  to: string
  note: string
  agentCode?: string
}): Promise<void> {
  await db.communication.create({
    data: {
      clientId: input.clientRowId,
      channel: 'WEB',
      direction: 'OUT',
      messageType: 'SYSTEM',
      templateName: 'PIPELINE_STAGE_CHANGE',
      subject: `Pipeline stage ${input.from} → ${input.to}`,
      body: `${input.to}: ${input.note}`,
      agentCode: input.agentCode ?? null,
      status: 'DELIVERED',
      metadata: JSON.stringify({ kind: 'PIPELINE_STAGE_CHANGE', from: input.from, to: input.to, at: new Date().toISOString() }),
    },
  })
}
