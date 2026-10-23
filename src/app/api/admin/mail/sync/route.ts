import { NextRequest } from 'next/server'
import { guard, isResponse } from '@/lib/api-guard'
import { audit } from '@/lib/security'
import { syncHostingerInbox } from '@/lib/mail/hostinger-inbound'

export const dynamic = 'force-dynamic'

/**
 * POST /api/admin/mail/sync — run one bounded, checkpointed inbox sync now.
 * Reads INBOX through the documented API; never deletes or moves mail.
 * Requires an authenticated SUPER_ADMIN and the CSRF token (guard default).
 */
export async function POST(req: NextRequest) {
  const g = await guard(req, { minRole: 'SUPER_ADMIN' })
  if (isResponse(g)) return g

  const summary = await syncHostingerInbox({ maxPages: 3, maxMessages: 25 })
  await audit({
    actor: g.user.email,
    action: 'HOSTINGER_INBOX_SYNC',
    details: { stopped: summary.stopped, scanned: summary.scanned, imported: summary.imported, duplicates: summary.duplicates, unmatched: summary.unmatched },
  }).catch(() => null)

  // The error text is already value-free (see describeSyncFailure); it is returned so an operator can act on it.
  return Response.json({ ok: summary.stopped !== 'ERROR' && summary.stopped !== 'NOT_CONFIGURED', summary }, { headers: { 'Cache-Control': 'no-store' } })
}
