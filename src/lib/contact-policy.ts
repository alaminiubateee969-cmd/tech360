export type WelcomeChannel = 'WHATSAPP' | 'EMAIL' | null

export function hasExplicitContactConsent(value: unknown): boolean {
  return value === true
}

/** Inbound messages receive a reply on their original channel; website leads use only their chosen method. */
export function selectWelcomeChannel(source: string, preferredContact?: string | null): WelcomeChannel {
  const inbound = source.trim().toUpperCase()
  if (inbound.includes('WHATSAPP')) return 'WHATSAPP'
  if (inbound.includes('EMAIL')) return 'EMAIL'
  const preference = preferredContact?.trim().toLowerCase()
  if (preference === 'whatsapp') return 'WHATSAPP'
  if (preference === 'email') return 'EMAIL'
  // Phone calls and unknown preferences need a human; they must not silently
  // fall back to a different, unselected channel.
  return null
}
