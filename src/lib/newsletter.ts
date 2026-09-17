import { createHmac, timingSafeEqual } from 'crypto'

// ============================================================
// TECH360 NEWSLETTER — shared helpers for the newsletter surface
//
// 1. Unsubscribe tokens — stateless HMAC-signed links (same
//    pattern as lib/portal.ts client-portal sessions): the token
//    payload carries the subscriber email + purpose + expiry, so
//    /api/newsletter/unsubscribe can verify a link without a DB
//    lookup and the send route can mint one per subscriber.
// 2. Campaign body sanitizer — AI drafts (and admin edits) are
//    stored raw but sanitized on write AND re-sanitized on read
//    paths so a <script> or on* handler can never reach a client
//    inbox through a campaign body.
// ============================================================

const UNSUB_PURPOSE = 'newsletter-unsub'
const UNSUB_TTL_DAYS = 30

function newsletterSecret(): string {
  return process.env.PORTAL_SECRET ?? process.env.OPS_SECRET ?? process.env.SESSION_SECRET ?? 'tech360-newsletter-dev-secret'
}

/** base64url — an email-safe encoding with no '.' (our token separator). */
function b64url(s: string): string {
  return Buffer.from(s, 'utf8').toString('base64url')
}

function unb64url(s: string): string {
  try {
    return Buffer.from(s, 'base64url').toString('utf8')
  } catch {
    return ''
  }
}

/** Sign an unsubscribe token for a subscriber email (~30 day expiry). */
export function signUnsubToken(email: string): string {
  const enc = b64url(email.trim().toLowerCase())
  const expiry = Date.now() + UNSUB_TTL_DAYS * 24 * 3600 * 1000
  const payload = `${UNSUB_PURPOSE}.${enc}.${expiry}`
  const sig = createHmac('sha256', newsletterSecret()).update(payload).digest('hex')
  return `${payload}.${sig}`
}

/**
 * Verify an unsubscribe token. Returns the subscriber email when the
 * signature is valid and unexpired; null otherwise.
 */
export function verifyUnsubToken(token: string | undefined | null): string | null {
  if (!token) return null
  const parts = token.split('.')
  if (parts.length !== 4) return null
  const [purpose, enc, expiry, sig] = parts
  if (purpose !== UNSUB_PURPOSE || !enc) return null
  const email = unb64url(enc)
  if (!email || !email.includes('@')) return null
  const expected = createHmac('sha256', newsletterSecret()).update(`${purpose}.${enc}.${expiry}`).digest('hex')
  try {
    const a = Buffer.from(sig)
    const b = Buffer.from(expected)
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null
  } catch {
    return null
  }
  if (Number(expiry) < Date.now()) return null
  return email
}

// ------------------------------------------------------------
// Campaign body sanitizer — simple HTML paragraphs only
// ------------------------------------------------------------
const MAX_CAMPAIGN_BODY = 20000

/**
 * Strip everything dangerous from an AI-drafted / admin-edited
 * campaign body: <script>/<style>/<iframe> blocks entirely, then any
 * remaining on* event-handler attributes and javascript: URLs.
 * Length is capped at 20,000 characters.
 */
export function sanitizeCampaignHtml(input: unknown): string {
  if (typeof input !== 'string') return ''
  let s = input
  // remove whole dangerous elements (with content)
  s = s.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
  s = s.replace(/<\/script>/gi, '')
  s = s.replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '')
  s = s.replace(/<\/style>/gi, '')
  s = s.replace(/<iframe\b[^>]*>[\s\S]*?<\/iframe>/gi, '')
  s = s.replace(/<iframe\b[^>]*\/?>/gi, '')
  // strip inline event handlers (onclick=… onload='…' etc.)
  s = s.replace(/\son[a-z]+\s*=\s*"[^"]*"/gi, '')
  s = s.replace(/\son[a-z]+\s*=\s*'[^']*'/gi, '')
  s = s.replace(/\son[a-z]+\s*=\s*[^\s>]+/gi, '')
  // strip javascript: URLs in href/src
  s = s.replace(/(href|src)\s*=\s*("|')?\s*javascript:[^"'\s>]*("|')?/gi, '$1="#"')
  return s.trim().slice(0, MAX_CAMPAIGN_BODY)
}

/** Plain-text preview of a campaign body (for cards / lists). */
export function campaignExcerpt(body: string, max = 180): string {
  const text = body
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim()
  return text.length > max ? `${text.slice(0, max - 1)}…` : text
}
