// ============================================================
// TECH360 — Single source of truth for public contact details
// Requirement H: Use +8801327100297 as approved public WhatsApp
// and info@bdtech360.com as public email. One shared configuration
// source for header, footer, contact page, WhatsApp button and
// email links. No conflicting hardcoded contact details.
// ============================================================

export const PUBLIC_CONTACT = {
  /** Public WhatsApp number in E.164 — used for wa.me links and display. */
  whatsappE164: '+8801327100297',
  /** Human-readable display (same as E.164, no formatting ambiguity). */
  whatsappDisplay: '+8801327100297',
  /** Digits-only variant for wa.me URLs. */
  get whatsappDigits(): string {
    return this.whatsappE164.replace(/[^0-9]/g, '')
  },
  /** wa.me deep link — the free, public entry point (no Cloud API claim). */
  get whatsappLink(): string {
    return `https://wa.me/${this.whatsappDigits}?text=${encodeURIComponent("Hi Tech360, I'd like to discuss a project.")}`
  },
  /** Public business email — formal communication canonical channel. */
  email: 'info@bdtech360.com',
  /** Public site origin. */
  url: 'https://bdtech360.com',
  /** Contact anchor on the public site. */
  contactUrl: 'https://bdtech360.com/#contact',
} as const

/** Company legal identity — US registration + BD public contact. */
export const COMPANY_CONTACT = {
  legalName: 'TECH360 LLC',
  brand: 'Tech360',
  domain: 'bdtech360.com',
  url: PUBLIC_CONTACT.url,
  email: PUBLIC_CONTACT.email,
  publicWhatsApp: PUBLIC_CONTACT.whatsappE164,
  /** US legal office (registration address). */
  usAddress: '117 S Lexington St Ste 100, Harrisonville, MO 64701, USA',
  usPhone: '+1 (816) 380-8660',
  missouriLLC: 'LC014737249',
  ein: '98-1940053',
  founded: 2021,
} as const
