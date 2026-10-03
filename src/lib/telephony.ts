/**
 * TECH360 — Call & SMS centre (telephony adapters)
 * ===============================================
 * Click-to-call, device SMS gateway and call logging for the CRM.
 *
 * Honest states, exactly like the communications adapters:
 *   - With no provider credentials, dialling still produces a real, logged
 *     call record and a device `tel:` URI, and the API reports
 *     `NOT_CONFIGURED` for server-side calling. It never claims a call was
 *     placed by a server that has no line.
 *   - The httpSMS-style device gateway (an Android phone acting as the SMS
 *     modem) is a first-class provider: base URL + API key + sender.
 */

export const TELEPHONY_PROVIDERS = ['DEVICE_GATEWAY', 'TWILIO', 'SIP', 'MANUAL'] as const
export type TelephonyProvider = (typeof TELEPHONY_PROVIDERS)[number]

export const CALL_STATUSES = ['LOGGED', 'CONNECTED', 'COMPLETED', 'MISSED', 'FAILED', 'NOT_CONFIGURED'] as const
export type CallStatus = (typeof CALL_STATUSES)[number]

export const CALL_CHANNELS = ['CLICK_TO_CALL', 'SIP', 'DEVICE_GATEWAY', 'MANUAL'] as const
export type CallChannel = (typeof CALL_CHANNELS)[number]

export type TelephonyState = {
  provider: TelephonyProvider | 'NONE'
  serverCalling: 'AVAILABLE' | 'NOT_CONFIGURED'
  smsGateway: 'AVAILABLE' | 'NOT_CONFIGURED'
  detail: string
}

/** Read the environment and report what can really be done right now. */
export function telephonyState(env: NodeJS.ProcessEnv = process.env): TelephonyState {
  const gatewayUrl = String(env.HTTPSMS_BASE_URL ?? '').trim()
  const gatewayKey = String(env.HTTPSMS_API_KEY ?? '').trim()
  const twilioSid = String(env.TWILIO_ACCOUNT_SID ?? '').trim()
  const twilioToken = String(env.TWILIO_AUTH_TOKEN ?? '').trim()
  const sipHost = String(env.SIP_DOMAIN ?? '').trim()

  const smsGateway = gatewayUrl && gatewayKey ? 'AVAILABLE' : 'NOT_CONFIGURED'
  if (twilioSid && twilioToken) {
    return { provider: 'TWILIO', serverCalling: 'AVAILABLE', smsGateway, detail: 'Twilio credentials present — server-side dialling and SMS are available.' }
  }
  if (sipHost) {
    return { provider: 'SIP', serverCalling: 'AVAILABLE', smsGateway, detail: `SIP domain ${sipHost} configured — the softphone dials; the server logs and follows up.` }
  }
  if (smsGateway === 'AVAILABLE') {
    return {
      provider: 'DEVICE_GATEWAY',
      serverCalling: 'NOT_CONFIGURED',
      smsGateway,
      detail: 'Device SMS gateway is configured (httpSMS-style). Server-side voice calling has no line, so calls are logged and dialled from the operator device.',
    }
  }
  return {
    provider: 'NONE',
    serverCalling: 'NOT_CONFIGURED',
    smsGateway: 'NOT_CONFIGURED',
    detail: 'No telephony provider is configured. Calls are logged with a device dial link; SMS refuses instead of pretending to send.',
  }
}

/** Digits-only E.164-ish normaliser; returns null when the number is unusable. */
export function normalizeDialNumber(input: string, defaultCountryCode = '44'): string | null {
  const raw = String(input ?? '').trim()
  if (!raw) return null
  const plus = raw.startsWith('+')
  let digits = raw.replace(/[^\d]/g, '')
  if (!digits) return null
  if (plus) return `+${digits}`.slice(0, 20)
  if (digits.startsWith('00')) digits = digits.slice(2)
  if (digits.startsWith('0')) return `+${defaultCountryCode}${digits.slice(1)}`.slice(0, 20)
  if (digits.length <= 10) return `+${defaultCountryCode}${digits}`.slice(0, 20)
  return `+${digits}`.slice(0, 20)
}

/**
 * Build the URI an operator device opens. `tel:` works everywhere; `sip:`
 * is used when a SIP domain is configured (softphone / linphone-style client).
 */
export function dialUri(number: string, channel: CallChannel, env: NodeJS.ProcessEnv = process.env): string {
  const e164 = normalizeDialNumber(number) ?? String(number)
  if (channel === 'SIP') {
    const domain = String(env.SIP_DOMAIN ?? '').trim()
    if (domain) return `sip:${e164.replace(/^\+/, '')}@${domain}`
  }
  return `tel:${e164}`
}

/** Outbound SMS through the device gateway. Refuses honestly when unconfigured. */
export async function sendDeviceSms(
  to: string,
  message: string,
  env: NodeJS.ProcessEnv = process.env,
): Promise<{ ok: true; id?: string } | { ok: false; state: 'NOT_CONFIGURED'; detail: string } | { ok: false; state: 'FAILED'; detail: string }> {
  const baseUrl = String(env.HTTPSMS_BASE_URL ?? '').trim().replace(/\/$/, '')
  const apiKey = String(env.HTTPSMS_API_KEY ?? '').trim()
  const from = String(env.HTTPSMS_FROM ?? '').trim()
  if (!baseUrl || !apiKey || !from) {
    return {
      ok: false,
      state: 'NOT_CONFIGURED',
      detail: 'Device SMS gateway is not configured (HTTPSMS_BASE_URL, HTTPSMS_API_KEY, HTTPSMS_FROM). No message was sent.',
    }
  }
  const e164 = normalizeDialNumber(to)
  if (!e164) return { ok: false, state: 'FAILED', detail: 'The destination number could not be normalised.' }
  try {
    const res = await fetch(`${baseUrl}/api/messages/send`, {
      method: 'POST',
      headers: { 'x-api-key': apiKey, 'content-type': 'application/json' },
      body: JSON.stringify({ from, to: e164, content: message.slice(0, 918) }),
    })
    if (!res.ok) return { ok: false, state: 'FAILED', detail: `Gateway responded HTTP ${res.status}.` }
    const body = (await res.json().catch(() => ({}))) as { data?: { id?: string } }
    return { ok: true, id: body?.data?.id }
  } catch (err) {
    return { ok: false, state: 'FAILED', detail: `Gateway request failed: ${(err as Error).message}` }
  }
}

/** Allowed transitions of a call record — the API validates against this. */
export function canTransitionCall(from: CallStatus, to: CallStatus): boolean {
  const allowed: Record<CallStatus, CallStatus[]> = {
    LOGGED: ['CONNECTED', 'MISSED', 'FAILED', 'COMPLETED', 'NOT_CONFIGURED'],
    CONNECTED: ['COMPLETED', 'FAILED'],
    COMPLETED: [],
    MISSED: [],
    FAILED: [],
    NOT_CONFIGURED: ['LOGGED'],
  }
  return allowed[from].includes(to)
}

/** Call outcomes the CRM reports on. */
export const CALL_OUTCOMES = ['INTERESTED', 'CALLBACK', 'NOT_INTERESTED', 'NO_ANSWER', 'WRONG_NUMBER', 'CLOSED_WON'] as const
export type CallOutcome = (typeof CALL_OUTCOMES)[number]
