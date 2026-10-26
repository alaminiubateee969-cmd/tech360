import { NextRequest } from 'next/server'
import { guard, isResponse } from '@/lib/api-guard'
import { describeHostingerMailConfig, readHostingerMailConfig } from '@/lib/mail/hostinger-config'
import { createHostingerMailClient, verifyHostingerMailbox } from '@/lib/mail/hostinger-mail'
import { readInboundCheckpoint } from '@/lib/mail/hostinger-inbound'

export const dynamic = 'force-dynamic'

/**
 * GET /api/admin/mail/status[?verify=1]
 *
 * Operator view of the Hostinger Mail API integration. It reports variable
 * NAMES and states only. With ?verify=1 it makes one read-only call to
 * GET /api/v1/me to confirm the mailbox resource id and sender address.
 * No token, webhook secret or message content is returned.
 */
export async function GET(req: NextRequest) {
  const g = await guard(req, { minRole: 'SUPER_ADMIN' })
  if (isResponse(g)) return g

  const config = describeHostingerMailConfig()
  const checkpoint = await readInboundCheckpoint().catch(() => null)

  let verification: { ok: true; mailboxConfirmed: true } | { ok: false; problems: string[] } | null = null
  if (new URL(req.url).searchParams.get('verify') === '1') {
    const status = readHostingerMailConfig()
    if (status.state !== 'CONFIGURED') {
      verification = { ok: false, problems: status.state === 'INVALID' ? status.problems : ['Hostinger Mail API is not enabled'] }
    } else {
      const result = await verifyHostingerMailbox(status.config, createHostingerMailClient(status.config))
      verification = result.ok ? { ok: true, mailboxConfirmed: true } : { ok: false, problems: result.problems }
    }
  }

  return Response.json({
    ok: true,
    hostingerMail: {
      state: config.state,
      problems: config.problems,
      webhookSecretConfigured: config.webhookSecretConfigured,
      inboundCheckpoint: checkpoint
        ? { lastUid: checkpoint.lastUid, lastRunAt: checkpoint.lastRunAt, lastSuccessAt: checkpoint.lastSuccessAt, lastImported: checkpoint.lastImported, lastError: checkpoint.lastError }
        : null,
      verification,
    },
  }, { headers: { 'Cache-Control': 'no-store' } })
}
