'use client'

/**
 * FIRST-TOUCH ATTRIBUTION (client side)
 *
 * The site is a single-page app using hash routing, so campaign parameters can
 * arrive on the real query string (`/?utm_source=…`) or after the hash
 * (`/#/contact?utm_source=…`). This module reads both, keeps the earliest
 * observation in `sessionStorage` as the first touch, and hands the server a
 * small allowlisted payload.
 *
 * Privacy rules:
 *  - Only the allowlisted marketing keys are collected; nothing else is read
 *    from the URL and nothing is sent to a third party.
 *  - `sessionStorage` only (no cookies, no persistent device identifier), and
 *    every access is wrapped because storage can throw in private mode.
 *  - The server re-sanitizes and re-validates everything; this payload is
 *    untrusted input, not proof of anything.
 */

const FIRST_TOUCH_KEY = 't360:first-touch:v1'

const ALLOWED_KEYS = [
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_term',
  'utm_content',
  'gclid',
  'fbclid',
  'ttclid',
  'msclkid',
] as const

export type FirstTouch = Partial<Record<(typeof ALLOWED_KEYS)[number], string>>

/** Extract the allowlisted campaign keys from a raw query string (with or without `?`). */
export function parseCampaignParams(rawQuery: string): FirstTouch {
  const result: FirstTouch = {}
  if (!rawQuery) return result
  const query = rawQuery.startsWith('?') ? rawQuery.slice(1) : rawQuery
  if (!query) return result
  let params: URLSearchParams
  try {
    params = new URLSearchParams(query)
  } catch {
    return result
  }
  for (const key of ALLOWED_KEYS) {
    const value = params.get(key)
    if (value) {
      const trimmed = value.trim().slice(0, 200)
      if (trimmed) result[key] = trimmed
    }
  }
  return result
}

function safeGetStorage(): Storage | null {
  if (typeof window === 'undefined') return null
  try {
    return window.sessionStorage
  } catch {
    return null
  }
}

/** Read the stored first touch, if any. */
export function readFirstTouch(): FirstTouch | null {
  const storage = safeGetStorage()
  if (!storage) return null
  try {
    const raw = storage.getItem(FIRST_TOUCH_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') return null
    const clean: FirstTouch = {}
    for (const key of ALLOWED_KEYS) {
      const value = (parsed as Record<string, unknown>)[key]
      if (typeof value === 'string' && value) clean[key] = value.slice(0, 200)
    }
    return Object.keys(clean).length > 0 ? clean : null
  } catch {
    return null
  }
}

/** Persist the first touch once per browsing session. */
export function storeFirstTouchIfEmpty(params: FirstTouch): FirstTouch | null {
  const storage = safeGetStorage()
  const existing = readFirstTouch()
  if (existing) return existing
  if (Object.keys(params).length === 0) return null
  if (!storage) return params
  try {
    storage.setItem(FIRST_TOUCH_KEY, JSON.stringify(params))
  } catch {
    // Storage unavailable — the in-memory value is still returned.
  }
  return params
}

/**
 * Resolve the tracking payload for the contact form:
 *  - `utm`: first touch if one was already stored, otherwise the current page's
 *    campaign parameters (which are then stored as the first touch);
 *  - `ref`: the external referrer host;
 *  - `path`: the landing path without query (the server normalizes again).
 */
export function getContactTracking(): { ref: string | null; path: string | null; utm: FirstTouch } {
  if (typeof window === 'undefined') return { ref: null, path: null, utm: {} }

  const searchParams = parseCampaignParams(window.location.search)
  const hash = window.location.hash || ''
  const hashQueryIndex = hash.indexOf('?')
  const hashParams = hashQueryIndex >= 0 ? parseCampaignParams(hash.slice(hashQueryIndex)) : {}

  const current = { ...searchParams, ...hashParams }
  const firstTouch = storeFirstTouchIfEmpty(current) ?? current

  let ref: string | null = null
  try {
    if (document.referrer) {
      ref = new URL(document.referrer).hostname.toLowerCase()
    }
  } catch {
    ref = null
  }

  const path = window.location.pathname.split('?')[0].split('#')[0] || '/'

  return { ref, path, utm: firstTouch }
}
