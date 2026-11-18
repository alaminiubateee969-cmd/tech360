// ============================================================
// TECH360 — domain → automation event bridge
// ------------------------------------------------------------
// Thin, fail-safe emitters called from existing domain services. They never
// throw into the caller (the domain action already happened and must not be
// reported as failed because automation is unavailable); failures are logged.
// Every emitter uses a deterministic dedupe key so retries never double-fire.
// ============================================================
import { createHash } from 'node:crypto'
import type { TriggerType } from '@/lib/automation/catalog'

type Emit = {
  type: TriggerType
  source: string
  subjectType: string
  subjectId: string
  payload: Record<string, unknown>
  dedupeKey: string
  tenantId?: string
}

async function safeEmit(input: Emit): Promise<void> {
  try {
    const { emitAutomationEvent } = await import('@/lib/automation/engine')
    await emitAutomationEvent(input)
  } catch (error) {
    try {
      const { logError } = await import('@/lib/security')
      await logError({ source: 'AUTOMATION_EVENTS', code: 'EMIT_FAILED', message: `${input.type}: ${error instanceof Error ? error.message : String(error)}`.slice(0, 900) })
    } catch { /* logging must never break the domain action */ }
  }
}

const digest = (s: string) => createHash('sha256').update(s).digest('hex').slice(0, 24)

/**
 * A new CRM customer/lead row was created (any intake path: public forms,
 * webchat, inbound email/WhatsApp identity resolution, operator entry).
 * Keyed by the row id, so several call sites for one row fire once.
 */
export function emitLeadCreated(input: { clientRowId: string; clientId: string; leadSource: string | null; channelSource?: string | null; businessType?: string | null; createdBy?: string | null }) {
  return safeEmit({
    type: 'LEAD_CREATED',
    source: 'CRM',
    subjectType: 'Client',
    subjectId: input.clientRowId,
    payload: {
      clientRowId: input.clientRowId,
      clientId: input.clientId,
      leadSource: input.leadSource,
      channelSource: input.channelSource ?? null,
      businessType: input.businessType ?? null,
      createdBy: input.createdBy ?? null,
    },
    dedupeKey: `lead_created:${input.clientRowId}`,
  })
}

export function emitInboundMessage(input: { clientRowId: string; clientId: string; channel: string; body: string; at: string }) {
  const channel = input.channel.toUpperCase()
  const type: TriggerType | null = channel === 'EMAIL' ? 'EMAIL_RECEIVED' : channel === 'WHATSAPP' ? 'WHATSAPP_RECEIVED' : null
  if (!type) return Promise.resolve()
  return safeEmit({
    type,
    source: channel,
    subjectType: 'Client',
    subjectId: input.clientRowId,
    payload: { clientRowId: input.clientRowId, clientId: input.clientId, channel, body: input.body.slice(0, 500) },
    dedupeKey: `${type.toLowerCase()}:${input.clientRowId}:${digest(`${input.at}|${input.body}`)}`,
  })
}

export function emitPaymentVerified(input: { paymentId: string; clientRowId: string | null; clientId: string | null; amount: number; currency: string; invoiceNumber: string | null }) {
  return safeEmit({
    type: 'PAYMENT_VERIFIED',
    source: 'FINANCE',
    subjectType: 'Payment',
    subjectId: input.paymentId,
    payload: { paymentId: input.paymentId, clientRowId: input.clientRowId, clientId: input.clientId, amount: input.amount, currency: input.currency, invoiceNumber: input.invoiceNumber },
    dedupeKey: `payment_verified:${input.paymentId}`,
  })
}

export function emitProposalApproved(input: { scopeId: string; version: number; clientRowId: string; clientId: string }) {
  return safeEmit({
    type: 'PROPOSAL_APPROVED',
    source: 'PORTAL',
    subjectType: 'ScopeOfWork',
    subjectId: input.scopeId,
    payload: { scopeId: input.scopeId, version: input.version, clientRowId: input.clientRowId, clientId: input.clientId },
    dedupeKey: `proposal_approved:${input.scopeId}`,
  })
}

export async function emitProjectStatusChanged(input: { projectId: string; code: string | null; from: string; to: string; clientRowId: string | null; at?: Date }) {
  const at = (input.at ?? new Date()).getTime()
  await safeEmit({
    type: 'PROJECT_STATUS_CHANGED',
    source: 'PROJECTS',
    subjectType: 'Project',
    subjectId: input.projectId,
    payload: { projectId: input.projectId, code: input.code, from: input.from, to: input.to, clientRowId: input.clientRowId },
    dedupeKey: `project_status:${input.projectId}:${input.from}>${input.to}:${at}`,
  })
  if (input.to === 'COMPLETED') {
    await safeEmit({
      type: 'DELIVERY_COMPLETED',
      source: 'PROJECTS',
      subjectType: 'Project',
      subjectId: input.projectId,
      payload: { projectId: input.projectId, code: input.code, clientRowId: input.clientRowId },
      dedupeKey: `delivery_completed:${input.projectId}`,
    })
  }
}
