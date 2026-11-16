// ============================================================
// TECH360 — Hostinger Agentic Mail recipient lists (server-only)
//
// Stores the allow list and block list in the existing `Setting` table
// (additive, no migration) and records every change in the audit log with the
// actor, the previous value and the new value.
//
// Rules:
//   - Only a SUPER_ADMIN route may call `replaceRecipientList` (the API route
//     enforces the role; this module additionally refuses an empty actor).
//   - Addresses are normalized and validated before storage, so a typo cannot
//     silently open or close the gate.
//   - A block wins over an allow (see `decideRecipient`).
// ============================================================

import { db } from '@/lib/db'
import { audit } from '@/lib/security'
import { normalizeRecipient } from './hostinger-agentic'

export const MAIL_LIST_KEYS = {
  allow: 'mail.allowlist',
  block: 'mail.blocklist',
} as const

export type MailListKind = keyof typeof MAIL_LIST_KEYS

export type MailLists = { allowlist: string[]; blocklist: string[] }

const MAX_LIST_ENTRIES = 500

async function readSetting(key: string): Promise<string[] | null> {
  const row = await db.setting.findUnique({ where: { key } })
  if (!row) return null
  try {
    const parsed = JSON.parse(row.value) as unknown
    if (!Array.isArray(parsed)) return null
    return parsed.filter((v): v is string => typeof v === 'string')
  } catch {
    return null
  }
}

/**
 * Read both lists. A missing row means "no list configured" (empty). A stored
 * but unparseable row also fails closed to empty, and both cases are reported
 * so the admin view never implies a gate that is not actually in force.
 */
export async function readMailLists(): Promise<MailLists & { allowlistConfigured: boolean; blocklistConfigured: boolean }> {
  const [allow, block] = await Promise.all([readSetting(MAIL_LIST_KEYS.allow), readSetting(MAIL_LIST_KEYS.block)])
  return {
    allowlist: allow ?? [],
    blocklist: block ?? [],
    allowlistConfigured: allow !== null,
    blocklistConfigured: block !== null,
  }
}

export type ReplaceListResult =
  | { ok: true; list: string[]; added: string[]; removed: string[]; duplicateCount: number; invalidCount: number }
  | { ok: false; code: 'EMPTY_ACTOR' | 'TOO_MANY_ENTRIES' | 'NO_VALID_ENTRIES'; reason: string }

/**
 * Replace one list. Returns the diff so the audit trail shows exactly what an
 * operator changed. Invalid addresses are reported, never silently accepted.
 */
export async function replaceRecipientList(
  kind: MailListKind,
  addresses: readonly string[],
  actor: string,
): Promise<ReplaceListResult> {
  const trimmedActor = actor.trim()
  if (!trimmedActor) return { ok: false, code: 'EMPTY_ACTOR', reason: 'An authenticated actor is required to change a mail list.' }
  if (addresses.length > MAX_LIST_ENTRIES) {
    return { ok: false, code: 'TOO_MANY_ENTRIES', reason: `A list may hold at most ${MAX_LIST_ENTRIES} addresses.` }
  }

  const normalized: string[] = []
  let invalidCount = 0
  let duplicateCount = 0
  for (const raw of addresses) {
    const value = normalizeRecipient(raw)
    if (!value) { invalidCount += 1; continue }
    if (normalized.includes(value)) { duplicateCount += 1; continue }
    normalized.push(value)
  }
  if (normalized.length === 0 && addresses.length > 0) {
    return { ok: false, code: 'NO_VALID_ENTRIES', reason: 'None of the supplied addresses is valid; the list was not changed.' }
  }

  const key = MAIL_LIST_KEYS[kind]
  const previous = (await readSetting(key)) ?? []
  await db.setting.upsert({
    where: { key },
    create: { key, value: JSON.stringify(normalized) },
    update: { value: JSON.stringify(normalized) },
  })

  const added = normalized.filter((a) => !previous.includes(a))
  const removed = previous.filter((a) => !normalized.includes(a))
  await audit({
    actor: `user:${trimmedActor}`,
    action: kind === 'block' ? 'MAIL_BLOCKLIST_CHANGED' : 'MAIL_ALLOWLIST_CHANGED',
    entityType: 'Setting',
    entityId: key,
    details: { added, removed, total: normalized.length, invalidCount, duplicateCount },
  })

  return { ok: true, list: normalized, added, removed, duplicateCount, invalidCount }
}
