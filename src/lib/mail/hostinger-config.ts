// ============================================================
// TECH360 — Hostinger Mail API configuration (server-only, pure)
//
// Reads and validates the Hostinger Mail API settings from the
// server environment. This module imports NOTHING from the SDK and
// NOTHING from the database, so the validation rules are unit-tested
// without credentials or network access.
//
// Rules:
//   - Email sending through Hostinger is OFF unless
//     HOSTINGER_MAIL_ENABLED is exactly "true".
//   - Every required value must be present and well-formed, or the
//     integration reports NOT_CONFIGURED and refuses to send.
//   - Values are never echoed back. Status reports carry variable
//     NAMES only, never the token, the webhook secret or any address
//     beyond the configured sender.
//
// Variable names (values live only in Hostinger's environment panel):
//   HOSTINGER_MAIL_ENABLED            "true" to enable (anything else = off)
//   HOSTINGER_MAIL_API_TOKEN          Bearer token, scoped to one Hostinger order
//   HOSTINGER_MAILBOX_RESOURCE_ID     resourceId of the managed mailbox
//   HOSTINGER_MAIL_FROM_ADDRESS       address of that mailbox (must be on bdtech360.com)
//   HOSTINGER_MAIL_WEBHOOK_SECRET     optional; the one-time secret Hostinger returns
//                                     when a webhook is created (>= 32 characters)
//
// HOSTINGER_MAIL_REPLY_TO is intentionally NOT read: the official SDK
// (hostinger-mail-api-sdk 1.19.6) V1SendRequest has no reply-to field.
// ============================================================

export const HOSTINGER_MAIL_ENV = {
  enabled: 'HOSTINGER_MAIL_ENABLED',
  token: 'HOSTINGER_MAIL_API_TOKEN',
  mailboxResourceId: 'HOSTINGER_MAILBOX_RESOURCE_ID',
  fromAddress: 'HOSTINGER_MAIL_FROM_ADDRESS',
  webhookSecret: 'HOSTINGER_MAIL_WEBHOOK_SECRET',
} as const

/** The only sender domain this integration will use. */
export const HOSTINGER_ALLOWED_SENDER_DOMAIN = 'bdtech360.com'

const MIN_TOKEN_LENGTH = 20
const MIN_WEBHOOK_SECRET_LENGTH = 32

export type HostingerMailConfig = {
  token: string
  mailboxResourceId: string
  fromAddress: string
  webhookSecret: string | null
}

export type HostingerMailConfigStatus =
  | { state: 'DISABLED' }
  | { state: 'INVALID'; problems: string[] }
  | { state: 'CONFIGURED'; config: HostingerMailConfig }

type EnvLike = Record<string, string | undefined>

/** Parse and validate the Hostinger Mail configuration. Never throws. */
export function readHostingerMailConfig(env: EnvLike = process.env): HostingerMailConfigStatus {
  if ((env[HOSTINGER_MAIL_ENV.enabled] ?? '').trim() !== 'true') return { state: 'DISABLED' }

  const problems: string[] = []

  const token = (env[HOSTINGER_MAIL_ENV.token] ?? '').trim()
  if (!token) problems.push(`${HOSTINGER_MAIL_ENV.token} is not set`)
  else if (token.length < MIN_TOKEN_LENGTH || /\s/.test(token)) {
    problems.push(`${HOSTINGER_MAIL_ENV.token} has an invalid format`)
  }

  const mailboxResourceId = (env[HOSTINGER_MAIL_ENV.mailboxResourceId] ?? '').trim()
  if (!mailboxResourceId) problems.push(`${HOSTINGER_MAIL_ENV.mailboxResourceId} is not set`)
  else if (!/^[A-Za-z0-9_.:-]{3,128}$/.test(mailboxResourceId)) {
    problems.push(`${HOSTINGER_MAIL_ENV.mailboxResourceId} has an invalid format`)
  }

  const fromAddress = (env[HOSTINGER_MAIL_ENV.fromAddress] ?? '').trim().toLowerCase()
  if (!fromAddress) problems.push(`${HOSTINGER_MAIL_ENV.fromAddress} is not set`)
  else if (!isAllowedSenderAddress(fromAddress)) {
    problems.push(`${HOSTINGER_MAIL_ENV.fromAddress} must be an address on ${HOSTINGER_ALLOWED_SENDER_DOMAIN}`)
  }

  const webhookSecret = (env[HOSTINGER_MAIL_ENV.webhookSecret] ?? '').trim()
  if (webhookSecret && webhookSecret.length < MIN_WEBHOOK_SECRET_LENGTH) {
    problems.push(`${HOSTINGER_MAIL_ENV.webhookSecret} must be at least ${MIN_WEBHOOK_SECRET_LENGTH} characters when set`)
  }

  if (problems.length > 0) return { state: 'INVALID', problems }
  return {
    state: 'CONFIGURED',
    config: {
      token,
      mailboxResourceId,
      fromAddress,
      webhookSecret: webhookSecret || null,
    },
  }
}

/** True for a syntactically valid address on the single authorized sender domain. */
export function isAllowedSenderAddress(address: string): boolean {
  const normalized = address.trim().toLowerCase()
  if (normalized.length > 320 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) return false
  return normalized.endsWith(`@${HOSTINGER_ALLOWED_SENDER_DOMAIN}`)
}

/**
 * Safe, value-free status for the admin integrations panel.
 * Reports which variable NAMES are missing or malformed, never values.
 */
export function describeHostingerMailConfig(env: EnvLike = process.env): {
  state: 'DISABLED' | 'INVALID' | 'CONFIGURED'
  problems: string[]
  webhookSecretConfigured: boolean
} {
  const status = readHostingerMailConfig(env)
  const webhookSecretConfigured = Boolean((env[HOSTINGER_MAIL_ENV.webhookSecret] ?? '').trim().length >= MIN_WEBHOOK_SECRET_LENGTH)
  if (status.state === 'CONFIGURED') return { state: 'CONFIGURED', problems: [], webhookSecretConfigured }
  if (status.state === 'INVALID') return { state: 'INVALID', problems: status.problems, webhookSecretConfigured }
  return { state: 'DISABLED', problems: [], webhookSecretConfigured }
}
