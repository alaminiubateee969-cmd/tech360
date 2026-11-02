/**
 * Integration Hub — replaceable adapters with a single, honest interface.
 *
 * The platform owns the adapter architecture, message templates, event
 * processing, retry/audit records and delivery status. It does NOT own
 * external networks (Meta/WhatsApp, carriers, email providers, payment
 * networks). An adapter whose credentials are absent is never "connected",
 * and disabling an external provider never affects internal-only modules.
 */
import type { INTEGRATION_STATUSES } from './types'

export type IntegrationStatus = (typeof INTEGRATION_STATUSES)[number]

export interface AdapterDefinition {
  key: string
  label: string
  kind: 'INTERNAL' | 'WEBHOOK' | 'EXTERNAL'
  /** Environment variable NAMES only. Values are never stored in the DB. */
  envKeys: string[]
  capabilities: string[]
  limitation: string
  /** Official provider documentation / commercial restriction note. */
  dependencyNote: string
}

export const ADAPTERS: readonly AdapterDefinition[] = [
  {
    key: 'internal_events', label: 'Internal Event Bus', kind: 'INTERNAL', envKeys: [],
    capabilities: ['event processing', 'scheduled workflow execution', 'internal notifications', 'audit records'],
    limitation: 'Operates only inside this application process; no outbound message is sent.',
    dependencyNote: 'No third-party dependency. Runs on the self-hosted Next.js runtime.',
  },
  {
    key: 'internal_webhooks', label: 'Internal Webhook Receiver', kind: 'WEBHOOK', envKeys: ['WEBHOOK_SIGNING_SECRET'],
    capabilities: ['signed inbound webhooks', 'idempotent event receipts', 'retry handling'],
    limitation: 'Inbound only. A signing secret must be configured and rotated by the operator.',
    dependencyNote: 'No SaaS required. Secret is read from the environment, never from the database.',
  },
  {
    key: 'email_smtp', label: 'Transactional Email (SMTP)', kind: 'EXTERNAL', envKeys: ['SMTP_HOST', 'SMTP_USER', 'SMTP_PASSWORD'],
    capabilities: ['message templates', 'delivery status', 'retry'],
    limitation: 'Requires an SMTP provider account. Without credentials, email is reported NOT_CONFIGURED and nothing is sent.',
    dependencyNote: 'Provider fees and sending limits apply. Replaceable: any standards-compliant SMTP service.',
  },
  {
    key: 'whatsapp_cloud', label: 'WhatsApp Cloud API', kind: 'EXTERNAL', envKeys: ['WHATSAPP_TOKEN', 'WHATSAPP_PHONE_NUMBER_ID'],
    capabilities: ['template messages', 'conversation inbox', 'human-approved AI replies'],
    limitation: 'Requires a Meta business account, approved message templates and a phone number. The carrier/Meta network cannot be self-hosted.',
    dependencyNote: 'Official Meta WhatsApp Cloud API only. Conversation-based fees, template approval and policy restrictions apply.',
  },
  {
    key: 'sms_gateway', label: 'SMS Gateway', kind: 'EXTERNAL', envKeys: ['SMS_API_KEY', 'SMS_SENDER_ID'],
    capabilities: ['outbound SMS', 'delivery status'],
    limitation: 'Requires a carrier or SMS aggregator. Per-message fees and sender registration apply.',
    dependencyNote: 'Replaceable adapter; multiple gateway providers can be configured.',
  },
  {
    key: 'telephony', label: 'Business Telephony', kind: 'EXTERNAL', envKeys: ['TELEPHONY_API_KEY', 'TELEPHONY_ACCOUNT_SID'],
    capabilities: ['call routing', 'call logs', 'recordings where supported'],
    limitation: 'IVR, queues, recordings and analytics require a compatible carrier/PBX. Not available without one.',
    dependencyNote: 'Official provider APIs only. Call termination is billed by the carrier.',
  },
  {
    key: 'payment_gateway', label: 'Payment Gateway', kind: 'EXTERNAL', envKeys: ['PAYMENT_SECRET_KEY', 'PAYMENT_WEBHOOK_SECRET'],
    capabilities: ['checkout', 'verified settlement', 'refund records'],
    limitation: 'Requires a merchant account and webhook verification. No payment is ever recorded as settled without a verified provider event.',
    dependencyNote: 'Provider fees, KYC and commercial terms apply. Stripe/other adapters are replaceable.',
  },
] as const

export function getAdapter(key: string): AdapterDefinition | null {
  return ADAPTERS.find((a) => a.key === key) ?? null
}

export interface AdapterRuntimeState {
  enabled: boolean
  /** Whether every required env var NAME has a non-empty value in this process. */
  envConfigured: boolean
  /** Set only by a real verification call, never by configuration alone. */
  externalVerified?: boolean
  lastError?: string | null
}

export interface AdapterStatus {
  status: IntegrationStatus
  configured: boolean
  message: string
  availableNow: boolean
}

/** The single source of truth for displayed integration status. */
export function computeAdapterStatus(adapter: AdapterDefinition, state: AdapterRuntimeState): AdapterStatus {
  if (state.lastError) {
    return { status: 'ERROR', configured: state.envConfigured, message: `Last check failed: ${state.lastError}`, availableNow: false }
  }
  if (!state.enabled) {
    return {
      status: 'DISABLED',
      configured: state.envConfigured,
      message: `${adapter.label} is disabled. Internal functionality is unaffected; dependent external capabilities are unavailable.`,
      availableNow: false,
    }
  }
  if (adapter.kind === 'INTERNAL') {
    return { status: 'AVAILABLE', configured: true, message: `${adapter.label} is active (internal-only).`, availableNow: true }
  }
  if (!state.envConfigured) {
    return {
      status: 'NOT_CONFIGURED',
      configured: false,
      message: `${adapter.label} is not configured: required credentials are absent. No delivery, call or account access has been attempted.`,
      availableNow: false,
    }
  }
  if (!state.externalVerified) {
    return {
      status: 'UNAVAILABLE',
      configured: true,
      message: `${adapter.label} has credentials but provider connectivity has not been verified. External capability is unavailable until a real verification succeeds.`,
      availableNow: false,
    }
  }
  return { status: 'AVAILABLE', configured: true, message: `${adapter.label} verified.`, availableNow: true }
}

export function missingEnvKeys(adapter: AdapterDefinition, present: (name: string) => boolean): string[] {
  return adapter.envKeys.filter((key) => !present(key))
}

/** Internal-only operation must never depend on an external adapter. */
export function internalOnlyHealthy(statuses: Record<string, AdapterStatus>): boolean {
  const internal = ADAPTERS.filter((a) => a.kind === 'INTERNAL')
  return internal.every((a) => statuses[a.key]?.availableNow === true)
}
