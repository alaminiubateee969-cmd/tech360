/**
 * Validate an invoice amount as an exact decimal string and return integer
 * minor units. The current Prisma Invoice.amount column is Float, so callers
 * must still persist the derived number only as a compatibility limitation;
 * this helper prevents client-side totals and binary arithmetic from deciding
 * the amount accepted by this endpoint.
 */
export function parseInvoiceAmount(input: unknown): { cents: number; amount: number } | null {
  if (typeof input !== 'string') return null
  const value = input.trim()
  if (!/^\d{1,10}(?:\.\d{1,2})?$/.test(value)) return null

  const [whole = '', fractional = ''] = value.split('.')
  // The maximum is deliberately below Number.MAX_SAFE_INTEGER; these integer
  // minor-unit operations are exact even though the legacy DB column is Float.
  const cents = Number(whole) * 100 + Number(fractional.padEnd(2, '0'))
  if (!Number.isSafeInteger(cents) || cents <= 0 || cents > 999_999_999_999) return null

  return { cents, amount: cents / 100 }
}

export const INVOICE_CURRENCIES = ['USD', 'BDT', 'EUR', 'GBP'] as const
export type InvoiceCurrency = (typeof INVOICE_CURRENCIES)[number]

export function isInvoiceCurrency(input: unknown): input is InvoiceCurrency {
  return typeof input === 'string' && INVOICE_CURRENCIES.includes(input as InvoiceCurrency)
}
