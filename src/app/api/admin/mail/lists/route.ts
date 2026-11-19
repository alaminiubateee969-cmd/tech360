import { NextRequest } from 'next/server'
import { guard, isResponse } from '@/lib/api-guard'
import { readJson, sanitizeText } from '@/lib/security'
import { readMailLists, replaceRecipientList } from '@/lib/mail/hostinger-lists'

export const dynamic = 'force-dynamic'

function json(body: Record<string, unknown>, status = 200): Response {
  return Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } })
}

/**
 * GET /api/admin/mail/lists — the allow list and block list in force.
 * PUT /api/admin/mail/lists — replace one list (SUPER_ADMIN only, audited).
 *
 * The provider (hPanel) also has its own allow/block lists. This route governs
 * what TECH360 sends; a provider-side block still rejects the message and is
 * surfaced as a blocked error, never retried.
 */
export async function GET(req: NextRequest) {
  const g = await guard(req, { minRole: 'ADMIN' })
  if (isResponse(g)) return g
  const lists = await readMailLists()
  return json({ ok: true, ...lists })
}

export async function PUT(req: NextRequest) {
  const g = await guard(req, { minRole: 'SUPER_ADMIN' })
  if (isResponse(g)) return g
  const raw = await readJson(req)
  const kind = sanitizeText(raw.kind, 8).toLowerCase()
  if (kind !== 'allow' && kind !== 'block') return json({ ok: false, error: 'kind must be "allow" or "block".' }, 400)
  const addresses = Array.isArray(raw.addresses)
    ? raw.addresses.filter((a: unknown): a is string => typeof a === 'string').slice(0, 600)
    : null
  if (!addresses) return json({ ok: false, error: 'addresses must be an array of email addresses.' }, 400)

  const result = await replaceRecipientList(kind, addresses, g.user.email)
  if (!result.ok) return json({ ok: false, code: result.code, error: result.reason }, 400)
  return json({
    ok: true,
    kind,
    total: result.list.length,
    added: result.added,
    removed: result.removed,
    ignoredInvalid: result.invalidCount,
    ignoredDuplicates: result.duplicateCount,
    message: `The ${kind} list now holds ${result.list.length} address(es). The change is recorded in the audit log.`,
  })
}
