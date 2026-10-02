/**
 * Phone number → E.164 (+<country><number>). Dependency-free.
 * Bangladesh-aware: local "01XXXXXXXXX" (11 digits) → "+8801XXXXXXXXX".
 * Returns null when the input cannot be a phone number.
 */
export function toE164(input: string, defaultCountryCode = '880'): string | null {
  const raw = (input ?? '').trim()
  if (!raw) return null
  const hasPlus = raw.startsWith('+')
  let digits = raw.replace(/[^\d]/g, '')
  if (!digits) return null
  if (hasPlus) {
    // keep as-is
  } else if (digits.startsWith('00')) {
    digits = digits.slice(2)
  } else if (digits.startsWith('0')) {
    digits = defaultCountryCode + digits.slice(1)
  } else if (defaultCountryCode === '880' && digits.length === 10 && digits.startsWith('1')) {
    digits = defaultCountryCode + digits
  }
  if (digits.length < 8 || digits.length > 15) return null
  return `+${digits}`
}
