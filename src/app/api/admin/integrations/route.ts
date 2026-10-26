import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { guard, isResponse } from '@/lib/api-guard'
import { channelStatuses } from '@/lib/comms'
import { getZaiProviderStatus } from '@/lib/ai-provider'
import { modelServiceStatus } from '@/lib/model/router'

export const dynamic = 'force-dynamic'

/**
 * GET /api/admin/integrations
 *
 * The CRM integration panel's data source: the REAL state of every
 * outbound integration and the private AI backends.
 *
 * Every entry reports one of:
 *   CONFIGURED        — credentials present, the channel can be used
 *   NOT_CONFIGURED    — credentials absent; the platform refuses to send
 *   DISABLED_BY_ADMIN — switched off in Feature Management
 *   NOT_BUILT         — the integration is not implemented in this build
 *
 * No credential value is ever returned, and a channel that is not
 * configured is never reported as working.
 */
export async function GET(req: NextRequest) {
  const g = await guard(req, { minRole: 'SUPER_ADMIN' })
  if (isResponse(g)) return g

  const channels = channelStatuses()
  const zai = getZaiProviderStatus()
  const models = modelServiceStatus()

  let featureFlags: Record<string, boolean> = {}
  try {
    const setting = await db.setting.findUnique({ where: { key: 'feature_flags' } })
    if (setting) featureFlags = JSON.parse(setting.value) as Record<string, boolean>
  } catch {
    // The database may be unavailable; the flags are reported as absent.
  }

  const integrations: Array<{
    id: string
    name: string
    category: 'MESSAGING' | 'CRM' | 'AUTOMATION' | 'AI' | 'PAYMENTS' | 'STORAGE'
    state: 'CONFIGURED' | 'NOT_CONFIGURED' | 'DISABLED_BY_ADMIN' | 'NOT_BUILT'
    detail: string
    adminSwitch: string | null
  }> = [
    {
      id: 'whatsapp',
      name: 'WhatsApp Cloud API',
      category: 'MESSAGING',
      state: channels.WHATSAPP ? 'CONFIGURED' : 'NOT_CONFIGURED',
      detail: channels.WHATSAPP
        ? 'Credentials are present; sends are performed through the Cloud API.'
        : 'WHATSAPP_TOKEN / WHATSAPP_PHONE_NUMBER_ID are not set — sends are refused.',
      adminSwitch: 'whatsapp',
    },
    {
      id: 'email',
      name: 'SMTP email',
      category: 'MESSAGING',
      state: channels.EMAIL ? 'CONFIGURED' : 'NOT_CONFIGURED',
      detail: channels.EMAIL ? 'SMTP credentials are present.' : 'SMTP_HOST / SMTP_USER / SMTP_PASS are not set.',
      adminSwitch: 'email',
    },
    {
      id: 'sms',
      name: 'SMS gateway',
      category: 'MESSAGING',
      state: channels.SMS ? 'CONFIGURED' : 'NOT_CONFIGURED',
      detail: channels.SMS ? 'An SMS provider is configured.' : 'No SMS provider is configured.',
      adminSwitch: 'sms',
    },
    {
      id: 'social',
      name: 'Social publishing',
      category: 'MESSAGING',
      state:
        channels.FACEBOOK || channels.INSTAGRAM || channels.LINKEDIN || channels.X
          ? 'CONFIGURED'
          : 'NOT_CONFIGURED',
      detail: 'Facebook, Instagram, LinkedIn and X tokens are checked individually.',
      adminSwitch: 'social',
    },
    {
      id: 'n8n',
      name: 'n8n automation bridge',
      category: 'AUTOMATION',
      state: channels.N8N ? 'CONFIGURED' : 'NOT_CONFIGURED',
      detail: channels.N8N ? 'The n8n webhook base is configured.' : 'N8N_WEBHOOK_BASE is not set.',
      adminSwitch: 'n8n',
    },
    {
      id: 'local-model',
      name: 'Private model service (local)',
      category: 'AI',
      state: models.state === 'UNAVAILABLE' ? 'NOT_CONFIGURED' : 'CONFIGURED',
      detail: models.detail,
      adminSwitch: null,
    },
    {
      id: 'remote-model',
      name: 'Remote model provider (fallback)',
      category: 'AI',
      state: zai.state === 'CONFIGURED' ? 'CONFIGURED' : 'NOT_CONFIGURED',
      detail: zai.detail,
      adminSwitch: null,
    },
    {
      id: 'stripe',
      name: 'Stripe payments',
      category: 'PAYMENTS',
      state: process.env.STRIPE_SECRET_KEY ? 'CONFIGURED' : 'NOT_CONFIGURED',
      detail: process.env.STRIPE_SECRET_KEY
        ? 'A Stripe secret key is present.'
        : 'STRIPE_SECRET_KEY is not set — checkout is refused.',
      adminSwitch: 'payments',
    },
    {
      id: 'bank-transfer',
      name: 'Bank transfer',
      category: 'PAYMENTS',
      state: process.env.BANK_TRANSFER_DETAILS ? 'CONFIGURED' : 'NOT_CONFIGURED',
      detail: process.env.BANK_TRANSFER_DETAILS
        ? 'Manual transfer details are configured.'
        : 'BANK_TRANSFER_DETAILS is not set.',
      adminSwitch: null,
    },
    {
      id: 'ai-ops',
      name: 'Autonomous AI operations loop',
      category: 'AUTOMATION',
      state: process.env.AI_OPS_DRIVER?.trim().toLowerCase() === 'off' ? 'DISABLED_BY_ADMIN' : 'CONFIGURED',
      detail:
        process.env.AI_OPS_DRIVER?.trim().toLowerCase() === 'off'
          ? 'AI_OPS_DRIVER=off — the in-process driver is intentionally disabled.'
          : 'The in-process driver is enabled; the heartbeat is reported by /api/health/deep.',
      adminSwitch: 'aiOps',
    },
  ]

  const withAdminState = integrations.map((integration) => {
    if (integration.adminSwitch && featureFlags[integration.adminSwitch] === false) {
      return { ...integration, state: 'DISABLED_BY_ADMIN' as const, detail: `Switched off in Feature Management (${integration.adminSwitch}).` }
    }
    return integration
  })

  return Response.json({
    integrations: withAdminState,
    summary: {
      total: withAdminState.length,
      configured: withAdminState.filter((i) => i.state === 'CONFIGURED').length,
      notConfigured: withAdminState.filter((i) => i.state === 'NOT_CONFIGURED').length,
      disabled: withAdminState.filter((i) => i.state === 'DISABLED_BY_ADMIN').length,
      notBuilt: withAdminState.filter((i) => i.state === 'NOT_BUILT').length,
    },
  })
}
