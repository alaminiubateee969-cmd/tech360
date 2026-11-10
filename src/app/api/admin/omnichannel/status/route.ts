import { NextRequest } from 'next/server'
import { guard, isResponse } from '@/lib/api-guard'
import { channelStatuses } from '@/lib/comms'
import { getAgentProviderStatus } from '@/lib/agents/provider-selection'
import { CORE_AGENTS } from '@/lib/agents/registry'
import { describeHostingerMailConfig } from '@/lib/mail/hostinger-config'
import { db } from '@/lib/db'
import { json } from '@/lib/security'

export const dynamic = 'force-dynamic'

/**
 * GET /api/admin/omnichannel/status
 *
 * Omnichannel integration status matrix for the Super Admin.
 *
 * Reports the REAL configuration state of every customer communication
 * channel — never a claim that an unconfigured channel is working.
 * No credential value is ever returned; only variable NAMES and states.
 *
 * Channels covered (master spec §3):
 *   1. Website WebChat        — always available (DB-backed)
 *   2. Website contact forms  — always available (DB-backed)
 *   3. Business email         — Hostinger Mail API or SMTP
 *   4. WhatsApp               — Meta Cloud API
 *   5. SMS                    — httpSMS or generic SMS gateway
 *   6. Facebook Messenger     — relayed via n8n (SOCIAL_WEBHOOK_SECRET)
 *   7. Instagram messaging    — relayed via n8n
 *   8. LinkedIn messaging     — relayed via n8n (where authorized APIs allow)
 *   9. X messaging            — relayed via n8n (where authorized APIs allow)
 *  10. Manual Super Admin     — always available (admin communications)
 *
 * WebChat / Email AI root-cause diagnostics are included so an operator
 * can see exactly which environment variables are missing on the host.
 */
export async function GET(req: NextRequest) {
  const g = await guard(req, { minRole: 'SUPER_ADMIN' })
  if (isResponse(g)) return g

  const channels = channelStatuses()
  const aiProvider = getAgentProviderStatus()
  const hostingerMail = describeHostingerMailConfig()
  const persistedAgents = await db.aiAgent.count({ where: { status: 'ACTIVE' } }).catch(() => 0)

  const has = (name: string) => Boolean((process.env[name] ?? '').trim())
  const sessionSecret = process.env.SESSION_SECRET ?? ''
  const sessionSecretValidLength = Buffer.byteLength(sessionSecret, 'utf8') >= 32

  const socialRelayConfigured = has('SOCIAL_WEBHOOK_SECRET')

  const matrix = [
    {
      id: 'webchat',
      name: 'Website WebChat',
      state: 'CONFIGURED' as const,
      detail: 'DB-backed widget → session → message API → CRM → AI gateway. AI replies require a configured AI provider (see aiProvider).',
      requiredEnv: [] as string[],
      missingEnv: [] as string[],
    },
    {
      id: 'contact-form',
      name: 'Website contact forms',
      state: 'CONFIGURED' as const,
      detail: 'Consent-evidenced form submissions create CRM leads with Client IDs.',
      requiredEnv: [] as string[],
      missingEnv: [] as string[],
    },
    {
      id: 'email',
      name: 'Business email (info@bdtech360.com)',
      state: (channels.EMAIL ? 'CONFIGURED' : 'NOT_CONFIGURED') as 'CONFIGURED' | 'NOT_CONFIGURED',
      detail: channels.EMAIL
        ? 'Outbound email is configured. Inbound requires the webhook secret below.'
        : 'Outbound email is NOT configured — sends are refused with NOT_CONFIGURED. Set the Hostinger Mail API variables or SMTP variables on the host.',
      requiredEnv: ['HOSTINGER_MAIL_ENABLED', 'HOSTINGER_MAIL_API_TOKEN', 'HOSTINGER_MAILBOX_RESOURCE_ID', 'HOSTINGER_MAIL_FROM_ADDRESS', 'HOSTINGER_MAIL_WEBHOOK_SECRET'],
      missingEnv: channels.EMAIL
        ? []
        : ['HOSTINGER_MAIL_ENABLED', 'HOSTINGER_MAIL_API_TOKEN', 'HOSTINGER_MAILBOX_RESOURCE_ID', 'HOSTINGER_MAIL_FROM_ADDRESS'].filter((n) => !has(n)),
      hostingerMailState: hostingerMail.state,
      hostingerMailProblems: hostingerMail.problems,
    },
    {
      id: 'whatsapp',
      name: 'WhatsApp',
      state: (channels.WHATSAPP ? 'CONFIGURED' : 'NOT_CONFIGURED') as 'CONFIGURED' | 'NOT_CONFIGURED',
      detail: channels.WHATSAPP
        ? 'Meta Cloud API credentials are present.'
        : 'WHATSAPP_TOKEN / WHATSAPP_PHONE_NUMBER_ID / WHATSAPP_APP_SECRET are not set — sends and inbound verification are refused.',
      requiredEnv: ['WHATSAPP_TOKEN', 'WHATSAPP_PHONE_NUMBER_ID', 'WHATSAPP_APP_SECRET', 'WHATSAPP_VERIFY_TOKEN'],
      missingEnv: ['WHATSAPP_TOKEN', 'WHATSAPP_PHONE_NUMBER_ID', 'WHATSAPP_APP_SECRET', 'WHATSAPP_VERIFY_TOKEN'].filter((n) => !has(n)),
    },
    {
      id: 'sms',
      name: 'SMS',
      state: (channels.SMS ? 'CONFIGURED' : 'NOT_CONFIGURED') as 'CONFIGURED' | 'NOT_CONFIGURED',
      detail: channels.SMS
        ? 'An SMS provider is configured.'
        : 'No SMS provider is configured — sends are refused with NOT_CONFIGURED.',
      requiredEnv: ['HTTPSMS_API_KEY', 'HTTPSMS_FROM', 'SMS_API_URL', 'SMS_API_KEY'],
      missingEnv: [],
    },
    {
      id: 'facebook',
      name: 'Facebook Messenger',
      state: (socialRelayConfigured ? 'CONFIGURED' : 'NOT_CONFIGURED') as 'CONFIGURED' | 'NOT_CONFIGURED',
      detail: socialRelayConfigured
        ? 'Social relay secret is set; inbound messages are accepted via the n8n relay.'
        : 'SOCIAL_WEBHOOK_SECRET is not set — inbound social messages are refused (503).',
      requiredEnv: ['SOCIAL_WEBHOOK_SECRET'],
      missingEnv: socialRelayConfigured ? [] : ['SOCIAL_WEBHOOK_SECRET'],
    },
    {
      id: 'instagram',
      name: 'Instagram messaging',
      state: (socialRelayConfigured ? 'CONFIGURED' : 'NOT_CONFIGURED') as 'CONFIGURED' | 'NOT_CONFIGURED',
      detail: socialRelayConfigured
        ? 'Social relay secret is set; inbound messages are accepted via the n8n relay.'
        : 'SOCIAL_WEBHOOK_SECRET is not set — inbound social messages are refused (503).',
      requiredEnv: ['SOCIAL_WEBHOOK_SECRET'],
      missingEnv: socialRelayConfigured ? [] : ['SOCIAL_WEBHOOK_SECRET'],
    },
    {
      id: 'linkedin',
      name: 'LinkedIn messaging',
      state: (socialRelayConfigured ? 'CONFIGURED' : 'NOT_CONFIGURED') as 'CONFIGURED' | 'NOT_CONFIGURED',
      detail: socialRelayConfigured
        ? 'Social relay secret is set; inbound messages are accepted where authorized APIs allow.'
        : 'SOCIAL_WEBHOOK_SECRET is not set — inbound social messages are refused (503).',
      requiredEnv: ['SOCIAL_WEBHOOK_SECRET'],
      missingEnv: socialRelayConfigured ? [] : ['SOCIAL_WEBHOOK_SECRET'],
    },
    {
      id: 'x',
      name: 'X messaging',
      state: (socialRelayConfigured ? 'CONFIGURED' : 'NOT_CONFIGURED') as 'CONFIGURED' | 'NOT_CONFIGURED',
      detail: socialRelayConfigured
        ? 'Social relay secret is set; inbound messages are accepted where authorized APIs allow.'
        : 'SOCIAL_WEBHOOK_SECRET is not set — inbound social messages are refused (503).',
      requiredEnv: ['SOCIAL_WEBHOOK_SECRET'],
      missingEnv: socialRelayConfigured ? [] : ['SOCIAL_WEBHOOK_SECRET'],
    },
    {
      id: 'manual-admin',
      name: 'Manual Super Admin messages',
      state: 'CONFIGURED' as const,
      detail: 'Operator-composed messages via the admin communications API; always logged to the CRM timeline.',
      requiredEnv: [] as string[],
      missingEnv: [] as string[],
    },
  ]

  return json({
    ok: true,
    checkedAt: new Date().toISOString(),
    channels: matrix,
    aiProvider: {
      provider: aiProvider.provider,
      state: aiProvider.state,
      configured: aiProvider.configured,
      detail: aiProvider.detail,
      activeAgentsInDb: persistedAgents,
      canonicalCoreAgents: CORE_AGENTS.length,
      lazyAgentBootstrapEnabled: true,
      // Root cause for "WebChat AI not working": when configured=false the
      // orchestrator returns the honest fallback (message saved, escalated
      // to a human) instead of an AI reply. Set one of these on the host:
      requiredEnv: ['AI_GATEWAY_BASE_URL + AGENTOS_GATEWAY_TOKEN', 'OPENROUTER_API_KEY', 'ZAI_BASE_URL + ZAI_API_KEY'],
    },
    emailWebhook: {
      // Root cause for "Email AI not working": the inbound webhook fails
      // closed (503) until EMAIL_WEBHOOK_SECRET is set, and outbound email
      // is refused until the Hostinger Mail API or SMTP is configured.
      genericSecretConfigured: has('EMAIL_WEBHOOK_SECRET'),
      hostingerWebhookSecretConfigured: hostingerMail.webhookSecretConfigured,
      note: 'Inbound email requires EMAIL_WEBHOOK_SECRET (generic) or the Hostinger webhook secret. Outbound requires the Hostinger Mail API or SMTP variables.',
    },
    chatSession: {
      secretConfigured: has('SESSION_SECRET'),
      secretValidLength: sessionSecretValidLength,
      note: 'SESSION_SECRET (>=32 bytes) is required in production to issue WebChat session cookies. Without it, chat sessions fail closed.',
    },
  })
}
