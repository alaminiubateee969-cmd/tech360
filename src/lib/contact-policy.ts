export type WelcomeChannel = 'WHATSAPP' | 'EMAIL' | 'SMS' | null

export function hasExplicitContactConsent(value: unknown): boolean {
  return value === true
}

/**
 * Inbound messages receive a reply on their original channel; website leads use only their chosen method.
 *
 * SMS is a first-class entry channel of the client journey (the pipeline
 * starts from "the first SMS"), so an SMS lead is answered on SMS.
 */
export function selectWelcomeChannel(source: string, preferredContact?: string | null): WelcomeChannel {
  const inbound = source.trim().toUpperCase()
  if (inbound.includes('WHATSAPP')) return 'WHATSAPP'
  if (inbound.includes('EMAIL')) return 'EMAIL'
  if (inbound.includes('SMS')) return 'SMS'
  const preference = preferredContact?.trim().toLowerCase()
  if (preference === 'whatsapp') return 'WHATSAPP'
  if (preference === 'email') return 'EMAIL'
  if (preference === 'sms') return 'SMS'
  // A "phone" preference means a call, and unknown preferences need a
  // human; they must not silently fall back to a different, unselected
  // channel.
  return null
}
