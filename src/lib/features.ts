import { db } from '@/lib/db'

// ============================================================
// FEATURE FLAGS + PAYMENT GATEWAY GOVERNANCE
//
// Super Admin switches that change REAL backend behavior:
//  - Feature flags (Setting key "feature_flags") gate live API
//    paths (portal session guard, payment recording, invoices,
//    public blog, agent runs, ops loop AI actions, contact
//    intake, maintenance mode for public data APIs).
//  - Payment gateways (Setting key "payment_gateways") control
//    which payment methods the platform ACCEPTS. Disabled
//    gateways are rejected server-side (admin recording + portal
//    proof submission + invoice payment instructions quote only
//    enabled methods).
//
// Credentials are NEVER stored in the database — only env var
// NAMES are referenced; live status is computed from the
// environment at request time (honest CONFIGURATION REQUIRED).
// Flags are cached in-process (short TTL) to avoid a Setting
// read on every request.
// ============================================================

export type FeatureFlag =
  | 'public_website'
  | 'client_portal'
  | 'payments'
  | 'invoices'
  | 'whatsapp'
  | 'email'
  | 'sms'
  | 'ai_agents'
  | 'n8n'
  | 'blog'
  | 'case_studies'
  | 'support'
  | 'maintenance_mode'

export type FeatureFlagDefinition = {
  key: FeatureFlag
  label: string
  description: string
  affects: string
  default: boolean
}

export const FEATURE_FLAG_DEFINITIONS: FeatureFlagDefinition[] = [
  { key: 'public_website', label: 'Public Website', description: 'Public marketing site content APIs (testimonials/reviews feed).', affects: 'GET /api/reviews, public /api/features', default: true },
  { key: 'client_portal', label: 'Client Portal', description: 'Client sign-in and all portal APIs. When off, sessions are refused.', affects: '/api/portal/* (login + every session-guarded route)', default: true },
  { key: 'payments', label: 'Payments', description: 'Recording/verifying payments and portal payment-proof submissions.', affects: 'POST /api/admin/payments*, portal payment submit, Stripe checkout', default: true },
  { key: 'invoices', label: 'Invoices', description: 'Official invoice documents (tax invoice on the company pad).', affects: 'GET /api/admin/invoices/[number], invoice pay-note methods', default: true },
  { key: 'whatsapp', label: 'WhatsApp', description: 'Outbound WhatsApp sending attempts (records stay, sends refuse).', affects: 'lib/comms WhatsApp adapter', default: true },
  { key: 'email', label: 'Email', description: 'Outbound email sending attempts (records stay, sends refuse).', affects: 'lib/comms SMTP adapter', default: true },
  { key: 'sms', label: 'SMS', description: 'Outbound SMS sending attempts (records stay, sends refuse).', affects: 'lib/comms SMS adapter', default: true },
  { key: 'ai_agents', label: 'AI Agents', description: 'Agent execution (manual runs + autonomous ops loop AI actions).', affects: 'POST /api/admin/agents/[code]/run, ops loop agent passes', default: true },
  { key: 'n8n', label: 'n8n', description: 'n8n workflow registry + downloads.', affects: 'GET /api/admin/n8n*', default: true },
  { key: 'blog', label: 'Blog', description: 'Public blog listing and articles.', affects: 'GET /api/blog, GET /api/blog/[slug]', default: true },
  { key: 'case_studies', label: 'Case Studies', description: 'Public work/case-study content (work page is static; flag surfaces in /api/features and the SPA hides the section).', affects: 'GET /api/features', default: true },
  { key: 'support', label: 'Support / Contact', description: 'Contact form intake (new leads/inquiries).', affects: 'POST /api/contact', default: true },
  { key: 'maintenance_mode', label: 'Maintenance Mode', description: 'Public data APIs return 503 with an honest maintenance notice; admin APIs stay live so switches can be flipped back.', affects: '/api/blog, /api/contact, /api/newsletter, /api/reviews', default: false },
]

const SETTING_KEY_FEATURES = 'feature_flags'

type FlagCache = { value: Record<FeatureFlag, boolean>; at: number }
let flagCache: FlagCache | null = null
const FLAG_TTL_MS = 15_000

function defaultFlags(): Record<FeatureFlag, boolean> {
  const out = {} as Record<FeatureFlag, boolean>
  for (const def of FEATURE_FLAG_DEFINITIONS) out[def.key] = def.default
  return out
}

/** All flags with defaults applied for unknown/missing keys. */
export async function getFeatureFlags(force = false): Promise<Record<FeatureFlag, boolean>> {
  if (!force && flagCache && Date.now() - flagCache.at < FLAG_TTL_MS) return flagCache.value
  let value = defaultFlags()
  try {
    const row = await db.setting.findUnique({ where: { key: SETTING_KEY_FEATURES } })
    if (row) {
      const parsed = JSON.parse(row.value) as Partial<Record<FeatureFlag, boolean>>
      value = { ...defaultFlags(), ...parsed }
    }
  } catch {
    // DB unavailable → safe defaults (everything on, maintenance off)
  }
  flagCache = { value, at: Date.now() }
  return value
}

/** Single flag check (cached). */
export async function featureEnabled(flag: FeatureFlag): Promise<boolean> {
  const flags = await getFeatureFlags()
  return Boolean(flags[flag])
}

/** Persist flag overrides (admin API only). Values are normalized to booleans. */
export async function saveFeatureFlags(overrides: Partial<Record<FeatureFlag, boolean>>): Promise<Record<FeatureFlag, boolean>> {
  const current = await getFeatureFlags(true)
  const next = { ...current }
  for (const def of FEATURE_FLAG_DEFINITIONS) {
    if (def.key in overrides && overrides[def.key] !== undefined) next[def.key] = Boolean(overrides[def.key])
  }
  await db.setting.upsert({
    where: { key: SETTING_KEY_FEATURES },
    update: { value: JSON.stringify(next), updatedAt: new Date() },
    create: { key: SETTING_KEY_FEATURES, value: JSON.stringify(next) },
  })
  flagCache = { value: next, at: Date.now() }
  return next
}

/** Reset flags to defaults (honest escape hatch). */
export async function resetFeatureFlags(): Promise<Record<FeatureFlag, boolean>> {
  await db.setting.deleteMany({ where: { key: SETTING_KEY_FEATURES } })
  flagCache = null
  return getFeatureFlags(true)
}

// ============================================================
// PAYMENT GATEWAYS
// ============================================================

export type GatewayCode =
  | 'BANK_TRANSFER'
  | 'BKASH'
  | 'NAGAD'
  | 'STRIPE'
  | 'PAYPAL'
  | 'SSLCOMMERZ'
  | 'MANUAL'

export type GatewayMode = 'SANDBOX' | 'PRODUCTION'

export type GatewayDefinition = {
  code: GatewayCode
  name: string
  settlement: 'PLATFORM_VERIFIED' | 'GATEWAY_CHECKOUT' | 'MANUAL_VERIFIED'
  credentialEnvVars: string[]
  supportsWebhook: boolean
  supportsRefund: boolean
  instructionsNote: string
  defaultEnabled: boolean
}

/**
 * The honest gateway registry.
 *  - PLATFORM_VERIFIED: client pays externally (bank/bKash/Nagad/manual) and
 *    submits proof; the platform verifies and issues the receipt. Works today
 *    with zero external credentials (account numbers are shown from env when
 *    configured, otherwise the finance automation shares them).
 *  - GATEWAY_CHECKOUT: server-side checkout session + webhook verification
 *    (implemented for Stripe: /api/payments/stripe/checkout +
 *    /api/webhooks/stripe with HMAC signature verification). Without
 *    credentials the status is honestly CONFIGURATION REQUIRED.
 */
export const GATEWAY_DEFINITIONS: GatewayDefinition[] = [
  {
    code: 'BANK_TRANSFER',
    name: 'Bank Transfer',
    settlement: 'PLATFORM_VERIFIED',
    credentialEnvVars: ['BANK_TRANSFER_DETAILS'],
    supportsWebhook: false,
    supportsRefund: false,
    instructionsNote: 'Client transfers with Client ID reference and uploads proof; admin verifies → receipt.',
    defaultEnabled: true,
  },
  {
    code: 'BKASH',
    name: 'bKash',
    settlement: 'PLATFORM_VERIFIED',
    credentialEnvVars: ['BKASH_MERCHANT_NUMBER'],
    supportsWebhook: false,
    supportsRefund: false,
    instructionsNote: 'Client sends to the bKash merchant number and submits the TrxID; verified platform-side.',
    defaultEnabled: true,
  },
  {
    code: 'NAGAD',
    name: 'Nagad',
    settlement: 'PLATFORM_VERIFIED',
    credentialEnvVars: ['NAGAD_MERCHANT_NUMBER'],
    supportsWebhook: false,
    supportsRefund: false,
    instructionsNote: 'Client sends to the Nagad merchant number and submits the TrxID; verified platform-side.',
    defaultEnabled: true,
  },
  {
    code: 'MANUAL',
    name: 'Manual / Other',
    settlement: 'MANUAL_VERIFIED',
    credentialEnvVars: [],
    supportsWebhook: false,
    supportsRefund: false,
    instructionsNote: 'Cash, Wise, or any method recorded + verified manually with a transaction reference.',
    defaultEnabled: true,
  },
  {
    code: 'STRIPE',
    name: 'Stripe',
    settlement: 'GATEWAY_CHECKOUT',
    credentialEnvVars: ['STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET'],
    supportsWebhook: true,
    supportsRefund: true,
    instructionsNote: 'Server-side Checkout Session + webhook with HMAC signature verification (implemented).',
    defaultEnabled: false,
  },
  {
    code: 'PAYPAL',
    name: 'PayPal',
    settlement: 'GATEWAY_CHECKOUT',
    credentialEnvVars: ['PAYPAL_CLIENT_ID', 'PAYPAL_CLIENT_SECRET', 'PAYPAL_WEBHOOK_ID'],
    supportsWebhook: true,
    supportsRefund: true,
    instructionsNote: 'Checkout integration is NOT implemented yet — honest status until it is built and verified.',
    defaultEnabled: false,
  },
  {
    code: 'SSLCOMMERZ',
    name: 'SSLCommerz',
    settlement: 'GATEWAY_CHECKOUT',
    credentialEnvVars: ['SSLCOMMERZ_STORE_ID', 'SSLCOMMERZ_STORE_PASSWORD'],
    supportsWebhook: true,
    supportsRefund: false,
    instructionsNote: 'Checkout integration is NOT implemented yet — honest status until it is built and verified.',
    defaultEnabled: false,
  },
]

export type GatewayStatus = GatewayDefinition & {
  enabled: boolean
  mode: GatewayMode
  credentialsConfigured: boolean
  missingCredentials: string[]
  checkoutBuilt: boolean
  status: 'ACTIVE' | 'CONFIGURATION_REQUIRED' | 'INTEGRATION_NOT_BUILT' | 'DISABLED'
}

const SETTING_KEY_GATEWAYS = 'payment_gateways'

type GatewayOverrides = Partial<Record<GatewayCode, { enabled?: boolean; mode?: GatewayMode }>>
type GatewayCache = { value: GatewayStatus[]; at: number }
let gatewayCache: GatewayCache | null = null
const GATEWAY_TTL_MS = 15_000

function computeGatewayStatuses(overrides: GatewayOverrides): GatewayStatus[] {
  return GATEWAY_DEFINITIONS.map((def) => {
    const o = overrides[def.code] ?? {}
    const enabled = o.enabled ?? def.defaultEnabled
    const mode: GatewayMode = o.mode === 'PRODUCTION' ? 'PRODUCTION' : 'SANDBOX'
    const missingCredentials = def.credentialEnvVars.filter((name) => !process.env[name]?.trim())
    const credentialsConfigured = def.credentialEnvVars.length === 0 || missingCredentials.length === 0
    const checkoutBuilt = def.settlement !== 'GATEWAY_CHECKOUT' || def.code === 'STRIPE'

    let status: GatewayStatus['status']
    if (!enabled) status = 'DISABLED'
    else if (def.settlement === 'GATEWAY_CHECKOUT' && !checkoutBuilt) status = 'INTEGRATION_NOT_BUILT'
    else if (!credentialsConfigured) status = 'CONFIGURATION_REQUIRED'
    else status = 'ACTIVE'

    return { ...def, enabled, mode, credentialsConfigured, missingCredentials, checkoutBuilt, status }
  })
}

/** All gateway statuses (DB overrides + live env-derived credential state). */
export async function getPaymentGateways(force = false): Promise<GatewayStatus[]> {
  if (!force && gatewayCache && Date.now() - gatewayCache.at < GATEWAY_TTL_MS) return gatewayCache.value
  let overrides: GatewayOverrides = {}
  try {
    const row = await db.setting.findUnique({ where: { key: SETTING_KEY_GATEWAYS } })
    if (row) overrides = JSON.parse(row.value) as GatewayOverrides
  } catch {
    // DB unavailable → defaults
  }
  const value = computeGatewayStatuses(overrides)
  gatewayCache = { value, at: Date.now() }
  return value
}

/** One gateway status by code. */
export async function getGateway(code: GatewayCode): Promise<GatewayStatus | null> {
  const all = await getPaymentGateways()
  return all.find((g) => g.code === code) ?? null
}

/**
 * Server-side acceptance check — used by EVERY payment-taking path
 * (admin recording, portal proof submission, Stripe checkout).
 * Disabled gateways are rejected; enabled-but-unconfigured gateway
 * checkouts are rejected honestly (never fake a charge).
 */
export async function assertGatewayUsable(code: string): Promise<{ ok: true; gateway: GatewayStatus } | { ok: false; error: string; status: number }> {
  const normalized = code.trim().toUpperCase().replace(/[\s-]+/g, '_')
  const map: Record<string, GatewayCode> = { CARD: 'STRIPE', WISE: 'MANUAL', OTHER: 'MANUAL' }
  const code2 = (map[normalized] ?? normalized) as GatewayCode
  const gateway = await getGateway(code2)
  if (!gateway) {
    return { ok: false, error: `Unknown payment method "${code}".`, status: 400 }
  }
  if (!gateway.enabled) {
    return { ok: false, error: `Payment method ${gateway.name} is currently disabled by Super Admin.`, status: 403 }
  }
  if (gateway.status === 'INTEGRATION_NOT_BUILT') {
    return { ok: false, error: `${gateway.name} checkout is not implemented yet — status is honestly INTEGRATION_NOT_BUILT. Use an enabled platform-verified method.`, status: 503 }
  }
  if (gateway.status === 'CONFIGURATION_REQUIRED') {
    return { ok: false, error: `${gateway.name} is enabled but credentials are not configured (missing: ${gateway.missingCredentials.join(', ')}). Status: CONFIGURATION REQUIRED.`, status: 503 }
  }
  return { ok: true, gateway }
}

/** Persist gateway overrides (admin API only — enabled + mode only; never credentials). */
export async function saveGatewayOverrides(overrides: GatewayOverrides): Promise<GatewayStatus[]> {
  const row = await db.setting.findUnique({ where: { key: SETTING_KEY_GATEWAYS } })
  const current: GatewayOverrides = row ? (JSON.parse(row.value) as GatewayOverrides) : {}
  const next: GatewayOverrides = { ...current }
  for (const def of GATEWAY_DEFINITIONS) {
    const o = overrides[def.code]
    if (!o) continue
    if (o.enabled !== undefined) next[def.code] = { ...(next[def.code] ?? {}), enabled: Boolean(o.enabled) }
    if (o.mode !== undefined) next[def.code] = { ...(next[def.code] ?? {}), mode: o.mode === 'PRODUCTION' ? 'PRODUCTION' : 'SANDBOX' }
  }
  await db.setting.upsert({
    where: { key: SETTING_KEY_GATEWAYS },
    update: { value: JSON.stringify(next), updatedAt: new Date() },
    create: { key: SETTING_KEY_GATEWAYS, value: JSON.stringify(next) },
  })
  gatewayCache = null
  return getPaymentGateways(true)
}

/**
 * Human phrase of enabled acceptance methods for invoice pay-notes
 * and portal payment instructions. Empty string when payments are
 * globally disabled.
 */
export async function acceptedMethodsPhrase(): Promise<string> {
  const gateways = await getPaymentGateways()
  const usable = gateways.filter((g) => g.enabled && (g.settlement !== 'GATEWAY_CHECKOUT' || g.checkoutBuilt))
  const labels = usable.map((g) => (g.settlement === 'GATEWAY_CHECKOUT' ? `${g.name} (online checkout)` : g.name))
  if (labels.length === 0) return ''
  if (labels.length === 1) return labels[0]
  return `${labels.slice(0, -1).join(', ')} or ${labels[labels.length - 1]}`
}
