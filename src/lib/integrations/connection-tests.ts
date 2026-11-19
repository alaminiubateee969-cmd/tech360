// ============================================================
// TECH360 — real provider connection tests
// ------------------------------------------------------------
// "Configured" (credentials present) is NOT "connected". A provider is only
// ever reported CONNECTED when a live test against the provider succeeded,
// and the result is stored with its timestamp so the UI can show how fresh
// it is. Results never contain credential values.
// ============================================================
import { db } from '@/lib/db'
import { channelConfigured } from '@/lib/comms'
import { testN8nConnection, readN8nConfig } from '@/lib/n8n/adapter'

export const CONNECTION_PROVIDERS = ['WHATSAPP', 'EMAIL', 'MESSENGER', 'INSTAGRAM', 'N8N'] as const
export type ConnectionProvider = (typeof CONNECTION_PROVIDERS)[number]

export type ConnectionTestResult = {
  provider: ConnectionProvider
  ok: boolean
  testedAt: string
  detail: string
  httpStatus: number | null
}

export type ConnectionState = 'NOT_CONFIGURED' | 'CONFIGURED_UNTESTED' | 'CONNECTED' | 'FAILED'

type FetchLike = (url: string, init?: RequestInit) => Promise<Response>
type Env = Record<string, string | undefined>

export function isConnectionProvider(v: unknown): v is ConnectionProvider {
  return typeof v === 'string' && (CONNECTION_PROVIDERS as readonly string[]).includes(v)
}

const settingKey = (p: ConnectionProvider) => `integration.connection.${p}`

/** Credentials present? (Never reads/returns the values themselves.) */
export function providerConfigured(provider: ConnectionProvider, env: Env = process.env): boolean {
  switch (provider) {
    case 'WHATSAPP': return Boolean(env.WHATSAPP_TOKEN?.trim() && env.WHATSAPP_PHONE_NUMBER_ID?.trim())
    case 'EMAIL': return env === process.env ? channelConfigured('EMAIL') : Boolean(env.SMTP_HOST && env.SMTP_USER && env.SMTP_PASS && env.SMTP_FROM)
    case 'MESSENGER': return Boolean(env.FACEBOOK_PAGE_TOKEN?.trim())
    case 'INSTAGRAM': return Boolean(env.INSTAGRAM_TOKEN?.trim())
    case 'N8N': return readN8nConfig(env).configured
  }
}

function graphVersion(env: Env) {
  return (env.META_GRAPH_API_VERSION ?? 'v26.0').replace(/^v?/, 'v')
}

function providerErrorMessage(data: unknown, status: number): string {
  const msg = (data as { error?: { message?: string } } | null)?.error?.message
  // Provider messages can echo ids but never our token; still cap length.
  return (msg ? String(msg) : `HTTP ${status}`).slice(0, 240)
}

async function metaProbe(url: string, token: string, doFetch: FetchLike, label: string): Promise<{ ok: boolean; detail: string; httpStatus: number | null }> {
  try {
    const res = await doFetch(url, { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(10_000) })
    const data = await res.json().catch(() => null)
    if (!res.ok) return { ok: false, detail: `${label} rejected the credentials: ${providerErrorMessage(data, res.status)}`, httpStatus: res.status }
    const name = (data as { name?: string; verified_name?: string; display_phone_number?: string } | null)
    const who = name?.verified_name || name?.display_phone_number || name?.name
    return { ok: true, detail: `${label} accepted the credentials${who ? ` (${String(who).slice(0, 80)})` : ''}.`, httpStatus: res.status }
  } catch (error) {
    return { ok: false, detail: `${label} could not be reached: ${error instanceof Error ? error.message.slice(0, 200) : 'network error'}`, httpStatus: null }
  }
}

export type ConnectionTestDeps = {
  fetch?: FetchLike
  env?: Env
  /** SMTP verifier (defaults to nodemailer transport.verify()). */
  verifySmtp?: (cfg: { host: string; port: number; secure: boolean; user: string; pass: string }) => Promise<void>
  persist?: boolean
}

/** Run a LIVE connection test for one provider and store the result. */
export async function testProviderConnection(provider: ConnectionProvider, deps: ConnectionTestDeps = {}): Promise<ConnectionTestResult> {
  const env = deps.env ?? process.env
  const doFetch = deps.fetch ?? (fetch as FetchLike)
  const testedAt = new Date().toISOString()
  let outcome: { ok: boolean; detail: string; httpStatus: number | null }

  if (!providerConfigured(provider, env)) {
    outcome = { ok: false, detail: 'Not configured — required credentials are not set on the server.', httpStatus: null }
  } else if (provider === 'WHATSAPP') {
    outcome = await metaProbe(
      `https://graph.facebook.com/${graphVersion(env)}/${encodeURIComponent(env.WHATSAPP_PHONE_NUMBER_ID!.trim())}?fields=display_phone_number,verified_name`,
      env.WHATSAPP_TOKEN!.trim(), doFetch, 'WhatsApp Cloud API',
    )
  } else if (provider === 'MESSENGER') {
    outcome = await metaProbe(`https://graph.facebook.com/${graphVersion(env)}/me?fields=id,name`, env.FACEBOOK_PAGE_TOKEN!.trim(), doFetch, 'Messenger (Page token)')
  } else if (provider === 'INSTAGRAM') {
    outcome = await metaProbe(`https://graph.facebook.com/${graphVersion(env)}/me?fields=id,name`, env.INSTAGRAM_TOKEN!.trim(), doFetch, 'Instagram messaging token')
  } else if (provider === 'EMAIL') {
    const cfg = { host: env.SMTP_HOST!, port: Number(env.SMTP_PORT ?? 587), secure: env.SMTP_SECURE === 'true', user: env.SMTP_USER!, pass: env.SMTP_PASS! }
    try {
      if (deps.verifySmtp) await deps.verifySmtp(cfg)
      else {
        const nodemailer = await import('nodemailer')
        const transport = nodemailer.createTransport({ host: cfg.host, port: cfg.port, secure: cfg.secure, auth: { user: cfg.user, pass: cfg.pass }, connectionTimeout: 10_000, greetingTimeout: 10_000 })
        await transport.verify()
      }
      outcome = { ok: true, detail: `SMTP server ${cfg.host}:${cfg.port} accepted the login.`, httpStatus: null }
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'SMTP verify failed'
      outcome = { ok: false, detail: `SMTP verification failed: ${msg.replaceAll(cfg.pass, '[REDACTED]').slice(0, 200)}`, httpStatus: null }
    }
  } else {
    // N8N — adapter persists its own result under the same key.
    const r = await testN8nConnection({ fetch: deps.fetch, config: readN8nConfig(env) })
    return { provider, ok: r.ok, testedAt: r.testedAt, detail: r.detail, httpStatus: r.httpStatus }
  }

  const result: ConnectionTestResult = { provider, ok: outcome.ok, testedAt, detail: outcome.detail, httpStatus: outcome.httpStatus }
  if (deps.persist !== false) {
    await db.setting.upsert({
      where: { key: settingKey(provider) },
      create: { key: settingKey(provider), value: JSON.stringify(result) },
      update: { value: JSON.stringify(result) },
    }).catch(() => null)
  }
  return result
}

/** Honest state for every provider, from env presence + the last stored live test. */
export async function connectionStates(env: Env = process.env) {
  const rows: Array<{ key: string; value: string }> = await db.setting
    .findMany({ where: { key: { in: CONNECTION_PROVIDERS.map(settingKey) } }, select: { key: true, value: true } })
    .catch(() => [])
  const byKey = new Map<string, string>(rows.map((r) => [r.key, r.value] as const))
  return CONNECTION_PROVIDERS.map((provider) => {
    const configured = providerConfigured(provider, env)
    let last: Omit<ConnectionTestResult, 'provider'> | null = null
    try { last = byKey.has(settingKey(provider)) ? JSON.parse(byKey.get(settingKey(provider))!) : null } catch { last = null }
    const state: ConnectionState = !configured
      ? 'NOT_CONFIGURED'
      : !last
        ? 'CONFIGURED_UNTESTED'
        : last.ok ? 'CONNECTED' : 'FAILED'
    return {
      provider,
      configured,
      state,
      lastTest: configured && last ? { ok: last.ok, testedAt: last.testedAt, detail: last.detail, httpStatus: last.httpStatus ?? null } : null,
    }
  })
}
