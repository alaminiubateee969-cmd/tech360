// ============================================================
// TECH360 — Single source of truth for public contact details
//
// OWNER DECISION (2026-10-24): TECH360 must NOT publish a WhatsApp
// number or wa.me deep link on any public surface. The previous
// public number has been removed from the site, the legal pages, the
// portal, structured data and every shared component.
//
// Public enquiry routes that remain (and must keep working):
//   1. The on-site AI assistant / webchat widget (no WhatsApp
//      account or phone number needed).
//   2. The project enquiry form at #contact (POST /api/contact).
//   3. Email: info@bdtech360.com.
//
// Private CRM messaging (the WhatsApp Cloud API adapter, inbound
// webhook and outbound agent channel) is a *business* integration
// and is NOT affected by this decision — it is never published as
// a public contact route.
// ============================================================

export const PUBLIC_CONTACT = {
  /** Public business email — the canonical public contact channel. */
  email: 'info@bdtech360.com',
  /** Public site origin. */
  url: 'https://bdtech360.com',
  /** Contact anchor on the public site (webchat + enquiry form). */
  contactUrl: 'https://bdtech360.com/#contact',
  /** Human-readable list of the public enquiry routes (for copy and docs). */
  channels: ['webchat', 'enquiry-form', 'email'] as const,
} as const

/** Company legal identity — US registration details for legal pages. */
export const COMPANY_CONTACT = {
  legalName: 'TECH360 LLC',
  brand: 'Tech360',
  domain: 'bdtech360.com',
  url: PUBLIC_CONTACT.url,
  email: PUBLIC_CONTACT.email,
  /** US legal office (registration address). */
  usAddress: '117 S Lexington St Ste 100, Harrisonville, MO 64701, USA',
  usPhone: '+1 (816) 380-8660',
  missouriLLC: 'LC014737249',
  ein: '98-1940053',
  founded: 2021,
} as const
