import { NextRequest } from 'next/server'
import { guard, isResponse } from '@/lib/api-guard'
import { describeHostingerMailConfig, readHostingerMailConfig } from '@/lib/mail/hostinger-config'
import { createHostingerMailClient, verifyHostingerMailbox } from '@/lib/mail/hostinger-mail'
import { readInboundCheckpoint } from '@/lib/mail/hostinger-inbound'
import {
  HOSTINGER_AGENTIC_MAIL_PROVIDER,
  MAIL_ROLE_GRANTS,
  mailToolManifest,
  readHostingerMcpStatus,
} from '@/lib/mail/hostinger-agentic'
import { readMailLists } from '@/lib/mail/hostinger-lists'
import { channelConfigured } from '@/lib/comms'

export const dynamic = 'force-dynamic'

/**
 * GET /api/admin/mail/status[?verify=1]
 *
 * Operator view of the Hostinger Agentic Mail integration. It reports variable
 * NAMES and states only and never returns the token, the webhook secret, a
 * message body or any address beyond the configured sender.
 *
 * ?verify=1 makes read-only provider calls: GET /api/v1/me (mailbox identity),
 * the webhook list (is our endpoint actually registered?) and the quota. Those
 * calls are what turn "configured" into "verified" — without them the status is
 * only a claim about environment variables.
 */
export async function GET(req: NextRequest) {
  const g = await guard(req, { minRole: 'SUPER_ADMIN' })
  if (isResponse(g)) return g

  const config = describeHostingerMailConfig()
  const checkpoint = await readInboundCheckpoint().catch(() => null)
  const lists = await readMailLists().catch(() => null)
  const mcp = readHostingerMcpStatus()

  const expectedWebhookUrl = `${(process.env.APP_PUBLIC_URL ?? '').replace(/\/+$/, '')}/api/webhooks/hostinger-mail`
  const expectedWebhookConfigured = /^https:\/\/[^/]+/.test(expectedWebhookUrl)

  let verification: {
    ok: boolean
    mailboxConfirmed?: true
    webhookRegistered?: boolean
    webhooks?: Array<{ id: string; url: string; events: string[]; status: string }>
    quota?: { supported: boolean; percentage: number; totalUsage: number; totalLimit: number }
    problems?: string[]
  } | null = null

  if (new URL(req.url).searchParams.get('verify') === '1') {
    const status = readHostingerMailConfig()
    if (status.state !== 'CONFIGURED') {
      verification = {
        ok: false,
        problems: status.state === 'INVALID' ? status.problems : ['Hostinger Mail API is not enabled'],
      }
    } else {
      const client = createHostingerMailClient(status.config)
      const mailbox = await verifyHostingerMailbox(status.config, client)
      const problems: string[] = mailbox.ok ? [] : mailbox.problems
      let webhooks: Array<{ id: string; url: string; events: string[]; status: string }> | undefined
      let quota: { supported: boolean; percentage: number; totalUsage: number; totalLimit: number } | undefined
      if (mailbox.ok) {
        try {
          webhooks = (await client.listWebhooks()).map((w) => ({ id: w.id, url: w.url, events: w.events, status: w.status }))
        } catch {
          problems.push('The webhook list could not be read from Hostinger.')
        }
        try {
          const q = await client.getQuota()
          quota = { supported: q.supported, percentage: q.percentage, totalUsage: q.totalUsage, totalLimit: q.totalLimit }
        } catch {
          problems.push('The mailbox quota could not be read from Hostinger.')
        }
      }
      const webhookRegistered = webhooks
        ? webhooks.some((w) => w.url.replace(/\/+$/, '') === expectedWebhookUrl && w.status === 'active' && w.events.includes('message.received'))
        : undefined
      verification = {
        ok: problems.length === 0,
        ...(mailbox.ok ? { mailboxConfirmed: true as const } : {}),
        ...(webhookRegistered !== undefined ? { webhookRegistered } : {}),
        ...(webhooks ? { webhooks } : {}),
        ...(quota ? { quota } : {}),
        ...(problems.length ? { problems } : {}),
      }
    }
  }

  return Response.json({
    ok: true,
    provider: HOSTINGER_AGENTIC_MAIL_PROVIDER,
    hostingerMail: {
      state: config.state,
      problems: config.problems,
      webhookSecretConfigured: config.webhookSecretConfigured,
      senderChannelReady: channelConfigured('EMAIL'),
      expectedWebhookUrl,
      expectedWebhookUrlIsPublicHttps: expectedWebhookConfigured,
      inboundCheckpoint: checkpoint
        ? { lastUid: checkpoint.lastUid, lastRunAt: checkpoint.lastRunAt, lastSuccessAt: checkpoint.lastSuccessAt, lastImported: checkpoint.lastImported, lastError: checkpoint.lastError }
        : null,
      verification,
    },
    mcp: {
      state: mcp.state,
      profile: mcp.profile,
      configured: mcp.configured,
      problems: mcp.problems,
      note: mcp.state === 'CONFIGURED'
        ? 'Connection settings are present. Reachability is proven only by a live MCP call, which this endpoint does not make.'
        : 'The Agentic Mail MCP server is not connected to the tool gateway. Mail capabilities are unavailable to agents until it is.',
    },
    agentAuthority: {
      unrestrictedMailboxGranted: false,
      autoSendDraftAllowed: false,
      roles: Object.values(MAIL_ROLE_GRANTS).map((r) => ({
        role: r.role,
        label: r.label,
        agentCodes: r.agentCodes,
        capabilities: r.capabilities,
        maxApprovalLevel: r.maxApprovalLevel,
      })),
      tools: mailToolManifest(),
    },
    lists: lists
      ? {
          allowlist: lists.allowlist,
          blocklist: lists.blocklist,
          allowlistConfigured: lists.allowlistConfigured,
          blocklistConfigured: lists.blocklistConfigured,
          note: 'A block always wins. Provider-side blocks in hPanel are separate and are surfaced as blocked send errors, never retried.',
        }
      : null,
  }, { headers: { 'Cache-Control': 'no-store' } })
}
