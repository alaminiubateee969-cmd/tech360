export type PortalOtpMode = 'off' | 'required'

/** Production never falls back to Client ID + contact matching without OTP. */
export function resolvePortalOtpMode(
  configured: string | null | undefined,
  nodeEnv: string | null | undefined,
): PortalOtpMode {
  if (nodeEnv === 'production') return 'required'
  return configured?.trim().toLowerCase() === 'off' ? 'off' : 'required'
}
